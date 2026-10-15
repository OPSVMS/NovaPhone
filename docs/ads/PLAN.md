# NovaPhone · Google Ads: plan de 21 días (México, español)

**Autor:** escuadrón de Búsqueda pagada y políticas · **Fecha:** 15-oct-2026 · **Cuenta:** 823-438-8697 (MXN), la misma que Faro

**Scripts** (en `docs/ads/`):
- `novaphone-ads.js`:
  - pausa Faro;
  - crea y ajusta las campañas Nova.
  - Se corre una vez al inicio y otra vez en cada cambio de fase o de negativas.
- `novaphone-freno.js`: freno de gasto. Se programa cada hora.
- `google-ads-report.js`: reporte diario de Nova + Faro, solo lectura.

**Validador:** `node docs/ads/validate-novaphone-ads.mjs`
**Políticas:** `POLICY.md`. Léelo antes de cambiar cualquier texto de anuncio.

---

## 0. Resumen en 6 líneas

1. **Faro se apaga por completo.** Las 8 campañas "Faro | …" quedan pausadas y sin la etiqueta del freno, así que nada las reactiva.
   - Toda la cuenta se dedica a NovaPhone.
   - Solo México, solo español, solo la Red de Búsqueda de Google.
2. **Tres campañas:**
   - eSIM México: genérico y "sin registro / sin contrato";
   - Telcel/Chip virtual;
   - Brand.
3. **Presupuesto en rampa, igual que Faro:** fase 1 = **MXN 150/día**, fase 2 = **280**, fase 3 = **330**. Puja: Maximizar clics con tope de CPC de **MXN 10** en todas.
4. **Compuertas idénticas a las de Faro: MXN 2,000 / 4,000 / 7,000 de gasto acumulado de Nova.** En cada una el director decide si sigue, se recorta o se apaga (§4).
5. **Captamos la intención "esim sin registro" con keywords, pero el anuncio nunca la repite.** El script aborta si algún texto menciona el registro (POLICY.md).
6. **Hay que corregir la landing antes de activar** (POLICY.md §6.1). El cambio más urgente es "Sin registros ni papeleo".

---

## 1. Estructura

| Campaña | Grupo | Keywords (frase + exacta) | URL final |
|---|---|---|---|
| **Nova \| Search \| eSIM México** | eSIM México | esim mexico · esim en mexico · comprar esim mexico · esim prepago mexico | `/planes` |
| | eSIM de datos | esim de datos · esim solo datos · esim para tablet · internet para celular prepago | `/planes` |
| | eSIM sin contrato | esim sin registro · esim sin contrato | `/` (tiene la pregunta frecuente legal) |
| **Nova \| Search \| Telcel/Chip virtual** | eSIM Telcel | esim telcel | `/` |
| | Chip virtual | chip virtual mexico · chip virtual telcel | `/` |
| **Nova \| Search \| Brand** | NovaPhone | novaphone · nova phone · novaphone esim | `/` |

- **Anuncios:** 1 RSA por grupo, con 15 títulos (≤ 30) y 4 descripciones (≤ 90).
  - La primera descripción va fija: "Solo datos, sin número: …".
  - Copys completos en POLICY.md §5.1.
- **Assets** en las 3 campañas:
  - 4 sitelinks: Planes (`/planes`), Cómo funciona (`/#como-funciona`), Compatibilidad (`/#compatibilidad`), Preguntas (`/#preguntas`);
  - 7 callouts.
- **Negativas:** lista compartida "Nova | Negatives" con 25 frases (gratis, free, hack, …, pospago, factura).
  - "registro" **no** es negativa.
  - Sí lo son las búsquedas de trámite: como registrar · registrar mi · registro de telefonia · ift · crt · ley · multa.
- **Sufijo de URL final:** `utm_source=google&utm_medium=cpc&utm_campaign=<slug>&utm_term={keyword}`.
  - Los slugs son `nova-esim-mexico`, `nova-telcel-chip-virtual` y `nova-brand`.
  - Google no tiene un ValueTrack con el *nombre* de la campaña, por eso el slug va fijo.
  - Con autoetiquetado, el gclid se agrega solo.
- **Conversión:**
  - "Compra Faro" se renombra a **"Compra"**. Es la misma acción y la misma etiqueta, y cuenta para ambas marcas.
  - El objetivo personalizado **"Nova | Compra"** se asigna a las campañas Nova.
  - El registro del script imprime `NEXT_PUBLIC_GOOGLE_ADS_ID` y `NEXT_PUBLIC_GOOGLE_ADS_PURCHASE_LABEL` para Vercel.
