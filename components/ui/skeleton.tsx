import { cn } from "@/lib/cn";

function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "animate-pulse rounded-md bg-black/10 dark:bg-white/10",
        className
      )}
      {...props}
    />
  );
}

export function SkeletonCard() {
  return (
    <div className="rounded-md border border-black/10 bg-white/80 p-4 shadow-sm dark:border-white/10 dark:bg-white/10">
      <div className="mb-3 flex items-start justify-between">
        <div className="space-y-2">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-5 w-48" />
        </div>
        <Skeleton className="h-5 w-16 rounded-full" />
      </div>
      <div className="flex gap-2">
        <Skeleton className="h-5 w-20 rounded-full" />
        <Skeleton className="h-5 w-20 rounded-full" />
      </div>
      <div className="mt-3 space-y-1.5">
        <Skeleton className="h-3 w-32" />
        <Skeleton className="h-3 w-40" />
        <Skeleton className="h-3 w-36" />
      </div>
    </div>
  );
}

export function SkeletonTable({ rows = 6, cols = 4 }: { rows?: number; cols?: number }) {
  return (
    <div className="rounded-md border border-black/10 dark:border-white/10">
      <div className="bg-white/70 px-4 py-3 dark:bg-white/10">
        <div className="flex gap-4">
          {Array.from({ length: cols }).map((_, i) => (
            <Skeleton key={i} className="h-4 flex-1" />
          ))}
        </div>
      </div>
      {Array.from({ length: rows }).map((_, rowIdx) => (
        <div
          key={rowIdx}
          className="border-t border-black/5 bg-white/80 px-4 py-3 dark:border-white/5 dark:bg-white/5"
        >
          <div className="flex gap-4">
            {Array.from({ length: cols }).map((_, colIdx) => (
              <Skeleton
                key={colIdx}
                className={`h-4 ${colIdx === 0 ? "w-32" : "flex-1"}`}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export function SkeletonForm() {
  return (
    <div className="grid gap-5 rounded-md border border-black/10 bg-white/80 p-5 shadow-sm dark:border-white/10 dark:bg-white/10 lg:grid-cols-2">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className={i >= 4 ? "lg:col-span-2" : ""}>
          <Skeleton className="mb-2 h-4 w-20" />
          <Skeleton className="h-12 w-full rounded-md" />
        </div>
      ))}
      <div className="lg:col-span-2">
        <Skeleton className="h-12 w-40 rounded-md" />
      </div>
    </div>
  );
}

export function SkeletonDetail() {
  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_360px]">
      <div className="space-y-5">
        <div className="rounded-md border border-black/10 bg-white/80 p-5 shadow-sm dark:border-white/10 dark:bg-white/10">
          <Skeleton className="mb-2 h-3 w-28" />
          <Skeleton className="mb-4 h-8 w-64" />
          <div className="flex gap-2">
            <Skeleton className="h-5 w-20 rounded-full" />
            <Skeleton className="h-5 w-20 rounded-full" />
          </div>
          <div className="mt-4 space-y-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
          </div>
        </div>
        <div className="rounded-md border border-black/10 bg-white/80 p-5 shadow-sm dark:border-white/10 dark:bg-white/10">
          <Skeleton className="mb-4 h-6 w-32" />
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="mb-3 rounded-md border border-black/10 p-4 dark:border-white/10">
              <Skeleton className="mb-2 h-4 w-24" />
              <Skeleton className="h-3 w-full" />
            </div>
          ))}
        </div>
      </div>
      <div className="space-y-5">
        <div className="rounded-md border border-black/10 bg-white/80 p-5 shadow-sm dark:border-white/10 dark:bg-white/10">
          <Skeleton className="mb-4 h-6 w-28" />
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="border-b border-black/10 py-3 last:border-b-0 dark:border-white/10">
              <Skeleton className="mb-1 h-3 w-20" />
              <Skeleton className="h-4 w-32" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function SkeletonChart() {
  return (
    <div className="rounded-md border border-black/10 bg-white/75 p-4 dark:border-white/10 dark:bg-white/10">
      <Skeleton className="mb-4 h-5 w-48" />
      <Skeleton className="h-[280px] w-full rounded-md" />
    </div>
  );
}

export { Skeleton };
