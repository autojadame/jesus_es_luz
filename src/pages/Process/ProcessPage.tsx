import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAppDispatch, useAppSelector } from "@/app/hooks";
import { clearProcessBatch } from "@/features/llm/llmSlice";
import { generateSong } from "@/features/llm/thunks";
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
import {
  setSavedFileForLatestByPassage,
  setSavedFileForEntryId,
} from "@/features/history/historySlice";

const STYLE_TAG = "Ballad, New Romanticism";

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

  // map: latest entry por pasaje (newest first)
  const latestHistoryByPassage = useMemo(() => {
    const m = new Map<number, HistoryEntry>();
    for (const e of historyEntries) {
      if (!m.has(e.passageId)) m.set(e.passageId, e);
    }
    return m;
  }, [historyEntries]);

  // si no hay batch, fuera
  useEffect(() => {
    if (!processBatchIds.length) nav("/dashboard", { replace: true });
  }, [processBatchIds.length, nav]);

  // autogeneración (paralela) si no hay nada generado todavía
  const [autoStarted, setAutoStarted] = useState(false);
  useEffect(() => {
    if (!batch.length) return;

    const noneGenerated = batch.every((p) => !songsById[p.id]);
    const noneLoading = batch.every((p) => statusById[p.id] !== "loading");

    if (!autoStarted && noneGenerated && noneLoading) {
      setAutoStarted(true);
      Promise.all(batch.map((p) => dispatch<any>(generateSong(p, summariesById[p.id])))).catch(() => {});
    }
  }, [
    batch.map((x) => x.id).join(","),
    songsById,
    statusById,
    autoStarted,
    dispatch,
    summariesById,
  ]);

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

  async function saveDroppedFileForPassage(passage: BibleItem, songTitle: string, file: File) {
    // ✅ ruta segura en Electron moderno
    const pthRaw = window.electronAPI.files.getPathForFile(file);
    const pth = pthRaw ? (pthRaw.includes("/") ? pthRaw.replace(/\//g, "\\") : pthRaw) : "";

    if (!pth) {
      setToast("No se pudo obtener la ruta del archivo (Electron).");
      return;
    }

    const lower = pth.toLowerCase();
    const kind = lower.endsWith(".mp3") ? "mp3" : lower.endsWith(".srt") ? "srt" : null;
    if (!kind) {
      setToast("Solo se acepta .mp3 o .srt");
      return;
    }

    const entry = latestHistoryByPassage.get(passage.id);
    const createdAt = entry?.createdAt ?? Date.now();

    try {
      const out = await window.electronAPI.library.saveToLibrary({
        kind,
        sourcePath: pth,
        createdAt,
        songTitle,
      });

      // ✅ mejor: actualiza la entry exacta si existe
      if (entry?.entryId) {
        dispatch(
          setSavedFileForEntryId({
            entryId: entry.entryId,
            kind,
            file: { path: out.destPath, savedAt: Date.now() },
          })
        );
      } else {
        // fallback
        dispatch(
          setSavedFileForLatestByPassage({
            passageId: passage.id,
            kind,
            file: { path: out.destPath, savedAt: Date.now() },
          })
        );
      }

      setToast(`Guardado: ${kind.toUpperCase()}`);
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
            Click en una tarjeta para ver Texto (izq) y Canción (der). Click en la letra para copiar.
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
        const song = songsById[p.id];
        const open = openId === p.id;

        const songTitle = song?.titulo ?? "";
        const hist = latestHistoryByPassage.get(p.id);
        const savedMp3 = hist?.saved?.mp3;
        const savedSrt = hist?.saved?.srt;

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

                  {/* ✅ indicadores de guardado */}
                  {savedMp3 ? (
                    <Chip
                      $tone="ok"
                      style={{ cursor: "pointer" }}
                      title="Guardado (click para copiar a Descargas)"
                      onClick={(ev) => {
                        ev.stopPropagation();
                        copySavedToDownloads(savedMp3.path, "MP3");
                      }}
                    >
                      ✓ MP3
                    </Chip>
                  ) : null}

                  {savedSrt ? (
                    <Chip
                      $tone="ok"
                      style={{ cursor: "pointer" }}
                      title="Guardado (click para copiar a Descargas)"
                      onClick={(ev) => {
                        ev.stopPropagation();
                        copySavedToDownloads(savedSrt.path, "SRT");
                      }}
                    >
                      ✓ SRT
                    </Chip>
                  ) : null}
                </div>

                <div className="sumTitle">{sum?.titulo ?? "—"}</div>
                <div className="sumDesc">{sum?.descripcion ?? "—"}</div>
              </div>

              <RightTools onClick={(ev) => ev.stopPropagation()}>
                <Button
                  $variant="ghost"
                  onClick={() => dispatch<any>(generateSong(p, sum))}
                  title="Regenerar esta letra"
                >
                  Regenerar
                </Button>
              </RightTools>
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
                        <CopyLabel>Título</CopyLabel>
                        <CopyInputWrap
                          onClick={() => songTitle && copyToClipboard(songTitle)}
                          title="Click para copiar"
                        >
                          <CopyInput readOnly value={songTitle} placeholder="(aún no generado)" />
                          <CopyIcon />
                        </CopyInputWrap>
                      </CopyField>

                      <CopyField>
                        <CopyLabel>Estilo</CopyLabel>
                        <CopyInputWrap onClick={() => copyToClipboard(STYLE_TAG)} title="Click para copiar">
                          <CopyInput readOnly value={STYLE_TAG} />
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
                        onClick={() => copyToClipboard(`${song.titulo}\n\n${song.letra}`)}
                        title="Click para copiar (título + letra)"
                      >
                        <div className="pre">{song.letra}</div>
                      </SongCopyBox>
                    ) : (
                      <div style={{ opacity: 0.7 }}>Aún no generada.</div>
                    )}
                  </Col>
                </Expand>

                {/* ✅ Drop area ocupa toda la tarjeta debajo de las 2 columnas */}
                <div onClick={(ev) => ev.stopPropagation()}>
                  <DropZone
                    onDropFile={(file) => {
                      if (!songTitle) {
                        setToast("Primero genera la letra para tener título.");
                        return;
                      }
                      // DropZone puede llamar 2 veces (mp3 + srt); guardamos ambos
                      saveDroppedFileForPassage(p, songTitle, file);
                    }}
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