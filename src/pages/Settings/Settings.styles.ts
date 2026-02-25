import styled from "styled-components";
import { Card } from "@/ui/components/Card";

export const Wrap = styled.div`
  padding: 18px;
  display: grid;
  grid-template-columns: 1.2fr 0.8fr;
  gap: 14px;

  max-height: calc(100vh - 56px);
  min-height: calc(100vh - 56px);
  overflow: auto;

  @media (max-width: 980px) {
    grid-template-columns: 1fr;
  }
`;

export const Panel = styled(Card)`
  padding: 14px;
  min-width: 0;
`;

export const Title = styled.div`
  font-weight: 760;
  font-size: 16px;
  margin-bottom: 8px;
`;

export const Sub = styled.div`
  font-size: 12px;
  color: ${({ theme }) => theme.colors.sub};
  margin-bottom: 12px;
`;

export const Row = styled.div`
  display: flex;
  gap: 10px;
  align-items: center;
  flex-wrap: wrap;
`;

export const Pill = styled.div<{ $tone?: "ok" | "warn" | "bad" }>`
  font-size: 12px;
  padding: 6px 10px;
  border-radius: 999px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  background: ${({ $tone }) =>
    $tone === "ok"
      ? "rgba(74,222,128,0.12)"
      : $tone === "warn"
      ? "rgba(251,191,36,0.12)"
      : $tone === "bad"
      ? "rgba(255,77,109,0.12)"
      : "rgba(255,255,255,0.06)"};
`;

/* -------------------------
 * STATS
 * ------------------------- */
export const StatGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;

  @media (max-width: 720px) {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
`;

export const StatBox = styled.div`
  padding: 10px 10px;
  border-radius: 14px;
  border: 1px solid rgba(255, 255, 255, 0.10);
  background: rgba(255, 255, 255, 0.04);
`;

export const StatLabel = styled.div`
  font-size: 12px;
  opacity: 0.72;
`;

export const StatValue = styled.div`
  margin-top: 4px;
  font-size: 18px;
  font-weight: 800;
`;

/* -------------------------
 * NAS
 * ------------------------- */
export const NasDot = styled.div<{ $ok: boolean | null }>`
  width: 12px;
  height: 12px;
  border-radius: 999px;
  border: 1px solid rgba(255, 255, 255, 0.16);

  background: ${({ $ok }) =>
    $ok === null ? "rgba(255,255,255,0.18)" : $ok ? "rgba(34,197,94,0.95)" : "rgba(239,68,68,0.95)"};

  box-shadow: 0 0 0 3px
    ${({ $ok }) =>
      $ok === null ? "rgba(255,255,255,0.08)" : $ok ? "rgba(34,197,94,0.18)" : "rgba(239,68,68,0.18)"};
`;

/* -------------------------
 * DESCARTES
 * ------------------------- */
export const ListHeader = styled.div`
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
`;

export const DiscardList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 10px;
  max-height: 80vh;
  overflow: auto;
  padding-right: 6px;
  padding-top: 6px;
`;

export const DiscardItem = styled.button`
  width: 100%;
  text-align: left;

  padding: 10px 10px;
  border-radius: 14px;
  border: 1px solid rgba(255,255,255,0.10);
  background: rgba(255,255,255,0.04);
  color: inherit;

  cursor: pointer;
  transition: background 140ms ease, border-color 140ms ease, transform 140ms ease;

  &:hover {
    background: rgba(239,68,68,0.10);
    border-color: rgba(239,68,68,0.40);
    transform: translateY(-1px);
  }
`;

export const DiscardTitle = styled.div`
  font-weight: 750;
  font-size: 13px;
  line-height: 1.25;
`;

export const DiscardMeta = styled.div`
  margin-top: 4px;
  font-size: 12px;
  opacity: 0.68;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
`;