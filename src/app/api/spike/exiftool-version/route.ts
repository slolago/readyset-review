/**
 * GET /api/spike/exiftool-version
 *
 * Phase 79 platform spike. Verifies exiftool-vendored works on the Vercel
 * Pro Lambda runtime BEFORE v2.4 Phase 80 builds production code against it.
 *
 * Returns the exiftool version string on success, or the error message +
 * stderr on failure. If this route returns 500 with a perl-not-found error,
 * the v2.4 stamp-pipeline architecture must be reconsidered (e.g. move the
 * job to Cloud Run with an explicitly-installed perl + exiftool).
 *
 * Remove this route after Phase 80's stamp pipeline ships and its first
 * successful deploy confirms exiftool works in production. The removal is
 * tracked as a cleanup item in Phase 79's verification report.
 */
import { NextResponse } from 'next/server';
import { ExifTool } from 'exiftool-vendored';

export const runtime = 'nodejs';
export const maxDuration = 30;

export async function GET() {
  // Per-request ExifTool instance. Cap concurrency and tasks so the process
  // exits cleanly when the Lambda returns — no zombie perl across container
  // reuses. See PITFALLS.md "exiftool process lifecycle."
  const et = new ExifTool({ maxProcs: 1, maxTasksPerProcess: 1 });

  try {
    const version = await et.version();
    return NextResponse.json({
      ok: true,
      version,
      runtime: {
        node: process.version,
        platform: process.platform,
        arch: process.arch,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[spike/exiftool-version] exiftool failed', err);
    return NextResponse.json(
      {
        ok: false,
        error: message,
        runtime: {
          node: process.version,
          platform: process.platform,
          arch: process.arch,
        },
        // If perl is missing, exiftool-vendored typically throws something
        // like "ENOENT: no such file or directory, open '/var/task/.../perl'"
        // or "perl: command not found". Surface verbatim for triage.
      },
      { status: 500 },
    );
  } finally {
    try {
      await et.end();
    } catch {
      /* ignore — we're already returning */
    }
  }
}
