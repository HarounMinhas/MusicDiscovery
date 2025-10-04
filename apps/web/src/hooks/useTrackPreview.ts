import { useCallback, useEffect, useRef, useState } from 'react';
import type { Track } from '@musicdiscovery/shared';

interface UseTrackPreviewResult {
  activeTrackId: string | null;
  togglePreview: (track: Track) => void;
  stopPlayback: () => void;
}

export function useTrackPreview(isEnabled: boolean): UseTrackPreviewResult {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [activeTrackId, setActiveTrackId] = useState<string | null>(null);

  const stop = useCallback(() => {
    const audio = audioRef.current;
    if (audio) {
      audio.pause();
      audio.currentTime = 0;
    }
    audioRef.current = null;
    setActiveTrackId(null);
  }, []);

  const togglePreview = useCallback(
    (track: Track) => {
      if (!isEnabled || !track.previewUrl) {
        return;
      }

      if (track.id === activeTrackId) {
        stop();
        return;
      }

      stop();

      const audio = new Audio(track.previewUrl);
      audioRef.current = audio;
      setActiveTrackId(track.id);

      const handleEnded = () => {
        stop();
      };

      audio.addEventListener('ended', handleEnded, { once: true });
      audio.play().catch(() => {
        stop();
      });
    },
    [activeTrackId, isEnabled, stop]
  );

  useEffect(() => () => stop(), [stop]);

  useEffect(() => {
    if (!isEnabled) {
      stop();
    }
  }, [isEnabled, stop]);

  return { activeTrackId, togglePreview, stopPlayback: stop };
}
