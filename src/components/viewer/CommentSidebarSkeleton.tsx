export function CommentSidebarSkeleton() {
  return (
    <div className="w-80 flex-shrink-0 bg-scope-sidebar border-l border-scope-border p-4 space-y-4">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="flex gap-3 animate-pulse">
          <div className="w-8 h-8 rounded-full bg-neutral-800/50 flex-shrink-0" />
          <div className="flex-1 space-y-2">
            <div className="h-3 w-1/3 rounded bg-neutral-800/50" />
            <div className="h-3 w-5/6 rounded bg-neutral-800/50" />
          </div>
        </div>
      ))}
    </div>
  );
}
