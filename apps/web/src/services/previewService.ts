import type { Track } from '@musicdiscovery/shared';

import { getTrack } from '../api';

export type PreviewFailureReason = 'missing' | 'unsupported' | 'fetch-error' | 'too-large';

export interface PreviewFailureDetails {
  status?: number;
  reason?: PreviewFailureReason;
  mediaCode?: number | null;
  deezerReference?: string | null;
  deezerIp?: string | null;
  maxBytes?: number;
  contentLength?: number | null;
}

export type PreviewValidationResult =
  | { ok: true }
  | { ok: false; details: PreviewFailureDetails };

const MAX_PREVIEW_BYTES = 10 * 1024 * 1024;
const METADATA_TTL_MS = 60 * 1000;

interface CachedTrack {
  track: Track;
  fetchedAt: number;
}

const metadataCache = new Map<string, CachedTrack>();

export async function getTrackMetadata(trackId: string, options: { forceRefresh?: boolean } = {}): Promise<Track> {
  const { forceRefresh = false } = options;
  if (!forceRefresh) {
    const cached = metadataCache.get(trackId);
    if (cached && Date.now() - cached.fetchedAt < METADATA_TTL_MS) {
      return cached.track;
    }
  }

  const track = await getTrack(trackId);
  metadataCache.set(trackId, { track, fetchedAt: Date.now() });
  return track;
}

export function mergeTrackMetadata(base: Track, next: Track): Track {
  return {
    ...base,
    ...next,
    previewUrl: next.previewUrl ?? base.previewUrl,
    previewProxyUrl: next.previewProxyUrl ?? base.previewProxyUrl
  };
}

interface ProbeOptions {
  fetchImpl?: typeof fetch;
  maxBytes?: number;
}

export async function probePreview(url: string, options: ProbeOptions = {}): Promise<PreviewValidationResult> {
  const { fetchImpl = fetch, maxBytes = MAX_PREVIEW_BYTES } = options;

  if (!url) {
    return { ok: false, details: { reason: 'missing' } };
  }

  const tryRequest = async (method: 'HEAD' | 'GET'): Promise<PreviewValidationResult> => {
    const controller = new AbortController();
    const requestInit: RequestInit = {
      method,
      cache: 'no-store',
      mode: 'cors',
      signal: controller.signal
    };
    if (method === 'GET') {
      requestInit.headers = { Range: 'bytes=0-0' };
    }

    try {
      const response = await fetchImpl(url, requestInit);
      if (!response.ok) {
        const details: PreviewFailureDetails = { status: response.status };
        const deezerIp = response.headers.get('x-deezer-client-ip');
        if (deezerIp) {
          details.deezerIp = deezerIp;
        }
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('text')) {
          try {
            const bodyText = await response.text();
            const match = bodyText.match(/Reference #([A-Za-z0-9.]+)/i);
            if (match) {
              details.deezerReference = match[1];
            }
          } catch (error) {
            console.warn('Kon Deezer-fouttekst niet lezen', error);
          }
        }
        return { ok: false, details };
      }

      const contentType = response.headers.get('content-type');
      if (contentType && !contentType.includes('audio')) {
        await response.body?.cancel().catch(() => {});
        return { ok: false, details: { reason: 'unsupported', status: response.status ?? undefined } };
      }

      const contentLengthHeader = response.headers.get('content-length');
      if (contentLengthHeader) {
        const contentLength = Number(contentLengthHeader);
        if (Number.isFinite(contentLength) && contentLength > maxBytes) {
          await response.body?.cancel().catch(() => {});
          return {
            ok: false,
            details: { reason: 'too-large', status: response.status ?? undefined, maxBytes, contentLength }
          };
        }
      }

      await response.body?.cancel().catch(() => {});
      return { ok: true };
    } catch (error) {
      return { ok: false, details: { reason: 'fetch-error' } };
    } finally {
      controller.abort();
    }
  };

  let result = await tryRequest('HEAD');
  if (!result.ok && result.details.status !== undefined && [405, 501].includes(result.details.status)) {
    result = await tryRequest('GET');
  } else if (!result.ok && result.details.status === undefined) {
    result = await tryRequest('GET');
  }

  return result;
}
