import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Ic } from '../ui';
import { TEAM_ASSISTANTS } from '../../lib/poliedron/team/catalog.js';
import {
  loadTeamState, saveTeamState, teamContacts, contactKey, addGroup, removeGroup,
  appendMessage, teamRequestFor, threadHistory,
} from '../../lib/poliedron/team/threads.js';

// POL-AI-TEAM-002: the Poliedron team as chat contacts. Specialists answer in
// read-only consultation; the Clinic Manager (and every group) consults them
// and integrates their opinions. Actions stay with Poliedron's main chat.
const SPECIALISTS = TEAM_ASSISTANTS.filter((a) => a.id !== 'clinic-manager');
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

  if (!active) {
    return (
      <section className="poliedron-team" aria-label="Team di Poliedron">
        <header className="poliedron-team__bar">
          <strong><Ic n="spark" s={15} /> Team di Poliedron</strong>
          <button type="button" onClick={onClose}>Torna a Poliedron</button>
        </header>
        <p className="poliedron-team__intro">Assistenti specializzati: leggono i dati dello studio e danno pareri. Le azioni (agenda, pazienti…) le esegue Poliedron nella chat principale.</p>
        <ul className="poliedron-team__contacts">
          {contacts.map((c) => (
            <li key={contactKey(c)}>
              <button type="button" onClick={() => setActiveKey(contactKey(c))}>
                <span className="poliedron-team__avatar" data-kind={c.kind}>{c.kind === 'group' ? <Ic n="users" s={15} /> : c.label.replace('Assistente ', '').slice(0, 2)}</span>
                <span>
                  <strong>{c.label}</strong>
                  <small>{c.kind === 'group' ? `Gruppo · ${c.assistantIds.map(nameOf).join(', ')}` : c.description}</small>
                </span>
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
      </section>
    );
  }

  return (
    <section className="poliedron-team is-thread" aria-label={`Chat con ${active.label}`}>
      <header className="poliedron-team__bar">
        <button type="button" onClick={() => setActiveKey(null)} aria-label="Torna ai contatti del team"><Ic n="back" s={15} /> Team</button>
        <strong>{active.label}</strong>
        <small>{active.kind === 'group' ? active.assistantIds.map(nameOf).join(', ') : 'Sola lettura · pareri'}</small>
      </header>
      <div ref={scrollRef} className="poliedron-chat__messages" aria-live="polite">
        {!thread.length && (
          <div className="poliedron-chat__empty" data-state="empty">
            <span><Ic n="chat" s={24} /></span>
            <strong>{active.kind === 'group' ? `Gruppo: ${active.description}` : active.description}</strong>
            <p>{active.kind === 'group' || active.id === 'clinic-manager'
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
            <small>{active.kind === 'group' || active.id === 'clinic-manager' ? 'Il Clinic Manager consulta il team…' : `${active.label} sta analizzando…`}</small>
          </div>
        )}
      </div>
      <div className="poliedron-chat__composer">
        <div className="poliedron-chat__composer-row">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
            rows={1}
            maxLength={16000}
            placeholder={`Scrivi a ${active.label}…`}
            aria-label={`Messaggio per ${active.label}`}
          />
          <button type="button" className="poliedron-chat__send" onClick={send} disabled={sending || !draft.trim()} aria-label="Invia messaggio" aria-busy={sending}>
            <Ic n="send" s={18} c="#fff" />
          </button>
        </div>
      </div>
    </section>
  );
}
