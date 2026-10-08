import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage, type LegalSection } from "@/components/marketing/legal-page";

export const metadata: Metadata = {
  title: "Aviso de privacidad",
  description: "Cómo NovaPhone recaba, usa y protege tus datos personales (versión preliminar).",
  alternates: { canonical: "/privacidad" },
};

const sections: LegalSection[] = [
  {
    title: "Datos que recabamos",
    body: (
      <>
        <p>Pedimos lo mínimo para darte el servicio:</p>
        <ul>
          <li>Nombre, correo electrónico y contraseña (almacenada cifrada).</li>
          <li>Historial de recargas, compras y eSIMs asociadas a tu cuenta.</li>
          <li>Datos técnicos de la eSIM (por ejemplo, ICCID y consumo de datos).</li>
        </ul>
        <p>
          <strong className="font-medium text-fg">No pedimos</strong> CURP, INE ni documentos de identidad.
        </p>
      </>
    ),
  },
  {
    title: "Para qué los usamos",
    body: (
      <ul>
        <li>Crear y administrar tu cuenta.</li>
        <li>Acreditar tus recargas y entregar tus eSIMs.</li>
        <li>Enviarte avisos sobre tu servicio y darte soporte.</li>
        <li>Prevenir fraudes y cumplir obligaciones legales.</li>
      </ul>
    ),
  },
  {
    title: "Con quién los compartimos",
    body: (
      <p>
        Solo con proveedores necesarios para operar el servicio (proveedor de eSIM, envío de correos, alojamiento y
        procesamiento de pagos) y con autoridades cuando la ley lo exija. No vendemos tus datos.
      </p>
    ),
  },
  {
    title: "Pagos",
    body: (
      <p>
        Las transferencias SPEI y los envíos de USDT se registran para acreditar tu saldo. Las transacciones en blockchain
        son públicas por naturaleza; no asociamos tu identidad a tu dirección más allá de lo necesario para acreditar el
        pago.
      </p>
    ),
  },
  {
    title: "Tus derechos (ARCO)",
    body: (
      <p>
        Puedes solicitar el acceso, rectificación, cancelación u oposición al tratamiento de tus datos, así como revocar
        tu consentimiento, escribiéndonos desde tu panel. Responderemos en los plazos que marca la ley aplicable.
      </p>
    ),
  },
  {
    title: "Seguridad y conservación",
    body: (
      <p>
        Aplicamos medidas técnicas y administrativas razonables para proteger tu información y la conservamos solo el
        tiempo necesario para los fines descritos o el que exija la ley.
      </p>
    ),
  },
  {
    title: "Cambios",
    body: (
      <p>
        Publicaremos cualquier cambio a este aviso en esta página. Consulta también nuestros{" "}
        <Link href="/terminos">Términos y condiciones</Link>.
      </p>
    ),
  },
];

export default function PrivacidadPage() {
  return (
    <LegalPage
      title="Aviso de privacidad"
      updated="octubre de 2026"
      intro={
        <p>
          En NovaPhone cuidamos tu información y pedimos solo lo indispensable. Este aviso explica qué datos tratamos y
          para qué.
        </p>
      }
      sections={sections}
    />
  );
}
