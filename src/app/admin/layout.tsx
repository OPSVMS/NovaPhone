import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { Aurora } from "@/components/motion/aurora";
import { Badge } from "@/components/ui/badge";
import { requireAdmin } from "@/lib/session";
import { UserMenu } from "@/components/app/user-menu";

export const metadata = { title: "Admin", robots: { index: false, follow: false } };

export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  const user = await requireAdmin();
  return (
    <div className="relative isolate min-h-dvh">
      <div aria-hidden className="pointer-events-none fixed inset-0 -z-10">
        <Aurora variant="subtle" />
      </div>
      <header className="glass-strong sticky top-0 z-30 border-x-0 border-t-0 pt-[env(safe-area-inset-top)]">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <Link href="/admin" aria-label="Panel de admin" className="rounded-control">
              <Logo size={22} title={null} />
            </Link>
            <Badge variant="primary">Admin</Badge>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/app"
              className="hidden h-10 items-center gap-1.5 rounded-control px-3 text-sm text-muted transition-colors hover:bg-white/[0.05] hover:text-fg sm:inline-flex"
            >
              <ArrowLeft aria-hidden className="size-4" /> Ir a la app
            </Link>
            <UserMenu name={user.name} email={user.email} isAdmin />
          </div>
        </div>
      </header>
      <main className="pb-safe mx-auto w-full max-w-6xl px-4 pt-6 sm:px-6 sm:pt-10 lg:px-8">{children}</main>
    </div>
  );
}
