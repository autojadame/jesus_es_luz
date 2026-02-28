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

/**
 * ✅ Validador de estructura para letras con etiquetas [..]
 * - Etiquetas obligatorias: [Verse 1], [Verse 2], [Pre-Chorus], [Bridge], al menos 2 [Chorus]
 * - Debe empezar por [Verse 1]
 * - Debe haber >=1 [Chorus] antes de [Bridge] y >=1 [Chorus] después de [Bridge]
 * - [Outro] opcional, solo al final
 * - Solo se permiten etiquetas: Verse 1/2/3, Pre-Chorus, Chorus, Bridge, Outro
 * - Ninguna sección vacía
 */
type LyricsValidation = { ok: true } | { ok: false; reason: string };

const HEADING_RE = /^\[(Verse 1|Verse 2|Verse 3|Pre-Chorus|Chorus|Bridge|Outro)\]$/;
const ALLOWED_HEADINGS = new Set([
  "[Verse 1]",
  "[Verse 2]",
  "[Verse 3]",
  "[Pre-Chorus]",
  "[Chorus]",
  "[Bridge]",
  "[Outro]",
]);

function validateLyricsStructure(letra: string): LyricsValidation {
  const raw = String(letra ?? "").replace(/\r\n/g, "\n").trim();
  if (!raw) return { ok: false, reason: "La letra está vacía." };

  const lines = raw.split("\n").map((l) => l.trim());
  const nonEmpty = lines.filter(Boolean);
  if (nonEmpty.length < 16) return { ok: false, reason: "La letra es demasiado corta." };

  const headings: Array<{ h: string; line: number }> = [];
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    if (!l) continue;
    if (l.startsWith("[") && l.endsWith("]")) {
      if (!HEADING_RE.test(l)) {
        return {
          ok: false,
          reason: `Etiqueta inválida '${l}'. Solo se permiten: [Verse 1],[Verse 2],[Verse 3],[Pre-Chorus],[Chorus],[Bridge],[Outro].`,
        };
      }
      if (!ALLOWED_HEADINGS.has(l)) {
        return { ok: false, reason: `Etiqueta no permitida: ${l}` };
      }
      headings.push({ h: l, line: i });
    }
  }

  if (!headings.length) return { ok: false, reason: "No hay etiquetas de sección entre corchetes." };
  if (headings[0].h !== "[Verse 1]") return { ok: false, reason: "La letra debe empezar por [Verse 1]." };

  const hasV2 = headings.some((x) => x.h === "[Verse 2]");
  const hasPre = headings.some((x) => x.h === "[Pre-Chorus]");
  const hasBridge = headings.some((x) => x.h === "[Bridge]");
  if (!hasV2) return { ok: false, reason: "Falta [Verse 2]." };
  if (!hasPre) return { ok: false, reason: "Falta [Pre-Chorus]." };
  if (!hasBridge) return { ok: false, reason: "Falta [Bridge]." };

  const chorusLines = headings.filter((x) => x.h === "[Chorus]").map((x) => x.line);
  if (chorusLines.length < 2) return { ok: false, reason: "Debe haber al menos 2 secciones [Chorus]." };

  const bridgeLine = headings.find((x) => x.h === "[Bridge]")!.line;
  const chorusBeforeBridge = chorusLines.some((ln) => ln < bridgeLine);
  const chorusAfterBridge = chorusLines.some((ln) => ln > bridgeLine);
  if (!chorusBeforeBridge) return { ok: false, reason: "Debe haber al menos 1 [Chorus] antes de [Bridge]." };
  if (!chorusAfterBridge) {
    return { ok: false, reason: "Debe haber al menos 1 [Chorus] después de [Bridge] (cierre final)." };
  }

  // Orden mínimo profesional: Verse1 < Pre-Chorus < Chorus < Verse2
  const idxVerse1 = headings.find((x) => x.h === "[Verse 1]")!.line;
  const idxPre = headings.find((x) => x.h === "[Pre-Chorus]")!.line;
  const idxCh1 = chorusLines[0];
  const idxVerse2 = headings.find((x) => x.h === "[Verse 2]")!.line;
  if (!(idxVerse1 < idxPre && idxPre < idxCh1 && idxCh1 < idxVerse2)) {
    return {
      ok: false,
      reason:
        "Orden mínimo inválido. Debe seguir: [Verse 1] → [Pre-Chorus] → [Chorus] → [Verse 2] (en ese orden).",
    };
  }

  // Última sección: [Chorus] o [Outro]
  const lastH = headings[headings.length - 1].h;
  if (lastH !== "[Chorus]" && lastH !== "[Outro]") {
    return { ok: false, reason: "La última sección debe ser [Chorus] o [Outro]." };
  }
  if (lastH === "[Outro]") {
    // Outro solo al final y después del último chorus
    const lastCh = chorusLines[chorusLines.length - 1];
    const outroLine = headings[headings.length - 1].line;
    if (!(lastCh < outroLine)) return { ok: false, reason: "Si hay [Outro], debe ir al final tras el último [Chorus]." };
  }

  // Secciones no vacías
  for (let i = 0; i < headings.length; i++) {
    const start = headings[i].line;
    const end = i + 1 < headings.length ? headings[i + 1].line : lines.length;
    const chunk = lines.slice(start + 1, end).filter((x) => x && !HEADING_RE.test(x));
    if (chunk.length === 0) return { ok: false, reason: `La sección ${headings[i].h} está vacía.` };
  }

  return { ok: true };
}

