export type FaqItem = { q: string; a: string; link?: { href: string; label: string } };

/**
 * Buyer questions left after the hero: will it work on my phone, CURP linking (legal status only),
 * how do I pay, how do I top up, what if it fails.
 * Compliance (docs/ads/POLICY.md §6.2): the CURP answer is the exact sanctioned text — legal status only, no promise,
 * no adjectives. Never sell "sin registro" / "sin papeleo" / "no pedimos CURP, INE" anywhere.
 */
export const FAQ: FaqItem[] = [
  {
    q: "¿Mi celular es compatible?",
    a: "Funciona en celulares con eSIM y liberados: iPhone XS o más nuevo, Samsung Galaxy S20 o más nuevo, Google Pixel 3 o más nuevo, y muchos otros. Para confirmarlo, marca *#06#. Si aparece un número EID, tu celular es compatible.",
  },
  {
    q: "¿Tengo que vincular la eSIM de NovaPhone con mi CURP?",
    a: "La vinculación de líneas con CURP que coordina la CRT aplica a las líneas móviles con número telefónico. La eSIM de NovaPhone es solo de datos: no te da un número mexicano, llamadas ni SMS, así que no sustituye tu línea. Si tienes una línea móvil, vincularla con tu compañía en las fechas oficiales sigue siendo tu responsabilidad; NovaPhone no cambia esa obligación. Información oficial: gob.mx/crt.",
    link: { href: "https://www.gob.mx/crt", label: "gob.mx/crt" },
  },
  {
    q: "¿Cómo pago y qué datos necesito?",
    a: "Paga con tarjeta (Visa, Mastercard, Amex), Apple Pay o Google Pay a través de Stripe, con cobro en pesos. También puedes pagar por SPEI desde tu cuenta. Solo necesitas tu correo: ahí te llega el QR.",
  },
  {
    q: "¿Cómo recargo cuando se me acaben los datos?",
    a: "Desde tu cuenta NovaPhone, en la misma eSIM. Los datos y días se suman al instante. No tienes que instalar nada otra vez.",
  },
  {
    q: "¿Y si no funciona? ¿Me devuelven mi dinero?",
    a: "Sí. Garantía de conexión: si no logramos conectarte, te devolvemos el importe. Si no instalaste la eSIM, te devolvemos el 100 % dentro de 30 días. El reembolso va a tu tarjeta si pagaste con tarjeta, o a tu saldo si pagaste con SPEI.",
    link: { href: "/reembolsos", label: "Política de reembolsos" },
  },
];
