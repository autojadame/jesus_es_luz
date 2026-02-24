import styled from "styled-components";

export const Card = styled.div`
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.radii.xl};
  box-shadow: ${({ theme }) => theme.shadow.soft};
  backdrop-filter: blur(10px);
`;