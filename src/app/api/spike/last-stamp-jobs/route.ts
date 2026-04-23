/**
 * GET /api/spike/last-stamp-jobs
 *
 * Diagnostic for v2.4 rollout — returns the last 10 `metadata-stamp`
 * jobs with their status, error (if any), and timing. No auth (this
 * route is a spike; remove after v2.4 is validated in production).
 *
 * Use this to verify that stamp jobs are actually being created when
 * review links are created, and to surface the exact error text when
 * they fail.
 */
import { NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';

export const runtime = 'nodejs';
export const maxDuration = 10;

export async function GET() {
  try {
    const db = getAdminDb();
    const snap = await db
      .collection('jobs')
      .where('type', '==', 'metadata-stamp')
      .limit(30)
      .get();

    const jobs = snap.docs
      .map((d) => {
        const data = d.data() as {
          assetId?: string;
          status?: string;
          error?: string;
          createdAt?: { _seconds?: number; seconds?: number };
          startedAt?: { _seconds?: number; seconds?: number };
          completedAt?: { _seconds?: number; seconds?: number };
          attempt?: number;
        };
        const epoch = (t: { _seconds?: number; seconds?: number } | undefined) =>
          t ? t._seconds ?? t.seconds ?? null : null;
        return {
          id: d.id,
          assetId: data.assetId,
          status: data.status,
          error: data.error ?? null,
          attempt: data.attempt ?? null,
          createdAt: epoch(data.createdAt),
          startedAt: epoch(data.startedAt),
          completedAt: epoch(data.completedAt),
        };
      })
      // Sort in memory (no composite index needed)
      .sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0))
      .slice(0, 10);

    return NextResponse.json({ count: jobs.length, jobs });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
