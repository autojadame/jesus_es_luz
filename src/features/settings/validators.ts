import type { BibleItem } from "@/types/bible";

export type ValidationResult =
  | { ok: true; items: BibleItem[] }
  | { ok: false; error: string };

function isNonEmptyString(x: any) {
  return typeof x === "string" && x.trim().length > 0;
}
function isInt(x: any) {
  return Number.isInteger(x);
}

export function validateBibleJson(raw: string): ValidationResult {
  let parsed: any;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { ok: false, error: "JSON inválido (no se puede parsear)." };
  }

  if (!Array.isArray(parsed)) {
    return { ok: false, error: "El JSON debe ser un ARRAY de objetos." };
  }

  for (let idx = 0; idx < parsed.length; idx++) {
    const it = parsed[idx];

    const base = `Elemento #${idx}`;
    if (!it || typeof it !== "object") return { ok: false, error: `${base}: debe ser objeto.` };

    if (!isInt(it.id)) return { ok: false, error: `${base}: 'id' debe ser entero.` };
    if (!isNonEmptyString(it.libro)) return { ok: false, error: `${base}: 'libro' requerido.` };
    if (!isInt(it.capitulo)) return { ok: false, error: `${base}: 'capitulo' entero requerido.` };
    if (!isInt(it.versiculo_inicial)) return { ok: false, error: `${base}: 'versiculo_inicial' entero requerido.` };
    if (!isInt(it.versiculo_final)) return { ok: false, error: `${base}: 'versiculo_final' entero requerido.` };
    if (!isNonEmptyString(it.texto)) return { ok: false, error: `${base}: 'texto' requerido.` };
    if (!isNonEmptyString(it.testamento)) return { ok: false, error: `${base}: 'testamento' requerido.` };
  }

  return { ok: true, items: parsed as BibleItem[] };
}