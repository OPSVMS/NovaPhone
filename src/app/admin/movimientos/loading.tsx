import { ListPageSkeleton } from "@/components/app/admin-ui";

export default function Loading() {
  return <ListPageSkeleton label="Cargando movimientos" chips={5} />;
}
