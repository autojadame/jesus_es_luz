import React, { useMemo, useState } from "react";
import { useAppDispatch, useAppSelector } from "@/app/hooks";
import { Button } from "@/ui/components/Button";
import { Toast } from "@/ui/components/Toast";
import { clearHistory, setSavedFileForEntryId } from "@/features/history/historySlice";
import { DropZone } from "@/ui/components/DropZone";
import { Wrap, Header, Item, Expand, Col, RightTools } from "./History.styles";
import type { HistoryEntry } from "@/types/history";

// ✅ Reutiliza los estilos de Process (coherencia total)
import {
  CopyRow,
  CopyField,
  CopyLabel,
  CopyInputWrap,
  CopyInput,
  CopyIcon,
  SongCopyBox,
} from "@/pages/Process/Process.styles";
import { addLineBreaksAfterDotUpper } from "@/utils/textFormat";

const STYLE_TAG = "Ballad, New Romanticism";

function formatDate(ts: number) {
  try {
    return new Date(ts).toLocaleString();
  } catch {
    return String(ts);
  }
}

function SavedTag({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <span
      onClick={(ev) => {
        ev.stopPropagation();
        onClick();
      }}
      title="Guardado (click para copiar a Descargas)"
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        height: 22,
        padding: "0 10px",
        borderRadius: 999,
        border: "1px solid rgba(255,255,255,0.14)",
        background: "rgba(74,222,128,0.14)",
        fontSize: 12,
        fontWeight: 850,
        color: "rgba(255,255,255,0.92)",
        cursor: "pointer",
        userSelect: "none",
      }}
    >
      ✓ {label}
    </span>
  );
}

export function HistoryPage() {
  const dispatch = useAppDispatch();
  const entries = useAppSelector((s) => s.history.entries) as HistoryEntry[];

  const [openId, setOpenId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const count = entries.length;
  const list = useMemo(() => entries, [entries]);

  async function copyToClipboard(text: string, msg = "Copiado al portapapeles") {
    await window.electronAPI.clipboard.writeText(text);
    setToast(msg);
  }

  async function copyToDownloads(sourcePath: string, label: string) {
    try {
      await window.electronAPI.library.copyToDownloads({ sourcePath });
      setToast(`${label} copiado a Descargas`);
    } catch (e: any) {
      setToast(e?.message ?? `Error copiando ${label}`);
    }
  }

  async function openSavedFolder(savedMp3?: { path: string }, savedSrt?: { path: string }) {
    const p = savedMp3?.path || savedSrt?.path;
    if (!p) return;
    try {
      await window.electronAPI.files.revealInFolder(p);
      setToast("Carpeta abierta");
    } catch (e: any) {
      setToast(e?.message ?? "No se pudo abrir la carpeta");
    }
  }

  async function onDropForEntry(entry: HistoryEntry, file: File) {
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

    const songTitle = (entry.songTitulo || "").trim();
    if (!songTitle) {
      setToast("No hay título de canción para nombrar la carpeta/archivo.");
      return;
    }

    try {
      const out = await window.electronAPI.library.saveToLibrary({
        kind,
        sourcePath: pth,
        createdAt: entry.createdAt,
        songTitle,
      });

      dispatch(
        setSavedFileForEntryId({
          entryId: entry.entryId,
          kind,
          file: { path: out.destPath, savedAt: Date.now() },
        })
      );

      setToast(`Guardado en librería: ${kind.toUpperCase()}`);
    } catch (err: any) {
      setToast(err?.message ?? "Error guardando en librería");
    }
  }

  return (
    <Wrap>
      <Header>
        <div>
          <div className="t">Histórico</div>
          <div className="sub">Canciones generadas con sus metadatos (persistente).</div>
        </div>

        <RightTools>
          <div style={{ fontSize: 12, opacity: 0.72 }}>{count} entradas</div>
          <Button $variant="danger" disabled={count === 0} onClick={() => dispatch(clearHistory())}>
            Borrar todo
          </Button>
        </RightTools>
      </Header>

      {count === 0 && (
        <div style={{ opacity: 0.8 }}>
          Aún no hay canciones en el histórico. Genera letras desde Dashboard → Procesar.
        </div>
      )}

      {list.map((e) => {
        const open = openId === e.entryId;

        const savedMp3 = e.saved?.mp3;
        const savedSrt = e.saved?.srt;

        return (
          <Item
            key={e.entryId}
            $open={open}
            onClick={() => setOpenId(open ? null : e.entryId)}
            title="Click para expandir/contraer"
            role="button"
          >
            <div className="top">
              <div className="left">
                <div className="ref">
                  {e.libro} {e.capitulo}:{e.versiculo_inicial}-{e.versiculo_final} • {e.testamento} • ID {e.passageId}
                </div>

                <div
                  className="meta"
                  style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}
                >
                  <span>Fecha: {formatDate(e.createdAt)}</span>
                  {savedMp3 ? <SavedTag label="MP3" onClick={() => copyToDownloads(savedMp3.path, "MP3")} /> : null}
                  {savedSrt ? <SavedTag label="SRT" onClick={() => copyToDownloads(savedSrt.path, "SRT")} /> : null}

                  {(savedMp3 || savedSrt) ? (
                    <Button
                      $variant="ghost"
                      onClick={(ev) => {
                        ev.stopPropagation();
                        openSavedFolder(savedMp3, savedSrt);
                      }}
                      title="Abrir carpeta donde están los archivos guardados"
                    >
                      Abrir carpeta
                    </Button>
                  ) : null}
                </div>

                <div className="songTitle">{e.songTitulo}</div>
                <div className="summary">
                  <b>{e.summaryTitulo}</b>
                  {e.summaryDescripcion ? ` — ${e.summaryDescripcion}` : ""}
                </div>
              </div>
            </div>

            {open && (
              <>
                <Expand onClick={(ev) => ev.stopPropagation()}>
                  <Col>
                    <div className="h">Texto bíblico</div>
                    <div className="pre">{addLineBreaksAfterDotUpper(e.texto || "")}</div>
                  </Col>

                  <Col>
                    <div className="h">Canción</div>

                    <CopyRow>
                      <CopyField>
                        <CopyLabel>Título</CopyLabel>
                        <CopyInputWrap
                          onClick={() => e.songTitulo && copyToClipboard(e.songTitulo)}
                          title="Click para copiar"
                        >
                          <CopyInput readOnly value={e.songTitulo || ""} placeholder="(sin título)" />
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

                    <SongCopyBox
                      onClick={() => copyToClipboard(`${e.songTitulo}\n\n${e.songLetra}`)}
                      title="Click para copiar (título + letra)"
                    >
                      <div className="pre">{e.songLetra}</div>
                    </SongCopyBox>
                  </Col>
                </Expand>

                <div onClick={(ev) => ev.stopPropagation()}>
                  <DropZone onDropFile={(file) => {
                    if(!e.songTitulo){
                      throw new Error("No se puede guardar el archivo porque no tiene título");
                    }
                    return onDropForEntry(e, file)
                  }} />
                </div>
              </>
            )}
          </Item>
        );
      })}

      {toast && <Toast text={toast} onDone={() => setToast(null)} durationMs={4000} />}
    </Wrap>
  );
}