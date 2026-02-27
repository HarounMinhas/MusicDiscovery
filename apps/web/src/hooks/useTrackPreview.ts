import { useCallback, useEffect, useRef, useState } from 'react';
import type { MutableRefObject } from 'react';
import type { Track } from '@musicdiscovery/shared';

import { useAudioElement } from './useAudioElement';
import { getTrackMetadata, mergeTrackMetadata, probePreview, type PreviewFailureDetails } from '../services/previewService';

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

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes)) {
    return `${bytes}`;
  }
  if (bytes >= 1_048_576) {
    return `${(bytes / 1_048_576).toFixed(1)} MB`;
  }
  if (bytes >= 1024) {
    return `${(bytes / 1024).toFixed(1)} kB`;
  }
  return `${bytes} B`;
}

function buildErrorMessage(track: Track, details: PreviewFailureDetails): string {
  if (details.status === 403) {
    const reference = details.deezerReference ? ` Referentie: ${details.deezerReference}.` : '';
    const clientIp = details.deezerIp ? ` CDN-IP: ${details.deezerIp}.` : '';
    return `Preview voor "${track.name}" is door Deezer geblokkeerd (status 403 Forbidden). Dit gebeurt wanneer de sample wegens licentie- of regio-beperkingen niet publiek afgespeeld mag worden.${reference}${clientIp}`;
  }
  if (details.status && details.status >= 400) {
    return `Preview voor "${track.name}" kan niet worden geladen (status ${details.status}).`;
  }
  switch (details.mediaCode) {
    case 2:
      return `Preview voor "${track.name}" kan niet worden geladen door een netwerkfout.`;
    case 3:
      return `Preview voor "${track.name}" kan niet worden afgespeeld (decodeerfout).`;
    case 4:
      return `Preview voor "${track.name}" is niet beschikbaar.`;
    default:
      break;
  }
  if (details.reason === 'too-large') {
    const limit = details.maxBytes ? formatBytes(details.maxBytes) : undefined;
    const actual = details.contentLength ? formatBytes(details.contentLength) : undefined;
    if (limit && actual) {
      return `Preview voor "${track.name}" is te groot (${actual}); maximaal toegestaan is ${limit}.`;
    }
    if (limit) {
      return `Preview voor "${track.name}" is groter dan ${limit} en kan niet worden geladen.`;
    }
    return `Preview voor "${track.name}" is te groot om te laden.`;
  }
  if (details.reason === 'missing') {
    return `Preview voor "${track.name}" is niet beschikbaar voor dit nummer.`;
  }
  if (details.reason === 'unsupported') {
    return `Preview voor "${track.name}" wordt niet als audio aangeleverd door Deezer.`;
  }
  if (details.reason === 'fetch-error') {
    return `Preview voor "${track.name}" kan niet worden geladen. Controleer je verbinding en probeer opnieuw.`;
  }
  return `Preview voor "${track.name}" kan niet worden afgespeeld. Mogelijk is de Deezer-preview verlopen; probeer het opnieuw.`;
}

export function useTrackPreview(isEnabled: boolean, onPlaybackError?: (message: string) => void): UseTrackPreviewResult {
  const { audioRef, play, stop, detachHandlers } = useAudioElement();
  const [activeTrackId, setActiveTrackId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [failure, setFailure] = useState<PreviewFailure | null>(null);
  const notifyErrorRef = useRef<typeof onPlaybackError>();
  const playbackTokenRef = useRef(0);

  useEffect(() => {
    notifyErrorRef.current = onPlaybackError;
  }, [onPlaybackError]);

  const finalizeFailure = useCallback(
    (track: Track, details: PreviewFailureDetails) => {
      const message = buildErrorMessage(track, details);
      setError(message);
      setFailure({ track, details, timestamp: Date.now() });
      notifyErrorRef.current?.(message);
    },
    []
  );

  const stopPlayback = useCallback(() => {
    setActiveTrackId(null);
    stop();
  }, [stop]);

  const playPreparedTrack = useCallback(
    async (track: Track, allowRefresh: boolean, token: number) => {
      if (!isEnabled) {
        return;
      }
      // Use direct previewUrl instead of proxy to avoid 404 errors
      const previewSource = track.previewUrl;
      if (!previewSource) {
        finalizeFailure(track, { reason: 'missing' });
        stopPlayback();
        return;
      }

      const validation = await probePreview(previewSource);
      if (playbackTokenRef.current !== token) {
        return;
      }
      if (!validation.ok) {
        finalizeFailure(track, validation.details);
        stopPlayback();
        return;
      }

      const handlePlaybackFailure = async () => {
        if (playbackTokenRef.current !== token) {
          return;
        }
        detachHandlers();
        if (allowRefresh) {
          try {
            const refreshed = mergeTrackMetadata(track, await getTrackMetadata(track.id, { forceRefresh: true }));
            const refreshedSource = refreshed.previewUrl;
            if (refreshedSource) {
              await playPreparedTrack(refreshed, false, token);
              return;
            }
          } catch (refreshError) {
            console.warn('Kon Deezer-preview niet vernieuwen', refreshError);
          }
        }
        const mediaError = audioRef.current?.error?.code ?? null;
        finalizeFailure(track, { mediaCode: mediaError, reason: 'fetch-error' });
        stopPlayback();
      };

      const handleEnded = () => {
        if (playbackTokenRef.current === token) {
          stopPlayback();
        }
      };

      const handleError = () => {
        void handlePlaybackFailure();
      };

      try {
        await play(previewSource, { onEnded: handleEnded, onError: handleError });
        if (playbackTokenRef.current !== token) {
          return;
        }
        setActiveTrackId(track.id);
        setError(null);
        setFailure(null);
      } catch (playError) {
        if (playbackTokenRef.current !== token) {
          return;
        }
        console.warn('Preview playback failed', playError);
        await handlePlaybackFailure();
      }
    },
    [audioRef, detachHandlers, finalizeFailure, isEnabled, play, stopPlayback]
  );

  const startPlayback = useCallback(
    async (track: Track, allowRefresh: boolean, token: number) => {
      if (!isEnabled) {
        return;
      }

      let prepared = track;
      try {
        const metadata = await getTrackMetadata(track.id);
        prepared = mergeTrackMetadata(track, metadata);
      } catch (metadataError) {
        console.warn('Kon trackgegevens niet ophalen voor preview', metadataError);
      }

      if (playbackTokenRef.current !== token) {
        return;
      }

      await playPreparedTrack(prepared, allowRefresh, token);
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
        setFailure(null);
        stopPlayback();
        return;
      }

      const token = ++playbackTokenRef.current;
      void startPlayback(track, true, token);
    },
    [activeTrackId, isEnabled, startPlayback, stopPlayback]
  );

  useEffect(() => stopPlayback, [stopPlayback]);

  useEffect(() => {
    if (!isEnabled) {
      stopPlayback();
    }
  }, [isEnabled, stopPlayback]);

  return { activeTrackId, error, failure, togglePreview, stopPlayback, audioRef };
}
