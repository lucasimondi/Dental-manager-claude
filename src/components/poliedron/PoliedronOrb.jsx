import React, { useState } from 'react';
import { C } from '../../lib/utils';
import { usePoliedronPosition } from './usePoliedronPosition';
// Same geometric brand mark already approved for the LoginScreen and the
// previous MobileDock polyhedron button (POL-UI-007/009/010) — no new
// logo, no wordmark, no hamburger (§2).
import poliedroGem from '../../assets/icon-poliedra-gem.png';

/* POL-AI-001 §2-3, §30-32, §34 — the single global AI orb. Position logic
   lives in usePoliedronPosition (§34); this component only renders. */
export default function PoliedronOrb({ isMobile, open, onToggle, panelId }) {
  const size = isMobile ? 68 : 60;
  const symbolSize = isMobile ? 42 : 36;
  const [pressed, setPressed] = useState(false);
  const { style, isDragging, bind } = usePoliedronPosition({
    size,
    onActivate: onToggle,
  });

  return (
    <button
      {...bind}
      onPointerUp={() => setPressed(false)}
      onPointerLeave={() => setPressed(false)}
      onPointerDownCapture={() => setPressed(true)}
      aria-label="Apri Poliedron"
      aria-expanded={open}
      aria-controls={panelId}
      style={{
        position: 'fixed', ...style,
        width: size, height: size, borderRadius: '50%', border: 'none', background: 'transparent',
        cursor: isDragging ? 'grabbing' : 'pointer', zIndex: 1200, touchAction: 'none',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        transform: pressed && !isDragging ? 'scale(.92)' : 'scale(1)',
        transition: isDragging ? 'none' : 'transform .18s cubic-bezier(.34,1.56,.64,1)',
      }}
      className="poliedron-orb"
    >
      {/* Contact shadow — same "raised object" trick as the gem's own
          multi-layer drop-shadow below: makes the orb read as floating
          above the surface, not stuck flat on it (§30: 3D, layered, subtle
          glow, no gaming neon). */}
      <span aria-hidden="true" style={{
        position: 'absolute', bottom: size * 0.1, width: size * 0.5, height: size * 0.15, borderRadius: '50%',
        background: `radial-gradient(closest-side, rgba(15,23,42,.34), rgba(15,23,42,0))`,
        filter: 'blur(3px)', opacity: pressed ? 0.55 : 0.85, transition: 'opacity .18s ease',
      }} />
      {/* Idle glow ring — very subtle, static gradient (no motion by
          default; §31 requires respecting prefers-reduced-motion, so the
          only animated element is the CSS class below, which is itself
          gated by that media query in styles.css). */}
      <span aria-hidden="true" className="poliedron-orb__halo" style={{
        position: 'absolute', inset: -6, borderRadius: '50%',
        background: `radial-gradient(closest-side, ${C.pri}26, transparent 70%)`,
        opacity: open ? 1 : 0.6,
      }} />
      <img
        src={poliedroGem}
        alt=""
        aria-hidden="true"
        draggable={false}
        style={{
          width: symbolSize, height: symbolSize, objectFit: 'contain', position: 'relative', pointerEvents: 'none',
          filter: open
            ? `drop-shadow(0 2px 4px rgba(15,23,42,.35)) drop-shadow(0 1px 12px ${C.pri}80)`
            : 'drop-shadow(0 7px 10px rgba(15,23,42,.34)) drop-shadow(0 2px 4px rgba(15,23,42,.22)) drop-shadow(0 0 1px rgba(255,255,255,.4))',
          transition: 'filter .18s ease',
        }}
        className="poliedron-orb__gem"
      />
    </button>
  );
}
