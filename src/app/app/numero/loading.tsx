import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="flex flex-col gap-6 sm:gap-8" aria-busy="true" aria-label="Cargando tu número">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-4 w-72 max-w-full" />
      </div>
      <Skeleton className="h-48 rounded-panel" />
      <Skeleton className="h-72 rounded-card" />
      <Skeleton className="h-56 rounded-card" />
    </div>
  );
}
