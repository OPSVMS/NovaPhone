"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { Inbox, KeyRound, MessageCircle, PhoneCall } from "lucide-react";
import { CopyButton } from "@/components/ui/copy-button";
import { Card, CardContent, CardTitle } from "@/components/ui/card";
import { extractCode, formatPhone, nationalNumber, relativeTime } from "./format";

export type InboxMessage = { id: string; from: string; body: string; receivedAt: string };

const POLL_MS = 5_000;

/** Bandeja de SMS en vivo: consulta /api/numero/mensajes cada 5 s mientras la pestaña está visible. */
export function SmsInbox({ e164, initial, initialNow }: { e164: string; initial: InboxMessage[]; initialNow: number }) {
  const router = useRouter();
  const [messages, setMessages] = useState(initial);
  const [now, setNow] = useState(initialNow);
  const [fresh, setFresh] = useState<string | null>(null);
  const [announce, setAnnounce] = useState("");
  const known = useRef(new Set(initial.map((m) => m.id)));

  useEffect(() => {
    let alive = true;
    let ctrl: AbortController | null = null;

    async function poll() {
      if (document.visibilityState !== "visible") return;
      ctrl?.abort();
      ctrl = new AbortController();
      try {
        const res = await fetch("/api/numero/mensajes", { cache: "no-store", signal: ctrl.signal });
        if (!res.ok || !alive) return;
        const data = (await res.json()) as { number: string | null; messages: InboxMessage[] };
        if (!data.number) {
          // El número se liberó: recarga la página para mostrar el estado correcto.
          router.refresh();
          return;
        }
        const incoming = data.messages.filter((m) => !known.current.has(m.id));
        for (const m of data.messages) known.current.add(m.id);
        setMessages(data.messages);
        setNow(Date.now());
        if (incoming.length) {
          const latest = incoming[0];
          setFresh(latest.id);
          const code = extractCode(latest.body);
          setAnnounce(`Nuevo mensaje de ${latest.from}${code ? `. Código ${code.split("").join(" ")}` : ""}`);
        }
      } catch {
        /* red caída o abortado: se reintenta en el siguiente ciclo */
      }
    }

    const id = setInterval(poll, POLL_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible") poll();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      alive = false;
      ctrl?.abort();
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [router]);

  return (
    <Card>
      <div className="flex items-center justify-between gap-3 p-5 sm:p-6">
        <CardTitle className="flex items-center gap-2">
          <Inbox aria-hidden className="size-4 text-lavender" /> Mensajes
        </CardTitle>
        <span className="inline-flex items-center gap-2 text-[13px] text-subtle">
          <span aria-hidden className="relative flex size-2">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-accent/60 motion-reduce:animate-none" />
            <span className="relative inline-flex size-2 rounded-full bg-accent" />
          </span>
          En vivo
        </span>
      </div>
      <CardContent>
        <p aria-live="polite" className="sr-only">
          {announce}
        </p>
        {messages.length === 0 ? (
          <EmptyInbox e164={e164} />
        ) : (
          <ul className="-mx-1 flex flex-col gap-2.5">
            <AnimatePresence initial={false}>
              {messages.map((m) => {
                const code = extractCode(m.body);
                const isFresh = m.id === fresh;
                return (
                  <motion.li
                    key={m.id}
                    layout="position"
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
                    className={
                      "flex flex-col gap-2.5 rounded-2xl border p-4 transition-colors duration-700 " +
                      (isFresh ? "border-lavender/35 bg-primary/[0.07]" : "border-border bg-surface-2/50")
                    }
                  >
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="flex min-w-0 items-center gap-2 text-sm font-medium text-fg">
                        <MessageCircle aria-hidden className="size-3.5 shrink-0 text-subtle" />
                        <span className="truncate">{formatPhone(m.from)}</span>
                      </span>
                      <time dateTime={m.receivedAt} className="shrink-0 text-[13px] text-subtle tabular-nums">
                        {relativeTime(m.receivedAt, now)}
                      </time>
                    </div>
                    {code ? (
                      <div className="flex items-center justify-between gap-3 rounded-xl border border-lavender/25 bg-primary/10 py-1 pl-3.5 pr-1">
                        <span className="flex min-w-0 items-center gap-2.5">
                          <KeyRound aria-hidden className="size-4 shrink-0 text-lavender" />
                          <span className="sr-only">Código detectado:</span>
                          <span className="font-mono text-xl font-semibold tracking-[0.18em] text-fg tabular-nums">{code}</span>
                        </span>
                        <CopyButton value={code} label="Copiar" ariaLabel={`Copiar código ${code}`} variant="secondary" size="md" />
                      </div>
                    ) : null}
                    <p className="whitespace-pre-line break-words text-[15px] leading-relaxed text-muted">{m.body}</p>
                  </motion.li>
                );
              })}
            </AnimatePresence>
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function EmptyInbox({ e164 }: { e164: string }) {
  const national = nationalNumber(e164);
  const steps = [
    <>
      En WhatsApp elige <span className="text-fg">Reino Unido (+44)</span> e ingresa{" "}
      <span className="font-mono text-fg tabular-nums">{formatPhone(e164).replace(/^\+44 /, "")}</span>.
    </>,
    <>Espera el SMS aquí; esta bandeja se actualiza sola y también te llega por correo.</>,
    <>
      Si no llega en 1 minuto, toca <span className="inline-flex items-center gap-1 text-fg"><PhoneCall aria-hidden className="size-3.5" />“Llamarme”</span>.
    </>,
  ];
  return (
    <div className="flex flex-col gap-5 rounded-2xl border border-dashed border-border-strong p-5 sm:p-6">
      <div className="flex flex-col gap-1.5">
        <p className="font-medium text-fg">Aún no recibes mensajes</p>
        <p className="text-[15px] leading-relaxed text-muted">
          Usa este número para registrarte en WhatsApp, Telegram u otras apps. Los códigos aparecerán aquí al instante.
        </p>
      </div>
      <ol className="flex flex-col gap-3">
        {steps.map((s, i) => (
          <li key={i} className="flex gap-3 text-sm leading-relaxed text-muted">
            <span className="flex size-6 shrink-0 items-center justify-center rounded-full border border-border bg-surface-2 font-display text-[12px] font-semibold text-lavender tabular-nums">
              {i + 1}
            </span>
            <span className="pt-0.5">{s}</span>
          </li>
        ))}
      </ol>
      <div className="flex items-center gap-2 text-[13px] text-subtle">
        <span>Número sin prefijo:</span>
        <span className="font-mono text-muted tabular-nums">{national}</span>
        <CopyButton value={national} ariaLabel="Copiar número sin prefijo" variant="ghost" size="icon" />
      </div>
    </div>
  );
}
