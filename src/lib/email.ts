import "server-only";
import { Resend } from "resend";

export const emailEnabled = () => !!process.env.RESEND_API_KEY;

const shell = (title: string, body: string) => `<!doctype html><html><body style="margin:0;background:#0b0814;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#ece9f6">
<table width="100%" cellpadding="0" cellspacing="0" style="padding:32px 16px"><tr><td align="center">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#14101f;border:1px solid #2a2140;border-radius:20px;padding:32px">
<tr><td style="font-size:18px;font-weight:700;letter-spacing:-.02em;color:#fff">Nova<span style="color:#a78bfa">Phone</span></td></tr>
<tr><td style="padding-top:24px"><h1 style="margin:0 0 12px;font-size:22px;color:#fff">${title}</h1>${body}</td></tr>
<tr><td style="padding-top:28px;font-size:12px;color:#8b84a3">NovaPhone · Conectividad sin fronteras</td></tr>
</table></td></tr></table></body></html>`;

async function send(to: string, subject: string, html: string) {
  if (!emailEnabled()) {
    console.log(`[email deshabilitado] ${to} · ${subject}`);
    return;
  }
  const resend = new Resend(process.env.RESEND_API_KEY);
  const { error } = await resend.emails.send({ from: process.env.EMAIL_FROM ?? "NovaPhone <onboarding@resend.dev>", to, subject, html });
  if (error) console.error("Resend error", error);
}

export function sendVerificationCode(to: string, code: string) {
  return send(
    to,
    `${code} es tu código de NovaPhone`,
    shell(
      "Confirma tu correo",
      `<p style="color:#b8b2cc;line-height:1.6">Usa este código para activar tu cuenta. Expira en 15 minutos.</p>
       <div style="margin:20px 0;padding:18px;border-radius:14px;background:#1d1630;border:1px solid #3b2d63;text-align:center;font-size:32px;letter-spacing:10px;font-weight:700;color:#c4b5fd">${code}</div>`,
    ),
  );
}

export function sendEsimReady(to: string, o: { planName: string; activationCode: string; orderUrl: string; qrDataUrl: string }) {
  const apple = `https://esimsetup.apple.com/esim_qrcode_provisioning?carddata=${o.activationCode}`;
  const [, smdp, code] = o.activationCode.split("$");
  return send(
    to,
    `Tu eSIM ${o.planName} está lista`,
    shell(
      "Tu eSIM está lista ✦",
      `<p style="color:#b8b2cc;line-height:1.6">${o.planName}. Escanea el código desde otro dispositivo o instálala con un toque en iPhone.</p>
       <div style="text-align:center;margin:20px 0"><img src="${o.qrDataUrl}" width="200" height="200" alt="QR eSIM" style="border-radius:12px;background:#fff;padding:8px"/></div>
       <a href="${apple}" style="display:block;text-align:center;background:#8b5cf6;color:#fff;text-decoration:none;padding:14px;border-radius:12px;font-weight:600">Instalar en iPhone</a>
       <p style="color:#8b84a3;font-size:13px;line-height:1.6;margin-top:20px">Instalación manual<br/>SM-DP+: <b style="color:#ece9f6">${smdp}</b><br/>Código: <b style="color:#ece9f6">${code}</b></p>
       <p style="color:#8b84a3;font-size:13px">Activa <b>Roaming de datos</b> en esta línea. <a href="${o.orderUrl}" style="color:#a78bfa">Ver mi eSIM</a></p>`,
    ),
  );
}

export function sendDepositCredited(to: string, amount: string) {
  return send(to, `Recibimos tu depósito de ${amount}`, shell("Saldo acreditado", `<p style="color:#b8b2cc;line-height:1.6">Tu depósito de <b style="color:#fff">${amount}</b> ya está disponible en tu saldo NovaPhone.</p>`));
}
