import React, { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import ReactDOM from 'react-dom';
import PoliedronEdgeDock from './PoliedronEdgeDock';
import PoliedronMobileDock from './PoliedronMobileDock';
import PoliedronBell from './PoliedronBell';
import PoliedronPanel from './PoliedronPanel';
import PoliedronChatPage from './PoliedronChatPage';
import usePoliedronConversation from './usePoliedronConversation';
import { NAVIGATION_INDEX } from '../../lib/poliedron/navigationIndex';
import { buildIntelligencePermissions, filterNavigationIndex, isActionAllowed } from '../../lib/poliedron/permissionEngine';
import { ACTION_REGISTRY } from '../../lib/poliedron/actionRegistry';
import { buildContext } from '../../lib/poliedron/contextEngine';
import { processQuery } from '../../lib/poliedron/poliedraCore';
import { runActionPlan } from '../../lib/poliedron/planner/actionExecutor';
import {
  createChatRequestId,
  normalizeModelHistory,
} from '../../lib/poliedron/conversationRepository.js';
import { DB } from '../../lib/supabase.js';

const summarizeStructuredResult = (result) => {
  if (result?.answer) return result.answer;
  if (result?.directNavigation) return null;
  if (result?.actionPlan) {
    const steps = result.actionPlan.steps?.length || 0;
    const stepNames = (result.actionPlan.steps || [])
      .map((step) => step.type)
      .filter(Boolean)
      .slice(0, 5);
    return [
      `Ho preparato un piano d'azione${steps ? ` con ${steps} passaggi` : ''}.`,
      stepNames.length ? `Passaggi: ${stepNames.join(', ')}.` : '',
      'Per sicurezza, l’esecuzione richiede sempre una nuova conferma esplicita nella sessione attiva.',
    ].filter(Boolean).join(' ');
  }
  if (result?.intelligence) {
    const groups = result.intelligence.groups || result.intelligence.results || [];
    const count = Array.isArray(groups)
      ? groups.reduce((total, group) => total + (group.items?.length || 0), 0)
      : 0;
    return `Ho completato l’analisi sui dati autorevoli disponibili${count ? ` e trovato ${count} elementi` : ''}.`;
  }
  if (result?.confirmationRequired) {
    const actions = (result.suggestedActions || []).map((action) => action.label).filter(Boolean).slice(0, 3);
    return actions.length
      ? `Ho preparato la richiesta: ${actions.join(', ')}. L’azione richiede una nuova conferma esplicita nella sessione attiva.`
      : 'Ho preparato la richiesta. L’azione richiede una nuova conferma esplicita nella sessione attiva.';
  }
  const labels = (result?.searchResults || [])
    .flatMap((group) => group.items || [])
    .map((item) => item.label)
    .filter(Boolean)
    .slice(0, 5);
  if (labels.length) return `Ho trovato: ${labels.join(', ')}.`;
  return 'Ho elaborato la richiesta con le funzioni attualmente disponibili a Polyedron.';
};

/* POL-AI-001 §33 / POL-AI-002A §16-17 — mounted exactly once by App.jsx,
   survives every page change. This is the only file that talks to the
   other poliedron/* modules; PoliedronOrb (mobile) / PoliedronEdgeDock
   (desktop) / Panel/*.jsx below it are pure UI. Both triggers open this
   SAME component's state/panel — never two AI systems (§16 same
   identity, one Poliedra AI Core). */
export default function Poliedron({
  isMobile, page, setPage, patients, plans, payments, pricelist, appointments, richiami, impegni, goSchedaPaz,
  features, isStudioAdmin, vertical, studioId, userId, currentPatient,
  quickActionCtx, supabaseClient, onArchivioFilterHint, openPrescription, openNew, openBooking,
  externalCommandRequest, onExternalCommandHandled, chatHost,
  /* POL-CHAT-001 merge: PR #51 declared an `unreadCount = 0` PROP here
     because §7 explicitly shipped the bell without a notification engine.
     PR #53 supplies the real producer — the conversation hook below returns
     an authoritative `unreadCount` from the persisted conversation —
     so the placeholder prop is deliberately gone: keeping it would shadow
     the real value and re-freeze the badge at 0. */
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [state, setState] = useState(null);
  const [loading, setLoading] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  // POL-AI-005B: outcome of the last runActionPlan() call — null while
  // idle/previewing, then { outcome, completedSteps, failedStep,
  // recoveryActions } once the user has confirmed and execution finished.
  const [panelActionRunResult, setPanelActionRunResult] = useState(null);
  const [panelActionRunning, setPanelActionRunning] = useState(false);
  const [chatActionRunResult, setChatActionRunResult] = useState(null);
  const [chatActionRunning, setChatActionRunning] = useState(false);
  const [externalContext, setExternalContext] = useState(null);
  const [chatStructuredState, setChatStructuredState] = useState(null);
  const [chatSending, setChatSending] = useState(false);
  const [chatError, setChatError] = useState('');
  const inputRef = useRef(null);
  const panelId = useId();
  const requestSeq = useRef(0);
  const previewTimerRef = useRef(null);
  const persistedRequestRef = useRef(false);
  const actionExecutionRef = useRef(false);
  const pendingPanelRequestRef = useRef(null);
  const pendingChatRequestRef = useRef(null);
  const pageRef = useRef(page);
  const openRef = useRef(open);
  const conversationMessagesRef = useRef([]);
  const {
    conversation: primaryConversation,
    messages: conversationMessages,
    hasOlder: conversationHasOlder,
    loading: conversationLoading,
    loadingOlder: conversationLoadingOlder,
    unreadCount,
    error: conversationError,
    loadOlder: loadOlderMessages,
    appendMessage,
    setDeliveryStatus,
    markVisibleMessagesRead,
    retryInitialization,
  } = usePoliedronConversation({
    client: supabaseClient,
    studioId,
    userId,
  });

  const permissionCtx = useMemo(() => ({ features, isStudioAdmin }), [features, isStudioAdmin]);

  const navigationIndex = useMemo(() => filterNavigationIndex(NAVIGATION_INDEX, permissionCtx), [permissionCtx]);
  const actions = useMemo(
    () => ACTION_REGISTRY.filter((a) => isActionAllowed(a, { ...permissionCtx, quickActionCtx })),
    [permissionCtx, quickActionCtx]
  );
  const intelligencePermissions = useMemo(
    () => buildIntelligencePermissions(quickActionCtx?.permissions),
    [quickActionCtx?.permissions]
  );

  const context = useMemo(
    () => buildContext({
      page,
      vertical,
      studioId,
      currentPatient: externalContext?.patient || currentPatient,
      currentAppointment: externalContext?.appointment || null,
      isStudioAdmin,
      features,
    }),
    [page, vertical, studioId, currentPatient, externalContext, isStudioAdmin, features]
  );

  const processPermissions = useMemo(() => ({
    managementControl: permissionCtx.features?.controllo_gestione === true && !!isStudioAdmin,
    intelligence: intelligencePermissions,
    homePermissions: quickActionCtx?.permissions || {},
  }), [permissionCtx, intelligencePermissions, isStudioAdmin, quickActionCtx]);

  const processSources = useMemo(() => ({
    patients,
    plans,
    payments,
    pricelist,
    appointments,
    recalls: richiami,
    activities: impegni,
    navigationIndex,
    actions,
  }), [patients, plans, payments, pricelist, appointments, richiami, impegni, navigationIndex, actions]);

  useEffect(() => {
    pageRef.current = page;
  }, [page]);

  useEffect(() => {
    openRef.current = open;
  }, [open]);

  useEffect(() => {
    conversationMessagesRef.current = conversationMessages;
  }, [conversationMessages]);

  // §25 — Cmd/Ctrl+K opens Poliedron from anywhere, desktop only per spec
  // (mobile stays touch-first). Registered at document level so it works
  // regardless of which page/element currently has focus.
  useEffect(() => {
    if (isMobile) return undefined;
    const onKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen(true);
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [isMobile]);

  const close = useCallback(() => {
    if (previewTimerRef.current) clearTimeout(previewTimerRef.current);
    requestSeq.current += 1;
    setOpen(false);
    setQuery('');
    setState(null);
    setPanelActionRunResult(null);
    setExternalContext(null);
  }, []);

  const processRequest = useCallback((q, { allowModel = false, conversationHistory = [] } = {}) =>
    processQuery({
      query: q,
      context,
      permissions: processPermissions,
      sources: processSources,
      conversationHistory,
      supabaseClient,
      allowModel,
    }), [context, processPermissions, processSources, supabaseClient]);

  const executePersistedQuery = useCallback(async (
    q,
    { retryMessage = null, requestId: retainedRequestId = null, readAssistant = false } = {}
  ) => {
    const requestId = retryMessage?.request_id || retainedRequestId || createChatRequestId();
    let userMessage = retryMessage;
    if (retryMessage) {
      userMessage = await setDeliveryStatus(retryMessage.id, 'pending');
    } else {
      userMessage = await appendMessage({
        requestId,
        role: 'user',
        content: q,
        deliveryStatus: 'pending',
      });
    }

    try {
      const result = await processRequest(q, {
        allowModel: true,
        conversationHistory: normalizeModelHistory(conversationMessagesRef.current, {
          excludeRequestId: requestId,
        }),
      });
      if (result.modelError) throw new Error(result.modelError);

      let assistantText = summarizeStructuredResult(result);
      if (!assistantText && result.directNavigation) {
        const destination = navigationIndex.find((item) => item.id === result.directNavigation.navId);
        assistantText = destination ? `Apro ${destination.label}.` : 'Apro la sezione richiesta.';
      }
      if (assistantText) {
        await appendMessage({
          requestId,
          role: 'assistant',
          content: assistantText,
          deliveryStatus: 'sent',
          readAt: (typeof readAssistant === 'function' ? readAssistant() : readAssistant)
            ? new Date().toISOString()
            : null,
          metadata: { intent: result.intent || null },
        });
      }
      await setDeliveryStatus(userMessage.id, 'sent');
      return result;
    } catch (nextError) {
      await setDeliveryStatus(userMessage.id, 'failed');
      throw nextError;
    }
  }, [appendMessage, navigationIndex, processRequest, setDeliveryStatus]);

  const runPersistedRequest = useCallback(async (q, options = {}) => {
    if (!primaryConversation?.id) throw new Error('CHAT_CONVERSATION_NOT_READY');
    if (persistedRequestRef.current) throw new Error('CHAT_REQUEST_IN_PROGRESS');
    persistedRequestRef.current = true;
    setChatSending(true);
    try {
      return await executePersistedQuery(q, options);
    } finally {
      persistedRequestRef.current = false;
      setChatSending(false);
    }
  }, [executePersistedQuery, primaryConversation?.id]);

  const applyQuickResult = useCallback((result) => {
    if (result.directNavigation) {
      const { navId, filtroTipo } = result.directNavigation;
      if (navId === 'archivio') onArchivioFilterHint?.(filtroTipo || 'tutti');
      setPage(navId);
      setLoading(false);
      close();
      return;
    }
    setPanelActionRunResult(null);
    setState(result);
    setHighlightedIndex(0);
    setLoading(false);
  }, [close, onArchivioFilterHint, setPage]);

  const runQuery = useCallback((q, { allowModel = false, persist = false } = {}) => {
    if (actionExecutionRef.current) return;
    const seq = ++requestSeq.current;
    setLoading(true);
    let retainedRequest = null;
    if (persist) {
      retainedRequest = pendingPanelRequestRef.current?.content === q
        ? pendingPanelRequestRef.current
        : { content: q, requestId: createChatRequestId() };
      pendingPanelRequestRef.current = retainedRequest;
    }
    const request = persist
      ? runPersistedRequest(q, {
          requestId: retainedRequest.requestId,
          readAssistant: () => requestSeq.current === seq && openRef.current,
        })
      : processRequest(q, { allowModel });
    request.then((result) => {
      if (persist && pendingPanelRequestRef.current?.requestId === retainedRequest.requestId) {
        pendingPanelRequestRef.current = null;
      }
      if (seq !== requestSeq.current) return; // stale response from an earlier keystroke — dropped
      applyQuickResult(result);
    }).catch(() => {
      if (seq !== requestSeq.current) return;
      setState({ answer: 'Non riesco a completare la richiesta in questo momento. Riprova.' });
      setLoading(false);
    });
  }, [applyQuickResult, processRequest, runPersistedRequest]);

  const runChatMessage = useCallback(async (text, retryMessage = null) => {
    if (persistedRequestRef.current || actionExecutionRef.current || !primaryConversation?.id) {
      setChatError(
        actionExecutionRef.current
          ? 'Attendi il completamento del piano d’azione in corso.'
          : primaryConversation?.id
          ? 'Attendi il completamento della richiesta in corso.'
          : 'La conversazione si sta ancora caricando. Riprova tra poco.'
      );
      return false;
    }
    setChatError('');
    setChatStructuredState(null);
    setChatActionRunResult(null);
    const retainedRequest = retryMessage
      ? { content: text, requestId: retryMessage.request_id }
      : pendingChatRequestRef.current?.content === text
        ? pendingChatRequestRef.current
        : { content: text, requestId: createChatRequestId() };
    pendingChatRequestRef.current = retainedRequest;
    try {
      const result = await runPersistedRequest(text, {
        retryMessage,
        requestId: retainedRequest.requestId,
        readAssistant: () => pageRef.current === 'chat',
      });
      if (pendingChatRequestRef.current?.requestId === retainedRequest.requestId) {
        pendingChatRequestRef.current = null;
      }
      if (result.directNavigation) {
        const { navId, filtroTipo } = result.directNavigation;
        if (navId === 'archivio') onArchivioFilterHint?.(filtroTipo || 'tutti');
        setPage(navId);
      } else if (!result.answer) {
        setChatStructuredState(result);
      }
      return true;
    } catch {
      setChatError('Non riesco a completare la richiesta. Controlla la connessione e riprova.');
      return false;
    }
  }, [onArchivioFilterHint, primaryConversation?.id, runPersistedRequest, setPage]);

  /** POL-AI-005B §CONFIRM: called only from an explicit user click on the
   *  Level-2 preview's Confirm button — never automatically. Re-loads
   *  `patients` fresh is the caller's job in principle, but since this
   *  component already holds live, subscription-synced `patients`/`plans`/
   *  `payments` (see App.jsx's postgres_changes channel), the current
   *  props ARE the freshest available snapshot at click time — passed
   *  straight through, satisfying runActionPlan's "must not be a stale
   *  preview snapshot" contract without a redundant extra fetch. */
  const executeActionPlan = useCallback(async (plan, setRunning, setResult) => {
    if (actionExecutionRef.current) return;
    actionExecutionRef.current = true;
    setRunning(true);
    try {
      const result = await runActionPlan(plan, { db: DB, patients, homePermissions: quickActionCtx?.permissions || {}, studioId });
      setResult(result);
    } finally {
      actionExecutionRef.current = false;
      setRunning(false);
    }
  }, [patients, quickActionCtx, studioId]);

  const handleConfirmPanelActionPlan = useCallback(
    (plan) => executeActionPlan(plan, setPanelActionRunning, setPanelActionRunResult),
    [executeActionPlan]
  );

  const handleConfirmChatActionPlan = useCallback(
    (plan) => executeActionPlan(plan, setChatActionRunning, setChatActionRunResult),
    [executeActionPlan]
  );

  useEffect(() => {
    if (!open) return;
    previewTimerRef.current = setTimeout(() => runQuery(query), query ? 150 : 0); // §7 live search, light debounce only while typing
    return () => {
      if (previewTimerRef.current) clearTimeout(previewTimerRef.current);
    };
  }, [query, open, runQuery]);

  const handleQueryChange = useCallback((value) => {
    if (actionExecutionRef.current) return;
    requestSeq.current += 1;
    setQuery(value);
    setLoading(false);
    setState(null);
    setPanelActionRunResult(null);
    setHighlightedIndex(0);
  }, []);

  useEffect(() => {
    const command = externalCommandRequest?.command?.trim();
    if (!externalCommandRequest?.id || !command || !externalCommandRequest.patient?.id) return;
    setExternalContext({
      patient: externalCommandRequest.patient,
      appointment: externalCommandRequest.appointment || null,
    });
    setQuery(command);
    setState(null);
    setPanelActionRunResult(null);
    setHighlightedIndex(0);
    setOpen(true);
    onExternalCommandHandled?.(externalCommandRequest.id);
  }, [externalCommandRequest?.id, onExternalCommandHandled]);

  const navCtx = useMemo(() => ({
    setPage, goSchedaPaz,
    onNavigate: setPage, onNavigateNew: (p) => openNew?.(p),
    onGoAgenda: () => setPage('agenda'), onGoRichiami: () => setPage('richiami'),
    openBooking: () => openBooking?.(), openTodoModal: () => {},
    openPrescription,
  }), [setPage, goSchedaPaz, openPrescription, openNew, openBooking]);

  const handleSelectResult = useCallback((item) => {
    if (item.kind === 'patient' || item.kind === 'intelligence-patient') { goSchedaPaz?.(item.data?.patient || item.data); close(); return; }
    if (item.kind === 'section') {
      const destination = item.data?.page || item.id;
      if (destination === 'archivio') onArchivioFilterHint?.(item.data?.filtroTipo || 'tutti');
      setPage(destination);
      close();
      return;
    }
    if (item.kind === 'action') {
      if (item.id === 'prescription.create') {
        setQuery('crea ricetta');
        inputRef.current?.focus();
        return;
      }
      item.data.navigate(navCtx, item.data.entity);
      close();
    }
  }, [goSchedaPaz, setPage, onArchivioFilterHint, navCtx, close]);

  const handleConfirmAction = useCallback((action, selectedPatient) => {
    const patient = selectedPatient || state?.entities?.patientCandidates?.[0];
    action.navigate(navCtx, patient, { drug: state?.entities?.drugText || '' });
    close();
  }, [navCtx, state, close]);

  const handleConfirmChatAction = useCallback((action, selectedPatient) => {
    const patient = selectedPatient || chatStructuredState?.entities?.patientCandidates?.[0];
    action.navigate(navCtx, patient, { drug: chatStructuredState?.entities?.drugText || '' });
    setChatStructuredState(null);
  }, [navCtx, chatStructuredState]);

  const handleChatSelectResult = useCallback((item) => {
    if (item.kind === 'patient' || item.kind === 'intelligence-patient') {
      goSchedaPaz?.(item.data?.patient || item.data);
      setChatStructuredState(null);
      return;
    }
    if (item.kind === 'section') {
      const destination = item.data?.page || item.id;
      if (destination === 'archivio') onArchivioFilterHint?.(item.data?.filtroTipo || 'tutti');
      setPage(destination);
      setChatStructuredState(null);
      return;
    }
    if (item.kind === 'action') {
      item.data.navigate(navCtx, item.data.entity);
      setChatStructuredState(null);
    }
  }, [goSchedaPaz, navCtx, onArchivioFilterHint, setPage]);

  const handleModifyAction = useCallback(() => {
    inputRef.current?.focus();
  }, []);

  const onToggle = useCallback(() => setOpen((v) => !v), []);
  const submitQuery = useCallback(() => {
    if (!query.trim()) return;
    if (previewTimerRef.current) clearTimeout(previewTimerRef.current);
    runQuery(query, { allowModel: true, persist: true });
  }, [query, runQuery]);

  return (
    <>
      {/* POL-AI-002A §17 — same identity, different interaction: mobile
          gets the large freely-positionable Orb, desktop gets the
          discreet edge-anchored dock. Both call the exact same onToggle,
          opening the exact same panel/state below. */}
      {isMobile
        ? <PoliedronMobileDock page={page} setPage={setPage} open={open} onToggle={onToggle} panelId={panelId} unreadCount={unreadCount} />
        : <PoliedronEdgeDock open={open} onToggle={onToggle} panelId={panelId} />}
      {/* POL-CHAT-001 merge — FASE 3: PR #51's bell was a placeholder that
          reopened the quick panel and carried a badge with no producer; PR
          #53's bell was a real Chat entry point but re-declared its own
          markup and position. Merged: the approved PoliedronBell component
          and its approved mobile/desktop positioning are kept (mobile
          clears the floating dock's top edge, desktop sits top-right away
          from the Edge Dock), and it now carries the REAL unread count and
          opens the REAL persistent Chat. Still one Poliedron: the Chat page
          is this same instance portalled into `chatHost`, not a second
          agent. Hidden while already on Chat, where the header owns the
          surface and everything is read by definition. */}
      {page !== 'chat' && (
        <PoliedronBell
          variant={isMobile ? 'mobile' : 'desktop'}
          unreadCount={unreadCount}
          onOpenChat={() => setPage('chat')}
        />
      )}
      {open && (
        <PoliedronPanel
          panelId={panelId}
          isMobile={isMobile}
          query={query}
          onQueryChange={handleQueryChange}
          state={state}
          loading={loading}
          highlightedIndex={highlightedIndex}
          onHighlightChange={setHighlightedIndex}
          onSelectResult={handleSelectResult}
          onConfirmAction={handleConfirmAction}
          onModifyAction={handleModifyAction}
          onConfirmActionPlan={handleConfirmPanelActionPlan}
          actionRunning={panelActionRunning}
          actionRunResult={panelActionRunResult}
          onSubmit={submitQuery}
          submitDisabled={chatSending || !primaryConversation?.id}
          interactionDisabled={panelActionRunning || chatActionRunning}
          conversationError={!!conversationError}
          onRetryConversation={retryInitialization}
          onClose={close}
          inputRef={inputRef}
        />
      )}
      {chatHost && ReactDOM.createPortal(
        <PoliedronChatPage
          messages={conversationMessages}
          loading={conversationLoading}
          loadingOlder={conversationLoadingOlder}
          hasOlder={conversationHasOlder}
          sending={chatSending || panelActionRunning || chatActionRunning}
          error={chatError || (conversationError ? 'La conversazione non è disponibile in questo momento.' : '')}
          structuredState={chatStructuredState}
          onSend={(text) => runChatMessage(text)}
          onRetry={(message) => runChatMessage(message.content, message)}
          onRetryInitialization={conversationError ? retryInitialization : null}
          onLoadOlder={loadOlderMessages}
          onVisible={markVisibleMessagesRead}
          onSelectResult={handleChatSelectResult}
          onConfirmAction={handleConfirmChatAction}
          onModifyAction={() => setChatStructuredState(null)}
          onConfirmActionPlan={handleConfirmChatActionPlan}
          actionRunning={chatActionRunning}
          actionRunResult={chatActionRunResult}
        />,
        chatHost
      )}
    </>
  );
}
