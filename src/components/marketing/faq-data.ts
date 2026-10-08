export type FaqItem = { q: string; a: string };

const ALL = {
  que: {
    q: "¿Qué es una eSIM de datos?",
    a: "Es una SIM digital que se instala en tu teléfono sin chip físico. La de NovaPhone es solo de datos: te da internet móvil en México, pero no incluye número telefónico ni SMS. Si necesitas recibir códigos por SMS, puedes agregar un Número NovaPhone.",
  },
  red: {
    q: "¿Qué red usa y qué velocidad tiene?",
    a: "Funciona sobre la red Telcel 5G, la de mayor cobertura del país, con AT&T 5G como respaldo. Navegas en 5G donde haya cobertura y tu equipo lo soporte; en otras zonas, en 4G LTE.",
  },
  roaming: {
    q: "¿Por qué tengo que activar “Roaming de datos”?",
    a: "Técnicamente es una eSIM internacional que opera en México, así que el teléfono la trata como roaming. Es normal y no genera ningún cargo adicional: solo consumes los datos de tu plan.",
  },
  vigencia: {
    q: "¿Cuándo empieza a contar la vigencia?",
    a: "Los días empiezan a contar cuando tu eSIM se conecta a la red por primera vez, no al momento de comprarla. Puedes instalarla con calma y activarla cuando la necesites.",
  },
  docs: {
    q: "¿Me piden CURP, INE o algún documento?",
    a: "No. Para crear tu cuenta solo necesitas nombre, correo y contraseña. Sin registros ni papeleo.",
  },
  recargar: {
    q: "¿Puedo recargar la misma eSIM?",
    a: "Sí. Cuando se te acaben los datos, recargas desde tu panel y se suman datos y días a la misma eSIM, al instante. No tienes que reinstalar nada ni escanear otro QR.",
  },
  autoRecarga: {
    q: "¿Cómo funciona la auto-recarga?",
    a: "La activas desde tu panel. Cuando te queden menos de 500 MB o 2 días, recargamos tu eSIM automáticamente con tu saldo y te avisamos por correo. Solo necesitas tener saldo suficiente en tu cuenta.",
  },
  recurrente: {
    q: "¿Puedo pagar de forma recurrente?",
    a: "Muy pronto. Cada cliente tendrá su propia CLABE: podrás transferir cuando quieras o programar una transferencia mensual en tu banco, y tu saldo se acreditará solo, sin referencias. Junto con la auto-recarga, funciona como una suscripción sin tarjeta.",
  },
  pago: {
    q: "¿Cómo pago?",
    a: "Agregas saldo a tu cuenta por transferencia SPEI o con USDT en la red TRC20. Después compras tus planes con ese saldo y la entrega es instantánea, por correo y en tu panel.",
  },
  instalar: {
    q: "¿Cómo la instalo?",
    a: "Escanea el código QR desde la configuración de tu teléfono o, en iPhone con iOS 17.4 o superior, instálala con un toque. Toma 1–2 minutos y te guiamos paso a paso.",
  },
  perdida: {
    q: "¿Qué pasa si pierdo mi teléfono?",
    a: "Pausa tu eSIM desde tu panel para que nadie use tus datos. Cuando lo resuelvas, la reactivas desde ahí mismo.",
  },
  cancelar: {
    q: "¿Puedo cancelar una eSIM que no instalé?",
    a: "Sí. Si todavía no la instalaste, puedes cancelarla y te devolvemos el importe a tu saldo.",
  },
  dualsim: {
    q: "¿Puedo usarla junto con mi chip actual?",
    a: "Sí, en teléfonos con doble SIM puedes mantener tu línea de siempre para llamadas y usar NovaPhone para los datos.",
  },
  compat: {
    q: "¿Mi teléfono es compatible?",
    a: "Necesitas un equipo con eSIM y desbloqueado: iPhone XS o posterior, Google Pixel 3 o posterior, Samsung Galaxy S20 o posterior, entre muchos otros. En Android, marca *#06#: si aparece un EID, es compatible.",
  },
  numero: {
    q: "¿Qué es el número NovaPhone?",
    a: "Es un número móvil del Reino Unido (+44) que activas desde tu panel para recibir SMS y códigos de verificación. Los mensajes llegan al instante a tu panel y a tu correo. Se paga con tu saldo, se renueva cada 30 días y lo cancelas cuando quieras. Funciona con o sin eSIM.",
  },
  whatsapp: {
    q: "¿Sirve para WhatsApp?",
    a: "Sí. Al registrarte en WhatsApp, Telegram u otra app, elige Reino Unido (+44), escribe tu número y el código aparecerá en tu panel. Ten en cuenta que algunas apps o bancos no aceptan números virtuales.",
  },
  llamadas: {
    q: "¿Puedo recibir llamadas?",
    a: "Muy pronto. Por ahora el número recibe SMS y códigos de verificación. Si una app te ofrece verificar por llamada, elige la opción de SMS.",
  },
} satisfies Record<string, FaqItem>;

export const FAQ: FaqItem[] = [
  ALL.que,
  ALL.red,
  ALL.roaming,
  ALL.vigencia,
  ALL.docs,
  ALL.pago,
  ALL.recargar,
  ALL.autoRecarga,
  ALL.recurrente,
  ALL.instalar,
  ALL.perdida,
  ALL.cancelar,
  ALL.dualsim,
  ALL.compat,
  ALL.numero,
  ALL.whatsapp,
  ALL.llamadas,
];

/** Shorter set for /planes, focused on buying and recharging. */
export const PLANES_FAQ: FaqItem[] = [
  ALL.vigencia,
  ALL.pago,
  ALL.recargar,
  ALL.autoRecarga,
  ALL.cancelar,
  ALL.roaming,
  ALL.numero,
];
