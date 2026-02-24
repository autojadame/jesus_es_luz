export const theme = {
  colors: {
    bg: "#070A12",
    panel: "rgba(255,255,255,0.06)",
    panel2: "rgba(255,255,255,0.09)",
    border: "rgba(255,255,255,0.10)",
    text: "rgba(255,255,255,0.92)",
    mut: "rgba(255,255,255,0.70)",
    sub: "rgba(255,255,255,0.62)",
    accent: "#7C5CFF",
    accent2: "#22D3EE",
    danger: "#ff4d6d",
    ok: "#4ade80",
    warn: "#fbbf24",
  },
  radii: {
    xl: "18px",
    lg: "14px",
    md: "12px",
  },
  shadow: {
    soft: "0 18px 54px rgba(0,0,0,0.40)",
  },
};
export type AppTheme = typeof theme;