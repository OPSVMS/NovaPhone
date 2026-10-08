import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getUser } from "@/lib/session";
import { safeNext } from "@/components/app/format";
import { LoginForm } from "@/components/app/auth-forms";

export const metadata: Metadata = { title: "Entrar" };


export default async function LoginPage({ searchParams }: PageProps<"/entrar">) {
  const sp = await searchParams;
  const next = safeNext(sp.next);
  const user = await getUser();
  if (user) redirect(user.verified ? (next ?? "/app") : "/verificar");

  const registerHref = next ? `/registro?next=${encodeURIComponent(next)}` : "/registro";
  return (
    <div className="flex flex-col gap-7">
      <div className="flex flex-col gap-2 text-center">
        <h1 className="text-2xl font-semibold text-fg">Qué gusto verte</h1>
        <p className="text-[15px] text-muted">Entra para ver tus eSIM y tu saldo.</p>
      </div>
      <LoginForm next={next} />
      <p className="text-center text-sm text-muted">
        ¿Aún no tienes cuenta?{" "}
        <Link href={registerHref} className="font-medium text-lavender underline-offset-4 hover:text-lavender-soft hover:underline">
          Crea una gratis
        </Link>
      </p>
    </div>
  );
}
