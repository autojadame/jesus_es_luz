import styled from "styled-components";
import { Card } from "@/ui/components/Card";

export const Wrap = styled.div`
  padding: 18px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-height: calc(100vh - 56px);
    max-height: calc(100vh - 56px);
    overflow:auto;
`;

export const Header = styled.div`
  display: flex;
  justify-content: space-between;
  gap: 12px;
  align-items: center;

  .t {
    font-weight: 850;
    font-size: 16px;
  }
  .sub {
    font-size: 12px;
    color: rgba(255,255,255,0.68);
    margin-top: 4px;
  }
`;

export const Item = styled(Card)<{ $open?: boolean; $complete?: boolean }>`
  padding: 12px;
  cursor: pointer;
  border-color: ${({ $open }) => ($open ? "rgba(124,92,255,0.55)" : "rgba(255,255,255,0.10)")};
  background: ${({ $open }) => ($open ? "rgba(124,92,255,0.08)" : "rgba(255,255,255,0.06)")};

  opacity: ${({ $complete }) => ($complete ? 0.58 : 1)};
  transition: opacity 0.18s ease, filter 0.18s ease, border-color 0.18s ease;

  &:hover {
    opacity: ${({ $complete }) => ($complete ? 0.72 : 1)};
  }

  .top {
    display: flex;
    justify-content: space-between;
    gap: 10px;
    align-items: flex-start;
  }

  .left {
    min-width: 0;
  }

  .ref {
    font-weight: 820;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .meta {
    margin-top: 4px;
    font-size: 12px;
    color: rgba(255,255,255,0.66);
  }

  .songTitle {
    margin-top: 10px;
    font-weight: 850;
  }

  .summary {
    margin-top: 6px;
    color: rgba(255,255,255,0.74);
    line-height: 1.32;
  }
`;

export const Expand = styled.div`
  margin-top: 12px;
  border-top: 1px solid rgba(255,255,255,0.10);
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
    font-weight: 850;
    font-size: 12px;
    color: rgba(255,255,255,0.78);
    margin-bottom: 8px;
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

export const RightTools = styled.div`
  display: flex;
  gap: 10px;
  align-items: center;
  flex-wrap: wrap;
`;