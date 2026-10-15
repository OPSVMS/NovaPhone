# NovaPhone · Políticas de Google Ads y el registro de líneas (CRT, 2026)

**Autor:** escuadrón de Búsqueda pagada y políticas · **Fecha:** 15-oct-2026 · **Cuenta:** 823-438-8697 (MXN). Es la misma cuenta donde están Faro y "Nahui Leads".
**Aplica a:** `docs/ads/novaphone-ads.js` (anuncios, sitelinks, callouts y keywords) y a la landing `novaphone.lat`.

> **Regla del director**
> - Las keywords **sí** pueden captar la intención "esim sin registro".
> - Los títulos, descripciones, sitelinks, callouts y rutas visibles **nunca** prometen evitar el registro, ni lo mencionan.
> - La landing solo dice el estado legal real, en una pregunta frecuente.

El script **impone** esta regla. Antes de tocar la cuenta, revisa cada texto contra una lista de términos prohibidos (`FORBIDDEN`) y aborta si alguno aparece. El validador comprueba además que una edición del tipo "eSIM sin registro de CURP" se bloquee.

Esto no es una opinión legal. Antes de cambiar el texto legal de la pregunta frecuente (§6.2), conviene que lo revise un abogado de telecom.

---

## 1. Resumen en 6 líneas

1. **No hay una política de Google que prohíba la keyword "esim sin registro".** Lo que se castiga es el **anuncio o la landing** que promete algo engañoso o que ayuda a incumplir una ley local.
2. **El riesgo real está en Tergiversación** ("Prácticas comerciales inaceptables"). Ahí Google suspende la cuenta **de inmediato y sin aviso**. La cuenta suspendida sería la de Faro, NovaPhone **y** Nahui Leads.
3. **"Facilitación de conductas deshonestas" no menciona evadir registros gubernamentales.** Pero el criterio del revisor es amplio, y la política de **Requisitos legales** obliga a cumplir la ley local de México.
4. **La CRT ya habló de esto dos veces** (tarjetas informativas TI 05/2026 del 14-sep y TI 06/2026 del 6-oct):
   - dice que las eSIM extranjeras de datos "no sustituyen una línea";
   - recuerda que los acuerdos mayoristas prohíben el roaming permanente;
   - pide no caer en "ofertas en redes sociales" que prometen saltarse el registro.
5. **Prometer "sin registro" en un anuncio es exactamente la oferta que la CRT señaló.** Además sería falso o engañoso: la eSIM no cambia la obligación de la persona sobre su propia línea. Es el peor de los dos mundos.
6. **La landing tiene hoy tres textos que hay que corregir antes de pagar clics** (§6.1). El más urgente es "Sin registros ni papeleo".

---

## 2. Políticas de Google Ads que aplican

### 2.1 Tergiversación (Misrepresentation)

Fuente: https://support.google.com/adspolicy/answer/6020955?hl=es

Lo que nos aplica, con la definición textual de Google:

| Subpolítica | Definición de Google | Cómo nos pega |
|---|---|---|
| **Afirmaciones no fiables** | "Hacer afirmaciones falsas o que persuadan a los usuarios presentando un resultado improbable como probable" | Prometer "sin registro", "evita la suspensión" o "sigue conectado si te cortan la línea" |
| **Información falsa / omisión** | "Hacer afirmaciones engañosas, o bien ocultar u omitir información material…" | Ocultar que la eSIM es solo datos, sin número, y que opera en roaming |
| **Ofertas no disponibles** | "Prometer en el anuncio productos, servicios u ofertas promocionales que no estén disponibles o que no se encuentren con facilidad en el destino" | "20 GB por $599", "Garantía de conexión" y "Paga con tarjeta o SPEI" tienen que verse en la landing tal cual |
| **Diseño engañoso** | "Incoherencias entre el anuncio y la página de destino" | La garantía dice una cosa en la landing y otra en los Términos (§6.1) |
| **Prácticas comerciales inaceptables** | Engañar ocultando detalles o dando información falsa | Es la categoría que suspende "de inmediato y sin previo aviso" |

**Consecuencia.** Google lo dice así: "tus cuentas de Google Ads se suspenderán de inmediato y sin previo aviso, y no podrás volver a anunciarte con Google Ads".
- Abrir otra cuenta después de una suspensión viola "Elusión de sistemas", y eso también se castiga con suspensión.
- Por eso no se experimenta con textos dudosos en esta cuenta.

