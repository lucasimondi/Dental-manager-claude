import React, { useEffect, useRef, useState } from 'react';
import { Ic } from '../ui';
import useChatDictation from './useChatDictation.js';
import { appendMessage } from '../../lib/poliedron/team/threads.js';
import { patientChatKey, whatsappLink, patientName, patientInitials } from '../../lib/poliedron/team/patientChat.js';

// A chat with a patient, WhatsApp style: the message is written here and sent
// through the studio's WhatsApp (wa.me), only with the patient's consent and a
// phone number. What was sent stays in this conversation on the device.
const formatTime = (value) => (value ? new Intl.DateTimeFormat('it-IT', { hour: '2-digit', minute: '2-digit' }).format(new Date(value)) : '');
const newId = () => (globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`);

export function PatientAvatar({ patient }) {
  return <span className="poliedron-team__avatar" data-kind="patient" aria-hidden="true">{patientInitials(patient)}</span>;
}

export default function PatientThread({ patient, team, onBack }) {
  const key = patientChatKey(patient.id);
  const thread = team.state.threads[key] || [];
  const [draft, setDraft] = useState('');
  const scrollRef = useRef(null);
  const dictation = useChatDictation({ draft, setDraft });
  const link = whatsappLink(patient.telefono, '');
  const blocked = !link ? 'Il paziente non ha un numero di telefono in scheda.'
    : !patient.consensoWhatsapp ? 'Manca il consenso WhatsApp del paziente: registralo nella scheda prima di scrivergli.'
    : null;

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [thread.length]);

  const send = () => {
    const text = draft.trim();
    if (!text || blocked) return;
    window.open(whatsappLink(patient.telefono, text), '_blank', 'noopener');
    team.setState((s) => appendMessage(s, key, { id: newId(), role: 'user', content: text, at: new Date().toISOString(), via: 'whatsapp' }));
    setDraft('');
  };

  return (
    <>
      <header className="poliedron-chat__header">
        {onBack && <button type="button" className="poliedron-wa__back" onClick={onBack} aria-label="Torna alle chat"><Ic n="back" s={20} /></button>}
        <PatientAvatar patient={patient} />
        <div className="poliedron-chat__header-text">
          <h1>{patientName(patient)}</h1>
          <p>{patient.telefono ? `WhatsApp · ${patient.telefono}` : 'Nessun telefono in scheda'}</p>
        </div>
      </header>
      <div className="poliedron-chat__timeline">
        <div ref={scrollRef} className="poliedron-chat__messages" aria-live="polite">
          {!thread.length && (
            <div className="poliedron-chat__empty" data-state="empty">
              <span><PatientAvatar patient={patient} /></span>
              <strong>Scrivi a {patientName(patient)}</strong>
              <p>Il messaggio parte dal WhatsApp dello studio: si apre WhatsApp con il testo già pronto, tu premi invio.</p>
            </div>
          )}
          {thread.map((m) => (
            <article key={m.id} className="poliedron-chat__message is-user">
              <div className="poliedron-chat__bubble">
                <div style={{ whiteSpace: 'pre-wrap' }}>{m.content}</div>
                <footer><time dateTime={m.at}>{formatTime(m.at)}</time><span>Aperto in WhatsApp</span></footer>
              </div>
            </article>
          ))}
        </div>
      </div>
      <div className="poliedron-chat__composer">
        {(blocked || dictation.notice || dictation.listening) && (
          <div className="poliedron-chat__notice" role="status">{blocked || dictation.notice || 'Ti ascolto… Tocca di nuovo il microfono per terminare.'}</div>
        )}
        <div className="poliedron-chat__composer-row">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); send(); } }}
            rows={1}
            maxLength={4000}
            placeholder="Messaggio WhatsApp…"
            aria-label={`Messaggio per ${patientName(patient)}`}
            enterKeyHint="send"
            disabled={Boolean(blocked)}
          />
          <button type="button" className="poliedron-chat__mic" onClick={dictation.toggle} disabled={Boolean(blocked)} aria-label={dictation.listening ? 'Termina dettatura' : 'Detta messaggio'} aria-pressed={dictation.listening}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"><rect x="9" y="2" width="6" height="12" rx="3"/><path d="M5 10v2a7 7 0 0 0 14 0v-2M12 19v3M8 22h8"/></svg>
          </button>
          <button type="button" className="poliedron-chat__send" onClick={send} disabled={Boolean(blocked) || dictation.listening || !draft.trim()} aria-label="Invia con WhatsApp">
            <Ic n="send" s={18} c="#fff" />
          </button>
        </div>
      </div>
    </>
  );
}
