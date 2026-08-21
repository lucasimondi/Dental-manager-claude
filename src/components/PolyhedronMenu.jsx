import React, { useState } from 'react';
import { C, NAV_BY_ID } from '../lib/utils';
import { DockIc } from './ui';
import poliedroGem from '../assets/icon-poliedra-gem.png';

/* ── POLYHEDRON NAVIGATION MENU ──
   POL-UI-009: FULL MOBILE NAVIGATION
   
   Single floating 3D menu button (bottom-left) that opens the COMPLETE
   navigation showing ALL authorized destinations for the current user.
   
   NO duplicate routing logic — reuses existing NAV, feature gates, RBAC.
*/

export default function PolyhedronMenu({
  page,
  setPage,
  features = {},
  isStudioAdmin = false,
  nav = [],
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuPressed, setMenuPressed] = useState(false);

  // Reuse existing gate logic from App.jsx
  const canAccess = (navId) => {
    const featureGate = {
      wa: 'whatsapp',
      spese: 'spese',
      archivio: 'archivio_documenti',
      controllo: 'controllo_gestione',
    }[navId];
    if (featureGate && !features[featureGate]) return false;
    if (navId === 'agenteai' && !isStudioAdmin) return false;
    return true;
  };

  const handleNavClick = (navId) => {
    setPage(navId);
    setMenuOpen(false);
  };

  const visibleNav = nav.filter((item) => canAccess(item.id));

  return (
    <>
      {/* Scrim + blur backdrop */}
      {menuOpen && (
        <div
          onClick={() => setMenuOpen(false)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(10,16,22,0.4)',
            backdropFilter: 'blur(2px)',
            zIndex: 150,
          }}
        />
      )}

      {/* Premium floating menu panel */}
      {menuOpen && (
        <div
          style={{
            position: 'fixed',
            left: '16px',
            bottom: 'calc(76px + env(safe-area-inset-bottom, 0px))',
            width: 'min(240px, calc(100vw - 32px))',
            maxHeight: 'calc(100dvh - 120px - env(safe-area-inset-bottom, 0px))',
            overflowY: 'auto',
            background: C.sur,
            borderRadius: '20px',
            boxShadow: '0 20px 50px rgba(0,0,0,0.35), 0 0 0 1px rgba(0,0,0,0.04)',
            padding: '14px 0',
            zIndex: 151,
          }}
        >
          {/* Header */}
          <div
            style={{
              fontSize: '10.5px',
              fontWeight: 800,
              color: C.txl,
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              padding: '2px 16px 10px',
            }}
          >
            Menu
          </div>

          {/* Navigation items — ALL accessible destinations */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            {visibleNav.map((item) => (
              <button
                key={item.id}
                onClick={() => handleNavClick(item.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '12px 16px',
                  background: page === item.id ? C.priL : 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  color: page === item.id ? C.pri : C.txt,
                  fontSize: '13px',
                  fontWeight: page === item.id ? 700 : 500,
                  textAlign: 'left',
                  transition: 'background .15s ease',
                }}
                onMouseEnter={(e) => {
                  if (page !== item.id) e.currentTarget.style.background = C.bg;
                }}
                onMouseLeave={(e) => {
                  if (page !== item.id) e.currentTarget.style.background = 'transparent';
                }}
              >
                <div
                  style={{
                    width: 24,
                    height: 24,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <DockIc
                    n={item.ic}
                    style="vivid"
                    s={20}
                    c={page === item.id ? C.pri : C.txt}
                  />
                </div>
                <span>{item.l}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Polyhedron Button — Bottom Left */}
      <button
        onClick={() => setMenuOpen((v) => !v)}
        onPointerDown={() => setMenuPressed(true)}
        onPointerUp={() => setMenuPressed(false)}
        onPointerLeave={() => setMenuPressed(false)}
        aria-label="Menu"
        aria-expanded={menuOpen}
        style={{
          position: 'fixed',
          left: '16px',
          bottom: `calc(16px + env(safe-area-inset-bottom, 0px))`,
          width: '60px',
          height: '60px',
          borderRadius: '50%',
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 100,
          transform: menuPressed ? 'scale(0.92)' : 'scale(1)',
          transition: 'transform 0.18s cubic-bezier(0.34,1.56,0.64,1)',
        }}
      >
        {/* Contact shadow */}
        <span
          aria-hidden="true"
          style={{
            position: 'absolute',
            bottom: '6px',
            width: '26px',
            height: '8px',
            borderRadius: '50%',
            background:
              'radial-gradient(closest-side, rgba(15,23,42,0.30), rgba(15,23,42,0))',
            filter: 'blur(2px)',
            opacity: menuPressed ? 0.55 : 0.85,
            transition: 'opacity 0.18s ease',
          }}
        />

        {/* 3D Polyhedron */}
        <img
          src={poliedroGem}
          alt="Poliedra"
          style={{
            width: '36px',
            height: '36px',
            objectFit: 'contain',
            position: 'relative',
            filter: menuOpen
              ? `drop-shadow(0 2px 4px rgba(15,23,42,0.35)) drop-shadow(0 1px 8px ${C.pri}70)`
              : 'drop-shadow(0 5px 7px rgba(15,23,42,0.32)) drop-shadow(0 2px 3px rgba(15,23,42,0.22)) drop-shadow(0 0 1px rgba(255,255,255,0.4))',
            transition: 'filter 0.18s ease',
          }}
        />
      </button>
    </>
  );
}
