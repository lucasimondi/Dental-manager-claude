import PoliedronModelConfirmation from './PoliedronModelConfirmation';
import React, { useEffect, useRef, useState } from 'react';
import { Ic } from '../ui';
import PoliedronActionPreview from './PoliedronActionPreview';
import PoliedronActionPreviewLevel2 from './PoliedronActionPreviewLevel2';
import PoliedronIntelligenceResults from './PoliedronIntelligenceResults';
import PoliedronSearchResults from './PoliedronSearchResults';
import PoliedronAttivita from './PoliedronAttivita';
import { useTeamState, TeamThread, TeamAvatar, GroupForm } from './PoliedronTeam';
import { contactKey } from '../../lib/poliedron/team/threads.js';
import PatientThread, { PatientAvatar } from './PoliedronPatientChat.jsx';
import { patientChatKey, patientIdFromKey, patientName, searchPatients, searchMessages } from '../../lib/poliedron/team/patientChat.js';
import PoliedronInstall from './PoliedronInstall.jsx';
import useChatDictation from './useChatDictation.js';
import { submitChatDraft } from '../../lib/poliedron/phoneApp.js';
import poliedroGem from '../../assets/icon-poliedra-gem.png';
import PoliedronMemoryPanel from './PoliedronMemoryPanel';
import PoliedronSaveAttachment from './PoliedronSaveAttachment';
import { ATTACHMENT_ACCEPT, ATTACHMENT_ONLY_TEXT, formatAttachmentSize } from '../../lib/poliedron/chatAttachment.js';

const NEAR_BOTTOM_PX = 120;
const NARROW_QUERY = '(max-width: 719px)';

// On a phone-width screen the header keeps one row: title plus a ⋮ menu.
function useNarrowScreen() {
  const [narrow, setNarrow] = useState(() => typeof window !== 'undefined' && Boolean(window.matchMedia?.(NARROW_QUERY).matches));
  useEffect(() => {
    const query = window.matchMedia?.(NARROW_QUERY);
    if (!query) return undefined;
    const update = () => setNarrow(query.matches);
    update();
    query.addEventListener?.('change', update);
    return () => query.removeEventListener?.('change', update);
  }, []);
  return narrow;
}

const dayLabel = (value) => value ? new Intl.DateTimeFormat('it-IT', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(value)) : '';
const dayKey = (value) => value ? new Date(value).toLocaleDateString('it-IT') : '';

