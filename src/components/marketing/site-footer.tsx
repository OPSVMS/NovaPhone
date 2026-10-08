import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { Container } from "@/components/ui/container";
import { AUTH_LINKS } from "./nav";

const columns = [
  {
    title: "Producto",
    links: [
      { href: "/planes", label: "Planes" },
      { href: "/#como-funciona", label: "Cómo funciona" },
      { href: "/#compatibilidad", label: "Compatibilidad" },
      { href: "/#preguntas", label: "Preguntas frecuentes" },
    ],
  },
  {
    title: "Cuenta",
    links: [
      { href: AUTH_LINKS.signup, label: "Crear cuenta" },
      { href: AUTH_LINKS.login, label: "Entrar" },
    ],
  },
  {
    title: "Legal",
    links: [
      { href: "/terminos", label: "Términos y condiciones" },
      { href: "/privacidad", label: "Aviso de privacidad" },
    ],
  },
];

export function SiteFooter() {
  const year = new Date().getFullYear();
  return (
    <footer className="relative border-t border-border pb-safe">
      <Container className="py-12 sm:py-16">
        <div className="grid gap-10 md:grid-cols-[1.4fr_repeat(3,1fr)] md:gap-8">
          <div className="flex max-w-xs flex-col gap-4">
            <Link href="/" aria-label="NovaPhone – inicio" className="-m-1 w-fit rounded-lg p-1">
              <Logo size={22} title={null} />
            </Link>
            <p className="text-sm leading-relaxed text-muted">
              eSIM de datos para México sobre la red 5G más grande del país. Sin papeleo, sin contratos.
            </p>
            <p className="text-[13px] text-subtle">Pagos con SPEI y USDT (TRC20)</p>
          </div>

          <div className="grid grid-cols-2 gap-8 sm:grid-cols-3 md:contents">
            {columns.map((col) => (
              <nav key={col.title} aria-label={col.title} className="flex flex-col gap-3">
                <h2 className="font-sans text-[13px] font-medium tracking-normal text-fg">{col.title}</h2>
                <ul className="flex flex-col">
                  {col.links.map((link) => (
                    <li key={link.href}>
                      <Link
                        href={link.href}
                        className="inline-flex min-h-10 items-center text-sm text-muted transition-colors duration-200 hover:text-fg"
                      >
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </nav>
            ))}
          </div>
        </div>

        <div className="hairline mt-12" />

        <div className="mt-6 flex flex-col gap-3 text-[13px] leading-relaxed text-subtle sm:flex-row sm:items-start sm:justify-between sm:gap-8">
          <p>© {year} NovaPhone. Precios en pesos mexicanos, IVA incluido.</p>
          <p className="max-w-xl sm:text-right">
            Telcel es una marca registrada de su respectivo titular. NovaPhone no está afiliado a Radiomóvil Dipsa.
          </p>
        </div>
      </Container>
    </footer>
  );
}
