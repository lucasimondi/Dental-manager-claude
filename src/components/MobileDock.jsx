import React, { useState, useId, useEffect } from 'react';
import { C, NAV } from '../lib/utils';
import { DockIc } from './ui';
// POL-UI-009: simbolo geometrico Poliedra (non il logo studio/verticale, che
// porta anche il wordmark "Poliedra" — illeggibile a queste dimensioni e
// comunque non ammesso qui). Stesso identico asset già usato dalla
// LoginScreen per il brand mark: nessun nuovo logo creato, nessuna modifica
// al logo aziendale.
import poliedroGem from '../assets/icon-poliedra-gem.png';

// Voci nav gated per piano/feature — id NAV -> chiave in `features`.
// Se lo studio non ha la feature, la voce sparisce dal menu invece di
// restare visibile e rimbalzare a Home al tap (redirect già in App.jsx).
const FEATURE_GATE_BY_NAV_ID = { wa: 'whatsapp', spese: 'spese', archivio: 'archivio_documenti', controllo: 'controllo_gestione' };

// Voci visibili solo a chi ha ruolo admin nello studio (a prescindere dal piano/feature).
const ADMIN_ONLY_NAV_IDS = new Set(['agenteai']);

// Baseline verticale condivisa dal poliedro e (in App.jsx/AssistenteAI) dal
// bottone Agente AI, così i due elementi flottanti restano allineati alla
// stessa altezza su ogni pagina mobile.
export const MOBILE_FLOAT_BOTTOM = 'calc(18px + env(safe-area-inset-bottom, 0px))';

/* ── POLIEDRO MOBILE (POL-UI-009) ──
   Non esiste più un dock/barra: un solo pulsante flottante, in basso a
   sinistra, che apre l'intero menu di navigazione mobile (tutte le voci di
   NAV consentite dai gate esistenti). Nessuna voce/routing duplicato:
   stessi `NAV`, `consentita()`, `setPage` già usati dal resto dell'app. */
export default function MobileDock({ page, setPage, dockSettings, features = {}, isStudioAdmin = false }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [pressed, setPressed] = useState(false);
  const iconStyle = dockSettings?.iconStyle || 'vivid';
  const menuId = useId();

  const consentita = (id) => {
    if (ADMIN_ONLY_NAV_IDS.has(id) && !isStudioAdmin) return false;
    const gate = FEATURE_GATE_BY_NAV_ID[id];
    return !gate || features[gate];
  };

  const items = NAV.filter((n) => consentita(n.id));

  const go = (id) => { setPage(id); setMenuOpen(false); };

  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e) => { if (e.key === 'Escape') setMenuOpen(false); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [menuOpen]);

  return (
    <>
      {/* Scrim: tap fuori chiude il menu */}
      {menuOpen && (
        <div
          onClick={() => setMenuOpen(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(10,16,22,0.4)', backdropFilter: 'blur(2px)', zIndex: 150 }}
        />
      )}

      {/* Bottom sheet premium: tutte le voci NAV consentite, non un subset curato */}
      {menuOpen && (
        <div
          id={menuId}
          role="menu"
          aria-label="Menu di navigazione"
          style={{
            position: 'fixed', left: '50%', bottom: 'calc(96px + env(safe-area-inset-bottom, 0px))', transform: 'translateX(-50%)',
            width: 'min(340px, calc(100vw - 32px))', maxHeight: 'min(70vh, 520px)', overflowY: 'auto',
            background: C.sur, borderRadius: 22, border: `1px solid ${C.brd}`,
            boxShadow: '0 24px 60px rgba(15,23,42,0.28), 0 4px 16px rgba(15,23,42,0.14), 0 0 0 1px rgba(0,0,0,0.03)',
            backdropFilter: 'blur(16px) saturate(160%)', WebkitBackdropFilter: 'blur(16px) saturate(160%)',
            padding: 16, zIndex: 151,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '2px 4px 12px' }}>
            <span style={{ fontSize: 10.5, fontWeight: 800, color: C.txl, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Menu</span>
            <button
              onClick={() => setMenuOpen(false)}
              aria-label="Chiudi menu"
              style={{ width: 26, height: 26, borderRadius: 9, border: 'none', background: C.bg, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              <DockIc n="x" style="outline" s={13} c={C.txm} />
            </button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10 }}>
            {items.map((item) => {
              const active = page === item.id;
              return (
                <button key={item.id} onClick={() => go(item.id)} role="menuitem" style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, padding: '11px 4px',
                  borderRadius: 14, background: active ? C.priL : C.bg, border: `1px solid ${active ? `${C.pri}40` : C.brd}`, cursor: 'pointer',
                }}>
                  <div style={{ width: 42, height: 42, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <DockIc n={item.ic} style={iconStyle} s={26} c={active ? C.pri : C.txm} />
                  </div>
                  <span style={{ fontSize: 9.5, fontWeight: active ? 800 : 700, color: active ? C.pri : C.txt, textAlign: 'center' }}>{item.l}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Poliedro flottante — basso sinistra. Nessuna superficie piena
          dietro: la profondità 3D viene dal filtro drop-shadow multiplo sul
          PNG stesso (che ha già faccette/luce/ombra renderizzate) più
          un'ombra di contatto morbida e sfocata sotto — lo stesso trucco con
          cui un'icona app iOS o un oggetto fisico fotografato sembrano
          sospesi sopra la superficie, non un pulsante arcade/neon/plastica. */}
      <button
        onClick={() => setMenuOpen((v) => !v)}
        onPointerDown={() => setPressed(true)}
        onPointerUp={() => setPressed(false)}
        onPointerLeave={() => setPressed(false)}
        aria-label="Menu"
        aria-expanded={menuOpen}
        aria-controls={menuId}
        style={{
          position: 'fixed', left: 'max(18px, env(safe-area-inset-left, 0px))', bottom: MOBILE_FLOAT_BOTTOM,
          width: 66, height: 66, borderRadius: '50%', border: 'none', background: 'transparent', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 110,
          transform: pressed ? 'scale(.92)' : 'scale(1)',
          transition: 'transform .18s cubic-bezier(.34,1.56,.64,1)',
        }}
      >
        <span aria-hidden="true" style={{
          position: 'absolute', bottom: 9, width: 32, height: 10, borderRadius: '50%',
          background: 'radial-gradient(closest-side, rgba(15,23,42,.32), rgba(15,23,42,0))',
          filter: 'blur(3px)', opacity: pressed ? 0.55 : 0.85, transition: 'opacity .18s ease',
        }} />
        <img
          src={poliedroGem}
          alt=""
          aria-hidden="true"
          style={{
            width: 40, height: 40, objectFit: 'contain', position: 'relative',
            filter: menuOpen
              ? `drop-shadow(0 2px 4px rgba(15,23,42,.35)) drop-shadow(0 1px 10px ${C.pri}70)`
              : 'drop-shadow(0 6px 9px rgba(15,23,42,.32)) drop-shadow(0 2px 4px rgba(15,23,42,.22)) drop-shadow(0 0 1px rgba(255,255,255,.4))',
            transition: 'filter .18s ease',
          }}
        />
      </button>
    </>
  );
}
