import fs from "fs";
import path from "path";
import { app } from "electron";

const NAS_DEFAULT_ROOT = "\\\\192.168.1.143\\Storage";
const LIB_SUBPATH = ["INFORMATICOS", "Lis", "AlabanzasCristo"];

// ✅ marker para evitar mezclar carpetas antiguas con las nuevas
// (permite guardar MP3 y SRT en la MISMA carpeta, pero solo si “pertenece” a esta entrada)
const META_FILE = ".jesus-es-luz.meta.json";

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function formatYYYY_MM_DD(ts: number) {
  const d = new Date(ts);
  return `${d.getFullYear()}_${pad2(d.getMonth() + 1)}_${pad2(d.getDate())}`;
}

function safeName(s: string) {
  const x = String(s ?? "").trim() || "SinTitulo";
  return x
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, "_")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120);
}

function ensureExt(kind: "mp3" | "srt") {
  return kind === "mp3" ? ".mp3" : ".srt";
}

// --------------------
// Config NAS (persistente en userData)
// --------------------
type AppConfig = { nasRoot?: string };

function cfgPath() {
  return path.join(app.getPath("userData"), "jesus-es-luz.config.json");
}

async function readConfig(): Promise<AppConfig> {
  try {
    const txt = await fs.promises.readFile(cfgPath(), "utf8");
    const parsed = JSON.parse(txt);
    return parsed && typeof parsed === "object" ? (parsed as AppConfig) : {};
  } catch {
    return {};
  }
}

async function writeConfig(next: AppConfig) {
  await fs.promises.mkdir(path.dirname(cfgPath()), { recursive: true });
  await fs.promises.writeFile(cfgPath(), JSON.stringify(next, null, 2), "utf8");
}

function normalizeRoot(root: string) {
  const r = String(root ?? "").trim();
  return r || NAS_DEFAULT_ROOT;
}

export async function getNasRoot(): Promise<string> {
  const cfg = await readConfig();
  return normalizeRoot(cfg.nasRoot || NAS_DEFAULT_ROOT);
}

export async function setNasRoot(root: string): Promise<string> {
  const r = normalizeRoot(root);
  const cfg = await readConfig();
  await writeConfig({ ...cfg, nasRoot: r });
  return r;
}

export async function checkNasRoot(root: string): Promise<{ ok: boolean; message?: string }> {
  const r = normalizeRoot(root);
  try {
    const entries = await fs.promises.readdir(r);
    return { ok: true, message: `OK (${entries.length} items)` };
  } catch (e: any) {
    return { ok: false, message: e?.message ?? "Sin acceso" };
  }
}

function buildLibBase(nasRoot: string) {
  // UNC/Windows path
  return path.win32.join(nasRoot, ...LIB_SUBPATH);
}

export type SaveToLibraryInput = {
  kind: "mp3" | "srt";
  sourcePath: string;
  createdAt: number;
  songTitle: string;
  /**
   * ✅ Identificador estable de la entrada del histórico.
   * Se usa para “reservar” la carpeta (evita colisiones con carpetas ya existentes).
   */
  entryId?: string;
};

export type SaveToLibraryOutput = {
  destPath: string;
};

export type CheckSongTitleInput = {
  createdAt: number;
  songTitle: string;
  entryId?: string;
};

export type CheckSongTitleOutput = {
  /**
   * ✅ true si:
   * - la carpeta NO existe, o
   * - existe y el meta coincide con entryId (misma entrada)
   */
  available: boolean;
  destDir: string;
  ownerEntryId?: string;
  message?: string;
};

async function existsDirWin(p: string) {
  try {
    const st = await fs.promises.stat(p);
    return st.isDirectory();
  } catch {
    return false;
  }
}

async function existsFileWin(p: string) {
  try {
    const st = await fs.promises.stat(p);
    return st.isFile();
  } catch {
    return false;
  }
}

async function readMeta(metaPath: string): Promise<{ entryId?: string } | null> {
  try {
    const txt = await fs.promises.readFile(metaPath, "utf8");
    const parsed = JSON.parse(txt);
    if (!parsed || typeof parsed !== "object") return null;
    return { entryId: typeof parsed.entryId === "string" ? parsed.entryId : undefined };
  } catch {
    return null;
  }
}

