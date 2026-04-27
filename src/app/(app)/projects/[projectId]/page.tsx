'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import { FolderBrowser } from '@/components/files/FolderBrowser';
import { ReviewLinksTab } from '@/components/review/ReviewLinksTab';

type Tab = 'files' | 'review-links';

export default function ProjectRootPage() {
  const params = useParams();
  const projectId = params.projectId as string;
  const [activeTab, setActiveTab] = useState<Tab>('files');

  const tabs: { id: Tab; label: string }[] = [
    { id: 'files', label: 'Files' },
    { id: 'review-links', label: 'Review Links' },
  ];

  return (
    <div className="flex flex-col h-full">
      {/* Tab bar — only shown at project root, above the FolderBrowser header */}
      <div className="flex items-center gap-1 px-8 pt-3 border-b border-scope-border bg-scope-sidebar">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 text-sm font-medium rounded-t transition-colors ${
              activeTab === tab.id
                ? 'text-white border-b-2 border-scope-accent -mb-px'
                : 'text-scope-textMuted hover:text-white'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === 'files' && (
        <FolderBrowser projectId={projectId} folderId={null} />
      )}
      {activeTab === 'review-links' && (
        <ReviewLinksTab projectId={projectId} />
      )}
    </div>
  );
}