- **Seguridad del arranque:**
  - las campañas se crean **pausadas**;
  - México y español se agregan después;
  - solo entonces se activan.
  - Si no queda México, la campaña no se activa, porque sin ubicaciones mostraría anuncios en todo el mundo.

### Presupuesto por fase (MXN/día)

| Campaña | Tope CPC | Fase 1 | Fase 2 | Fase 3 |
|---|---|---|---|---|
| eSIM México | 10 | 90 | 170 | 200 |
| Telcel/Chip virtual | 10 | 40 | 80 | 95 |
| Brand | 10 | 20 | 30 | 35 |
| **Total** | | **150** | **280** | **330** |

- **Para cambiar de fase:** se edita `var PHASE = 1;` (1, 2 o 3) en la primera línea de `novaphone-ads.js` y se vuelve a correr.
  - El validador comprueba que el cambio de fase **solo** toca los 3 presupuestos.
- **El script aborta si:**
  - la fase no es 1, 2 o 3;
  - los presupuestos no suman el total;
  - el total pasa de 330.
- **Brand lleva 20 en la fase 1** aunque casi no gaste, porque hoy hay poca búsqueda de marca. Lo que no gasta no se pierde: Google no lo reparte a otras campañas, pero tampoco lo cobra.

---

## 2. CPC esperado en México

Son **estimaciones del escuadrón**, no datos del Planificador de palabras clave, que el script no puede leer.

Cómo se calcularon:
- **Dato propio de Faro en México, búsquedas "esim" de viaje:** CPC medio de MXN 14.90 sin tope del 12 al 15 de octubre.
- **Faro con tope de 10–12:** CPC esperado de 7–9.
- **Diferencia con NovaPhone:** las búsquedas de uso doméstico tienen menos competidores de viaje (Holafly y Airalo pujan menos fuera de "esim + país"). En cambio, Telcel, Bait y AT&T pujan por "chip" y "prepago".

Se confirman con el reporte de D1–D3.

| Keywords | CPC esperado (MXN) | Comentario |
|---|---|---|
| esim mexico · esim en mexico · comprar esim mexico | 5 – 9 | Compiten Airalo y Holafly (turista entrante) y algún OMV. Con tope de 10, perderemos parte de la subasta por ranking. |
| esim prepago mexico · esim de datos · esim solo datos · esim para tablet | 3 – 7 | Poca competencia directa. Son las de mejor relación intención/costo. |
| internet para celular prepago | 4 – 9 | Amplia: la pelean los operadores. Vigilar los términos. |
| esim telcel · chip virtual telcel | 3 – 8 | Puja Telcel. Nuestro Quality Score será menor porque no somos Telcel. |
| chip virtual mexico | 2 – 6 | Barata. Atrae curiosos: vigilar la tasa de llegada a Stripe. |
| esim sin registro · esim sin contrato | 2 – 6 | Demanda alta desde septiembre y pocos anunciantes, porque es una intención delicada en políticas. Puede quedar "limitada". |
| novaphone · nova phone · novaphone esim | 0.5 – 2 | Marca. Volumen bajo al inicio. |

**Promedio esperado:** ~MXN 5–6 por clic.
- En la fase 1 (150/día) eso da **~25–30 clics/día**.
- Al llegar a la compuerta 1 (MXN 2,000) serán **~350 clics**.

**Si en la fase 1 hay menos de 15 clics/día y la cuota perdida por ranking pasa del 85%:**
- el director sube `CPC_CAP_MXN` a 12, como máximo una vez cada 48 h (misma regla que Faro);
- el dueño vuelve a correr el script.

---

## 3. Calendario de 21 días

D0 = jueves 15-oct (instalación). D1 = viernes 16-oct, el primer día completo con anuncios.

| Fase | Días | Fechas | MXN/día | Gasto de la fase | Acumulado aprox. | Qué se aprende |
|---|---|---|---|---|---|---|
| 1 · Validar el embudo | D1–D5 | 16–20 oct | **150** | 750 | 750 | ¿Se registra la conversión? ¿La gente llega a Stripe? ¿Hay anuncios rechazados? |
| 2 · Aprender | D6–D12 | 21–27 oct | **280** | 1,960 | 2,710 → **Compuerta 1 (~D10, 25-oct)** | ¿Qué grupo lleva a Stripe? ¿Compran? |
| 3 · Escalar lo que vende | D13–D21 | 28-oct – 5-nov | **330** | 2,970 | 5,680 → **Compuerta 2 (~D16, 31-oct)** | CPA por grupo |
| Cierre | D22–D25 | 6–9 nov | 330 | ~1,320 | 7,000 → **Compuerta 3 (~D25, 9-nov)** | Veredicto |

