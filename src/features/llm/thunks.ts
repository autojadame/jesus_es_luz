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

type VersionKey = "v1" | "v2";

const STYLE_TAGS: Record<VersionKey, string> = {
  v1: "Ballad, New Romanticism",
  v2: "Cinematic Modern Worship Pop",
};

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
  // evita títulos excesivamente genéricos
  const n = normTitle(x);
  const tooGeneric = new Set([
    "tu amor",
    "mi corazon",
    "eres tu",
    "mi dios",
    "mi senor",
    "dios mio",
    "gracias",
    "esperanza",
    "fe",
    "amor",
    "luz",
  ]);
  if (tooGeneric.has(n)) return false;
  return true;
}

/**
 * Comprueba si el título está disponible en el NAS para la carpeta del día + versión.
 * - Si el NAS está caído o el IPC no existe, NO bloquea (devuelve true).
 * - Intenta primero con {version,...}. Si falla por compat, reintenta sin version.
 */
async function checkTitleAvailableOnNas(params: {
  createdAt: number;
  songTitle: string;
  entryId: string;
  version: VersionKey;
}): Promise<boolean> {
  const api = (window as any)?.electronAPI?.library;
  if (!api?.checkSongTitle) return true;

  try {
    const out = await api.checkSongTitle({
      createdAt: params.createdAt,
      songTitle: params.songTitle,
      entryId: params.entryId,
      version: params.version,
    });
    return !!out?.available;
  } catch {
    try {
      // compat antigua (sin version)
      const out = await api.checkSongTitle({
        createdAt: params.createdAt,
        songTitle: params.songTitle,
        entryId: params.entryId,
      });
      return !!out?.available;
    } catch {
      return true;
    }
  }
}

async function llmGenerateUniqueTitle(args: {
  passageId: number;
  version: VersionKey;
  ref: string;
  testamento?: string;
  summaryTitulo?: string;
  summaryDescripcion?: string;
  letra: string;
  banned: Set<string>;
  createdAt: number;
  entryId: string;
}): Promise<string> {
  const MAX_RETRIES = 6;
  const temperature = 0.72;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    const bannedList = Array.from(args.banned).filter(Boolean).slice(0, 110);

    const user = [
      `Quiero un NUEVO título corto y memorable en español para una canción worship.`,
      `Versión: ${args.version.toUpperCase()} — Estilo: ${STYLE_TAGS[args.version]}.`,
      `Referencia: ${args.ref}.${args.testamento ? ` Testamento: ${args.testamento}.` : ""}`,
      args.summaryTitulo ? `Idea/tema: ${args.summaryTitulo}` : "",
      args.summaryDescripcion ? `Resumen: ${args.summaryDescripcion}` : "",
      "",
      `LETRA (solo para inspirarte, NO la repitas):`,
      String(args.letra ?? "").slice(0, 2200),
      "",
      `Reglas (estrictas):`,
      `- 2 a 6 palabras, cantable, sin comillas.`,
      `- Evita palabras repetidas muy típicas (p.ej., “aquietud”, “penumbra”) salvo que sea imprescindible.`,
      `- No repitas (ni muy parecido a) ninguno de estos títulos:`,
      bannedList.length ? bannedList.join(" | ") : "(ninguno)",
      "",
      `Devuelve SOLO JSON OBJETO con este formato exacto:`,
      `{ "id": ${args.passageId}, "titulo": "..." }`,
    ]
      .filter(Boolean)
      .join("\n");

    const resp = await window.electronAPI.deepseek.chat({
      model: "deepseek-chat",
      messages: [
        { role: "system", content: sysJsonOnly() },
        { role: "user", content: user },
      ],
      max_tokens: 220,
      temperature,
    });

    const objText = extractJsonObject(resp.content);
    const parsed = JSON.parse(objText) as { id: number; titulo: string };

    const title = String(parsed?.titulo ?? "").trim();
    const n = normTitle(title);

    if (!isReasonableTitle(title)) {
      args.banned.add(n || `bad_${attempt}`);
      continue;
    }

    if (args.banned.has(n)) {
      args.banned.add(n);
      continue;
    }

    const okNas = await checkTitleAvailableOnNas({
      createdAt: args.createdAt,
      songTitle: title,
      entryId: args.entryId,
      version: args.version,
    });

    if (!okNas) {
      args.banned.add(n);
      continue;
    }

    return title;
  }

  throw new Error("No se pudo generar un título único (demasiados intentos/repeticiones).");
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

