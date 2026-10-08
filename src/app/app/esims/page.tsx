import type { Metadata } from "next";
import { CardSim, Plus } from "lucide-react";
import { requireUser } from "@/lib/session";
import { getUserOrders } from "@/lib/orders";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Stagger, StaggerItem } from "@/components/motion/stagger";
import { PageHeader } from "@/components/app/page-header";
import { EsimSummaryCard } from "@/components/app/esim-summary-card";

export const metadata: Metadata = { title: "Mis eSIM" };

export default async function EsimsPage() {
  const user = await requireUser();
  const orders = await getUserOrders(user.id);
  const now = new Date().getTime();

  return (
    <div className="flex flex-col gap-6 sm:gap-8">
      <PageHeader
        title="Mis eSIM"
        description="Tus planes, su consumo y los datos para instalarlos."
        action={
          orders.length > 0 ? (
            <Button href="/app/comprar" variant="secondary" className="w-full sm:w-auto">
              <Plus aria-hidden /> Comprar otro plan
            </Button>
          ) : null
        }
      />
      {orders.length === 0 ? (
        <EmptyState
          icon={<CardSim />}
          title="Aún no tienes eSIMs"
          description="Compra un plan y recibe tu QR al instante. Lo instalas en menos de 2 minutos."
          action={<Button href="/app/comprar">Ver planes</Button>}
        />
      ) : (
        <Stagger immediate className="grid gap-4 sm:grid-cols-2">
          {orders.map((o, i) =>
            i < 6 ? (
              <StaggerItem key={o.id}>
                <EsimSummaryCard order={o} now={now} />
              </StaggerItem>
            ) : (
              <div key={o.id}>
                <EsimSummaryCard order={o} now={now} />
              </div>
            ),
          )}
        </Stagger>
      )}
    </div>
  );
}
