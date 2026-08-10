/**
 * Renders on the server with no JS and no canvas. The previous version ran an
 * O(n²) link-drawing loop with per-node shadowBlur at 60fps, which pinned the
 * main thread on mid-range phones. Everything here is composited by the GPU.
 */
export function AnimatedBackground() {
  return (
    <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden" aria-hidden="true">
      <div className="absolute inset-0 bg-background" />
      <div className="absolute inset-0 grid-pattern opacity-[0.22]" />
      <div className="absolute inset-0 aurora opacity-70" />
      <div className="absolute inset-0 bg-gradient-to-b from-background/20 via-transparent to-background" />
    </div>
  );
}
