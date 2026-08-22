import React, { useEffect, useRef, useState } from 'react';
import { C } from '../../lib/utils';
import { usePoliedronEdgePosition } from './usePoliedronEdgePosition';
import poliedroGem from '../../assets/icon-poliedra-gem.png';

/* POL-AI-002A §7-13, §16-17 — desktop Poliedron Edge Dock. Replaces the
   large mobile Orb on desktop viewports (§7: "NO GIANT FLOATING ORB"):
   a small (52-60px collapsed) gem partially embedded in the left/right
   screen edge, discreet when idle, that emerges and labels itself on
   hover/focus. Shares the mobile Orb's geometry/material/gradient/idle-
   animation language (§16 "SAME IDENTITY") — same --gradient-brand base
   disc, same halo glow class, same gem PNG — just smaller and edge-
   anchored instead of freely floating. Opens the exact same Poliedron
   instance as the mobile Orb and Ctrl/Cmd+K (§12-13). */

const COLLAPSED_SIZE = 56; // §7 target: 52-60px
const LABEL_DELAY_MS = 160; // hysteresis so a fast mouse pass-through doesn't flicker (§11)
const PLACEHOLDER_DELAY_MS = 900; // "extended hover" — second stage, shows the command-bar placeholder
const LEAVE_DELAY_MS = 220;

export default function PoliedronEdgeDock({ open, onToggle, panelId }) {
  const [hoverStage, setHoverStage] = useState('collapsed'); // 'collapsed' | 'label' | 'placeholder'
  const labelTimerRef = useRef(null);
  const placeholderTimerRef = useRef(null);
  const leaveTimerRef = useRef(null);

  const { side, top, isDragging, pendingSideSwitch, bind } = usePoliedronEdgePosition({
    dockWidth: COLLAPSED_SIZE,
    dockHeight: COLLAPSED_SIZE,
    onActivate: onToggle,
  });

  const clearTimers = () => {
    clearTimeout(labelTimerRef.current);
    clearTimeout(placeholderTimerRef.current);
    clearTimeout(leaveTimerRef.current);
  };

  const beginExpand = () => {
    clearTimeout(leaveTimerRef.current);
    labelTimerRef.current = setTimeout(() => setHoverStage((s) => (s === 'collapsed' ? 'label' : s)), LABEL_DELAY_MS);
    placeholderTimerRef.current = setTimeout(() => setHoverStage('placeholder'), PLACEHOLDER_DELAY_MS);
  };

  const beginCollapse = () => {
    clearTimeout(labelTimerRef.current);
    clearTimeout(placeholderTimerRef.current);
    leaveTimerRef.current = setTimeout(() => setHoverStage('collapsed'), LEAVE_DELAY_MS);
  };

  useEffect(() => () => clearTimers(), []);

  // §29 — "Hover functionality deve essere disponibile anche tramite
  // focus, keyboard": expand on keyboard focus exactly like mouse hover.
  const onFocus = () => beginExpand();
  const onBlur = () => beginCollapse();

  const expanded = hoverStage !== 'collapsed' && !isDragging;
  const label = hoverStage === 'placeholder' ? 'Chiedi o fai qualsiasi cosa' : 'Poliedron';

  // §7-8 — collapsed state pokes only partly out of the edge; expanded
  // state (hover/focus) is fully on-screen. Achieved with a translate on
  // the edge axis rather than changing width, so the transition is a
  // single smooth emerge/retreat instead of a layout-affecting resize.
  const embedOffset = COLLAPSED_SIZE * 0.34;
  const edgeTranslate = expanded ? 0 : embedOffset;
  const transformX = side === 'right' ? edgeTranslate : -edgeTranslate;

  return (
    <button
      {...bind}
      onMouseEnter={beginExpand}
      onMouseLeave={beginCollapse}
      onFocus={onFocus}
      onBlur={onBlur}
      aria-label="Apri Poliedron"
      aria-expanded={open}
      aria-controls={panelId}
      className="poliedron-edge-dock"
      style={{
        position: 'fixed', top, [side]: 0, zIndex: 1200,
        display: 'flex', alignItems: 'center', flexDirection: side === 'right' ? 'row-reverse' : 'row',
        gap: 10, height: COLLAPSED_SIZE,
        padding: expanded ? '0 16px' : 0,
        border: 'none', cursor: isDragging ? 'grabbing' : 'pointer',
        background: 'transparent', touchAction: 'none',
        borderRadius: side === 'right' ? '16px 0 0 16px' : '0 16px 16px 0',
        transform: `translateX(${transformX}px)`,
        transition: isDragging ? 'none' : 'transform .22s cubic-bezier(.16,1,.3,1), padding .22s ease',
      }}
    >
      {expanded && (
        <span
          className="poliedron-edge-dock__label"
          style={{
            fontSize: 12.5, fontWeight: 700, color: C.txt, whiteSpace: 'nowrap',
            background: C.sur, border: `1px solid ${C.brd}`, borderRadius: 10, padding: '7px 12px',
            boxShadow: '0 8px 20px rgba(15,23,42,.14)',
          }}
        >
          {label}
        </span>
      )}
      <span
        aria-hidden="true"
        style={{
          position: 'relative', width: COLLAPSED_SIZE, height: COLLAPSED_SIZE, flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          borderRadius: '50%',
        }}
      >
        <span aria-hidden="true" className="poliedron-orb__halo" style={{
          position: 'absolute', inset: -COLLAPSED_SIZE * 0.12, borderRadius: '50%',
          background: `radial-gradient(closest-side, ${pendingSideSwitch ? C.pri + '55' : C.pri + '26'}, transparent 70%)`,
          opacity: open || pendingSideSwitch ? 1 : 0.55,
          transition: 'background .15s ease',
        }} />
        <span aria-hidden="true" className="poliedron-orb__base" style={{
          position: 'absolute', inset: 0, borderRadius: '50%',
          background: 'var(--gradient-brand)',
          boxShadow: `inset 0 -3px ${COLLAPSED_SIZE * 0.16}px rgba(11,25,55,.38), inset 0 3px ${COLLAPSED_SIZE * 0.14}px rgba(255,255,255,.28), 0 6px ${COLLAPSED_SIZE * 0.22}px rgba(15,23,42,.28)`,
        }} />
        <span aria-hidden="true" style={{
          position: 'absolute', top: COLLAPSED_SIZE * 0.14, left: COLLAPSED_SIZE * 0.18, width: COLLAPSED_SIZE * 0.36, height: COLLAPSED_SIZE * 0.22, borderRadius: '50%',
          background: 'radial-gradient(closest-side, rgba(255,255,255,.5), rgba(255,255,255,0))',
          filter: 'blur(1px)',
        }} />
        <img
          src={poliedroGem}
          alt=""
          aria-hidden="true"
          draggable={false}
          style={{
            width: COLLAPSED_SIZE * 0.6, height: COLLAPSED_SIZE * 0.6, objectFit: 'contain', position: 'relative', pointerEvents: 'none',
            filter: open
              ? `drop-shadow(0 2px 4px rgba(15,23,42,.4)) drop-shadow(0 1px 12px ${C.pri}90)`
              : 'drop-shadow(0 3px 6px rgba(15,23,42,.32)) drop-shadow(0 0 1px rgba(255,255,255,.5))',
          }}
          className="poliedron-orb__gem"
        />
      </span>
    </button>
  );
}
