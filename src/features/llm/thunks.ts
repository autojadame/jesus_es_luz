// src/features/llm/thunks.ts
import type { AppDispatch, RootState } from "@/app/store";
import type { BibleItem } from "@/types/bible";
import type { PassageSummary, SongResult } from "@/types/llm";
import { extractJsonArray, extractJsonObject } from "@/utils/json";
import {
  summariesStart,
  summariesSuccess,
  summariesError,
  songStart,
  songSuccess,
  songError,
} from "./llmSlice";
import { addHistoryEntry } from "@/features/history/historySlice";

// Si añades el reducer (recomendado) para actualizar el título en histórico,
// descomenta esta línea:
// import { updateSongTitleForLatestByPassage } from "@/features/history/historySlice";

function sysJsonOnly() {
  return `Eres un generador de JSON. Devuelve SOLO JSON válido, sin markdown, sin backticks, sin texto extra.`;
}

function normTitle(t: string) {
  return String(t ?? "")
    .trim()
    .toLowerCase()
    .replace(/[“”"']/g, "")
    .replace(/\s+/g, " ")
    .replace(/[^\p{L}\p{N}\s]/gu, "")
    .trim();
}

function isReasonableTitle(t: string) {
  const x = String(t ?? "").trim();
  if (!x) return false;
  if (x.length < 3) return false;
  if (x.length > 70) return false;
  return true;
}

export function fetchSummaries(batch: BibleItem[]) {
  return async (dispatch: AppDispatch, getState: () => RootState) => {
    const missing = batch.filter((x) => !getState().llm.summariesById[x.id]);
    if (missing.length === 0) return;

    dispatch(summariesStart());
    try {
      const user = [
        `Devuélveme un JSON ARRAY ([]) con ${missing.length} objetos.`,
        `Cada objeto: { "id": number, "titulo": string, "descripcion": string, "testamento": string }.`,
        `- titulo: 4-8 palabras, pegadizo.`,
        `- descripcion: 1-2 frases, resumen temático (NO literal bíblico).`,
        `- testamento: copia el valor del input.`,
        ``,
        `INPUT:`,
        ...missing.map((p) =>
          JSON.stringify({
            id: p.id,
            libro: p.libro,
            capitulo: p.capitulo,
            versiculo_inicial: p.versiculo_inicial,
            versiculo_final: p.versiculo_final,
            testamento: p.testamento,
            texto: p.texto,
          })
        ),
      ].join("\n");

      const resp = await window.electronAPI.deepseek.chat({
        model: "deepseek-chat",
        messages: [
          { role: "system", content: sysJsonOnly() },
          { role: "user", content: user },
        ],
        max_tokens: 2000,
      });

      const arrText = extractJsonArray(resp.content);
      const parsed = JSON.parse(arrText) as PassageSummary[];
      dispatch(summariesSuccess(parsed));
    } catch (e: any) {
      dispatch(summariesError(e?.message ?? "Error desconocido cargando summaries"));
    }
  };
}

const SONG_PROMPT_BASE = `Escribe una letra original en español, estilo balada worship cristiano, emocional, íntima y profesional, con rima suave y cantable, Letra original de adoración, inspirada en fe cristiana, no basada en textos bíblicos literales. Estructura obligatoria: Estrofa 1, Estrofa 2, Pre-chorus, Estribillo, Estrofa 3, Pre-chorus 2, Estribillo, Bridge, Estribillo final. Mantén un lenguaje moderno pero reverente, imágenes poéticas, progresión emocional (de fragilidad a esperanza), y evita clichés repetidos. Longitud aproximada: 3–4 min.
Prompt completo (control total, mejores resultados)
Quiero que compongas una letra original en español, con calidad “lista para grabar”, estilo balada (70–90 BPM), worship cristiano. Requisitos: Prohibido usar “Jehová”. Usa “Señor”, “Dios”, “Cristo”, “Salvador”, “Padre”, “Altísimo” (elige con coherencia, sin mezclar por mezclar).
Estructura exacta:
ESTROFA 1 (4 líneas)
ESTROFA 2 (4 líneas)
PRE-CHORUS (4 líneas, subiendo tensión emocional)
ESTRIBILLO (8 líneas, muy melódico y memorable)
ESTROFA 3 (4 líneas, más esperanzada)
PRE-CHORUS 2 (4 líneas, variación del anterior)
ESTRIBILLO (repetición igual o con 1–2 ajustes)
BRIDGE (8 líneas, clímax emocional, sigue siendo balada)
ESTRIBILLO FINAL (8 líneas, resolución y descanso)
Estilo: íntimo, cinematográfico y humano (fragilidad real → consuelo → confianza).
Rima: suave pero consistente (no forzada), frases cantables, sin trabalenguas.
Lenguaje: moderno, reverente, sin términos excesivamente evangélicos; evita clichés (“en victoria”, “romper cadenas” salvo que lo uses con originalidad).
Recursos: metáforas de luz/sombra, hogar, abrazo, camino, amanecer, silencio, pero muy importante que no las uses en todas las letras de las canciones, sino con imágenes nuevas.
Entrega: solo la letra con títulos de secciones, sin explicación`;

export function generateSong(p: BibleItem, summary?: { titulo?: string; descripcion?: string }) {
  return async (dispatch: AppDispatch, getState: () => RootState) => {
    dispatch(songStart(p.id));
    try {
      const user = [
        SONG_PROMPT_BASE,
        ``,
        `Inspiración (NO literal):`,
        `- Referencia: ${p.libro} ${p.capitulo}:${p.versiculo_inicial}-${p.versiculo_final}`,
        `- Testamento: ${p.testamento}`,
        summary?.titulo ? `- Título/tema: ${summary.titulo}` : ``,
        summary?.descripcion ? `- Resumen: ${summary.descripcion}` : ``,
        ``,
        `Devuelve SOLO JSON OBJETO con este formato:`,
        `{ "id": ${p.id}, "titulo": "título corto", "letra": "LETRA COMPLETA CON SECCIONES" }`,
      ]
        .filter(Boolean)
        .join("\n");

      const resp = await window.electronAPI.deepseek.chat({
        model: "deepseek-reasoner",
        messages: [
          { role: "system", content: sysJsonOnly() },
          { role: "user", content: user },
        ],
        max_tokens: 4096,
        temperature: 0.8,
      });

      const objText = extractJsonObject(resp.content);
      const parsed = JSON.parse(objText) as SongResult;

      dispatch(songSuccess(parsed));

      // ✅ Persistir histórico (título/desc desde store si no viene en summary)
      const st = getState();
      const s = st.llm.summariesById[p.id];

      const entryId = `${p.id}-${Date.now()}-${Math.random().toString(16).slice(2)}`;

      dispatch(
        addHistoryEntry({
          entryId,
          createdAt: Date.now(),
          passageId: p.id,
          libro: p.libro,
          capitulo: p.capitulo,
          versiculo_inicial: p.versiculo_inicial,
          versiculo_final: p.versiculo_final,
          testamento: String(p.testamento),
          texto: p.texto,

          summaryTitulo: summary?.titulo ?? s?.titulo ?? "",
          summaryDescripcion: summary?.descripcion ?? s?.descripcion ?? "",

          songTitulo: parsed.titulo,
          songLetra: parsed.letra,
        })
      );
    } catch (e: any) {
      dispatch(songError({ id: p.id, error: e?.message ?? "Error generando canción" }));
    }
  };
}

/**
 * ✅ Regenera SOLO el título (no toca la letra).
 * - Evita repetir títulos usando cache (histórico + títulos en memoria).
 * - Reintenta si repite.
 * - Usa un poco de temperatura para diversidad.
 */
export function regenerateSongTitle(passageId: number) {
  return async (dispatch: AppDispatch, getState: () => RootState) => {
    // Reutilizamos songStart/songSuccess para no añadir más estado si no quieres.
    dispatch(songStart(passageId));

    try {
      const st0 = getState();
      const passage = st0.settings.items.find((x) => x.id === passageId);
      if (!passage) throw new Error("Pasaje no encontrado.");

      const currentSong = st0.llm.songsById?.[passageId];
      if (!currentSong?.letra) throw new Error("No hay letra aún. Primero genera la canción.");

      const summary = st0.llm.summariesById?.[passageId];

      // ✅ Cache de títulos usados (persistente vía history + en memoria)
      const banned = new Set<string>();

      // títulos del histórico
      for (const h of st0.history.entries ?? []) {
        if (h?.songTitulo) banned.add(normTitle(h.songTitulo));
      }

      // títulos actuales en memoria (por si aún no están en history)
      for (const k of Object.keys(st0.llm.songsById ?? {})) {
        const s = st0.llm.songsById?.[Number(k)];
        if (s?.titulo) banned.add(normTitle(s.titulo));
      }

      // título actual del pasaje
      if (currentSong.titulo) banned.add(normTitle(currentSong.titulo));

      const ref = `${passage.libro} ${passage.capitulo}:${passage.versiculo_inicial}-${passage.versiculo_final}`;

      const MAX_RETRIES = 4;
      const temperature = 0.65;

      let finalTitle = "";
      let finalNorm = "";

      for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        const bannedList = Array.from(banned).filter(Boolean).slice(0, 90);

        const user = [
          `Quiero un NUEVO título corto y memorable en español para esta canción worship (balada).`,
          `Referencia: ${ref}. Testamento: ${passage.testamento}.`,
          summary?.titulo ? `Idea/tema: ${summary.titulo}` : "",
          summary?.descripcion ? `Resumen: ${summary.descripcion}` : "",
          ``,
          `LETRA (solo para inspirarte, NO la repitas):`,
          currentSong.letra.slice(0, 2200),
          ``,
          `Reglas:`,
          `- 2 a 6 palabras, cantable, sin comillas.`,
          `- Evita títulos genéricos tipo “Tu Amor”, “Mi Corazón”, “Eres Tú”.`,
          `- No repitas (ni muy parecido a) ninguno de estos títulos:`,
          bannedList.length ? bannedList.join(" | ") : "(ninguno)",
          ``,
          `Devuelve SOLO JSON OBJETO con este formato exacto:`,
          `{ "id": ${passageId}, "titulo": "..." }`,
        ]
          .filter(Boolean)
          .join("\n");

        const resp = await window.electronAPI.deepseek.chat({
          model: "deepseek-chat",
          messages: [
            { role: "system", content: sysJsonOnly() },
            { role: "user", content: user },
          ],
          max_tokens: 200,
          temperature,
        });

        const objText = extractJsonObject(resp.content);
        const parsed = JSON.parse(objText) as { id: number; titulo: string };

        const title = String(parsed?.titulo ?? "").trim();
        const n = normTitle(title);

        if (!isReasonableTitle(title)) {
          banned.add(n || `bad_${attempt}`);
          continue;
        }

        if (banned.has(n)) {
          banned.add(n);
          continue;
        }

        finalTitle = title;
        finalNorm = n;
        break;
      }

      if (!finalTitle) throw new Error("No se pudo generar un título único (demasiadas repeticiones).");

      // ✅ Actualiza SOLO el título en songsById, manteniendo la letra intacta
      const updated: SongResult = {
        id: passageId,
        titulo: finalTitle,
        letra: currentSong.letra,
      };

      dispatch(songSuccess(updated));

      // ✅ Opcional: actualiza el histórico también (si añades el reducer)
      // dispatch(updateSongTitleForLatestByPassage({ passageId, songTitulo: finalTitle }));

      // Mete el título nuevo en el set (por si el usuario vuelve a intentar)
      banned.add(finalNorm);
    } catch (e: any) {
      dispatch(songError({ id: passageId, error: e?.message ?? "Error regenerando título" }));
    }
  };
}