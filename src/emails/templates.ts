/**
 * Plantillas de correo NovaPhone. Funciones puras: devuelven `{ subject, html, text }`.
 * El envío vive en `src/lib/email.ts`.
 */
import {
  button,
  callout,
  code,
  copyable,
  info,
  image,
  layout,
  link,
  links,
  mono,
  p,
  rich,
  small,
  steps,
  strong,
  type Email,
} from "./ui";

export type { Email } from "./ui";

// ─── Helpers ─────────────────────────────────────────────────────────────────

const TZ = "America/Mexico_City";
export const fmtDateTime = (d: Date) => new Intl.DateTimeFormat("es-MX", { dateStyle: "long", timeStyle: "short", timeZone: TZ }).format(d);
export const fmtDate = (d: Date) => new Intl.DateTimeFormat("es-MX", { dateStyle: "long", timeZone: TZ }).format(d);
export const fmtBytes = (b: number) => (b >= 1024 ** 3 ? `${(b / 1024 ** 3).toFixed(1)} GB` : `${Math.max(0, Math.round(b / 1024 ** 2))} MB`);
const esimPath = (orderId: string) => `/app/esims/${encodeURIComponent(orderId)}`;
const shortId = (id: string) => (id.length > 10 ? id.slice(0, 8).toUpperCase() : id.toUpperCase());
const firstName = (name: string) => name.trim().split(/\s+/)[0] ?? "";

/** Parte "LPA:1$smdp$codigo" en sus piezas. */
export function parseLpa(lpa: string) {
  const [, smdp = "", matching = ""] = lpa.split("$");
  return { smdp, matching };
}

/** Detecta un código de verificación (4–8 dígitos) dentro de un SMS. */
export function detectCode(body: string): string | null {
  const m = body.match(/(?<![\d])(\d{3}[- ]\d{3}|\d{4,8})(?![\d])/);
  return m ? m[1].replace(/[- ]/g, "") : null;
}

// ─── Cuenta ──────────────────────────────────────────────────────────────────

export function verificationCode(codeValue: string): Email {
  return layout({
    subject: `${codeValue} es tu código de NovaPhone`,
    preheader: `Tu código para confirmar tu correo es ${codeValue}. Vence en 15 minutos.`,
    eyebrow: "Confirma tu correo",
    title: "Tu código de verificación",
    blocks: [
      p("Escribe este código en NovaPhone para activar tu cuenta. Así sabemos que este correo es tuyo y podemos mandarte tu eSIM y tus recibos."),
      code(codeValue),
      small("El código vence en 15 minutos. Si tú no creaste una cuenta en NovaPhone, ignora este correo: nadie podrá usarla sin este código."),
    ],
    reason: "Recibes este correo porque alguien se registró en NovaPhone con esta dirección.",
  });
}

export function welcome(name: string): Email {
  const n = firstName(name);
  return layout({
    subject: n ? `Bienvenido a NovaPhone, ${n}` : "Bienvenido a NovaPhone",
    preheader: "Tu cuenta está lista. Así activas tus datos en minutos, sin contratos.",
    eyebrow: "Bienvenida",
    title: n ? `¡Hola, ${n}! Ya eres parte de NovaPhone` : "¡Ya eres parte de NovaPhone!",
    blocks: [
      p(
        rich`NovaPhone es tu ${strong("eSIM de datos para México")} en la red Telcel 5G: compras un plan, lo instalas en tu celular en un par de minutos y listo. Sin chip físico, sin contratos y sin ir a una tienda.`,
      ),
      steps(
        [
          { title: "Agrega saldo", body: "Deposita por SPEI, USDT o tarjeta. Tu saldo queda listo para compras y recargas." },
          { title: "Compra tu plan", body: "Elige los GB y días que necesitas. Puedes recargar la misma eSIM cuando quieras." },
          { title: "Instala tu eSIM", body: "Te mandamos el QR por correo. En iPhone se instala con un solo toque." },
        ],
        "Empieza en 3 pasos",
      ),
      button("Ir a mi cuenta", "/app"),
      small("Tip: activa la auto-recarga en tu eSIM y nunca te quedarás sin datos a medio camino."),
    ],
  });
}

