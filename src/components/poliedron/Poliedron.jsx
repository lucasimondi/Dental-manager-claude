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
import { runModelTask } from '../../lib/poliedron/modelGateway.js';
import { decisioneConferma } from '../../lib/poliedron/confirmationReply.js';
import { processQuery } from '../../lib/poliedron/poliedraCore';
import { tabelleDopoRipristino } from '../../lib/poliedron/attivita.js';
import { runActionPlan } from '../../lib/poliedron/planner/actionExecutor';
import {
  createChatRequestId,
  normalizeModelHistory,
} from '../../lib/poliedron/conversationRepository.js';
import { describeChatError, resolveChatSurfaceState } from '../../lib/poliedron/chatErrorState.js';
import { attachmentMetadata, attachmentPayload, prepareAttachment } from '../../lib/poliedron/chatAttachment.js';
import { saveAttachmentToPatient } from '../../lib/poliedron/attachmentToPatient.js';
import { DB } from '../../lib/supabase.js';

const summarizeStructuredResult = (result) => {
  if (result?.answer) return result.answer;
  // POL-AI-011: the save card itself asks for the patient and the confirmation.
  if (result?.attachmentSave) {
    const [only] = result.attachmentSave.candidates || [];
    return result.attachmentSave.candidates?.length === 1
      ? `Confermi di salvare il file nella scheda di ${[only.nome, only.cognome].filter(Boolean).join(' ')}?`
      : 'Scegli il paziente e conferma per salvare il file nella sua scheda.';
  }
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
  phoneApp = false,
  isMobile, page, setPage, patients, plans, payments, pricelist, appointments, richiami, impegni, goSchedaPaz,
  features, isStudioAdmin, vertical, studioId, userId, currentPatient, positionLocked = false,
  quickActionCtx, supabaseClient, onArchivioFilterHint, openPrescription, openNew, openNewPlan, openNewPayment, openBooking,
  externalCommandRequest, onExternalCommandHandled, chatHost, onDataChanged,
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
  const chatStructuredStateRef = useRef(null);
  chatStructuredStateRef.current = chatStructuredState;
  const modelConfirmationRef = useRef(null);
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
  // POL-AI-008: file allegato ai messaggi della Chat. Resta solo in memoria
  // (mai salvato): per riprovare un invio fallito lo si ritrova qui per
  // request_id; dopo un ricaricamento della pagina va riallegato.
  const [chatAttachment, setChatAttachment] = useState(null);
  const [chatAttachmentPreparing, setChatAttachmentPreparing] = useState(false);
  const [chatAttachmentSaving, setChatAttachmentSaving] = useState(false);
  const attachmentsByRequestRef = useRef(new Map());
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
    errorState: conversationErrorState,
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

  const processRequest = useCallback(async (q, { allowModel = false, conversationHistory = [], attachment = null } = {}) => {
    const result = await processQuery({
      query: q,
      context,
      permissions: processPermissions,
      sources: processSources,
      conversationHistory,
      supabaseClient,
      allowModel,
      attachment: attachmentPayload(attachment),
    });
    // POL-AI-010: Poliedron executes clear, conflict-free writes directly;
    // refresh exactly what changed so agenda and patient views stay current.
    if (result?.dataChanged?.length) {
      // The written rows are applied at once; the reconciling reload runs in the
      // background so the answer is never held back by it.
      Promise.resolve(onDataChanged?.(result.dataChanged, result.dataRecords)).catch((error) => {
        console.warn('Poliedron: aggiornamento dei dati non riuscito', error);
      });
    }
    return result;
  }, [context, processPermissions, processSources, supabaseClient, onDataChanged]);

  const executePersistedQuery = useCallback(async (
    q,
    { retryMessage = null, requestId: retainedRequestId = null, readAssistant = false, attachment = null } = {}
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
        ...(attachment ? { metadata: { allegato: attachmentMetadata(attachment) } } : {}),
      });
    }

    try {
      const result = await processRequest(q, {
        allowModel: true,
        conversationHistory: normalizeModelHistory(conversationMessagesRef.current, {
          excludeRequestId: requestId,
        }),
        attachment,
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

  /* POL-AI-009: a prescription prepared by Poliedron in chat opens the real
     Ricetta form already filled in; the clinician reviews it and generates
     the PDF. Only for a patient of this studio's (RLS-scoped) list and only
     when the Ricetta action is allowed for this user. */
  const openPreparedDocument = useCallback((documentRequest) => {
    if (!documentRequest || documentRequest.type !== 'ricetta') return false;
    const patient = (patients || []).find((p) => String(p.id) === String(documentRequest.patientId));
    const allowed = actions.some((action) => action.id === 'prescription.create');
    if (!patient || !allowed || !openPrescription) {
      setChatError(!patient
        ? 'Non trovo il paziente della ricetta tra quelli dello studio.'
        : 'Non posso aprire il modulo Ricetta con i permessi attuali.');
      return false;
    }
    openPrescription({ patient, farmaci: documentRequest.farmaci });
    return true;
  }, [actions, openPrescription, patients]);

  const applyQuickResult = useCallback((result) => {
    if (result.documentRequest && openPreparedDocument(result.documentRequest)) {
      setLoading(false);
      close();
      return;
    }
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
  }, [close, onArchivioFilterHint, openPreparedDocument, setPage]);

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
        }).catch((persistError) => {
          /* POL-CHAT-001 §FASE 11 — the quick panel must answer even when the
             persistent Chat backend is unavailable. `persist` is already
             false when we know persistence is down, so this only covers the
             race where the conversation disappears between the check and the
             call: persistence is best-effort, answering is not optional. */
          if (persistError?.message !== 'CHAT_CONVERSATION_NOT_READY') throw persistError;
          pendingPanelRequestRef.current = null;
          return processRequest(q, { allowModel: true });
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
      /* POL-CHAT-001 §FASE 10 — precedence. A real initialization failure is
         reported as what it is (missing schema / denied permission / no
         network); "si sta ancora caricando" is said ONLY when the
         conversation is genuinely still initializing with no error. */
      const described = conversationErrorState;
      setChatError(
        actionExecutionRef.current
          ? 'Attendi il completamento del piano d’azione in corso.'
          : primaryConversation?.id
          ? 'Attendi il completamento della richiesta in corso.'
          : described
          ? described.message
          : conversationLoading
          ? 'La conversazione si sta ancora caricando. Riprova tra poco.'
          : 'La Chat non è disponibile in questo momento. Riprova.'
      );
      return false;
    }
    const attachment = retryMessage
      ? attachmentsByRequestRef.current.get(retryMessage.request_id) || null
      : chatAttachment;
    if (retryMessage?.metadata?.allegato && !attachment) {
      setChatError(`Il file "${retryMessage.metadata.allegato.nome || 'allegato'}" non è più disponibile: allegalo di nuovo e reinvia il messaggio.`);
      return false;
    }
    setChatError('');
    // POL-AI-010: a typed "sì" / "no" decides the pending confirmation, like the buttons.
    const pendingConfirmation = !retryMessage ? chatStructuredStateRef.current?.modelConfirmation : null;
    const decisione = pendingConfirmation ? decisioneConferma(text) : null;
    if (decisione) {
      try {
        await appendMessage({ requestId: createChatRequestId(), role: 'user', content: text, deliveryStatus: 'sent' });
      } catch { /* the decision itself must not depend on chat history */ }
      await modelConfirmationRef.current?.(pendingConfirmation, decisione === 'annulla', true);
      return true;
    }
    setChatStructuredState(null);
    setChatActionRunResult(null);
    const retainedRequest = retryMessage
      ? { content: text, requestId: retryMessage.request_id }
      // POL-AI-008: con un file allegato mai riusare la richiesta in sospeso —
      // il messaggio già salvato mostrerebbe il nome del file precedente.
      : !attachment && pendingChatRequestRef.current?.content === text
        ? pendingChatRequestRef.current
        : { content: text, requestId: createChatRequestId() };
    pendingChatRequestRef.current = retainedRequest;
    if (attachment) {
      attachmentsByRequestRef.current.set(retainedRequest.requestId, attachment);
      // POL-AI-009: il file resta "in uso" e accompagna anche i messaggi
      // successivi, finché l'utente non lo toglie (Poliedron se lo ricorda).
      if (!retryMessage) setChatAttachment((current) => (current === attachment ? { ...attachment, inUse: true } : current));
    }
    try {
      const result = await runPersistedRequest(text, {
        retryMessage,
        requestId: retainedRequest.requestId,
        readAssistant: () => pageRef.current === 'chat',
        attachment,
      });
      attachmentsByRequestRef.current.delete(retainedRequest.requestId);
      if (pendingChatRequestRef.current?.requestId === retainedRequest.requestId) {
        pendingChatRequestRef.current = null;
      }
      if (result.documentRequest) {
        openPreparedDocument(result.documentRequest);
      } else if (result.directNavigation) {
        const { navId, filtroTipo } = result.directNavigation;
        if (navId === 'archivio') onArchivioFilterHint?.(filtroTipo || 'tutti');
        setPage(navId);
      } else if (!result.answer || result.modelConfirmation) {
        setChatStructuredState(result);
      }
      return true;
    } catch (sendError) {
      // FASE 10: classify the send failure too, instead of blaming the network
      // for what may be a permission or schema problem.
      const described = describeChatError(sendError);
      setChatError(described?.message || 'Non riesco a completare la richiesta. Riprova.');
      return false;
    }
  }, [appendMessage, chatAttachment, conversationErrorState, conversationLoading, onArchivioFilterHint, openPreparedDocument, primaryConversation?.id, runPersistedRequest, setPage]);

  // POL-AI-011: the attached file goes into the patient's "Foto" section
  // (private patient-files storage, studio RLS) only after the confirmation.
  const requestSaveAttachment = useCallback(() => {
    setChatError('');
    setChatStructuredState({ attachmentSave: { candidates: [] } });
  }, []);
  const saveChatAttachment = useCallback(async (patient) => {
    if (!patient || chatAttachmentSaving) return;
    const attachment = chatAttachment;
    setChatAttachmentSaving(true);
    let text;
    try {
      await saveAttachmentToPatient(supabaseClient, patient.id, attachment);
      text = `Ho salvato "${attachment.name}" nella scheda di ${[patient.nome, patient.cognome].filter(Boolean).join(' ')} (sezione Foto).`;
    } catch (saveError) {
      setChatAttachmentSaving(false);
      setChatError(saveError?.message || 'Salvataggio non riuscito. Riprova.');
      return;
    }
    setChatAttachmentSaving(false);
    setChatStructuredState({ answer: text });
    if (primaryConversation?.id) {
      try {
        await appendMessage({ requestId: createChatRequestId(), role: 'assistant', content: text, deliveryStatus: 'sent', readAt: new Date().toISOString() });
        setChatStructuredState(null);
      } catch { /* the save happened: the status line above stays visible */ }
    }
  }, [appendMessage, chatAttachment, chatAttachmentSaving, primaryConversation?.id, supabaseClient]);

  const attachChatFile = useCallback(async (file) => {
    if (!file) return;
    setChatError('');
    setChatAttachmentPreparing(true);
    try {
      setChatAttachment(await prepareAttachment(file));
    } catch (attachError) {
      setChatAttachment(null);
      setChatError(attachError?.message || 'Non riesco ad allegare questo file.');
    } finally {
      setChatAttachmentPreparing(false);
    }
  }, []);

  const consumedConfirmations = useRef(new Set());
  const confirmationIdentity = useRef('');
  confirmationIdentity.current = `${studioId}:${userId}`;
  useEffect(() => {
    setState(null); setChatStructuredState(null);
    consumedConfirmations.current.clear();
  }, [studioId, userId]);
  const handleModelConfirmation = useCallback(async (pending, cancelled, isChat) => {
    if (actionExecutionRef.current || consumedConfirmations.current.has(pending.token)) return;
    consumedConfirmations.current.add(pending.token);
    actionExecutionRef.current = true;
    setChatActionRunning(true);
    const show = isChat ? setChatStructuredState : setState;
    const identity = confirmationIdentity.current;
    show(null);
    let text;
    try {
      const response = await runModelTask({ supabaseClient, confirm: { token: pending.token, cancelled } });
      if (identity !== confirmationIdentity.current) return;
      text = response.error ? 'Esito non disponibile. Controlla i dati nell’app prima di riprovare.' : response.text;
      // POL-AI-010: refresh exactly what the confirmed action changed (agenda,
      // patients, recalls, commitments); unknown outcome → refresh them all.
      const changed = response.raw?.changed || (response.error ? ['appointments', 'patients', 'richiami', 'impegni_personali'] : []);
      if (!cancelled && changed.length) {
        Promise.resolve(onDataChanged?.(changed, response.raw?.records)).catch((error) => {
          console.warn('Poliedron: aggiornamento dei dati non riuscito', error);
        });
      }
      if (identity !== confirmationIdentity.current) return;
      // Outcome is authoritative even if saving chat history subsequently fails.
      show({ answer: text });
      if (primaryConversation?.id) {
        try { await appendMessage({ requestId: createChatRequestId(), role: 'assistant', content: text, deliveryStatus: 'sent', readAt: new Date().toISOString() }); }
        catch { show({ answer: text + '\nEsito non salvato nella cronologia.' }); }
      }
    } finally {
      actionExecutionRef.current = false;
      setChatActionRunning(false);
    }
  }, [supabaseClient, onDataChanged, primaryConversation?.id, appendMessage]);
  modelConfirmationRef.current = handleModelConfirmation;

  // POL-AI-010: "Attività di Poliedron" — read-only log of the executed actions.
  const loadPoliedronActivity = useCallback(async () => {
    if (!supabaseClient || !studioId) return [];
    const { data, error } = await supabaseClient.from('poliedron_attivita')
      .select('id, azione, riepilogo, tabella, record_id, ripristino_di, created_at')
      .eq('studio_id', studioId).order('created_at', { ascending: false }).limit(100);
    if (error) throw error;
    return data || [];
  }, [supabaseClient, studioId]);
  const restorePoliedronActivity = useCallback(async (row) => {
    const { data: tabella, error } = await supabaseClient.rpc('poliedron_ripristina_v1', { p_attivita: row.id, p_studio: studioId });
    if (error) throw new Error(error.message);
    Promise.resolve(onDataChanged?.(tabelleDopoRipristino(tabella))).catch((e) => console.warn('Poliedron: aggiornamento dei dati non riuscito', e));
  }, [supabaseClient, studioId, onDataChanged]);

  // POL-AI-TEAM-002: the Poliedron team (Clinic Manager and specialists),
  // read-only consultation through the same authenticated gateway.
  const askTeam = useCallback(async ({ team, input, history }) => {
    const result = await runModelTask({ taskType: 'ASK', input, history, team, context, supabaseClient });
    return { text: result.text, error: result.error, pareri: result.raw?.team?.pareri || [] };
  }, [context, supabaseClient]);
  const teamIdentity = useMemo(() => ({ studioId, userId }), [studioId, userId]);

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
    openBooking: (payload) => openBooking?.(payload), openTodoModal: () => {},
    openPrescription,
    openNewPlan: (patientId) => openNewPlan?.(patientId),
    openNewPayment: (payload) => openNewPayment?.(payload),
  }), [setPage, goSchedaPaz, openPrescription, openNew, openBooking, openNewPlan, openNewPayment]);

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
    action.navigate(navCtx, patient, {
      drug: state?.entities?.drugText || '',
      date: state?.entities?.appointmentDate || null,
      time: state?.entities?.appointmentTime || null,
      amount: state?.entities?.amount ?? null,
    });
    close();
  }, [navCtx, state, close]);

  const handleConfirmChatAction = useCallback((action, selectedPatient) => {
    const patient = selectedPatient || chatStructuredState?.entities?.patientCandidates?.[0];
    action.navigate(navCtx, patient, {
      drug: chatStructuredState?.entities?.drugText || '',
      date: chatStructuredState?.entities?.appointmentDate || null,
      time: chatStructuredState?.entities?.appointmentTime || null,
      amount: chatStructuredState?.entities?.amount ?? null,
    });
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

  /* POL-CHAT-001 §FASE 11 — persistence is BEST-EFFORT for the quick panel.
     The panel's ability to answer must not be coupled to the existence of
     `poliedron_conversations` / `poliedron_messages`: when the conversation is
     absent or failed to initialize, the same request runs through the same
     `processRequest` (same agent, same context engine, same permissions) and
     is simply not written to the persistent thread. */
  const chatPersistenceAvailable = Boolean(primaryConversation?.id) && !conversationError;
  const submitQuery = useCallback(() => {
    if (!query.trim()) return;
    if (previewTimerRef.current) clearTimeout(previewTimerRef.current);
    runQuery(query, { allowModel: true, persist: chatPersistenceAvailable });
  }, [chatPersistenceAvailable, query, runQuery]);

  /* POL-CHAT-001 §FASE 10 — the single precedence rule for the Chat surface
     (initialization error > generic send error > loading > empty > ready),
     computed in one place instead of being re-derived by each JSX branch. */
  const chatSurface = useMemo(() => resolveChatSurfaceState({
    loading: conversationLoading,
    conversationError,
    chatError,
    messageCount: conversationMessages.length,
  }), [chatError, conversationError, conversationLoading, conversationMessages.length]);

  return (
    <>
      {/* POL-AI-002A §17 — same identity, different interaction: mobile
          gets the large freely-positionable Orb, desktop gets the
          discreet edge-anchored dock. Both call the exact same onToggle,
          opening the exact same panel/state below. */}
      {!(page === 'chat' && (phoneApp || isMobile)) && (isMobile
        ? <PoliedronMobileDock page={page} setPage={setPage} open={open} onToggle={onToggle} panelId={panelId} positionLocked={positionLocked} />
        : <PoliedronEdgeDock open={open} onToggle={onToggle} panelId={panelId} positionLocked={positionLocked} />)}
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
      {/* POL-CHAT-001 §FASE 4/11 — the quick panel receives NO chat-history
          props: no message list, no persistent thread, no availability banner.
          `submitDisabled` is tied only to a persisted request of this same
          panel being in flight, NEVER to the Chat backend being missing. */}
      {open && (
        <PoliedronPanel
          onModelConfirmation={(p, cancel) => handleModelConfirmation(p, cancel, false)}
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
          submitDisabled={chatSending}
          interactionDisabled={panelActionRunning || chatActionRunning}
          onClose={close}
          inputRef={inputRef}
        />
      )}
      {chatHost && ReactDOM.createPortal(
        <PoliedronChatPage
          phoneApp={phoneApp}
          messages={conversationMessages}
          loading={conversationLoading}
          loadingOlder={conversationLoadingOlder}
          hasOlder={conversationHasOlder}
          sending={chatSending || panelActionRunning || chatActionRunning}
          error={chatSurface.message}
          errorKind={chatSurface.kind}
          surfaceStatus={chatSurface.status}
          onModelConfirmation={(p, cancel) => handleModelConfirmation(p, cancel, true)}
          structuredState={chatStructuredState}
          onSend={(text) => runChatMessage(text)}
          onRetry={(message) => runChatMessage(message.content, message)}
          attachment={chatAttachment}
          attachmentPreparing={chatAttachmentPreparing}
          onAttachFile={attachChatFile}
          onRemoveAttachment={() => setChatAttachment(null)}
          onRequestSaveAttachment={requestSaveAttachment}
          onSaveAttachment={saveChatAttachment}
          onCancelSaveAttachment={() => setChatStructuredState(null)}
          attachmentSaving={chatAttachmentSaving}
          memoryClient={supabaseClient}
          onRetryInitialization={conversationError ? retryInitialization : null}
          onLoadOlder={loadOlderMessages}
          onVisible={markVisibleMessagesRead}
          onSelectResult={handleChatSelectResult}
          onConfirmAction={handleConfirmChatAction}
          onModifyAction={() => setChatStructuredState(null)}
          onConfirmActionPlan={handleConfirmChatActionPlan}
          actionRunning={chatActionRunning}
          actionRunResult={chatActionRunResult}
          navItems={navigationIndex.filter((item) => item.id !== 'chat')}
          onNavigate={setPage}
          loadActivity={loadPoliedronActivity}
          restoreActivity={restorePoliedronActivity}
          askTeam={askTeam}
          teamIdentity={teamIdentity}
          patients={patients}
        />,
        chatHost
      )}
    </>
  );
}
