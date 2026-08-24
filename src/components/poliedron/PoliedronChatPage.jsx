import React, { useEffect, useRef, useState } from 'react';
import { Ic } from '../ui';
import PoliedronActionPreview from './PoliedronActionPreview';
import PoliedronActionPreviewLevel2 from './PoliedronActionPreviewLevel2';
import PoliedronIntelligenceResults from './PoliedronIntelligenceResults';
import PoliedronSearchResults from './PoliedronSearchResults';

const NEAR_BOTTOM_PX = 120;

const formatTime = (value) => {
  if (!value) return '';
  return new Intl.DateTimeFormat('it-IT', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
};

function StructuredResult({
  state,
  onSelectResult,
  onConfirmAction,
  onModifyAction,
  onConfirmActionPlan,
  actionRunning,
  actionRunResult,
}) {
  if (!state) return null;
  if (state.intelligence) {
    return <PoliedronIntelligenceResults intelligence={state.intelligence} onOpenPatient={onSelectResult} />;
  }
  if (state.actionPlan) {
    return (
      <PoliedronActionPreviewLevel2
        plan={state.actionPlan}
        running={actionRunning}
        result={actionRunResult}
        onConfirm={onConfirmActionPlan}
        onModify={onModifyAction}
      />
    );
  }
  if (state.confirmationRequired) {
    return (
      <PoliedronActionPreview
        entities={state.entities}
        suggestedActions={state.suggestedActions}
        onConfirm={onConfirmAction}
        onModify={onModifyAction}
      />
    );
  }
  if (state.searchResults?.length) {
    return (
      <PoliedronSearchResults
        groups={state.searchResults}
        highlightedIndex={-1}
        onSelect={onSelectResult}
        onHover={() => {}}
      />
    );
  }
  return null;
}

export default function PoliedronChatPage({
  messages,
  loading,
  loadingOlder,
  errorKind = null,
  surfaceStatus = null,
  hasOlder,
  sending,
  error,
  structuredState,
  onSend,
  onRetry,
  onRetryInitialization,
  onLoadOlder,
  onVisible,
  onSelectResult,
  onConfirmAction,
  onModifyAction,
  onConfirmActionPlan,
  actionRunning,
  actionRunResult,
}) {
  const [draft, setDraft] = useState('');
  const scrollRef = useRef(null);
  const nearBottomRef = useRef(true);
  const initializedRef = useRef(false);

  useEffect(() => {
    onVisible?.();
  }, [messages.length, onVisible]);

  useEffect(() => {
    const element = scrollRef.current;
    if (!element) return;
    if (!initializedRef.current || nearBottomRef.current) {
      element.scrollTop = element.scrollHeight;
      initializedRef.current = true;
    }
  }, [messages.length, sending, structuredState]);

  const handleScroll = () => {
    const element = scrollRef.current;
    if (!element) return;
    nearBottomRef.current =
      element.scrollHeight - element.scrollTop - element.clientHeight <= NEAR_BOTTOM_PX;
  };

  const loadOlder = async () => {
    const element = scrollRef.current;
    if (!element || loadingOlder) return;
    const previousHeight = element.scrollHeight;
    const previousTop = element.scrollTop;
    await onLoadOlder?.();
    requestAnimationFrame(() => {
      const current = scrollRef.current;
      if (current) current.scrollTop = previousTop + (current.scrollHeight - previousHeight);
    });
  };

  const submit = async () => {
    const value = draft.trim();
    if (!value || sending || loading) return;
    const accepted = await onSend(value);
    if (accepted !== false) setDraft('');
  };

  return (
    <section className="poliedron-chat" aria-label="Chat Polyedron" data-surface-status={surfaceStatus || undefined}>
      <header className="poliedron-chat__header">
        <span className="poliedron-chat__brand"><Ic n="spark" s={18} /></span>
        <div>
          <h1>Chat Polyedron</h1>
          <p>La linea diretta persistente con il tuo Polyedron</p>
        </div>
      </header>

      <div
        ref={scrollRef}
        className="poliedron-chat__messages"
        onScroll={handleScroll}
        aria-live="polite"
      >
        {hasOlder && (
          <button
            type="button"
            className="poliedron-chat__load-older"
            onClick={loadOlder}
            disabled={loadingOlder}
          >
            {loadingOlder ? 'Caricamento…' : 'Carica messaggi precedenti'}
          </button>
        )}

        {/* POL-CHAT-001 §FASE 10 — LOADING, EMPTY and ERROR are three
            distinct, mutually exclusive states. Previously "loading" rendered
            nothing at all and a failed initialization looked identical to an
            empty conversation. */}
        {loading && messages.length === 0 && (
          <div className="poliedron-chat__empty" role="status" data-state="loading">
            <span><Ic n="spark" s={24} /></span>
            <strong>Carico la conversazione…</strong>
            <p>Sto recuperando la cronologia persistente della tua Chat.</p>
          </div>
        )}

        {!loading && !error && messages.length === 0 && (
          <div className="poliedron-chat__empty" data-state="empty">
            <span><Ic n="chat" s={24} /></span>
            <strong>Inizia una conversazione</strong>
            <p>Chiedi informazioni, cerca una sezione o usa le funzioni già disponibili a Polyedron.</p>
          </div>
        )}

        {messages.map((message) => (
          <article
            key={message.id}
            className={`poliedron-chat__message is-${message.role}${message.delivery_status === 'failed' ? ' is-failed' : ''}`}
          >
            {message.role !== 'user' && (
              <span className="poliedron-chat__avatar"><Ic n="spark" s={13} /></span>
            )}
            <div className="poliedron-chat__bubble">
              <div>{message.content}</div>
              <footer>
                <time dateTime={message.created_at}>{formatTime(message.created_at)}</time>
                {message.role === 'user' && message.delivery_status === 'pending' && (
                  sending
                    ? <span>Invio…</span>
                    : <button type="button" onClick={() => onRetry(message)}>Riprova</button>
                )}
                {message.delivery_status === 'failed' && (
                  <button type="button" onClick={() => onRetry(message)} disabled={sending}>
                    Riprova
                  </button>
                )}
              </footer>
            </div>
          </article>
        ))}

        <StructuredResult
          state={structuredState}
          onSelectResult={onSelectResult}
          onConfirmAction={onConfirmAction}
          onModifyAction={onModifyAction}
          onConfirmActionPlan={onConfirmActionPlan}
          actionRunning={actionRunning}
          actionRunResult={actionRunResult}
        />

        {sending && (
          <div className="poliedron-chat__typing">
            <span /><span /><span />
            <small>Polyedron sta verificando…</small>
          </div>
        )}
      </div>

      <div className="poliedron-chat__composer">
        {error && (
          <div className="poliedron-chat__error" role="alert" data-kind={errorKind || 'generic'}>
            <span>{error}</span>
            {onRetryInitialization && (
              <button type="button" onClick={onRetryInitialization}>Riprova</button>
            )}
          </div>
        )}
        <div className="poliedron-chat__composer-row">
          <textarea
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault();
                submit();
              }
            }}
            rows={1}
            maxLength={16000}
            placeholder="Scrivi a Polyedron…"
            aria-label="Messaggio per Polyedron"
            disabled={loading}
          />
          <button
            type="button"
            className="poliedron-chat__send"
            onClick={submit}
            disabled={loading || sending || !draft.trim()}
            aria-label="Invia messaggio"
          >
            <Ic n="send" s={18} c="#fff" />
          </button>
        </div>
      </div>
    </section>
  );
}
