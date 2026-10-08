import "server-only";
import { Resend } from "resend";
import * as t from "@/emails/templates";
import type { Email } from "@/emails/templates";

/**
 * Correos transaccionales de NovaPhone (Resend).
 * - Sin RESEND_API_KEY: no envía, solo registra en consola (los tests dependen de esto).
 * - `send` nunca lanza: los errores se registran y el flujo sigue.
 * Diseño y plantillas: `src/emails/`.
 */

export const emailEnabled = () => !!process.env.RESEND_API_KEY;

const FROM = () => process.env.EMAIL_FROM || "NovaPhone <hola@novaphone.lat>";
const REPLY_TO = "hola@novaphone.lat";

type Attachment = { filename: string; content: Buffer; contentId: string };

let client: Resend | null = null;

async function send(to: string, email: Email, attachments?: Attachment[]) {
  if (!emailEnabled()) {
    console.log(`[email deshabilitado] ${to} · ${email.subject}`);
    return;
  }
  try {
    client ??= new Resend(process.env.RESEND_API_KEY);
    const { error } = await client.emails.send({
      from: FROM(),
      to,
      replyTo: REPLY_TO,
      subject: email.subject,
      html: email.html,
      text: email.text,
      ...(attachments?.length ? { attachments } : {}),
    });
    if (error) console.error(`[email] Resend error · ${email.subject}`, error);
  } catch (err) {
    console.error(`[email] fallo al enviar · ${email.subject}`, err);
  }
}

/** data:image/png;base64,... → adjunto inline (Gmail bloquea imágenes data: en el cuerpo). */
function inlineImage(src: string, contentId: string): { src: string; attachments?: Attachment[] } {
  const m = /^data:image\/(png|jpe?g|gif);base64,(.+)$/i.exec(src);
  if (!m) return { src };
  const ext = m[1].toLowerCase() === "jpeg" ? "jpg" : m[1].toLowerCase();
  return { src: `cid:${contentId}`, attachments: [{ filename: `${contentId}.${ext}`, content: Buffer.from(m[2], "base64"), contentId }] };
}

// ─── Cuenta ──────────────────────────────────────────────────────────────────

export function sendVerificationCode(to: string, code: string) {
  return send(to, t.verificationCode(code));
}

export function sendWelcome(to: string, name: string) {
  return send(to, t.welcome(name));
}

export function sendPasswordResetCode(to: string, code: string) {
  return send(to, t.passwordResetCode(code));
}

export function sendPasswordChanged(to: string) {
  return send(to, t.passwordChanged());
}

// ─── eSIM ────────────────────────────────────────────────────────────────────

export function sendEsimReady(to: string, o: { planName: string; activationCode: string; orderUrl: string; qrDataUrl: string }) {
  const qr = inlineImage(o.qrDataUrl, "esim-qr");
  return send(to, t.esimReady({ planName: o.planName, activationCode: o.activationCode, orderUrl: o.orderUrl, qrSrc: qr.src }), qr.attachments);
}

export function sendAutoTopupDone(to: string, planName: string, orderId: string) {
  return send(to, t.autoTopupDone(planName, orderId));
}

export function sendAutoTopupNoFunds(to: string, planName: string, price: string, orderId: string) {
  return send(to, t.autoTopupNoFunds(planName, price, orderId));
}

export function sendLowData(to: string, planName: string, leftBytes: number, orderId: string) {
  return send(to, t.lowData(planName, leftBytes, orderId));
}

export function sendExpiringSoon(to: string, planName: string, expiresAt: Date, orderId: string) {
  return send(to, t.expiringSoon(planName, expiresAt, orderId));
}

export function sendTopupApplied(to: string, o: { planName: string; topupName: string; amount: string; orderId: string }) {
  return send(to, t.topupApplied(o));
}

// ─── Saldo ───────────────────────────────────────────────────────────────────

export function sendDepositCredited(to: string, amount: string) {
  return send(to, t.depositCredited(amount));
}

export function sendDepositRequested(
  to: string,
  o: {
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
  },
) {
  return send(to, t.depositRequested(o));
}

export function sendPersonalClabeReady(to: string, o: { clabe: string; beneficiary: string; url: string }) {
  return send(to, t.personalClabeReady(o));
}

// ─── Números virtuales ───────────────────────────────────────────────────────

export function sendPhoneNumberReady(to: string, o: { number: string; monthly: string; renewsAt: Date; url: string }) {
  return send(to, t.phoneNumberReady(o));
}

export function sendSmsReceived(to: string, o: { number: string; from: string; body: string; url: string }) {
  return send(to, t.smsReceived(o));
}

export function sendPhoneNumberRenewalFailed(to: string, o: { number: string; amount: string; graceUntil: Date; url: string }) {
  return send(to, t.phoneNumberRenewalFailed(o));
}
