import React, { useEffect, useRef, useState } from 'react';
import { C } from '../../lib/utils';
import { Ic } from '../ui';
import PoliedronSearchResults, { countFlatItems, flatItemAt } from './PoliedronSearchResults';
import PoliedronActionPreview from './PoliedronActionPreview';
import PoliedronActionPreviewLevel2 from './PoliedronActionPreviewLevel2';
import PoliedronConversation from './PoliedronConversation';
import PoliedronSuggestionBoard from './PoliedronSuggestionBoard';
import PoliedronIntelligenceResults from './PoliedronIntelligenceResults';
import { computeMobilePanelViewportRect } from '../../lib/poliedron/poliedronPanelViewport.js';

/* POL-AI-001 §4-5, §25, §30-32 — the command panel itself. Pure
   presentation + local UI state (query text, keyboard highlight) — all
   the actual intent/search/action logic lives in poliedraCore and is
   passed in as `state` (already-computed structured output) by the
   Poliedron container. §5: command bar + results + actions is the
   PRIMARY surface; PoliedronConversation (extended answer) only renders
   when `state.answer` is present.

   POL-CHAT-001 §FASE 4/7/11 — what this panel deliberately does NOT contain:
   the Chat history. No message list, no previous conversations, no persistent
   thread, no history preview, and no banner about persistent history being
   available or unavailable (the removed "La cronologia persistente non è
   disponibile." block). It shows only the CURRENT request and its answer.
   The persistent history lives on exactly one surface, the Chat page.

   It is also independent of the Chat backend: it receives no conversation, no
   conversation error and no retry handler, so a missing/failed
   `poliedron_conversations` / `poliedron_messages` cannot disable or degrade
   it — persistence of a panel request is best-effort and handled upstream in
   Poliedron.jsx. Still ONE Poliedron: same instance, same agent. */
