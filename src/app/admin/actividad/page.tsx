import type { Metadata } from "next";
import { requireAdmin } from "@/lib/session";
import { getActivity, getAuditLog } from "@/lib/admin";
import { Card } from "@/components/ui/card";
import { ActivityFeed, AuditList } from "@/components/app/admin-activity";
import { AdminHeader, SectionTitle } from "@/components/app/admin-ui";

export const metadata: Metadata = { title: "Actividad · Admin" };

export default async function AdminActivityPage() {
  await requireAdmin();
  const [activity, audit] = await Promise.all([getActivity(100), getAuditLog(100)]);
  const now = new Date().getTime();

  return (
    <div className="flex flex-col gap-8 pb-12">
      <AdminHeader title="Actividad" description="Registros, depósitos, compras, recargas, números y SMS de toda la plataforma." />

      <div className="grid gap-10 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] lg:gap-6">
        <section aria-labelledby="feed" className="flex min-w-0 flex-col gap-3">
          <SectionTitle id="feed" count={activity.length}>
            Actividad de la plataforma
          </SectionTitle>
          <Card className="overflow-hidden">
            <ActivityFeed items={activity} now={now} grouped />
          </Card>
        </section>

        <section aria-labelledby="audit" className="flex min-w-0 flex-col gap-3">
          <SectionTitle id="audit" count={audit.length}>
            Bitácora de administradores
          </SectionTitle>
          <Card className="overflow-hidden">
            <AuditList rows={audit} />
          </Card>
        </section>
      </div>
    </div>
  );
}
