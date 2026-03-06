import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAppDispatch, useAppSelector } from "@/app/hooks";
import { clearProcessBatch } from "@/features/llm/llmSlice";
import { generateSong, regenerateSongTitle } from "@/features/llm/thunks";
import { Button } from "@/ui/components/Button";
import { Loader } from "@/ui/components/Loader";
import { Toast } from "@/ui/components/Toast";
import { DropZone } from "@/ui/components/DropZone";
import {
  Wrap,
  Header,
  RightTools,
  Item,
  Expand,
  Col,
  IndexBadge,
  Chip,
  CopyRow,
  CopyField,
  CopyLabel,
  CopyInputWrap,
  CopyInput,
  CopyIcon,
  SongCopyBox,
} from "./Process.styles";
import type { BibleItem } from "@/types/bible";
import { addLineBreaksAfterDotUpper } from "@/utils/textFormat";
import type { HistoryEntry } from "@/types/history";
import { setSavedFileForLatestByPassage, setSavedFileForEntryId } from "@/features/history/historySlice";

type VersionKey = "v1" | "v2";
type FileKind = "mp3" | "wav" | "srt";
type SavedFile = { path: string; savedAt: number };
type SavedVersions = {
  v1: Partial<Record<FileKind, SavedFile>>;
  v2: Partial<Record<FileKind, SavedFile>>;
};

const STYLE_TAG_V1 = "Ballad, New Romanticism";
const STYLE_TAG_V2 = "Cinematic Modern Worship Pop";

function normalizeSaved(saved: any): SavedVersions {
  const out: SavedVersions = { v1: {}, v2: {} };

  if (!saved) return out;

  // Nuevo formato
  if (saved.v1 || saved.v2) {
    out.v1 = saved.v1 || {};
    out.v2 = saved.v2 || {};
    return out;
  }

  // Legacy (root mp3/srt/wav) => lo consideramos v1
  if (saved.mp3) out.v1.mp3 = saved.mp3;
  if (saved.srt) out.v1.srt = saved.srt;
  if (saved.wav) out.v1.wav = saved.wav;

  return out;
}

function detectKindFromPath(pthLower: string): FileKind | null {
  if (pthLower.endsWith(".mp3")) return "mp3";
  if (pthLower.endsWith(".wav")) return "wav";
  if (pthLower.endsWith(".srt")) return "srt";
  return null;
}

function pickTargetVersion(saved: SavedVersions, kind: FileKind): VersionKey | null {
  if (!saved.v1[kind]) return "v1";
  if (!saved.v2[kind]) return "v2";
  return null;
}

function getSongTitleForVersion(song: any, hist: any, v: VersionKey) {
  const t1 = String(hist?.songTituloV1 ?? hist?.songTitulo ?? song?.titulo ?? "").trim();
  const t2 = String(hist?.songTituloV2 ?? song?.tituloV2 ?? song?.titulo ?? "").trim();
  return v === "v1" ? t1 : t2;
}

