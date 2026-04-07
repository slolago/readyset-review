'use client';

import { useEffect, useRef, useCallback } from 'react';

interface VUMeterProps {
  videoRef: React.RefObject<HTMLVideoElement>;
  isPlaying: boolean;
}

const SEGMENT_COUNT = 20;
const PEAK_HOLD_MS = 1500;
const PEAK_DECAY_RATE = 0.015; // per frame

function getSegmentColor(index: number): string {
  // index is 0-based from bottom
  if (index < 12) return '#22c55e'; // green
  if (index < 16) return '#eab308'; // yellow
  return '#ef4444'; // red
}

export function VUMeter({ videoRef, isPlaying }: VUMeterProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserLRef = useRef<AnalyserNode | null>(null);
  const analyserRRef = useRef<AnalyserNode | null>(null);
  const splitterRef = useRef<ChannelSplitterNode | null>(null);
  const sourceRef = useRef<MediaElementAudioSourceNode | null>(null);
  const connectedRef = useRef(false);
  const rafRef = useRef<number>(0);
  const channelCountRef = useRef(1);

  // Peak hold state: [leftPeak, rightPeak] as 0–1 values
  const peaksRef = useRef<[number, number]>([0, 0]);
  const peakTimesRef = useRef<[number, number]>([0, 0]);
  const peakDisplayRef = useRef<[number, number]>([0, 0]);

  const connectAudio = useCallback(() => {
    const video = videoRef.current;
    if (!video || connectedRef.current) return;

    try {
      const AudioContextClass =
        window.AudioContext ||
        (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioContextClass) return;

      const ctx = new AudioContextClass();
      audioCtxRef.current = ctx;

      const source = ctx.createMediaElementSource(video);
      sourceRef.current = source;
      connectedRef.current = true;

      // Determine channel count after source creation
      const channels = source.channelCount ?? 1;
      channelCountRef.current = channels;

      if (channels >= 2) {
        // Stereo: split channels
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

        // Merge back to destination
        const merger = ctx.createChannelMerger(2);

        source.connect(splitter);
        splitter.connect(analyserL, 0);
        splitter.connect(analyserR, 1);
        analyserL.connect(merger, 0, 0);
        analyserR.connect(merger, 0, 1);
        merger.connect(ctx.destination);
      } else {
        // Mono
        const analyserL = ctx.createAnalyser();
        analyserL.fftSize = 256;
        analyserL.smoothingTimeConstant = 0.8;
        analyserLRef.current = analyserL;
        analyserRRef.current = null;

        source.connect(analyserL);
        analyserL.connect(ctx.destination);
      }
    } catch {
      // Web Audio API not supported or already connected elsewhere
    }
  }, [videoRef]);

  // Connect once video element is available
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleCanPlay = () => { connectAudio(); };

    if (video.readyState >= 1) {
      connectAudio();
    } else {
      video.addEventListener('canplay', handleCanPlay, { once: true });
    }

    return () => {
      video.removeEventListener('canplay', handleCanPlay);
    };
  }, [videoRef, connectAudio]);

  // Resume AudioContext on play (autoplay policy)
  useEffect(() => {
    if (isPlaying && audioCtxRef.current?.state === 'suspended') {
      audioCtxRef.current.resume().catch(() => {});
    }
  }, [isPlaying]);

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
      const channels = (analyserL && analyserR) ? 2 : 1;
      const now = performance.now();

      const getLevelFromAnalyser = (analyser: AnalyserNode | null): number => {
        if (!analyser) return 0;
        const bufferLength = analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);
        analyser.getByteFrequencyData(dataArray);
        // RMS
        let sum = 0;
        for (let i = 0; i < bufferLength; i++) {
          const val = dataArray[i] / 255;
          sum += val * val;
        }
        return Math.sqrt(sum / bufferLength);
      };

      const levelL = isPlaying ? getLevelFromAnalyser(analyserL) : 0;
      const levelR = isPlaying ? getLevelFromAnalyser(analyserR) : 0;

      // Update peaks
      if (levelL >= peaksRef.current[0]) {
        peaksRef.current[0] = levelL;
        peakTimesRef.current[0] = now;
        peakDisplayRef.current[0] = levelL;
      } else {
        if (now - peakTimesRef.current[0] > PEAK_HOLD_MS) {
          peakDisplayRef.current[0] = Math.max(0, peakDisplayRef.current[0] - PEAK_DECAY_RATE);
        }
        peaksRef.current[0] = levelL;
      }

      if (levelR >= peaksRef.current[1]) {
        peaksRef.current[1] = levelR;
        peakTimesRef.current[1] = now;
        peakDisplayRef.current[1] = levelR;
      } else {
        if (now - peakTimesRef.current[1] > PEAK_HOLD_MS) {
          peakDisplayRef.current[1] = Math.max(0, peakDisplayRef.current[1] - PEAK_DECAY_RATE);
        }
        peaksRef.current[1] = levelR;
      }

      const w = canvas.width;
      const h = canvas.height;
      ctx.clearRect(0, 0, w, h);

      const drawChannel = (level: number, peakLevel: number, offsetX: number, chanWidth: number) => {
        const segH = Math.floor((h - (SEGMENT_COUNT - 1) * 2) / SEGMENT_COUNT);
        const segStep = segH + 2;
        const activeBars = Math.round(level * SEGMENT_COUNT);
        const peakBar = Math.round(peakLevel * SEGMENT_COUNT);

        for (let i = 0; i < SEGMENT_COUNT; i++) {
          // i=0 is bottom, i=SEGMENT_COUNT-1 is top
          const y = h - (i + 1) * segStep + 2;
          const color = getSegmentColor(i);

          if (i < activeBars) {
            ctx.globalAlpha = 1;
          } else {
            ctx.globalAlpha = 0.2;
          }
          ctx.fillStyle = color;
          ctx.fillRect(offsetX, y, chanWidth, segH);

          // Peak indicator: bright white line at peak position
          if (i === peakBar && peakBar > 0) {
            ctx.globalAlpha = 1;
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(offsetX, y, chanWidth, 2);
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
      } catch {
        // ignore cleanup errors
      }
      connectedRef.current = false;
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
}