### 2.2 Facilitación de conductas deshonestas (Enabling dishonest behavior)

Fuente: https://support.google.com/adspolicy/answer/6016086?hl=es

**Qué prohíbe:**
- productos o servicios para engañar a terceros. Ejemplo textual: "Creación de documentos falsos, como pasaportes o títulos académicos". También números falsos de privacidad crediticia, trampa académica, clics y reseñas falsas;
- acceso no autorizado: hackeo, "Escuchas telefónicas en líneas fijas o móviles";
- vigilancia sin consentimiento.

**Qué no menciona:** evadir una verificación de identidad o un registro gubernamental de forma explícita.

**Lectura del escuadrón:**
- Una eSIM de datos no es en sí un producto deshonesto.
- Un anuncio que la venda **para** no registrar una línea sí podría leerse como facilitar el incumplimiento de una obligación legal. Ese caso lo cubren también los Requisitos legales.
- Hay un riesgo adicional: el **Número NovaPhone (+44) "para WhatsApp"**. Junto con "sin registro", se leería como un kit para evadir la vinculación. **No se anuncia en Búsqueda**, ni en sitelinks ni en callouts.

### 2.3 Requisitos legales

Fuente: https://support.google.com/adspolicy/answer/6023676?hl=es

El texto de Google: "Debes cumplir la legislación local de las zonas a las que orientas tus anuncios, además de las políticas de Google Ads."

La vinculación de líneas en México viene de lineamientos publicados en el DOF y la coordina la CRT. Un anuncio que invite a no cumplirla queda fuera de esta política, aunque la eSIM sea legal.

### 2.4 Keywords, marcas y otros puntos

- **Keywords.** La keyword "esim sin registro" se puede usar. Google evalúa el anuncio y el destino, no la búsqueda.
  - **Nunca se usa inserción dinámica de keywords** (`{KeyWord:…}`), porque metería "esim sin registro" en el título. El script no la usa.
  - El grupo que capta esa intención se llama **"eSIM sin contrato"**. Su anuncio es idéntico al resto, más el título "eSIM sin contrato".
- **"Telcel" en el texto del anuncio.**
  - Es uso informativo ("Red Telcel 5G"), y la landing explica que la eSIM opera sobre esa red.
  - Si América Móvil presenta una queja de marca, Google puede limitar o rechazar los anuncios que digan "Telcel".
  - Reemplazo listo para ese caso: "Red 5G en todo México" (no promete "la mayor cobertura").
  - Como keyword ("esim telcel", "chip virtual telcel"), la marca no está restringida en México.
- **Ruta visible y URL.** Todas las URLs son de `https://novaphone.lat`. El script lo verifica.

---

## 3. Contexto regulatorio y noticias (2026)

**Qué es la vinculación:** la "vinculación de líneas móviles con CURP" es obligatoria en 2026, con calendario por terminación del número y suspensión de las líneas que no se vinculen.