- **Las compuertas se disparan por gasto, no por fecha.** El reporte imprime "próxima compuerta MXN X (faltan Y)" y "COMPUERTA n alcanzada".
  - Con tope de CPC de 10, es probable que Google gaste menos que el presupuesto. En ese caso las fechas se recorren.
- **La compuerta 3 llega después del día 21.** Con la rampa 150 → 280 → 330 desde cero, en 21 días se gastan ~MXN 5,700, no 7,000.
  - Faro llegaba a 7,000 en el día 21 porque ya traía gasto previo.
  - El D21 (5-nov) es una **revisión previa a la compuerta 3** con proyección. La compuerta se decide al llegar a 7,000.
- **Paso de fase 1 a 2 (D6):** no es una compuerta. Es un **chequeo técnico** (§4.1). Si falla, se queda en la fase 1 hasta arreglarlo.

---

## 4. Compuertas (idénticas a las de Faro)

### 4.1 Chequeo técnico (D5, ~MXN 750)

Para pasar a la fase 2 se tienen que cumplir las cuatro condiciones:
- ≥ 1 `checkout_redirect` registrado;
- la conversión "Compra" se ve en Google Ads si hubo una venta (o una compra de prueba del dueño);
- 0 anuncios rechazados por Tergiversación o Requisitos legales;
- CTR ≥ 3%.

### 4.2 Compuertas de gasto

| Compuerta | Gasto Nova acumulado | PASA | MEDIO | NO PASA |
|---|---|---|---|---|
| **1** | **MXN 2,000** (~350 clics) | ≥ 4 `checkout_redirect` (tasa a Stripe ≥ 5%). Una venta es bienvenida, pero no se exige. | 2–3 llegadas a Stripe: se queda en la fase 2 hasta MXN 2,300 y el director revisa 10 grabaciones de Clarity | **0–1 llegadas a Stripe:** pausa de 48 h, el dueño hace 2 pruebas con personas reales y el director rehace la página **una vez**. Si en MXN 2,600 sigue en ≤ 1 → **pivote** |
| **2** | **MXN 4,000** | **≥ 6 ventas**, CPA ≤ MXN 425 y pago en Stripe ≥ 40% → fase 3 completa | **3–5 ventas:** fase 3 a 250/día, solo con los 2 mejores grupos | **≤ 2 ventas → PIVOTE.** Se detiene Búsqueda. |
| **3** | **MXN 7,000** | **GO:** ≥ 18 ventas desde D1 **y** CPA de los últimos MXN 2,000 ≤ **MXN 200** → se sigue con la misma estructura. Con ≥ 15 conversiones se pasa a Maximizar conversiones con tCPA = 150. | **HOLD:** 10–17 ventas o CPA de 200–350 → se sigue solo en el mejor grupo, sin efectivo adicional salvo que el CPA quede ≤ el punto de equilibrio | **KILL:** < 10 ventas o CPA > 350 → se apaga Google Ads para NovaPhone |

**Dónde se mide cada cosa:**
- **Ventas y CPA:** conversiones "Compra" de las campañas Nova, más los eventos `paid` del servidor, que son la fuente de verdad si Google subcuenta.
- **Tasa a Stripe:** `checkout_redirect` entre clics de Nova.
- **Pago en Stripe:** `paid` entre `checkout_started`.

**Nota de economía para el director.** Las bandas de CPA (200/350/425) se copiaron de Faro, como se pidió. Para NovaPhone conviene confirmarlas:
- **Plan estrella:** 20 GB a MXN 599, con markup de 1.33. El margen bruto es ~MXN 149 por venta. Restando la comisión de Stripe (~MXN 28 con IVA), la contribución queda en **~MXN 120**, si el precio no incluye IVA. Si lo incluye, queda en **~MXN 40**.
- **Planes chicos:** desde $39, casi no dejan margen.
- **Conclusión:** un CPA de 200 solo es rentable si la recarga (LTV) lo compensa.
- **Por eso el reporte de la compuerta 2 debe incluir:**
  - el ticket promedio;
  - el % de ventas de 20 GB o más;
  - las recargas de los primeros compradores.

---

## 5. Freno de gasto (`novaphone-freno.js`, cada hora)

