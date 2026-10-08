import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage, type LegalSection } from "@/components/marketing/legal-page";

export const metadata: Metadata = {
  title: "Términos y condiciones",
  description: "Términos y condiciones de uso del servicio de eSIM de datos NovaPhone en México (versión preliminar).",
  alternates: { canonical: "/terminos" },
};

const sections: LegalSection[] = [
  {
    title: "El servicio",
    body: (
      <>
        <p>
          NovaPhone ofrece eSIM de <strong className="font-medium text-fg">datos móviles</strong> para usarse en México.
          El servicio no incluye número telefónico, llamadas ni SMS. La conectividad la proveen operadores de red
          terceros (por ejemplo, Telcel y AT&amp;T); la velocidad y la cobertura dependen de la red, la zona y tu equipo.
        </p>
      </>
    ),
  },
  {
    title: "Tu cuenta",
    body: (
      <p>
        Para usar NovaPhone creas una cuenta con nombre, correo y contraseña. Eres responsable de mantener tu contraseña
        segura y de la actividad que ocurra en tu cuenta. Debes ser mayor de edad o contar con autorización de tu madre,
        padre o tutor.
      </p>
    ),
  },
  {
    title: "Saldo y pagos",
    body: (
      <>
        <p>
          Las compras se realizan con saldo prepagado en tu cuenta. Puedes recargar saldo por transferencia SPEI o con
          USDT (red TRC20). Los precios se muestran en pesos mexicanos e incluyen IVA.
        </p>
        <ul>
          <li>El saldo se acredita una vez que confirmamos la recepción del pago.</li>
          <li>Los envíos de USDT deben hacerse por la red TRC20 y por el monto exacto indicado.</li>
          <li>El saldo no genera intereses ni es un instrumento de ahorro.</li>
        </ul>
      </>
    ),
  },
  {
    title: "Entrega, instalación y vigencia",
    body: (
      <>
        <p>
          Tras la compra, recibes tu eSIM al instante por correo y en tu panel. Necesitas un equipo compatible con eSIM
          y desbloqueado. Para navegar debes activar “Roaming de datos” en la línea NovaPhone.
        </p>
        <p>
          La vigencia del plan empieza cuando la eSIM se conecta a la red por primera vez. Los datos no usados al
          terminar la vigencia no son acumulables.
        </p>
      </>
    ),
  },
  {
    title: "Cancelaciones y reembolsos",
    body: (
      <p>
        Una vez instalada o activada, una eSIM no puede reutilizarse ni reembolsarse. Si hay una falla atribuible al
        servicio que no podamos resolver, te devolveremos el importe a tu saldo. Escríbenos desde tu panel para revisar
        tu caso.
      </p>
    ),
  },
  {
    title: "Uso aceptable",
    body: (
      <p>
        No está permitido usar el servicio para actividades ilícitas, envío masivo de tráfico no solicitado ni para
        revender la conectividad sin autorización. Podemos suspender cuentas que incumplan estos términos.
      </p>
    ),
  },
  {
    title: "Marcas",
    body: (
      <p>
        Telcel es una marca registrada de su respectivo titular. NovaPhone no está afiliado a Radiomóvil Dipsa. Las
        demás marcas mencionadas pertenecen a sus titulares.
      </p>
    ),
  },
  {
    title: "Cambios y contacto",
    body: (
      <p>
        Podemos actualizar estos términos; publicaremos la versión vigente en esta página. Consulta también nuestro{" "}
        <Link href="/privacidad">Aviso de privacidad</Link>.
      </p>
    ),
  },
];

export default function TerminosPage() {
  return (
    <LegalPage
      title="Términos y condiciones"
      updated="octubre de 2026"
      intro={<p>Al crear una cuenta o comprar en NovaPhone aceptas estos términos. Los escribimos en lenguaje claro.</p>}
      sections={sections}
    />
  );
}
