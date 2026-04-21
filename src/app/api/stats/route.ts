import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth-helpers';
import { getAdminDb } from '@/lib/firebase-admin';
import { fetchAccessibleProjects } from '@/lib/projects-access';

export async function GET(request: NextRequest) {
  const user = await getAuthenticatedUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const db = getAdminDb();
    const userProjects = await fetchAccessibleProjects(user.id, user.role === 'admin');
    const projectIds = userProjects.map((p) => p.id);

    const collaboratorSet = new Set<string>();
    for (const p of userProjects) {
      for (const c of p.collaborators || []) {
        if (c.userId !== user.id) collaboratorSet.add(c.userId);
      }
    }

    // PERF-02: parallel asset queries per project
    let assetCount = 0;
    let storageBytes = 0;
    if (projectIds.length > 0) {
      const snaps = await Promise.all(
        projectIds.map((pid) =>
          db
            .collection('assets')
            .where('projectId', '==', pid)
            .get()
            .catch((err) => {
              console.error('[GET /api/stats] asset query failed for project', pid, err);
              return null;
            })
        )
      );
      for (const snap of snaps) {
        if (!snap) continue;
        for (const doc of snap.docs) {
          const data = doc.data();
          if (data.deletedAt) continue; // SDC-01: exclude soft-deleted
          assetCount += 1;
          const s = data.size;
          storageBytes += typeof s === 'number' ? s : 0;
        }
      }
    }

    // PERF-03: parallel review-link chunked 'in' queries
    let reviewLinkCount = 0;
    const chunks: string[][] = [];
    for (let i = 0; i < projectIds.length; i += 10) chunks.push(projectIds.slice(i, i + 10));
    const rlSnaps = await Promise.all(
      chunks.map((chunk) =>
        db
          .collection('reviewLinks')
          .where('projectId', 'in', chunk)
          .get()
          .catch((err) => {
            console.error('[GET /api/stats] review-link count query failed', err);
            return null;
          })
      )
    );
    for (const snap of rlSnaps) if (snap) reviewLinkCount += snap.size;

    // PERF-04: stale-while-revalidate cache header
    return NextResponse.json(
      {
        projectCount: userProjects.length,
        assetCount,
        collaboratorCount: collaboratorSet.size,
        storageBytes,
        reviewLinkCount,
      },
      {
        headers: {
          'Cache-Control': 'private, max-age=0, s-maxage=60, stale-while-revalidate=300',
        },
      }
    );
  } catch (err) {
    console.error('[GET /api/stats]', err);
    return NextResponse.json({ error: 'Failed to fetch stats' }, { status: 500 });
  }
}
