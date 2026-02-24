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
  border: 1px solid rgba(255,255,255,0.12);
  background: ${({ $tone }) =>
    $tone === "ok" ? "rgba(74,222,128,0.12)" :
    $tone === "warn" ? "rgba(251,191,36,0.12)" :
    $tone === "bad" ? "rgba(255,77,109,0.12)" :
    "rgba(255,255,255,0.06)"};
`;

export const PreviewList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 10px;
  max-height: 80vh;
  overflow: auto;
  padding-right: 6px;
`;

export const PreviewItem = styled.div`
  padding: 10px 10px;
  border-radius: 14px;
  border: 1px solid rgba(255,255,255,0.10);
  background: rgba(255,255,255,0.04);
  
  .top { display: flex; justify-content: space-between; gap: 10px; }
  .ref { font-weight: 700; }
  .t { font-size: 12px; color: rgba(255,255,255,0.70); margin-top: 6px; }
`;