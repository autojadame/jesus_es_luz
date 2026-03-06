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
import { clearDiscardedIds } from "@/features/settings/settingsSlice";

type VersionKey = "v1" | "v2";
type FileKind = "mp3" | "srt" | "wav";
type SavedFile = { path: string; savedAt: number };
type SavedVersions = {
  v1: Partial<Record<FileKind, SavedFile>>;
  v2: Partial<Record<FileKind, SavedFile>>;
};

const STYLE_TAG_V1 = "Ballad, New Romanticism";
const STYLE_TAG_V2 = "Cinematic Modern Worship Pop";

function formatDate(ts: number) {
  try {
    return new Date(ts).toLocaleString();
  } catch {
    return String(ts);
  }
}

function normalizeSaved(saved: any): SavedVersions {
  const out: SavedVersions = { v1: {}, v2: {} };
  if (!saved) return out;

  // Nuevo formato: saved.v1 / saved.v2
  if (saved.v1 || saved.v2) {
    out.v1 = saved.v1 || {};
    out.v2 = saved.v2 || {};
    return out;
  }

  // Legacy: saved.mp3/srt/wav => lo tratamos como V1
  if (saved.mp3) out.v1.mp3 = saved.mp3;
  if (saved.srt) out.v1.srt = saved.srt;
  if (saved.wav) out.v1.wav = saved.wav;

  return out;
}

function detectKindFromPath(pthLower: string): FileKind | null {
  if (pthLower.endsWith(".mp3")) return "mp3";
  if (pthLower.endsWith(".srt")) return "srt";
  if (pthLower.endsWith(".wav")) return "wav";
  return null;
}

function pickVersion(saved: SavedVersions, kind: FileKind): VersionKey | null {
  const v1Has = !!saved.v1[kind];
  const v2Has = !!saved.v2[kind];
  if (!v1Has) return "v1";
  if (!v2Has) return "v2";
  return null;
}

function getTitleForVersion(entry: any, v: VersionKey) {
  const t1 = String(entry?.songTituloV1 ?? entry?.songTitulo ?? "").trim();
  const t2 = String(entry?.songTituloV2 ?? "").trim();
  return v === "v1" ? t1 : t2;
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

  async function onDropForEntry(entry: HistoryEntry, file: File) {
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

    if (!entry.entryId) {
      setToast("Esta entrada no tiene entryId (necesario para guardar por versión).");
      return;
    }

    const saved = normalizeSaved((entry as any).saved);
    const version = pickVersion(saved, kind);

    if (!version) {
      setToast(`Ya existen ${kind.toUpperCase()} en V1 y V2. Borra asignación si quieres volver a subir.`);
      return;
    }

    const songTitle = getTitleForVersion(entry as any, version);
    if (!songTitle) {
      setToast(`No hay título para ${version.toUpperCase()} en esta entrada (songTituloV1/songTituloV2).`);
      return;
    }

    try {
      const out = await window.electronAPI.library.saveToLibrary({
        version,
        kind,
        sourcePath: pth,
        createdAt: entry.createdAt,
        songTitle,
        entryId: entry.entryId,
      });

      dispatch(
        setSavedFileForEntryId({
          entryId: entry.entryId,
          version,
          kind,
          file: { path: out.destPath, savedAt: Date.now() },
        })
      );

      setToast(`Guardado en librería: ${kind.toUpperCase()} ${version.toUpperCase()}`);
    } catch (err: any) {
      setToast(err?.message ?? "Error guardando en librería");
    }
  }

  return (
    <Wrap>
      <Header>
        <div>
          <div className="t">Histórico</div>
          <div className="sub">
            Drop MP3/WAV/SRT por entrada. Se asigna automáticamente: primero V1 y luego V2 por tipo.
          </div>
        </div>

        <RightTools>
          <div style={{ fontSize: 12, opacity: 0.72 }}>{count} entradas</div>
          <Button
            $variant="danger"
            disabled={count === 0}
            onClick={() => {
              dispatch(clearHistory());
              dispatch(clearDiscardedIds());
            }}
          >
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
        const saved = normalizeSaved((e as any).saved);

        const hasV1 = !!saved.v1.mp3 || !!saved.v1.wav || !!saved.v1.srt;
        const hasV2 = !!saved.v2.mp3 || !!saved.v2.wav || !!saved.v2.srt;

        const titleV1 = getTitleForVersion(e as any, "v1");
        const titleV2 = getTitleForVersion(e as any, "v2");

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

                <div className="meta" style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                  <span>Fecha: {formatDate(e.createdAt)}</span>

                  {saved.v1.mp3 ? <SavedTag label="MP3 V1" onClick={() => copyToDownloads(saved.v1.mp3!.path, "MP3 V1")} /> : null}
                  {saved.v1.wav ? <SavedTag label="WAV V1" onClick={() => copyToDownloads(saved.v1.wav!.path, "WAV V1")} /> : null}
                  {saved.v1.srt ? <SavedTag label="SRT V1" onClick={() => copyToDownloads(saved.v1.srt!.path, "SRT V1")} /> : null}

                  {saved.v2.mp3 ? <SavedTag label="MP3 V2" onClick={() => copyToDownloads(saved.v2.mp3!.path, "MP3 V2")} /> : null}
                  {saved.v2.wav ? <SavedTag label="WAV V2" onClick={() => copyToDownloads(saved.v2.wav!.path, "WAV V2")} /> : null}
                  {saved.v2.srt ? <SavedTag label="SRT V2" onClick={() => copyToDownloads(saved.v2.srt!.path, "SRT V2")} /> : null}

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

                <div className="songTitle">
                  {titleV1 ? `V1: ${titleV1}` : "V1: (sin título)"}{" "}
                  <span style={{ opacity: 0.55, margin: "0 8px" }}>•</span>{" "}
                  {titleV2 ? `V2: ${titleV2}` : "V2: (sin título)"}
                </div>

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
                        <CopyLabel>Título V1</CopyLabel>
                        <CopyInputWrap onClick={() => titleV1 && copyToClipboard(titleV1)} title="Click para copiar">
                          <CopyInput readOnly value={titleV1 || ""} placeholder="(sin título V1)" />
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
                          <CopyInput readOnly value={titleV2 || ""} placeholder="(sin título V2)" />
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

                    <SongCopyBox
                      onClick={() => copyToClipboard(`${titleV1 || ""}\n\n${(e as any).songLetra || ""}`)}
                      title="Click para copiar (título V1 + letra)"
                    >
                      <div className="pre">{(e as any).songLetra}</div>
                    </SongCopyBox>
                  </Col>
                </Expand>

                <div onClick={(ev) => ev.stopPropagation()}>
                  <DropZone
                    onDropFile={(file) => {
                      if (!titleV1 && !titleV2) {
                        setToast("No se puede guardar: faltan títulos V1/V2 en esta entrada.");
                        return;
                      }
                      return onDropForEntry(e, file);
                    }}
                    onInfo={(m) => setToast(m)}
                  />
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