export function passwordResetCode(codeValue: string): Email {
  return layout({
    subject: `${codeValue} es tu código para restablecer tu contraseña`,
    preheader: `Usa ${codeValue} para crear una contraseña nueva. Vence en 15 minutos.`,
    eyebrow: "Seguridad",
    title: "Restablece tu contraseña",
    blocks: [
      p("Recibimos una solicitud para cambiar la contraseña de tu cuenta NovaPhone. Escribe este código para crear una nueva:"),
      code(codeValue),
      small("El código vence en 15 minutos y solo funciona una vez."),
      callout("info", "Si tú no lo pediste, ignora este correo. Tu contraseña actual sigue funcionando y nadie puede cambiarla sin este código.", "¿No fuiste tú?"),
    ],
    reason: "Recibes este correo porque se solicitó restablecer la contraseña de tu cuenta.",
  });
}

export function passwordChanged(when = new Date()): Email {
  return layout({
    subject: "Tu contraseña de NovaPhone cambió",
    preheader: "Confirmamos el cambio de contraseña de tu cuenta. Si no fuiste tú, avísanos de inmediato.",
    eyebrow: "Seguridad",
    tone: "success",
    title: "Cambiaste tu contraseña",
    blocks: [
      p("Tu contraseña se actualizó correctamente. Por seguridad cerramos la sesión en tus otros dispositivos; vuelve a entrar con tu contraseña nueva."),
      info([
        { label: "Fecha", value: fmtDateTime(when) },
        { label: "Sesiones", value: "Cerradas en otros dispositivos" },
      ]),
      callout(
        "danger",
        rich`Restablece tu contraseña ahora desde ${link("novaphone.lat/recuperar", "/recuperar")} y escríbenos a ${link("hola@novaphone.lat", "mailto:hola@novaphone.lat")} para proteger tu cuenta y tu saldo.`,
        "¿No fuiste tú?",
      ),
      button("Ir a mi cuenta", "/app", { variant: "secondary" }),
    ],
  });
}

// ─── eSIM ────────────────────────────────────────────────────────────────────

export function esimReady(o: { planName: string; activationCode: string; orderUrl: string; qrSrc: string }): Email {
  const { smdp, matching } = parseLpa(o.activationCode);
  const apple = `https://esimsetup.apple.com/esim_qrcode_provisioning?carddata=${o.activationCode}`;
  const orderId = o.orderUrl.split("/").filter(Boolean).pop() ?? "";
  return layout({
    subject: `Tu eSIM ${o.planName} está lista`,
    preheader: "Escanea el QR o instálala con un toque en iPhone. Tarda menos de 2 minutos.",
    eyebrow: "eSIM lista",
    tone: "success",
    title: "Tu eSIM está lista para instalar",
    blocks: [
      p(rich`Tu plan ${strong(o.planName)} ya está activo. Escanea este código con la cámara desde ${strong("otro dispositivo")}, o si estás en tu iPhone, instálala con un toque.`),
      image(o.qrSrc, { alt: "Código QR de tu eSIM", width: 200, height: 200, caption: "Escanéalo desde Ajustes › Datos móviles › Agregar eSIM" }),
      button("Instalar en iPhone", apple),
      links([{ label: "Ver mi eSIM", href: o.orderUrl }]),
      steps(
        [
          { title: "Instala la eSIM", body: "iPhone: toca el botón de arriba o escanea el QR. Android: Ajustes › Conexiones › Administrador de SIM › Agregar eSIM." },
          { title: "Activa “Roaming de datos”", body: rich`En la línea NovaPhone, enciende ${strong("Roaming de datos")}. Es necesario para conectarte; no genera cargos extra.` },
          { title: "Úsala para datos móviles", body: "Elige NovaPhone como línea de datos. Tu número de siempre sigue funcionando para llamadas y SMS." },
        ],
        "Cómo instalarla",
      ),
      info(
        [
          { label: "Dirección SM-DP+", value: smdp, mono: true, stack: true },
          { label: "Código de activación", value: matching, mono: true, stack: true },
        ],
        "Instalación manual",
      ),
      info(
        [
          { label: "Plan", value: o.planName, strong: true },
          { label: "Red", value: "Telcel 5G · México" },
          orderId ? { label: "Pedido", value: mono(`#${shortId(orderId)}`) } : null,
          { label: "Estado", value: "Lista para instalar" },
        ],
        "Resumen de compra",
      ),
      callout("warning", "Instálala en el celular donde la vas a usar. No la borres después de instalarla: una eSIM solo puede instalarse una vez.", "Importante"),
    ],
    reason: "Recibes este correo porque compraste una eSIM en NovaPhone.",
  });
}

