import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth-helpers';
import { getAdminDb } from '@/lib/firebase-admin';
import { fetchGroupMembersTx, resolveGroupId } from '@/lib/version-groups';
import { canModifyStack } from '@/lib/permissions';
import type { Project } from '@/types';

export async function POST(request: NextRequest) {
  const user = await getAuthenticatedUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { sourceId, targetId } = await request.json();

    if (!sourceId || !targetId) {
      return NextResponse.json({ error: 'sourceId and targetId are required' }, { status: 400 });
    }

    if (sourceId === targetId) {
      return NextResponse.json({ error: 'Cannot merge asset with itself' }, { status: 400 });
    }

    const db = getAdminDb();

    // Fetch source and target docs (pre-transaction — used for auth + validation)
    const [sourceDoc, targetDoc] = await Promise.all([
      db.collection('assets').doc(sourceId).get(),
      db.collection('assets').doc(targetId).get(),
    ]);

    if (!sourceDoc.exists) return NextResponse.json({ error: 'Source asset not found' }, { status: 404 });
    if (!targetDoc.exists) return NextResponse.json({ error: 'Target asset not found' }, { status: 404 });

    const source = sourceDoc.data() as any;
    const target = targetDoc.data() as any;

    // Verify both assets live in the same project — never merge across projects
    if (source.projectId !== target.projectId) {
      return NextResponse.json({ error: 'Assets must be in the same project' }, { status: 400 });
    }
    const projDoc = await db.collection('projects').doc(source.projectId).get();
    if (!projDoc.exists) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    const project = { id: projDoc.id, ...projDoc.data() } as Project;
    if (!canModifyStack(user, project)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Resolve group IDs
    const sourceGroupId = resolveGroupId(source, sourceId);
    const targetGroupId = resolveGroupId(target, targetId);

    // Same-group check
    if (sourceGroupId === targetGroupId) {
      return NextResponse.json({ error: 'Assets are already in the same version stack' }, { status: 400 });
    }

    // Firestore transaction: all reads first (fetchGroupMembersTx), then all writes.
    // Guards against two concurrent merges producing duplicate version numbers.
    const merged = await db.runTransaction(async (tx) => {
      const sourceMembers = await fetchGroupMembersTx(db, tx, sourceGroupId);
      const targetMembers = await fetchGroupMembersTx(db, tx, targetGroupId);

      const maxTargetVersion = Math.max(...targetMembers.map((m) => m.version));

      // sourceMembers already sorted ascending by version (helper guarantees this)
      for (let i = 0; i < sourceMembers.length; i++) {
        const member = sourceMembers[i];
        tx.update(db.collection('assets').doc(member.id), {
          versionGroupId: targetGroupId,
          version: maxTargetVersion + 1 + i,
        });
      }

      return sourceMembers.length;
    });

    return NextResponse.json({ merged }, { status: 200 });
  } catch (err) {
    console.error('POST assets/merge-version error:', err);
    return NextResponse.json({ error: 'Failed to merge version' }, { status: 500 });
  }
}
