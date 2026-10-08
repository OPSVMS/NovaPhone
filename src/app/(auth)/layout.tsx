import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { Aurora } from "@/components/motion/aurora";
import { FadeIn } from "@/components/motion/fade-in";

export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="relative isolate flex min-h-dvh flex-col overflow-hidden">
      <Aurora variant="subtle" grid />
      <header className="flex justify-center px-4 pb-2 pt-[max(2rem,env(safe-area-inset-top))] sm:pt-12">
        <Link
          href="/"
          aria-label="NovaPhone – inicio"
          className="rounded-control p-1.5 transition-opacity duration-200 hover:opacity-80"
        >
          <Logo size={26} title={null} />
        </Link>
      </header>
      <main className="flex flex-1 items-start justify-center px-4 pb-10 pt-6 sm:items-center sm:pb-16 sm:pt-4">
        <FadeIn immediate y={12} className="w-full max-w-[420px]">
          <div className="glass rounded-panel p-6 shadow-card sm:p-8">{children}</div>
        </FadeIn>
      </main>
      <footer className="pb-safe px-4 text-center text-[13px] text-subtle">
        eSIM de datos para México · Red Telcel 5G
      </footer>
    </div>
  );
}
