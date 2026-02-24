// src/main/topmedia.ts
import https from "https";
import fs from "fs";
import path from "path";
import { app } from "electron";
import { TOPMEDIA_AI_APIKEY, TOPMEDIA_AI_BASE_URL } from "./constants";

type AnyObj = Record<string, any>;

function postJson(url: string, payload: any, headers: Record<string, string>) {
  return new Promise<string>((resolve, reject) => {
    const u = new URL(url);

    const req = https.request(
      {
        method: "POST",
        hostname: u.hostname,
        path: u.pathname + u.search,
        headers: {
          "Content-Type": "application/json",
          ...headers,
        },
      },
      (res) => {
        let data = "";
        res.on("data", (c) => (data += String(c)));
        res.on("end", () => {
          const ok = res.statusCode && res.statusCode >= 200 && res.statusCode < 300;
          if (ok) resolve(data);
          else reject(new Error(`HTTP ${res.statusCode}: ${data}`));
        });
      }
    );

    req.on("error", reject);
    req.write(JSON.stringify(payload));
    req.end();
  });
}

function getJson(url: string, headers: Record<string, string>) {
  return new Promise<string>((resolve, reject) => {
    const u = new URL(url);

    const req = https.request(
      {
        method: "GET",
        hostname: u.hostname,
        path: u.pathname + u.search,
        headers: { ...headers },
      },
      (res) => {
        let data = "";
        res.on("data", (c) => (data += String(c)));
        res.on("end", () => {
          const ok = res.statusCode && res.statusCode >= 200 && res.statusCode < 300;
          if (ok) resolve(data);
          else reject(new Error(`HTTP ${res.statusCode}: ${data}`));
        });
      }
    );

    req.on("error", reject);
    req.end();
  });
}

