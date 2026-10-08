import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { HeaderShell } from "./header-shell";
import { MobileMenu } from "./mobile-menu";
import { AUTH_LINKS, NAV_LINKS } from "./nav";

export function SiteHeader() {
  return (
    <HeaderShell>
      <Container className="flex h-16 items-center justify-between gap-6">
        <Link href="/" aria-label="NovaPhone – inicio" className="-m-1 rounded-lg p-1">
          <Logo size={22} title={null} />
        </Link>

        <nav aria-label="Principal" className="hidden md:block">
          <ul className="flex items-center gap-1">
            {NAV_LINKS.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  className="inline-flex h-9 items-center rounded-[10px] px-3 text-sm text-muted transition-colors duration-200 ease-out-expo hover:bg-white/[0.04] hover:text-fg"
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className="hidden items-center gap-2 md:flex">
          <Button href={AUTH_LINKS.login} variant="ghost" size="sm">
            Entrar
          </Button>
          <Button href={AUTH_LINKS.signup} size="sm">
            Crear cuenta
          </Button>
        </div>

        <MobileMenu links={NAV_LINKS} />
      </Container>
    </HeaderShell>
  );
}
