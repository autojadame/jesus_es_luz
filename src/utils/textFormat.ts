// src/utils/textFormat.ts

// Inserta salto(s) tras fin de frase cuando lo siguiente empieza con MAYÚSCULA.
// ✅ Soporta cierres tipo: .', ." , .’ , .” , .» , .) , .] , .}
// ✅ Inserta el salto DESPUÉS del cierre (ej: "texto.' E" => "texto.'\n\nE")
// - Solo reemplaza espacios/tabs (no toca si ya hay \n)

const UPPER = "A-ZÁÉÍÓÚÜÑ";

// caracteres que pueden aparecer antes de la mayúscula (comillas de apertura, signos, paréntesis...)
const OPEN_PREFIX = `"'“”‘’«»¿¡\\(\\[\\{`;

// caracteres que pueden aparecer justo tras el punto/exclamación/interrogación (cierres)
const CLOSE_SUFFIX = `'"’”»\\)\\]\\}`;

// PUNTO/!/?
// + cierres opcionales (', ", ’, ”, », ), ], })
// + espacios/tabs
// + lookahead: empieza lo siguiente con MAYÚSCULA (con prefijos opcionales)
const SENTENCE_BREAK_RE = new RegExp(
  `([.!?])([${CLOSE_SUFFIX}]*)[ \\t]+(?=[${OPEN_PREFIX}]*[${UPPER}])`,
  "g"
);

type Options = {
  blankLine?: boolean; // true => "\n\n" (párrafo), false => "\n"
  keepAbbreviations?: boolean;
};

const DEFAULT_ABBR = new Set([
  "Sr", "Sra", "Srta", "Dr", "Dra", "Prof", "Profa",
  "etc", "p", "pp", "cap", "núm", "nº", "No"
]);

export function addLineBreaksAfterDotUpper(text: string, opts: Options = {}) {
  const { blankLine = true, keepAbbreviations = true } = opts;
  const br = blankLine ? "\n\n" : "\n";

  const s = String(text ?? "");

  return s.replace(
    SENTENCE_BREAK_RE,
    (match: string, punct: string, closers: string, offset: number, full: string) => {
      if (!keepAbbreviations) return `${punct}${closers}${br}`;

      // palabra justo antes del signo (offset apunta al inicio del match = donde está el punct)
      const before = full.slice(0, offset);
      const lastWord = before.match(/([A-Za-zÁÉÍÓÚÜÑáéíóúüñ]{1,10})$/)?.[1] ?? "";

      if (DEFAULT_ABBR.has(lastWord)) {
        // en abreviaturas: mantenemos como estaba (un espacio)
        return `${punct}${closers} `;
      }

      // ✅ salto va después del cierre (ej: .')
      return `${punct}${closers}${br}`;
    }
  );
}