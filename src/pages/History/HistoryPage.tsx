import React, { useMemo, useState } from "react";
import { useAppDispatch, useAppSelector } from "@/app/hooks";
import { Button } from "@/ui/components/Button";
import { Toast } from "@/ui/components/Toast";
import {
  clearHistory,
  clearSavedFilesForEntryId,
  setSavedFileForEntryId,
} from "@/features/history/historySlice";
import { regenerateSongTitleForEntry } from "@/features/llm/thunks";
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
type FileKind = "mp3" | "srt";
type SavedFile = { path: string; savedAt: number };
type SavedVersions = {
  v1: Partial<Record<FileKind, SavedFile>>;
  v2: Partial<Record<FileKind, SavedFile>>;
};

const STYLE_TAGS: Record<VersionKey, string> = {
  v1: "Ballad, New Romanticism",
  v2: "Ballad, New Romanticism",
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

async function ensureTitleAvailableOrRegenerate(opts: {
  dispatch: any;
  setToast: (m: string) => void;
  entry: HistoryEntry;
  version: VersionKey;
  currentTitle: string;
}) {
  const entry: any = opts.entry;
  const createdAt = Number(entry?.createdAt ?? Date.now());
  const entryId = String(entry?.entryId ?? "");

  const saved = normalizeSaved(entry?.saved);
  const firstForVersion = !(saved?.[opts.version]?.mp3 || saved?.[opts.version]?.srt);
  if (!firstForVersion) return opts.currentTitle;

  try {
    const chk = await (window as any).electronAPI.library.checkSongTitle({
      createdAt,
      songTitle: opts.currentTitle,
      entryId,
    });

    if (chk?.available) return opts.currentTitle;

    opts.setToast(`Título ${opts.version.toUpperCase()} ocupado en la carpeta de hoy. Regenerando…`);

    const newTitle = await opts.dispatch(
      regenerateSongTitleForEntry({
        entryId,
        passageId: entry.passageId,
        version: opts.version,
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

    return String(newTitle ?? "").trim() || opts.currentTitle;
  } catch {
    return opts.currentTitle;
  }
}

function getTitle(entry: any, version: VersionKey): string {
  const t1 = String(entry?.songTituloV1 ?? entry?.songTitulo ?? "").trim();
  const t2 = String(entry?.songTituloV2 ?? "").trim();
  return version === "v1" ? t1 : t2;
}

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

  async function onDropForEntry(entry: HistoryEntry, file: File) {
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

    const saved = normalizeSaved((entry as any).saved);
    if (isComplete(saved)) {
      setToast("Esta entrada ya está completa (V1/V2 MP3+SRT). Borra asignación si quieres volver a subir.");
      return;
    }

    const version = pickTargetVersion(saved, kind);
    if (!version) {
      setToast(`Ya hay ${kind.toUpperCase()} V1 y V2. Borra la asignación para volver a subir.`);
      return;
    }

    let songTitle = getTitle(entry as any, version);
    if (!songTitle) {
      setToast(`No hay título para ${version.toUpperCase()} en esta entrada.`);
      return;
    }

    // ✅ si la carpeta existe hoy con ese nombre, regenera el título y úsalo
    songTitle = await ensureTitleAvailableOrRegenerate({
      dispatch,
      setToast,
      entry,
      version,
      currentTitle: songTitle,
    });

    try {
      const out = await window.electronAPI.library.saveToLibrary({
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
          <div className="sub">2 versiones por canción (V1/V2) con MP3 y SRT independientes.</div>
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
        const complete = isComplete(saved);

        const t1 = getTitle(e as any, "v1");
        const t2 = getTitle(e as any, "v2");

        return (
          <Item
            key={e.entryId}
            $open={open}
            $complete={complete}
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
                  {saved.v2.mp3 ? <SavedTag label="MP3 V2" onClick={() => copyToDownloads(saved.v2.mp3!.path, "MP3 V2")} /> : null}
                  {saved.v1.srt ? <SavedTag label="SRT V1" onClick={() => copyToDownloads(saved.v1.srt!.path, "SRT V1")} /> : null}
                  {saved.v2.srt ? <SavedTag label="SRT V2" onClick={() => copyToDownloads(saved.v2.srt!.path, "SRT V2")} /> : null}

                  {complete ? (
                    <span style={{
                      display: "inline-flex",
                      alignItems: "center",
                      height: 22,
                      padding: "0 10px",
                      borderRadius: 999,
                      border: "1px solid rgba(255,255,255,0.14)",
                      background: "rgba(74,222,128,0.14)",
                      fontSize: 12,
                      fontWeight: 850,
                      color: "rgba(255,255,255,0.92)",
                    }}>COMPLETO</span>
                  ) : (
                    <span style={{
                      display: "inline-flex",
                      alignItems: "center",
                      height: 22,
                      padding: "0 10px",
                      borderRadius: 999,
                      border: "1px solid rgba(255,255,255,0.14)",
                      background: "rgba(255,255,255,0.06)",
                      fontSize: 12,
                      fontWeight: 850,
                      color: "rgba(255,255,255,0.92)",
                    }}>2 versiones</span>
                  )}

                  {(hasAnySaved(saved)) ? (
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
                          dispatch(clearSavedFilesForEntryId({ entryId: e.entryId }));
                          setToast("Asignación borrada (NAS intacto).");
                        }}
                        title="No borra en el NAS. Solo quita la asignación para poder subir de nuevo."
                      >
                        Borrar asignación
                      </Button>
                    </>
                  ) : null}
                </div>

                <div className="songTitle">{t1 || "(sin título V1)"}</div>
                {t2 ? <div style={{ marginTop: 4, opacity: 0.75 }}>{t2}</div> : null}

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
                    <div className="h">Canción (mismo texto, 2 versiones)</div>

                    <CopyRow>
                      <CopyField>
                        <CopyLabel>Título V1</CopyLabel>
                        <CopyInputWrap onClick={() => t1 && copyToClipboard(t1)} title="Click para copiar">
                          <CopyInput readOnly value={t1 || ""} placeholder="(sin título)" />
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
                          <CopyInput readOnly value={t2 || ""} placeholder="(sin título V2)" />
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

                    <SongCopyBox
                      onClick={() => copyToClipboard(`V1: ${t1}\nV2: ${t2}\n\n${e.songLetra}`)}
                      title="Click para copiar (títulos + letra)"
                    >
                      <div className="pre">{e.songLetra}</div>
                    </SongCopyBox>
                  </Col>
                </Expand>

                <div onClick={(ev) => ev.stopPropagation()}>
                  <div style={{ marginTop: 10, opacity: 0.78, fontSize: 12 }}>
                    Drop: MP3 y SRT. Asignación automática: primero V1, luego V2. Si ya está todo subido, borra asignación.
                  </div>
                  <DropZone
                    onDropFile={(file) => onDropForEntry(e, file)}
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