function getToFile(url: string, outPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const u = new URL(url);

    const request = https.get(
      {
        hostname: u.hostname,
        path: u.pathname + u.search,
      },
      (res) => {
        // redirects
        if (res.statusCode && [301, 302, 307, 308].includes(res.statusCode) && res.headers.location) {
          res.resume();
          return resolve(getToFile(res.headers.location, outPath));
        }

        if (!res.statusCode || res.statusCode < 200 || res.statusCode >= 300) {
          let err = "";
          res.on("data", (c) => (err += String(c)));
          res.on("end", () => reject(new Error(`Download HTTP ${res.statusCode}: ${err}`)));
          return;
        }

        fs.mkdirSync(path.dirname(outPath), { recursive: true });
        const file = fs.createWriteStream(outPath);
        res.pipe(file);
        file.on("finish", () => file.close(() => resolve()));
        file.on("error", reject);
      }
    );

    request.on("error", reject);
  });
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function compactText(s: string) {
  return String(s ?? "")
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

function limitWords(text: string, maxWords: number) {
  const words = compactText(text).split(/\s+/);
  if (words.length <= maxWords) return compactText(text);
  return words.slice(0, maxWords).join(" ");
}

function extractTaskIds(json: any): string[] {
  // Muy tolerante: intenta varias formas típicas
  if (!json) return [];
  if (Array.isArray(json)) {
    // ["id1","id2"] o [{id:"..."}, ...]
    const ids = json
      .map((x) => (typeof x === "string" ? x : x?.id || x?.task_id))
      .filter(Boolean);
    return Array.from(new Set(ids));
  }

  const direct =
    json.id ||
    json.task_id ||
    json.song_id ||
    json.data?.id ||
    json.data?.task_id;

  if (typeof direct === "string" && direct.trim()) return [direct.trim()];

  const maybeArr =
    json.ids ||
    json.task_ids ||
    json.data?.ids ||
    json.data?.task_ids ||
    json.data;

  if (Array.isArray(maybeArr)) {
    const ids = maybeArr
      .map((x) => (typeof x === "string" ? x : x?.id || x?.task_id))
      .filter(Boolean);
    return Array.from(new Set(ids));
  }

  // fallback: busca cualquier string "id" en primer nivel
  const firstLevelIds: string[] = [];
  for (const [k, v] of Object.entries(json)) {
    if (typeof v === "string" && /id/i.test(k) && v.trim()) firstLevelIds.push(v.trim());
  }
  return Array.from(new Set(firstLevelIds));
}

export type TopmediaGenerateInput = {
  passageId: number;
  variant: number;
  title: string;
  lyrics: string;
  prompt?: string; // estilo/mood
  mv?: "v5.0" | "v4.5-plus" | "v4.5" | "v4.0" | "v3.5" | "v3.0";
  gender?: "male" | "female" | "";
};

export type TopmediaGenerateOutput = {
  passageId: number;
  variant: number;
  mp3Url?: string;
  srtUrl?: string; // v3 normalmente no da srt_url; creamos fichero local
  mp3Path: string;
  srtPath: string;
  lyricText?: string;
  taskId?: string;
};

export async function topmediaGenerateAndDownloadOne(
  input: TopmediaGenerateInput
): Promise<TopmediaGenerateOutput> {
  if (!TOPMEDIA_AI_APIKEY) throw new Error("TOPMEDIA_AI_APIKEY no configurada.");

  // ✅ v3 soporta letras MUY largas en modelos nuevos (hasta 5.000 palabras según doc). :contentReference[oaicite:2]{index=2}
  // Aun así, ponemos un límite con margen para evitar “payload gigante”.
  const safeLyrics = limitWords(input.lyrics, 4200);

  const style = compactText(input.prompt || "Ballad,New Romanticism.");
  const title = compactText(input.title || "Song");

  const mv = input.mv ?? "v5.0"; // recomendado por límite alto
  const gender = input.gender ?? "";

  // ✅ v3 submit task
  // Endpoint documentado: POST /v3/music/generate con x-api-key. :contentReference[oaicite:3]{index=3}
  // Nota: la doc muestra action="auto" para modo descripción, pero la API acepta otros modos.
  // Para letras propias usamos action="custom" y enviamos lyrics/title (se ignoran si el modo no aplica).
  const payload = {
    action: "custom",
    style,
    mv,
    instrumental: 0,
    gender,
    lyrics: safeLyrics,
    title,
  };

  const raw = await postJson(`${TOPMEDIA_AI_BASE_URL}/v3/music/generate`, payload, {
    "x-api-key": TOPMEDIA_AI_APIKEY,
  });

  let json: AnyObj;
  try {
    json = JSON.parse(raw);
  } catch {
    throw new Error(`TopMediai v3: respuesta no JSON: ${raw.slice(0, 300)}`);
  }

  const taskIds = extractTaskIds(json);
  if (!taskIds.length) {
    throw new Error(`TopMediai v3: no se pudieron extraer task ids. Resp: ${raw.slice(0, 400)}`);
  }

  // ✅ “Quiero que pida solo una”: si devuelve varias, cogemos la primera y listo.
  const taskId = taskIds[0];

  // ✅ poll tasks hasta que haya audio_url (GET /v3/music/tasks). :contentReference[oaicite:4]{index=4}
  const deadline = Date.now() + 3 * 60 * 1000; // 3 min
  let last: any = null;

  while (Date.now() < deadline) {
    const tasksRaw = await getJson(
      `${TOPMEDIA_AI_BASE_URL}/v3/music/tasks?ids=${encodeURIComponent(taskId)}`,
      { "x-api-key": TOPMEDIA_AI_APIKEY }
    );

    let tasks: any;
    try {
      tasks = JSON.parse(tasksRaw);
    } catch {
      tasks = null;
    }

    const t = Array.isArray(tasks) ? tasks[0] : null;
    last = t;

    // si falla
    if (t?.fail_reason || t?.fail_code) {
      throw new Error(`TopMediai v3 task failed: ${t.fail_reason || t.fail_code}`);
    }

    // listo si hay audio_url
    const audioUrl = t?.audio_url;
    if (typeof audioUrl === "string" && audioUrl.startsWith("http")) {
      const lyricText = typeof t?.lyric === "string" ? t.lyric : undefined;

      const baseDir = path.join(app.getPath("userData"), "media", String(input.passageId));
      const mp3Path = path.join(baseDir, `audio_v${input.variant}.mp3`);
      const srtPath = path.join(baseDir, `lyric_v${input.variant}.srt`);

      await getToFile(audioUrl, mp3Path);

      fs.mkdirSync(path.dirname(srtPath), { recursive: true });
      fs.writeFileSync(srtPath, (lyricText && lyricText.trim()) ? lyricText : safeLyrics, "utf8");

      return {
        passageId: input.passageId,
        variant: input.variant,
        mp3Url: audioUrl,
        srtUrl: undefined,
        mp3Path,
        srtPath,
        lyricText,
        taskId,
      };
    }

    await sleep(2500);
  }

  throw new Error(
    `TopMediai v3 timeout esperando audio_url (task=${taskId}). Último estado: ${JSON.stringify(last)?.slice(0, 400)}`
  );
}