'use client';

import { useEffect, useRef, useCallback, forwardRef, useImperativeHandle, memo } from 'react';

/**
 * Precise stereo audio meter driven by the Web Audio API.
 *
 * Reads real sample data from one or more <video> elements and displays:
 *   - Filled bar: true RMS in dBFS with VU-like ballistics (attack + release).
 *   - Peak marker: true instantaneous peak (max |sample| per frame) with hold + decay.
 *
 * Supports multi-source monitoring for Version Compare: pass multiple video refs and
 * switch the monitored source via `activeIndex`. Non-active sources are silenced by
 * the meter's own GainNodes (don't also set video.muted — the meter owns volume).
 */
export interface VUMeterHandle {
  resume: () => void;
  setVolume: (v: number) => void;
  setMuted: (m: boolean) => void;
}

interface VUMeterProps {
  /** One or more video elements to monitor. First ref is monitored if `activeIndex` is omitted. */
  videoRefs: React.RefObject<HTMLVideoElement>[];
  /** Index into `videoRefs` — the source currently being listened to. Others are silenced. */
  activeIndex?: number;
  isPlaying: boolean;
}

// ── dBFS scale ────────────────────────────────────────────────────────────────
const MIN_DB   = -60;
const MAX_DB   = 3;
const DB_RANGE = MAX_DB - MIN_DB;

const DB_MARKS = [0, -3, -6, -9, -12, -18, -24, -40, -60] as const;

// Peak-hold ballistics: instantaneous rise, slow decay after a hold window.
const PEAK_HOLD_MS  = 1500;
const PEAK_DECAY_DB = 0.18; // dB per frame after hold window

// RMS ballistics (VU-style): fast attack so peaks show, slower release.
// Applied in dB domain as an exponential IIR.
const RMS_ATTACK_ALPHA  = 0.85;  // respond within ~2 frames (~33ms)
const RMS_RELEASE_ALPHA = 0.12;  // gentle decay so meter settles smoothly

// Canvas layout (pixels — rendered at 2× for crispness)
const LABEL_W = 40;
const SEP_W   = 2;
const BAR_GAP = 4;
const L_X     = LABEL_W + SEP_W;

function dbToY(db: number, h: number): number {
  const clamped = Math.max(MIN_DB, Math.min(MAX_DB, db));
  return ((MAX_DB - clamped) / DB_RANGE) * h;
}

/** Compute RMS dBFS and true peak dBFS for a single analyser in one pass. */
function analyse(analyser: AnalyserNode | null, buf: Float32Array): { rmsDb: number; peakDb: number } {
  if (!analyser) return { rmsDb: MIN_DB, peakDb: MIN_DB };
  // Cast away the ArrayBuffer/SharedArrayBuffer variance mismatch some TS lib versions complain about
  analyser.getFloatTimeDomainData(buf as unknown as Float32Array<ArrayBuffer>);
  let sumSq = 0;
  let peak = 0;
  for (let i = 0; i < buf.length; i++) {
    const s = buf[i];
    sumSq += s * s;
    const a = s < 0 ? -s : s;
    if (a > peak) peak = a;
  }
  const rms = Math.sqrt(sumSq / buf.length);
  const rmsDb  = rms  > 0 ? Math.max(MIN_DB, 20 * Math.log10(rms))  : MIN_DB;
  const peakDb = peak > 0 ? Math.max(MIN_DB, 20 * Math.log10(peak)) : MIN_DB;
  return { rmsDb, peakDb };
}

interface AudioGraph {
  source: MediaElementAudioSourceNode;
  gain: GainNode;
  analyserL: AnalyserNode;
  analyserR: AnalyserNode;
  bufL: Float32Array;
  bufR: Float32Array;
}

