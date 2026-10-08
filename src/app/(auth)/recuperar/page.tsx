import type { Metadata } from "next";
import Link from "next/link";
import { KeyRound } from "lucide-react";
import { ResetRequestForm } from "@/components/app/auth-forms";

export const metadata: Metadata = { title: "Recuperar contraseña" };

export default async function ForgotPasswordPage({ searchParams }: PageProps<"/recuperar">) {
  const sp = await searchParams;
  const email = typeof sp.email === "string" && sp.email.length <= 254 ? sp.email : "";

  return (
    <div className="flex flex-col gap-7">
      <div className="flex flex-col items-center gap-4 text-center">
        <div className="flex size-12 items-center justify-center rounded-2xl border border-border bg-surface-2 text-lavender shadow-glow-sm">
          <KeyRound className="size-5" aria-hidden />
        </div>
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-semibold text-fg">¿Olvidaste tu contraseña?</h1>
          <p className="text-[15px] leading-relaxed text-muted">
            No pasa nada. Escribe tu correo y te enviamos un código para crear una nueva.
          </p>
        </div>
      </div>
      <ResetRequestForm defaultEmail={email} />
      <p className="text-center text-sm text-muted">
        ¿Ya la recordaste?{" "}
        <Link href="/entrar" className="font-medium text-lavender underline-offset-4 hover:text-lavender-soft hover:underline">
          Entrar
        </Link>
      </p>
    </div>
  );
}
