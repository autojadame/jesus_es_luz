import styled, { keyframes } from "styled-components";

const spin = keyframes`to { transform: rotate(360deg); }`;

export const Loader = styled.div`
  width: 18px;
  height: 18px;
  border-radius: 50%;
  border: 2px solid rgba(255,255,255,0.20);
  border-top-color: rgba(255,255,255,0.78);
  animation: ${spin} 0.8s linear infinite;
`;