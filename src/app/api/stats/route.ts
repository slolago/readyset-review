import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth-helpers';
import { fetchDashboardStats } from '@/lib/dashboard-stats';

export async function GET(request: NextRequest) {
  const user = await getAuthenticatedUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const stats = await fetchDashboardStats(user);

    // PERF-04: stale-while-revalidate cache header
    return NextResponse.json(stats, {
      headers: {
        'Cache-Control': 'private, max-age=0, s-maxage=60, stale-while-revalidate=300',
      },
    });
  } catch (err) {
    console.error('[GET /api/stats]', err);
    return NextResponse.json({ error: 'Failed to fetch stats' }, { status: 500 });
  }
}