/**
 * ✅ Prompt NUEVO: etiquetas [..] + estructura profesional flexible
 * - Outro opcional
 * - mínimo 2 Chorus, y uno debe ir tras el Bridge
 */
const SONG_PROMPT_BASE = `
Quiero que compongas una letra ORIGINAL en español, “lista para grabar”, estilo balada worship cristiano (70–90 BPM), íntima, emotiva y profesional.

Estilo (muy importante):
- Cadencia y enfoque narrativo como una balada moderna: versos largos, imágenes concretas, emoción progresiva (fragilidad → consuelo → confianza).
- Rima suave/asonante y frases muy cantables (sin trabalenguas, sin rimas forzadas).
- Lenguaje moderno y reverente, sin exceso de jerga evangélica.
- PROHIBIDO usar “Jehová”. Usa principalmente “Señor” y “Padre” (puedes usar “Dios”, “Cristo”, “Salvador” con coherencia).
- No copies textos bíblicos literales.

FORMATO OBLIGATORIO (etiquetas EXACTAS, entre [] y en una línea sola):
- Debe empezar por [Verse 1].
- Debe incluir: [Verse 2], [Pre-Chorus], [Bridge] y al menos 2 bloques [Chorus].
- Debe haber al menos 1 [Chorus] ANTES de [Bridge] y al menos 1 [Chorus] DESPUÉS de [Bridge].
- Etiquetas permitidas (NO uses otras):
  [Verse 1]
  [Verse 2]
  [Verse 3]   (opcional)
  [Pre-Chorus]
  [Chorus]
  [Bridge]
  [Outro]     (opcional, solo al final)

Estructura profesional recomendada (flexible, pero coherente):
[Verse 1] → [Pre-Chorus] → [Chorus] → [Verse 2] → (opcional [Pre-Chorus]) → [Chorus] → [Bridge] → [Chorus] → (opcional [Outro])

Reglas adicionales:
- Cada sección debe tener letra debajo (no dejes secciones vacías).
- No escribas explicaciones. Dentro del campo "letra" entrega SOLO la letra con sus etiquetas (sin markdown, sin backticks).
`.trim();

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

export function generateSong(p: BibleItem, summary?: { titulo?: string; descripcion?: string }) {
  return async (dispatch: AppDispatch, getState: () => RootState) => {
    dispatch(songStart(p.id));
    try {
      const st0 = getState();
      const s0 = st0.llm.summariesById[p.id];

      // ✅ Persistir histórico (necesitamos entryId para reservar carpeta)
      const createdAt = Date.now();
      const entryId = `${p.id}-${createdAt}-${Math.random().toString(16).slice(2)}`;

      // ✅ Generación LLM con reintentos si la estructura de letra no cumple
      const MAX_LYRICS_RETRIES = 4;
      let lastReason = "";
      let parsedRaw: any = null;

      for (let attempt = 1; attempt <= MAX_LYRICS_RETRIES; attempt++) {
        const user = [
          SONG_PROMPT_BASE,
          ``,
          `Inspiración (NO literal):`,
          `- Referencia: ${p.libro} ${p.capitulo}:${p.versiculo_inicial}-${p.versiculo_final}`,
          `- Testamento: ${p.testamento}`,
          summary?.titulo ? `- Título/tema: ${summary.titulo}` : s0?.titulo ? `- Título/tema: ${s0.titulo}` : ``,
          summary?.descripcion
            ? `- Resumen: ${summary.descripcion}`
            : s0?.descripcion
              ? `- Resumen: ${s0.descripcion}`
              : ``,
          ``,
          attempt > 1
            ? `IMPORTANTE: El intento anterior fue RECHAZADO por: ${lastReason || "estructura inválida"}. Corrige y cumple ESTRICTAMENTE el FORMATO OBLIGATORIO.`
            : ``,
          ``,
          `Devuelve SOLO JSON OBJETO con este formato:`,
          `{ "id": ${p.id}, "titulo_v1": "título corto", "titulo_v2": "título corto", "letra": "LETRA COMPLETA CON ETIQUETAS" }`,
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
        const candidate = JSON.parse(objText) as any;

        const letra = String(candidate?.letra ?? "").trim();
        const v = validateLyricsStructure(letra);
        if (!v.ok) {
          lastReason = v.reason;
          continue;
        }

        // ok
        parsedRaw = candidate;
        break;
      }

      if (!parsedRaw) {
        throw new Error(
          `No se pudo generar una letra válida con las etiquetas requeridas tras ${MAX_LYRICS_RETRIES} intentos. Último motivo: ${lastReason}`
        );
      }

      let tituloV1 = String(parsedRaw?.titulo_v1 ?? parsedRaw?.titulo ?? "").trim();
      let tituloV2 = String(parsedRaw?.titulo_v2 ?? "").trim();
      const letra = String(parsedRaw?.letra ?? "").trim();

      // ✅ si la IA no devuelve 2 títulos válidos/diferentes, los regeneramos aquí
      const st = getState();
      const s = st.llm.summariesById[p.id];

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
      if (
        !isReasonableTitle(tituloV2) ||
        normTitle(tituloV2) === normTitle(tituloV1) ||
        banned.has(normTitle(tituloV2))
      ) {
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
        const other =
          payload.version === "v1"
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