import React, { useEffect, useState } from 'react';
import { C } from '../../lib/utils';
import { usePoliedronPosition } from './usePoliedronPosition';
import { computeMobileOrbSize } from '../../lib/poliedron/poliedronOrbSize.js';
// Same geometric brand mark already approved for the LoginScreen and the
// previous MobileDock polyhedron button (POL-UI-007/009/010) — no new
// logo, no wordmark, no hamburger (§2).
import poliedroGem from '../../assets/icon-poliedra-gem.png';

/* POL-AI-002A §1-6 — the mobile Poliedron Orb. Desktop no longer uses
   this component at all (see PoliedronEdgeDock.jsx) — this file is now
   mobile-only, so it owns its own responsive size instead of taking an
   isMobile prop to branch on. Position/drag logic lives in
   usePoliedronPosition (§34 from POL-AI-001, unchanged principle); this
   component only renders. */
export default function PoliedronOrb({ open, onToggle, panelId }) {
  const [size, setSize] = useState(() => computeMobileOrbSize(typeof window !== 'undefined' ? window.innerWidth : 375));
  useEffect(() => {
    const onResize = () => setSize(computeMobileOrbSize(window.innerWidth));
    window.addEventListener('resize', onResize);
    window.addEventListener('orientationchange', onResize);
    return () => {
      window.removeEventListener('resize', onResize);
      window.removeEventListener('orientationchange', onResize);
    };
  }, []);

  const symbolSize = Math.round(size * 0.62);
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
      {/* Contact shadow — reads as "floating above the surface" (§1: true
          3D depth, not flat). */}
      <span aria-hidden="true" style={{
        position: 'absolute', bottom: size * 0.08, width: size * 0.55, height: size * 0.16, borderRadius: '50%',
        background: 'radial-gradient(closest-side, rgba(15,23,42,.36), rgba(15,23,42,0))',
        filter: 'blur(4px)', opacity: pressed ? 0.55 : 0.85, transition: 'opacity .18s ease',
      }} />
      {/* Idle glow ring — subtle, brand-colored, static by default; the
          only motion is the slow halo-pulse class below, gated by
          prefers-reduced-motion (§31 carried over from POL-AI-001). */}
      <span aria-hidden="true" className="poliedron-orb__halo" style={{
        position: 'absolute', inset: -size * 0.09, borderRadius: '50%',
        background: `radial-gradient(closest-side, ${C.pri}2e, transparent 70%)`,
        opacity: open ? 1 : 0.6,
      }} />
      {/* Gradient base disc — layered material behind the gem mark: a
          brand-gradient sphere with an offset highlight and a darker rim,
          giving genuine layered depth instead of a flat icon-on-nothing
          (§1: gradient layering, highlight, no gaming neon — reuses the
          existing --gradient-brand token, not a new palette). */}
      <span aria-hidden="true" className="poliedron-orb__base" style={{
        position: 'absolute', inset: 0, borderRadius: '50%',
        background: 'var(--gradient-brand)',
        boxShadow: `inset 0 -${Math.max(2, size * 0.06)}px ${size * 0.14}px rgba(11,25,55,.38), inset 0 ${size * 0.05}px ${size * 0.12}px rgba(255,255,255,.30), 0 ${size * 0.09}px ${size * 0.22}px rgba(15,23,42,.30)`,
      }} />
      <span aria-hidden="true" style={{
        position: 'absolute', top: size * 0.12, left: size * 0.16, width: size * 0.38, height: size * 0.24, borderRadius: '50%',
        background: 'radial-gradient(closest-side, rgba(255,255,255,.55), rgba(255,255,255,0))',
        filter: 'blur(1px)', pointerEvents: 'none',
      }} />
      <img
        src={poliedroGem}
        alt=""
        aria-hidden="true"
        draggable={false}
        style={{
          width: symbolSize, height: symbolSize, objectFit: 'contain', position: 'relative', pointerEvents: 'none',
          filter: open
            ? `drop-shadow(0 2px 4px rgba(15,23,42,.4)) drop-shadow(0 1px 14px ${C.pri}90)`
            : 'drop-shadow(0 4px 8px rgba(15,23,42,.35)) drop-shadow(0 1px 3px rgba(15,23,42,.25)) drop-shadow(0 0 1px rgba(255,255,255,.5))',
          transition: 'filter .18s ease',
        }}
        className="poliedron-orb__gem"
      />
    </button>
  );
}
