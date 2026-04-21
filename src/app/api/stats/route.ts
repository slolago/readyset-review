import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth-helpers';
import { getAdminDb } from '@/lib/firebase-admin';
import { canAccessProject } from '@/lib/permissions';
import type { Project } from '@/types';

export async function GET(request: NextRequest) {
  const user = await getAuthenticatedUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const db = getAdminDb();
    const snap = await db.collection('projects').get();
    const userProjects = snap.docs
      .map((d) => ({ id: d.id, ...d.data() }) as Project)
      .filter((p) => canAccessProject(user, p));
    const projectIds = userProjects.map((p) => p.id);

    const collaboratorSet = new Set<string>();
    for (const p of userProjects) {
      for (const c of p.collaborators || []) {
        if (c.userId !== user.id) collaboratorSet.add(c.userId);
      }
    }

    let assetCount = 0;
    let storageBytes = 0;
    if (projectIds.length > 0) {
      // Use per-project queries to avoid requiring a composite collectionGroup index
      for (const pid of projectIds) {
        try {
          const assetsSnap = await db
            .collection('assets')
            .where('projectId', '==', pid)
            .get();
          for (const doc of assetsSnap.docs) {
            const data = doc.data();
            if (data.deletedAt) continue; // SDC-01: exclude soft-deleted
            assetCount += 1;
            const s = data.size;
            storageBytes += typeof s === 'number' ? s : 0;
          }
        } catch (err) {
          // Non-fatal: skip this project's assets if the query fails
          console.error('[GET /api/stats] asset query failed for project', pid, err);
        }
      }
    }

    // Count review links for user's projects
    let reviewLinkCount = 0;
    for (let i = 0; i < projectIds.length; i += 10) {
      const chunk = projectIds.slice(i, i + 10);
      try {
        const rlSnap = await db.collection('reviewLinks')
          .where('projectId', 'in', chunk)
          .get();
        reviewLinkCount += rlSnap.size;
      } catch (err) {
        // non-fatal
        console.error('[GET /api/stats] review-link count query failed', err);
      }
    }

    return NextResponse.json({
      projectCount: userProjects.length,
      assetCount,
      collaboratorCount: collaboratorSet.size,
      storageBytes,
      reviewLinkCount,
    });
  } catch (err) {
    console.error('[GET /api/stats]', err);
    return NextResponse.json({ error: 'Failed to fetch stats' }, { status: 500 });
  }
}
