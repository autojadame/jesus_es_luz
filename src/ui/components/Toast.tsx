import React, { useEffect } from "react";
import styled from "styled-components";

const Wrap = styled.div`
  position: fixed;
  right: 18px;
  bottom: 18px;
  padding: 10px 12px;
  border-radius: 14px;
  background: rgba(0,0,0,0.55);
  border: 1px solid rgba(255,255,255,0.12);
  backdrop-filter: blur(10px);
  color: rgba(255,255,255,0.92);
  max-width: min(520px, calc(100vw - 36px));
  line-height: 1.25;
`;

export function Toast({
  text,
  onDone,
  durationMs = 8200, // ✅ más tiempo por defecto
}: {
  text: string;
  onDone: () => void;
  durationMs?: number;
}) {
  useEffect(() => {
    const t = setTimeout(onDone, durationMs);
    return () => clearTimeout(t);
  }, [onDone, durationMs]);

  return <Wrap>{text}</Wrap>;
}