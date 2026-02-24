import { createGlobalStyle } from "styled-components";

export const GlobalStyles = createGlobalStyle`
  * { box-sizing: border-box; }
  html, body, #root { height: 100%; }
  body {
    margin: 0;
    font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial;
    background: radial-gradient(900px 520px at 18% 22%, rgba(124,92,255,0.18), transparent 60%),
                radial-gradient(820px 480px at 72% 18%, rgba(34,211,238,0.12), transparent 60%),
                #070A12;
    color: rgba(255,255,255,0.92);
  }
  a { color: inherit; text-decoration: none; }
  textarea, input, button { font: inherit; }
    /* ----------------------------
     Scrollbars (global)
     - Finos, coherentes con theme
     - WebKit + Firefox
  ---------------------------- */

  /* Firefox */
  * {
    scrollbar-width: thin;
    scrollbar-color: rgba(124, 92, 255, 0.55) rgba(255, 255, 255, 0.06);
  }

  /* WebKit (Chromium / Electron) */
  *::-webkit-scrollbar {
    width: 10px;
    height: 10px;
  }

  *::-webkit-scrollbar-track {
    background: rgba(255, 255, 255, 0.05);
    border-radius: 999px;
  }

  *::-webkit-scrollbar-thumb {
    background: linear-gradient(
      180deg,
      rgba(124, 92, 255, 0.75) 0%,
      rgba(34, 211, 238, 0.55) 100%
    );
    border-radius: 999px;
    border: 2px solid rgba(0, 0, 0, 0.35); /* “gutter” para que se vea fino */
    background-clip: padding-box;
  }

  *::-webkit-scrollbar-thumb:hover {
    filter: brightness(1.08);
  }

  *::-webkit-scrollbar-corner {
    background: transparent;
  }
`;