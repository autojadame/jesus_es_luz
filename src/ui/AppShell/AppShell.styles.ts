import styled from "styled-components";

export const Shell = styled.div`
  height: 100%;
  display: grid;
  grid-template-columns: 260px 1fr;
`;

export const Sidebar = styled.aside`
  border-right: 1px solid ${({ theme }) => theme.colors.border};
  background: rgba(0, 0, 0, 0.22);
  backdrop-filter: blur(12px);
  padding: 18px 16px;
  display: flex;
  flex-direction: column;
  gap: 18px;
`;

export const Brand = styled.div`
  display: flex;
  gap: 12px;
  align-items: center;

  .logo {
    width: 40px;
    height: 40px;
    border-radius: 14px;
    background: radial-gradient(circle at 20% 20%, ${({ theme }) => theme.colors.accent}, transparent 60%),
      radial-gradient(circle at 70% 40%, ${({ theme }) => theme.colors.accent2}, transparent 60%),
      rgba(255, 255, 255, 0.06);
    border: 1px solid ${({ theme }) => theme.colors.border};
    box-shadow: 0 16px 38px rgba(0, 0, 0, 0.45);
  }

  .name {
    font-weight: 760;
    letter-spacing: 0.2px;
  }
  .tag {
    font-size: 12px;
    color: ${({ theme }) => theme.colors.sub};
    margin-top: 2px;
  }
`;

export const Nav = styled.nav`
  display: flex;
  flex-direction: column;
  gap: 10px;

  a {
    padding: 10px 12px;
    border-radius: 14px;
    border: 1px solid transparent;
    color: ${({ theme }) => theme.colors.mut};
    background: transparent;
  }
  a.active {
    background: rgba(255, 255, 255, 0.06);
    border-color: rgba(255, 255, 255, 0.10);
    color: ${({ theme }) => theme.colors.text};
  }
`;

export const Main = styled.main`
  min-width: 0;
  display: flex;
  flex-direction: column;
`;

export const TopBar = styled.div`
  height: 56px;
  display: flex;
  align-items: center;
  padding: 0 18px;
  border-bottom: 1px solid ${({ theme }) => theme.colors.border};
  background: rgba(0, 0, 0, 0.18);
  backdrop-filter: blur(10px);
`;

export const TopTitle = styled.div`
  font-weight: 720;
  color: ${({ theme }) => theme.colors.text};
`;