export function autoTopupDone(planName: string, orderId: string): Email {
  return layout({
    subject: "Recargamos tu eSIM automáticamente",
    preheader: `Tu eSIM ${planName} tiene datos y días nuevos. Sigues conectado sin hacer nada.`,
    eyebrow: "Auto-recarga",
    tone: "success",
    title: "Auto-recarga aplicada",
    blocks: [
      p(rich`Tu eSIM ${strong(planName)} se estaba quedando sin datos o días, así que la recargamos con tu saldo. Los datos y días se sumaron a la misma eSIM: no tienes que reinstalar nada.`),
      info([
        { label: "eSIM", value: planName, strong: true },
        { label: "Pedido", value: mono(`#${shortId(orderId)}`) },
        { label: "Pagado con", value: "Saldo NovaPhone" },
      ]),
      button("Ver mi eSIM", esimPath(orderId)),
      small("Puedes desactivar la auto-recarga cuando quieras desde el detalle de tu eSIM."),
    ],
  });
}

export function autoTopupNoFunds(planName: string, price: string, orderId: string): Email {
  return layout({
    subject: "Tu eSIM necesita saldo para recargarse",
    preheader: `La auto-recarga de ${planName} no pudo aplicarse: tu saldo no alcanza.`,
    eyebrow: "Acción necesaria",
    tone: "warning",
    title: "Agrega saldo para no quedarte sin datos",
    blocks: [
      p(rich`Tu eSIM ${strong(planName)} está por terminarse y tienes la auto-recarga activa, pero tu saldo no alcanza para aplicarla.`),
      info([
        { label: "eSIM", value: planName, strong: true },
        price ? { label: "Recarga", value: price } : null,
        { label: "Pedido", value: mono(`#${shortId(orderId)}`) },
      ]),
      button("Agregar saldo", "/app/fondos"),
      links([{ label: "Ver mi eSIM", href: esimPath(orderId) }]),
      small("En cuanto tengas saldo, intentaremos la recarga de nuevo automáticamente."),
    ],
  });
}

export function lowData(planName: string, leftBytes: number, orderId: string): Email {
  const left = fmtBytes(leftBytes);
  return layout({
    subject: `Te quedan ${left} en tu eSIM`,
    preheader: `A tu eSIM ${planName} le quedan ${left}. Recárgala en un toque.`,
    eyebrow: "Datos",
    tone: "warning",
    title: "Se están acabando tus datos",
    blocks: [
      p(rich`A tu eSIM ${strong(planName)} le quedan ${strong(left)}. Recárgala en un toque: los datos y días se suman a la misma eSIM, sin reinstalar.`),
      button("Recargar ahora", esimPath(orderId)),
      callout("info", "Activa la auto-recarga y te recargamos con tu saldo justo antes de que se acaben tus datos.", "Tip"),
    ],
  });
}

export function expiringSoon(planName: string, expiresAt: Date, orderId: string): Email {
  return layout({
    subject: "Tu eSIM vence pronto",
    preheader: `Tu eSIM ${planName} vence el ${fmtDate(expiresAt)}. Recárgala para conservarla.`,
    eyebrow: "Vigencia",
    tone: "warning",
    title: "Tu plan está por vencer",
    blocks: [
      p(rich`Tu eSIM ${strong(planName)} vence el ${strong(fmtDateTime(expiresAt))}.`),
      callout("warning", "Recárgala antes de esa fecha para conservarla. Después de vencer ya no se puede recargar y tendrías que comprar e instalar una nueva."),
      button("Recargar ahora", esimPath(orderId)),
    ],
  });
}

export function topupApplied(o: { planName: string; topupName: string; amount: string; orderId: string }): Email {
  return layout({
    subject: `Recarga aplicada a tu eSIM ${o.planName}`,
    preheader: `${o.topupName} se sumó a tu eSIM. Sigues conectado sin reinstalar.`,
    eyebrow: "Recarga",
    tone: "success",
    title: "Tu recarga ya está activa",
    blocks: [
      p(rich`Sumamos ${strong(o.topupName)} a tu eSIM ${strong(o.planName)}. No tienes que hacer nada: los datos y días nuevos ya están disponibles en la misma eSIM.`),
      info([
        { label: "eSIM", value: o.planName },
        { label: "Recarga", value: o.topupName },
        { label: "Pedido", value: mono(`#${shortId(o.orderId)}`) },
        { label: "Total", value: o.amount, strong: true },
      ]),
      button("Ver mi eSIM", esimPath(o.orderId)),
    ],
  });
}

// ─── Saldo ───────────────────────────────────────────────────────────────────

