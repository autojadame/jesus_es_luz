import styled from "styled-components";
import { Card } from "@/ui/components/Card";

export const Wrap = styled.div`
  padding: 18px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  max-height: calc(100vh - 56px);
    min-height: calc(100vh - 56px);

    overflow: auto;
`;

export const Header = styled(Card)`
  padding: 14px;
  display: flex;
  justify-content: space-between;
  gap: 12px;
  align-items: center;

  .left {
    min-width: 0;
  }
  .t {
    font-weight: 860;
    font-size: 16px;
  }
  .sub {
    margin-top: 6px;
    font-size: 12px;
    color: rgba(255, 255, 255, 0.68);
  }
`;

export const RightTools = styled.div`
  display: flex;
  gap: 10px;
  align-items: center;
  flex-wrap: wrap;
`;

export const IndexBadge = styled.div`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 26px;
  height: 22px;
  padding: 0 8px;
  border-radius: 999px;
  border: 1px solid rgba(255, 255, 255, 0.14);
  background: rgba(255, 255, 255, 0.06);
  font-size: 12px;
  font-weight: 850;
`;

export const Chip = styled.div<{ $tone?: "ok" | "bad" | "neutral" }>`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: 22px;
  padding: 0 10px;
  border-radius: 999px;
  border: 1px solid rgba(255,255,255,0.14);

  font-size: 12px;
  font-weight: 850;
  color: rgba(255,255,255,0.92);

  background: ${({ $tone }) =>
    $tone === "ok"
      ? "rgba(74,222,128,0.14)"
      : $tone === "bad"
      ? "rgba(255,77,109,0.16)"
      : "rgba(255,255,255,0.06)"};
`;

export const Item = styled(Card)<{ $open?: boolean; $complete?: boolean }>`
  padding: 12px;
  cursor: pointer;
  user-select: none;

  opacity: ${({ $complete }) => ($complete ? 0.58 : 1)};
  transition: opacity 0.18s ease, filter 0.18s ease, border-color 0.18s ease;

  &:hover {
    opacity: ${({ $complete }) => ($complete ? 0.72 : 1)};
  }

  border-color: ${({ $open }) =>
    $open ? "rgba(124,92,255,0.55)" : "rgba(255,255,255,0.10)"};
  background: ${({ $open }) =>
    $open ? "rgba(124,92,255,0.08)" : "rgba(255,255,255,0.06)"};

  .top {
    display: flex;
    width: 100%;

    align-items: flex-start;
  }

  .left {
    min-width: 0;
        width: 100%;
  }

  .ref {
    font-weight: 840;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .meta {
    margin-top: 6px;
    font-size: 12px;
    color: rgba(255, 255, 255, 0.66);
    display: flex;
    gap: 10px;
    align-items: center;
    flex-wrap: wrap;
  }

  .sumTitle {
    margin-top: 10px;
    font-weight: 880;
  }

  .sumDesc {
    margin-top: 6px;
    color: rgba(255, 255, 255, 0.74);
    line-height: 1.32;
  }
`;

export const Expand = styled.div`
  margin-top: 12px;
  border-top: 1px solid rgba(255, 255, 255, 0.10);
  padding-top: 12px;

  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;

  @media (max-width: 1100px) {
    grid-template-columns: 1fr;
  }
`;

export const Col = styled.div`
  border: 1px solid rgba(255,255,255,0.10);
  background: rgba(0,0,0,0.22);
  border-radius: 14px;
  padding: 10px;

  .h {
    font-weight: 880;
    font-size: 12px;
    color: rgba(255,255,255,0.78);
    margin-bottom: 10px;
  }

  .pre {
    white-space: pre-wrap;
    line-height: 1.34;
    color: rgba(255,255,255,0.82);
    max-height: 420px;
    overflow: auto;
    padding-right: 6px;
  }
`;

/* --------- Copy Inputs (Título / Estilo) --------- */

export const CopyRow = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
  margin-bottom: 10px;

  @media (max-width: 1100px) {
    grid-template-columns: 1fr;
  }
`;

export const CopyField = styled.div`
  display: flex;
  flex-direction: column;
  gap: 6px;
`;

export const CopyLabel = styled.div`
  font-size: 11px;
  color: rgba(255,255,255,0.62);
`;

export const CopyInputWrap = styled.div`
  display: grid;
  grid-template-columns: 1fr 34px;
  align-items: stretch;

  border-radius: 14px;
  border: 1px solid rgba(255,255,255,0.12);
  background: rgba(255,255,255,0.05);

  overflow: hidden;
  cursor: pointer;
  user-select: none;

  transition: filter 0.12s ease, border-color 0.15s ease, transform 0.08s ease;

  &:hover {
    filter: brightness(1.08);
    border-color: rgba(124,92,255,0.40);
  }
  &:active {
    transform: translateY(1px);
  }
`;

export const CopyInput = styled.input`
  border: 0;
  outline: none;
  background: transparent;
  color: rgba(255,255,255,0.92);
  padding: 9px 10px;
  font-weight: 750;
  min-width: 0;
  cursor: pointer;
`;

export const CopyIcon = styled.div`
  display: grid;
  place-items: center;
  border-left: 1px solid rgba(255,255,255,0.10);
  color: rgba(255,255,255,0.72);
  font-size: 14px;

  /* iconito “copy” simple */
  &::before {
    content: "⧉";
  }
`;

/* --------- Click-to-copy lyric block --------- */

export const SongCopyBox = styled.div`
  border-radius: 14px;
  border: 1px solid rgba(255,255,255,0.10);
  background: rgba(255,255,255,0.04);
  padding: 10px;

  cursor: pointer;
  user-select: none;

  transform-origin: top left;
  transition: transform 0.14s ease, filter 0.14s ease, border-color 0.14s ease;

  &:hover {
    filter: brightness(1.05);
    border-color: rgba(34,211,238,0.35);
  }

`;