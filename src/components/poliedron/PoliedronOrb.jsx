import React, { useEffect, useState } from 'react';
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
export default function PoliedronOrb({ open, onToggle, panelId, interactive = true }) {
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

  const [pressed, setPressed] = useState(false);
  const { style, isDragging, isNearDock, bind } = usePoliedronPosition({
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
      tabIndex={interactive ? 0 : -1}
      disabled={!interactive}
      style={{
        position: 'fixed', ...style,
        width: size, height: size, padding: 0, border: 'none', background: 'transparent', boxShadow: 'none',
        appearance: 'none',
        cursor: isDragging ? 'grabbing' : 'pointer', zIndex: 1200, touchAction: 'none',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        transform: pressed && !isDragging ? 'scale(.92)' : 'scale(1)',
        transition: isDragging ? 'none' : 'transform .18s cubic-bezier(.34,1.56,.64,1)',
      }}
      className={`poliedron-orb${isNearDock ? ' is-redocking' : ''}`}
    >
      {/* A restrained contact shadow gives the standalone gem depth without
          introducing a visible button surface behind it. */}
      <span aria-hidden="true" style={{
        position: 'absolute', bottom: size * 0.01, width: size * 0.58, height: size * 0.12, borderRadius: '50%',
        background: 'radial-gradient(closest-side, rgba(15,23,42,.30), rgba(15,23,42,0))',
        filter: 'blur(3px)', opacity: pressed ? 0.45 : 0.68, transition: 'opacity .18s ease',
      }} />
      <img
        src={poliedroGem}
        alt=""
        aria-hidden="true"
        draggable={false}
        style={{
          width: '100%', height: '100%', objectFit: 'contain', position: 'relative', pointerEvents: 'none',
          filter: open
            ? 'drop-shadow(0 5px 8px rgba(15,23,42,.34)) drop-shadow(0 0 8px rgba(25,154,174,.42))'
            : 'drop-shadow(0 5px 7px rgba(15,23,42,.30)) drop-shadow(0 1px 2px rgba(15,23,42,.22))',
          transition: 'filter .18s ease',
        }}
        className="poliedron-orb__gem"
      />
    </button>
  );
}