Es el mismo freno de Faro, con el prefijo "Nova | " y la etiqueta `Nova|freno`.
- **Cuándo frena:** si el costo de hoy de las campañas Nova activas llega a **1.15 ×** la suma de sus presupuestos.
- **Qué hace al frenar:** etiqueta y pausa esas campañas hasta el día siguiente. Ese día las reactiva y les quita la etiqueta.
- **Qué no toca:** Faro ni otras campañas.
- **Convivencia con `novaphone-ads.js`:** este no reactiva una campaña frenada.
- **El freno de Faro ya no hace nada útil** (todas las Faro están pausadas y sin etiqueta). Hay que desprogramarlo para que no confunda.

---

## 6. Rutina diaria

### Dueño (5 min, por la mañana)

1. Google Ads → Herramientas → Acciones masivas → Secuencias de comandos → "Nova reporte" → **Vista previa**.
2. Copia **todo** el registro y pégalo al director por WhatsApp.

### Director (20 min, al recibir el reporte)

1. **Alertas.**
   - "ALERTA … Faro ACTIVA" → el dueño vuelve a correr `novaphone-ads.js` (Vista previa → Ejecutar).
   - "FRENO" → es normal. No se reactiva a mano el mismo día.
2. **Ritmo.** Revisa el gasto de ayer contra el presupuesto de la fase y la línea "próxima compuerta". Si dice "COMPUERTA n alcanzada", se aplica §4 ese mismo día.
3. **Políticas.**
   - Revisa la columna Estado en Anuncios y en Keywords.
   - Si algo aparece "Rechazado" o "Aprobado (limitado)" por Tergiversación o Requisitos legales, se aplica POLICY.md §7: se pausa ese grupo y no se apela.
4. **Términos (top 40).** Clasifica cada término en compra, trámite, soporte o competencia.
   - **Trámite** (cómo registrar, IMEI, Mi Telcel…): se agrega a `NEGATIVES` en el script y el dueño lo corre. Como máximo una vez al día.
   - **Compra con buen volumen que no es keyword:** se agrega como keyword nueva en la siguiente versión.
5. **Grupo "eSIM sin contrato"** ("esim sin registro"):
   - compara su CTR y su tasa a Stripe contra los demás;
   - si llega a **MXN 600 sin ninguna llegada a Stripe**, se pausa la keyword "esim sin registro" (misma regla que España en Faro).
6. **Subasta.** Si la cuota perdida por ranking pasa del 85% y hay < 15 clics/día, sube el tope de CPC a 12. Como máximo una vez cada 48 h.
7. **Embudo.** Revisa `checkout_redirect`, `checkout_started` y `paid` en la analítica propia. Antes de cada compuerta, revisa 10 grabaciones de Clarity.

### Semanal (jueves, o el día de la compuerta)

- Se decide la fase (`PHASE`). Se revisan los precios del catálogo contra los anuncios ("20 GB por $599", "desde $39").
- Se revisa la landing contra POLICY.md §8.

---

## 7. Pasos del dueño

**Una sola vez (hoy):**

1. ads.google.com → **Herramientas** (llave) → **Acciones masivas** → **Secuencias de comandos** → **+** → **Nueva secuencia de comandos**. Borra el texto de ejemplo, pega `docs/ads/novaphone-ads.js` y nómbralo "Nova ads". Revisa que la primera línea diga `var PHASE = 1;`.
2. **Autorizar** → elige la cuenta → **Permitir** → **Vista previa**. El registro debe mostrar:
   - "PLAN · FASE 1: MXN 150/día";
   - "VISTA PREVIA";
   - **ningún "ABORTADO" ni "FAIL"**.

   Que aparezcan "diferido" es normal en la Vista previa. Si hay "ABORTADO" o "FAIL", no lo ejecutes: manda el registro al director.
3. **Ejecutar.** Al final debe decir **"Listo"**. Copia las dos líneas `>>> NEXT_PUBLIC_GOOGLE_ADS_…` y mándalas al director.

**Después:**

4. Vuelve a dar **Vista previa** en "Nova ads". Debe decir **"Nada que cambiar"**.
5. **+ Nueva secuencia** → pega `novaphone-freno.js` → nómbrala "Nova freno" → Autorizar → Vista previa (debe imprimir "FRENO …") → **Guardar** → **Frecuencia: Cada hora**.
6. **+ Nueva secuencia** → pega `docs/ads/google-ads-report.js` → nómbrala "Nova reporte" → Autorizar → Guardar, sin programar.
   - Reemplaza a "Faro reporte".
   - Desprograma "Faro freno" (Frecuencia → ninguna).
