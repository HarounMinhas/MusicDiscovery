import { useCallback, useEffect, useRef, useState } from 'react';
import type { Track } from '@musicdiscovery/shared';

interface UseTrackPreviewResult {
  activeTrackId: string | null;
  error: string | null;
  togglePreview: (track: Track) => void;
  stopPlayback: () => void;
}

export function useTrackPreview(isEnabled: boolean): UseTrackPreviewResult {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const endedHandlerRef = useRef<(() => void) | null>(null);
  const errorHandlerRef = useRef<(() => void) | null>(null);
  const [activeTrackId, setActiveTrackId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

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

  const togglePreview = useCallback(
    (track: Track) => {
      if (!isEnabled || !track.previewUrl) {
        return;
      }

      if (track.id === activeTrackId) {
        setError(null);
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

      const handleError = () => {
        const mediaError = audio.error;
        if (mediaError) {
          const messageMap: Record<number, string> = {
            2: 'Preview kan niet worden geladen door een netwerkfout.',
            3: 'Preview kan niet worden afgespeeld (decodeerfout).',
            4: 'Preview niet beschikbaar voor dit nummer.'
          };
          setError(messageMap[mediaError.code] ?? 'Preview kan niet worden afgespeeld.');
        } else {
          setError('Preview kan niet worden afgespeeld.');
        }
        stop();
      };

      endedHandlerRef.current = handleEnded;
      errorHandlerRef.current = handleError;
      audio.addEventListener('ended', handleEnded, { once: true });
      audio.addEventListener('error', handleError, { once: true });
      setActiveTrackId(track.id);
      audio.src = track.previewUrl;
      audio
        .play()
        .catch((err) => {
          console.warn('Preview playback failed', err);
          setError('Preview kan niet worden afgespeeld.');
          stop();
        });
    },
    [activeTrackId, detachHandlers, ensureAudio, isEnabled, stop]
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