export function depositCredited(amount: string): Email {
  return layout({
    subject: `Recibimos tu depósito de ${amount}`,
    preheader: `${amount} ya están en tu saldo NovaPhone.`,
    eyebrow: "Saldo",
    tone: "success",
    title: "Saldo acreditado",
    blocks: [
      p(rich`Tu depósito de ${strong(amount)} ya está disponible en tu saldo NovaPhone. Úsalo para comprar un plan o recargar tus eSIM.`),
      info([
        { label: "Monto acreditado", value: amount, strong: true },
        { label: "Fecha", value: fmtDateTime(new Date()) },
      ]),
      button("Comprar un plan", "/app/comprar"),
      links([{ label: "Ver mi saldo", href: "/app/fondos" }]),
    ],
  });
}

export function depositRequested(o: {
  method: "spei" | "usdt" | "card";
  amount: string;
  reference: string;
  depositUrl: string;
  clabe?: string;
  bank?: string;
  beneficiary?: string;
  usdtAmount?: string;
  usdtAddress?: string;
  usdtNetwork?: string;
}): Email {
  const methodName = { spei: "Transferencia SPEI", usdt: "USDT", card: "Tarjeta" }[o.method];
  const common = { eyebrow: "Instrucciones de pago", reason: "Recibes este correo porque iniciaste un depósito en NovaPhone." };

  if (o.method === "spei") {
    return layout({
      ...common,
      subject: `Instrucciones para tu depósito de ${o.amount} por SPEI`,
      preheader: `Transfiere ${o.amount} por SPEI con la referencia ${o.reference}.`,
      title: `Transfiere ${o.amount} por SPEI`,
      blocks: [
        p("Haz la transferencia desde la app de tu banco con estos datos. En cuanto la recibamos, acreditamos tu saldo y te avisamos por correo."),
        o.clabe ? copyable("CLABE", o.clabe) : null,
        copyable("Referencia / concepto", o.reference, "Escríbela tal cual en el concepto de pago."),
        info([
          { label: "Monto", value: o.amount, strong: true },
          o.bank ? { label: "Banco", value: o.bank } : null,
          o.beneficiary ? { label: "Beneficiario", value: o.beneficiary } : null,
          { label: "Método", value: methodName },
        ]),
        callout("warning", "Incluye la referencia en el concepto para que identifiquemos tu pago al instante. Sin ella, el depósito puede tardar en acreditarse."),
        button("Ver mi depósito", o.depositUrl),
      ],
    });
  }

  if (o.method === "usdt") {
    const network = o.usdtNetwork ?? "la red indicada";
    return layout({
      ...common,
      subject: `Instrucciones para tu depósito de ${o.amount} en USDT`,
      preheader: `Envía ${o.usdtAmount ?? "el monto exacto"} USDT por ${network}.`,
      title: `Envía ${o.usdtAmount ? `${o.usdtAmount} USDT` : "tu pago en USDT"}`,
      blocks: [
        p(rich`Envía ${strong(o.usdtAmount ? `exactamente ${o.usdtAmount} USDT` : "el monto exacto en USDT")} a esta dirección. Acreditaremos ${strong(o.amount)} a tu saldo cuando la red confirme la transacción.`),
        o.usdtAddress ? copyable(`Dirección USDT${o.usdtNetwork ? ` · ${o.usdtNetwork}` : ""}`, o.usdtAddress) : null,
        info([
          o.usdtAmount ? { label: "Envía", value: `${o.usdtAmount} USDT`, strong: true } : null,
          { label: "Recibes en saldo", value: o.amount },
          o.usdtNetwork ? { label: "Red", value: o.usdtNetwork } : null,
          { label: "Referencia", value: mono(o.reference) },
        ]),
        callout("danger", rich`Envía solo ${strong("USDT")} por la red ${strong(network)}. Si usas otra red o moneda, los fondos se pierden y no podemos recuperarlos.`, "Revisa la red"),
        button("Ver mi depósito", o.depositUrl),
      ],
    });
  }

  return layout({
    ...common,
    subject: `Completa tu depósito de ${o.amount} con tarjeta`,
    preheader: `Termina tu pago con tarjeta para acreditar ${o.amount} a tu saldo.`,
    title: "Completa tu pago con tarjeta",
    blocks: [
      p(rich`Tu depósito de ${strong(o.amount)} está esperando el pago. Termínalo en nuestra página segura y el saldo se acredita al momento.`),
      info([
        { label: "Monto", value: o.amount, strong: true },
        { label: "Método", value: methodName },
        { label: "Referencia", value: mono(o.reference) },
      ]),
      button("Pagar con tarjeta", o.depositUrl),
      small("Si ya completaste el pago, ignora este correo: te avisaremos en cuanto se acredite."),
    ],
  });
}

