import type { Metadata } from "next";
import { SearchX } from "lucide-react";
import { getOrderForSuccess } from "@/lib/checkout";
import { Button } from "@/components/ui/button";
import { OrderSuccess } from "./order-success";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Tu compra",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

/** Página de éxito de la compra con tarjeta: `/compra/{orderId}?t={token}` (success_url de Stripe Checkout). */
export default async function CompraPage({ params, searchParams }: PageProps<"/compra/[id]">) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const token = typeof sp.t === "string" ? sp.t : "";
  const order = token ? await getOrderForSuccess(id, token).catch((e) => (console.error("compra", id, e), null)) : null;

  if (!order) {
    return (
      <div className="mx-auto flex max-w-lg flex-col items-center gap-5 py-14 text-center" data-testid="order-not-found">
        <span className="flex size-14 items-center justify-center rounded-2xl border border-border bg-surface-2 text-lavender">
          <SearchX aria-hidden className="size-6" />
        </span>
        <h1 className="text-2xl font-semibold text-fg">No encontramos esta compra</h1>
        <p className="text-[15px] leading-relaxed text-muted">
          Abre la liga del correo que te enviamos o entra a tu cuenta para ver tus eSIM. Si acabas de pagar, revisa tu correo en unos minutos.
        </p>
        <div className="flex w-full flex-col gap-2.5 sm:w-auto sm:flex-row">
          <Button href="/entrar" size="lg">
            Entrar a mi cuenta
          </Button>
          <Button href="/planes" size="lg" variant="secondary">
            Ver planes
          </Button>
        </div>
      </div>
    );
  }

  return <OrderSuccess initial={order} token={token} />;
}
