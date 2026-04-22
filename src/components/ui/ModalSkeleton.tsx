import { Skeleton } from './Skeleton';

export function ModalSkeleton() {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <Skeleton className="w-[420px] h-[280px]" />
    </div>
  );
}