export function personalClabeReady(o: { clabe: string; beneficiary: string; url: string }): Email {
  return layout({
    subject: "Tu CLABE personal de NovaPhone",
    preheader: "Deposita por SPEI cuando quieras: todo lo que envíes a esta CLABE se acredita a tu saldo.",
    eyebrow: "Saldo",
    title: "Tu CLABE personal está lista",
    blocks: [
      p("Ahora tienes una CLABE solo para ti. Guárdala como contacto en la app de tu banco y deposita por SPEI cuando quieras: lo que envíes se acredita automáticamente a tu saldo, sin referencias ni pasos extra."),
      copyable("Tu CLABE", o.clabe),
      info([
        { label: "Beneficiario", value: o.beneficiary },
        { label: "Tipo", value: "Transferencia SPEI" },
        { label: "Acreditación", value: "Automática" },
      ]),
      button("Ver mi saldo", o.url),
      small("Esta CLABE es personal: solo acredita a tu cuenta. No la compartas para recibir pagos de terceros."),
    ],
  });
}

// ─── Números virtuales ───────────────────────────────────────────────────────

export function phoneNumberReady(o: { number: string; monthly: string; renewsAt: Date; url: string }): Email {
  return layout({
    subject: `Tu número NovaPhone ${o.number} está listo`,
    preheader: "Ya puedes recibir SMS y códigos de verificación en tu número NovaPhone.",
    eyebrow: "Número virtual",
    tone: "success",
    title: "Tu número NovaPhone está listo",
    blocks: [
      p("Usa este número para recibir SMS y códigos de verificación de apps y bancos. Cada mensaje que llegue lo verás en tu cuenta y te lo reenviamos a este correo."),
      copyable("Tu número", o.number),
      info([
        { label: "Costo mensual", value: o.monthly, strong: true },
        { label: "Se renueva el", value: fmtDate(o.renewsAt) },
        { label: "Pago", value: "Con tu saldo NovaPhone" },
      ]),
      button("Ver mis mensajes", o.url),
      small("Mantén saldo suficiente antes de la fecha de renovación para no perder tu número."),
    ],
    reason: "Recibes este correo porque activaste un número virtual en NovaPhone.",
  });
}

export function smsReceived(o: { number: string; from: string; body: string; url: string }): Email {
  const detected = detectCode(o.body);
  return layout({
    subject: detected ? `Código ${detected} · SMS de ${o.from}` : `Nuevo SMS de ${o.from}`,
    preheader: detected ? `Tu código es ${detected}. Recibido en ${o.number}.` : o.body.slice(0, 120),
    eyebrow: "SMS recibido",
    title: detected ? "Recibiste un código" : `Nuevo mensaje de ${o.from}`,
    blocks: [
      p(rich`Llegó un SMS a tu número ${strong(o.number)}.`),
      detected ? code(detected, "Código detectado") : null,
      info([
        { label: "De", value: o.from },
        { label: "Para", value: o.number },
        { label: "Recibido", value: fmtDateTime(new Date()) },
        { label: "Mensaje", value: o.body, stack: true },
      ]),
      button("Ver en NovaPhone", o.url, { variant: detected ? "secondary" : "primary" }),
      small("Nunca compartas tus códigos con nadie. NovaPhone jamás te los pedirá."),
    ],
    reason: "Recibes este correo porque tienes un número virtual en NovaPhone.",
  });
}

export function phoneNumberRenewalFailed(o: { number: string; amount: string; graceUntil: Date; url: string }): Email {
  return layout({
    subject: `No pudimos renovar tu número ${o.number}`,
    preheader: `Agrega saldo antes del ${fmtDate(o.graceUntil)} para conservar tu número.`,
    eyebrow: "Acción necesaria",
    tone: "danger",
    title: "No pudimos renovar tu número",
    blocks: [
      p(rich`Intentamos cobrar la renovación de tu número ${strong(o.number)}, pero tu saldo no alcanzó.`),
      info([
        { label: "Número", value: o.number },
        { label: "Renovación", value: o.amount, strong: true },
        { label: "Conservas tu número hasta", value: fmtDateTime(o.graceUntil) },
      ]),
      callout("danger", rich`Si no agregas saldo antes del ${strong(fmtDate(o.graceUntil))}, el número se libera y ya no podrás recuperarlo ni recibir sus SMS.`),
      button("Agregar saldo", "/app/fondos"),
      links([{ label: "Ver mi número", href: o.url }]),
    ],
    reason: "Recibes este correo porque tienes un número virtual en NovaPhone.",
  });
}
