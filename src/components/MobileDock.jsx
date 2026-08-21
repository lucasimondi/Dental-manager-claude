import React, { useState } from 'react';
import { C, NAV_BY_ID, DOCK_MENU_SLOT, DEF_DOCK_SETTINGS } from '../lib/utils';
import { DockIc } from './ui';

// Voci nav gated per piano/feature — id NAV -> chiave in `features`.
// Se lo studio non ha la feature, la voce sparisce dal dock invece di
// restare visibile e rimbalzare a Home al tap (redirect già in App.jsx).
const FEATURE_GATE_BY_NAV_ID = { wa: 'whatsapp', spese: 'spese', archivio: 'archivio_documenti', controllo: 'controllo_gestione' };

// Voci visibili solo a chi ha ruolo admin nello studio (a prescindere dal piano/feature).
const ADMIN_ONLY_NAV_IDS = new Set(['agenteai']);

/* ── DOCK MOBILE ──
   5 posizioni fisse. Lo slot centrale, se impostato su DOCK_MENU_SLOT (default),
   è un pulsante rialzato che apre un popup con le altre funzioni non presenti nel dock.
   Tutto è guidato da dockSettings (slots/menuItems/iconStyle), configurabile da Setup. */
export default function MobileDock({ page, setPage, dockSettings, onLogout, features = {}, isStudioAdmin = false }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuPressed, setMenuPressed] = useState(false);
  const style = dockSettings?.iconStyle || 'vivid';
  const slots = dockSettings?.slots?.length === 5 ? dockSettings.slots : DEF_DOCK_SETTINGS.slots;
  const menuItems = dockSettings?.menuItems?.length ? dockSettings.menuItems : DEF_DOCK_SETTINGS.menuItems;
  const consentita = (id) => {
    if (ADMIN_ONLY_NAV_IDS.has(id) && !isStudioAdmin) return false;
    const gate = FEATURE_GATE_BY_NAV_ID[id];
    return !gate || features[gate];
  };

  const go = (id) => { setPage(id); setMenuOpen(false); };

  return (
    <>
      {/* Scrim + popup — stile "misto": card centrata con vetro/ombra (iOS) sopra scrim sfocato (Windows) */}
      {menuOpen && (
        <div
          onClick={() => setMenuOpen(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(10,16,22,0.4)', backdropFilter: 'blur(2px)', zIndex: 150 }}
        />
      )}
      {menuOpen && (
        <div style={{
          position: 'fixed', left: '50%', bottom: 'calc(92px + env(safe-area-inset-bottom, 0px))', transform: 'translateX(-50%)',
          width: 'min(320px, calc(100vw - 32px))', background: C.sur, borderRadius: 20,
          boxShadow: '0 20px 50px rgba(0,0,0,0.35), 0 0 0 1px rgba(0,0,0,0.04)', padding: 14, zIndex: 151,
        }}>
          <div style={{ fontSize: 10.5, fontWeight: 800, color: C.txl, textTransform: 'uppercase', letterSpacing: '0.06em', padding: '2px 4px 10px' }}>Altre funzioni</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10 }}>
            {menuItems.map((id) => {
              const item = NAV_BY_ID[id];
              if (!item || !consentita(id)) return null;
              return (
                <button key={id} onClick={() => go(id)} style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, padding: '10px 4px',
                  borderRadius: 14, background: page === id ? C.priL : C.bg, border: `1px solid ${C.brd}`, cursor: 'pointer',
                }}>
                  <div style={{ width: 42, height: 42, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <DockIc n={item.ic} style={style} s={26} c={C.pri} />
                  </div>
                  <span style={{ fontSize: 9.5, fontWeight: 700, color: C.txt, textAlign: 'center' }}>{item.l}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* DOCK — POL-UI-005/POL-UI-004 Agenda final: 5 posizioni fisse, senza
          barra piena dietro. Le icone sono "sospese" sul contenuto (che resta
          visibile e scrollabile dietro/attorno a loro): niente background/
          border/shadow sul contenitore. Il colore icona (C.txm, non C.txl) e
          il drop-shadow leggero su ciascuna icona sono quello che garantisce
          leggibilità senza una superficie piena dietro, qualunque sia il
          contenuto scorso sotto. Icone ingrandite (24→28px) e pillola dello
          stato attivo resa molto più trasparente, per leggere davvero come
          "floating glass navigation" e non come una piccola barra bianca. */}
      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0, height: 78,
        background: 'transparent',
        display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', alignItems: 'center',
        paddingBottom: 'max(10px, env(safe-area-inset-bottom,0px))', zIndex: 100,
        pointerEvents: 'none',
      }}>
        {slots.map((id, i) => {
          if (id === DOCK_MENU_SLOT) {
            return (
              <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', pointerEvents: 'none' }}>
                <button
                  onClick={() => setMenuOpen((v) => !v)}
                  onPointerDown={() => setMenuPressed(true)}
                  onPointerUp={() => setMenuPressed(false)}
                  onPointerLeave={() => setMenuPressed(false)}
                  aria-label="Menu"
                  aria-expanded={menuOpen}
                  style={{
                    width: 56, height: 56, borderRadius: '50%', position: 'relative', top: -20,
                    background: `linear-gradient(150deg, ${C.pri}, ${C.priD})`, border: '1.5px solid rgba(255,255,255,.5)', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    backdropFilter: 'blur(14px)',
                    pointerEvents: 'auto',
                    boxShadow: menuPressed
                      ? `0 4px 12px ${C.pri}55`
                      : `0 10px 24px ${C.pri}55, 0 3px 8px rgba(15,23,42,.22), inset 0 1px 0 rgba(255,255,255,.35)`,
                    transform: menuPressed ? 'scale(.92)' : 'scale(1)',
                    transition: 'transform .18s cubic-bezier(.34,1.56,.64,1), box-shadow .18s ease',
                  }}
                >
                  {menuOpen ? (
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.6" strokeLinecap="round"><line x1="6" y1="6" x2="18" y2="18" /><line x1="18" y1="6" x2="6" y2="18" /></svg>
                  ) : (
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.6" strokeLinecap="round"><line x1="4" y1="7" x2="20" y2="7" /><line x1="4" y1="12" x2="20" y2="12" /><line x1="4" y1="17" x2="20" y2="17" /></svg>
                  )}
                </button>
                <span style={{ fontSize: 9, fontWeight: 700, color: menuOpen ? C.pri : C.txm, marginTop: -16, filter: `drop-shadow(0 1px 2px ${C.bg}cc)` }}>Menu</span>
              </div>
            );
          }
          const item = id === 'esci' ? { l: 'Esci', ic: 'x' } : NAV_BY_ID[id];
          if (!item || (id !== 'esci' && !consentita(id))) return null;
          const active = page === id;
          return (
            <button
              key={i}
              onClick={() => (id === 'esci' ? onLogout && onLogout() : go(id))}
              style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, padding: '6px 2px', pointerEvents: 'auto' }}
            >
              <div style={{
                width: 46, height: 46, borderRadius: 13, display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: active ? `${C.sur}66` : 'transparent',
                border: active ? `1px solid ${C.pri}35` : '1px solid transparent',
                backdropFilter: active ? 'blur(8px)' : 'none',
                boxShadow: active ? `0 2px 8px rgba(15,23,42,.08)` : 'none',
              }}>
                <DockIc n={item.ic} style={style} s={28} c={active ? C.pri : C.txm} />
              </div>
              <span style={{ fontSize: 9.5, fontWeight: active ? 800 : 700, color: active ? C.pri : C.txm, maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', filter: active ? 'none' : `drop-shadow(0 1px 2px ${C.bg}cc)` }}>{item.l}</span>
            </button>
          );
        })}
      </div>
    </>
  );
}
