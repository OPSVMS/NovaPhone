import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="flex flex-col gap-6 sm:gap-8" aria-busy="true" aria-label="Cargando tus eSIM">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-8 w-36" />
        <Skeleton className="h-4 w-64 max-w-full" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-40 rounded-card" />
        ))}
      </div>
    </div>
  );
}
