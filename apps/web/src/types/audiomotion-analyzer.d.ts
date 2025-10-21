declare module 'audiomotion-analyzer' {
  export interface AnalyzerGradient {
    bgColor?: string;
    colorStops: string[];
  }

  export interface AnalyzerOptions {
    connectSpeakers?: boolean;
    mode?: number;
    roundBars?: boolean;
    colorMode?: string;
    showBgColor?: boolean;
    gradient?: string;
    mirror?: number;
    reflexRatio?: number;
    reflexAlpha?: number;
    reflexBright?: number;
    reflexFit?: boolean;
    showPeaks?: boolean;
    showScaleX: boolean;
  }

  export default class AudioMotionAnalyzer {
    readonly canvas: HTMLCanvasElement;
    readonly audioCtx: AudioContext;
    fftSize: number;
    smoothing: number;

    constructor(container: HTMLElement, options?: AnalyzerOptions);

    connectInput(source: HTMLMediaElement | AudioNode): MediaElementAudioSourceNode | AudioNode;

    registerGradient(name: string, gradient: AnalyzerGradient): void;

    setOptions(options: AnalyzerOptions): void;
  }
}
