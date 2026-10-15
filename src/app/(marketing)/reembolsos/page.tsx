import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage, type LegalSection } from "@/components/marketing/legal-page";
import { WHATSAPP_URL } from "@/components/marketing/whatsapp";

export const metadata: Metadata = {
  title: "Política de reembolsos",
  description:
    "Garantía de conexión NovaPhone: si no logramos conectarte, te devolvemos el importe. Reembolso total si no instalaste tu eSIM (dentro de 30 días).",
  alternates: { canonical: "/reembolsos" },
};

const sections: LegalSection[] = [
  {
    title: "Si no instalaste tu eSIM",
    body: (
      <>
        <p>
          Te devolvemos el <strong className="font-semibold text-fg">100 % de lo que pagaste</strong> si lo pides dentro de
          los 30 días posteriores a la compra y la eSIM no se ha instalado en ningún teléfono.
        </p>
        <p>No necesitas explicar el motivo.</p>
      </>
    ),
  },
  {
    title: "Garantía de conexión",
    body: (
      <>
        <p>
          Si instalaste tu eSIM y no se conecta a la red, escríbenos. Revisamos tu caso contigo, normalmente en minutos.
        </p>
        <p>Garantía de conexión: si no logramos conectarte, te devolvemos el importe.</p>
        <p>Pídelo dentro de los 30 días posteriores a la compra.</p>
      </>
    ),
  },
  {
    title: "Cuándo no aplica",
    body: (
      <ul>
        <li>Si el teléfono no es compatible con eSIM o está bloqueado por su compañía (revísalo marcando *#06#).</li>
        <li>Si ya usaste los datos del plan, o la vigencia ya terminó.</li>
        <li>Si la eSIM se borró del teléfono después de instalarla. Se puede instalar una sola vez.</li>
      </ul>
    ),
  },
  {
    title: "Cómo pedirlo",
    body: (
      <>
        <p>
          Escríbenos por{" "}
          <a href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer">
            WhatsApp
          </a>{" "}
          o desde tu cuenta con el correo de tu compra.
        </p>
        <p>
          Devolvemos el importe al mismo medio de pago: a tu tarjeta si pagaste con tarjeta (puede tardar de 5 a 10 días
          hábiles en verse, según tu banco), o a tu saldo NovaPhone si pagaste con saldo o SPEI.
        </p>
      </>
    ),
  },
  {
    title: "Más información",
    body: (
      <p>
        Esta política forma parte de nuestros <Link href="/terminos">Términos y condiciones</Link>.
      </p>
    ),
  },
];

export default function ReembolsosPage() {
  return (
    <LegalPage
      title="Política de reembolsos"
      updated="15 de octubre de 2026"
      intro={<p>Queremos que compres tranquilo. Si tu eSIM no funciona, te devolvemos tu dinero.</p>}
      sections={sections}
    />
  );
}
