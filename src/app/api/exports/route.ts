/**
 * POST /api/exports — create + run an export job inline.
 * GET  /api/exports — list current user's recent export jobs (fresh signed URLs for ready ones).
 *
 * Inline ffmpeg spawn (not a queue). maxDuration=60 on the platform caps total time.
 * The client displays "encoding…" until this POST resolves; polling of individual
 * jobs is via GET /api/exports/[jobId] if the client wants intermediate state.
 */
import { NextRequest, NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { spawn } from 'child_process';
import { promises as fsp } from 'fs';
import os from 'os';
import path from 'path';

import { getAuthenticatedUser } from '@/lib/auth-helpers';
import { getAdminDb } from '@/lib/firebase-admin';
import {
  generateReadSignedUrl,
  generateDownloadSignedUrl,
  uploadBuffer,
} from '@/lib/gcs';
import { canProbeAsset } from '@/lib/permissions';
import { resolveFfmpeg } from '@/lib/ffmpeg-resolve';
import {
  createExportJob,
  updateExportJob,
  listUserExports,
} from '@/lib/exports';
import type { Project, ExportFormat, Job } from '@/types';

export const runtime = 'nodejs';
// Capped at 60s to match the Hobby-plan limit (vercel.json pins this).
// If you later upgrade to Pro, bump this (and vercel.json) to 300 to give
// room for longer clips.
export const maxDuration = 60;

// Keep the allowed clip length well under maxDuration — the function
// needs to also download the source range, run ffmpeg twice for GIFs,
// and upload the result back to GCS. 45s leaves ~15s of wall-clock
// headroom on top of the ffmpeg encode on Hobby.
const MAX_DURATION_SECONDS = 45;

function sanitizeFilename(raw: string): string {
  const cleaned = raw.replace(/[^a-zA-Z0-9._ -]/g, '_').trim();
  return cleaned.slice(0, 80);
}

function runFfmpeg(binPath: string, args: string[]): Promise<{ code: number; stderr: string }> {
  const t0 = Date.now();
  console.log('[export] ffmpeg', args.map((a) => (a.startsWith('http') ? '<signed-url>' : a)).join(' '));
  return new Promise((resolve, reject) => {
    const proc = spawn(binPath, args);
    let stderr = '';
    proc.stderr.on('data', (d) => { stderr += d.toString(); });
    proc.on('error', reject);
    proc.on('close', (code) => {
      console.log(`[export] ffmpeg exited ${code ?? -1} in ${Date.now() - t0}ms`);
      resolve({ code: code ?? -1, stderr });
    });
  });
}

async function safeUnlink(p: string) {
  try { await fsp.unlink(p); } catch (err) {
    console.error('[exports safeUnlink]', p, err);
  }
}

interface AssetDoc {
  id: string;
  projectId: string;
  gcsPath?: string;
  videoCodec?: string;
  audioCodec?: string;
  containerFormat?: string;
  duration?: number;
  type?: string;
}

export async function POST(request: NextRequest) {
  const user = await getAuthenticatedUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: {
    assetId?: string;
    format?: ExportFormat;
    inPoint?: number;
    outPoint?: number;
    filename?: string;
  };
  try {
    body = await request.json();
  } catch (err) {
    console.error('[POST /api/exports] invalid JSON body', err);
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { assetId, format, inPoint, outPoint } = body;
  const rawFilename = body.filename ?? '';

  if (!assetId || typeof assetId !== 'string') {
    return NextResponse.json({ error: 'assetId required' }, { status: 400 });
  }
  if (format !== 'mp4' && format !== 'gif') {
    return NextResponse.json({ error: 'format must be mp4 or gif' }, { status: 400 });
  }
  if (typeof inPoint !== 'number' || typeof outPoint !== 'number') {
    return NextResponse.json({ error: 'inPoint and outPoint must be numbers' }, { status: 400 });
  }
  if (inPoint < 0 || outPoint <= inPoint) {
    return NextResponse.json({ error: 'outPoint must be greater than inPoint' }, { status: 400 });
  }
  const clipDur = outPoint - inPoint;
  if (clipDur > MAX_DURATION_SECONDS) {
    return NextResponse.json({ error: `Clip too long (max ${MAX_DURATION_SECONDS}s)` }, { status: 400 });
  }
  const filename = sanitizeFilename(rawFilename);
  if (!filename) {
    return NextResponse.json({ error: 'filename required' }, { status: 400 });
  }

  // Load asset + project for permission gate
  const db = getAdminDb();
  const assetSnap = await db.collection('assets').doc(assetId).get();
  if (!assetSnap.exists) return NextResponse.json({ error: 'Asset not found' }, { status: 404 });
  const asset = { id: assetSnap.id, ...assetSnap.data() } as AssetDoc;
  if (!asset.gcsPath) return NextResponse.json({ error: 'Asset has no file' }, { status: 400 });

  const projSnap = await db.collection('projects').doc(asset.projectId).get();
  if (!projSnap.exists) return NextResponse.json({ error: 'Project not found' }, { status: 404 });
  const project = { id: projSnap.id, ...projSnap.data() } as Project;
  if (!canProbeAsset(user, project)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Create job (queued)
  const jobId = await createExportJob({
    userId: user.id,
    assetId,
    projectId: asset.projectId,
    format,
    inPoint,
    outPoint,
    filename,
  });

  const ffmpegPath = await resolveFfmpeg();
  if (!ffmpegPath) {
    await updateExportJob(jobId, { status: 'failed', error: 'ffmpeg not available' });
    return NextResponse.json({ error: 'ffmpeg not available', jobId }, { status: 500 });
  }

  await updateExportJob(jobId, { status: 'encoding' });

  // Fresh signed URL for the source (60 min)
  const sourceUrl = await generateReadSignedUrl(asset.gcsPath, 60);

  try {
    let outPath: string;
    let contentType: string;
    let gcsOutPath: string;
    const tempsToClean: string[] = [];

    if (format === 'mp4') {
      outPath = path.join(os.tmpdir(), `export-${jobId}.mp4`);
      tempsToClean.push(outPath);
      contentType = 'video/mp4';
      gcsOutPath = `exports/${user.id}/${jobId}.mp4`;

      // Decide copy vs. re-encode.
      // FMT-01: mp4 container OR mov+h264+aac is a valid copy target — iPhone
      // and Premiere routinely export .mov with H.264/AAC, which is remux-safe.
      // Any other container (mkv, webm, avi, ProRes-mov, HEVC, AV1, VP9) takes
      // the re-encode path so we always produce a clean H.264/AAC .mp4 result.
      const videoOk = asset.videoCodec === 'h264';
      const audioOk = !asset.audioCodec || asset.audioCodec === 'aac';
      const fmt = asset.containerFormat?.toLowerCase() ?? '';
      const containerOk =
        !fmt ||
        fmt.includes('mp4') ||
        (fmt.includes('mov') && videoOk && audioOk);
      const tryCopy = videoOk && audioOk && containerOk;

      // Copy path — near-instant when source is already h264/aac in mp4.
      // `-ss` BEFORE `-i` requests a byte-range seek on GCS (fast) instead
      // of decoding from frame 0. `-avoid_negative_ts make_zero` fixes the
      // PTS offset that -ss creates, otherwise players stutter at t=0.
      const copyArgs = [
        '-y',
        '-ss', String(inPoint),
        '-i', sourceUrl,
        '-t', String(clipDur),
        '-c', 'copy',
        '-avoid_negative_ts', 'make_zero',
        '-movflags', '+faststart',
        outPath,
      ];
      // Re-encode path — ultrafast preset trades file size for speed,
      // which is the right choice on a 60s-capped serverless function.
      // `-threads 0` lets ffmpeg use every available core.
      const reencodeArgs = [
        '-y',
        '-ss', String(inPoint),
        '-i', sourceUrl,
        '-t', String(clipDur),
        '-c:v', 'libx264',
        '-preset', 'ultrafast',
        '-crf', '23',
        '-c:a', 'aac',
        '-threads', '0',
        '-movflags', '+faststart',
        outPath,
      ];

      let { code, stderr } = tryCopy
        ? await runFfmpeg(ffmpegPath, copyArgs)
        : await runFfmpeg(ffmpegPath, reencodeArgs);

      if (code !== 0 && tryCopy) {
        // Common: keyframe alignment problems with -c copy and a non-zero -ss.
        // Retry with re-encode.
        ({ code, stderr } = await runFfmpeg(ffmpegPath, reencodeArgs));
      }
      if (code !== 0) {
        await updateExportJob(jobId, {
          status: 'failed',
          error: stderr.slice(-500),
        });
        await Promise.all(tempsToClean.map(safeUnlink));
        return NextResponse.json({ error: 'ffmpeg failed', jobId, stderr: stderr.slice(-500) }, { status: 500 });
      }
    } else {
      // format === 'gif' — single-pass palette via the `split` filter.
      //
      // Canonical FFmpeg recipe (https://trac.ffmpeg.org/wiki/Encode/GIF):
      // decode the trimmed source once, split it into two streams, run
      // palettegen on one and paletteuse on the other with the generated
      // palette. One ffmpeg spawn, one decode, no temp PNG.
      //
      // Why this replaces the old two-pass path: the previous code used
      // `-loop 1 -i palette.png` as a still-image input, which on the
      // @ffmpeg-installer builds ships with makes paletteuse wait forever
      // on an unbounded `[1:v]` stream — the whole pipeline hangs until
      // the Vercel 60s timeout trips. The single-pass graph has no
      // separate palette input, so no loop-flag ambiguity.
      outPath = path.join(os.tmpdir(), `export-${jobId}.gif`);
      tempsToClean.push(outPath);
      contentType = 'image/gif';
      gcsOutPath = `exports/${user.id}/${jobId}.gif`;

      // Defaults tuned for speed on a 60s-capped serverless function at
      // 2GB RAM: 480p, 12 fps, Bayer dither. `split` keeps all decoded
      // frames in memory between the two branches, so at 45s × 12fps ×
      // 480×270 RGBA ≈ 280MB peak — well under the limit.
      const GIF_FPS = 12;
      const GIF_SCALE = 'scale=480:-2:flags=lanczos';
      const filter =
        `fps=${GIF_FPS},${GIF_SCALE},split[a][b];` +
        `[a]palettegen=stats_mode=diff[p];` +
        `[b][p]paletteuse=dither=bayer:bayer_scale=5`;

      // `-ss`/`-t` before `-i` bound the input decode window to the
      // requested range. `-loop 0` on the OUTPUT sets the GIF to loop
      // infinitely in viewers — different concept from the input-loop
      // flag the old pipeline (mis)used.
      const gifArgs = [
        '-y',
        '-ss', String(inPoint),
        '-t', String(clipDur),
        '-i', sourceUrl,
        '-filter_complex', filter,
        '-loop', '0',
        '-threads', '0',
        outPath,
      ];

      const { code, stderr } = await runFfmpeg(ffmpegPath, gifArgs);
      if (code !== 0) {
        await updateExportJob(jobId, { status: 'failed', error: stderr.slice(-500) });
        await Promise.all(tempsToClean.map(safeUnlink));
        return NextResponse.json({ error: 'gif encode failed', jobId, stderr: stderr.slice(-500) }, { status: 500 });
      }
    }

    // Upload output
    const buf = await fsp.readFile(outPath);
    await uploadBuffer(gcsOutPath, buf, contentType);

    // Clean temps
    await Promise.all(tempsToClean.map(safeUnlink));

    // Mark ready
    await updateExportJob(jobId, {
      status: 'ready',
      gcsPath: gcsOutPath,
      completedAt: FieldValue.serverTimestamp() as unknown as Job['completedAt'],
    });

    // Fresh download URL
    const signedUrl = await generateDownloadSignedUrl(
      gcsOutPath,
      `${filename}.${format}`,
      60,
    );

    return NextResponse.json({
      jobId,
      status: 'ready',
      signedUrl,
      format,
      filename,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unknown';
    await updateExportJob(jobId, { status: 'failed', error: msg });
    return NextResponse.json({ error: 'Export failed', jobId, detail: msg }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  const user = await getAuthenticatedUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const jobs = await listUserExports(user.id, 20);
  const hydrated = await Promise.all(
    jobs.map(async (job) => {
      if (job.status === 'ready' && job.gcsPath) {
        try {
          const signedUrl = await generateDownloadSignedUrl(
            job.gcsPath,
            `${job.filename}.${job.format}`,
            60,
          );
          return { ...job, signedUrl };
        } catch (err) {
          console.error('[GET /api/exports] sign download URL failed', err);
          return job;
        }
      }
      return job;
    }),
  );

  return NextResponse.json({ jobs: hydrated });
}
