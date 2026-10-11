/** Extrae un código de verificación (4–8 dígitos) de una transcripción en español o inglés. */
const WORDS: Record<string, string> = {
  cero: "0", zero: "0",
  uno: "1", one: "1",
  dos: "2", two: "2",
  tres: "3", three: "3",
  cuatro: "4", four: "4",
  cinco: "5", five: "5",
  seis: "6", six: "6",
  siete: "7", seven: "7",
  ocho: "8", eight: "8",
  nueve: "9", nine: "9",
};

export function extractSpokenCode(transcript: string): string | null {
  const normalized = transcript
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    // Quita instrucciones de menú ("pulsa 4") para que esa tecla no se mezcle con el código.
    .replace(/\b(?:pulsa|pulse|presiona|presione|oprime|oprima|marca|marque|teclea|teclee|digita|digite|press|dial|push|enter|aperte|pressione|appuyez|tapez)\s+(?:sur\s+)?(?:el\s+|la\s+|le\s+|o\s+|tecla\s+|touche\s+|numero\s+|number\s+|the\s+)?(?:\d|[#*]|[a-z]+)\b/g, " ")
    .replace(/[^\p{L}\p{N}\s]/gu, " ");
  // Convierte cada token a dígitos y busca la secuencia continua más larga (4–8).
  const tokens = normalized.split(/\s+/).filter(Boolean);
  let run = "";
  let best = "";
  for (const t of tokens) {
    const d = /^\d+$/.test(t) ? t : WORDS[t];
    if (d !== undefined) {
      run += d;
    } else {
      if (run.length > best.length) best = run;
      run = "";
    }
  }
  if (run.length > best.length) best = run;
  if (best.length >= 4 && best.length <= 8) return best;
  // WhatsApp suele repetir el código: si la secuencia es el doble de larga y se repite, toma la mitad.
  if (best.length >= 8 && best.length % 2 === 0) {
    const half = best.slice(0, best.length / 2);
    if (best === half + half && half.length >= 4) return half;
  }
  if (best.length > 8) return best.slice(0, 6);
  return null;
}

const DIGIT_WORDS: Record<string, string> = {
  ...WORDS,
  una: "1",
  // portugués / francés (menús de servicios internacionais)
  um: "1", dois: "2", tres: "3", quatro: "4", seis: "6", sete: "7", oito: "8", nove: "9",
  un: "1", deux: "2", trois: "3", quatre: "4", cinq: "5", sept: "7", huit: "8", neuf: "9",
  // teclas especiales
  numeral: "#", gato: "#", almohadilla: "#", pound: "#", hash: "#", hashtag: "#", diese: "#",
  asterisco: "*", star: "*", estrella: "*", etoile: "*",
};

/** Verbos de menú en es / en / pt / fr. */
const MENU_VERBS = "pulsa|pulse|presiona|presione|oprime|oprima|marca|marque|teclea|teclee|digita|digite|press|dial|push|enter|aperte|pressione|appuyez|tapez";
const MENU_RE = new RegExp(
  `\\b(?:${MENU_VERBS})\\s+(?:sur\\s+)?(?:el\\s+|la\\s+|le\\s+|o\\s+|tecla\\s+|touche\\s+|numero\\s+|number\\s+|the\\s+)?(\\d|[#*]|[a-z]+)`,
  "g",
);

const normalizeText = (t: string) =>
  t
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

/**
 * Detecta la instrucción de menú de un fragmento: "pulsa 4", "press pound", "aperte 1".
 * Si hay varias opciones ("para español pulsa 1, para inglés pulsa 2") toma la primera, que suele ser la principal.
 */
export function extractMenuKey(transcript: string): string | null {
  const t = normalizeText(transcript);
  for (const m of t.matchAll(MENU_RE)) {
    const k = /^[\d#*]$/.test(m[1]) ? m[1] : DIGIT_WORDS[m[1]];
    if (k) return k;
  }
  return null;
}
