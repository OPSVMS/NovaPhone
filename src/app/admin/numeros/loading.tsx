import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="flex flex-col gap-8 pb-12" aria-busy="true" aria-label="Cargando números">
      <Skeleton className="h-8 w-40" />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className={i === 0 ? "col-span-2 h-28 rounded-card sm:col-span-1" : "h-28 rounded-card"} />
        ))}
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <Skeleton className="h-80 rounded-card" />
        <Skeleton className="h-80 rounded-card" />
      </div>
      <Skeleton className="h-72 rounded-card" />
    </div>
  );
}
