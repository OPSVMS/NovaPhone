import { NextResponse } from "next/server";
import { getUser } from "@/lib/session";
import { getMessages, getUserNumber } from "@/lib/numbers";

/** Bandeja de SMS del usuario (para refresco en vivo desde el panel). */
export async function GET() {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const number = await getUserNumber(user.id);
  if (!number) return NextResponse.json({ number: null, messages: [] });
  const messages = await getMessages(number.id, user.id);
  return NextResponse.json({
    number: number.e164,
    messages: messages.map((m) => ({ id: m.id, from: m.fromNumber, body: m.body, receivedAt: m.receivedAt })),
  });
}