// POL-UI-041: on mobile the keyboard opens as soon as the panel mounts
// (the query input auto-focuses just below). `position: fixed; inset: 0`
// sizes the container to the LAYOUT viewport, which iOS Safari never
// shrinks for an on-screen keyboard — the keyboard simply overlaps the
// bottom of that fixed box instead. The scrollable content area inside
// still only has as much real scroll range as its own content height, so
// once the keyboard covers the last quick actions, no amount of
// scrolling can bring them above the keyboard: dismissing the keyboard
// (the Product Owner's own workaround) is the only way to see them.
// `window.visualViewport` (already used elsewhere in this same folder,
// usePoliedronPosition.js) reports the REAL visible height/offset,
// shrinking live as the keyboard opens on every browser that matters
// here including iOS Safari — `env(keyboard-inset-height)` (used
// elsewhere in this codebase) does not: it's a Chromium/VirtualKeyboard-
// API-only feature, always 0px on iOS. Sizing the fixed container to the
// real visual viewport instead of the full layout viewport means the
// flex column (header fixed, content flex:1 + overflow-y:auto) is always
// laid out within the space actually visible above the keyboard, so its
// own scroll range naturally reaches every last action — never covered,
// never requiring the keyboard to be dismissed first.
export default function PoliedronPanel({
  panelId, isMobile, query, onQueryChange, state, loading,
  highlightedIndex, onHighlightChange, onSelectResult, onConfirmAction, onModifyAction, onSubmit,
  onConfirmActionPlan, actionRunning, actionRunResult,
  onClose, inputRef, submitDisabled = false, interactionDisabled = false,
}) {
  const containerRef = useRef(null);
  const [viewportRect, setViewportRect] = useState(() => computeMobilePanelViewportRect(typeof window !== 'undefined' ? window.visualViewport : null));

  useEffect(() => {
    inputRef.current?.focus();
  }, [inputRef]);

  useEffect(() => {
    if (!isMobile || typeof window === 'undefined' || !window.visualViewport) return undefined;
    const update = () => setViewportRect(computeMobilePanelViewportRect(window.visualViewport));
    update();
    window.visualViewport.addEventListener('resize', update);
    window.visualViewport.addEventListener('scroll', update);
    return () => {
      window.visualViewport.removeEventListener('resize', update);
      window.visualViewport.removeEventListener('scroll', update);
    };
  }, [isMobile]);

  const onKeyDown = (e) => {
    if (e.key === 'Escape') { e.preventDefault(); onClose(); return; }
    const total = countFlatItems(state?.searchResults || []);
    if (e.key === 'ArrowDown' && total > 0) {
      e.preventDefault();
      onHighlightChange((highlightedIndex + 1) % total);
    } else if (e.key === 'ArrowUp' && total > 0) {
      e.preventDefault();
      onHighlightChange((highlightedIndex - 1 + total) % total);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const item = flatItemAt(state?.searchResults || [], highlightedIndex);
      if (item) onSelectResult(item);
      else if (state?.suggestedActions?.[0] && !state?.selectionRequired) onConfirmAction(state.suggestedActions[0]);
      else if (!submitDisabled && !interactionDisabled) onSubmit?.();
    }
  };

  const containerStyle = isMobile
    ? {
        position: 'fixed',
        top: viewportRect ? viewportRect.top : 0,
        left: 0,
        right: 0,
        height: viewportRect ? viewportRect.height : undefined,
        bottom: viewportRect ? undefined : 0,
        zIndex: 1301, display: 'flex', flexDirection: 'column',
        background: C.sur, paddingTop: 'env(safe-area-inset-top, 0px)', paddingBottom: 'env(safe-area-inset-bottom, 0px)',
      }
    : {
        position: 'fixed', top: '12vh', left: '50%', transform: 'translateX(-50%)', zIndex: 1301,
        width: 'min(680px, calc(100vw - 48px))', maxHeight: '78vh', display: 'flex', flexDirection: 'column',
        background: C.sur, borderRadius: 22, border: `1px solid ${C.brd}`,
        boxShadow: '0 30px 70px rgba(15,23,42,.32), 0 6px 20px rgba(15,23,42,.14)',
        backdropFilter: 'blur(16px) saturate(160%)', overflow: 'hidden',
      };

  return (
    <>
      <div
        className="poliedron-panel-backdrop"
        onClick={onClose}
        style={{ position: 'fixed', inset: 0, background: 'rgba(10,16,22,0.45)', backdropFilter: 'blur(2px)', zIndex: 1300 }}
      />
      <div
        ref={containerRef}
        id={panelId}
        role="dialog"
        aria-modal="true"
        aria-label="Poliedron"
        className={isMobile ? 'poliedron-panel--mobile' : 'poliedron-panel--desktop'}
        style={containerStyle}
        onKeyDown={onKeyDown}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: isMobile ? '14px 16px' : '16px 18px', borderBottom: `1px solid ${C.brd}`, flexShrink: 0 }}>
          <span className="poliedron-command-icon"><Ic n="spark" s={16} c={C.pri} /></span>
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            disabled={interactionDisabled}
            placeholder="Chiedi o fai qualsiasi cosa…"
            aria-label="Chiedi o fai qualsiasi cosa"
            style={{ flex: 1, minWidth: 0, border: 'none', outline: 'none', background: 'transparent', fontSize: 16, padding: '4px 0', color: C.txt }}
          />
          {query.trim() && (
            <button className="poliedron-ask-button" onClick={onSubmit} disabled={submitDisabled || interactionDisabled} aria-label="Invia a Poliedron">
              <span>Chiedi</span><Ic n="send" s={12} c="#fff" />
            </button>
          )}
          {isMobile && (
            <button onClick={onClose} aria-label="Chiudi" style={{ width: 30, height: 30, borderRadius: 9, border: 'none', background: C.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}>
              <Ic n="x" s={15} c={C.txm} />
            </button>
          )}
        </div>

        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: isMobile ? '12px 14px' : '14px 16px' }}>
          {loading ? (
            <div className="poliedron-loading-card"><span className="poliedron-loading-card__pulse" />Poliedron sta verificando…</div>
          ) : state?.intelligence ? (
            <PoliedronIntelligenceResults intelligence={state.intelligence} onOpenPatient={onSelectResult} />
          ) : state?.answer != null ? (
            <PoliedronConversation query={query} answer={state.answer} loading={loading} />
          ) : state?.actionPlan ? (
            <PoliedronActionPreviewLevel2 plan={state.actionPlan} running={actionRunning} result={actionRunResult} onConfirm={onConfirmActionPlan} onModify={onModifyAction} />
          ) : state?.confirmationRequired ? (
            <PoliedronActionPreview entities={state.entities} suggestedActions={state.suggestedActions} onConfirm={onConfirmAction} onModify={onModifyAction} />
          ) : (state?.intent == null || state?.suggestionBoard) && state?.searchResults?.length ? (
            <PoliedronSuggestionBoard groups={state.searchResults} onSelect={onSelectResult} />
          ) : state?.searchResults?.length ? (
            <PoliedronSearchResults
              groups={state.searchResults}
              highlightedIndex={highlightedIndex}
              onSelect={onSelectResult}
              onHover={onHighlightChange}
            />
          ) : state?.suggestedActions?.length ? (
            <PoliedronSearchResults
              groups={[{ group: 'AZIONI', items: state.suggestedActions.map((a) => ({ kind: 'action', id: a.id, label: a.label, data: a })) }]}
              highlightedIndex={highlightedIndex}
              onSelect={onSelectResult}
              onHover={onHighlightChange}
            />
          ) : state?.awaitingSubmit ? (
            <button className="poliedron-ask-result" onClick={onSubmit}>
              <span className="poliedron-ask-result__icon"><Ic n="spark" s={16} c={C.pri} /></span>
              <span><strong>Chiedi a Poliedron</strong><small>Nessuna corrispondenza deterministica. Premi Invio per usare l’AI.</small></span>
              <span aria-hidden="true">↵</span>
            </button>
          ) : query.trim() ? (
            <div style={{ padding: '24px 8px', textAlign: 'center', fontSize: 12.5, color: C.txl }}>Nessun risultato per “{query}”.</div>
          ) : null}
        </div>

        {!isMobile && (
          <div style={{ display: 'flex', gap: 14, padding: '9px 16px', borderTop: `1px solid ${C.brd}`, fontSize: 10.5, color: C.txl, flexShrink: 0 }}>
            <span>↑↓ naviga</span><span>↵ seleziona o chiedi</span><span>esc chiudi</span>
          </div>
        )}
      </div>
    </>
  );
}
