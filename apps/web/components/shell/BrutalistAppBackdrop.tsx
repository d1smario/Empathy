"use client";

import React, { useEffect, useRef, useState } from "react";

type BrutalistAppBackdropProps = {
  children: React.ReactNode;
  /** Pioggia matrix stile `/preview` (default: on). */
  matrix?: boolean;
};

/**
 * Stesso chroma della marketing demo: nero, orb blur purple/pink/orange, griglia, matrix opzionale.
 * Usare come wrapper per shell + home così l’app coincide visivamente con `/preview`.
 */
export function BrutalistAppBackdrop({ children, matrix = true }: BrutalistAppBackdropProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const canvas = canvasRef.current;
    if (!canvas || !matrix || reduceMotion) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const chars =
      "01アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホ";
    let drops: number[] = [];
    let columns = 0;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      columns = Math.floor(canvas.width / 20);
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

    const interval = setInterval(draw, 50);
    return () => {
      clearInterval(interval);
      window.removeEventListener("resize", resize);
    };
  }, [matrix]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      setMousePos({ x: e.clientX, y: e.clientY });
    };
    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, []);

  // overflow-x-CLIP (non hidden): hidden renderebbe questo div un secondo
  // contenitore di scroll verticale → doppia scrollbar a destra.
  return (
    <div className="relative min-h-screen w-full max-w-[100vw] overflow-x-clip bg-black text-white">
      {matrix ? (
        <canvas
          ref={canvasRef}
          className="absolute inset-0 opacity-10 pointer-events-none"
          aria-hidden
        />
      ) : null}

      <div className="absolute top-10 left-10 h-48 w-48 rounded-full bg-purple-600/20 blur-3xl animate-pulse sm:top-20 sm:left-20 sm:h-96 sm:w-96" />
      <div
        className="absolute bottom-10 right-10 h-48 w-48 rounded-full bg-pink-600/20 blur-3xl animate-pulse sm:bottom-20 sm:right-20 sm:h-96 sm:w-96"
        style={{ animationDelay: "1s" }}
      />
      <div
        className="absolute top-1/2 left-1/2 h-[300px] w-[300px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-orange-600/10 blur-3xl animate-pulse sm:h-[600px] sm:w-[600px]"
        style={{ animationDelay: "2s" }}
      />

      <div
        className="absolute w-96 h-96 rounded-full pointer-events-none transition-all duration-300 ease-out"
        style={{
          left: mousePos.x - 192,
          top: mousePos.y - 192,
          background: "radial-gradient(circle, rgba(168, 85, 247, 0.15) 0%, transparent 70%)",
          filter: "blur(40px)",
        }}
      />

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
