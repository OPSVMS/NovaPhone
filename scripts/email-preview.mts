/**
 * Renderiza todas las plantillas de correo con datos de ejemplo en email-previews/*.html (y .txt).
 *   pnpm exec tsx scripts/email-preview.mts
 * Las imágenes se cargan desde public/ local (EMAIL_ASSETS_URL=file://…).
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import QRCode from "qrcode";

const root = resolve(import.meta.dirname, "..");
process.env.APP_URL ??= "https://novaphone.lat";
process.env.EMAIL_ASSETS_URL ??= pathToFileURL(resolve(root, "public")).href;

const t = await import("../src/emails/templates.ts");

const lpa = "LPA:1$rsp-eu.simlessly.com$JQ-209U6H-3WKVZ1";
const qr = await QRCode.toDataURL(lpa, { margin: 0, width: 400, color: { dark: "#0E0A18", light: "#FFFFFF" } });
const in3d = new Date(Date.now() + 3 * 86_400_000);
const orderId = "7f3c2a91-5b8e-4d1a-9c2f-0e6b7a8d9c10";

const emails: Record<string, ReturnType<typeof t.welcome>> = {
  "01-verification-code": t.verificationCode("482913"),
  "02-welcome": t.welcome("Ana López"),
  "03-esim-ready": t.esimReady({ planName: "México 10 GB · 30 días", activationCode: lpa, orderUrl: `https://novaphone.lat/app/esims/${orderId}`, qrSrc: qr }),
  "04-deposit-credited": t.depositCredited("$500.00 MXN"),
  "05-deposit-requested-spei": t.depositRequested({ method: "spei", amount: "$500.00 MXN", reference: "NP4F7K2Q", depositUrl: "https://novaphone.lat/app/fondos", clabe: "646180157000000004", bank: "STP", beneficiary: "NovaPhone SA de CV" }),
  "06-deposit-requested-usdt": t.depositRequested({ method: "usdt", amount: "$500.00 MXN", reference: "NP9X1M3D", depositUrl: "https://novaphone.lat/app/fondos", usdtAmount: "27.84", usdtAddress: "TQ5nVb1p8kq3sN7yW9xR2mHc4fJ6dL8aZe", usdtNetwork: "TRON (TRC-20)" }),
  "07-deposit-requested-card": t.depositRequested({ method: "card", amount: "$300.00 MXN", reference: "NP2B8C4E", depositUrl: "https://novaphone.lat/app/fondos" }),
  "08-personal-clabe": t.personalClabeReady({ clabe: "646180157012345678", beneficiary: "Ana López", url: "https://novaphone.lat/app/fondos" }),
  "09-topup-applied": t.topupApplied({ planName: "México 10 GB · 30 días", topupName: "+5 GB · 15 días", amount: "$149.00 MXN", orderId }),
  "10-auto-topup-done": t.autoTopupDone("México 10 GB · 30 días", orderId),
  "11-auto-topup-no-funds": t.autoTopupNoFunds("México 10 GB · 30 días", "$199.00 MXN", orderId),
  "12-low-data": t.lowData("México 10 GB · 30 días", 480 * 1024 ** 2, orderId),
  "13-expiring-soon": t.expiringSoon("México 10 GB · 30 días", in3d, orderId),
  "14-password-reset-code": t.passwordResetCode("730154"),
  "15-password-changed": t.passwordChanged(),
  "16-phone-number-ready": t.phoneNumberReady({ number: "+52 55 4123 8890", monthly: "$49.00 MXN", renewsAt: new Date(Date.now() + 30 * 86_400_000), url: "https://novaphone.lat/app/numeros" }),
  "17-sms-received-code": t.smsReceived({ number: "+52 55 4123 8890", from: "WhatsApp", body: "Tu código de WhatsApp: 418-206. No compartas este código.", url: "https://novaphone.lat/app/numeros" }),
  "18-sms-received-text": t.smsReceived({ number: "+52 55 4123 8890", from: "+52 33 1234 5678", body: "Hola <b>Ana</b>, tu paquete llega mañana entre 9 y 14 h. ¡Gracias!", url: "https://novaphone.lat/app/numeros" }),
  "19-phone-renewal-failed": t.phoneNumberRenewalFailed({ number: "+52 55 4123 8890", amount: "$49.00 MXN", graceUntil: in3d, url: "https://novaphone.lat/app/numeros" }),
};

const out = resolve(root, "email-previews");
mkdirSync(out, { recursive: true });
const index: string[] = [];
for (const [name, e] of Object.entries(emails)) {
  writeFileSync(resolve(out, `${name}.html`), e.html);
  writeFileSync(resolve(out, `${name}.txt`), `Asunto: ${e.subject}\n\n${e.text}\n`);
  index.push(`<li><a href="${name}.html">${name}</a> — ${e.subject.replace(/</g, "&lt;")} (<a href="${name}.txt">txt</a>)</li>`);
}
writeFileSync(resolve(out, "index.html"), `<!doctype html><meta charset="utf-8"><title>NovaPhone emails</title><ul style="font-family:system-ui;line-height:2">${index.join("")}</ul>`);
console.log(`✓ ${Object.keys(emails).length} correos en ${out}`);
