"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Segmented } from "@/components/ui/segmented";

type Os = "ios" | "android";

const STEPS: Record<Os, { title: string; body: string }[]> = {
  ios: [
    { title: "Abre Ajustes → Celular", body: "Toca “Agregar eSIM” (en algunos modelos: “Agregar plan celular”)." },
    { title: "Escanea el código QR", body: "Elige “Usar código QR”. Si estás en el mismo iPhone, usa el botón “Instalar en iPhone” o ingresa los datos manualmente." },
    { title: "Elígela para datos", body: "Ponle de nombre “NovaPhone” y selecciónala como línea para Datos celulares. Tu línea principal puede seguir para llamadas." },
    { title: "Activa Roaming de datos", body: "En Ajustes → Celular → NovaPhone, enciende “Roaming de datos”. Es necesario para conectarte." },
  ],
  android: [
    { title: "Abre Ajustes → Conexiones", body: "Ve a “Administrador de SIM” o “Red e Internet → SIM” y toca “Agregar eSIM” o “Descargar SIM”." },
    { title: "Escanea el código QR", body: "Si no puedes escanear, elige “Ingresar código” y pega la dirección SM-DP+ y el código de activación." },
    { title: "Elígela para datos móviles", body: "Activa la eSIM y selecciónala como SIM preferida para Datos móviles." },
    { title: "Activa Roaming de datos", body: "En los ajustes de la eSIM, enciende “Roaming”. Si no navega, revisa que el APN sea el indicado abajo." },
  ],
};

export function InstallGuide({ apn }: { apn?: string | null }) {
  const [os, setOs] = useState<Os>("ios");
  return (
    <div className="flex flex-col gap-5">
      <Segmented<Os>
        aria-label="Sistema operativo"
        value={os}
        onValueChange={setOs}
        fullWidth
        options={[
          { value: "ios", label: "iPhone" },
          { value: "android", label: "Android" },
        ]}
      />
      <AnimatePresence mode="wait" initial={false}>
        <motion.ol
          key={os}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
          className="flex flex-col"
        >
          {STEPS[os].map((s, i) => (
            <li key={s.title} className="relative flex gap-4 pb-5 last:pb-0">
              {i < STEPS[os].length - 1 ? (
                <span aria-hidden className="absolute left-[13px] top-8 bottom-1 w-px bg-border" />
              ) : null}
              <span className="flex size-7 shrink-0 items-center justify-center rounded-full border border-lavender/30 bg-primary/10 font-display text-[13px] font-semibold text-lavender-soft tabular-nums">
                {i + 1}
              </span>
              <div className="flex flex-col gap-1 pt-0.5">
                <p className="text-[15px] font-medium text-fg">{s.title}</p>
                <p className="text-sm leading-relaxed text-muted">{s.body}</p>
              </div>
            </li>
          ))}
        </motion.ol>
      </AnimatePresence>
      {apn ? (
        <p className="rounded-2xl border border-border bg-surface-2/50 px-4 py-3 text-[13px] text-muted">
          ¿Sin conexión después de 2 minutos? Configura el APN como{" "}
          <span className="font-mono text-fg">{apn}</span> y reinicia tu teléfono.
        </p>
      ) : null}
    </div>
  );
}
