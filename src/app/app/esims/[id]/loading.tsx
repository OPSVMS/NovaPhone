import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="flex flex-col gap-6 sm:gap-8" aria-busy="true" aria-label="Cargando tu eSIM">
      <div className="flex flex-col gap-4">
        <Skeleton className="h-5 w-24" />
        <Skeleton className="h-8 w-56" />
      </div>
      <div className="grid items-center gap-8 rounded-panel border border-border bg-surface/60 p-5 sm:grid-cols-[auto_1fr] sm:p-8">
        <Skeleton className="mx-auto size-[232px] rounded-[24px] sm:size-[248px]" />
        <div className="flex flex-col gap-3">
          <Skeleton className="h-7 w-48" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-4/5" />
          <Skeleton className="mt-3 h-12 w-full rounded-control sm:w-48" />
        </div>
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <Skeleton className="h-72 rounded-card" />
        <Skeleton className="h-72 rounded-card" />
      </div>
    </div>
  );
}
