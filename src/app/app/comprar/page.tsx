import type { Metadata } from "next";
import { CardSim } from "lucide-react";
import { requireUser } from "@/lib/session";
import { getActivePlans } from "@/lib/catalog";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/app/page-header";
import { PlanPicker } from "@/components/app/plan-picker";

export const metadata: Metadata = { title: "Comprar plan" };

export default async function BuyPage({ searchParams }: PageProps<"/app/comprar">) {
  const [user, plans, sp] = await Promise.all([requireUser(), getActivePlans(), searchParams]);
  const requested = typeof sp.plan === "string" ? sp.plan : undefined;
  const initial =
    plans.find((p) => p.id === requested)?.id ?? plans.find((p) => p.featured)?.id ?? plans[0]?.id;

  return (
    <div className="flex flex-col gap-6 sm:gap-8">
      <PageHeader
        title="Comprar plan"
        description="Elige tus datos. Recibes el QR al instante para instalar tu eSIM."
      />
      {plans.length === 0 ? (
        <EmptyState
          icon={<CardSim />}
          title="No hay planes disponibles por ahora"
          description="Estamos actualizando el catálogo. Vuelve a intentarlo en unos minutos."
        />
      ) : (
        <PlanPicker
          key={initial}
          plans={plans.map((p) => ({
            id: p.id,
            dataGb: p.dataGb,
            days: p.days,
            priceMxn: p.priceMxn,
            featured: p.featured,
            speed: p.speed,
          }))}
          balanceCents={user.balanceCents}
          initialPlanId={initial}
        />
      )}
    </div>
  );
}
