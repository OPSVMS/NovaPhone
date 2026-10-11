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
