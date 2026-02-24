import React, { useRef, useState } from "react";
import styled from "styled-components";
import { Loader } from "@/ui/components/Loader";
import { flushSync } from "react-dom";

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

  cursor: ${({ $busy }) => ($busy ? "progress" : "pointer")};
  user-select: none;

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

const nextFrame = () => new Promise<void>((r) => requestAnimationFrame(() => r()));

function isAllowedFile(f: File) {
  const name = (f?.name ?? "").toLowerCase();
  return name.endsWith(".mp3") || name.endsWith(".srt");
}

export function DropZone({
  onDropFile,
  onInfo,
}: {
  onDropFile: (file: File) => Promise<void> | void;
  onInfo?: (msg: string) => void; // optional toast hook
}) {
  const [over, setOver] = useState(false);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<{ i: number; n: number } | null>(null);

  const inputRef = useRef<HTMLInputElement | null>(null);

  async function processFiles(files: File[]) {
    const allowed = files.filter(isAllowedFile);
    const rejected = files.length - allowed.length;

    if (!allowed.length) {
      onInfo?.("Only .mp3 or .srt files are allowed.");
      return;
    }
    if (rejected > 0) onInfo?.(`Ignored ${rejected} file(s). Only .mp3/.srt are accepted.`);

    flushSync(() => {
      setBusy(true);
      setProgress({ i: 0, n: allowed.length });
    });

    await nextFrame(); // ensure loader paints

    try {
      for (let i = 0; i < allowed.length; i++) {
        setProgress({ i: i + 1, n: allowed.length });
        await Promise.resolve(onDropFile(allowed[i]));
      }
    } finally {
      flushSync(() => {
        setProgress(null);
        setBusy(false);
      });
    }
  }

  return (
    <>
      <Zone
        $over={over}
        $busy={busy}
        title="Drop MP3/SRT here or click to select"
        onClick={() => {
          if (busy) return;
          inputRef.current?.click();
        }}
        onDragOver={(e) => {
          e.preventDefault();
          e.stopPropagation();
          if (busy) return;
          setOver(true);
        }}
        onDragLeave={(e) => {
          e.preventDefault();
          e.stopPropagation();
          if (busy) return;
          setOver(false);
        }}
        onDrop={async (e) => {
          e.preventDefault();
          e.stopPropagation();
          if (busy) return;

          setOver(false);
          const files = Array.from(e.dataTransfer.files ?? []);
          if (!files.length) return;

          await processFiles(files);
        }}
      >
        <div className="t">
          {busy ? "Guardando…" : "Suéltalo o haz clic aquí para añadir los archivos (MP3/SRT)"}
        </div>
        <div className="s">
          {busy ? "Por favor no cierres la ventana." : "Puedes seleccionar multiples archivos (.mp3 + .srt)."}
        </div>

        {busy && (
          <div className="busyRow">
            <Loader />
            <div className="busyText">
              {progress ? `Processing ${progress.i}/${progress.n}` : "Processing…"}
            </div>
          </div>
        )}
      </Zone>

      {/* Hidden file picker */}
      <input
        ref={inputRef}
        type="file"
        multiple
        accept=".mp3,.srt,audio/mpeg,text/plain"
        style={{ display: "none" }}
        onChange={async (e) => {
          const files = Array.from(e.target.files ?? []);
          // reset input so selecting same files again still triggers change
          e.target.value = "";
          if (!files.length) return;
          if (busy) return;
          await processFiles(files);
        }}
      />
    </>
  );
}