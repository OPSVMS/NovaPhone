"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import clsx from "clsx";
import { AnimatePresence, motion } from "motion/react";
import { PhoneCall, PhoneIncoming, PhoneMissed, PhoneOff, Voicemail } from "lucide-react";
import { CopyButton } from "@/components/ui/copy-button";
import { Card } from "@/components/ui/card";
import { Segmented } from "@/components/ui/segmented";
import {
  clockTime,
  dayKey,
  dayLabel,
  extractCode,
  formatDuration,
  formatPhone,
  nationalNumber,
  relativeTime,
} from "./format";

export type CommsMessage = { id: string; from: string; body: string; receivedAt: string };
export type CommsCall = {
  id: string;
  from: string;
  status: "answered" | "missed" | "voicemail" | "rejected";
  durationSec: number;
  transcript: string | null;
  startedAt: string;
};
export type CommsHistory = {
  messages: CommsMessage[];
  calls: CommsCall[];
  counts: { messages: number; calls: number };
};

type Tab = "messages" | "calls";

const POLL_MS = 5_000;
const LIMIT = 200;

/** "ahora" / "hace 5 min" durante la primera hora; después, la hora del día (la fecha va en el encabezado del grupo). */
function rowTime(iso: string, now: number) {
  return now - new Date(iso).getTime() < 3_600_000 ? relativeTime(iso, now) : clockTime(iso);
}

/** Agrupa elementos (ya ordenados del más nuevo al más viejo) por día en hora de CDMX. */
function byDay<T>(items: T[], date: (item: T) => string) {
  const groups: { key: string; first: string; items: T[] }[] = [];
  for (const item of items) {
    const key = dayKey(date(item));
    const last = groups[groups.length - 1];
    if (last?.key === key) last.items.push(item);
    else groups.push({ key, first: date(item), items: [item] });
  }
  return groups;
}

/**
 * Centro de comunicaciones del número: Mensajes | Llamadas.
 * Consulta /api/numero/mensajes cada 5 s mientras la pestaña está visible.
 */
