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

interface AnalyzerEntry {
  analyzer: AudioMotionAnalyzer;
  source?: MediaElementAudioSourceNode | AudioNode;
}

const analyzerCache = new WeakMap<HTMLMediaElement, AnalyzerEntry>();

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
      return () => {};
    }

    let entry = analyzerCache.get(audioEl);
    let analyzer: AudioMotionAnalyzer;

    if (!entry) {
      analyzer = new AudioMotionAnalyzer(container, {
        connectSpeakers: true,
        mode: 2,
        roundBars: true,
        colorMode: 'bar-index',
        showBgColor: false,
        mirror: 0,
        reflexRatio: 0.5,
        reflexAlpha: 1,
        reflexBright: 1,
        reflexFit: true,
        showPeaks: false,
        showScaleX: false
      });
      const sourceNode = analyzer.connectInput(audioEl);
      entry = { analyzer, source: sourceNode };
      analyzerCache.set(audioEl, entry);
    } else {
      ({ analyzer } = entry);
      if (!entry.source) {
        entry.source = analyzer.connectInput(audioEl);
      }
    }

    const canvas = entry.analyzer.canvas;
    if (canvas.parentElement !== container) {
      container.replaceChildren(canvas);
    }
    canvas.style.margin = '0 auto';
    canvas.style.display = 'block';
    canvas.style.width = '100%';
    canvas.style.height = '100%';

    analyzerRef.current = entry.analyzer;

    const resumeContext = () => {
      if (analyzerRef.current?.audioCtx.state === 'suspended') {
        void analyzerRef.current.audioCtx.resume();
      }
    };

    audioEl.addEventListener('play', resumeContext);

    return () => {
      audioEl.removeEventListener('play', resumeContext);
      const activeAnalyzer = analyzerRef.current;
      if (activeAnalyzer) {
        const canvas = activeAnalyzer.canvas;
        if (canvas.parentElement === container) {
          container.removeChild(canvas);
        }
      }
      analyzerRef.current = null;
    };
  }, [audioRef]);

  useEffect(() => {
    const analyzer = analyzerRef.current;
    if (!analyzer) {
      return;
    }

    analyzer.registerGradient(GRADIENT_NAME, {
      bgColor: '#000',
      colorStops: [barColor]
    });

    analyzer.setOptions({
      mode: 2,
      gradient: GRADIENT_NAME,
      colorMode: 'bar-index',
      roundBars: true,
      showBgColor: false,
      mirror: 0,
      reflexRatio: 0.5,
      reflexAlpha: 1,
      reflexBright: 1,
      reflexFit: true,
      showPeaks: false,
      showScaleX: false
    });

    analyzer.fftSize = fftSize;
    analyzer.smoothing = smoothing;
  }, [barColor, fftSize, smoothing]);

  return (
    <div
      ref={containerRef}
      className="track-list__visualizer-canvas"
      style={{
        width,
        height,
        backgroundColor: '#000',
        display: 'grid',
        placeItems: 'center'
      }}
      aria-hidden="true"
    />
  );
};

export default FrequencyVisualizer;
