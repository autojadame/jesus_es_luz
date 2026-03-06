import fs from "fs";
import path from "path";
import { app } from "electron";

const NAS_DEFAULT_ROOT = "\\\\192.168.1.143\\Storage";
const LIB_SUBPATH = ["INFORMATICOS", "Lis", "AlabanzasCristo"];

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

function ensureExt(kind: "mp3" | "srt" | "wav") {
  return kind === "mp3" ? ".mp3" : kind === "wav" ? ".wav" : ".srt";
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
  return path.win32.join(nasRoot, ...LIB_SUBPATH);
}

type VersionKey = "v1" | "v2";
type FileKind = "mp3" | "srt" | "wav";

export type SaveToLibraryInput = {
  version: VersionKey;
  kind: FileKind;
  sourcePath: string;
  createdAt: number;
  songTitle: string;
  entryId?: string;
};

export type SaveToLibraryOutput = {
  destPath: string;
};

export type CheckSongTitleInput = {
  createdAt: number;
  songTitle: string;
  version: VersionKey;
};

export type CheckSongTitleOutput = {
  available: boolean;
  destDir: string;
};

function buildDateFolder(createdAt: number, version: VersionKey) {
  return `${formatYYYY_MM_DD(createdAt || Date.now())}_${String(version).toUpperCase()}`;
}

export async function checkSongTitleAvailability(
  input: CheckSongTitleInput
): Promise<CheckSongTitleOutput> {
  const nasRoot = await getNasRoot();
  const LIB_BASE = buildLibBase(nasRoot);

  const dateFolder = buildDateFolder(input.createdAt, input.version);
  const songName = safeName(input.songTitle);
  const destDir = path.win32.join(LIB_BASE, dateFolder, songName);

  try {
    const st = await fs.promises.stat(destDir);
    return { available: !st.isDirectory(), destDir };
  } catch {
    return { available: true, destDir };
  }
}

export async function saveToLibrary(input: SaveToLibraryInput): Promise<SaveToLibraryOutput> {
  if (!input.sourcePath) throw new Error("sourcePath vacío.");
  if (input.version !== "v1" && input.version !== "v2") {
    throw new Error("version inválida. Debe ser 'v1' o 'v2'.");
  }

  const ext = ensureExt(input.kind);
  const srcLower = input.sourcePath.toLowerCase();

  if (!srcLower.endsWith(ext)) {
    throw new Error(`El archivo debe ser ${ext}.`);
  }

  const nasRoot = await getNasRoot();
  const LIB_BASE = buildLibBase(nasRoot);

  // ✅ AQUÍ ESTÁ EL CAMBIO CLAVE:
  // V1 => YYYY_MM_DD_V1
  // V2 => YYYY_MM_DD_V2
  const dateFolder = buildDateFolder(input.createdAt || Date.now(), input.version);

  const songName = safeName(input.songTitle);

  const destDir = path.win32.join(LIB_BASE, dateFolder, songName);
  const destPath = path.win32.join(destDir, `${songName}${ext}`);

  await fs.promises.mkdir(destDir, { recursive: true });
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