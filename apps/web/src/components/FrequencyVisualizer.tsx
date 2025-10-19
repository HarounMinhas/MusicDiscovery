import React, { useEffect, useRef } from 'react';

interface FrequencyVisualizerProps {
  audioRef: React.RefObject<HTMLAudioElement | null>;
  width?: number | string;
  height?: number | string;
  barsPerBand?: number;
  fftSize?: 256 | 512 | 1024 | 2048 | 4096;
  barColor?: string;
  gap?: number;
  verticalPaddingRatio?: number;
  smoothing?: number;
}

const DEFAULT_BANDS: Array<[number, number]> = [
  [20, 150],
  [150, 400],
  [400, 2000],
  [2000, 5000],
  [5000, 20000]
];

type FrequencyDataArray = Uint8Array<ArrayBuffer>;

function resizeForHiDPI(canvas: HTMLCanvasElement) {
  const dpr = window.devicePixelRatio || 1;
  const cssW = canvas.clientWidth;
  const cssH = canvas.clientHeight;

  if (canvas.width !== Math.round(cssW * dpr) || canvas.height !== Math.round(cssH * dpr)) {
    canvas.width = Math.round(cssW * dpr);
    canvas.height = Math.round(cssH * dpr);
  }

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('2D context unavailable');
  }

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { width: cssW, height: cssH };
}

function hzToIndex(hz: number, sampleRate: number, fftSize: number) {
  const nyquist = sampleRate / 2;
  return Math.min(Math.max(Math.round((hz / nyquist) * (fftSize / 2)), 0), fftSize / 2 - 1);
}

const mediaSourceCache = new WeakMap<HTMLMediaElement, MediaElementAudioSourceNode>();
let sharedAudioContext: AudioContext | null = null;

