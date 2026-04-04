'use client';

import { Suspense } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { FolderBrowser } from '@/components/files/FolderBrowser';

function FolderPageInner() {
  const params = useParams();
  const searchParams = useSearchParams();
  const projectId = params.projectId as string;
  const folderId = params.folderId as string;
  const ancestorPath = searchParams.get('path') || '';

  return <FolderBrowser projectId={projectId} folderId={folderId} ancestorPath={ancestorPath} />;
}

export default function FolderPage() {
  return (
    <Suspense fallback={null}>
      <FolderPageInner />
    </Suspense>
  );
}
