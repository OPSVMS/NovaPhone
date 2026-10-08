"use client";

import { useEffect } from "react";
import { RotateCw, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Friendly error fallback for error.tsx boundaries. */
export function ErrorState({ error, retry, homeHref = "/app" }: { error: Error & { digest?: string }; retry: () => void; homeHref?: string }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-5 py-16 text-center">
      <span className="flex size-12 items-center justify-center rounded-2xl border border-warning/25 bg-warning/10 text-warning">
        <TriangleAlert aria-hidden className="size-5" />
      </span>
      <div className="flex flex-col gap-2">
        <h1 className="text-xl font-semibold text-fg">Algo salió mal</h1>
        <p className="text-[15px] leading-relaxed text-muted">
          No pudimos cargar esta sección. Tu saldo y tus eSIM están a salvo; intenta de nuevo en un momento.
        </p>
        {error.digest ? <p className="font-mono text-[12px] text-subtle">Código: {error.digest}</p> : null}
      </div>
      <div className="flex w-full flex-col gap-2.5 sm:w-auto sm:flex-row">
        <Button onClick={() => retry()} className="w-full sm:w-auto">
          <RotateCw aria-hidden /> Reintentar
        </Button>
        <Button href={homeHref} variant="secondary" className="w-full sm:w-auto">
          Ir al inicio
        </Button>
      </div>
    </div>
  );
}
