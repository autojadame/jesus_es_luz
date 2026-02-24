import styled from "styled-components";

export const Bar = styled.div`
  z-index: 9999;

  height: 56px;
  display: grid;
  grid-template-columns: auto 1fr auto;
  align-items: center;
  gap: 12px;
  padding: 0 10px;

  background: rgba(6, 7, 11, 0.92);
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);

  user-select: none;
`;

export const Left = styled.div`
  display: inline-flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
  pointer-events: none;
  margin-left: 6px;
`;

export const AppName = styled.div`
  font-weight: 900;
  color: rgba(255, 255, 255, 0.92);
  white-space: nowrap;
`;

export const Center = styled.div`
  min-width: 0;
  text-align: center;
  color: rgba(255, 255, 255, 0.88);
  font-weight: 800;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

export const Controls = styled.div`
  display: flex;
  align-items: center;
  justify-content: flex-end;
  align-items: center;
  gap: 6px;
  max-height: 0px;
`;

export const WinBtn = styled.button<{ $danger?: boolean }>`
  width: 38px;
  height: 28px;
  border-radius: 10px;
  border: 1px solid rgba(255, 255, 255, 0.10);
  background: rgba(255, 255, 255, 0.06);
  color: rgba(255, 255, 255, 0.88);
  cursor: pointer;

  display: grid;
  place-items: center;

  transition: filter 0.12s ease, transform 0.08s ease, background 0.12s ease;

  &:hover {
    filter: brightness(1.12);
    background: ${({ $danger }) =>
      $danger ? "rgba(255,77,109,0.18)" : "rgba(124,92,255,0.14)"};
  }
  &:active {
    transform: translateY(1px);
  }
`;