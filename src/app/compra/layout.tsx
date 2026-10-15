import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { Aurora } from "@/components/motion/aurora";

/** Página de compra con tarjeta: marco mínimo (sin navegación de cuenta) para el cliente que llega desde Stripe. */
export default function CompraLayout({ children }: LayoutProps<"/compra">) {
  return (
    <div className="relative isolate flex min-h-dvh flex-col overflow-hidden">
      <Aurora variant="subtle" grid />
      <header className="flex justify-center px-4 pb-2 pt-[max(1.5rem,env(safe-area-inset-top))] sm:pt-10">
        <Link href="/" aria-label="NovaPhone – inicio" className="rounded-control p-1.5 transition-opacity duration-200 hover:opacity-80">
          <Logo size={26} title={null} />
        </Link>
      </header>
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 pb-12 pt-4 sm:px-6 sm:pt-6">{children}</main>
      <footer className="pb-safe px-4 pb-6 text-center text-[13px] text-subtle">
        ¿Dudas? Escríbenos a <a href="mailto:hola@novaphone.lat" className="text-lavender hover:underline">hola@novaphone.lat</a>
      </footer>
    </div>
  );
}
