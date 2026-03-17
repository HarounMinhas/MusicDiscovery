import type {
  Artist,
  ProviderId,
  ProviderMetadata,
  RelatedArtistsResponse,
  Track
} from '@musicdiscovery/shared';

import type { ArtistDetailsPayload } from './cache/artistCache';
import { buildApiUrl } from './config/api';
import { getSelectedProvider } from './providerSelection';

const RETRYABLE_STATUS_CODES = new Set([408, 425, 429, 500, 502, 503, 504]);
const COLD_START_RETRY_BUDGET_MS = 65_000;
const COLD_START_RETRY_BASE_DELAY_MS = 1200;
const COLD_START_RETRY_MAX_DELAY_MS = 10_000;

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function getRetryDelayMs(attempt: number): number {
  const exponentialDelay = Math.round(COLD_START_RETRY_BASE_DELAY_MS * Math.pow(1.8, Math.max(0, attempt - 1)));
  return Math.min(COLD_START_RETRY_MAX_DELAY_MS, exponentialDelay);
}

function isRetryableStatus(status: number): boolean {
  return RETRYABLE_STATUS_CODES.has(status);
}


async function request<T>(
  path: string,
  options: { includeProvider?: boolean; provider?: ProviderId } = {}
): Promise<T> {
  const url = new URL(path, 'http://placeholder.local');

  if (options.includeProvider !== false) {
    const provider = options.provider ?? getSelectedProvider();
    url.searchParams.set('provider', provider);
  }

  const pathname = `${url.pathname}${url.search}`;
  const requestUrl = buildApiUrl(pathname);

  const startedAt = Date.now();
  for (let attempt = 1; ; attempt += 1) {
    let res: Response;
    const attemptStartedAt = Date.now();
    console.info('API request started', { requestUrl, attempt });
    try {
      res = await fetch(requestUrl, { cache: 'no-store' });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Network request failed';
      const elapsedMs = Date.now() - startedAt;
      if (elapsedMs < COLD_START_RETRY_BUDGET_MS) {
        const delayMs = getRetryDelayMs(attempt);
        console.warn('API request network failure, retrying', { requestUrl, attempt, message, elapsedMs, delayMs });
        await wait(delayMs);
        continue;
      }
      throw new Error(`${message} (exceeded retry budget ${COLD_START_RETRY_BUDGET_MS}ms)`);
    }

    if (res.ok) {
      const elapsedMs = Date.now() - attemptStartedAt;
      console.info('API request succeeded', { requestUrl, attempt, status: res.status, elapsedMs });
      return res.json() as Promise<T>;
    }

    const text = await res.text();
    const message = text || `Request failed: ${res.status}`;

    console.warn('API request failed', {
      requestUrl,
      attempt,
      status: res.status,
      message
    });

    if (isRetryableStatus(res.status)) {
      const elapsedMs = Date.now() - startedAt;
      if (elapsedMs < COLD_START_RETRY_BUDGET_MS) {
        const delayMs = getRetryDelayMs(attempt);
        console.warn('API request returned retryable status, retrying', {
          requestUrl,
          attempt,
          status: res.status,
          elapsedMs,
          delayMs
        });
        await wait(delayMs);
        continue;
      }
    }

    throw new Error(message);
  }

  throw new Error(`Request failed after exceeding retry budget (${COLD_START_RETRY_BUDGET_MS}ms)`);
}

export async function getProviderCatalog(): Promise<{ default: ProviderId; items: ProviderMetadata[] }> {
  return request('/providers', { includeProvider: false });
}

// Kept signature as (query, limit) so hooks can call searchArtists(trimmed, limit)
export async function searchArtists(query: string, limit = 10, provider?: ProviderId): Promise<Artist[]> {
  const data = await request<{ items: Artist[] }>(
    `/music/search?query=${encodeURIComponent(query)}&limit=${limit}`,
    { provider }
  );
  return data.items;
}

export async function getRelatedArtistsResponse(
  id: string,
  limit = 10,
  provider?: ProviderId
): Promise<RelatedArtistsResponse> {
  return request<RelatedArtistsResponse>(
    `/music/artists/${encodeURIComponent(id)}/related?limit=${limit}`,
    { provider }
  );
}

export async function getRelatedArtists(id: string, limit = 10, provider?: ProviderId): Promise<Artist[]> {
  const data = await getRelatedArtistsResponse(id, limit, provider);
  return data.items;
}

export async function getTopTracks(
  id: string,
  market?: string,
  limit = 10,
  provider?: ProviderId
): Promise<Track[]> {
  const params = new URLSearchParams({ limit: String(limit) });
  if (market) params.set('market', market);
  const data = await request<{ items: Track[] }>(
    `/music/artists/${encodeURIComponent(id)}/top-tracks?${params.toString()}`,
    { provider }
  );
  return data.items;
}

export async function getTrack(id: string, provider?: ProviderId): Promise<Track> {
  return request<Track>(`/music/tracks/${encodeURIComponent(id)}`, { provider });
}

export async function getArtist(id: string, provider?: ProviderId): Promise<Artist> {
  return request<Artist>(`/music/artists/${encodeURIComponent(id)}`, { provider });
}

export async function fetchArtistDetails(
  artistId: string,
  provider: ProviderId,
  options: { topTrackLimit?: number; relatedLimit?: number } = {}
): Promise<ArtistDetailsPayload> {
  const { topTrackLimit = 5, relatedLimit = 8 } = options;

  const [artist, topTracks, relatedResponse] = await Promise.all([
    getArtist(artistId, provider),
    getTopTracks(artistId, undefined, topTrackLimit, provider),
    getRelatedArtistsResponse(artistId, relatedLimit, provider)
  ]);

  return {
    artist,
    topTracks,
    relatedArtists: relatedResponse.items,
    serviceMetadata: relatedResponse.serviceMetadata
  };
}
