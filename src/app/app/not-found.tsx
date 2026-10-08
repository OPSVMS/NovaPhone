import { SearchX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";

export default function AppNotFound() {
  return (
    <div className="py-10">
      <EmptyState
        icon={<SearchX />}
        title="No encontramos lo que buscas"
        description="Puede que el enlace sea incorrecto o que no pertenezca a tu cuenta."
        action={<Button href="/app">Volver al inicio</Button>}
      />
    </div>
  );
}
