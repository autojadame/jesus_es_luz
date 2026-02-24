import React, { useState } from "react";
import styled from "styled-components";
import { Loader } from "@/ui/components/Loader";

const Zone = styled.div<{ $over?: boolean; $busy?: boolean }>`
  margin-top: 12px;
  border-radius: 16px;
  border: 1px dashed
    ${({ $over, $busy }) =>
      $busy ? "rgba(124,92,255,0.55)" : $over ? "rgba(34,211,238,0.55)" : "rgba(255,255,255,0.18)"};
  background: ${({ $over, $busy }) =>
    $busy ? "rgba(124,92,255,0.08)" : $over ? "rgba(34,211,238,0.08)" : "rgba(255,255,255,0.03)"};

  padding: 16px;
  text-align: center;
  color: rgba(255, 255, 255, 0.78);

  transition: filter 0.14s ease, border-color 0.14s ease, background 0.14s ease;

  cursor: ${({ $busy }) => ($busy ? "default" : "pointer")};
  user-select: none;
  pointer-events: ${({ $busy }) => ($busy ? "none" : "auto")};

  .t {
    font-weight: 850;
    margin-bottom: 6px;
  }
  .s {
    font-size: 12px;
    opacity: 0.75;
  }

  .busyRow {
    margin-top: 10px;
    display: inline-flex;
    align-items: center;
    gap: 10px;
    opacity: 0.92;
  }

  .busyText {
    font-size: 12px;
    opacity: 0.85;
    white-space: nowrap;
  }
`;

export function DropZone({
  onDropFile,
}: {
  onDropFile: (file: File) => Promise<void> | void;
}) {
  const [over, setOver] = useState(false);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<{ i: number; n: number } | null>(null);

  return (
    <Zone
      $over={over}
      $busy={busy}
      onDragOver={(e) => {
        e.preventDefault();
        if (!busy) setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={async (e) => {
        e.preventDefault();
        if (busy) return;

        setOver(false);

        const files = Array.from(e.dataTransfer.files ?? []);
        if (!files.length) return;

        setBusy(true);
        setProgress({ i: 0, n: files.length });

        try {
          // ✅ secuencial: evita saturar IPC / red
          for (let i = 0; i < files.length; i++) {
            setProgress({ i: i + 1, n: files.length });
            await Promise.resolve(onDropFile(files[i]));
          }
        } finally {
          setProgress(null);
          setBusy(false);
        }
      }}
      title="Suelta un .mp3 o .srt"
    >
      <div className="t">
        {busy ? "Guardando en librería…" : "Suelta aquí la canción (MP3) o las letras (SRT)"}
      </div>
      <div className="s">
        {busy
          ? "No cierres la app durante la copia."
          : "Puedes soltar uno o dos archivos (MP3 + SRT)."}
      </div>

      {busy && (
        <div className="busyRow">
          <Loader />
          <div className="busyText">
            {progress ? `Procesando ${progress.i}/${progress.n}` : "Procesando…"}
          </div>
        </div>
      )}
    </Zone>
  );
}