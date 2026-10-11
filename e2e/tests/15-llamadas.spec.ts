import { test, expect } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { register, fundAccount, dbQuery, emailOf } from "./helpers";

const hook = (request: import("@playwright/test").APIRequestContext, data: unknown, token = process.env.TELNYX_WEBHOOK_TOKEN) =>
  request.post(`/api/webhooks/telnyx?token=${token}`, { data });
const evt = (event_type: string, payload: Record<string, unknown>) => ({ data: { event_type, id: randomUUID(), occurred_at: new Date().toISOString(), payload } });
const commands = async () => (await (await fetch(`${process.env.MOCK_URL}/__test/telnyx/commands`)).json()) as { ccid: string; action: string; body: Record<string, unknown> }[];

test("llamada de verificación: se contesta, se transcribe, se detecta el código y aparece en el panel", async ({ page, request }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "una vez basta");
  await register(page);
  await fundAccount(page, request, 100);
  // Número asignado sin depender del inventario (admin sin cobro).
  const e164 = `+44770095${String(Date.now()).slice(-4)}`;
  await dbQuery("insert into phone_numbers (e164, status, user_id, assigned_at, renews_at) select $1, 'assigned', id, now(), now() + interval '30 days' from users where email = $2", [e164, emailOf(page)]);

  expect((await hook(request, evt("call.initiated", {}), "bad")).status()).toBe(401);

  const ccid = `v3:${randomUUID()}`;
  const session = randomUUID();
  const base = { call_control_id: ccid, call_session_id: session, from: "+14155550123", to: `sip:${e164}@novaphone.sip.telnyx.com` };
  expect((await (await hook(request, evt("call.initiated", { ...base, direction: "incoming" }))).json()).result).toBe("answering");
  expect((await commands()).some((c) => c.ccid === ccid && c.action === "answer")).toBe(true);

  expect((await (await hook(request, evt("call.answered", base))).json()).result).toBe("transcribing");
  expect((await commands()).some((c) => c.ccid === ccid && c.action === "transcription_start")).toBe(true);

  // Menú de WhatsApp: el sistema marca la tecla solo.
  const menu = await hook(request, evt("call.transcription", { ...base, transcription_data: { transcript: "Para recibir tu código de verificación de WhatsApp, pulsa 4,", is_final: true } }));
  expect((await menu.json()).result).toBe("dtmf");
  expect((await commands()).some((c) => c.ccid === ccid && c.action === "send_dtmf" && c.body.digits === "4")).toBe(true);
  // Se repite el menú: no vuelve a marcar.
  expect((await (await hook(request, evt("call.transcription", { ...base, transcription_data: { transcript: "pulsa 4", is_final: true } }))).json()).result).not.toBe("dtmf");
  await hook(request, evt("call.transcription", { ...base, transcription_data: { transcript: "Tu código de WhatsApp es", is_final: true } }));
  const r = await hook(request, evt("call.transcription", { ...base, transcription_data: { transcript: "cuatro cuatro dos uno nueve cero", is_final: true } }));
  expect((await r.json()).result).toBe("code");
  // Con el código detectado colgamos para no gastar minutos.
  expect((await commands()).some((c) => c.ccid === ccid && c.action === "hangup")).toBe(true);
  await hook(request, evt("call.hangup", { ...base, end_time: new Date(Date.now() + 25_000).toISOString() }));

  const [call] = await dbQuery<{ code: string; status: string; notified_at: string | null; duration_sec: number }>(
    "select code, status, notified_at, duration_sec from call_logs where external_id = $1",
    [`telnyx:${session}`],
  );
  expect(call.code).toBe("442190");
  expect(call.status).toBe("answered");
  expect(call.notified_at).not.toBeNull();
  expect(call.duration_sec).toBeGreaterThanOrEqual(20);

  await page.goto("/app/numero");
  await page.getByRole("radio", { name: /Llamadas/ }).click();
  await expect(page.getByText(/442\s?190/).filter({ visible: true }).first()).toBeVisible();

  // Llamada a un número que no es nuestro: se rechaza.
  const other = { call_control_id: `v3:${randomUUID()}`, call_session_id: randomUUID(), from: "+1", to: "sip:+440000000000@novaphone.sip.telnyx.com", direction: "incoming" };
  expect((await (await hook(request, evt("call.initiated", other))).json()).result).toBe("unknown-number");
});
