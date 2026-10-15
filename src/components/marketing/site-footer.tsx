import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { Container } from "@/components/ui/container";
import { AUTH_LINKS } from "./nav";
import { WhatsAppIcon, WhatsAppLink } from "./whatsapp";

const columns = [
  {
    title: "eSIM",
    links: [
      { href: "/#planes", label: "Planes y precios" },
      { href: "/#como-funciona", label: "Cómo funciona" },
      { href: "/#preguntas", label: "Preguntas frecuentes" },
    ],
  },
  {
    title: "Cuenta",
    links: [
      { href: AUTH_LINKS.login, label: "Entrar" },
      { href: AUTH_LINKS.signup, label: "Crear cuenta" },
    ],
  },
  {
    title: "Legal",
    links: [
      { href: "/terminos", label: "Términos y condiciones" },
      { href: "/privacidad", label: "Aviso de privacidad" },
      { href: "/reembolsos", label: "Reembolsos" },
    ],
  },
];

export function SiteFooter() {
  const year = new Date().getFullYear();
  return (
    <footer className="relative border-t border-border bg-surface pb-safe">
      {/* room for the mobile sticky buy bar */}
      <Container className="pb-28 pt-12 sm:pt-14 lg:pb-14">
        <div className="grid gap-10 md:grid-cols-[1.4fr_repeat(3,1fr)] md:gap-8">
          <div className="flex max-w-xs flex-col gap-4">
            <Link href="/" aria-label="NovaPhone – inicio" className="-m-1 w-fit rounded-lg p-1">
              <Logo size={24} title={null} />
            </Link>
            <p className="text-sm leading-relaxed text-muted">eSIM de datos para México en red Telcel 5G.</p>
            <WhatsAppLink
              className="inline-flex w-fit items-center gap-2 text-sm font-semibold text-whatsapp hover:underline"
              testId="footer-whatsapp"
            >
              <WhatsAppIcon className="size-5" />
              Soporte por WhatsApp
            </WhatsAppLink>
          </div>

          <div className="grid grid-cols-2 gap-8 sm:grid-cols-3 md:contents">
            {columns.map((col) => (
              <nav key={col.title} aria-label={col.title} className="flex flex-col gap-2">
                <h2 className="font-sans text-[13px] font-semibold tracking-normal text-fg">{col.title}</h2>
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

        <div className="mt-10 flex flex-col gap-2 border-t border-border pt-6 text-[13px] leading-relaxed text-subtle">
          <p>
            © {year} NovaPhone, operado por <span className="font-medium text-muted">MASMOVIL S.A. de C.V.</span>,
            Guadalajara, Jalisco, México. Precios en pesos mexicanos, IVA incluido.
          </p>
          <p>Telcel es una marca registrada de su titular. NovaPhone no está afiliado a Radiomóvil Dipsa.</p>
        </div>
      </Container>
    </footer>
  );
}
