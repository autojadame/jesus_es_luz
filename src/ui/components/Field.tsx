import styled from "styled-components";

export const Label = styled.div`
  font-size: 12px;
  color: ${({ theme }) => theme.colors.sub};
  margin-bottom: 6px;
`;

export const Input = styled.input`
  width: 100%;
  padding: 10px 12px;
  border-radius: ${({ theme }) => theme.radii.lg};
  border: 1px solid ${({ theme }) => theme.colors.border};
  background: rgba(0, 0, 0, 0.22);
  color: ${({ theme }) => theme.colors.text};
  outline: none;
`;

export const TextArea = styled.textarea`
  width: 100%;
  min-height: 65.5vh;
  padding: 12px 12px;
  border-radius: ${({ theme }) => theme.radii.lg};
  border: 1px solid ${({ theme }) => theme.colors.border};
  background: rgba(0, 0, 0, 0.22);
  color: ${({ theme }) => theme.colors.text};
  outline: none;
  resize: vertical;
  line-height: 1.35;
`;