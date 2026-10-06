import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Ic } from '../ui';
import { TEAM_ASSISTANTS } from '../../lib/poliedron/team/catalog.js';
import useChatDictation from './useChatDictation.js';
import {
  loadTeamState, saveTeamState, teamContacts, contactKey, addGroup, removeGroup,
  appendMessage, teamRequestFor, threadHistory,
} from '../../lib/poliedron/team/threads.js';

// POL-AI-TEAM-002: the Poliedron team as chat contacts. Specialists answer in
// read-only consultation; the Clinic Manager (and every group) consults them
// and integrates their opinions. Actions stay with Poliedron's main chat.
const SPECIALISTS = TEAM_ASSISTANTS.filter((a) => a.id !== 'clinic-manager');
const INITIALS = { 'clinic-manager': 'CM', agenda: 'AG', clinical: 'CL', marketing: 'MK', finance: 'FI', documents: 'DO' };
const nameOf = (id) => TEAM_ASSISTANTS.find((a) => a.id === id)?.label || id;
const storage = () => { try { return window.localStorage; } catch { return null; } };
const newId = () => (globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`);

function GroupForm({ onCreate, onCancel }) {
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

export default function PoliedronTeam({ studioId, userId, ask, onClose }) {
  const [state, setState] = useState(() => loadTeamState(storage(), studioId, userId));
  const [activeKey, setActiveKey] = useState(null);
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const scrollRef = useRef(null);
  const dictation = useChatDictation({ draft, setDraft });

  useEffect(() => { setState(loadTeamState(storage(), studioId, userId)); }, [studioId, userId]);
  useEffect(() => { saveTeamState(storage(), studioId, userId, state); }, [state, studioId, userId]);

  const contacts = useMemo(() => teamContacts(state), [state]);
  const active = contacts.find((c) => contactKey(c) === activeKey) || null;
  const thread = active ? state.threads[activeKey] || [] : [];

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [thread.length, sending, activeKey]);

  const send = async () => {
    const text = draft.trim();
    if (!text || sending || !active) return;
    const key = activeKey;
    const history = threadHistory(state.threads[key]);
    setDraft('');
    setSending(true);
    setState((s) => appendMessage(s, key, { id: newId(), role: 'user', content: text, at: new Date().toISOString() }));
    try {
      const result = await ask({ team: teamRequestFor(active), input: text, history });
      if (result?.error || !result?.text) throw new Error(result?.error || 'Nessuna risposta');
      setState((s) => appendMessage(s, key, {
        id: newId(), role: 'assistant', content: result.text, at: new Date().toISOString(),
        pareri: result.pareri?.length ? result.pareri : undefined,
      }));
    } catch {
      setState((s) => {
        const t = [...(s.threads[key] || [])];
        if (t.length) t[t.length - 1] = { ...t[t.length - 1], failed: true };
        return { ...s, threads: { ...s.threads, [key]: t } };
      });
      setDraft(text);
    } finally {
      setSending(false);
    }
  };

  const header = (title, subtitle, onBack, backLabel, avatar) => (
    <header className="poliedron-chat__header poliedron-team__header">
      <button type="button" className="poliedron-team__back" onClick={onBack} aria-label={backLabel}><Ic n="back" s={18} /></button>
      {avatar}
      <div className="poliedron-chat__header-text">
        <h1>{title}</h1>
        <p>{subtitle}</p>
      </div>
    </header>
  );
  const avatarOf = (c) => (
    <span className="poliedron-team__avatar" data-kind={c.kind} aria-hidden="true">
      {c.kind === 'group' ? <Ic n="users" s={16} /> : INITIALS[c.id] || c.label.slice(0, 2)}
    </span>
  );

  if (!active) {
    return (
      <>
        {header('Team di Poliedron', 'Specialisti in sola lettura · pareri', onClose, 'Torna alla chat di Poliedron',
          <span className="poliedron-team__avatar" data-kind="team" aria-hidden="true"><Ic n="users" s={16} /></span>)}
        <div className="poliedron-team__body">
          <div className="poliedron-team__inner">
            <p className="poliedron-team__intro">Leggono i dati dello studio e ti danno un parere. Le azioni (agenda, pazienti…) le fa Poliedron nella chat principale.</p>
            <ul className="poliedron-team__contacts">
              {contacts.map((c) => (
                <li key={contactKey(c)}>
                  <button type="button" onClick={() => setActiveKey(contactKey(c))}>
                    {avatarOf(c)}
                    <span className="poliedron-team__contact-text">
                      <strong>{c.label}</strong>
                      <small>{c.kind === 'group' ? `Gruppo · ${c.assistantIds.map(nameOf).join(', ')}` : c.description}</small>
                    </span>
                    <span className="poliedron-team__chevron" aria-hidden="true">›</span>
                  </button>
                  {c.kind === 'group' && (
                    <button type="button" className="poliedron-team__remove" aria-label={`Elimina il gruppo ${c.label}`} onClick={() => setState((s) => removeGroup(s, c.id))}>Elimina</button>
                  )}
                </li>
              ))}
            </ul>
            {creating ? (
              <GroupForm
                onCancel={() => setCreating(false)}
                onCreate={(data) => {
                  const id = newId();
                  setState((s) => addGroup(s, data, { studioId, userId, id }));
                  setCreating(false);
                  setActiveKey(`group:${id}`);
                }}
              />
            ) : (
              <button type="button" className="poliedron-team__new" onClick={() => setCreating(true)}>+ Nuovo gruppo</button>
            )}
          </div>
        </div>
      </>
    );
  }

  const coordinated = active.kind === 'group' || active.id === 'clinic-manager';
  return (
    <>
      {header(active.label, active.kind === 'group' ? active.assistantIds.map(nameOf).join(', ') : 'Sola lettura · pareri',
        () => setActiveKey(null), 'Torna ai contatti del team', avatarOf(active))}
      <div className="poliedron-chat__timeline">
        <div ref={scrollRef} className="poliedron-chat__messages" aria-live="polite">
          {!thread.length && (
            <div className="poliedron-chat__empty" data-state="empty">
              <span><Ic n="chat" s={24} /></span>
              <strong>{active.kind === 'group' ? `Obiettivo: ${active.description}` : active.description}</strong>
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
                {m.failed && <footer><span>Non inviato: riprova.</span></footer>}
              </div>
            </article>
          ))}
          {sending && (
            <div className="poliedron-chat__typing">
              <span /><span /><span />
              <small>{coordinated ? 'Il Clinic Manager consulta il team…' : `${active.label} sta analizzando…`}</small>
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
            placeholder={`Scrivi a ${active.label}…`}
            aria-label={`Messaggio per ${active.label}`}
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
