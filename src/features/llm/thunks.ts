import type { AppDispatch, RootState } from "@/app/store";
import type { BibleItem } from "@/types/bible";
import type { PassageSummary, SongResult } from "@/types/llm";
import { extractJsonArray, extractJsonObject } from "@/utils/json";
import { summariesStart, summariesSuccess, summariesError, songStart, songSuccess, songError } from "./llmSlice";
import { addHistoryEntry } from "@/features/history/historySlice";
function sysJsonOnly() {
  return `Eres un generador de JSON. Devuelve SOLO JSON válido, sin markdown, sin backticks, sin texto extra.`;
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