| Fecha | Fuente | Qué dice |
|---|---|---|
| 07-abr-2026 | La Silla Rota: "Evaden registro de celulares en México con eSIM extranjeras, contratadas en Internet" | Primera ola de notas sobre las eSIM como "salida" |
| 07/08-abr-2026 | El Universal / XEVA: "Salinas Pliego pide no registrar número de celular" | Polémica pública que alimenta la demanda de "sin registro" |
| 14-ago-2026 | Expansión: "¿Debo registrarme si tengo una eSIM? Lo que debes saber de la vinculación…" | Explicativa |
| 14-sep-2026 | **CRT, Tarjeta informativa TI 05/2026** (https://www.gob.mx/crt/prensa/tarjeta-informativa-435752) | "Muchas de las eSIM de datos no sustituyen una línea habilitada" para llamadas y SMS de autenticación (bancos). Los acuerdos mayoristas "prohíben estrictamente el roaming permanente". Los datos cuestan "hasta 10 veces" más. Pide **"no caer en engaños de ofertas en redes sociales"** que prometen saltarse el registro. 84.16 millones de líneas vinculadas (70.1%). |
| 14-sep-2026 | Excélsior: "Con eSIM extranjeras, mexicanos le dan la vuelta al registro telefónico obligatorio" | Nota que motivó la respuesta de la CRT |
| 16-sep-2026 | Xataka México: "México advierte de las eSIM extranjeras: mantienen el internet, pero no salvan el bloqueo del número" (https://www.xataka.com.mx/telecomunicaciones/mexico-advierte-esim-extranjeras-mantienen-internet-no-salvan-bloqueo-numero) | El registro está pensado para la "línea telefónica móvil", es decir, el **número** que origina y recibe llamadas. La CRT advierte sobre ofertas en redes sociales. |
| 17-sep-2026 | Milenio: "¿Qué pasa si compras una eSIM extranjera para no registrar tu línea? CRT advierte…" · Diario de Yucatán: "CRT va contra las eSIM por 'evadir' registro celular; advierte riesgos y bloqueo de líneas" | Mismo mensaje, con tono más duro |
| 19 al 25-sep-2026 | Récord, El Imparcial, El Informador: "Usuarios recurren a eSIM extranjeras…", "por qué una eSIM extranjera no es la solución, según la CRT" | La intención de búsqueda existe y crece |
| 06-oct-2026 | **CRT, Tarjeta informativa TI 06/2026** (https://www.gob.mx/crt/prensa/tarjeta-informativa-437159) | Las eSIM extranjeras "no constituyen un sustituto de una línea nacional" y "ofrecen principalmente solo datos". 92.3 millones de líneas vinculadas (76.9%). Atribuye la baja de líneas a la estacionalidad, no a una evasión. |
| 15-oct-2026 | N+, MVS: vence la terminación 4 | La demanda de "sin registro" se mantiene alta durante todo el calendario, que corre hasta diciembre |

**¿Se han retirado anuncios?**
- No encontramos una nota verificable de que Google, Meta o algún marketplace hayan retirado anuncios de "eSIM sin registro" en 2026.
- Lo que sí hay es una **advertencia oficial y repetida de la CRT contra esas ofertas**. Eso aumenta la probabilidad de denuncias de usuarios y de revisión manual de los anunciantes que usen esa frase.
- Lo tratamos como riesgo alto, no como hipótesis.

---

## 4. Qué es NovaPhone frente al registro (hechos)

- **Es una eSIM de datos con perfil internacional.** Opera en México en roaming sobre Telcel 5G, con AT&T como respaldo. El FAQ de la landing ya lo explica.
- **No da un número mexicano, ni llamadas, ni SMS.**
- **Según la CRT y la prensa,** la vinculación aplica a las **líneas telefónicas móviles**, es decir, a los números.
- **Consecuencia práctica:**
  - Comprar NovaPhone **no cambia** la obligación de una persona de vincular la línea con número que ya tenga.
  - NovaPhone tampoco da una línea que haya que vincular.
  - Afirmar algo más allá de esto (que es "legal", que está "exenta", que "evita la suspensión") no nos corresponde.
- **Riesgo de negocio que dice la CRT:** el "roaming permanente" está prohibido por los acuerdos mayoristas.
  - Ningún texto puede prometer servicio "permanente", "para siempre" o "ilimitado".
  - Si el proveedor corta el uso prolongado, una promesa así se vuelve "afirmación no fiable".

---

## 5. Frases exactas: permitidas y prohibidas

### 5.1 Anuncios, sitelinks, callouts y rutas visibles

**Permitidas** (son las que usa el script; entre paréntesis, los caracteres):

| Tipo | Texto |
|---|---|
| Títulos | eSIM de datos para México (25) · Activa en 2 minutos (19) · Sin contrato ni plazos (22) · Red Telcel 5G (13) · 20 GB por $599 (14) · Paga con tarjeta o SPEI (23) · QR al instante por correo (25) · Garantía de conexión (20) · Recarga la misma eSIM (21) · Sin chip físico (15) · Planes de 1 GB a 50 GB (22) · Compra en línea hoy (19) · eSIM para celular y tablet (26) · NovaPhone eSIM México (21) |
| Títulos por grupo | eSIM México desde $39 (21) · eSIM solo datos (15) · Internet prepago sin chip (25) · eSIM sin contrato (17) · eSIM de datos red Telcel 5G (27) · Chip virtual de datos (21) · Chip virtual en México (22) · NovaPhone: sitio oficial (24) |
| Descripción fija en la posición 1 | Solo datos, sin número: internet móvil en red Telcel 5G. Instálala con un QR en minutos. (88) |
| Descripciones | Planes de 1 GB a 50 GB. 20 GB por 30 días a $599. Paga con tarjeta o SPEI. (74) · Sin contrato ni plazos. Recarga la misma eSIM desde tu panel cuando la necesites. (81) · Revisa si tu teléfono tiene eSIM antes de comprar. Garantía de conexión. (72) |
| Sitelinks | Planes · Cómo funciona · Compatibilidad · Preguntas (descripciones en el script, todas ≤ 35) |
| Callouts | Sin contrato · Red Telcel 5G · QR al instante · Paga con tarjeta o SPEI · Garantía de conexión · Recargas desde tu panel · Solo datos, sin número |
| De reemplazo, si Telcel se queja | Red 5G en todo México · eSIM de datos 5G |

**Prohibidas.** No se usan en ningún texto visible de Google Ads. Ninguna es aceptable "con matices".

| Frase | Por qué |
|---|---|
| eSIM sin registro · Sin registro · Sin registro de línea · Sin registro de CURP | Promete evitar una obligación legal. Es justo la "oferta" que la CRT señaló. |
| No registres tu línea · Evita el registro · Olvídate del registro · Alternativa al registro | Incita a incumplir la ley (Requisitos legales y Facilitación) |
| Evita la suspensión · Sigue conectado aunque suspendan tu línea · Que no te corten | "Afirmación no fiable": no es lo que pasa con la línea de la persona |
| Sin CURP · Sin INE · Sin papeleo · Sin documentos · Sin identificación · Anónima · Sin rastro · 100 % privada | Insinúa anonimato frente a la autoridad |
| Legal · 100 % legal · Aprobada por la CRT / IFT · Exenta del registro | Afirmaciones legales que no podemos sostener ni respaldar |
| Ilimitado · Para siempre · Permanente | Roaming permanente prohibido; promesa no fiable |
| Número para WhatsApp sin registro · Número virtual sin CURP | Une el Número +44 con la evasión |
| Cualquier `{KeyWord:…}` | Metería "esim sin registro" en el título |
| "!" en títulos | Google lo rechaza por puntuación |

El script bloquea por expresión regular (`FORBIDDEN`) cualquier texto que contenga: registr, curp, ine, anónim, identific, document, papeleo, evita, evade, elud, esquiv, rastre, "sin datos personales", "privacidad total", "100 %", ilimitad, gratis o "!".

### 5.2 Keywords y negativas

- **Keywords permitidas:** esim sin registro y esim sin contrato, en frase y exacta, en el grupo "eSIM sin contrato" de la campaña "Nova | Search | eSIM México", con destino `https://novaphone.lat/`.
  - Ese destino es la página que tiene la pregunta frecuente legal.
- **"registro" no se pone como negativa.** Sí se niegan las búsquedas de **trámite**, que no van a comprar:
  - como registrar · registrar mi · registro de telefonia · ift · crt · ley · multa;
  - además: imei · liberar · desbloquear · mi telcel · recarga telcel · saldo telcel.
  - El validador comprueba que ninguna negativa bloquee una keyword propia.

### 5.3 Landing (novaphone.lat)

**Permitido** (texto exacto de la pregunta frecuente, §6.2):
- "La eSIM de NovaPhone es solo de datos: no te da un número mexicano, llamadas ni SMS."
- "Si tienes una línea móvil, vincularla con tu CURP sigue siendo tu responsabilidad con tu compañía; NovaPhone no cambia esa obligación."
- "Para comprar solo te pedimos nombre, correo y contraseña." Va como dato de la cuenta, no como bandera de privacidad.

**Prohibido en la landing,** con la misma lista de §5.1. Además:
- encabezados o insignias con la palabra "registro" (hoy existe "Sin registros ni papeleo");
- vincular el Número +44 con el registro o con "evitar la suspensión";
- "devolvemos tu dinero" si los Términos dicen "a tu saldo" (§6.1).

---

## 6. Cambios a la landing (antes de activar las campañas)

### 6.1 Correcciones (las hace el equipo del sitio; no son parte del script)

| Dónde | Hoy | Cambiar a | Por qué |
|---|---|---|---|
| `src/components/marketing/value-props.tsx` (eyebrow "Privacidad") | **"Sin registros ni papeleo"**. "Activa con tu correo. No pedimos CURP, INE ni documentos…" | Título: **"Cuenta lista en un minuto"**. Texto: "Crea tu cuenta con nombre, correo y contraseña, y compra al instante." Eyebrow: "Rápido" | En el contexto de 2026, "sin registros… no pedimos CURP, INE" se lee como evasión. Es la frase de mayor riesgo del sitio. |
| `src/components/marketing/faq-data.ts`, pregunta `docs` | "¿Me piden CURP, INE o algún documento?" → "No… Sin registros ni papeleo." | "¿Qué datos necesito para comprar?" → "Nombre, correo y contraseña para tu cuenta, y tu forma de pago. La entrega es por correo y en tu panel." | Igual que arriba |
| `plan-picker.tsx` ("Garantía de conexión: si no conecta, te devolvemos tu dinero") vs `terminos` ("te devolveremos el importe a tu saldo") | Contradicción | Alinear las dos con la política real. Por ejemplo, en ambas: "Garantía de conexión: si no logramos conectarte, te devolvemos el importe." Y en los Términos, decir si va a saldo o a la tarjeta. | El anuncio dice "Garantía de conexión": la promesa tiene que coincidir con los Términos (Ofertas no disponibles / Diseño engañoso) |
| `faq-data.ts`, pregunta `pago` | "Agregas saldo… por transferencia SPEI o con USDT" | Incluir la tarjeta: "Paga con tarjeta (cobro en MXN) o por SPEI…" | El anuncio dice "Paga con tarjeta o SPEI" |
| Precios en anuncios ("20 GB por $599", "desde $39", "1 GB a 50 GB") | Salen del catálogo, que se sincroniza a diario con tipo de cambio | Si el precio de 20 GB/30 días o el de 1 GB deja de ser 599 / 39, **se cambia el script el mismo día** | Precio del anuncio ≠ precio del sitio = Tergiversación ("Precios engañosos") |

### 6.2 Pregunta frecuente legal (texto exacto propuesto)

Va en el FAQ de la página de inicio (`/#preguntas`), que es el destino del grupo "eSIM sin contrato":

> **¿Tengo que vincular la eSIM de NovaPhone con mi CURP?**
> La vinculación de líneas con CURP que coordina la CRT aplica a las líneas móviles con número telefónico. La eSIM de NovaPhone es solo de datos: no te da un número mexicano, llamadas ni SMS, así que no sustituye tu línea. Si tienes una línea móvil, vincularla con tu compañía en las fechas oficiales sigue siendo tu responsabilidad; NovaPhone no cambia esa obligación. Información oficial: gob.mx/crt.

- No se agregan adjetivos ("legal", "exenta", "sin problemas"). No se enlaza a notas de prensa.
- Si un abogado ajusta la redacción, se respeta el criterio: **solo el estado legal, sin promesa**.

---

## 7. Qué hacer si Google rechaza algo

1. **El estado de un anuncio dice "Rechazado" o "Aprobado (limitado)" por Tergiversación o Requisitos legales:**
   - se **pausa ese grupo de anuncios** (no la cuenta);
   - se manda una captura al director;
   - **no se apela** con argumentos legales ni se reescribe "para que pase".
2. **La keyword "esim sin registro" sale con "Elegible (limitada)" o rechazada:**
   - se pausa solo esa keyword;
   - el resto del grupo sigue.
3. **Aviso de suspensión de la cuenta:**
   - se detiene todo (Faro ya está pausado);
   - no se crea otra cuenta;
   - el director prepara la apelación con la landing ya corregida (§6.1).
4. **Mensaje de la CRT o de Profeco:**
   - se pausan las tres campañas Nova;
   - pasa a revisión legal.

---

## 8. Checklist de políticas antes de dar "Ejecutar"

- [ ] La Vista previa de `novaphone-ads.js` no dice "ABORTADO". El filtro de textos pasó.
- [ ] La landing ya no dice "Sin registros ni papeleo" (§6.1).
- [ ] La pregunta frecuente §6.2 está publicada en `/#preguntas`.
- [ ] La garantía dice lo mismo en el plan-picker y en los Términos.
- [ ] El FAQ de pagos menciona la tarjeta.
- [ ] Hoy 20 GB/30 días cuesta $599 y 1 GB/7 días cuesta $39 en `/planes`.
- [ ] El Número +44 no aparece en ningún asset de Google Ads.
