import React, { useEffect, useRef } from 'react';
import AudioMotionAnalyzer from 'audiomotion-analyzer';

interface FrequencyVisualizerProps {
  audioRef: React.RefObject<HTMLAudioElement | null>;
  width?: number | string;
  height?: number | string;
  fftSize?: number;
  barColor?: string;
  smoothing?: number;
}

const GRADIENT_NAME = 'track-visualizer';

const FrequencyVisualizer: React.FC<FrequencyVisualizerProps> = ({
  audioRef,
  width = '100%',
  height = '100%',
  fftSize = 1024,
  barColor = 'rgba(244, 245, 247, 0.85)',
  smoothing = 0.82
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const analyzerRef = useRef<AudioMotionAnalyzer | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    const audioEl = audioRef.current;

    if (!container || !audioEl) {
      return undefined;
    }

    const analyzer = new AudioMotionAnalyzer(container, {
      source: audioEl,
      connectSpeakers: false,
      mode: 2,
      roundBars: true,
      colorMode: 'bar-index',
      showBgColor: false,
      mirror: 0,
      reflexRatio: 0.5,
      reflexAlpha: 1,
      reflexBright: 1
    });

    analyzerRef.current = analyzer;

    const resumeContext = () => {
      if (analyzer.audioCtx.state === 'suspended') {
        void analyzer.audioCtx.resume();
      }
    };

    audioEl.addEventListener('play', resumeContext);

    return () => {
      audioEl.removeEventListener('play', resumeContext);
      analyzer.destroy();
      analyzerRef.current = null;
    };
  }, [audioRef]);

  useEffect(() => {
    const analyzer = analyzerRef.current;
    if (!analyzer) {
      return;
    }

    analyzer.registerGradient(GRADIENT_NAME, {
      colorStops: [barColor]
    });

    analyzer.setOptions({
      gradient: GRADIENT_NAME,
      colorMode: 'bar-index',
      roundBars: true,
      showBgColor: false,
      mirror: 0,
      reflexRatio: 0.5,
      reflexAlpha: 1,
      reflexBright: 1
    });

    analyzer.fftSize = fftSize;
    analyzer.smoothing = smoothing;
  }, [barColor, fftSize, smoothing]);

  return (
    <div
      ref={containerRef}
      className="track-list__visualizer-canvas"
      style={{ width, height, backgroundColor: '#000' }}
      aria-hidden="true"
    />
  );
};

export default FrequencyVisualizer;
