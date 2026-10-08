export type FaqItem = { q: string; a: string };

export const FAQ: FaqItem[] = [
  {
    q: "¿Qué es una eSIM de datos?",
    a: "Es una SIM digital que se instala en tu teléfono sin chip físico. La de NovaPhone es solo de datos: te da internet móvil en México, pero no incluye número telefónico ni SMS.",
  },
  {
    q: "¿Qué red usa y qué velocidad tiene?",
    a: "Funciona sobre la red Telcel 5G, la de mayor cobertura del país, con AT&T 5G como respaldo. Navegas en 5G donde haya cobertura y tu equipo lo soporte; en otras zonas, en 4G LTE.",
  },
  {
    q: "¿Por qué tengo que activar “Roaming de datos”?",
    a: "Técnicamente es una eSIM internacional que opera en México, así que el teléfono la trata como roaming. Es normal y no genera ningún cargo adicional: solo consumes los datos de tu plan.",
  },
  {
    q: "¿Cuándo empieza a contar la vigencia?",
    a: "Los días empiezan a contar cuando tu eSIM se conecta a la red por primera vez, no al momento de comprarla. Puedes instalarla con calma y activarla cuando la necesites.",
  },
  {
    q: "¿Me piden CURP, INE o algún documento?",
    a: "No. Para crear tu cuenta solo necesitas nombre, correo y contraseña. Sin registros ni papeleo.",
  },
  {
    q: "¿Cómo pago?",
    a: "Agregas saldo a tu cuenta por transferencia SPEI o con USDT en la red TRC20. Después compras tus planes con ese saldo y la entrega es instantánea, por correo y en tu panel.",
  },
  {
    q: "¿Cómo la instalo?",
    a: "Escanea el código QR desde la configuración de tu teléfono o, en iPhone con iOS 17.4 o superior, instálala con un toque. Toma 1–2 minutos y te guiamos paso a paso.",
  },
  {
    q: "¿Puedo usarla junto con mi chip actual?",
    a: "Sí, en teléfonos con doble SIM puedes mantener tu línea de siempre para llamadas y usar NovaPhone para los datos.",
  },
  {
    q: "¿Mi teléfono es compatible?",
    a: "Necesitas un equipo con eSIM y desbloqueado: iPhone XS o posterior, Google Pixel 3 o posterior, Samsung Galaxy S20 o posterior, entre muchos otros. En Android, marca *#06#: si aparece un EID, es compatible.",
  },
];
