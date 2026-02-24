import styled from "styled-components";

export const Button = styled.button<{ $variant?: "primary" | "ghost" | "danger" }>`
  border: 1px solid ${({ theme }) => theme.colors.border};
  background: ${({ $variant, theme }) =>
    $variant === "primary"
      ? `linear-gradient(135deg, ${theme.colors.accent} 0%, ${theme.colors.accent2} 120%)`
      : $variant === "danger"
      ? `rgba(255,77,109,0.16)`
      : `rgba(255,255,255,0.06)`};
  color: ${({ theme }) => theme.colors.text};
  padding: 10px 14px;
  border-radius: ${({ theme }) => theme.radii.lg};
  cursor: pointer;
  font-weight: 650;
  transition: transform 0.08s ease, filter 0.15s ease, background 0.2s ease;

  &:hover { filter: brightness(1.06); }
  &:active { transform: translateY(1px); }
  &:disabled { opacity: 0.5; cursor: not-allowed; }
`;