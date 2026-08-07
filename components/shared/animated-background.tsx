"use client";

import { useEffect, useRef } from "react";

interface Node {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  hue: number;
}

export function AnimatedBackground({ density = 1 }: { density?: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return;

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let width = 0;
    let height = 0;
    let nodes: Node[] = [];
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const LINK_DIST = 150;

    function build() {
      width = canvas!.clientWidth;
      height = canvas!.clientHeight;
      canvas!.width = width * dpr;
      canvas!.height = height * dpr;
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);

      const target = Math.round(
        Math.min(90, Math.max(24, (width * height) / 22000)) * density
      );

      nodes = Array.from({ length: target }, () => ({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.32,
        vy: (Math.random() - 0.5) * 0.32,
        r: Math.random() * 1.8 + 0.9,
        hue: [265, 190, 320][Math.floor(Math.random() * 3)],
      }));
    }

    function frame() {
      ctx!.clearRect(0, 0, width, height);

      for (let i = 0; i < nodes.length; i++) {
        const a = nodes[i];

        if (!reduceMotion) {
          a.x += a.vx;
          a.y += a.vy;
          if (a.x < 0 || a.x > width) a.vx *= -1;
          if (a.y < 0 || a.y > height) a.vy *= -1;
        }

        for (let j = i + 1; j < nodes.length; j++) {
          const b = nodes[j];
          const dx = a.x - b.x;
          const dy = a.y - b.y;
          const dist = Math.hypot(dx, dy);
          if (dist >= LINK_DIST) continue;

          const alpha = (1 - dist / LINK_DIST) * 0.28;
          ctx!.strokeStyle = `hsla(${a.hue}, 90%, 65%, ${alpha})`;
          ctx!.lineWidth = 0.7;
          ctx!.beginPath();
          ctx!.moveTo(a.x, a.y);
          ctx!.lineTo(b.x, b.y);
          ctx!.stroke();
        }

        ctx!.fillStyle = `hsla(${a.hue}, 95%, 70%, 0.85)`;
        ctx!.shadowBlur = 10;
        ctx!.shadowColor = `hsla(${a.hue}, 95%, 65%, 0.7)`;
        ctx!.beginPath();
        ctx!.arc(a.x, a.y, a.r, 0, Math.PI * 2);
        ctx!.fill();
        ctx!.shadowBlur = 0;
      }

      rafRef.current = requestAnimationFrame(frame);
    }

    build();
    frame();

    const onResize = () => {
      cancelAnimationFrame(rafRef.current);
      build();
      frame();
    };

    window.addEventListener("resize", onResize, { passive: true });
    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener("resize", onResize);
    };
  }, [density]);

  return (
    <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden" aria-hidden="true">
      <div className="absolute inset-0 bg-background" />
      <div className="absolute inset-0 grid-pattern opacity-[0.28]" />

      <div className="absolute -left-40 -top-40 size-[36rem] rounded-full bg-violet-600/20 blur-[130px] animate-glow" />
      <div
        className="absolute -right-40 top-1/4 size-[32rem] rounded-full bg-cyan-500/18 blur-[130px] animate-glow"
        style={{ animationDelay: "1.4s" }}
      />
      <div
        className="absolute bottom-0 left-1/3 size-[30rem] rounded-full bg-fuchsia-600/16 blur-[130px] animate-glow"
        style={{ animationDelay: "2.6s" }}
      />

      <canvas ref={canvasRef} className="absolute inset-0 size-full opacity-70" />

      <div className="absolute inset-0 bg-gradient-to-b from-background/10 via-transparent to-background" />
    </div>
  );
}
