// src/features/llm/thunks.ts
import type { AppDispatch, RootState } from "@/app/store";
import type { BibleItem } from "@/types/bible";
import type { PassageSummary, SongResult } from "@/types/llm";
import type { HistoryEntry } from "@/types/history";

import { extractJsonArray, extractJsonObject } from "@/utils/json";
import {
  summariesStart,
  summariesSuccess,
  summariesError,
  songStart,
  songSuccess,
  songError,
} from "./llmSlice";
import {
  addHistoryEntry,
  updateSongTitleForEntryId,
  updateSongTitleForLatestByPassage,
} from "@/features/history/historySlice";

type VersionKey = "v1" | "v2";

type SongResult2 = SongResult & {
  tituloV2?: string;
};

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
  return true;
}

function pickLatestHistoryEntryByPassage(entries: HistoryEntry[], passageId: number) {
  return (entries ?? []).find((x) => x.passageId === passageId);
}

async function checkTitleAvailableOnNas(params: {
  createdAt: number;
  songTitle: string;
  entryId?: string;
}): Promise<boolean> {
  try {
    const out = await (window as any).electronAPI.library.checkSongTitle({
      createdAt: params.createdAt,
      songTitle: params.songTitle,
      entryId: params.entryId,
    });
    return !!out?.available;
  } catch {
    // ✅ si no se puede comprobar (NAS caído), no bloqueamos
    return true;
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
  entryId?: string;
}): Promise<string> {
  const MAX_RETRIES = 5;
  const temperature = 0.7;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    const bannedList = Array.from(args.banned).filter(Boolean).slice(0, 90);

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
      `Reglas:`,
      `- 2 a 6 palabras, cantable, sin comillas.`,
      `- Evita títulos genéricos tipo “Tu Amor”, “Mi Corazón”, “Eres Tú”.`,
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
      max_tokens: 200,
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
    });

    if (!okNas) {
      args.banned.add(n);
      continue;
    }

    return title;
  }

  throw new Error("No se pudo generar un título único (demasiadas repeticiones).");
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
        `{ "id": ${p.id}, "titulo_v1": "título corto", "titulo_v2": "título corto", "letra": "LETRA COMPLETA CON SECCIONES" }`,
        `Reglas de títulos:`,
        `- 2 a 6 palabras, sin comillas.`,
        `- V1 y V2 deben ser distintos entre sí.`,
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
      const parsedRaw = JSON.parse(objText) as any;

      let tituloV1 = String(parsedRaw?.titulo_v1 ?? parsedRaw?.titulo ?? "").trim();
      let tituloV2 = String(parsedRaw?.titulo_v2 ?? "").trim();
      const letra = String(parsedRaw?.letra ?? "").trim();

      // ✅ Persistir histórico (necesitamos entryId para reservar carpeta)
      const st = getState();
      const s = st.llm.summariesById[p.id];
      const createdAt = Date.now();
      const entryId = `${p.id}-${createdAt}-${Math.random().toString(16).slice(2)}`;

      // ✅ si la IA no devuelve 2 títulos válidos/diferentes, los regeneramos aquí
      const banned = new Set<string>();
      for (const h of (st.history.entries as any) ?? []) {
        const t1 = String(h?.songTituloV1 ?? h?.songTitulo ?? "").trim();
        const t2 = String(h?.songTituloV2 ?? "").trim();
        if (t1) banned.add(normTitle(t1));
        if (t2) banned.add(normTitle(t2));
      }
      for (const k of Object.keys(st.llm.songsById ?? {})) {
        const ss = (st.llm.songsById as any)?.[Number(k)];
        if (ss?.titulo) banned.add(normTitle(ss.titulo));
        if (ss?.tituloV2) banned.add(normTitle(ss.tituloV2));
      }

      const ref = `${p.libro} ${p.capitulo}:${p.versiculo_inicial}-${p.versiculo_final}`;

      // V1
      if (!isReasonableTitle(tituloV1) || banned.has(normTitle(tituloV1))) {
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

      // V2
      if (!isReasonableTitle(tituloV2) || normTitle(tituloV2) === normTitle(tituloV1) || banned.has(normTitle(tituloV2))) {
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

      const parsed: SongResult2 = {
        id: Number(parsedRaw?.id ?? p.id),
        titulo: (tituloV1 || "") as any,
        tituloV2: tituloV2 || "",
        letra,
      };

      dispatch(songSuccess(parsed as any));

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

          // ✅ compat + v1/v2
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
 * ✅ Regenera títulos (V1 + V2) para el pasaje actual.
 * - No toca la letra.
 * - Evita repetir en histórico/estado actual.
 * - Comprueba colisión con carpeta de NAS (reserva por entryId).
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

      const latest = pickLatestHistoryEntryByPassage(st0.history.entries as any, passageId);
      const entryId = (latest as any)?.entryId as string | undefined;
      const createdAt = Number((latest as any)?.createdAt ?? Date.now());

      const summaryTitulo = (latest as any)?.summaryTitulo ?? st0.llm.summariesById?.[passageId]?.titulo ?? "";
      const summaryDescripcion =
        (latest as any)?.summaryDescripcion ?? st0.llm.summariesById?.[passageId]?.descripcion ?? "";

      // ✅ Cache de títulos usados
      const banned = new Set<string>();

      for (const h of (st0.history.entries as any) ?? []) {
        const t1 = String(h?.songTituloV1 ?? h?.songTitulo ?? "").trim();
        const t2 = String(h?.songTituloV2 ?? "").trim();
        if (t1) banned.add(normTitle(t1));
        if (t2) banned.add(normTitle(t2));
      }

      for (const k of Object.keys(st0.llm.songsById ?? {})) {
        const s = (st0.llm.songsById as any)?.[Number(k)];
        if (s?.titulo) banned.add(normTitle(s.titulo));
        if (s?.tituloV2) banned.add(normTitle(s.tituloV2));
      }

      if (currentSong.titulo) banned.add(normTitle(currentSong.titulo));
      if (currentSong.tituloV2) banned.add(normTitle(currentSong.tituloV2));

      const ref = `${passage.libro} ${passage.capitulo}:${passage.versiculo_inicial}-${passage.versiculo_final}`;

      const newV1 = await llmGenerateUniqueTitle({
        passageId,
        version: "v1",
        ref,
        testamento: String(passage.testamento ?? ""),
        summaryTitulo,
        summaryDescripcion,
        letra: currentSong.letra,
        banned,
        createdAt,
        entryId,
      });

      banned.add(normTitle(newV1));

      const newV2 = await llmGenerateUniqueTitle({
        passageId,
        version: "v2",
        ref,
        testamento: String(passage.testamento ?? ""),
        summaryTitulo,
        summaryDescripcion,
        letra: currentSong.letra,
        banned,
        createdAt,
        entryId,
      });

      const updated: SongResult2 = {
        id: passageId,
        titulo: newV1 as any,
        tituloV2: newV2,
        letra: currentSong.letra,
      };

      dispatch(songSuccess(updated as any));

      // ✅ actualiza histórico
      if (entryId) {
        dispatch(updateSongTitleForEntryId({ entryId, version: "v1", songTitulo: newV1 }));
        dispatch(updateSongTitleForEntryId({ entryId, version: "v2", songTitulo: newV2 }));
      } else {
        dispatch(updateSongTitleForLatestByPassage({ passageId, version: "v1", songTitulo: newV1 }));
        dispatch(updateSongTitleForLatestByPassage({ passageId, version: "v2", songTitulo: newV2 }));
      }

      return { v1: newV1, v2: newV2 };
    } catch (e: any) {
      dispatch(songError({ id: passageId, error: e?.message ?? "Error regenerando títulos" }));
      throw e;
    }
  };
}

