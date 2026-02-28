import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import { useAppDispatch, useAppSelector } from "@/app/hooks";
import { clearProcessBatch } from "@/features/llm/llmSlice";
import { generateSong, regenerateSongTitle, regenerateSongTitleForEntry } from "@/features/llm/thunks";
import {
  clearSavedFilesForEntryId,
  setSavedFileForEntryId,
  setSavedFileForLatestByPassage,
} from "@/features/history/historySlice";

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
import type { HistoryEntry } from "@/types/history";
import { addLineBreaksAfterDotUpper } from "@/utils/textFormat";

type VersionKey = "v1" | "v2";
type FileKind = "mp3" | "srt";
type SavedFile = { path: string; savedAt: number };
type SavedVersions = {
  v1: Partial<Record<FileKind, SavedFile>>;
  v2: Partial<Record<FileKind, SavedFile>>;
};

const STYLE_TAGS: Record<VersionKey, string> = {
  v1: "Ballad, New Romanticism",
  v2: "Cinematic Modern Worship Pop",
};

function normalizeSaved(saved: any): SavedVersions {
  if (!saved) return { v1: {}, v2: {} };
  if ((saved.mp3 || saved.srt) && !saved.v1 && !saved.v2) {
    return { v1: { mp3: saved.mp3, srt: saved.srt }, v2: {} };
  }
  return { v1: saved.v1 || {}, v2: saved.v2 || {} };
}

function isComplete(saved: SavedVersions) {
  return !!(saved.v1.mp3 && saved.v2.mp3 && saved.v1.srt && saved.v2.srt);
}

function hasAnySaved(saved: SavedVersions) {
  return !!(saved.v1.mp3 || saved.v2.mp3 || saved.v1.srt || saved.v2.srt);
}

function pickTargetVersion(saved: SavedVersions, kind: FileKind): VersionKey | null {
  if (!saved.v1[kind]) return "v1";
  if (!saved.v2[kind]) return "v2";
  return null;
}

function getTitleFromEntry(entry: any, version: VersionKey): string {
  const t1 = String(entry?.songTituloV1 ?? entry?.songTitulo ?? "").trim();
  const t2 = String(entry?.songTituloV2 ?? "").trim();
  return version === "v1" ? t1 : t2;
}

