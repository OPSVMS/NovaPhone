/**
 * Sistema de diseño de correos NovaPhone.
 *
 * Cada bloque devuelve `{ html, text }` para que la versión de texto plano salga
 * siempre del mismo contenido que la HTML. Todo string interpolado se escapa
 * (usa `rich\`…\`` para mezclar texto con énfasis/enlaces de forma segura).
 *
 * HTML compatible con clientes de correo: tablas, estilos en línea, `bgcolor`
 * como respaldo para clientes que ignoran CSS, y tema oscuro de marca.
 */

export type Block = { html: string; text: string };
export type Email = { subject: string; html: string; text: string };
type Inline = string | number | Block;

// ─── Tokens ──────────────────────────────────────────────────────────────────

export const c = {
  bg: "#07050D",
  surface: "#0E0A18",
  surface2: "#151024",
  surface3: "#1D1731",
  border: "#231C36",
  borderStrong: "#2E2550",
  fg: "#F5F3FF",
  muted: "#A39DB8",
  subtle: "#7A7393",
  primary: "#7652F0",
  lavender: "#A78BFA",
  lavenderSoft: "#C4B5FD",
  accent: "#7DE3F4",
} as const;

const tones = {
  info: { bg: "#141029", border: "#2E2560", fg: c.lavenderSoft, dot: c.lavender },
  success: { bg: "#0D1A19", border: "#1B4237", fg: "#6EE7B7", dot: "#34D399" },
  warning: { bg: "#1C1712", border: "#4A3916", fg: "#FCD34D", dot: "#FBBF24" },
  danger: { bg: "#1D1017", border: "#4C2029", fg: "#FCA5A5", dot: "#F87171" },
} as const;
export type Tone = keyof typeof tones;

const SANS = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";
const DISPLAY = `'Sora',${SANS}`;
const MONO = "'Geist Mono',ui-monospace,SFMono-Regular,Menlo,Consolas,'Liberation Mono',monospace";

export const SUPPORT_EMAIL = "hola@novaphone.lat";

/** URL pública de la app (sin "/" final). */
export function appUrl() {
  return (process.env.APP_URL || "https://novaphone.lat").replace(/\/+$/, "");
}

/** Base para imágenes del correo: nunca localhost (los clientes de correo no pueden cargarlo). */
function assetsUrl() {
  const override = process.env.EMAIL_ASSETS_URL;
  if (override) return override.replace(/\/+$/, "");
  const base = appUrl();
  return /localhost|127\.0\.0\.1|0\.0\.0\.0/.test(base) ? "https://novaphone.lat" : base;
}

// ─── Escape + texto enriquecido ──────────────────────────────────────────────

