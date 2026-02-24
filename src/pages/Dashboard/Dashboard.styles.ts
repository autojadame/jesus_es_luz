import styled from "styled-components";
import { Card } from "@/ui/components/Card";

export const Wrap = styled.div`
      padding: 18px;
    display: grid
;
    grid-template-rows: auto 1fr auto;
    gap: 14px;
    max-height: calc(100vh - 56px);
    min-height: calc(100vh - 56px);

    overflow: auto;
`;

export const TopGrid = styled.div`
  display: flex;
  flex-direction: column;
  gap: 34px;
  align-items: start;
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
  font-weight: 800;
  color: rgba(255, 255, 255, 0.92);
`;

export const Featured = styled(Card)`
  padding: 14px;
  min-width: 0;
  width: 100%;
  .head {
    display: flex;
    justify-content: space-between;
    gap: 12px;
    align-items: center;
    margin-bottom: 8px;
  }

  .leftHead {
    display: flex;
    gap: 10px;
    align-items: center;
    min-width: 0;
  }

  .ref {
    font-weight: 800;
    letter-spacing: 0.2px;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .meta {
    font-size: 12px;
    color: rgba(255, 255, 255, 0.65);
    margin-top: 2px;
  }

  .title {
    font-size: 18px;
    font-weight: 820;
    margin-top: 8px;
  }

  .desc {
    margin-top: 6px;
    color: rgba(255, 255, 255, 0.74);
    line-height: 1.35;
  }
`;

export const TextBox = styled.div`
  margin-top: 10px;
  border: 1px solid rgba(255, 255, 255, 0.10);
  background: rgba(0, 0, 0, 0.22);
  border-radius: 14px;
  padding: 10px;
`;

export const Grid = styled.div`
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;

  @media (max-width: 1100px) {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
`;

export const SmallCard = styled(Card)<{ $selected?: boolean }>`
  padding: 12px;
  min-width: 0;
  cursor: pointer;
  user-select: none;

  border-color: ${({ $selected }) =>
    $selected ? "rgba(124, 92, 255, 0.55)" : "rgba(255,255,255,0.10)"};

  background: ${({ $selected }) =>
    $selected ? "rgba(124, 92, 255, 0.10)" : "rgba(255,255,255,0.06)"};

  transition: transform 0.08s ease, filter 0.12s ease, border-color 0.15s ease, background 0.15s ease;

  &:hover { filter: brightness(1.06); }
  &:active { transform: translateY(1px); }

  .top {
    display: flex;
    justify-content: space-between;
    gap: 10px;
    align-items: center;
    margin-bottom: 8px;
  }

  .t {
    font-weight: 780;
    margin-bottom: 6px;
  }

  .d {
    font-size: 13px;
    color: rgba(255, 255, 255, 0.72);
    line-height: 1.32;
    min-height: 52px;
  }

  .foot {
    margin-top: 10px;
    display: flex;
    justify-content: space-between;
    gap: 8px;
    align-items: center;
    font-size: 12px;
    color: rgba(255, 255, 255, 0.62);
  }
`;

export const BottomBar = styled.div`
  display: flex;
  justify-content: space-between;
  gap: 12px;
  align-items: center;
`;