import { NextResponse, type NextRequest } from "next/server";
import { getUser } from "@/lib/session";
import { getUserNumber } from "@/lib/numbers";
import { getCommsHistory, parseLimit } from "../history";

/**
 * Historial del número del usuario (refresco en vivo desde el panel).
 * `?limit=` (1–200, por defecto 200) aplica a mensajes y a llamadas por separado.
 */
export async function GET(req: NextRequest) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const number = await getUserNumber(user.id);
  if (!number) {
    return NextResponse.json({ number: null, messages: [], calls: [], counts: { messages: 0, calls: 0 } });
  }
  const history = await getCommsHistory(number.id, user.id, parseLimit(req.nextUrl.searchParams.get("limit")));
  return NextResponse.json({ number: number.e164, ...history }, { headers: { "Cache-Control": "no-store" } });
}