export function ProcessPage() {
  const nav = useNavigate();
  const dispatch = useAppDispatch();

  const processBatchIds = useAppSelector((s) => s.llm.processBatchIds) ?? [];
  const items = useAppSelector((s) => s.settings.items) ?? [];
  const summariesById = useAppSelector((s) => s.llm.summariesById) ?? {};
  const songsById = useAppSelector((s) => s.llm.songsById) ?? {};
  const statusById = useAppSelector((s) => s.llm.songsStatusById) ?? {};
  const errById = useAppSelector((s) => s.llm.songsErrorById) ?? {};

  const historyEntries = useAppSelector((s) => s.history.entries) as HistoryEntry[];

  const batch: BibleItem[] = useMemo(() => {
    const map = new Map(items.map((x) => [x.id, x]));
    return processBatchIds.map((id) => map.get(id)).filter(Boolean) as BibleItem[];
  }, [items, processBatchIds.join(",")]);

  const latestHistoryByPassage = useMemo(() => {
    const m = new Map<number, HistoryEntry>();
    for (const e of historyEntries) {
      if (!m.has(e.passageId)) m.set(e.passageId, e);
    }
    return m;
  }, [historyEntries]);

  useEffect(() => {
    if (!processBatchIds.length) nav("/dashboard", { replace: true });
  }, [processBatchIds.length, nav]);

  const [autoStarted, setAutoStarted] = useState(false);
  useEffect(() => {
    if (!batch.length) return;

    const noneGenerated = batch.every((p) => !songsById[p.id]);
    const noneLoading = batch.every((p) => statusById[p.id] !== "loading");

    if (!autoStarted && noneGenerated && noneLoading) {
      setAutoStarted(true);
      Promise.all(batch.map((p) => dispatch<any>(generateSong(p, summariesById[p.id])))).catch(() => {});
    }
  }, [batch.map((x) => x.id).join(","), songsById, statusById, autoStarted, dispatch, summariesById]);

  const [openId, setOpenId] = useState<number | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  async function copyToClipboard(text: string) {
    await window.electronAPI.clipboard.writeText(text);
    setToast("Copiado al portapapeles");
  }

  async function copySavedToDownloads(sourcePath: string, label: string) {
    try {
      await window.electronAPI.library.copyToDownloads({ sourcePath });
      setToast(`${label} copiado a Descargas`);
    } catch (e: any) {
      setToast(e?.message ?? `Error copiando ${label}`);
    }
  }

  async function openSavedFolderByVersion(saved: SavedVersions, version: VersionKey) {
    const versionSaved = saved[version];
    const p = versionSaved.mp3?.path || versionSaved.wav?.path || versionSaved.srt?.path;

    if (!p) {
      setToast(`No hay archivos guardados en ${version.toUpperCase()}.`);
      return;
    }

    try {
      await window.electronAPI.files.revealInFolder(p);
      setToast(`Carpeta ${version.toUpperCase()} abierta`);
    } catch (e: any) {
      setToast(e?.message ?? `No se pudo abrir la carpeta ${version.toUpperCase()}`);
    }
  }

  async function saveDroppedFileForPassage(passage: BibleItem, file: File) {
    const pthRaw = window.electronAPI.files.getPathForFile(file);
    const pth = pthRaw ? (pthRaw.includes("/") ? pthRaw.replace(/\//g, "\\") : pthRaw) : "";

    if (!pth) {
      setToast("No se pudo obtener la ruta del archivo (Electron).");
      return;
    }

    const kind = detectKindFromPath(pth.toLowerCase());
    if (!kind) {
      setToast("Solo se acepta .mp3, .wav o .srt");
      return;
    }

    const entry = latestHistoryByPassage.get(passage.id) as any;
    if (!entry) {
      setToast("No hay entrada en el histórico para este pasaje todavía.");
      return;
    }
    if (!entry.entryId) {
      setToast("La entrada del histórico no tiene entryId (necesario para guardar por versión).");
      return;
    }

    const createdAt = entry.createdAt ?? Date.now();
    const saved = normalizeSaved(entry.saved);
    const version = pickTargetVersion(saved, kind);

    if (!version) {
      setToast(`Ya existen ${kind.toUpperCase()} en V1 y V2. Borra asignación si quieres volver a subir.`);
      return;
    }

    const song = songsById[passage.id];
    const songTitle = getSongTitleForVersion(song, entry, version);
    if (!songTitle) {
      setToast(`No hay título disponible para ${version.toUpperCase()} (genera canción/títulos primero).`);
      return;
    }

    try {
      const out = await window.electronAPI.library.saveToLibrary({
        version,
        kind,
        sourcePath: pth,
        createdAt,
        songTitle,
        entryId: entry.entryId,
      });

      if (entry?.entryId) {
        dispatch(
          setSavedFileForEntryId({
            entryId: entry.entryId,
            version,
            kind,
            file: { path: out.destPath, savedAt: Date.now() },
          })
        );
      } else {
        dispatch(
          setSavedFileForLatestByPassage({
            passageId: passage.id,
            version,
            kind,
            file: { path: out.destPath, savedAt: Date.now() },
          })
        );
      }

      setToast(`Guardado: ${kind.toUpperCase()} ${version.toUpperCase()}`);
    } catch (err: any) {
      setToast(err?.message ?? "Error guardando en librería");
    }
  }

  if (!processBatchIds.length) return null;

  return (
    <Wrap>
      <Header>
        <div className="left">
          <div className="t">Generación de letras ({batch.length})</div>
          <div className="sub">
            Drop MP3/WAV/SRT → se asigna automáticamente: primero V1 y luego V2 por cada tipo.
          </div>
        </div>

        <RightTools>
          <Button
            $variant="ghost"
            onClick={() => {
              dispatch(clearProcessBatch());
              nav("/dashboard");
            }}
          >
            Salir
          </Button>
        </RightTools>
      </Header>

      {batch.map((p, idx) => {
        const st = statusById[p.id] ?? "idle";
        const sum = summariesById[p.id];
        const song: any = songsById[p.id];
        const open = openId === p.id;

        const hist: any = latestHistoryByPassage.get(p.id);
        const saved = normalizeSaved(hist?.saved);

        const savedV1Mp3 = saved.v1.mp3;
        const savedV1Wav = saved.v1.wav;
        const savedV1Srt = saved.v1.srt;

        const savedV2Mp3 = saved.v2.mp3;
        const savedV2Wav = saved.v2.wav;
        const savedV2Srt = saved.v2.srt;

        const hasV1 = !!savedV1Mp3 || !!savedV1Wav || !!savedV1Srt;
        const hasV2 = !!savedV2Mp3 || !!savedV2Wav || !!savedV2Srt;

        const titleV1 = getSongTitleForVersion(song, hist, "v1");
        const titleV2 = getSongTitleForVersion(song, hist, "v2");

        const canRegenerateTitle = !!song?.letra && st !== "loading";

        return (
          <Item
            key={p.id}
            $open={open}
            onClick={() => setOpenId(open ? null : p.id)}
            role="button"
            title="Click para expandir/contraer"
          >
            <div className="top">
              <div className="left">
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <div>
                    <div className="ref">
                      {p.libro} {p.capitulo}:{p.versiculo_inicial}-{p.versiculo_final} • {p.testamento} • ID {p.id}
                    </div>

                    <div className="meta">
                      <IndexBadge>#{idx + 1}</IndexBadge>

                      {st === "loading" && (
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                          <Loader />
                          <span style={{ opacity: 0.85 }}>Generando…</span>
                        </span>
                      )}

                      {st === "done" &&
                        savedV1Srt &&
                        savedV2Srt &&
                        savedV1Mp3 &&
                        savedV2Mp3 &&
                        savedV1Wav &&
                        savedV2Wav && <Chip $tone="ok">Hecho</Chip>}

                      {st === "error" && <Chip $tone="bad">Error</Chip>}

                      {st === "error" && errById[p.id] ? (
                        <span style={{ color: "rgba(255,77,109,0.95)" }}>{errById[p.id]}</span>
                      ) : null}

                      {savedV1Mp3 ? (
                        <Chip
                          $tone="ok"
                          style={{ cursor: "pointer" }}
                          title="Guardado (click para copiar a Descargas)"
                          onClick={(ev) => {
                            ev.stopPropagation();
                            copySavedToDownloads(savedV1Mp3.path, "MP3 V1");
                          }}
                        >
                          ✓ MP3 V1
                        </Chip>
                      ) : null}

                      {savedV1Wav ? (
                        <Chip
                          $tone="ok"
                          style={{ cursor: "pointer" }}
                          title="Guardado (click para copiar a Descargas)"
                          onClick={(ev) => {
                            ev.stopPropagation();
                            copySavedToDownloads(savedV1Wav.path, "WAV V1");
                          }}
                        >
                          ✓ WAV V1
                        </Chip>
                      ) : null}

                      {savedV1Srt ? (
                        <Chip
                          $tone="ok"
                          style={{ cursor: "pointer" }}
                          title="Guardado (click para copiar a Descargas)"
                          onClick={(ev) => {
                            ev.stopPropagation();
                            copySavedToDownloads(savedV1Srt.path, "SRT V1");
                          }}
                        >
                          ✓ SRT V1
                        </Chip>
                      ) : null}

                      {savedV2Mp3 ? (
                        <Chip
                          $tone="ok"
                          style={{ cursor: "pointer" }}
                          title="Guardado (click para copiar a Descargas)"
                          onClick={(ev) => {
                            ev.stopPropagation();
                            copySavedToDownloads(savedV2Mp3.path, "MP3 V2");
                          }}
                        >
                          ✓ MP3 V2
                        </Chip>
                      ) : null}

                      {savedV2Wav ? (
                        <Chip
                          $tone="ok"
                          style={{ cursor: "pointer" }}
                          title="Guardado (click para copiar a Descargas)"
                          onClick={(ev) => {
                            ev.stopPropagation();
                            copySavedToDownloads(savedV2Wav.path, "WAV V2");
                          }}
                        >
                          ✓ WAV V2
                        </Chip>
                      ) : null}

                      {savedV2Srt ? (
                        <Chip
                          $tone="ok"
                          style={{ cursor: "pointer" }}
                          title="Guardado (click para copiar a Descargas)"
                          onClick={(ev) => {
                            ev.stopPropagation();
                            copySavedToDownloads(savedV2Srt.path, "SRT V2");
                          }}
                        >
                          ✓ SRT V2
                        </Chip>
                      ) : null}

                      {hasV1 ? (
                        <Button
                          $variant="ghost"
                          onClick={(ev) => {
                            ev.stopPropagation();
                            openSavedFolderByVersion(saved, "v1");
                          }}
                          title="Abrir carpeta de la versión V1"
                        >
                          Abrir carpeta V1
                        </Button>
                      ) : null}

                      {hasV2 ? (
                        <Button
                          $variant="ghost"
                          onClick={(ev) => {
                            ev.stopPropagation();
                            openSavedFolderByVersion(saved, "v2");
                          }}
                          title="Abrir carpeta de la versión V2"
                        >
                          Abrir carpeta V2
                        </Button>
                      ) : null}
                    </div>
                  </div>

                  <RightTools onClick={(ev) => ev.stopPropagation()}>
                    <Button
                      $variant="ghost"
                      disabled={!canRegenerateTitle}
                      onClick={() => {
                        setToast("Regenerando título…");
                        dispatch<any>(regenerateSongTitle(p.id));
                      }}
                      title={!song?.letra ? "Primero genera la letra" : "Regenerar SOLO los títulos"}
                    >
                      Nuevo título
                    </Button>

                    <Button
                      $variant="ghost"
                      onClick={() => dispatch<any>(generateSong(p, sum))}
                      title="Regenerar esta letra"
                    >
                      Regenerar
                    </Button>
                  </RightTools>
                </div>

                <div className="sumTitle">{sum?.titulo ?? "—"}</div>
                <div className="sumDesc">{sum?.descripcion ?? "—"}</div>
              </div>
            </div>

            {open && (
              <>
                <Expand onClick={(ev) => ev.stopPropagation()}>
                  <Col>
                    <div className="h">Texto</div>
                    <div className="pre" style={{ maxHeight: "494px" }}>
                      {addLineBreaksAfterDotUpper(p.texto || "")}
                    </div>
                  </Col>

                  <Col>
                    <div className="h">Canción</div>

                    <CopyRow>
                      <CopyField>
                        <CopyLabel>Título V1</CopyLabel>
                        <CopyInputWrap onClick={() => titleV1 && copyToClipboard(titleV1)} title="Click para copiar">
                          <CopyInput readOnly value={titleV1} placeholder="(aún no generado)" />
                          <CopyIcon />
                        </CopyInputWrap>
                      </CopyField>

                      <CopyField>
                        <CopyLabel>Estilo V1</CopyLabel>
                        <CopyInputWrap onClick={() => copyToClipboard(STYLE_TAG_V1)} title="Click para copiar">
                          <CopyInput readOnly value={STYLE_TAG_V1} />
                          <CopyIcon />
                        </CopyInputWrap>
                      </CopyField>
                    </CopyRow>

                    <CopyRow>
                      <CopyField>
                        <CopyLabel>Título V2</CopyLabel>
                        <CopyInputWrap onClick={() => titleV2 && copyToClipboard(titleV2)} title="Click para copiar">
                          <CopyInput readOnly value={titleV2} placeholder="(aún no generado)" />
                          <CopyIcon />
                        </CopyInputWrap>
                      </CopyField>

                      <CopyField>
                        <CopyLabel>Estilo V2</CopyLabel>
                        <CopyInputWrap onClick={() => copyToClipboard(STYLE_TAG_V2)} title="Click para copiar">
                          <CopyInput readOnly value={STYLE_TAG_V2} />
                          <CopyIcon />
                        </CopyInputWrap>
                      </CopyField>
                    </CopyRow>

                    {!song && st === "loading" ? (
                      <div style={{ display: "flex", alignItems: "center", gap: 10, opacity: 0.85 }}>
                        <Loader /> Generando…
                      </div>
                    ) : song ? (
                      <SongCopyBox
                        onClick={() => copyToClipboard(`${titleV1 || ""}\n\n${song?.letra ?? ""}`)}
                        title="Click para copiar (título V1 + letra)"
                      >
                        <div className="pre">{song.letra}</div>
                      </SongCopyBox>
                    ) : (
                      <div style={{ opacity: 0.7 }}>Aún no generada.</div>
                    )}
                  </Col>
                </Expand>

                <div onClick={(ev) => ev.stopPropagation()}>
                  <DropZone onDropFile={(file) => saveDroppedFileForPassage(p, file)} onInfo={(m) => setToast(m)} />
                </div>
              </>
            )}
          </Item>
        );
      })}

      {toast && <Toast text={toast} onDone={() => setToast(null)} durationMs={3500} />}
    </Wrap>
  );
}