export function esc(v: unknown): string {
  return String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Escapa un valor para un atributo href/src. Solo permite http(s), mailto, cid y data:image. */
export function escUrl(u: string): string {
  const s = String(u ?? "").trim();
  if (/^(https?:|mailto:|cid:|data:image\/(png|jpe?g|gif|webp);base64,)/i.test(s)) return esc(s);
  if (s.startsWith("/")) return esc(appUrl() + s);
  return "#";
}

const isBlock = (v: unknown): v is Block => typeof v === "object" && v !== null && "html" in v && "text" in v;
const htmlOf = (v: Inline) => (isBlock(v) ? v.html : esc(v));
const textOf = (v: Inline) => (isBlock(v) ? v.text : String(v));

/** Plantilla etiquetada: los strings interpolados se escapan; los `Block` se insertan tal cual. */
export function rich(strings: TemplateStringsArray, ...vals: Inline[]): Block {
  let html = "";
  let text = "";
  strings.forEach((s, i) => {
    html += esc(s);
    text += s;
    if (i < vals.length) {
      html += htmlOf(vals[i]);
      text += textOf(vals[i]);
    }
  });
  return { html, text };
}

export const strong = (v: Inline): Block => ({
  html: `<strong style="color:${c.fg};font-weight:600">${htmlOf(v)}</strong>`,
  text: textOf(v),
});

export const link = (label: Inline, href: string): Block => ({
  html: `<a href="${escUrl(href)}" style="color:${c.lavender};text-decoration:underline;text-underline-offset:3px">${htmlOf(label)}</a>`,
  text: href.startsWith("mailto:") ? textOf(label) : `${textOf(label)} (${href.startsWith("/") ? appUrl() + href : href})`,
});

export const mono = (v: Inline): Block => ({
  html: `<span style="font-family:${MONO};color:${c.fg}">${htmlOf(v)}</span>`,
  text: textOf(v),
});

const toBlock = (v: Inline) => (isBlock(v) ? v : rich`${v}`);

// ─── Bloques ─────────────────────────────────────────────────────────────────

const row = (inner: string, pad = "0 0 20px") => `<tr><td style="padding:${pad}">${inner}</td></tr>`;

export function p(v: Inline, o: { size?: number; color?: string; pad?: string; align?: "left" | "center" } = {}): Block {
  const b = toBlock(v);
  return {
    html: row(
      `<p style="margin:0;font-family:${SANS};font-size:${o.size ?? 15}px;line-height:1.65;color:${o.color ?? c.muted};text-align:${o.align ?? "left"}">${b.html}</p>`,
      o.pad,
    ),
    text: b.text,
  };
}

export const small = (v: Inline, align: "left" | "center" = "left") => p(v, { size: 13, color: c.subtle, align });

export function button(label: string, href: string, o: { variant?: "primary" | "secondary"; pad?: string } = {}): Block {
  const primary = (o.variant ?? "primary") === "primary";
  const bg = primary ? c.primary : c.surface2;
  const border = primary ? c.primary : c.borderStrong;
  const color = primary ? "#FFFFFF" : c.fg;
  const url = escUrl(href);
  return {
    html: row(
      `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td align="center" bgcolor="${bg}" class="np-btn" style="border-radius:14px;background:${bg};border:1px solid ${border};${primary ? "box-shadow:0 8px 24px -8px rgba(118,82,240,.65);" : ""}">
<!--[if mso]><v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" href="${url}" style="height:50px;v-text-anchor:middle;width:456px" arcsize="28%" stroke="f" fillcolor="${bg}"><center style="color:${color};font-family:Arial,sans-serif;font-size:15px;font-weight:bold">${esc(label)}</center></v:roundrect><![endif]-->
<!--[if !mso]><!--><a href="${url}" target="_blank" style="display:block;padding:15px 24px;font-family:${SANS};font-size:15px;font-weight:600;line-height:20px;color:${color};text-decoration:none;border-radius:14px;mso-hide:all">${esc(label)}</a><!--<![endif]-->
</td></tr></table>`,
      o.pad ?? "4px 0 24px",
    ),
    text: `${label}: ${href.startsWith("/") ? appUrl() + href : href}`,
  };
}

/** Código grande (OTP / SMS). */
export function code(value: string, caption?: string): Block {
  return {
    html: row(
      `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td align="center" bgcolor="${c.surface2}" style="background:${c.surface2};border:1px solid ${c.borderStrong};border-radius:18px;padding:22px 12px">
${caption ? `<div style="font-family:${SANS};font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:${c.subtle};padding-bottom:10px">${esc(caption)}</div>` : ""}
<div class="np-code" style="font-family:${MONO};font-size:36px;line-height:44px;font-weight:600;letter-spacing:10px;color:${c.lavenderSoft};padding-left:10px">${esc(value)}</div>
</td></tr></table>`,
      "4px 0 24px",
    ),
    text: `${caption ? `${caption}: ` : ""}${value}`,
  };
}

export type InfoRow = { label: string; value: Inline; mono?: boolean; strong?: boolean; stack?: boolean };

/** Filas etiqueta/valor dentro de una tarjeta. `stack` pone el valor debajo (para valores largos). */
export function info(rows: (InfoRow | null | false | undefined)[], title?: string): Block {
  const list = rows.filter(Boolean) as InfoRow[];
  const cells = list
    .map((r, i) => {
      const top = i === 0 ? "" : `border-top:1px solid ${c.border};`;
      const val = toBlock(r.value).html;
      const valStyle = `font-family:${r.mono ? MONO : SANS};font-size:${r.strong ? 16 : 14}px;line-height:1.45;color:${c.fg};font-weight:${r.strong ? 600 : 500};overflow-wrap:anywhere;word-break:break-word`;
      if (r.stack)
        return `<tr><td colspan="2" style="${top}padding:12px 0">
<div style="font-family:${SANS};font-size:13px;color:${c.muted};padding-bottom:4px">${esc(r.label)}</div>
<div style="${valStyle}">${val}</div></td></tr>`;
      return `<tr><td valign="top" style="${top}padding:12px 12px 12px 0;font-family:${SANS};font-size:13px;line-height:1.45;color:${c.muted};white-space:nowrap">${esc(r.label)}</td>
<td valign="top" align="right" style="${top}padding:12px 0;text-align:right;${valStyle};word-break:normal">${val}</td></tr>`;
    })
    .join("");
  const head = title
    ? `<div style="font-family:${SANS};font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:${c.subtle};padding:16px 0 2px">${esc(title)}</div>`
    : "";
  return {
    html: row(
      `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td bgcolor="${c.surface2}" style="background:${c.surface2};border:1px solid ${c.border};border-radius:18px;padding:${title ? "0" : "4px"} 18px 4px">${head}<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${cells}</table></td></tr></table>`,
      "4px 0 24px",
    ),
    text: [title ? title.toUpperCase() : null, ...list.map((r) => `${r.label}: ${toBlock(r.value).text}`)].filter(Boolean).join("\n"),
  };
}

/** Pasos numerados. */
export function steps(items: { title: string; body?: Inline }[], title?: string): Block {
  const html = items
    .map(
      (s, i) => `<tr><td valign="top" width="40" style="padding:${i ? 14 : 0}px 0 0">
<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td align="center" valign="middle" width="28" height="28" bgcolor="${c.surface3}" style="width:28px;height:28px;border-radius:14px;background:${c.surface3};border:1px solid ${c.borderStrong};font-family:${SANS};font-size:13px;font-weight:600;color:${c.lavenderSoft};line-height:28px">${i + 1}</td></tr></table></td>
<td valign="top" style="padding:${i ? 14 : 0}px 0 0">
<div style="font-family:${SANS};font-size:15px;line-height:1.4;font-weight:600;color:${c.fg};padding-top:4px">${esc(s.title)}</div>
${s.body !== undefined ? `<div style="font-family:${SANS};font-size:14px;line-height:1.55;color:${c.muted};padding-top:3px">${toBlock(s.body).html}</div>` : ""}
</td></tr>`,
    )
    .join("");
  const head = title
    ? `<div style="font-family:${SANS};font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:${c.subtle};padding-bottom:14px">${esc(title)}</div>`
    : "";
  return {
    html: row(`${head}<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${html}</table>`, "4px 0 24px"),
    text: [title ? title.toUpperCase() : null, ...items.map((s, i) => `${i + 1}. ${s.title}${s.body !== undefined ? ` — ${toBlock(s.body).text}` : ""}`)]
      .filter(Boolean)
      .join("\n"),
  };
}

/** Aviso con tono (info/success/warning/danger). */
export function callout(tone: Tone, v: Inline, title?: string): Block {
  const t = tones[tone];
  const b = toBlock(v);
  return {
    html: row(
      `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td bgcolor="${t.bg}" style="background:${t.bg};border:1px solid ${t.border};border-radius:16px;padding:14px 16px">
${title ? `<div style="font-family:${SANS};font-size:14px;font-weight:600;color:${t.fg};padding-bottom:4px"><span style="color:${t.dot}">&#9679;</span>&nbsp; ${esc(title)}</div>` : ""}
<div style="font-family:${SANS};font-size:14px;line-height:1.55;color:${c.muted}">${b.html}</div></td></tr></table>`,
      "4px 0 24px",
    ),
    text: `${title ? `${title}: ` : ""}${b.text}`,
  };
}

/** Imagen centrada (QR). `src` debe ser http(s), cid: o data:image. */
export function image(src: string, o: { alt: string; width: number; height: number; caption?: string }): Block {
  return {
    html: row(
      `<table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center"><tr><td align="center" bgcolor="#FFFFFF" style="background:#FFFFFF;border-radius:20px;padding:14px">
<img src="${escUrl(src)}" width="${o.width}" height="${o.height}" alt="${esc(o.alt)}" style="display:block;width:${o.width}px;height:${o.height}px;border:0;outline:none"/></td></tr></table>
${o.caption ? `<p style="margin:12px 0 0;font-family:${SANS};font-size:13px;color:${c.subtle};text-align:center">${esc(o.caption)}</p>` : ""}`,
      "4px 0 24px",
    ),
    text: o.caption ?? "",
  };
}

export function divider(): Block {
  return {
    html: row(`<div style="height:1px;line-height:1px;font-size:1px;background:${c.border}">&nbsp;</div>`, "4px 0 24px"),
    text: "—",
  };
}

/** Bloque de valor copiable grande (CLABE, dirección USDT). */
export function copyable(label: string, value: string, hint?: string): Block {
  return {
    html: row(
      `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td bgcolor="${c.surface2}" style="background:${c.surface2};border:1px solid ${c.borderStrong};border-radius:18px;padding:16px 18px">
<div style="font-family:${SANS};font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:${c.subtle};padding-bottom:6px">${esc(label)}</div>
<div style="font-family:${MONO};font-size:20px;line-height:1.4;font-weight:600;letter-spacing:.04em;color:${c.fg};word-break:break-all">${esc(value)}</div>
${hint ? `<div style="font-family:${SANS};font-size:13px;color:${c.muted};padding-top:6px">${esc(hint)}</div>` : ""}</td></tr></table>`,
      "4px 0 16px",
    ),
    text: `${label}: ${value}${hint ? ` (${hint})` : ""}`,
  };
}

/** Pareja de enlaces secundarios centrados bajo el CTA. */
export function links(items: { label: string; href: string }[]): Block {
  return {
    html: row(
      `<p style="margin:0;font-family:${SANS};font-size:14px;text-align:center;color:${c.subtle}">${items
        .map((l) => `<a href="${escUrl(l.href)}" style="color:${c.lavender};text-decoration:none;font-weight:500">${esc(l.label)}</a>`)
        .join(`&nbsp;&nbsp;·&nbsp;&nbsp;`)}</p>`,
      "0 0 24px",
    ),
    text: items.map((l) => `${l.label}: ${l.href.startsWith("/") ? appUrl() + l.href : l.href}`).join("\n"),
  };
}

// ─── Layout ──────────────────────────────────────────────────────────────────

export type LayoutOptions = {
  subject: string;
  /** Texto de vista previa en la bandeja (oculto en el cuerpo). */
  preheader: string;
  /** Etiqueta pequeña sobre el título (p. ej. "Seguridad"). */
  eyebrow?: string;
  /** Tono del eyebrow. */
  tone?: Tone | "brand";
  title: string;
  blocks: (Block | null | false | undefined)[];
  /** Línea extra en el pie (por qué recibes este correo). */
  reason?: string;
};

export function layout(o: LayoutOptions): Email {
  const blocks = o.blocks.filter(Boolean) as Block[];
  const base = appUrl();
  const assets = assetsUrl();
  const eyebrowColor = !o.tone || o.tone === "brand" ? c.lavender : tones[o.tone].dot;
  const reason = o.reason ?? "Recibes este correo porque tienes una cuenta en NovaPhone.";
  // Relleno invisible para que el cliente no muestre el cuerpo después del preheader.
  const filler = "&#847;&zwnj;&nbsp;".repeat(80);

  const html = `<!DOCTYPE html>
<html lang="es-MX" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="X-UA-Compatible" content="IE=edge">
<meta name="x-apple-disable-message-reformatting">
<meta name="format-detection" content="telephone=no,date=no,address=no,email=no,url=no">
<meta name="color-scheme" content="dark light">
<meta name="supported-color-schemes" content="dark light">
<title>${esc(o.subject)}</title>
<!--[if mso]><noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript><![endif]-->
<link href="https://fonts.googleapis.com/css2?family=Sora:wght@600&family=Geist+Mono:wght@500;600&display=swap" rel="stylesheet">
<style>
:root{color-scheme:dark light;supported-color-schemes:dark light}
body{margin:0!important;padding:0!important;width:100%!important;background:${c.bg}}
table{border-collapse:separate}
img{border:0;line-height:100%;outline:none;text-decoration:none;-ms-interpolation-mode:bicubic}
a[x-apple-data-detectors]{color:inherit!important;text-decoration:none!important}
u+#body a{color:inherit;text-decoration:none}
@media (max-width:560px){
  .np-outer{padding:20px 10px 28px!important}
  .np-card{padding:28px 20px 8px!important;border-radius:22px!important}
  .np-title{font-size:23px!important;line-height:30px!important}
  .np-code{font-size:30px!important;letter-spacing:7px!important}
}
/* Outlook.com en modo oscuro: conserva colores de marca. */
[data-ogsc] .np-fg{color:${c.fg}!important}
[data-ogsb] .np-bg{background:${c.bg}!important}
</style>
</head>
<body id="body" class="np-bg" bgcolor="${c.bg}" style="margin:0;padding:0;background:${c.bg};-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%">
<div style="display:none;max-height:0;max-width:0;overflow:hidden;opacity:0;mso-hide:all;font-size:1px;line-height:1px;color:${c.bg}">${esc(o.preheader)}${filler}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${c.bg}" class="np-bg" style="background:${c.bg}">
<tr><td align="center" class="np-outer" style="padding:36px 16px 40px">
<!--[if mso]><table role="presentation" width="520" cellpadding="0" cellspacing="0" border="0" align="center"><tr><td><![endif]-->
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:520px;margin:0 auto">
<tr><td style="padding:0 4px 24px">
  <a href="${esc(base)}" target="_blank" style="text-decoration:none"><img src="${esc(assets)}/email/logo.png" width="172" height="26" alt="NovaPhone" style="display:block;width:172px;height:26px;border:0;color:${c.fg};font-family:${DISPLAY};font-size:20px;font-weight:600"></a>
</td></tr>
<tr><td bgcolor="${c.surface}" class="np-card" style="background:${c.surface};background-image:linear-gradient(180deg,#151030 0%,${c.surface} 160px);border:1px solid ${c.border};border-radius:26px;padding:36px 32px 12px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
${o.eyebrow ? `<tr><td style="padding:0 0 12px;font-family:${SANS};font-size:12px;font-weight:600;letter-spacing:.14em;text-transform:uppercase;color:${eyebrowColor}">${esc(o.eyebrow)}</td></tr>` : ""}
<tr><td style="padding:0 0 16px"><h1 class="np-title np-fg" style="margin:0;font-family:${DISPLAY};font-size:26px;line-height:34px;font-weight:600;letter-spacing:-0.02em;color:${c.fg}">${esc(o.title)}</h1></td></tr>
${blocks.map((b) => b.html).join("\n")}
</table>
</td></tr>
<tr><td style="padding:28px 8px 0;font-family:${SANS};font-size:13px;line-height:1.6;color:${c.subtle};text-align:center">
  ¿Dudas? Responde a este correo o escríbenos a <a href="mailto:${SUPPORT_EMAIL}" style="color:${c.muted};text-decoration:underline">${SUPPORT_EMAIL}</a>
</td></tr>
<tr><td style="padding:16px 8px 0;font-family:${SANS};font-size:13px;text-align:center">
  <a href="${esc(base)}/app" style="color:${c.muted};text-decoration:none">Mi cuenta</a>&nbsp;&nbsp;<span style="color:${c.border}">|</span>&nbsp;&nbsp;<a href="${esc(base)}" style="color:${c.muted};text-decoration:none">novaphone.lat</a>&nbsp;&nbsp;<span style="color:${c.border}">|</span>&nbsp;&nbsp;<a href="${esc(base)}/privacidad" style="color:${c.muted};text-decoration:none">Privacidad</a>
</td></tr>
<tr><td style="padding:20px 8px 0;font-family:${SANS};font-size:12px;line-height:1.6;color:${c.subtle};text-align:center">
  <img src="${esc(assets)}/email/mark.png" width="24" height="24" alt="" style="display:inline-block;width:24px;height:24px;border:0;border-radius:6px;vertical-align:middle"><br><br>
  NovaPhone · eSIM de datos para México<br>${esc(reason)}
</td></tr>
</table>
<!--[if mso]></td></tr></table><![endif]-->
</td></tr></table>
</body>
</html>`;

  const text = [
    "NovaPhone",
    "",
    o.title,
    "=".repeat(Math.min(o.title.length, 60)),
    "",
    ...blocks.map((b) => b.text).filter((t) => t.trim()).flatMap((t) => [t, ""]),
    "—",
    `¿Dudas? Responde a este correo o escríbenos a ${SUPPORT_EMAIL}`,
    `Mi cuenta: ${base}/app`,
    "",
    "NovaPhone · eSIM de datos para México",
    base.replace(/^https?:\/\//, ""),
    reason,
  ].join("\n");

  return { subject: o.subject, html, text };
}
