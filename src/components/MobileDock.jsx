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
                  <div style={{ width: 38, height: 38, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <DockIc n={item.ic} style={style} s={22} c={C.pri} />
                  </div>
                  <span style={{ fontSize: 9.5, fontWeight: 700, color: C.txt, textAlign: 'center' }}>{item.l}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* DOCK — 5 posizioni fisse, più alto e con icone più grandi */}
      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0, height: 84,
        background: C.sur, borderTop: `1px solid ${C.brd}`,
        display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', alignItems: 'center',
        paddingBottom: 'max(10px, env(safe-area-inset-bottom,0px))', zIndex: 100,
        boxShadow: '0 -2px 10px rgba(0,0,0,0.07)',
      }}>
        {slots.map((id, i) => {
          if (id === DOCK_MENU_SLOT) {
            return (
              <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <button
                  onClick={() => setMenuOpen((v) => !v)}
                  aria-label="Menu"
                  style={{
                    width: 58, height: 58, borderRadius: '50%', position: 'relative', top: -22,
                    background: `linear-gradient(150deg, ${C.pri}, ${C.priD})`, border: 'none', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    boxShadow: `0 10px 22px ${C.pri}55, 0 0 0 6px ${C.bg}`,
                    transition: 'transform .25s cubic-bezier(.34,1.56,.64,1)',
                  }}
                >
                  {menuOpen ? (
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round"><line x1="6" y1="6" x2="18" y2="18" /><line x1="18" y1="6" x2="6" y2="18" /></svg>
                  ) : (
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round"><line x1="4" y1="7" x2="20" y2="7" /><line x1="4" y1="12" x2="20" y2="12" /><line x1="4" y1="17" x2="20" y2="17" /></svg>
                  )}
                </button>
                <span style={{ fontSize: 9, fontWeight: 700, color: menuOpen ? C.pri : C.txl, marginTop: -18 }}>Menu</span>
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
              style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, padding: '6px 2px' }}
            >
              <div style={{ width: 40, height: 40, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', background: active ? C.priL : 'transparent', boxShadow: active ? `inset 0 0 0 1.5px ${C.pri}55` : 'none' }}>
                <DockIc n={item.ic} style={style} s={24} c={active ? C.pri : C.txl} />
              </div>
              <span style={{ fontSize: 9.5, fontWeight: active ? 800 : 600, color: active ? C.pri : C.txl, maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.l}</span>
            </button>
          );
        })}
      </div>
    </>
  );
}
