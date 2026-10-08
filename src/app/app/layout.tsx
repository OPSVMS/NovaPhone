import Link from "next/link";
import { Logo, LogoMark } from "@/components/brand/logo";
import { Aurora } from "@/components/motion/aurora";
import { requireUser } from "@/lib/session";
import { formatMxn } from "@/lib/pricing";
import { BottomNav, SidebarNav } from "@/components/app/app-nav";
import { BalancePill } from "@/components/app/balance-pill";
import { UserMenu } from "@/components/app/user-menu";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";

export const metadata = { title: { default: "Mi cuenta", template: "%s · NovaPhone" } };

export default async function AppLayout({ children }: LayoutProps<"/app">) {
  const user = await requireUser();
  const isAdmin = user.role === "admin";

  return (
    <div className="relative isolate min-h-dvh">
      <div aria-hidden className="pointer-events-none fixed inset-0 -z-10">
        <Aurora variant="subtle" />
      </div>

      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-border bg-bg/70 px-4 pb-5 pt-6 backdrop-blur-xl lg:flex">
        <Link href="/app" aria-label="NovaPhone – inicio" className="mb-8 w-fit rounded-control px-2 py-1">
          <Logo size={24} title={null} />
        </Link>
        <SidebarNav />
        <div className="mt-auto flex flex-col gap-4">
          <div className="rounded-card border border-border bg-surface/80 p-4">
            <p className="text-[13px] text-muted">Saldo disponible</p>
            <p className="mt-1 font-display text-2xl font-semibold tracking-tight text-fg tabular-nums">
              {formatMxn(user.balanceCents)}
            </p>
            <Button href="/app/fondos" size="sm" variant="secondary" fullWidth className="mt-3">
              <Plus aria-hidden /> Agregar saldo
            </Button>
          </div>
          <div className="flex items-center gap-3 px-1">
            <UserMenu name={user.name} email={user.email} isAdmin={isAdmin} align="start" side="top" />
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-fg">{user.name}</p>
              <p className="truncate text-[13px] text-subtle">{user.email}</p>
            </div>
          </div>
        </div>
      </aside>

      <div className="lg:pl-64">
        {/* Mobile/tablet top bar (the sidebar covers this on desktop) */}
        <header className="glass-strong sticky top-0 z-30 border-x-0 border-t-0 pt-[env(safe-area-inset-top)] lg:hidden">
          <div className="mx-auto flex h-16 w-full max-w-4xl items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
            <Link href="/app" aria-label="NovaPhone – inicio" className="rounded-control">
              <LogoMark size={30} title={null} className="sm:hidden" />
              <Logo size={22} title={null} className="hidden sm:block" />
            </Link>
            <div className="flex items-center gap-2.5">
              <BalancePill balanceCents={user.balanceCents} />
              <UserMenu name={user.name} email={user.email} isAdmin={isAdmin} />
            </div>
          </div>
        </header>

        <main className="mx-auto w-full max-w-4xl px-4 pb-[calc(6rem+env(safe-area-inset-bottom))] pt-5 sm:px-6 sm:pt-8 lg:px-8 lg:pb-16 lg:pt-12">
          {children}
        </main>
      </div>

      <BottomNav />
    </div>
  );
}
