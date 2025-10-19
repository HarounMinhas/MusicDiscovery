import { useCallback, useEffect, useRef, useState } from 'react';
import type { MutableRefObject } from 'react';
import type { Track } from '@musicdiscovery/shared';
import { getTrack } from '../api';

type PreviewFailureReason = 'missing' | 'unsupported' | 'fetch-error';

interface PreviewFailureDetails {
  status?: number;
  reason?: PreviewFailureReason;
  mediaCode?: number | null;
  deezerReference?: string | null;
  deezerIp?: string | null;
}

type PreviewValidationResult =
  | { ok: true }
  | { ok: false; details: PreviewFailureDetails };

interface PreviewFailure {
  track: Track;
  details: PreviewFailureDetails;
  timestamp: number;
}

interface UseTrackPreviewResult {
  activeTrackId: string | null;
  error: string | null;
  failure: PreviewFailure | null;
  togglePreview: (track: Track) => void;
  stopPlayback: () => void;
  audioRef: MutableRefObject<HTMLAudioElement | null>;
}

export function useTrackPreview(
  isEnabled: boolean,
  onPlaybackError?: (message: string) => void
): UseTrackPreviewResult {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const endedHandlerRef = useRef<(() => void) | null>(null);
  const errorHandlerRef = useRef<(() => void) | null>(null);
  const [activeTrackId, setActiveTrackId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [failure, setFailure] = useState<PreviewFailure | null>(null);
  const notifyErrorRef = useRef<typeof onPlaybackError>();
  const playbackTokenRef = useRef(0);

  useEffect(() => {
    notifyErrorRef.current = onPlaybackError;
  }, [onPlaybackError]);

  const detachHandlers = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) {
      return;
    }
    if (endedHandlerRef.current) {
      audio.removeEventListener('ended', endedHandlerRef.current);
      endedHandlerRef.current = null;
    }
    if (errorHandlerRef.current) {
      audio.removeEventListener('error', errorHandlerRef.current);
      errorHandlerRef.current = null;
    }
  }, []);

  const stop = useCallback(() => {
    playbackTokenRef.current += 1;
    const audio = audioRef.current;
    if (audio) {
      detachHandlers();
      audio.pause();
      audio.currentTime = 0;
      audio.removeAttribute('src');
      audio.load();
    }
    setActiveTrackId(null);
  }, [detachHandlers]);

  const ensureAudio = useCallback(() => {
    if (!audioRef.current) {
      const element = new Audio();
      element.preload = 'none';
      element.crossOrigin = 'anonymous';
      audioRef.current = element;
    }
    return audioRef.current;
  }, []);

  const buildErrorMessage = useCallback((track: Track, context: PreviewFailureDetails) => {
    if (context.status === 403) {
      const reference = context.deezerReference ? ` Referentie: ${context.deezerReference}.` : '';
      const clientIp = context.deezerIp ? ` CDN-IP: ${context.deezerIp}.` : '';
      return `Preview voor "${track.name}" is door Deezer geblokkeerd (status 403 Forbidden). Dit gebeurt wanneer de sample wegens licentie- of regio-beperkingen niet publiek afgespeeld mag worden.${reference}${clientIp}`;
    }
    if (context.status && context.status >= 400) {
      return `Preview voor "${track.name}" kan niet worden geladen (status ${context.status}).`;
    }
    switch (context.mediaCode) {
      case 2:
        return `Preview voor "${track.name}" kan niet worden geladen door een netwerkfout.`;
      case 3:
        return `Preview voor "${track.name}" kan niet worden afgespeeld (decodeerfout).`;
      case 4:
        return `Preview voor "${track.name}" is niet beschikbaar.`;
      default:
        break;
    }
    if (context.reason === 'missing') {
      return `Preview voor "${track.name}" is niet beschikbaar voor dit nummer.`;
    }
    if (context.reason === 'unsupported') {
      return `Preview voor "${track.name}" wordt niet als audio aangeleverd door Deezer.`;
    }
    if (context.reason === 'fetch-error') {
      return `Preview voor "${track.name}" kan niet worden geladen. Controleer je verbinding en probeer opnieuw.`;
    }
    return `Preview voor "${track.name}" kan niet worden afgespeeld. Mogelijk is de Deezer-preview verlopen; probeer het opnieuw.`;
  }, []);

  // Deezer signiert voorvertonings-URL's en blokkeert sommige nummers per regio of verlopen token
  // (zie https://developers.deezer.com/api/track voor "preview"-beperkingen).
  // We voeren daarom een lichte CORS-check uit zodat we een duidelijke melding kunnen tonen
  // in plaats van een generieke HTMLMediaElement-fout.
  const validatePreview = useCallback(async (track: Track): Promise<PreviewValidationResult> => {
    const previewSource = track.previewProxyUrl ?? track.previewUrl;
    if (!previewSource) {
      return { ok: false, details: { reason: 'missing' } };
    }

    const url = previewSource;
    const tryRequest = async (method: 'HEAD' | 'GET'): Promise<PreviewValidationResult> => {
      const controller = new AbortController();
      const options: RequestInit = {
        method,
        cache: 'no-store',
        mode: 'cors',
        signal: controller.signal
      };
      if (method === 'GET') {
        options.headers = { Range: 'bytes=0-0' };
      }

      try {
        const res = await fetch(url, options);
        if (!res.ok) {
          const details: PreviewFailureDetails = { status: res.status };
          const exposedHeaders = res.headers;
          const deezerIp = exposedHeaders.get('x-deezer-client-ip');
          if (deezerIp) {
            details.deezerIp = deezerIp;
          }
          const contentType = res.headers.get('content-type');
          if (contentType && contentType.includes('text')) {
            try {
              const bodyText = await res.text();
              const match = bodyText.match(/Reference #([A-Za-z0-9.]+)/i);
              if (match) {
                details.deezerReference = match[1];
              }
            } catch (readError) {
              console.warn('Kon Deezer-fouttekst niet lezen', readError);
            }
          }
          return { ok: false, details };
        }
        const contentType = res.headers.get('content-type');
        if (contentType && !contentType.includes('audio')) {
          await res.body?.cancel().catch(() => {});
          return { ok: false, details: { reason: 'unsupported', status: res.status } };
        }
        await res.body?.cancel().catch(() => {});
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
    }
    if (!result.ok && result.details.status === undefined) {
      result = await tryRequest('GET');
    }

    return result;
  }, []);

  const playPreparedTrack = useCallback(
    async (track: Track, allowRefresh: boolean, token: number) => {
      const previewSource = track.previewProxyUrl ?? track.previewUrl;
      if (!previewSource) {
        const details: PreviewFailureDetails = { reason: 'missing' };
        const message = buildErrorMessage(track, details);
        setError(message);
        setFailure({ track, details, timestamp: Date.now() });
        notifyErrorRef.current?.(message);
        stop();
        return;
      }

      const validation = await validatePreview(track);
      if (playbackTokenRef.current !== token) {
        return;
      }
      if (!validation.ok) {
        const message = buildErrorMessage(track, validation.details);
        setError(message);
        setFailure({ track, details: validation.details, timestamp: Date.now() });
        notifyErrorRef.current?.(message);
        stop();
        return;
      }

      const audio = ensureAudio();
      detachHandlers();
      audio.pause();
      audio.currentTime = 0;
      setError(null);
      setFailure(null);

      const handleEnded = () => {
        stop();
      };

      const handleFailure = async () => {
        if (playbackTokenRef.current !== token) {
          return;
        }
        detachHandlers();
        if (allowRefresh) {
          try {
            const refreshed = await getTrack(track.id);
            const merged = {
              ...track,
              ...refreshed,
              previewUrl: refreshed.previewUrl ?? track.previewUrl,
              previewProxyUrl: refreshed.previewProxyUrl ?? track.previewProxyUrl
            };
            const mergedSource = merged.previewProxyUrl ?? merged.previewUrl;
            if (mergedSource) {
              await playPreparedTrack(merged, false, token);
              return;
            }
          } catch (refreshError) {
            console.warn('Kon Deezer-preview niet vernieuwen', refreshError);
          }
        }

        const mediaError = audio.error;
        const details: PreviewFailureDetails = {
          mediaCode: mediaError?.code ?? undefined
        };
        const message = buildErrorMessage(track, details);
        setError(message);
        setFailure({ track, details, timestamp: Date.now() });
        notifyErrorRef.current?.(message);
        stop();
      };

      const handleError = () => {
        void handleFailure();
      };

      endedHandlerRef.current = handleEnded;
      errorHandlerRef.current = handleError;
      audio.addEventListener('ended', handleEnded, { once: true });
      audio.addEventListener('error', handleError, { once: true });
      setActiveTrackId(track.id);
      audio.src = previewSource;

      try {
        await audio.play();
      } catch (err) {
        audio.removeEventListener('error', handleError);
        errorHandlerRef.current = null;
        console.warn('Preview playback failed', err);
        await handleFailure();
      }
    },
    [buildErrorMessage, detachHandlers, ensureAudio, stop, validatePreview]
  );

  const startPlayback = useCallback(
    async (track: Track, allowRefresh: boolean, token: number) => {
      if (!isEnabled) {
        return;
      }

      let preparedTrack = track;
      try {
        const refreshed = await getTrack(track.id);
        preparedTrack = {
          ...track,
          ...refreshed,
          previewUrl: refreshed.previewUrl ?? track.previewUrl,
          previewProxyUrl: refreshed.previewProxyUrl ?? track.previewProxyUrl
        };
      } catch (fetchError) {
        console.warn('Kon trackgegevens niet ophalen voor preview', fetchError);
      }

      if (playbackTokenRef.current !== token) {
        return;
      }

      await playPreparedTrack(preparedTrack, allowRefresh, token);
    },
    [isEnabled, playPreparedTrack]
  );

  const togglePreview = useCallback(
    (track: Track) => {
      if (!isEnabled) {
        return;
      }

      if (track.id === activeTrackId) {
        setError(null);
        stop();
        return;
      }

      const token = ++playbackTokenRef.current;
      void startPlayback(track, true, token);
    },
    [activeTrackId, isEnabled, startPlayback, stop]
  );

  const stopPlayback = useCallback(() => {
    setError(null);
    setFailure(null);
    stop();
  }, [stop]);

  useEffect(() => () => stop(), [stop]);

  useEffect(() => {
    if (!isEnabled) {
      stopPlayback();
    }
  }, [isEnabled, stopPlayback]);

  return { activeTrackId, error, failure, togglePreview, stopPlayback, audioRef };
}
