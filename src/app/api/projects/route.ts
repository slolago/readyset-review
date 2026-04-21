import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth-helpers';
import { getAdminDb } from '@/lib/firebase-admin';
import { Timestamp } from 'firebase-admin/firestore';
import { fetchAccessibleProjects } from '@/lib/projects-access';

export async function GET(request: NextRequest) {
  const user = await getAuthenticatedUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const projects = await fetchAccessibleProjects(user.id, user.role === 'admin');
    return NextResponse.json({ projects });
  } catch (error) {
    console.error('[GET /api/projects]', error);
    return NextResponse.json({ error: 'Failed to fetch projects' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const user = await getAuthenticatedUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { name, description, color } = await request.json();
    if (!name) return NextResponse.json({ error: 'Name is required' }, { status: 400 });

    const db = getAdminDb();
    const now = Timestamp.now();
    const ref = await db.collection('projects').add({
      name,
      description: description || '',
      ownerId: user.id,
      collaborators: [
        {
          userId: user.id,
          role: 'owner',
          email: user.email,
          name: user.name,
        },
      ],
      collaboratorIds: [user.id],
      color: color || 'purple',
      createdAt: now,
      updatedAt: now,
    });

    const doc = await ref.get();
    return NextResponse.json({ project: { id: ref.id, ...doc.data() } }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to create project' }, { status: 500 });
  }
}