const FrequencyVisualizer: React.FC<FrequencyVisualizerProps> = ({
  audioRef,
  width = '100%',
  height = '100%',
  barsPerBand = 8,
  fftSize = 2048,
  barColor = 'rgba(244, 245, 247, 0.85)',
  gap = 3,
  verticalPaddingRatio = 0.12,
  smoothing = 0.82
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const dataRef = useRef<FrequencyDataArray | null>(null);
  const sourceRef = useRef<MediaElementAudioSourceNode | null>(null);

  useEffect(() => {
    const audioEl = audioRef.current;
    const canvas = canvasRef.current;
    if (!audioEl || !canvas) {
      return;
    }

    let isSubscribed = true;

    const ensureContext = async () => {
      if (!isSubscribed) {
        return null;
      }

      if (!sharedAudioContext) {
        const AudioContextCtor =
          window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        sharedAudioContext = AudioContextCtor ? new AudioContextCtor() : null;
      }

      audioCtxRef.current = sharedAudioContext;

      const ctx = sharedAudioContext;
      if (!ctx) {
        return null;
      }

      if (ctx.state === 'suspended') {
        try {
          await ctx.resume();
        } catch (error) {
          console.warn('Kon AudioContext niet hervatten', error);
        }
      }

      if (!sourceRef.current) {
        let source = mediaSourceCache.get(audioEl);
        if (!source) {
          source = ctx.createMediaElementSource(audioEl);
          mediaSourceCache.set(audioEl, source);
        }
        sourceRef.current = source;
      }
      if (!analyserRef.current) {
        analyserRef.current = ctx.createAnalyser();
        analyserRef.current.fftSize = fftSize;
        analyserRef.current.smoothingTimeConstant = smoothing;
        dataRef.current = new Uint8Array(analyserRef.current.frequencyBinCount) as FrequencyDataArray;
        sourceRef.current.connect(analyserRef.current);
        analyserRef.current.connect(ctx.destination);
      }

      return ctx;
    };

    const renderFrame = () => {
      const canvasEl = canvasRef.current;
      const analyser = analyserRef.current;
      const data = dataRef.current;
      const audioCtx = audioCtxRef.current;
      if (!canvasEl || !analyser || !data || !audioCtx) {
        return;
      }

      const ctx2d = canvasEl.getContext('2d');
      if (!ctx2d) {
        return;
      }

      const { width: W, height: H } = resizeForHiDPI(canvasEl);
      ctx2d.clearRect(0, 0, W, H);
      analyser.getByteFrequencyData(data);

      const nBarsPerBand = Math.max(1, Math.floor(barsPerBand));
      const totalBars = DEFAULT_BANDS.length * nBarsPerBand;
      const baseGap = gap;
      const bandGap = baseGap * 2.5;
      const totalGap = (totalBars - 1) * baseGap;
      const bandBreaks = (DEFAULT_BANDS.length - 1) * (bandGap - baseGap);
      const barWidth = Math.max(1, (W - totalGap - bandBreaks) / totalBars);

      const padding = H * verticalPaddingRatio;
      const usableHeight = Math.max(0, H - padding * 2);

      ctx2d.fillStyle = barColor;

      let x = 0;
      DEFAULT_BANDS.forEach((band, bandIdx) => {
        const [loHz, hiHz] = band;
        const loIndex = hzToIndex(loHz, audioCtx.sampleRate, analyser.fftSize);
        const hiIndex = hzToIndex(hiHz, audioCtx.sampleRate, analyser.fftSize);
        const span = Math.max(1, hiIndex - loIndex);

        for (let i = 0; i < nBarsPerBand; i += 1) {
          const t0 = i / nBarsPerBand;
          const t1 = (i + 1) / nBarsPerBand;
          const start = loIndex + Math.floor(Math.pow(t0, 1.6) * span);
          const end = loIndex + Math.floor(Math.pow(t1, 1.6) * span);
          let sum = 0;
          let count = 0;
          for (let bin = start; bin <= end; bin += 1) {
            sum += data[bin] ?? 0;
            count += 1;
          }
          const avg = count ? sum / count : 0;
          const normalized = Math.pow(avg / 255, 0.9);
          const barHeight = Math.max(2, usableHeight * normalized);
          const y = padding + (usableHeight - barHeight);

          ctx2d.fillRect(Math.round(x), Math.round(y), Math.ceil(barWidth), Math.ceil(barHeight));
          x += barWidth + baseGap;
        }

        if (bandIdx < DEFAULT_BANDS.length - 1) {
          x += bandGap - baseGap;
        }
      });
    };

    const draw = () => {
      rafRef.current = requestAnimationFrame(() => {
        renderFrame();
        draw();
      });
    };

    const stopDrawing = () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      const canvasEl = canvasRef.current;
      if (canvasEl) {
        const ctx2d = canvasEl.getContext('2d');
        if (ctx2d) {
          const { width: W, height: H } = resizeForHiDPI(canvasEl);
          ctx2d.clearRect(0, 0, W, H);
        }
      }
    };

    const handlePlay = async () => {
      const ctx = await ensureContext();
      if (!ctx) {
        return;
      }
      if (rafRef.current === null) {
        draw();
      }
    };

    const handlePause = () => {
      stopDrawing();
    };

    audioEl.addEventListener('play', handlePlay);
    audioEl.addEventListener('pause', handlePause);
    audioEl.addEventListener('ended', handlePause);

    if (!audioEl.paused && !audioEl.ended) {
      void handlePlay();
    }

    return () => {
      isSubscribed = false;
      stopDrawing();
      audioEl.removeEventListener('play', handlePlay);
      audioEl.removeEventListener('pause', handlePause);
      audioEl.removeEventListener('ended', handlePause);
      const analyser = analyserRef.current;
      const source = sourceRef.current;
      if (analyser) {
        analyser.disconnect();
      }
      if (source && analyser) {
        try {
          source.disconnect(analyser);
        } catch (disconnectError) {
          console.warn('Kon bron niet loskoppelen van analyser', disconnectError);
        }
      }
      analyserRef.current = null;
      sourceRef.current = null;
      dataRef.current = null;
    };
  }, [audioRef, fftSize, smoothing, barsPerBand, gap, verticalPaddingRatio, barColor]);

  return (
    <canvas
      ref={canvasRef}
      className="track-list__visualizer-canvas"
      style={{ width, height }}
      aria-hidden="true"
    />
  );
};

export default FrequencyVisualizer;
