import { NextResponse } from 'next/server';

export async function GET() {
  const result: Record<string, string> = {};

  // 1. Check env vars presence
  result.hasServiceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON ? 'YES' : 'NO';
  result.hasAdminKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY ? 'YES' : 'NO';
  result.projectId = process.env.FIREBASE_ADMIN_PROJECT_ID ?? 'MISSING';

  // 2. Try parsing the JSON
  if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    try {
      const sa = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
      result.jsonParsed = 'OK';
      result.jsonProjectId = sa.project_id ?? 'missing';
      result.jsonClientEmail = sa.client_email ? sa.client_email.slice(0, 20) + '...' : 'missing';
      result.jsonKeyStart = sa.private_key ? sa.private_key.slice(0, 30) : 'missing';
    } catch (e) {
      result.jsonParsed = 'FAILED: ' + (e instanceof Error ? e.message : String(e));
    }
  }

  // 3. Try initializing Firebase Admin
  try {
    const { getAdminAuth } = await import('@/lib/firebase-admin');
    getAdminAuth();
    result.firebaseInit = 'OK';
  } catch (e) {
    result.firebaseInit = 'FAILED: ' + (e instanceof Error ? e.message : String(e));
  }

  return NextResponse.json(result);
}