export function ProcessPage() {
  const nav = useNavigate();
  const dispatch = useAppDispatch();

  const processBatchIds = useAppSelector((s) => s.llm.processBatchIds) ?? [];
  const items = useAppSelector((s) => (s.settings as any)?.items) ?? [];
  const summariesById = useAppSelector((s) => s.llm.summariesById) ?? {};
  const songsById = useAppSelector((s) => s.llm.songsById) ?? {};
  const statusById = useAppSelector((s) => s.llm.songsStatusById) ?? {};
  const errById = useAppSelector((s) => s.llm.songsErrorById) ?? {};

  const historyEntries = useAppSelector((s) => s.history.entries) as HistoryEntry[];

  const batch: BibleItem[] = useMemo(() => {
    const map = new Map(items.map((x: any) => [x.id, x]));
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

  async function openSavedFolder(saved: SavedVersions) {
    const p = saved.v1.mp3?.path || saved.v1.srt?.path || saved.v2.mp3?.path || saved.v2.srt?.path;
    if (!p) return;
    try {
      await window.electronAPI.files.revealInFolder(p);
      setToast("Carpeta abierta");
    } catch (e: any) {
      setToast(e?.message ?? "No se pudo abrir la carpeta");
    }
  }

  async function ensureTitleAvailableOrRegenerate(entry: any, version: VersionKey, currentTitle: string) {
    const createdAt = Number(entry?.createdAt ?? Date.now());
    const entryId = String(entry?.entryId ?? "");

    // ✅ solo vale la pena comprobar si es el primer archivo de esa versión
    const saved = normalizeSaved(entry?.saved);
    const firstForVersion = !(saved?.[version]?.mp3 || saved?.[version]?.srt);
    if (!firstForVersion) return currentTitle;

    try {
      const chk = await (window as any).electronAPI.library.checkSongTitle({
        createdAt,
        songTitle: currentTitle,
        entryId,
      });
      if (chk?.available) return currentTitle;

      setToast(`Título ${version.toUpperCase()} ocupado en la carpeta de hoy. Regenerando…`);

      const newTitle = await dispatch<any>(
        regenerateSongTitleForEntry({
          entryId,
          passageId: entry.passageId,
          version,
          createdAt,
          libro: entry.libro,
          capitulo: entry.capitulo,
          versiculo_inicial: entry.versiculo_inicial,
          versiculo_final: entry.versiculo_final,
          testamento: entry.testamento,
          summaryTitulo: entry.summaryTitulo,
          summaryDescripcion: entry.summaryDescripcion,
          letra: entry.songLetra,
        })
      );

      return String(newTitle ?? "").trim() || currentTitle;
    } catch {
      // si falla el check o regen, seguimos con el título actual
      return currentTitle;
    }
  }

  async function saveDroppedFileForPassage(passage: BibleItem, file: File) {
    const pthRaw = window.electronAPI.files.getPathForFile(file);
    const pth = pthRaw ? (pthRaw.includes("/") ? pthRaw.replace(/\//g, "\\") : pthRaw) : "";

    if (!pth) {
      setToast("No se pudo obtener la ruta del archivo (Electron)." );
      return;
    }

    const lower = pth.toLowerCase();
    const kind: FileKind | null = lower.endsWith(".mp3") ? "mp3" : lower.endsWith(".srt") ? "srt" : null;
    if (!kind) {
      setToast("Solo se acepta .mp3 o .srt");
      return;
    }

    const entry = latestHistoryByPassage.get(passage.id) as any;
    if (!entry?.entryId) {
      setToast("No hay entrada de histórico para este pasaje todavía.");
      return;
    }

    const saved = normalizeSaved(entry.saved);
    if (isComplete(saved)) {
      setToast("Esta fila ya está completa (V1/V2 MP3+SRT). Borra asignación si quieres volver a subir.");
      return;
    }

    const version = pickTargetVersion(saved, kind);
    if (!version) {
      setToast(`Ya hay ${kind.toUpperCase()} V1 y V2. Borra asignación para volver a subir.`);
      return;
    }

    let songTitle = getTitleFromEntry(entry, version);
    if (!songTitle) {
      setToast(`No hay título para ${version.toUpperCase()} (genera letra/títulos primero).`);
      return;
    }

    // ✅ si la carpeta existe hoy con ese nombre, regenera el título y úsalo
    songTitle = await ensureTitleAvailableOrRegenerate(entry, version, songTitle);

    const createdAt = Number(entry.createdAt ?? Date.now());

    try {
      const out = await window.electronAPI.library.saveToLibrary({
        kind,
        sourcePath: pth,
        createdAt,
        songTitle,
        entryId: entry.entryId,
      });

      // Preferimos fijar en entryId (histórico exacto). Fallback: latest por pasaje.
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

      setToast(`Guardado en librería: ${kind.toUpperCase()} ${version.toUpperCase()}`);
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
            2 versiones por canción (V1/V2): misma letra, estilos distintos. Drop: MP3/SRT → primero V1, luego V2.
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
        const complete = isComplete(saved);

        const t1 = getTitleFromEntry(hist, "v1") || String(song?.titulo ?? "").trim();
        const t2 = getTitleFromEntry(hist, "v2") || String(song?.tituloV2 ?? "").trim();

        const canRegenerateTitles = !!song?.letra && st !== "loading";

        return (
          <Item
            key={p.id}
            $open={open}
            $complete={complete}
            onClick={() => setOpenId(open ? null : p.id)}
            role="button"
            title="Click para expandir/contraer"
          >
            <div className="top">
              <div className="left">
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                  <div style={{ minWidth: 0 }}>
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

                      {st === "done" && <Chip $tone="ok">Hecho</Chip>}
                      {st === "error" && <Chip $tone="bad">Error</Chip>}

                      {st === "error" && errById[p.id] ? (
                        <span style={{ color: "rgba(255,77,109,0.95)" }}>{errById[p.id]}</span>
                      ) : null}

                      {saved.v1.mp3 ? (
                        <Chip
                          $tone="ok"
                          style={{ cursor: "pointer" }}
                          title="Guardado (click para copiar a Descargas)"
                          onClick={(ev) => {
                            ev.stopPropagation();
                            copySavedToDownloads(saved.v1.mp3!.path, "MP3 V1");
                          }}
                        >
                          ✓ MP3 V1
                        </Chip>
                      ) : null}

                      {saved.v2.mp3 ? (
                        <Chip
                          $tone="ok"
                          style={{ cursor: "pointer" }}
                          title="Guardado (click para copiar a Descargas)"
                          onClick={(ev) => {
                            ev.stopPropagation();
                            copySavedToDownloads(saved.v2.mp3!.path, "MP3 V2");
                          }}
                        >
                          ✓ MP3 V2
                        </Chip>
                      ) : null}

                      {saved.v1.srt ? (
                        <Chip
                          $tone="ok"
                          style={{ cursor: "pointer" }}
                          title="Guardado (click para copiar a Descargas)"
                          onClick={(ev) => {
                            ev.stopPropagation();
                            copySavedToDownloads(saved.v1.srt!.path, "SRT V1");
                          }}
                        >
                          ✓ SRT V1
                        </Chip>
                      ) : null}

                      {saved.v2.srt ? (
                        <Chip
                          $tone="ok"
                          style={{ cursor: "pointer" }}
                          title="Guardado (click para copiar a Descargas)"
                          onClick={(ev) => {
                            ev.stopPropagation();
                            copySavedToDownloads(saved.v2.srt!.path, "SRT V2");
                          }}
                        >
                          ✓ SRT V2
                        </Chip>
                      ) : null}

                      {complete ? <Chip $tone="ok">COMPLETO</Chip> : <Chip $tone="neutral">2 versiones</Chip>}
                    </div>
                  </div>

                  <RightTools onClick={(ev) => ev.stopPropagation()} style={{ alignItems: "flex-start" }}>
                    <Button
                      $variant="ghost"
                      disabled={!canRegenerateTitles}
                      onClick={() => {
                        setToast("Regenerando títulos…");
                        dispatch<any>(regenerateSongTitle(p.id)).catch((e: any) =>
                          setToast(e?.message ?? "Error regenerando títulos")
                        );
                      }}
                      title={!song?.letra ? "Primero genera la letra" : "Regenerar títulos V1+V2"}
                    >
                      Nuevos títulos
                    </Button>

                    <Button
                      $variant="ghost"
                      onClick={() => dispatch<any>(generateSong(p, sum))}
                      title="Regenerar esta letra (incluye títulos nuevos)"
                    >
                      Regenerar letra
                    </Button>

                    {hasAnySaved(saved) && hist?.entryId ? (
                      <>
                        <Button
                          $variant="ghost"
                          onClick={(ev) => {
                            ev.stopPropagation();
                            openSavedFolder(saved);
                          }}
                          title="Abrir carpeta donde están los archivos guardados"
                        >
                          Abrir carpeta
                        </Button>

                        <Button
                          $variant="danger"
                          onClick={(ev) => {
                            ev.stopPropagation();
                            dispatch(clearSavedFilesForEntryId({ entryId: hist.entryId }));
                            setToast("Asignación borrada (NAS intacto)." );
                          }}
                          title="No borra en el NAS. Solo quita la asignación para poder subir de nuevo."
                        >
                          Borrar asignación
                        </Button>
                      </>
                    ) : null}
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
                    <div className="h">Canción (mismo texto, 2 versiones)</div>

                    <CopyRow>
                      <CopyField>
                        <CopyLabel>Título V1</CopyLabel>
                        <CopyInputWrap onClick={() => t1 && copyToClipboard(t1)} title="Click para copiar">
                          <CopyInput readOnly value={t1 || ""} placeholder="(aún no generado)" />
                          <CopyIcon />
                        </CopyInputWrap>
                      </CopyField>

                      <CopyField>
                        <CopyLabel>Estilo V1</CopyLabel>
                        <CopyInputWrap onClick={() => copyToClipboard(STYLE_TAGS.v1)} title="Click para copiar">
                          <CopyInput readOnly value={STYLE_TAGS.v1} />
                          <CopyIcon />
                        </CopyInputWrap>
                      </CopyField>
                    </CopyRow>

                    <CopyRow>
                      <CopyField>
                        <CopyLabel>Título V2</CopyLabel>
                        <CopyInputWrap onClick={() => t2 && copyToClipboard(t2)} title="Click para copiar">
                          <CopyInput readOnly value={t2 || ""} placeholder="(aún no generado)" />
                          <CopyIcon />
                        </CopyInputWrap>
                      </CopyField>

                      <CopyField>
                        <CopyLabel>Estilo V2</CopyLabel>
                        <CopyInputWrap onClick={() => copyToClipboard(STYLE_TAGS.v2)} title="Click para copiar">
                          <CopyInput readOnly value={STYLE_TAGS.v2} />
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
                        onClick={() => copyToClipboard(song.letra)}
                        title="Click para copiar (títulos + letra)"
                      >
                        <div className="pre">{song.letra}</div>
                      </SongCopyBox>
                    ) : (
                      <div style={{ opacity: 0.7 }}>Aún no generada.</div>
                    )}
                  </Col>
                </Expand>

                <div onClick={(ev) => ev.stopPropagation()}>
                  <div style={{ marginTop: 10, opacity: 0.78, fontSize: 12 }}>
                    Drop: MP3 y SRT. Asignación automática: primero V1, luego V2. Cuando esté completo, borra asignación para
                    volver a subir.
                  </div>

                  <DropZone
                    onDropFile={(file) => saveDroppedFileForPassage(p, file)}
                    onInfo={(m) => setToast(m)}
                  />
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
