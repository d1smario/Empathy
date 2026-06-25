"use client";

import React, { useEffect, useRef, useState } from "react";

type BrutalistAppBackdropProps = {
  children: React.ReactNode;
  /** Pioggia matrix stile `/preview` (default: on). */
  matrix?: boolean;
};

/**
 * Stesso chroma della marketing demo: nero, orb blur purple/pink/orange, griglia, matrix opzionale.
 *
 * Budget mobile/movimento (fix calore): gli effetti CONTINUI (canvas matrix, alone
 * che insegue il mouse, pulse degli orb) girano SOLO su puntatore fine (desktop) e
 * SOLO senza `prefers-reduced-motion`. Su telefono (puntatore coarse) il backdrop è
 * statico: niente canvas a 20fps, niente listener mousemove, niente compositing GPU
 * continuo. La matrix usa requestAnimationFrame (~15fps, in pausa a tab nascosta)
 * invece di setInterval. Su touch resta solo il chroma statico (orb senza pulse).
 */
export function BrutalistAppBackdrop({ children, matrix = true }: BrutalistAppBackdropProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  // Effetti animati ammessi solo su desktop (pointer fine) senza riduci-movimento.
  // Default false: il primo render (SSR + idratazione) è statico/leggero ovunque;
  // su desktop si accendono dopo il mount. Niente mismatch di idratazione.
  const [richFx, setRichFx] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;
    const finePointer = window.matchMedia("(pointer: fine)");
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setRichFx(finePointer.matches && !reduceMotion.matches);
    update();
    finePointer.addEventListener?.("change", update);
    reduceMotion.addEventListener?.("change", update);
    return () => {
      finePointer.removeEventListener?.("change", update);
      reduceMotion.removeEventListener?.("change", update);
    };
  }, []);

  // Matrix: solo desktop+motion, in requestAnimationFrame ~15fps, in pausa quando la
  // tab non è visibile. (Prima: setInterval(draw,50)=20fps a tutto schermo, sempre.)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !matrix || !richFx) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const chars = "01アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホ";
    let drops: number[] = [];

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      const columns = Math.floor(canvas.width / 20);
      drops = Array(columns).fill(1);
    };
    resize();
    window.addEventListener("resize", resize);

    function draw() {
      if (!ctx || !canvas) return;
      ctx.fillStyle = "rgba(0, 0, 0, 0.05)";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
      gradient.addColorStop(0, "#a855f7");
      gradient.addColorStop(0.5, "#ec4899");
      gradient.addColorStop(1, "#f97316");
      ctx.fillStyle = gradient;
      ctx.font = "15px monospace";
      for (let i = 0; i < drops.length; i++) {
        const text = chars[Math.floor(Math.random() * chars.length)];
        ctx.fillText(text, i * 20, drops[i] * 20);
        if (drops[i] * 20 > canvas.height && Math.random() > 0.975) {
          drops[i] = 0;
        }
        drops[i]++;
      }
    }

    let rafId = 0;
    let lastT = 0;
    const FRAME_MS = 66; // ~15fps
    const loop = (t: number) => {
      rafId = requestAnimationFrame(loop);
      if (document.hidden) return;
      if (t - lastT < FRAME_MS) return;
      lastT = t;
      draw();
    };
    rafId = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener("resize", resize);
    };
  }, [matrix, richFx]);

  // Alone che insegue il mouse: solo desktop, e throttled a 1 setState per frame
  // (prima: setState ad OGNI evento mousemove → tempesta di re-render).
  useEffect(() => {
    if (!richFx) return;
    let rafId = 0;
    let pending: { x: number; y: number } | null = null;
    const onMove = (e: MouseEvent) => {
      pending = { x: e.clientX, y: e.clientY };
      if (!rafId) {
        rafId = requestAnimationFrame(() => {
          rafId = 0;
          if (pending) setMousePos(pending);
        });
      }
    };
    window.addEventListener("mousemove", onMove);
    return () => {
      window.removeEventListener("mousemove", onMove);
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, [richFx]);

  const orbPulse = richFx ? " animate-pulse" : "";

  // overflow-x-CLIP (non hidden): hidden renderebbe questo div un secondo
  // contenitore di scroll verticale → doppia scrollbar a destra.
  return (
    <div className="relative min-h-screen w-full max-w-[100vw] overflow-x-clip bg-black text-white">
      {matrix && richFx ? (
        <canvas ref={canvasRef} className="absolute inset-0 opacity-10 pointer-events-none" aria-hidden />
      ) : null}

      <div
        className={`absolute top-10 left-10 h-48 w-48 rounded-full bg-purple-600/20 blur-3xl sm:top-20 sm:left-20 sm:h-96 sm:w-96${orbPulse}`}
      />
      <div
        className={`absolute bottom-10 right-10 h-48 w-48 rounded-full bg-pink-600/20 blur-3xl sm:bottom-20 sm:right-20 sm:h-96 sm:w-96${orbPulse}`}
        style={{ animationDelay: "1s" }}
      />
      <div
        className={`absolute top-1/2 left-1/2 h-[300px] w-[300px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-orange-600/10 blur-3xl sm:h-[600px] sm:w-[600px]${orbPulse}`}
        style={{ animationDelay: "2s" }}
      />

      {richFx ? (
        <div
          className="absolute h-96 w-96 rounded-full pointer-events-none transition-all duration-300 ease-out"
          style={{
            left: mousePos.x - 192,
            top: mousePos.y - 192,
            background: "radial-gradient(circle, rgba(168, 85, 247, 0.15) 0%, transparent 70%)",
            filter: "blur(40px)",
          }}
        />
      ) : null}

      <div className="absolute inset-0 opacity-5 pointer-events-none">
        <div
          className="w-full h-full"
          style={{
            backgroundImage: `
            linear-gradient(rgba(168, 85, 247, 0.3) 1px, transparent 1px),
            linear-gradient(90deg, rgba(168, 85, 247, 0.3) 1px, transparent 1px)
          `,
            backgroundSize: "50px 50px",
          }}
        />
      </div>

      <div className="relative z-10 min-h-screen w-full">{children}</div>
    </div>
  );
}
