import { useCallback, useEffect, useRef, useState } from 'react';
import type { Track } from '@musicdiscovery/shared';
import { getTrack } from '../api';

type PreviewValidationResult =
  | { ok: true }
  | { ok: false; status?: number; reason?: 'missing' | 'unsupported' | 'fetch-error' };

interface UseTrackPreviewResult {
  activeTrackId: string | null;
  error: string | null;
  togglePreview: (track: Track) => void;
  stopPlayback: () => void;
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

  const buildErrorMessage = useCallback((track: Track, context: {
    status?: number | null;
    mediaCode?: number | null;
    reason?: 'missing' | 'unsupported' | 'fetch-error';
  }) => {
    if (context.status === 403) {
      return `Preview voor "${track.name}" is niet beschikbaar in jouw regio (Deezer gaf status 403).`;
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
    if (!track.previewUrl) {
      return { ok: false, reason: 'missing' };
    }

    const url = track.previewUrl;
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
          return { ok: false, status: res.status };
        }
        const contentType = res.headers.get('content-type');
        if (contentType && !contentType.includes('audio')) {
          await res.body?.cancel().catch(() => {});
          return { ok: false, reason: 'unsupported' };
        }
        await res.body?.cancel().catch(() => {});
        return { ok: true };
      } catch (error) {
        return { ok: false, reason: 'fetch-error' };
      } finally {
        controller.abort();
      }
    };

    let result = await tryRequest('HEAD');
    if (!result.ok && result.status !== undefined && [405, 501].includes(result.status)) {
      result = await tryRequest('GET');
    }
    if (!result.ok && result.status === undefined) {
      result = await tryRequest('GET');
    }

    return result;
  }, []);

  const startPlayback = useCallback(
    async (track: Track, allowRefresh: boolean, token: number) => {
      if (!isEnabled) {
        return;
      }

      if (!track.previewUrl) {
        const message = buildErrorMessage(track, { reason: 'missing' });
        setError(message);
        notifyErrorRef.current?.(message);
        stop();
        return;
      }

      const validation = await validatePreview(track);
      if (playbackTokenRef.current !== token) {
        return;
      }
      if (!validation.ok) {
        const message = buildErrorMessage(track, validation);
        setError(message);
        notifyErrorRef.current?.(message);
        stop();
        return;
      }

      const audio = ensureAudio();
      detachHandlers();
      audio.pause();
      audio.currentTime = 0;
      setError(null);

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
            if (refreshed.previewUrl) {
              await startPlayback(refreshed, false, token);
              return;
            }
          } catch (refreshError) {
            console.warn('Kon Deezer-preview niet vernieuwen', refreshError);
          }
        }

        const mediaError = audio.error;
        const message = buildErrorMessage(track, {
          mediaCode: mediaError?.code ?? undefined
        });
        setError(message);
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
      audio.src = track.previewUrl;

      try {
        await audio.play();
      } catch (err) {
        audio.removeEventListener('error', handleError);
        errorHandlerRef.current = null;
        console.warn('Preview playback failed', err);
        await handleFailure();
      }
    },
    [buildErrorMessage, detachHandlers, ensureAudio, isEnabled, stop, validatePreview]
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
    stop();
  }, [stop]);

  useEffect(() => () => stop(), [stop]);

  useEffect(() => {
    if (!isEnabled) {
      stopPlayback();
    }
  }, [isEnabled, stopPlayback]);

  return { activeTrackId, error, togglePreview, stopPlayback };
}