export const VUMeter = memo(forwardRef<VUMeterHandle, VUMeterProps>(
  function VUMeter({ videoRefs, activeIndex = 0, isPlaying }, ref) {
    const canvasRef   = useRef<HTMLCanvasElement>(null);
    const ctxRef      = useRef<AudioContext | null>(null);
    const graphsRef   = useRef<(AudioGraph | null)[]>([]);
    const activeRef   = useRef(activeIndex);
    const volumeRef   = useRef(1);
    const mutedRef    = useRef(false);
    const rafRef      = useRef(0);

    // Display state (dB domain)
    const rmsSmoothed = useRef<[number, number]>([MIN_DB, MIN_DB]);
    const peakDisp    = useRef<[number, number]>([MIN_DB, MIN_DB]);
    const peakTime    = useRef<[number, number]>([0, 0]);

    // ── Public handle ────────────────────────────────────────────────────────
    const applyGains = useCallback(() => {
      const effective = mutedRef.current ? 0 : volumeRef.current;
      graphsRef.current.forEach((g, i) => {
        if (!g) return;
        g.gain.gain.value = i === activeRef.current ? effective : 0;
      });
    }, []);

    const resume = useCallback(() => {
      const ctx = ctxRef.current;
      if (ctx && ctx.state !== 'running') ctx.resume().catch(() => {});
    }, []);

    const setVolume = useCallback((v: number) => {
      volumeRef.current = v;
      applyGains();
      // Keep video.volume at 1 so the analyser reads full-level source signal
      videoRefs.forEach((r) => { if (r.current) r.current.volume = 1; });
    }, [videoRefs, applyGains]);

    const setMuted = useCallback((m: boolean) => {
      mutedRef.current = m;
      applyGains();
      videoRefs.forEach((r) => { if (r.current) { r.current.muted = false; r.current.volume = 1; } });
    }, [videoRefs, applyGains]);

    useImperativeHandle(ref, () => ({ resume, setVolume, setMuted }), [resume, setVolume, setMuted]);

    // ── Build audio graph (one per video, once) ──────────────────────────────
    useEffect(() => {
      if (typeof window === 'undefined') return;
      const Ctor = window.AudioContext
        || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return;

      let ctx: AudioContext;
      try {
        ctx = new Ctor();
        ctxRef.current = ctx;
      } catch {
        return;
      }

      const graphs: (AudioGraph | null)[] = videoRefs.map((vr) => {
        const video = vr.current;
        if (!video) return null;
        try {
          const source   = ctx.createMediaElementSource(video);
          const gain     = ctx.createGain();
          const splitter = ctx.createChannelSplitter(2);
          const aL = ctx.createAnalyser();
          const aR = ctx.createAnalyser();
          aL.fftSize = 2048; aL.smoothingTimeConstant = 0;
          aR.fftSize = 2048; aR.smoothingTimeConstant = 0;

          // Playback path (gain-controlled)
          source.connect(gain);
          gain.connect(ctx.destination);

          // Measurement path (pre-gain — reads source level independent of user volume)
          source.connect(splitter);
          splitter.connect(aL, 0);
          splitter.connect(aR, 1);

          gain.gain.value = 0; // will be set by applyGains()
          video.volume = 1;
          video.muted  = false;

          return {
            source, gain, analyserL: aL, analyserR: aR,
            bufL: new Float32Array(aL.fftSize),
            bufR: new Float32Array(aR.fftSize),
          };
        } catch {
          return null;
        }
      });

      graphsRef.current = graphs;
      applyGains(); // set initial gains based on activeIndex

      return () => {
        cancelAnimationFrame(rafRef.current);
        ctx.close().catch(() => {});
        ctxRef.current = null;
        graphsRef.current = [];
      };
    // Rebuild only if the set of video refs changes (stable across renders in practice)
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // ── Track activeIndex changes ────────────────────────────────────────────
    useEffect(() => {
      activeRef.current = activeIndex;
      applyGains();
      // Reset display so the meter doesn't show stale peaks from the other source
      rmsSmoothed.current = [MIN_DB, MIN_DB];
      peakDisp.current    = [MIN_DB, MIN_DB];
      peakTime.current    = [0, 0];
    }, [activeIndex, applyGains]);

    // ── Draw loop ────────────────────────────────────────────────────────────
    useEffect(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const c = canvas.getContext('2d');
      if (!c) return;

      if (!isPlaying) {
        cancelAnimationFrame(rafRef.current);
        c.clearRect(0, 0, canvas.width, canvas.height);
        drawStatic(c, canvas.width, canvas.height);
        drawBar(c, MIN_DB, MIN_DB, L_X, barWidth(canvas.width), canvas.height);
        drawBar(c, MIN_DB, MIN_DB, rXOf(canvas.width), barWidth(canvas.width), canvas.height);
        rmsSmoothed.current = [MIN_DB, MIN_DB];
        peakDisp.current    = [MIN_DB, MIN_DB];
        peakTime.current    = [0, 0];
        return;
      }

      const draw = () => {
        rafRef.current = requestAnimationFrame(draw);
        const w = canvas.width, h = canvas.height;
        const now = performance.now();
        const barW = barWidth(w);
        const rX = rXOf(w);

        const g = graphsRef.current[activeRef.current];
        const L = analyse(g?.analyserL ?? null, g?.bufL ?? new Float32Array(2048));
        const R = analyse(g?.analyserR ?? null, g?.bufR ?? new Float32Array(2048));

        // RMS smoothing (VU ballistics)
        for (let ch = 0; ch < 2; ch++) {
          const raw = ch === 0 ? L.rmsDb : R.rmsDb;
          const prev = rmsSmoothed.current[ch];
          const alpha = raw > prev ? RMS_ATTACK_ALPHA : RMS_RELEASE_ALPHA;
          rmsSmoothed.current[ch] = raw * alpha + prev * (1 - alpha);
        }

        // True peak with hold + decay
        for (let ch = 0; ch < 2; ch++) {
          const truePeak = ch === 0 ? L.peakDb : R.peakDb;
          if (truePeak >= peakDisp.current[ch]) {
            peakDisp.current[ch] = truePeak;
            peakTime.current[ch] = now;
          } else if (now - peakTime.current[ch] > PEAK_HOLD_MS) {
            peakDisp.current[ch] = Math.max(MIN_DB, peakDisp.current[ch] - PEAK_DECAY_DB);
          }
        }

        c.clearRect(0, 0, w, h);
        drawStatic(c, w, h);
        drawBar(c, rmsSmoothed.current[0], peakDisp.current[0], L_X, barW, h);
        drawBar(c, rmsSmoothed.current[1], peakDisp.current[1], rX, barW, h);
      };

      rafRef.current = requestAnimationFrame(draw);
      return () => cancelAnimationFrame(rafRef.current);
    }, [isPlaying]);

    return (
      <div className="flex-1 flex items-stretch py-2 px-1">
        <canvas
          ref={canvasRef}
          width={144}
          height={600}
          style={{ width: '100%', height: '100%', display: 'block' }}
        />
      </div>
    );
  }
));

VUMeter.displayName = 'VUMeter';

// ── Layout helpers ───────────────────────────────────────────────────────────
const barWidth = (w: number) => Math.floor((w - L_X - BAR_GAP) / 2);
const rXOf     = (w: number) => L_X + barWidth(w) + BAR_GAP;

function drawStatic(c: CanvasRenderingContext2D, w: number, h: number) {
  const barW = barWidth(w);
  const rX   = rXOf(w);

  c.fillStyle = 'rgba(255,255,255,0.08)';
  c.fillRect(LABEL_W, 0, SEP_W, h);

  c.fillStyle = 'rgba(255,255,255,0.04)';
  c.fillRect(L_X, 0, barW, h);
  c.fillRect(rX,  0, barW, h);

  c.fillStyle = 'rgba(255,255,255,0.35)';
  c.font = 'bold 11px sans-serif';
  c.textAlign = 'center';
  c.textBaseline = 'top';
  c.fillText('L', L_X + barW / 2, 2);
  c.fillText('R', rX  + barW / 2, 2);

  c.font = '11px monospace';
  c.textAlign = 'right';
  c.textBaseline = 'middle';

  for (const db of DB_MARKS) {
    const y = dbToY(db, h);
    c.fillStyle = db >= 0 ? 'rgba(239,68,68,0.75)' :
                  db >= -6 ? 'rgba(249,115,22,0.65)' :
                  db >= -20 ? 'rgba(234,179,8,0.6)' :
                  'rgba(255,255,255,0.38)';
    c.fillText(db === 0 ? '0' : `${db}`, LABEL_W - 4, y);

    c.fillStyle = db === 0 ? 'rgba(239,68,68,0.25)' : 'rgba(255,255,255,0.10)';
    c.fillRect(L_X, y - 0.5, barW, 1);
    c.fillRect(rX,  y - 0.5, barW, 1);
  }
}

function drawBar(
  c: CanvasRenderingContext2D,
  rmsDb: number,
  peakDb: number,
  x: number,
  barW: number,
  h: number,
) {
  const levelY = dbToY(rmsDb, h);

  if (levelY < h) {
    const grad = c.createLinearGradient(0, 0, 0, h);
    const y0  = dbToY(MAX_DB, h) / h;
    const y3  = dbToY(0,   h) / h;
    const y6  = dbToY(-6,  h) / h;
    const y20 = dbToY(-20, h) / h;
    grad.addColorStop(y0,  '#ef4444');
    grad.addColorStop(y3,  '#ef4444');
    grad.addColorStop(y6,  '#f97316');
    grad.addColorStop(y20, '#eab308');
    grad.addColorStop(1,   '#22c55e');

    c.fillStyle = grad;
    c.fillRect(x, levelY, barW, h - levelY);
  }

  if (peakDb > MIN_DB + 2) {
    const pkY = dbToY(peakDb, h);
    c.fillStyle = peakDb >= 0
      ? '#ef4444'
      : peakDb >= -6
      ? '#f97316'
      : 'rgba(255,255,255,0.85)';
    c.fillRect(x, pkY, barW, 3);
  }
}
