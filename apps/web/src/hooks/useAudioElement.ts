import { useCallback, useEffect, useRef } from 'react';

export interface AudioEventHandlers {
  onEnded?: () => void;
  onError?: () => void;
}

export function useAudioElement() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const handlersRef = useRef<AudioEventHandlers | null>(null);

  const ensureAudio = useCallback(() => {
    if (!audioRef.current) {
      const element = new Audio();
      element.preload = 'none';
      element.crossOrigin = 'anonymous';
      audioRef.current = element;
    }
    return audioRef.current;
  }, []);

  const detachHandlers = useCallback(() => {
    const audio = audioRef.current;
    const handlers = handlersRef.current;
    if (!audio || !handlers) {
      return;
    }
    if (handlers.onEnded) {
      audio.removeEventListener('ended', handlers.onEnded);
    }
    if (handlers.onError) {
      audio.removeEventListener('error', handlers.onError as EventListener);
    }
    handlersRef.current = null;
  }, []);

  const stop = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) {
      return;
    }
    detachHandlers();
    audio.pause();
    audio.currentTime = 0;
    audio.removeAttribute('src');
    audio.load();
  }, [detachHandlers]);

  const play = useCallback(
    async (src: string, handlers: AudioEventHandlers = {}) => {
      const audio = ensureAudio();
      detachHandlers();
      handlersRef.current = handlers;
      if (handlers.onEnded) {
        audio.addEventListener('ended', handlers.onEnded, { once: true });
      }
      if (handlers.onError) {
        audio.addEventListener('error', handlers.onError as EventListener, { once: true });
      }
      audio.pause();
      audio.currentTime = 0;
      audio.src = src;
      try {
        await audio.play();
      } catch (error) {
        detachHandlers();
        audio.pause();
        audio.currentTime = 0;
        audio.removeAttribute('src');
        audio.load();
        throw error;
      }
    },
    [detachHandlers, ensureAudio]
  );

  useEffect(() => () => stop(), [stop]);

  return { audioRef, play, stop, detachHandlers, ensureAudio };
}
