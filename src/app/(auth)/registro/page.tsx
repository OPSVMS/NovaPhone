import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Check } from "lucide-react";
import { getUser } from "@/lib/session";
import { safeNext } from "@/components/app/format";
import { RegisterForm } from "@/components/app/auth-forms";

export const metadata: Metadata = { title: "Crear cuenta" };


export default async function RegisterPage({ searchParams }: PageProps<"/registro">) {
  const sp = await searchParams;
  const plan = typeof sp.plan === "string" && /^[\w.-]{1,64}$/.test(sp.plan) ? sp.plan : undefined;
  const next = plan ? `/app/comprar?plan=${encodeURIComponent(plan)}` : safeNext(sp.next);

  const user = await getUser();
  if (user) redirect(user.verified ? (next ?? "/app") : "/verificar");

  const loginHref = next ? `/entrar?next=${encodeURIComponent(next)}` : "/entrar";
  return (
    <div className="flex flex-col gap-7">
      <div className="flex flex-col gap-2 text-center">
        <h1 className="text-2xl font-semibold text-fg">Crea tu cuenta</h1>
        <p className="text-[15px] text-muted">
          {plan ? "Un paso más y activas tu plan." : "Tu eSIM de datos lista en minutos."}
        </p>
      </div>
      <ul className="flex flex-wrap justify-center gap-x-4 gap-y-1.5 text-[13px] text-muted">
        {["Sin contratos", "Red Telcel 5G", "Paga con SPEI o USDT"].map((t) => (
          <li key={t} className="inline-flex items-center gap-1.5">
            <Check className="size-3.5 text-lavender" aria-hidden />
            {t}
          </li>
        ))}
      </ul>
      <RegisterForm next={next} />
      <p className="text-center text-sm text-muted">
        ¿Ya tienes cuenta?{" "}
        <Link href={loginHref} className="font-medium text-lavender underline-offset-4 hover:text-lavender-soft hover:underline">
          Entrar
        </Link>
      </p>
    </div>
  );
}
