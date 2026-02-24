import React from "react";
import { NavLink, useLocation } from "react-router-dom";
import { Shell, Sidebar, Brand, Nav, Main } from "./AppShell.styles";
import logo from "./icon.png";
import { WindowTitleBar } from "@/ui/WindowTitleBar/WindowTitleBar";

export function AppShell({ children }: { children: React.ReactNode }) {
  const { pathname } = useLocation();

  const dashboardActive = pathname === "/dashboard" || pathname === "/process";
  const settingsActive = pathname === "/settings";
  const historyActive = pathname === "/history";

  return (
    <Shell>
      <Sidebar>
        <Brand>
          <img src={logo} width={40} height={40} style={{ borderRadius: "50%" }} alt="" />
          <div>
            <div className="name">Alabanzas Cristo</div>
            <div className="tag">Generación de contenido</div>
          </div>
        </Brand>

        <Nav>
          <NavLink
            to="/dashboard"
            style={{outline: "none"}}
            className={() => (dashboardActive ? "active" : "")}
            onClick={(e) => {
              if (dashboardActive) e.preventDefault();
            }}
          >
            Generación
          </NavLink>

          <NavLink
            to="/settings"
            style={{outline: "none"}}
            className={() => (settingsActive ? "active" : "")}
            onClick={(e) => {
              if (settingsActive) e.preventDefault();
            }}
          >
            Ajustes
          </NavLink>

          <NavLink
            to="/history"
            style={{outline: "none"}}
            className={() => (historyActive ? "active" : "")}
            onClick={(e) => {
              if (historyActive) e.preventDefault();
            }}
          >
            Histórico
          </NavLink>
        </Nav>
      </Sidebar>

      <Main>
        <WindowTitleBar />
        {children}
      </Main>
    </Shell>
  );
}