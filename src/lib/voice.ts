import "server-only";
import { and, eq, sql as dsql } from "drizzle-orm";
import { db, schema } from "@/db";
import { normalizeE164 } from "./numbers";
import { extractMenuKey, extractSpokenCode } from "./spoken-code";
import { sendSmsReceived } from "./email";

/**
 * Llamadas a números NovaPhone vía Telnyx Voice API:
 * cloudnumbering → sip:%e164@<subdominio>.sip.telnyx.com → Telnyx contesta, transcribe y nos manda webhooks.
 */
const BASE = () => process.env.TELNYX_BASE_URL ?? "https://api.telnyx.com/v2";
export const telnyxEnabled = () => !!process.env.TELNYX_API_KEY;
const subdomain = () => process.env.TELNYX_SIP_SUBDOMAIN ?? "novaphone";
export const voiceSipUri = () => `sip:%e164@${subdomain()}.sip.telnyx.com`;

async function telnyx<T>(method: "GET" | "POST" | "PATCH", path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${BASE()}${path}`, {
    method,
    headers: { Authorization: `Bearer ${process.env.TELNYX_API_KEY}`, "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store",
    signal: AbortSignal.timeout(15_000),
  });
  const json = (await res.json().catch(() => ({}))) as { data?: T; errors?: { detail?: string; title?: string }[] };
  if (!res.ok) throw new Error(`Telnyx ${method} ${path}: ${res.status} ${json.errors?.map((e) => e.detail ?? e.title).join("; ") ?? ""}`);
  return json.data as T;
}

const webhookUrl = () => `${process.env.APP_URL}/api/webhooks/telnyx?token=${process.env.TELNYX_WEBHOOK_TOKEN}`;

/** Crea/actualiza la aplicación de voz en Telnyx con el subdominio SIP abierto a cualquier origen. */
export async function ensureTelnyxApp() {
  const apps = await telnyx<{ id: string; application_name: string }[]>("GET", "/call_control_applications?page[size]=100");
  const config = {
    application_name: "NovaPhone voz",
    webhook_event_url: webhookUrl(),
    webhook_api_version: "2",
    active: true,
    inbound: { sip_subdomain: subdomain(), sip_subdomain_receive_settings: "from_anyone", channel_limit: 20 },
  };
  const existing = apps.find((a) => a.application_name === config.application_name);
  const app = existing
    ? await telnyx<{ id: string }>("PATCH", `/call_control_applications/${existing.id}`, config)
    : await telnyx<{ id: string }>("POST", "/call_control_applications", config);
  return app.id;
}

/** Configura todo el ruteo de voz: app en Telnyx + endpoint de voz en cloudnumbering asignado a cada número. */
export async function ensureVoiceRouting() {
  const appId = await ensureTelnyxApp();
  const { ensureVoiceEndpoint, routeAllNumbersVoice } = await import("./cloudnumbering");
  const endpointSid = await ensureVoiceEndpoint(voiceSipUri());
  const routed = await routeAllNumbersVoice(endpointSid);
  return { appId, endpointSid, routed, sipUri: voiceSipUri() };
}

type TelnyxEvent = {
  data?: {
    event_type?: string;
    id?: string;
    occurred_at?: string;
    payload?: {
      call_control_id?: string;
      call_session_id?: string;
      direction?: string;
      from?: string;
      to?: string;
      state?: string;
      start_time?: string;
      end_time?: string;
      hangup_cause?: string;
      transcription_data?: { transcript?: string; is_final?: boolean };
    };
  };
};

/** "sip:+447428523385@novaphone.sip.telnyx.com" → "+447428523385" */
function sipUser(v?: string) {
  if (!v) return "";
  const m = v.match(/^(?:sips?:)?([^@;>]+)/i);
  return (m ? m[1] : v).replace(/^<|>$/g, "").trim();
}

async function command(callControlId: string, action: string, body: Record<string, unknown> = {}) {
  return telnyx("POST", `/calls/${encodeURIComponent(callControlId)}/actions/${action}`, body);
}

/** Procesa un webhook de Telnyx Voice API. */
export async function handleTelnyxEvent(evt: TelnyxEvent) {
  const type = evt.data?.event_type;
  const p = evt.data?.payload ?? {};
  const ccid = p.call_control_id;
  const session = p.call_session_id ?? ccid;
  if (!type || !ccid || !session) return "ignored";
  const externalId = `telnyx:${session}`;

  if (type === "call.initiated") {
    if (p.direction && p.direction !== "incoming") return "ignored";
    const to = normalizeE164(sipUser(p.to));
    const number = await db.query.phoneNumbers.findFirst({ where: eq(schema.phoneNumbers.e164, to) });
    if (!number) {
      await command(ccid, "reject", { cause: "USER_BUSY" }).catch(() => null);
      return "unknown-number";
    }
    await db
      .insert(schema.callLogs)
      .values({ numberId: number.id, userId: number.userId, fromNumber: sipUser(p.from) || "desconocido", toNumber: to, status: "missed", externalId })
      .onConflictDoNothing();
    await command(ccid, "answer", { client_state: Buffer.from(to).toString("base64") });
    return "answering";
  }

  if (type === "call.answered") {
    await db.update(schema.callLogs).set({ status: "answered", answeredAt: new Date() }).where(eq(schema.callLogs.externalId, externalId));
    // Detección automática de idioma (WhatsApp dicta en el idioma del teléfono). Si el motor no está disponible, usa Telnyx.
    await command(ccid, "transcription_start", {
      transcription_engine: "Soniox",
      transcription_engine_config: { transcription_model: "soniox/stt-rt-v4" },
      transcription_tracks: "inbound",
    }).catch(() => command(ccid, "transcription_start", { transcription_engine: "Telnyx", language: "es", transcription_tracks: "inbound" }));
    return "transcribing";
  }

  if (type === "call.transcription") {
    const t = p.transcription_data;
    if (!t?.transcript || t.is_final === false) return "partial";
    const [row] = await db
      .update(schema.callLogs)
      .set({ transcript: dsql`trim(coalesce(${schema.callLogs.transcript}, '') || ' ' || ${t.transcript})` })
      .where(eq(schema.callLogs.externalId, externalId))
      .returning();
    if (!row) return "unknown-call";
    const code = extractSpokenCode(row.transcript ?? "");
    // Menú de voz ("pulsa 4", "press 1", "aperte #"): marcamos la tecla y seguimos escuchando.
    // Se permiten varias teclas por llamada (menús de varios pasos), sin repetir la misma en menos de 8 s.
    if (!code) {
      const key = extractMenuKey(t.transcript);
      if (key) {
        const sent = (row.dtmfSent ?? "").split(",").filter(Boolean).map((x) => {
          const [k, at] = x.split("@");
          return { k, at: Number(at) };
        });
        const last = sent.at(-1);
        const now = Date.now();
        if (sent.length < 4 && !(last && last.k === key && now - last.at < 8_000)) {
          const next = [...sent.map((x) => `${x.k}@${x.at}`), `${key}@${now}`].join(",");
          const [claimed] = await db
            .update(schema.callLogs)
            .set({ dtmfSent: next })
            .where(and(eq(schema.callLogs.id, row.id), row.dtmfSent ? eq(schema.callLogs.dtmfSent, row.dtmfSent) : dsql`${schema.callLogs.dtmfSent} is null`))
            .returning();
          if (claimed) await command(ccid, "send_dtmf", { digits: key, duration_millis: 250 }).catch((e) => console.error("dtmf", e));
          return "dtmf";
        }
      }
    }
    // Avisamos con un código completo de 6+ dígitos (o el que haya al colgar), para no cortar uno a medias.
    if (code && code.length >= 6 && !row.notifiedAt) {
      const [claimed] = await db
        .update(schema.callLogs)
        .set({ code, notifiedAt: new Date() })
        .where(and(eq(schema.callLogs.id, row.id), dsql`${schema.callLogs.notifiedAt} is null`))
        .returning();
      if (claimed && claimed.userId) {
        const user = await db.query.users.findFirst({ where: eq(schema.users.id, claimed.userId) });
        if (user) {
          await sendSmsReceived(user.email, {
            number: claimed.toNumber,
            from: `Llamada de ${claimed.fromNumber}`,
            body: `Código dictado por llamada: ${code}. Transcripción: ${row.transcript}`,
            url: `${process.env.APP_URL ?? ""}/app/numero`,
          });
        }
      }
      // Ya tenemos el código: colgamos para no consumir minutos.
      await command(ccid, "hangup").catch(() => null);
    }
    return code ? "code" : "transcript";
  }

  if (type === "call.hangup") {
    const row = await db.query.callLogs.findFirst({ where: eq(schema.callLogs.externalId, externalId) });
    if (!row) return "unknown-call";
    // Código corto (4–5 dígitos) que no se avisó durante la llamada: se avisa al terminar.
    const finalCode = row.code ?? (row.transcript ? extractSpokenCode(row.transcript) : null);
    if (finalCode && !row.notifiedAt && row.userId) {
      const [claimed] = await db
        .update(schema.callLogs)
        .set({ notifiedAt: new Date(), code: finalCode })
        .where(and(eq(schema.callLogs.id, row.id), dsql`${schema.callLogs.notifiedAt} is null`))
        .returning();
      const user = claimed ? await db.query.users.findFirst({ where: eq(schema.users.id, row.userId) }) : null;
      if (user) {
        await sendSmsReceived(user.email, {
          number: row.toNumber,
          from: `Llamada de ${row.fromNumber}`,
          body: `Código dictado por llamada: ${finalCode}. Transcripción: ${row.transcript}`,
          url: `${process.env.APP_URL ?? ""}/app/numero`,
        });
      }
    }
    const start = row.answeredAt ?? (p.start_time ? new Date(p.start_time) : null);
    const end = p.end_time ? new Date(p.end_time) : new Date();
    await db
      .update(schema.callLogs)
      .set({
        durationSec: start ? Math.max(0, Math.round((end.getTime() - start.getTime()) / 1000)) : 0,
        code: row.code ?? (row.transcript ? extractSpokenCode(row.transcript) : null),
      })
      .where(eq(schema.callLogs.id, row.id));
    return "hangup";
  }
  return "ignored";
}