7. **Vercel:** proyecto novaphone → Environment Variables (Production):
   - `NEXT_PUBLIC_GOOGLE_ADS_ID` y `NEXT_PUBLIC_GOOGLE_ADS_PURCHASE_LABEL`, con las líneas del paso 3;
   - después, **Redeploy**.

**Cuando el director diga "fase 2" o "fase 3":**
- En "Nova ads", cambia la primera línea a `var PHASE = 2;` (o 3) → Vista previa. Debe mostrar solo 3 cambios de presupuesto.
- → **Ejecutar.**

**No hagas esto:**
- **No corras ningún script de Faro** (`google-ads-optimize-2.js`, `changes`, `optimize-1`, `update-ads`, el constructor). Reactivarían o tocarían campañas Faro, y el constructor de Faro buscaría "Compra Faro", que ya se llama "Compra".
- **No edites textos de anuncios a mano.** Todo cambio de texto pasa por el script, que filtra frases prohibidas (POLICY.md §5).

---

## 8. Riesgos

| Riesgo | Señal | Respuesta |
|---|---|---|
| Anuncio o keyword limitados por políticas | Estado "Aprobado (limitado)" o "Rechazado" | POLICY.md §7: pausar ese grupo, sin apelar |
| Queja de marca de Telcel | Anuncios limitados por "Marcas" | Cambiar "Red Telcel 5G" por "Red 5G en todo México" en el script |
| Poco volumen con tope de 10 | < 15 clics/día y > 85% perdido por ranking | Tope a 12 (una vez cada 48 h) |
| "esim sin registro" trae curiosos, no compradores | MXN 600 sin llegar a Stripe | Pausar esa keyword |
| Precio del catálogo cambia (tipo de cambio) | "20 GB" deja de costar 599 en `/planes` | Cambiar el título y la descripción el mismo día y correr el script |
| El proveedor limita el roaming prolongado | Quejas de clientes, desconexiones | No prometer "permanente" ni "ilimitado" (ya bloqueado) y avisar al director |
| Faro se reactiva | ALERTA en el reporte | Volver a correr "Nova ads" |

---

## 9. Validación hecha

`node docs/ads/validate-novaphone-ads.mjs` monta una cuenta simulada que contiene:
- 8 campañas Faro: 4 activas, 2 con la etiqueta `Faro|freno` y una de esas todavía activa;
- "Faro | Negatives", sitelinks Faro, la conversión "Compra Faro" con su objetivo;
- una campaña ajena, "Nahui Leads".

Escenarios verificados:
- **Corrida inicial:**
  - Faro queda pausado y sin etiquetas, y solo cambia su estado;
  - se crean 3 campañas Nova activas, con México, español, solo Búsqueda, Presencia, tope de MXN 10, presupuestos que suman 150 y el sufijo UTM;
  - quedan 6 grupos, 32 keywords (frase + exacta) y 6 RSA dentro de límites, con los 8 títulos pedidos y la descripción fija;
  - se crean 25 negativas (ninguna bloquea una keyword propia, y "registro" no es negativa), 4 sitelinks y 7 callouts;
  - la conversión se renombra a "Compra" y el objetivo "Nova | Compra" queda asignado;
  - Nahui queda intacta.
- **Segunda corrida:** 0 operaciones y "Nada que cambiar". Si alguien reactiva una campaña Faro, la siguiente corrida la pausa con 1 sola operación.
- **Vista previa:** la cuenta no cambia y nunca se usan IDs de la Vista previa. **DRY_RUN:** no llama a mutateAll.
- **Fases 1 → 2 → 3:** solo 3 operaciones de presupuesto en cada una, cada fase es idempotente y una fase inválida aborta.
- **Filtro de textos:** "sin registro de CURP", títulos > 30, descripciones > 90, "Sin papeleo", una negativa que bloquea una keyword y una URL ajena → ABORTADO, con 0 cambios.
- **Falla la ubicación:** las campañas quedan pausadas y la siguiente corrida las arregla.
- **Anuncio rechazado:** se crea el resto y el rechazado se reporta.
- **Campaña con `Nova|freno`:** el script la respeta.
- **Variantes de la conversión:** ya existe "Compra", no existe ninguna, o el renombre falla.
- **Cuenta que no está en MXN:** aborta.
- **Freno Nova:** ignora el costo de Faro y de Nahui, es seguro en la Vista previa, pausa a 1.15× y reactiva al día siguiente.
- **Reporte:** es de solo lectura, muestra Nova + Faro y alerta si hay una Faro activa.
- **GAQL:** en todas las consultas, cada campo del WHERE está en el SELECT.
