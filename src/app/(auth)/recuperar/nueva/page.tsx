import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { MailCheck } from "lucide-react";
import { ResetPasswordForm } from "@/components/app/auth-forms";

export const metadata: Metadata = { title: "Nueva contraseña" };

export default async function NewPasswordPage({ searchParams }: PageProps<"/recuperar/nueva">) {
  const sp = await searchParams;
  const email = typeof sp.email === "string" ? sp.email.trim().toLowerCase() : "";
  if (!email || email.length > 254 || !email.includes("@")) redirect("/recuperar");

  return (
    <div className="flex flex-col gap-7">
      <div className="flex flex-col items-center gap-4 text-center">
        <div className="flex size-12 items-center justify-center rounded-2xl border border-border bg-surface-2 text-lavender shadow-glow-sm">
          <MailCheck className="size-5" aria-hidden />
        </div>
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-semibold text-fg">Crea una contraseña nueva</h1>
          <p className="text-[15px] leading-relaxed text-muted">
            Si hay una cuenta con <span className="break-all font-medium text-fg">{email}</span>, te enviamos un código de
            6 dígitos. Vence en 15 minutos.
          </p>
        </div>
      </div>
      <ResetPasswordForm email={email} />
      <p className="text-center text-[13px] text-subtle">
        <Link href={`/recuperar?email=${encodeURIComponent(email)}`} className="underline-offset-4 transition-colors hover:text-muted hover:underline">
          ¿Correo equivocado? Usar otro
        </Link>
      </p>
    </div>
  );
}
