'use client';

import { useEffect, useRef, useCallback, forwardRef, useImperativeHandle } from 'react';

export interface VUMeterHandle {
  /** Must be called inside a user-gesture handler (click / keydown) so the
   *  browser permits AudioContext.resume(). Creates the context on first call. */
  initAudio: () => void;
}

interface VUMeterProps {
  videoRef: React.RefObject<HTMLVideoElement>;
  isPlaying: boolean;
}

const SEGMENT_COUNT = 20;
const PEAK_HOLD_MS = 1500;
const PEAK_DECAY_RATE = 0.015;

function getSegmentColor(index: number): string {
  if (index < 12) return '#22c55e';
  if (index < 16) return '#eab308';
  return '#ef4444';
}

export const VUMeter = forwardRef<VUMeterHandle, VUMeterProps>(function VUMeter({ videoRef, isPlaying }, ref) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserLRef = useRef<AnalyserNode | null>(null);
  const analyserRRef = useRef<AnalyserNode | null>(null);
  const splitterRef = useRef<ChannelSplitterNode | null>(null);
  const sourceRef = useRef<MediaElementAudioSourceNode | null>(null);
  const connectedRef = useRef(false);
  const rafRef = useRef<number>(0);

  const peaksRef = useRef<[number, number]>([0, 0]);
  const peakTimesRef = useRef<[number, number]>([0, 0]);
  const peakDisplayRef = useRef<[number, number]>([0, 0]);

  // ── Step 2: connect source to an already-running AudioContext ─────────────
  const connectSource = useCallback(() => {
    const video = videoRef.current;
    const ctx = audioCtxRef.current;
    if (!video || !ctx || connectedRef.current) return;

    try {
      const source = ctx.createMediaElementSource(video);
      sourceRef.current = source;
      connectedRef.current = true;

      const channels = source.channelCount ?? 1;

      if (channels >= 2) {
        const splitter = ctx.createChannelSplitter(2);
        splitterRef.current = splitter;
        const analyserL = ctx.createAnalyser();
        analyserL.fftSize = 256;
        analyserL.smoothingTimeConstant = 0.8;
        analyserLRef.current = analyserL;
        const analyserR = ctx.createAnalyser();
        analyserR.fftSize = 256;
        analyserR.smoothingTimeConstant = 0.8;
        analyserRRef.current = analyserR;
        const merger = ctx.createChannelMerger(2);
        source.connect(splitter);
        splitter.connect(analyserL, 0);
        splitter.connect(analyserR, 1);
        analyserL.connect(merger, 0, 0);
        analyserR.connect(merger, 0, 1);
        merger.connect(ctx.destination);
      } else {
        const analyserL = ctx.createAnalyser();
        analyserL.fftSize = 256;
        analyserL.smoothingTimeConstant = 0.8;
        analyserLRef.current = analyserL;
        analyserRRef.current = null;
        source.connect(analyserL);
        analyserL.connect(ctx.destination);
      }
    } catch {
      // createMediaElementSource can fail if the element was already used
    }
  }, [videoRef]);

  // ── Step 1: create + resume AudioContext — MUST run inside a user gesture ─
  const initAudio = useCallback(() => {
    if (!audioCtxRef.current) {
      const AudioContextClass =
        window.AudioContext ||
        (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioContextClass) return;
      audioCtxRef.current = new AudioContextClass();
    }
    // resume() is reliable here because we're inside the gesture handler
    if (audioCtxRef.current.state !== 'running') {
      audioCtxRef.current.resume().catch(() => {});
    }
    // If the video is already loaded, connect immediately
    connectSource();
  }, [connectSource]);

  useImperativeHandle(ref, () => ({ initAudio }));

  // Connect source once video has enough data (canplay / already loaded)
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const handleCanPlay = () => connectSource();
    if (video.readyState >= 1) {
      connectSource();
    } else {
      video.addEventListener('canplay', handleCanPlay, { once: true });
    }
    return () => video.removeEventListener('canplay', handleCanPlay);
  }, [videoRef, connectSource]);

  // Fallback: also try to resume on the native 'play' event (belt-and-suspenders)
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const handlePlay = () => {
      const ctx = audioCtxRef.current;
      if (ctx && ctx.state !== 'running') ctx.resume().catch(() => {});
    };
    video.addEventListener('play', handlePlay);
    return () => video.removeEventListener('play', handlePlay);
  }, [videoRef]);

  // rAF draw loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const draw = () => {
      rafRef.current = requestAnimationFrame(draw);
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const analyserL = analyserLRef.current;
      const analyserR = analyserRRef.current;
      const channels = analyserL && analyserR ? 2 : 1;
      const now = performance.now();

      const getLevel = (analyser: AnalyserNode | null): number => {
        if (!analyser) return 0;
        const buf = new Uint8Array(analyser.frequencyBinCount);
        analyser.getByteFrequencyData(buf);
        let sum = 0;
        for (let i = 0; i < buf.length; i++) { const v = buf[i] / 255; sum += v * v; }
        return Math.sqrt(sum / buf.length);
      };

      const levelL = isPlaying ? getLevel(analyserL) : 0;
      const levelR = isPlaying ? getLevel(analyserR) : 0;

      for (let ch = 0; ch < 2; ch++) {
        const level = ch === 0 ? levelL : levelR;
        if (level >= peaksRef.current[ch]) {
          peaksRef.current[ch] = level;
          peakTimesRef.current[ch] = now;
          peakDisplayRef.current[ch] = level;
        } else {
          if (now - peakTimesRef.current[ch] > PEAK_HOLD_MS) {
            peakDisplayRef.current[ch] = Math.max(0, peakDisplayRef.current[ch] - PEAK_DECAY_RATE);
          }
          peaksRef.current[ch] = level;
        }
      }

      const w = canvas.width;
      const h = canvas.height;
      ctx.clearRect(0, 0, w, h);

      const drawChannel = (level: number, peak: number, offsetX: number, chanW: number) => {
        const segH = Math.floor((h - (SEGMENT_COUNT - 1) * 2) / SEGMENT_COUNT);
        const segStep = segH + 2;
        const activeBars = Math.round(level * SEGMENT_COUNT);
        const peakBar = Math.round(peak * SEGMENT_COUNT);
        for (let i = 0; i < SEGMENT_COUNT; i++) {
          const y = h - (i + 1) * segStep + 2;
          ctx.globalAlpha = i < activeBars ? 1 : 0.2;
          ctx.fillStyle = getSegmentColor(i);
          ctx.fillRect(offsetX, y, chanW, segH);
          if (i === peakBar && peakBar > 0) {
            ctx.globalAlpha = 1;
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(offsetX, y, chanW, 2);
          }
        }
        ctx.globalAlpha = 1;
      };

      if (channels === 2) {
        const chanW = Math.floor((w - 2) / 2);
        drawChannel(levelL, peakDisplayRef.current[0], 0, chanW);
        drawChannel(levelR, peakDisplayRef.current[1], chanW + 2, chanW);
      } else {
        drawChannel(levelL, peakDisplayRef.current[0], 0, w);
      }
    };

    rafRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(rafRef.current);
  }, [isPlaying]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cancelAnimationFrame(rafRef.current);
      try {
        sourceRef.current?.disconnect();
        analyserLRef.current?.disconnect();
        analyserRRef.current?.disconnect();
        splitterRef.current?.disconnect();
        audioCtxRef.current?.close();
      } catch { /* ignore */ }
      connectedRef.current = false;
      audioCtxRef.current = null;
    };
  }, []);

  return (
    <div className="flex-1 flex items-stretch px-1 py-2">
      <canvas
        ref={canvasRef}
        width={20}
        height={300}
        style={{ width: '100%', height: '100%', display: 'block' }}
      />
    </div>
  );
});

VUMeter.displayName = 'VUMeter';
