import fs from "fs";
import path from "path";
import { app } from "electron";

const LIB_BASE = "\\\\192.168.1.143\\Storage\\INFORMATICOS\\Lis\\AlabanzasCristo";

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

export type SaveToLibraryInput = {
  kind: "mp3" | "srt";
  sourcePath: string;
  createdAt: number;
  songTitle: string;
};

export type SaveToLibraryOutput = {
  destPath: string;
};

export async function saveToLibrary(input: SaveToLibraryInput): Promise<SaveToLibraryOutput> {
  if (!input.sourcePath) throw new Error("sourcePath vacío.");

  const ext = ensureExt(input.kind);
  const srcLower = input.sourcePath.toLowerCase();

  if (!srcLower.endsWith(ext)) {
    throw new Error(`El archivo debe ser ${ext}.`);
  }

  const dateFolder = formatYYYY_MM_DD(input.createdAt || Date.now());
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