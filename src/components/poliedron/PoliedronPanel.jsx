import React, { useEffect, useRef } from 'react';
import { C } from '../../lib/utils';
import { Ic } from '../ui';
import PoliedronSearchResults, { countFlatItems, flatItemAt } from './PoliedronSearchResults';
import PoliedronActionPreview from './PoliedronActionPreview';
import PoliedronConversation from './PoliedronConversation';
import PoliedronSuggestionBoard from './PoliedronSuggestionBoard';

/* POL-AI-001 §4-5, §25, §30-32 — the command panel itself. Pure
   presentation + local UI state (query text, keyboard highlight) — all
   the actual intent/search/action logic lives in poliedraCore and is
   passed in as `state` (already-computed structured output) by the
   Poliedron container. §5: command bar + results + actions is the
   PRIMARY surface; PoliedronConversation (extended answer) only renders
   when `state.answer` is present. */
export default function PoliedronPanel({
  panelId, isMobile, query, onQueryChange, state, loading,
  highlightedIndex, onHighlightChange, onSelectResult, onConfirmAction, onModifyAction, onSubmit,
  onClose, inputRef,
}) {
  const containerRef = useRef(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, [inputRef]);

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
      else onSubmit?.();
    }
  };

  const containerStyle = isMobile
    ? {
        position: 'fixed', inset: 0, zIndex: 1301, display: 'flex', flexDirection: 'column',
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
            placeholder="Chiedi o fai qualsiasi cosa…"
            aria-label="Chiedi o fai qualsiasi cosa"
            style={{ flex: 1, minWidth: 0, border: 'none', outline: 'none', background: 'transparent', fontSize: 16, padding: '4px 0', color: C.txt }}
          />
          {query.trim() && (
            <button className="poliedron-ask-button" onClick={onSubmit} aria-label="Invia a Poliedron">
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
          ) : state?.answer != null ? (
            <PoliedronConversation query={query} answer={state.answer} loading={loading} />
          ) : state?.confirmationRequired ? (
            <PoliedronActionPreview entities={state.entities} suggestedActions={state.suggestedActions} onConfirm={onConfirmAction} onModify={onModifyAction} />
          ) : state?.intent == null && state?.searchResults?.length ? (
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