const SONG_PROMPT_BASE = `Escribe una letra original en español, estilo balada worship cristiano, emocional, íntima y profesional, con rima suave y cantable. Letra original de adoración, inspirada en fe cristiana, no basada en textos bíblicos literales.
Estructura obligatoria: Estrofa 1, Estrofa 2, Pre-chorus, Estribillo, Estrofa 3, Pre-chorus 2, Estribillo, Bridge, Estribillo final.
Mantén un lenguaje moderno pero reverente, imágenes poéticas, progresión emocional (de fragilidad a esperanza), y evita clichés repetidos.
Longitud aproximada: 3–4 min.

Reglas extra:
- Prohibido usar “Jehová”. Usa “Señor”, “Dios”, “Cristo”, “Salvador”, “Padre”, “Altísimo”.
- Evita repetir palabras “muletilla” entre canciones (p.ej. “aquietud”, “penumbra”).
Entrega: solo la letra con títulos de secciones, sin explicación.`;

export function generateSong(p: BibleItem, summary?: { titulo?: string; descripcion?: string }) {
  return async (dispatch: AppDispatch, getState: () => RootState) => {
    dispatch(songStart(p.id));
    try {
      const st0 = getState();
      const s0 = st0.llm.summariesById[p.id];

      // ✅ entryId/createdAt desde aquí para poder comprobar colisiones por carpeta del día
      const createdAt = Date.now();
      const entryId = `${p.id}-${createdAt}-${Math.random().toString(16).slice(2)}`;

      const ref = `${p.libro} ${p.capitulo}:${p.versiculo_inicial}-${p.versiculo_final}`;

      // ✅ Cache títulos usados (histórico + memoria)
      const banned = new Set<string>();
      for (const h of (st0.history.entries as any) ?? []) {
        const t1 = String(h?.songTituloV1 ?? h?.songTitulo ?? "").trim();
        const t2 = String(h?.songTituloV2 ?? "").trim();
        if (t1) banned.add(normTitle(t1));
        if (t2) banned.add(normTitle(t2));
      }
      for (const k of Object.keys(st0.llm.songsById ?? {})) {
        const ss = (st0.llm.songsById as any)?.[Number(k)];
        if (ss?.titulo) banned.add(normTitle(ss.titulo));
      }

      // 1) Generar letra + (opcional) sugerencia de 2 títulos
      const user = [
        SONG_PROMPT_BASE,
        ``,
        `Inspiración (NO literal):`,
        `- Referencia: ${ref}`,
        `- Testamento: ${p.testamento}`,
        summary?.titulo ? `- Título/tema: ${summary.titulo}` : s0?.titulo ? `- Título/tema: ${s0.titulo}` : ``,
        summary?.descripcion ? `- Resumen: ${summary.descripcion}` : s0?.descripcion ? `- Resumen: ${s0.descripcion}` : ``,
        ``,
        `Devuelve SOLO JSON OBJETO con este formato:`,
        `{ "id": ${p.id}, "titulo_v1": "título corto", "titulo_v2": "título corto", "letra": "LETRA COMPLETA CON SECCIONES" }`,
        `Reglas de títulos (estrictas):`,
        `- 2 a 6 palabras, sin comillas.`,
        `- V1 y V2 deben ser distintos entre sí.`,
        `- No uses ninguno de estos títulos (ni muy parecido): ${Array.from(banned).slice(0, 80).join(" | ") || "(ninguno)"}`,
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
      const raw = JSON.parse(objText) as any;

      const letra = String(raw?.letra ?? "").trim();
      if (!letra) throw new Error("La IA no devolvió letra.");

      let tituloV1 = String(raw?.titulo_v1 ?? raw?.titulo ?? "").trim();
      let tituloV2 = String(raw?.titulo_v2 ?? "").trim();

      // 2) Validación estricta + disponibilidad NAS por versión
      const st = getState();
      const s = st.llm.summariesById[p.id];

      const ensureTitle = async (version: VersionKey, proposed: string) => {
        const n = normTitle(proposed);
        if (!isReasonableTitle(proposed) || !proposed || banned.has(n)) return "";
        const okNas = await checkTitleAvailableOnNas({ createdAt, songTitle: proposed, entryId, version });
        if (!okNas) return "";
        return proposed;
      };

      tituloV1 = await ensureTitle("v1", tituloV1);
      if (!tituloV1) {
        tituloV1 = await llmGenerateUniqueTitle({
          passageId: p.id,
          version: "v1",
          ref,
          testamento: String(p.testamento ?? ""),
          summaryTitulo: summary?.titulo ?? s?.titulo ?? "",
          summaryDescripcion: summary?.descripcion ?? s?.descripcion ?? "",
          letra,
          banned,
          createdAt,
          entryId,
        });
      }
      banned.add(normTitle(tituloV1));

      tituloV2 = await ensureTitle("v2", tituloV2);
      if (!tituloV2 || normTitle(tituloV2) === normTitle(tituloV1)) {
        // aseguramos que sea distinto a V1
        banned.add(normTitle(tituloV2 || tituloV1));
        tituloV2 = await llmGenerateUniqueTitle({
          passageId: p.id,
          version: "v2",
          ref,
          testamento: String(p.testamento ?? ""),
          summaryTitulo: summary?.titulo ?? s?.titulo ?? "",
          summaryDescripcion: summary?.descripcion ?? s?.descripcion ?? "",
          letra,
          banned,
          createdAt,
          entryId,
        });
      }

      // ✅ Guardamos en estado: titulo = V1 (compat)
      const parsed: SongResult = {
        id: p.id,
        titulo: tituloV1,
        letra,
      };

      dispatch(songSuccess(parsed));

      // ✅ Persistir histórico (guardamos V1+V2 en campos extra si existen en el tipo; si no, casteamos)
      dispatch(
        addHistoryEntry({
          entryId,
          createdAt,
          passageId: p.id,
          libro: p.libro,
          capitulo: p.capitulo,
          versiculo_inicial: p.versiculo_inicial,
          versiculo_final: p.versiculo_final,
          testamento: String(p.testamento),
          texto: p.texto,

          summaryTitulo: summary?.titulo ?? s?.titulo ?? "",
          summaryDescripcion: summary?.descripcion ?? s?.descripcion ?? "",

          songTitulo: tituloV1,
          songTituloV1: tituloV1,
          songTituloV2: tituloV2,
          songLetra: letra,
        } as any)
      );
    } catch (e: any) {
      dispatch(songError({ id: p.id, error: e?.message ?? "Error generando canción" }));
    }
  };
}

/**
 * ✅ Regenera SOLO los títulos (V1 + V2) del pasaje actual.
 * - No toca la letra.
 * - Evita repetir en histórico/estado actual.
 * - Comprueba colisión con carpetas NAS por versión.
 *
 * Nota: para reflejarlo en el histórico sin crear nueva entrada, necesitas reducers de update en historySlice.
 */
export function regenerateSongTitle(passageId: number) {
  return async (dispatch: AppDispatch, getState: () => RootState) => {
    dispatch(songStart(passageId));

    try {
      const st0 = getState();
      const passage = (st0.settings as any)?.items?.find((x: any) => x.id === passageId) as BibleItem | undefined;
      if (!passage) throw new Error("Pasaje no encontrado.");

      const currentSong = st0.llm.songsById?.[passageId] as any;
      if (!currentSong?.letra) throw new Error("No hay letra aún. Primero genera la canción.");

      const latest = ((st0.history.entries as any) ?? []).find((x: any) => x?.passageId === passageId);
      const entryId = String((latest as any)?.entryId ?? `${passageId}-${Date.now()}-${Math.random().toString(16).slice(2)}`);
      const createdAt = Number((latest as any)?.createdAt ?? Date.now());

      const summary = st0.llm.summariesById?.[passageId];
      const ref = `${passage.libro} ${passage.capitulo}:${passage.versiculo_inicial}-${passage.versiculo_final}`;

      const banned = new Set<string>();
      for (const h of (st0.history.entries as any) ?? []) {
        const t1 = String(h?.songTituloV1 ?? h?.songTitulo ?? "").trim();
        const t2 = String(h?.songTituloV2 ?? "").trim();
        if (t1) banned.add(normTitle(t1));
        if (t2) banned.add(normTitle(t2));
      }
      for (const k of Object.keys(st0.llm.songsById ?? {})) {
        const ss = (st0.llm.songsById as any)?.[Number(k)];
        if (ss?.titulo) banned.add(normTitle(ss.titulo));
      }
      if (currentSong?.titulo) banned.add(normTitle(currentSong.titulo));

      const tituloV1 = await llmGenerateUniqueTitle({
        passageId,
        version: "v1",
        ref,
        testamento: String(passage.testamento ?? ""),
        summaryTitulo: summary?.titulo ?? "",
        summaryDescripcion: summary?.descripcion ?? "",
        letra: String(currentSong.letra),
        banned,
        createdAt,
        entryId,
      });
      banned.add(normTitle(tituloV1));

      const tituloV2 = await llmGenerateUniqueTitle({
        passageId,
        version: "v2",
        ref,
        testamento: String(passage.testamento ?? ""),
        summaryTitulo: summary?.titulo ?? "",
        summaryDescripcion: summary?.descripcion ?? "",
        letra: String(currentSong.letra),
        banned,
        createdAt,
        entryId,
      });

      const updated: SongResult = {
        id: passageId,
        titulo: tituloV1,
        letra: currentSong.letra,
      };

      dispatch(songSuccess(updated));

      // ✅ Si implementas reducers de update en historySlice, aquí actualizas:
      // dispatch(updateSongTitleForLatestByPassage({ passageId, version: "v1", songTitulo: tituloV1 }));
      // dispatch(updateSongTitleForLatestByPassage({ passageId, version: "v2", songTitulo: tituloV2 }));

      // Si NO tienes reducers, al menos evita colisiones futuras en esta sesión:
      banned.add(normTitle(tituloV2));
    } catch (e: any) {
      dispatch(songError({ id: passageId, error: e?.message ?? "Error regenerando títulos" }));
    }
  };
}