/**
 * ✅ Regenera SOLO el título de una versión para una entrada concreta del histórico.
 * Se usa para colisión con carpeta existente (NAS).
 */
export function regenerateSongTitleForEntry(payload: {
  entryId: string;
  passageId: number;
  version: VersionKey;
  createdAt: number;
  libro: string;
  capitulo: number;
  versiculo_inicial: number;
  versiculo_final: number;
  testamento?: string;
  summaryTitulo?: string;
  summaryDescripcion?: string;
  letra: string;
}) {
  return async (dispatch: AppDispatch, getState: () => RootState) => {
    dispatch(songStart(payload.passageId));

    try {
      const st0 = getState();

      const banned = new Set<string>();

      for (const h of (st0.history.entries as any) ?? []) {
        const t1 = String(h?.songTituloV1 ?? h?.songTitulo ?? "").trim();
        const t2 = String(h?.songTituloV2 ?? "").trim();
        if (t1) banned.add(normTitle(t1));
        if (t2) banned.add(normTitle(t2));
      }

      for (const k of Object.keys(st0.llm.songsById ?? {})) {
        const s = (st0.llm.songsById as any)?.[Number(k)];
        if (s?.titulo) banned.add(normTitle(s.titulo));
        if (s?.tituloV2) banned.add(normTitle(s.tituloV2));
      }

      // evita que v1=v2 dentro de la misma entrada
      const entry = (st0.history.entries as any)?.find((x: any) => x.entryId === payload.entryId);
      if (entry) {
        const other = payload.version === "v1"
          ? String(entry?.songTituloV2 ?? "").trim()
          : String(entry?.songTituloV1 ?? entry?.songTitulo ?? "").trim();
        if (other) banned.add(normTitle(other));
      }

      const ref = `${payload.libro} ${payload.capitulo}:${payload.versiculo_inicial}-${payload.versiculo_final}`;

      const title = await llmGenerateUniqueTitle({
        passageId: payload.passageId,
        version: payload.version,
        ref,
        testamento: String(payload.testamento ?? ""),
        summaryTitulo: payload.summaryTitulo,
        summaryDescripcion: payload.summaryDescripcion,
        letra: payload.letra,
        banned,
        createdAt: payload.createdAt,
        entryId: payload.entryId,
      });

      // ✅ update history entry
      dispatch(updateSongTitleForEntryId({ entryId: payload.entryId, version: payload.version, songTitulo: title }));

      // ✅ si la canción está en memoria, actualiza ahí también
      const cur = (st0.llm.songsById as any)?.[payload.passageId];
      if (cur?.letra) {
        const updated: SongResult2 = {
          id: payload.passageId,
          titulo: (payload.version === "v1" ? title : (cur.titulo as any)) as any,
          tituloV2: payload.version === "v2" ? title : String(cur.tituloV2 ?? ""),
          letra: cur.letra,
        };
        dispatch(songSuccess(updated as any));
      }

      return title;
    } catch (e: any) {
      dispatch(songError({ id: payload.passageId, error: e?.message ?? "Error regenerando título" }));
      throw e;
    }
  };
}
