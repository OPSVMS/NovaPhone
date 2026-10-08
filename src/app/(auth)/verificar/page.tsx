import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { MailCheck } from "lucide-react";
import { getUser } from "@/lib/session";
import { safeNext } from "@/components/app/format";
import { logout } from "@/app/actions/auth";
import { OtpForm } from "@/components/app/otp-form";

export const metadata: Metadata = { title: "Verifica tu correo" };


export default async function VerifyPage({ searchParams }: PageProps<"/verificar">) {
  const sp = await searchParams;
  const next = safeNext(sp.next);
  const user = await getUser();
  if (!user) redirect("/entrar");
  if (user.verified) redirect(next ?? "/app");

  return (
    <div className="flex flex-col gap-7">
      <div className="flex flex-col items-center gap-4 text-center">
        <div className="flex size-12 items-center justify-center rounded-2xl border border-border bg-surface-2 text-lavender shadow-glow-sm">
          <MailCheck className="size-5" aria-hidden />
        </div>
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-semibold text-fg">Revisa tu correo</h1>
          <p className="text-[15px] leading-relaxed text-muted">
            Enviamos un código de 6 dígitos a{" "}
            <span className="break-all font-medium text-fg">{user.email}</span>
          </p>
        </div>
      </div>
      <OtpForm next={next} />
      <form action={logout} className="text-center">
        <button
          type="submit"
          className="text-[13px] text-subtle underline-offset-4 transition-colors hover:text-muted hover:underline"
        >
          ¿Correo equivocado? Usar otra cuenta
        </button>
      </form>
    </div>
  );
}
