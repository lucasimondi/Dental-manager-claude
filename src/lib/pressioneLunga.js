/* PO 2026-11-10 — tocco prolungato (600 ms) con pointer events: mouse, tablet e telefono.
   Se il dito si sposta più di 10 px la pressione si annulla (è uno scorrimento). Dopo una
   pressione lunga il click che segue viene assorbito, così il tocco breve continua a fare
   solo quello che faceva prima. Il tasto destro (contextmenu) apre lo stesso menu. */
import { useMemo, useRef, useState } from 'react';

export function creaPressioneLunga({ ms = 600, soglia = 10, onLungo, onInizio, onFine, timers = globalThis } = {}) {
  let timer = null, start = null, chiave = null, appenaLungo = false;
  const ferma = () => { if (timer != null) timers.clearTimeout(timer); timer = null; if (chiave != null) onFine?.(chiave); start = null; chiave = null; };
  return {
    giu(k, e) {
      if (e && e.button != null && e.button !== 0) return; // solo tasto principale / dito
      ferma();
      appenaLungo = false;
      chiave = k;
      start = { x: e?.clientX ?? 0, y: e?.clientY ?? 0, rect: e?.currentTarget?.getBoundingClientRect?.() || null };
      onInizio?.(k);
      timer = timers.setTimeout(() => {
        const s = start, kk = chiave;
        timer = null; appenaLungo = true;
        ferma();
        onLungo?.(kk, s);
      }, ms);
    },
    muovi(e) {
      if (!start) return;
      if (Math.hypot((e?.clientX ?? 0) - start.x, (e?.clientY ?? 0) - start.y) > soglia) ferma();
    },
    su: () => ferma(),
    esci: () => ferma(),
    // Tasto destro: apre subito il menu e blocca quello del browser.
    menu(k, e) {
      e?.preventDefault?.();
      if (appenaLungo) return; // su telefono il contextmenu arriva dopo la pressione lunga
      ferma();
      appenaLungo = true;
      onLungo?.(k, { x: e?.clientX ?? 0, y: e?.clientY ?? 0, rect: e?.currentTarget?.getBoundingClientRect?.() || null });
    },
    // true = questo click segue una pressione lunga e va ignorato.
    consumaClick() { const v = appenaLungo; appenaLungo = false; return v; },
  };
}

export function usePressioneLunga({ ms = 600, soglia = 10, onLungo } = {}) {
  const [premuto, setPremuto] = useState(null);
  const lungoRef = useRef(onLungo);
  lungoRef.current = onLungo;
  const ctl = useMemo(() => creaPressioneLunga({
    ms, soglia,
    onInizio: k => setPremuto(k),
    onFine: () => setPremuto(null),
    onLungo: (k, punto) => {
      try { globalThis.navigator?.vibrate?.(15); } catch { /* facoltativo */ }
      lungoRef.current?.(k, punto);
    },
  }), [ms, soglia]);
  const bind = k => ({
    onPointerDown: e => ctl.giu(k, e),
    onPointerMove: e => ctl.muovi(e),
    onPointerUp: ctl.su,
    onPointerLeave: ctl.esci,
    onPointerCancel: ctl.esci,
    onContextMenu: e => ctl.menu(k, e),
  });
  return { bind, premuto, consumaClick: ctl.consumaClick };
}
