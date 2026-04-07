'use client';

import { useEffect, useRef, memo } from 'react';

interface VUMeterProps {
  /** Same signed URL as the video player. Loaded in a hidden Audio element
   *  for analysis only — the <video> element is never touched. */
  src: string | undefined;
  isPlaying: boolean;
}

const SEGMENT_COUNT = 20;
const PEAK_HOLD_MS = 1500;
const PEAK_DECAY_RATE = 0.015;

function getSegmentColor(i: number): string {
  if (i < 12) return '#22c55e';
  if (i < 16) return '#eab308';
  return '#ef4444';
}

export const VUMeter = memo(function VUMeter({ src, isPlaying }: VUMeterProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const audioElRef = useRef<HTMLAudioElement | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserLRef = useRef<AnalyserNode | null>(null);
  const analyserRRef = useRef<AnalyserNode | null>(null);
  const connectedRef = useRef(false);
  const rafRef = useRef<number>(0);
  const peaksRef = useRef<[number, number]>([0, 0]);
  const peakTimesRef = useRef<[number, number]>([0, 0]);
  const peakDisplayRef = useRef<[number, number]>([0, 0]);

  // ── Create hidden Audio element for analysis ─────────────────────────────
  // Runs only when src changes (new asset). Never touches the <video> element.
  useEffect(() => {
    if (!src || typeof window === 'undefined') return;

    // Tear down previous
    const prevAudio = audioElRef.current;
    if (prevAudio) { prevAudio.pause(); prevAudio.src = ''; }
    if (audioCtxRef.current && audioCtxRef.current.state !== 'closed') {
      audioCtxRef.current.close().catch(() => {});
    }
    audioCtxRef.current = null;
    analyserLRef.current = null;
    analyserRRef.current = null;
    connectedRef.current = false;

    const audio = new Audio(src);
    audio.preload = 'none'; // don't preload — we only need it when playing
    audioElRef.current = audio;

    return () => {
      audio.pause();
      audio.src = '';
    };
  }, [src]);

  // ── Play / pause the hidden audio in sync with the video ─────────────────
  useEffect(() => {
    const audio = audioElRef.current;
    if (!audio) return;

    if (isPlaying) {
      // Build the Web Audio graph on first play (needs user gesture context
      // that was already invoked by the video play click)
      if (!connectedRef.current) {
        try {
          const Ctor =
            window.AudioContext ||
            (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
          if (Ctor) {
            const ctx = new Ctor();
            audioCtxRef.current = ctx;

            const source = ctx.createMediaElementSource(audio);
            const analyserL = ctx.createAnalyser();
            analyserL.fftSize = 256; analyserL.smoothingTimeConstant = 0.8;
            const analyserR = ctx.createAnalyser();
            analyserR.fftSize = 256; analyserR.smoothingTimeConstant = 0.8;
            const splitter = ctx.createChannelSplitter(2);

            source.connect(splitter);
            splitter.connect(analyserL, 0);
            splitter.connect(analyserR, 1);
            // No ctx.destination — this audio element is silent.
            // All audible output comes from the <video> element.

            analyserLRef.current = analyserL;
            analyserRRef.current = analyserR;
            connectedRef.current = true;

            if (ctx.state !== 'running') ctx.resume().catch(() => {});
          }
        } catch { /* security restriction — meter stays dark, player unaffected */ }
      } else if (audioCtxRef.current?.state !== 'running') {
        audioCtxRef.current?.resume().catch(() => {});
      }

      audio.play().catch(() => {});
    } else {
      audio.pause();
    }
  }, [isPlaying]);

  // ── Cleanup on unmount ───────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      cancelAnimationFrame(rafRef.current);
      const a = audioElRef.current;
      if (a) { a.pause(); a.src = ''; }
      audioCtxRef.current?.close().catch(() => {});
    };
  }, []);

  // ── rAF draw loop ────────────────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const draw = () => {
      rafRef.current = requestAnimationFrame(draw);
      const ctx2d = canvas.getContext('2d');
      if (!ctx2d) return;

      const now = performance.now();
      const getLevel = (a: AnalyserNode | null): number => {
        if (!a) return 0;
        const buf = new Uint8Array(a.frequencyBinCount);
        a.getByteFrequencyData(buf);
        let sum = 0;
        for (let i = 0; i < buf.length; i++) { const v = buf[i] / 255; sum += v * v; }
        return Math.sqrt(sum / buf.length);
      };

      const levelL = isPlaying ? getLevel(analyserLRef.current) : 0;
      const levelR = isPlaying ? getLevel(analyserRRef.current) : 0;

      for (let ch = 0; ch < 2; ch++) {
        const lv = ch === 0 ? levelL : levelR;
        if (lv >= peaksRef.current[ch]) {
          peaksRef.current[ch] = lv; peakTimesRef.current[ch] = now; peakDisplayRef.current[ch] = lv;
        } else {
          if (now - peakTimesRef.current[ch] > PEAK_HOLD_MS)
            peakDisplayRef.current[ch] = Math.max(0, peakDisplayRef.current[ch] - PEAK_DECAY_RATE);
          peaksRef.current[ch] = lv;
        }
      }

      const w = canvas.width, h = canvas.height;
      ctx2d.clearRect(0, 0, w, h);
      const drawChan = (level: number, peak: number, ox: number, cw: number) => {
        const segH = Math.floor((h - (SEGMENT_COUNT - 1) * 2) / SEGMENT_COUNT);
        const segStep = segH + 2;
        const active = Math.round(level * SEGMENT_COUNT);
        const peakSeg = Math.round(peak * SEGMENT_COUNT);
        for (let i = 0; i < SEGMENT_COUNT; i++) {
          const y = h - (i + 1) * segStep + 2;
          ctx2d.globalAlpha = i < active ? 1 : 0.2;
          ctx2d.fillStyle = getSegmentColor(i);
          ctx2d.fillRect(ox, y, cw, segH);
          if (i === peakSeg && peakSeg > 0) {
            ctx2d.globalAlpha = 1; ctx2d.fillStyle = '#ffffff';
            ctx2d.fillRect(ox, y, cw, 2);
          }
        }
        ctx2d.globalAlpha = 1;
      };
      const cw = Math.floor((w - 2) / 2);
      drawChan(levelL, peakDisplayRef.current[0], 0, cw);
      drawChan(levelR, peakDisplayRef.current[1], cw + 2, cw);
    };

    rafRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(rafRef.current);
  }, [isPlaying]);

  return (
    <div className="flex-1 flex items-stretch px-1 py-2">
      <canvas ref={canvasRef} width={20} height={300}
        style={{ width: '100%', height: '100%', display: 'block' }} />
    </div>
  );
});

VUMeter.displayName = 'VUMeter';
