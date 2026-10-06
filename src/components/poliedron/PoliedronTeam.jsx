import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Ic } from '../ui';
import { TEAM_ASSISTANTS } from '../../lib/poliedron/team/catalog.js';
import useChatDictation from './useChatDictation.js';
import {
  loadTeamState, saveTeamState, teamContacts, addGroup, removeGroup,
  appendMessage, teamRequestFor, threadHistory,
} from '../../lib/poliedron/team/threads.js';

// POL-AI-TEAM-002: the Poliedron team as chat contacts, WhatsApp style.
// Specialists answer in read-only consultation; the Clinic Manager (and every
// group) consults them and integrates their opinions. Actions stay with
// Poliedron's own chat.
const SPECIALISTS = TEAM_ASSISTANTS.filter((a) => a.id !== 'clinic-manager');
const INITIALS = { 'clinic-manager': 'CM', agenda: 'AG', clinical: 'CL', marketing: 'MK', finance: 'FI', documents: 'DO' };
export const nameOf = (id) => TEAM_ASSISTANTS.find((a) => a.id === id)?.label || id;
const storage = () => { try { return window.localStorage; } catch { return null; } };
const newId = () => (globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`);

/** Team contacts, groups and conversations of this studio/user (device storage). */
export function useTeamState(studioId, userId) {
  const [state, setState] = useState(() => loadTeamState(storage(), studioId, userId));
  useEffect(() => { setState(loadTeamState(storage(), studioId, userId)); }, [studioId, userId]);
  useEffect(() => { saveTeamState(storage(), studioId, userId, state); }, [state, studioId, userId]);
  const contacts = useMemo(() => teamContacts(state), [state]);
  const createGroup = (data) => {
    const id = newId();
    setState((s) => addGroup(s, data, { studioId, userId, id }));
    return `group:${id}`;
  };
  const deleteGroup = (id) => setState((s) => removeGroup(s, id));
  return { state, setState, contacts, createGroup, deleteGroup };
}

export function TeamAvatar({ contact }) {
  return (
    <span className="poliedron-team__avatar" data-kind={contact.kind} aria-hidden="true">
      {contact.kind === 'group' ? <Ic n="users" s={18} /> : INITIALS[contact.id] || contact.label.slice(0, 2)}
    </span>
  );
}

export function GroupForm({ onCreate, onCancel }) {
  const [title, setTitle] = useState('');
  const [objective, setObjective] = useState('');
  const [members, setMembers] = useState([]);
  const [error, setError] = useState(null);
  const toggle = (id) => setMembers((m) => (m.includes(id) ? m.filter((x) => x !== id) : [...m, id]));
  const submit = (event) => {
    event.preventDefault();
    if (!title.trim() || !objective.trim() || !members.length) {
      setError('Serve un nome, un obiettivo e almeno uno specialista.');
      return;
    }
    try { onCreate({ title, objective, assistantIds: members }); } catch { setError('Gruppo non valido: controlla i dati.'); }
  };
  return (
    <form className="poliedron-team__form" onSubmit={submit}>
      <strong>Nuovo gruppo</strong>
      <input value={title} maxLength={120} onChange={(e) => setTitle(e.target.value)} placeholder="Nome (es. Crescita igiene)" aria-label="Nome del gruppo" />
      <textarea value={objective} maxLength={2000} rows={2} onChange={(e) => setObjective(e.target.value)} placeholder="Obiettivo (es. +20% sedute di igiene entro marzo)" aria-label="Obiettivo del gruppo" />
      <fieldset>
        <legend>Specialisti (coordina il Clinic Manager)</legend>
        {SPECIALISTS.map((a) => (
          <label key={a.id}><input type="checkbox" checked={members.includes(a.id)} onChange={() => toggle(a.id)} /> {a.label}</label>
        ))}
      </fieldset>
      {error && <p role="alert">{error}</p>}
      <span className="poliedron-team__form-actions">
        <button type="submit">Crea gruppo</button>
        <button type="button" onClick={onCancel}>Annulla</button>
      </span>
    </form>
  );
}

function Pareri({ pareri }) {
  if (!pareri?.length) return null;
  return (
    <details className="poliedron-team__pareri">
      <summary>Pareri degli specialisti ({pareri.length})</summary>
      {pareri.map((p) => (
        <div key={p.specialista}>
          <strong>{p.nome || nameOf(p.specialista)}</strong>
          <p style={{ whiteSpace: 'pre-wrap' }}>{p.stato === 'ok' ? p.parere : 'Non disponibile in questo momento.'}</p>
        </div>
      ))}
    </details>
  );
}

const formatTime = (value) => (value ? new Intl.DateTimeFormat('it-IT', { hour: '2-digit', minute: '2-digit' }).format(new Date(value)) : '');

/** One conversation with a team contact: header, messages, composer. */
export function TeamThread({ contact, team, ask, onBack, onDeleteGroup }) {
  const key = contact.kind === 'group' ? `group:${contact.id}` : `assistant:${contact.id}`;
  const thread = team.state.threads[key] || [];
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const scrollRef = useRef(null);
  const dictation = useChatDictation({ draft, setDraft });
  const coordinated = contact.kind === 'group' || contact.id === 'clinic-manager';

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [thread.length, sending, key]);

  const send = async () => {
    const text = draft.trim();
    if (!text || sending) return;
    const history = threadHistory(thread);
    setDraft('');
    setSending(true);
    team.setState((s) => appendMessage(s, key, { id: newId(), role: 'user', content: text, at: new Date().toISOString() }));
    try {
      const result = await ask({ team: teamRequestFor(contact), input: text, history });
      if (result?.error || !result?.text) throw new Error(result?.error || 'Nessuna risposta');
      team.setState((s) => appendMessage(s, key, {
        id: newId(), role: 'assistant', content: result.text, at: new Date().toISOString(),
        pareri: result.pareri?.length ? result.pareri : undefined,
      }));
    } catch {
      team.setState((s) => {
        const t = [...(s.threads[key] || [])];
        if (t.length) t[t.length - 1] = { ...t[t.length - 1], failed: true };
        return { ...s, threads: { ...s.threads, [key]: t } };
      });
      setDraft(text);
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      <header className="poliedron-chat__header">
        {onBack && <button type="button" className="poliedron-wa__back" onClick={onBack} aria-label="Torna alle chat"><Ic n="back" s={20} /></button>}
        <TeamAvatar contact={contact} />
        <div className="poliedron-chat__header-text">
          <h1>{contact.label}</h1>
          <p>{sending ? (coordinated ? 'Consulta il team…' : 'Sta analizzando…') : contact.kind === 'group' ? contact.assistantIds.map(nameOf).join(', ') : 'Sola lettura · pareri'}</p>
        </div>
        {contact.kind === 'group' && onDeleteGroup && (
          <button
            type="button"
            className="poliedron-wa__icon-button"
            aria-label={`Elimina il gruppo ${contact.label}`}
            onClick={() => { if (window.confirm(`Eliminare il gruppo "${contact.label}" e la sua conversazione?`)) onDeleteGroup(contact.id); }}
          >
            <Ic n="del" s={18} />
          </button>
        )}
      </header>
      <div className="poliedron-chat__timeline">
        <div ref={scrollRef} className="poliedron-chat__messages" aria-live="polite">
          {!thread.length && (
            <div className="poliedron-chat__empty" data-state="empty">
              <span><TeamAvatar contact={contact} /></span>
              <strong>{contact.kind === 'group' ? `Obiettivo: ${contact.description}` : contact.description}</strong>
              <p>{coordinated
                ? 'Il Clinic Manager consulta gli specialisti utili e ti dà una risposta unica.'
                : 'Fai una domanda: risponde con i dati reali dello studio, senza modificare nulla.'}</p>
            </div>
          )}
          {thread.map((m) => (
            <article key={m.id} className={`poliedron-chat__message is-${m.role}${m.failed ? ' is-failed' : ''}`}>
              {m.role !== 'user' && <span className="poliedron-chat__avatar"><Ic n="spark" s={13} /></span>}
              <div className="poliedron-chat__bubble">
                <div style={{ whiteSpace: 'pre-wrap' }}>{m.content}</div>
                <Pareri pareri={m.pareri} />
                <footer>
                  <time dateTime={m.at}>{formatTime(m.at)}</time>
                  {m.failed && <span>Non inviato: riprova.</span>}
                </footer>
              </div>
            </article>
          ))}
          {sending && (
            <div className="poliedron-chat__typing">
              <span /><span /><span />
              <small>{coordinated ? 'Il Clinic Manager consulta il team…' : `${contact.label} sta analizzando…`}</small>
            </div>
          )}
        </div>
      </div>
      <div className="poliedron-chat__composer">
        {(dictation.notice || dictation.listening) && <div className="poliedron-chat__notice" role="status">{dictation.notice || 'Ti ascolto… Tocca di nuovo il microfono per terminare.'}</div>}
        <div className="poliedron-chat__composer-row">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); send(); } }}
            rows={1}
            maxLength={16000}
            placeholder={`Scrivi a ${contact.label}…`}
            aria-label={`Messaggio per ${contact.label}`}
            enterKeyHint="send"
          />
          <button type="button" className="poliedron-chat__mic" onClick={dictation.toggle} disabled={sending} aria-label={dictation.listening ? 'Termina dettatura' : 'Detta messaggio'} aria-pressed={dictation.listening}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"><rect x="9" y="2" width="6" height="12" rx="3"/><path d="M5 10v2a7 7 0 0 0 14 0v-2M12 19v3M8 22h8"/></svg>
          </button>
          <button type="button" className="poliedron-chat__send" onClick={send} disabled={sending || dictation.listening || !draft.trim()} aria-label="Invia messaggio" aria-busy={sending}>
            <Ic n="send" s={18} c="#fff" />
          </button>
        </div>
      </div>
    </>
  );
}
