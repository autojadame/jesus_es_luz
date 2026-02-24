import React, { useEffect, useMemo, useRef, useState } from "react";
import { Bar, Left, Controls, WinBtn } from "./WindowTitleBar.styles";

const LOVE_MESSAGES: string[] = [
  "Eres mi lugar favorito en el mundo. ❤️",
  "Gracias por existir y por elegirme cada día. 💛",
  "Contigo, lo simple se vuelve precioso. ✨",
  "Te miro y se me ordena el corazón. 🥰",
  "Eres mi paz cuando todo corre. 🌿",
  "Si hoy es difícil, recuerda: estoy contigo. 🤍",
  "Me encanta tu risa: es mi canción preferida. 🎶",
  "Tu amor me hace valiente. 💪❤️",
  "Eres casa. Siempre. 🏡",
  "Qué suerte la mía de coincidir contigo. 🍀",
  "Te pienso y se me ilumina el día. ☀️",
  "Tus abrazos son mi refugio. 🤗",
  "Eres mi mejor decisión. 💍✨",
  "Me haces querer ser mejor, sin exigirme nada. 🌸",
  "Tu mirada me calma. 🫶",
  "Te quiero bonito: con hechos, con tiempo, con cuidado. 💞",
  "Gracias por tu paciencia y tu cariño. 🌷",
  "Tu voz me da tranquilidad. 🎧",
  "Me encanta la vida cuando estás cerca. 🌙",
  "Siempre encuentro motivos para amarte más. 💗",
  "Eres mi persona favorita. 🥹",
  "Tú y yo, a nuestra manera, siempre. ♾️",
  "Te quiero en mis días buenos y en los difíciles. 🤍",
  "Eres el sí que repetiría mil veces. ✅❤️",
  "Gracias por hacer equipo conmigo. 🤝",
  "Tu ternura me derrite. 🫠💖",
  "Te elijo hoy, y mañana, y todos los días. 🌅",
  "Tu sonrisa me arregla el mundo. 😊",
  "Contigo, todo tiene sentido. 🧡",
  "Eres mi calma favorita. 🌊",
  "Ojalá pudieras verte con mis ojos. 👀💘",
  "Me encanta cómo cuidas de los detalles. 🎁",
  "Eres magia cotidiana. ✨",
  "Qué bonito es quererte. 🌹",
  "Tenerte es mi mayor fortuna. 💛",
  "Hoy también te quiero, muchísimo. ❤️",
  "Eres mi mejor plan. 🗺️",
  "Me haces sentir en casa incluso lejos. 🏠",
  "Qué bien me sienta tu amor. 🌈",
  "Tus manos en las mías y ya. 🤝💞",
  "Me encanta crecer contigo. 🌱",
  "Eres mi “todo va a estar bien”. 🤍",
  "Gracias por tus pequeños gestos. 🫶✨",
  "Eres mi alegría tranquila. 😊🌿",
  "Si te tengo a ti, me basta. 💗",
  "Te quiero sin prisa y con intención. 🕊️",
  "Mi corazón te reconoce. 💓",
  "Contigo, el futuro da menos miedo. 🌟",
  "Eres mi más bonito “para siempre”. ♾️❤️",
];

function pickManyUnique(arr: string[], n: number): string[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy.slice(0, Math.min(n, copy.length));
}

export function WindowTitleBar() {
  const [pool, setPool] = useState<string[]>(() => pickManyUnique(LOVE_MESSAGES, 10));
  const [activeIdx, setActiveIdx] = useState(0);

  const [isMax, setIsMax] = useState(false);

  // --- drag manual state ---
  const draggingRef = useRef(false);
  const rafRef = useRef<number | null>(null);
  const lastRef = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    window.electronAPI.windowControls.isMaximized().then(setIsMax);
    const off = window.electronAPI.windowControls.onMaximized(setIsMax);
    return () => off?.();
  }, []);

  useEffect(() => {
    const t = setInterval(() => {
      setActiveIdx((prev) => {
        const next = prev + 1;
        if (next >= pool.length) {
          setPool(pickManyUnique(LOVE_MESSAGES, 10));
          return 0;
        }
        return next;
      });
    }, 15 * 60 * 1000);

    return () => clearInterval(t);
  }, [pool.length]);

  // listeners globales para el drag manual
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!draggingRef.current) return;

      lastRef.current = { x: e.screenX, y: e.screenY };
      if (rafRef.current != null) return;

      rafRef.current = window.requestAnimationFrame(() => {
        rafRef.current = null;
        const p = lastRef.current;
        if (!p) return;
        window.electronAPI.windowControls.dragMove({ screenX: p.x, screenY: p.y });
      });
    };

    const onUp = () => {
      if (!draggingRef.current) return;
      draggingRef.current = false;
      window.electronAPI.windowControls.dragEnd();
    };

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      if (rafRef.current != null) window.cancelAnimationFrame(rafRef.current);
    };
  }, []);

  const msg = useMemo(
    () => pool[activeIdx] ?? "Qué tengas un bonito día mi amor ❤️",
    [pool, activeIdx]
  );

  return (
    <Bar
      onDoubleClick={() => window.electronAPI.windowControls.toggleMaximize()}
      onMouseDown={(e) => {
        // click izquierdo
        if (e.button !== 0) return;

        // si clic en controles (botones), no iniciamos drag
        const target = e.target as HTMLElement;
        if (target.closest('[data-no-drag="true"]')) return;

        draggingRef.current = true;

        // ✅ inicia drag manual (si está maximizada, el main la restaura y continúa)
        window.electronAPI.windowControls.dragStart({
          screenX: e.screenX,
          screenY: e.screenY,
        });
      }}
      title="Arrastra para mover • Doble click para maximizar/restaurar"
    >
      <Left>{msg}</Left>

      <Controls data-no-drag="true">
        <WinBtn
          data-no-drag="true"
          onClick={() => window.electronAPI.windowControls.minimize()}
          title="Minimizar"
        >
          —
        </WinBtn>

        <WinBtn
          data-no-drag="true"
          onClick={() => window.electronAPI.windowControls.toggleMaximize()}
          title={isMax ? "Restaurar" : "Maximizar"}
        >
          {isMax ? "❐" : "▢"}
        </WinBtn>

        <WinBtn
          data-no-drag="true"
          $danger
          onClick={() => window.electronAPI.windowControls.close()}
          title="Cerrar"
        >
          ✕
        </WinBtn>
      </Controls>
    </Bar>
  );
}