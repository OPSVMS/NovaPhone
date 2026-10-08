import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="flex flex-col gap-6 sm:gap-8" aria-busy="true" aria-label="Cargando instrucciones">
      <div className="flex flex-col gap-4">
        <Skeleton className="h-5 w-20" />
        <Skeleton className="h-8 w-56" />
      </div>
      <div className="flex flex-col gap-3 rounded-card border border-border bg-surface/60 p-5 sm:p-6">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-4 w-72 max-w-full" />
        <Skeleton className="mt-2 h-24 rounded-2xl" />
        <Skeleton className="h-16 rounded-2xl" />
        <Skeleton className="h-16 rounded-2xl" />
      </div>
      <Skeleton className="h-16 rounded-card" />
    </div>
  );
}