const formatTime = (value) => {
  if (!value) return '';
  return new Intl.DateTimeFormat('it-IT', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
};

function StructuredResult({
  state, onModelConfirmation,
  attachment, patients, attachmentSaving, onSaveAttachment, onCancelSaveAttachment,
  onSelectResult,
  onConfirmAction,
  onModifyAction,
  onConfirmActionPlan,
  actionRunning,
  actionRunResult,
}) {
  if (!state) return null;
  if (state.attachmentSave) {
    return (
      <PoliedronSaveAttachment
        key={(state.attachmentSave.candidates || []).map((p) => p.id).join(',') || 'nessuno'}
        attachment={attachment}
        candidates={state.attachmentSave.candidates}
        patients={patients}
        busy={attachmentSaving}
        onSave={onSaveAttachment}
        onCancel={onCancelSaveAttachment}
      />
    );
  }
  if (state.modelConfirmation) return <PoliedronModelConfirmation pending={state.modelConfirmation} busy={actionRunning} onDecision={onModelConfirmation} />;
  if (state.answer) return <p role="status" style={{ whiteSpace: 'pre-wrap' }}>{state.answer}</p>;
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
  phoneApp = false,
  messages,
  loading,
  loadingOlder,
  errorKind = null,
  surfaceStatus = null,
  hasOlder,
  sending,
  error,
  structuredState, onModelConfirmation,
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
  attachment = null,
  attachmentPreparing = false,
  onAttachFile,
  onRemoveAttachment,
  onRequestSaveAttachment,
  onSaveAttachment,
  onCancelSaveAttachment,
  attachmentSaving = false,
  memoryClient = null,
  navItems = [],
  onNavigate,
  loadActivity,
  restoreActivity,
  askTeam,
  teamIdentity,
  patients = [],
  onOpenPatient,
}) {
  const [draft, setDraft] = useState('');
  const [showActivity, setShowActivity] = useState(false);
  // WhatsApp-style: a list of chats (Poliedron, team, groups); on a phone the
  // list and the open chat are two screens, on a computer two panes.
  const [openChat, setOpenChat] = useState(null);
  // null | 'menu' (Nuova chat) | 'group' | 'patient'
  const [newChat, setNewChat] = useState(null);
  const [patientQuery, setPatientQuery] = useState('');
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('tutte');
  const team = useTeamState(teamIdentity?.studioId, teamIdentity?.userId);
  const [awayFromBottom, setAwayFromBottom] = useState(false);
  const menuRef = useRef(null);
  const compact = useNarrowScreen() || phoneApp;
  const activeChat = openChat || (compact ? null : 'poliedron');
  const activeContact = activeChat && activeChat !== 'poliedron' ? team.contacts.find((c) => contactKey(c) === activeChat) : null;
  const activePatientId = patientIdFromKey(activeChat);
  const activePatient = activePatientId ? patients.find((p) => String(p.id) === activePatientId) : null;
  const poliedronOpen = activeChat === 'poliedron';
  const [pendingUser, setPendingUser] = useState(null);
  const [composerError, setComposerError] = useState('');
  const [online, setOnline] = useState(() => navigator.onLine !== false);
  const submitLock = useRef(false);
  const textareaRef = useRef(null);
  const dictation = useChatDictation({ draft, setDraft });
  const scrollRef = useRef(null);
  const nearBottomRef = useRef(true);
  const initializedRef = useRef(false);
  const listHeightRef = useRef(null);
  const fileInputRef = useRef(null);
  const [memoriaAperta, setMemoriaAperta] = useState(false);
  const sendDisabled = loading || sending || attachmentPreparing || (!draft.trim() && !attachment) || !online || Boolean(pendingUser) || dictation.listening;

  useEffect(() => {
    const update = () => setOnline(navigator.onLine !== false);
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    return () => { window.removeEventListener('online', update); window.removeEventListener('offline', update); };
  }, []);

  useEffect(() => {
    const input = textareaRef.current;
    if (!input) return;
    input.style.height = 'auto';
    input.style.height = `${Math.min(120, input.scrollHeight)}px`;
  }, [draft, poliedronOpen]);

  useEffect(() => {
    if (!poliedronOpen) return undefined;
    const mark = () => { if (!document.hidden) onVisible?.(); };
    mark();
    document.addEventListener('visibilitychange', mark);
    return () => document.removeEventListener('visibilitychange', mark);
  }, [messages.length, onVisible, poliedronOpen]);

  // Opening Poliedron's chat always starts from the latest message.
  useEffect(() => {
    if (!poliedronOpen) return;
    initializedRef.current = false;
    nearBottomRef.current = true;
    setAwayFromBottom(false);
  }, [poliedronOpen]);

  useEffect(() => {
    const element = scrollRef.current;
    if (!element) return;
    if (!initializedRef.current || nearBottomRef.current) {
      element.scrollTop = element.scrollHeight;
      initializedRef.current = true;
    }
  }, [messages.length, sending, structuredState, pendingUser, poliedronOpen]);

  // A keyboard or a growing input changes the available list height. Keep
  // the latest message visible only when the reader was already at the end.
  useEffect(() => {
    const element = scrollRef.current;
    if (!element || !window.ResizeObserver) return undefined;
    const observer = new ResizeObserver(() => {
      if (nearBottomRef.current) element.scrollTop = element.scrollHeight;
      listHeightRef.current = element.clientHeight;
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [poliedronOpen]);

  useEffect(() => {
    const openMenus = () => [...document.querySelectorAll('details.poliedron-chat__options[open]')];
    const closeOutside = (event) => {
      for (const menu of openMenus()) if (!menu.contains(event.target)) menu.open = false;
    };
    const escape = (event) => {
      if (event.key !== 'Escape') return;
      for (const menu of openMenus()) {
        menu.open = false;
        menu.querySelector('summary')?.focus();
      }
    };
    document.addEventListener('pointerdown', closeOutside);
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('pointerdown', closeOutside);
      document.removeEventListener('keydown', escape);
    };
  }, []);

  const jumpToLatest = () => {
    nearBottomRef.current = true;
    setAwayFromBottom(false);
    const element = scrollRef.current;
    if (element) element.scrollTop = element.scrollHeight;
  };

  const handleScroll = () => {
    const element = scrollRef.current;
    if (!element) return;
    if (listHeightRef.current !== element.clientHeight && nearBottomRef.current) {
      element.scrollTop = element.scrollHeight;
    }
    listHeightRef.current = element.clientHeight;
    nearBottomRef.current =
      element.scrollHeight - element.scrollTop - element.clientHeight <= NEAR_BOTTOM_PX;
    setAwayFromBottom(!nearBottomRef.current);
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
    // POL-AI-008: un file senza testo parte con una richiesta predefinita.
    const value = draft.trim() || (attachment ? ATTACHMENT_ONLY_TEXT : '');
    if (attachmentPreparing) return;
    if (!value || sending || loading) return;
    if (!online || dictation.listening) return;
    setComposerError('');
    jumpToLatest();
    await submitChatDraft({
      text: value, lock: submitLock, send: onSend,
      clear: () => setDraft(''),
      restore: (original) => setDraft((current) => current || original),
      pending: (content) => setPendingUser({ content, afterId: messages.at(-1)?.id ?? 0 }),
      done: () => setPendingUser(null),
      fail: () => setComposerError('Invio non completato. Controlla la conversazione prima di riprovare.'),
    });
  };

  const closeMenus = () => {
    for (const menu of document.querySelectorAll('details.poliedron-chat__options[open]')) menu.open = false;
  };
  const install = phoneApp ? <PoliedronInstall /> : <PoliedronInstall href="/poliedron/?installa=1" />;
  const optionsMenu = (
    <details ref={menuRef} className="poliedron-chat__options">
      <summary aria-label="Opzioni chat"><svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="12" cy="5" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="12" cy="19" r="2"/></svg></summary>
      <div className="poliedron-chat__options-panel">
        {loadActivity && <button type="button" onClick={() => { closeMenus(); setOpenChat('poliedron'); setShowActivity((v) => !poliedronOpen || !v); }} aria-pressed={showActivity}>Registro attività</button>}
        {install}
        {navItems.length > 0 && <nav aria-label="Moduli dello studio">
          <small>Apri nello studio</small>
          {navItems.map((item) => <button key={item.id} type="button" onClick={() => { closeMenus(); onNavigate?.(item.id); }}>{item.label}</button>)}
        </nav>}
      </div>
    </details>
  );
  const time = (value) => {
    if (!value) return '';
    const d = new Date(value);
    return d.toDateString() === new Date().toDateString()
      ? formatTime(value)
      : new Intl.DateTimeFormat('it-IT', { day: '2-digit', month: '2-digit' }).format(d);
  };
  const lastPoliedron = messages.at(-1);
  const rows = [
    { key: 'poliedron', label: 'Poliedron', avatar: <span className="poliedron-wa__gem"><img src={poliedroGem} width="48" height="48" alt="" /></span>,
      preview: lastPoliedron ? `${lastPoliedron.role === 'user' ? 'Tu: ' : ''}${lastPoliedron.content}` : 'Assistente dello studio: agenda, pazienti, richiami', at: lastPoliedron?.created_at },
    ...(askTeam ? team.contacts.map((c) => {
      const last = (team.state.threads[contactKey(c)] || []).at(-1);
      return {
        key: contactKey(c), label: c.label, avatar: <TeamAvatar contact={c} />,
        preview: last ? `${last.role === 'user' ? 'Tu: ' : ''}${last.content}` : c.kind === 'group' ? `Gruppo · ${c.description}` : c.description,
        at: last?.at,
      };
    }) : []),
    ...Object.entries(team.state.threads)
      .filter(([key, thread]) => patientIdFromKey(key) && thread?.length)
      .map(([key, thread]) => {
        const patient = patients.find((p) => String(p.id) === patientIdFromKey(key));
        if (!patient) return null;
        const last = thread.at(-1);
        return { key, label: patientName(patient), avatar: <PatientAvatar patient={patient} />, preview: `Tu: ${last.content}`, at: last.at };
      })
      .filter(Boolean)
      .sort((x, y) => String(y.at).localeCompare(String(x.at))),
  ];

  // WhatsApp-style dock for the chat list: Chat plus the studio's daily
  // places; Studio opens the full management app (Home).
  // Dock: Chat and Pazienti stay inside Poliedron (chats and the patient
  // book); Agenda, Richiami and Studio open the studio app.
  const DOCK_LINKS = [
    { id: 'agenda', label: 'Agenda', icon: 'cal' },
    { id: 'richiami', label: 'Richiami', icon: 'clk' },
    { id: 'home', label: 'Studio', icon: 'home' },
  ].filter((item) => navItems.some((nav) => nav.id === item.id));
  const dock = compact && (
    <nav className="poliedron-wa__dock" aria-label="Navigazione">
      <button type="button" className={newChat !== 'rubrica' ? 'is-active' : undefined} aria-current={newChat !== 'rubrica' ? 'page' : undefined} onClick={() => setNewChat(null)}><Ic n="chat" s={22} /><span>Chat</span></button>
      <button type="button" onClick={() => onNavigate?.('agenda')} hidden={!DOCK_LINKS.some((l) => l.id === 'agenda')}><Ic n="cal" s={22} /><span>Agenda</span></button>
      <button type="button" className={newChat === 'rubrica' ? 'is-active' : undefined} aria-current={newChat === 'rubrica' ? 'page' : undefined} onClick={() => setNewChat('rubrica')}><Ic n="pz" s={22} /><span>Pazienti</span></button>
      {DOCK_LINKS.filter((l) => l.id !== 'agenda').map((item) => (
        <button key={item.id} type="button" onClick={() => onNavigate?.(item.id)}><Ic n={item.icon} s={22} /><span>{item.label}</span></button>
      ))}
    </nav>
  );
  const needle = search.trim().toLowerCase();
  const kindOf = (key) => (key.startsWith('group:') ? 'gruppi' : key.startsWith('assistant:') ? 'team' : key.startsWith('patient:') ? 'pazienti' : 'tutte');
  const visibleRows = rows.filter((row) => {
    if (filter !== 'tutte' && kindOf(row.key) !== filter) return false;
    return !needle || `${row.label} ${row.preview}`.toLowerCase().includes(needle);
  });
  const groupCount = rows.filter((row) => row.key.startsWith('group:')).length;
  const rowByKey = Object.fromEntries(rows.map((row) => [row.key, row]));
  const foundPatients = needle ? searchPatients(patients, search, 10) : [];
  const foundMessages = needle ? searchMessages({ poliedron: messages, ...team.state.threads }, search, 30).filter((hit) => rowByKey[hit.key]) : [];
  const foundSections = needle.length >= 2 ? navItems.filter((item) => item.label.toLowerCase().includes(needle)).slice(0, 5) : [];
  const openPatient = (patient) => { setNewChat(null); setPatientQuery(''); setOpenChat(patientChatKey(patient.id)); };
  const rowButton = (row, extra = null) => (
    <button
      type="button"
      className="poliedron-wa__row"
      aria-label={`Chat con ${row.label}`}
      aria-current={activeChat === row.key ? 'true' : undefined}
      onClick={() => { setOpenChat(row.key); setNewChat(null); }}
    >
      {row.avatar}
      <span className="poliedron-wa__row-text">
        <span className="poliedron-wa__row-top">
          <strong>{row.label}</strong>
          {row.at && <time dateTime={row.at}>{time(row.at)}</time>}
        </span>
        <small>{extra ?? row.preview}</small>
      </span>
    </button>
  );
  // A patient found anywhere: write in chat or open the patient record.
  const patientRow = (p) => (
    <div className="poliedron-wa__row poliedron-wa__patient">
      <PatientAvatar patient={p} />
      <span className="poliedron-wa__row-text">
        <span className="poliedron-wa__row-top"><strong>{patientName(p)}</strong></span>
        <small>{p.telefono ? `${p.telefono}${p.consensoWhatsapp ? '' : ' · senza consenso WhatsApp'}` : 'Nessun telefono'}</small>
      </span>
      <span className="poliedron-wa__patient-actions">
        <button type="button" onClick={() => openPatient(p)} aria-label={`Scrivi a ${patientName(p)}`}><Ic n="chat" s={18} /><span>Chat</span></button>
        {onOpenPatient && <button type="button" onClick={() => onOpenPatient(p)} aria-label={`Apri la scheda di ${patientName(p)}`}><Ic n="file" s={18} /><span>Scheda</span></button>}
      </span>
    </div>
  );
  const searchField = (value, setValue, placeholder, label, autoFocus = false) => (
    <label className="poliedron-wa__search">
      <Ic n="srch" s={18} />
      <input type="search" autoFocus={autoFocus} value={value} onChange={(e) => setValue(e.target.value)} placeholder={placeholder} aria-label={label} enterKeyHint="search" />
      {value && (
        <button
          type="button"
          className="poliedron-wa__clear"
          aria-label="Cancella la ricerca"
          onPointerDown={(e) => e.preventDefault()}
          onClick={(e) => { setValue(''); e.currentTarget.parentElement.querySelector('input')?.focus(); }}
        >
          <Ic n="x" s={14} c="#fff" />
        </button>
      )}
    </label>
  );
  const subHeader = (title, subtitle, onBack) => (
    <header className="poliedron-chat__header">
      <button type="button" className="poliedron-wa__back" onClick={onBack} aria-label="Indietro"><Ic n="back" s={20} /></button>
      <div className="poliedron-chat__header-text">
        <h1>{title}</h1>
        {subtitle && <p>{subtitle}</p>}
      </div>
    </header>
  );
  const sortedPatients = (list) => [...list].sort((x, y) => `${x.cognome || ''} ${x.nome || ''}`.localeCompare(`${y.cognome || ''} ${y.nome || ''}`, 'it'));

  let chatList;
  if (newChat === 'group') {
    chatList = (
      <aside className="poliedron-wa__list" aria-label="Nuovo gruppo">
        {subHeader('Nuovo gruppo', 'Il Clinic Manager coordina gli specialisti scelti', () => setNewChat('menu'))}
        <div className="poliedron-wa__rows">
          <div className="poliedron-wa__form">
            <GroupForm
              onCancel={() => setNewChat('menu')}
              onCreate={(data) => { const key = team.createGroup(data); setNewChat(null); setOpenChat(key); }}
            />
          </div>
        </div>
      </aside>
    );
  } else if (newChat === 'patient' || newChat === 'rubrica') {
    const rubrica = newChat === 'rubrica';
    const list = sortedPatients(searchPatients(patients, patientQuery, patientQuery.trim() ? 60 : 100000)).slice(0, 200);
    chatList = (
      <aside className="poliedron-wa__list" aria-label={rubrica ? 'Pazienti' : 'Scrivi a un paziente'}>
        {rubrica ? (
          <div className="poliedron-wa__topbar">
            <div className="poliedron-wa__menu-left">{optionsMenu}</div>
          </div>
        ) : subHeader('Scrivi a un paziente', 'Il messaggio parte dal WhatsApp dello studio', () => setNewChat('menu'))}
        <div className="poliedron-wa__rows">
          {rubrica && <h1 className="poliedron-wa__title">Pazienti</h1>}
          {searchField(patientQuery, setPatientQuery, 'Cerca per nome o telefono', 'Cerca paziente', !rubrica)}
          <ul>
            {list.map((p) => <li key={p.id}>{patientRow(p)}</li>)}
            {!list.length && <li className="poliedron-wa__none">{patients.length ? 'Nessun paziente trovato.' : 'Carico i pazienti…'}</li>}
          </ul>
          {list.length === 200 && <p className="poliedron-wa__none">Scrivi un nome per vedere gli altri pazienti.</p>}
        </div>
        {rubrica && dock}
      </aside>
    );
  } else if (newChat === 'menu') {
    const entry = (icon, label, detail, onClick) => (
      <li>
        <button type="button" className="poliedron-wa__row" onClick={onClick}>
          <span className="poliedron-team__avatar" data-kind="action" aria-hidden="true"><Ic n={icon} s={20} /></span>
          <span className="poliedron-wa__row-text">
            <span className="poliedron-wa__row-top"><strong>{label}</strong></span>
            <small>{detail}</small>
          </span>
        </button>
      </li>
    );
    chatList = (
      <aside className="poliedron-wa__list" aria-label="Nuova chat">
        {subHeader('Nuova chat', null, () => setNewChat(null))}
        <div className="poliedron-wa__rows">
          <ul>
            {entry('wa', 'Scrivi a un paziente', 'Messaggio WhatsApp dal numero dello studio', () => setNewChat('patient'))}
            {askTeam && entry('users', 'Nuovo gruppo', 'Più specialisti con un obiettivo comune', () => setNewChat('group'))}
          </ul>
          <h2 className="poliedron-wa__section">Assistenti</h2>
          <ul>
            {rows.filter((row) => row.key === 'poliedron' || row.key.startsWith('assistant:')).map((row) => <li key={row.key}>{rowButton(row)}</li>)}
          </ul>
        </div>
      </aside>
    );
  } else {
    chatList = (
      <aside className="poliedron-wa__list" aria-label="Elenco chat">
        <div className="poliedron-wa__topbar">
          <div className="poliedron-wa__menu-left">{optionsMenu}</div>
          <button type="button" className="poliedron-wa__new" aria-label="Nuova chat" onClick={() => setNewChat('menu')}>
            <Ic n="plus" s={24} c="#fff" />
          </button>
        </div>
        <div className="poliedron-wa__rows">
          <h1 className="poliedron-wa__title">{phoneApp ? 'Poliedron' : 'Chat'}</h1>
          {searchField(search, setSearch, 'Cerca pazienti, chat, messaggi…', 'Cerca nelle chat')}
          {!needle && (
            <div className="poliedron-wa__chips" role="group" aria-label="Filtra le chat">
              {[['tutte', 'Tutte'], ['team', 'Team'], ['pazienti', 'Pazienti'], ['gruppi', groupCount ? `Gruppi ${groupCount}` : 'Gruppi']].map(([id, label]) => (
                <button key={id} type="button" aria-pressed={filter === id} onClick={() => setFilter(id)}>{label}</button>
              ))}
            </div>
          )}
          {foundPatients.length > 0 && (
            <>
              <h2 className="poliedron-wa__section">Pazienti</h2>
              <ul>{foundPatients.map((p) => <li key={`p-${p.id}`}>{patientRow(p)}</li>)}</ul>
            </>
          )}
          {needle && visibleRows.length > 0 && <h2 className="poliedron-wa__section">Chat</h2>}
          <ul>
            {visibleRows.map((row) => <li key={row.key}>{rowButton(row)}</li>)}
            {!visibleRows.length && !needle && (
              <li className="poliedron-wa__none">
                {filter === 'gruppi' ? 'Nessun gruppo: tocca + per crearne uno.' : filter === 'pazienti' ? 'Nessuna chat con pazienti: tocca + e scegli "Scrivi a un paziente".' : 'Nessuna chat.'}
              </li>
            )}
          </ul>
          {foundMessages.length > 0 && (
            <>
              <h2 className="poliedron-wa__section">Messaggi</h2>
              <ul>
                {foundMessages.map((hit) => <li key={`${hit.key}-${hit.id}`}>{rowButton({ ...rowByKey[hit.key], at: hit.at }, hit.content)}</li>)}
              </ul>
            </>
          )}
          {foundSections.length > 0 && (
            <>
              <h2 className="poliedron-wa__section">Nello studio</h2>
              <ul>
                {foundSections.map((item) => (
                  <li key={`s-${item.id}`}>
                    <button type="button" className="poliedron-wa__row" onClick={() => onNavigate?.(item.id)} aria-label={`Apri ${item.label}`}>
                      <span className="poliedron-team__avatar" data-kind="action" aria-hidden="true"><Ic n={item.icon || 'home'} s={20} /></span>
                      <span className="poliedron-wa__row-text">
                        <span className="poliedron-wa__row-top"><strong>{item.label}</strong></span>
                        <small>Apri nello studio</small>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
          {needle && !foundPatients.length && !visibleRows.length && !foundMessages.length && !foundSections.length && (
            <p className="poliedron-wa__none">Nessun risultato per "{search.trim()}".</p>
          )}
        </div>
        {dock}
      </aside>
    );
  }

  const poliedronPane = (
    <>
      <header className="poliedron-chat__header">
        {compact && <button type="button" className="poliedron-wa__back" onClick={() => setOpenChat(null)} aria-label="Torna alle chat"><Ic n="back" s={20} /></button>}
        <span className="poliedron-chat__brand"><img src={poliedroGem} width="40" height="40" alt="" /></span>
        <div className="poliedron-chat__header-text">
          <h1>Poliedron</h1>
          <p>{!online ? 'Connessione assente' : sending ? 'Sto verificando…' : 'Assistente dello studio'}</p>
        </div>
        {memoryClient && (
          <button
            type="button"
            className="poliedron-chat__memory-toggle"
            onClick={() => setMemoriaAperta((aperta) => !aperta)}
            aria-expanded={memoriaAperta}
            aria-label="Cosa ricorda Poliedron"
            title="Cosa ricorda Poliedron"
          >
            <Ic n="book" s={16} />
          </button>
        )}
        {compact && optionsMenu}
        {!compact && loadActivity && (
          <button
            type="button"
            className="poliedron-chat__activity-toggle"
            aria-pressed={showActivity}
            onClick={() => setShowActivity((v) => !v)}
          >
            Attività di Poliedron
          </button>
        )}
      </header>

      {showActivity && loadActivity && (
        <PoliedronAttivita load={loadActivity} onRestore={restoreActivity} onClose={() => setShowActivity(false)} />
      )}

      {memoryClient && memoriaAperta && (
        <PoliedronMemoryPanel client={memoryClient} onClose={() => setMemoriaAperta(false)} />
      )}

      <div className="poliedron-chat__timeline">
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
            <p>Scrivi cosa vuoi fare. Puoi gestire appuntamenti, pazienti, note e richiami.</p>
          </div>
        )}

        {messages.map((message, index) => (
          <React.Fragment key={message.id}>
          {phoneApp && dayKey(message.created_at) !== dayKey(messages[index - 1]?.created_at) && <div className="poliedron-chat__date"><time dateTime={message.created_at}>{dayLabel(message.created_at)}</time></div>}
          <article
            key={message.id}
            className={`poliedron-chat__message is-${message.role}${message.delivery_status === 'failed' ? ' is-failed' : ''}`}
          >
            {message.role !== 'user' && (
              <span className="poliedron-chat__avatar"><Ic n="spark" s={13} /></span>
            )}
            <div className="poliedron-chat__bubble">
              <div>{message.content}</div>
              {message.metadata?.allegato && (
                <div className="poliedron-chat__attachment-tag">
                  <Ic n="attach" s={12} />
                  <span>{message.metadata.allegato.nome || 'File allegato'}</span>
                </div>
              )}
              <footer>
                <time dateTime={message.created_at}>{formatTime(message.created_at)}</time>
                {message.role === 'user' && message.delivery_status === 'pending' && (
                  sending
                    ? <span>Invio…</span>
                    : <button type="button" onClick={() => onRetry(message)} disabled={!online || Boolean(pendingUser)}>Riprova</button>
                )}
                {message.delivery_status === 'failed' && (
                  <button type="button" onClick={() => onRetry(message)} disabled={sending || !online || Boolean(pendingUser)}>
                    Riprova
                  </button>
                )}
              </footer>
            </div>
          </article>
          </React.Fragment>
        ))}

        {pendingUser && !messages.some((message) => message.id > pendingUser.afterId && message.role === 'user' && message.content === pendingUser.content) && (
          <article className="poliedron-chat__message is-user is-pending" aria-label="Messaggio in invio">
            <div className="poliedron-chat__bubble"><div>{pendingUser.content}</div><footer>Invio…</footer></div>
          </article>
        )}

        <StructuredResult
          attachment={attachment}
          patients={patients}
          attachmentSaving={attachmentSaving}
          onSaveAttachment={onSaveAttachment}
          onCancelSaveAttachment={onCancelSaveAttachment}
          onModelConfirmation={onModelConfirmation}
          state={structuredState}
          onSelectResult={onSelectResult}
          onConfirmAction={onConfirmAction}
          onModifyAction={onModifyAction}
          onConfirmActionPlan={onConfirmActionPlan}
          actionRunning={actionRunning}
          actionRunResult={actionRunResult}
        />

        {(sending || pendingUser) && (
          <div className="poliedron-chat__typing">
            <span /><span /><span />
            <small>Poliedron sta verificando…</small>
          </div>
        )}
      </div>
      {awayFromBottom && <button type="button" className="poliedron-chat__latest" onClick={jumpToLatest} aria-label="Vai agli ultimi messaggi"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg></button>}
      </div>

      <div className="poliedron-chat__composer">
        {!online && <div className="poliedron-chat__notice" role="status">Sei offline. Il messaggio resta qui: invialo quando torna la connessione.</div>}
        {(composerError || dictation.notice || dictation.listening) && <div className="poliedron-chat__notice" role="status">{composerError || dictation.notice || 'Ti ascolto… Tocca di nuovo il microfono per terminare.'}</div>}
        {error && (
          <div className="poliedron-chat__error" role="alert" data-kind={errorKind || 'generic'}>
            <span>{error}</span>
            {onRetryInitialization && (
              <button type="button" onClick={onRetryInitialization}>Riprova</button>
            )}
          </div>
        )}
        {(attachment || attachmentPreparing) && (
          <div className="poliedron-chat__attachment" aria-live="polite">
            <Ic n="file" s={15} />
            <span className="poliedron-chat__attachment-name">
              {attachmentPreparing ? 'Preparo il file…' : attachment.inUse ? `In uso: ${attachment.name}` : attachment.name}
            </span>
            {attachment && !attachmentPreparing && (
              <>
                <small>{formatAttachmentSize(attachment.size)}</small>
                {onRequestSaveAttachment && (
                  <button type="button" className="poliedron-chat__attachment-save" onClick={onRequestSaveAttachment} disabled={sending || attachmentSaving} aria-label="Salva nella scheda del paziente" title="Salva nella scheda del paziente">
                    <Ic n="folder" s={14} />
                  </button>
                )}
                <button type="button" onClick={onRemoveAttachment} disabled={sending} aria-label={attachment.inUse ? 'Smetti di usare il file' : 'Rimuovi allegato'}>
                  <Ic n="x" s={14} />
                </button>
              </>
            )}
          </div>
        )}
        <div className="poliedron-chat__composer-row">
          <input
            ref={fileInputRef}
            type="file"
            accept={ATTACHMENT_ACCEPT}
            hidden
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = '';
              if (file) onAttachFile?.(file);
            }}
          />
          {onAttachFile && (
            <button
              type="button"
              className="poliedron-chat__attach"
              onClick={() => fileInputRef.current?.click()}
              disabled={loading || sending || attachmentPreparing || Boolean(pendingUser)}
              aria-label="Allega un PDF o una foto"
              title="Allega un PDF o una foto"
            >
              <Ic n="attach" s={18} />
            </button>
          )}
          <textarea
            ref={textareaRef}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
                event.preventDefault();
                submit();
              }
            }}
            rows={1}
            maxLength={16000}
            placeholder={attachment ? 'Cosa vuoi sapere dal file?' : 'Scrivi o detta a Poliedron…'}
            aria-label="Messaggio per Poliedron"
            enterKeyHint="send"
            disabled={loading}
          />
          <button type="button" className="poliedron-chat__mic" onClick={dictation.toggle} disabled={loading || sending || Boolean(pendingUser) || !online} aria-label={dictation.listening ? 'Termina dettatura' : 'Detta messaggio'} aria-pressed={dictation.listening}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><rect x="9" y="2" width="6" height="12" rx="3"/><path d="M5 10v2a7 7 0 0 0 14 0v-2M12 19v3M8 22h8"/></svg>
          </button>
          <button
            type="button"
            className="poliedron-chat__send"
            onPointerDown={(event) => { if (event.pointerType !== 'mouse' && document.activeElement === textareaRef.current) event.preventDefault(); }}
            onClick={submit}
            disabled={sendDisabled}
            aria-label="Invia messaggio"
            aria-busy={sending}
            data-sending={sending || undefined}
          >
            <Ic n="send" s={18} c="#fff" />
          </button>
        </div>
      </div>
    </>
  );

  return (
    <section
      className={`poliedron-chat poliedron-wa${compact ? ' poliedron-chat--phone is-compact' : ''}`}
      aria-label="Chat Poliedron"
      data-surface-status={surfaceStatus || undefined}
    >
      {(!compact || !activeChat) && chatList}
      {activeChat && (
        <div className="poliedron-wa__pane">
          {poliedronOpen ? poliedronPane : activePatient ? (
            <PatientThread key={activeChat} patient={activePatient} team={team} onBack={compact ? () => setOpenChat(null) : null} onOpenPatient={onOpenPatient} />
          ) : activeContact ? (
            <TeamThread
              key={activeChat}
              contact={activeContact}
              team={team}
              ask={askTeam}
              onBack={compact ? () => setOpenChat(null) : null}
              onDeleteGroup={(id) => { team.deleteGroup(id); setOpenChat(null); }}
            />
          ) : null}
        </div>
      )}
    </section>
  );
}