export function CommsHub({ e164, initial, initialNow }: { e164: string; initial: CommsHistory; initialNow: number }) {
  const router = useRouter();
  const [history, setHistory] = useState(initial);
  const [tab, setTab] = useState<Tab>("messages");
  const [now, setNow] = useState(initialNow);
  const [fresh, setFresh] = useState<string | null>(null);
  const [announce, setAnnounce] = useState("");
  const known = useRef(new Set([...initial.messages, ...initial.calls].map((x) => x.id)));

  useEffect(() => {
    let alive = true;
    let ctrl: AbortController | null = null;

    async function poll() {
      if (document.visibilityState !== "visible") return;
      ctrl?.abort();
      ctrl = new AbortController();
      try {
        const res = await fetch(`/api/numero/mensajes?limit=${LIMIT}`, { cache: "no-store", signal: ctrl.signal });
        if (!res.ok || !alive) return;
        const data = (await res.json()) as CommsHistory & { number: string | null };
        if (!data.number) {
          // El número se liberó: recarga la página para mostrar el estado correcto.
          router.refresh();
          return;
        }
        const newMessages = data.messages.filter((m) => !known.current.has(m.id));
        const newCalls = data.calls.filter((c) => !known.current.has(c.id));
        for (const x of [...data.messages, ...data.calls]) known.current.add(x.id);
        setHistory({ messages: data.messages, calls: data.calls, counts: data.counts });
        setNow(Date.now());
        if (newMessages.length) {
          const latest = newMessages[0];
          const code = extractCode(latest.body);
          setFresh(latest.id);
          setAnnounce(`Nuevo mensaje de ${latest.from}${code ? `. Código ${code.split("").join(" ")}` : ""}`);
        } else if (newCalls.length) {
          setFresh(newCalls[0].id);
          setAnnounce(`Nueva llamada de ${newCalls[0].from}`);
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

  const { messages, calls, counts } = history;
  const count = (n: number) => <span className="tabular-nums text-subtle">{n}</span>;

  return (
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3 p-5 pb-4 sm:p-6 sm:pb-5">
        <Segmented<Tab>
          aria-label="Historial del número"
          value={tab}
          onValueChange={setTab}
          fullWidth
          className="sm:w-auto"
          options={[
            { value: "messages", label: <>Mensajes {count(counts.messages)}</> },
            { value: "calls", label: <>Llamadas {count(counts.calls)}</> },
          ]}
        />
        <span className="inline-flex items-center gap-2 text-[13px] text-subtle">
          <span aria-hidden className="relative flex size-2">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-accent/60 motion-reduce:animate-none" />
            <span className="relative inline-flex size-2 rounded-full bg-accent" />
          </span>
          En vivo
        </span>
      </div>

      <p aria-live="polite" className="sr-only">
        {announce}
      </p>

      <div role="region" aria-label={tab === "messages" ? "Mensajes" : "Llamadas"} className="px-5 pb-5 sm:px-6 sm:pb-6">
        {tab === "messages" ? (
          messages.length === 0 ? (
            <EmptyMessages e164={e164} />
          ) : (
            <DayGroups
              groups={byDay(messages, (m) => m.receivedAt)}
              now={now}
              total={counts.messages}
              shown={messages.length}
              noun="mensajes"
              render={(m) => <MessageRow key={m.id} message={m} now={now} fresh={m.id === fresh} />}
            />
          )
        ) : calls.length === 0 ? (
          <EmptyCalls />
        ) : (
          <DayGroups
            groups={byDay(calls, (c) => c.startedAt)}
            now={now}
            total={counts.calls}
            shown={calls.length}
            noun="llamadas"
            render={(c) => <CallRow key={c.id} call={c} now={now} fresh={c.id === fresh} />}
          />
        )}
      </div>
    </Card>
  );
}

function DayGroups<T>({
  groups,
  now,
  total,
  shown,
  noun,
  render,
}: {
  groups: { key: string; first: string; items: T[] }[];
  now: number;
  total: number;
  shown: number;
  noun: string;
  render: (item: T) => ReactNode;
}) {
  return (
    <div className="flex flex-col gap-6">
      {groups.map((g) => (
        <section key={g.key} aria-label={dayLabel(g.first, now)} className="flex flex-col gap-2.5">
          <h3 className="font-sans text-[13px] font-medium tracking-normal text-subtle">{dayLabel(g.first, now)}</h3>
          <ul className="flex flex-col gap-2.5">
            <AnimatePresence initial={false}>{g.items.map(render)}</AnimatePresence>
          </ul>
        </section>
      ))}
      {total > shown ? (
        <p className="text-center text-[13px] text-subtle">
          Mostrando los últimos {shown} de {total} {noun}.
        </p>
      ) : null}
    </div>
  );
}

const rowMotion = {
  layout: "position" as const,
  initial: { opacity: 0, y: -8 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.45, ease: [0.16, 1, 0.3, 1] as const },
};

function rowClass(fresh: boolean) {
  return clsx(
    "flex flex-col gap-2.5 rounded-2xl border p-4 transition-colors duration-700",
    fresh ? "border-lavender/35 bg-primary/[0.07]" : "border-border bg-surface-2/50",
  );
}

/** Código grande con botón de copiar. */
export function CodeChip({ code, size = "lg" }: { code: string; size?: "md" | "lg" }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-lavender/25 bg-primary/10 py-1 pl-3.5 pr-1">
      <span className="min-w-0">
        <span className="sr-only">Código: </span>
        <span
          className={clsx(
            "font-mono font-semibold tracking-[0.18em] text-fg tabular-nums",
            size === "lg" ? "text-xl" : "text-base",
          )}
        >
          {code}
        </span>
      </span>
      <CopyButton value={code} label="Copiar" ariaLabel={`Copiar código ${code}`} variant="secondary" size={size === "lg" ? "md" : "sm"} />
    </div>
  );
}

function MessageRow({ message: m, now, fresh }: { message: CommsMessage; now: number; fresh: boolean }) {
  const code = extractCode(m.body);
  return (
    <motion.li {...rowMotion} className={rowClass(fresh)}>
      <div className="flex items-baseline justify-between gap-3">
        <span className="truncate text-sm font-medium text-fg">{formatPhone(m.from)}</span>
        <time dateTime={m.receivedAt} className="shrink-0 text-[13px] text-subtle tabular-nums">
          {rowTime(m.receivedAt, now)}
        </time>
      </div>
      {code ? <CodeChip code={code} /> : null}
      <p className="whitespace-pre-line break-words text-[15px] leading-relaxed text-muted">{m.body}</p>
    </motion.li>
  );
}

const CALL_STATUS: Record<CommsCall["status"], { label: string; icon: typeof PhoneCall; tone: string }> = {
  answered: { label: "Contestada", icon: PhoneIncoming, tone: "border-success/25 bg-success/10 text-success" },
  missed: { label: "Perdida", icon: PhoneMissed, tone: "border-danger/25 bg-danger/10 text-danger" },
  voicemail: { label: "Buzón de voz", icon: Voicemail, tone: "border-lavender/25 bg-primary/10 text-lavender" },
  rejected: { label: "Rechazada", icon: PhoneOff, tone: "border-border bg-surface-2 text-muted" },
};

function CallRow({ call: c, now, fresh }: { call: CommsCall; now: number; fresh: boolean }) {
  const s = CALL_STATUS[c.status] ?? CALL_STATUS.missed;
  const Icon = s.icon;
  const code = c.transcript ? extractCode(c.transcript) : null;
  return (
    <motion.li {...rowMotion} className={rowClass(fresh)}>
      <div className="flex items-start gap-3">
        <span className={clsx("grid size-9 shrink-0 place-items-center rounded-full border", s.tone)}>
          <Icon aria-hidden className="size-4" />
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <div className="flex items-baseline justify-between gap-3">
            <span className="truncate text-sm font-medium text-fg">{formatPhone(c.from)}</span>
            <time dateTime={c.startedAt} className="shrink-0 text-[13px] text-subtle tabular-nums">
              {rowTime(c.startedAt, now)}
            </time>
          </div>
          <p className="text-[13px] text-muted tabular-nums">
            {s.label}
            {c.durationSec > 0 ? ` · ${formatDuration(c.durationSec)}` : ""}
          </p>
        </div>
      </div>
      {code ? <CodeChip code={code} /> : null}
      {c.transcript ? (
        <p className="whitespace-pre-line break-words border-l-2 border-border-strong pl-3 text-[15px] leading-relaxed text-muted">
          <span className="sr-only">Transcripción: </span>
          {c.transcript}
        </p>
      ) : null}
    </motion.li>
  );
}

function EmptyMessages({ e164 }: { e164: string }) {
  const national = nationalNumber(e164);
  return (
    <div className="flex flex-col gap-5 rounded-2xl border border-dashed border-border-strong p-5">
      <div className="flex flex-col gap-1.5">
        <p className="font-medium text-fg">Aún no tienes mensajes</p>
        <p className="text-[15px] leading-relaxed text-muted">
          Usa tu número al registrarte en WhatsApp, Telegram u otra app. El código aparecerá aquí y en tu correo.
        </p>
      </div>
      <ol className="flex flex-col gap-3 text-sm leading-relaxed text-muted">
        <Step n={1}>
          En la app elige <span className="text-fg">Reino Unido (+44)</span>.
        </Step>
        <Step n={2}>
          <span className="inline-flex flex-wrap items-center gap-x-2">
            Escribe <span className="font-mono text-fg tabular-nums">{national}</span>
            <CopyButton value={national} ariaLabel="Copiar número sin prefijo" variant="ghost" size="icon-sm" />
          </span>
        </Step>
        <Step n={3}>Si tarda, toca “Reenviar SMS”. Aún no recibimos llamadas, así que elige siempre SMS.</Step>
      </ol>
    </div>
  );
}

function Step({ n, children }: { n: number; children: ReactNode }) {
  return (
    <li className="flex items-start gap-3">
      <span className="flex size-6 shrink-0 items-center justify-center rounded-full border border-border bg-surface-2 font-display text-[12px] font-semibold text-lavender tabular-nums">
        {n}
      </span>
      <span className="min-w-0 pt-0.5">{children}</span>
    </li>
  );
}

function EmptyCalls() {
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border-strong px-5 py-10 text-center">
      <span className="grid size-10 place-items-center rounded-xl border border-border bg-surface-2 text-lavender">
        <PhoneCall aria-hidden className="size-5" />
      </span>
      <p className="font-medium text-fg">Las llamadas aparecerán aquí muy pronto</p>
      <p className="max-w-[42ch] text-sm leading-relaxed text-muted">
        Estamos conectando la recepción de llamadas. Mientras tanto, tu número recibe SMS y códigos al instante.
      </p>
    </div>
  );
}