function buildDestDir(createdAt: number, songTitle: string, nasRoot: string) {
  const LIB_BASE = buildLibBase(nasRoot);
  const dateFolder = formatYYYY_MM_DD(createdAt || Date.now());
  const songName = safeName(songTitle);
  const destDir = path.win32.join(LIB_BASE, dateFolder, songName);
  return { destDir, songName, dateFolder, LIB_BASE };
}

export async function checkSongTitleAvailability(
  input: CheckSongTitleInput
): Promise<CheckSongTitleOutput> {
  const nasRoot = await getNasRoot();
  const { destDir } = buildDestDir(input.createdAt || Date.now(), input.songTitle, nasRoot);

  const dirExists = await existsDirWin(destDir);
  if (!dirExists) {
    return { available: true, destDir };
  }

  const metaPath = path.win32.join(destDir, META_FILE);
  const meta = await readMeta(metaPath);

  // Si no hay meta, asumimos carpeta “externa/antigua”: no mezclamos
  if (!meta?.entryId) {
    return {
      available: false,
      destDir,
      message: "La carpeta ya existe en la librería (sin meta).",
    };
  }

  // Si coincide con entryId, es “nuestra” y es válida
  if (input.entryId && meta.entryId === input.entryId) {
    return { available: true, destDir, ownerEntryId: meta.entryId };
  }

  return {
    available: false,
    destDir,
    ownerEntryId: meta.entryId,
    message: "La carpeta ya existe en la librería (reservada por otra entrada).",
  };
}

export async function saveToLibrary(input: SaveToLibraryInput): Promise<SaveToLibraryOutput> {
  if (!input.sourcePath) throw new Error("sourcePath vacío.");

  const ext = ensureExt(input.kind);
  const srcLower = input.sourcePath.toLowerCase();

  if (!srcLower.endsWith(ext)) {
    throw new Error(`El archivo debe ser ${ext}.`);
  }

  const nasRoot = await getNasRoot();

  const { destDir, songName } = buildDestDir(input.createdAt || Date.now(), input.songTitle, nasRoot);
  const destPath = path.win32.join(destDir, `${songName}${ext}`);

  // ✅ legacy/compat: si no hay entryId, no hacemos reserva (comportamiento antiguo)
  if (!input.entryId) {
    await fs.promises.mkdir(destDir, { recursive: true });
    await fs.promises.copyFile(input.sourcePath, destPath);
    return { destPath };
  }

  // ✅ Si la carpeta ya existe y NO es nuestra (meta distinto o inexistente) => bloquear
  const titleCheck = await checkSongTitleAvailability({
    createdAt: input.createdAt || Date.now(),
    songTitle: input.songTitle,
    entryId: input.entryId,
  });
  if (!titleCheck.available) {
    throw new Error(
      `${titleCheck.message ?? "Título ocupado"} Genera otro título.\nCarpeta: ${titleCheck.destDir}`
    );
  }

  // ✅ crear carpeta si hace falta
  await fs.promises.mkdir(destDir, { recursive: true });

  // ✅ asegurar/crear meta
  const metaPath = path.win32.join(destDir, META_FILE);
  const metaExists = await existsFileWin(metaPath);
  if (!metaExists) {
    const payload = {
      entryId: input.entryId ?? "",
      createdAt: input.createdAt || Date.now(),
      songTitle: input.songTitle,
      createdAtIso: new Date(input.createdAt || Date.now()).toISOString(),
    };
    await fs.promises.writeFile(metaPath, JSON.stringify(payload, null, 2), "utf8");
  }

  // ✅ copiamos (si existía, se sobrescribe: útil cuando el usuario borra asignación y vuelve a subir)
  await fs.promises.copyFile(input.sourcePath, destPath);

  return { destPath };
}

export type CopyToDownloadsInput = { sourcePath: string };
export type CopyToDownloadsOutput = { downloadPath: string };

export async function copyToDownloads(input: CopyToDownloadsInput): Promise<CopyToDownloadsOutput> {
  if (!input.sourcePath) throw new Error("sourcePath vacío.");

  const downloadsDir = app.getPath("downloads");
  const fileName = path.win32.basename(input.sourcePath);
  const downloadPath = path.join(downloadsDir, fileName);

  await fs.promises.copyFile(input.sourcePath, downloadPath);
  return { downloadPath };
}