import React, { useState, useEffect, useMemo, useRef } from 'react';
import { supabase } from '../lib/supabase.js';
import { Crd, Bdg, Modal, Ic, Btn, Fld, Sel, Inp, Txt, TimePicker, SelettorePaziente, EmptyState, Toast } from './ui';
import { apriWaDiretto, waAbilitato } from './ui/WaAction.jsx';
import { C, fmt, fmtD, today, uid, RICHIAMO_CATEGORIE } from '../lib/utils';
import { BarChart, Bar, LineChart, Line, ComposedChart, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { useControlloDati } from '../lib/useControlloDati';
import WidgetWorkspace from './WidgetWorkspace.jsx';
import { HOME_WIDGET_REGISTRY, createDefaultHomeLayout, moveHomeWidget, moveHomeWidgetByOffset, setHomeWidgetConfig, setHomeWidgetSize, setHomeWidgetVisibility } from '../lib/homeWidgetRegistry.js';
import { deleteUserHomeLayout, loadResolvedHomeLayout, saveStudioHomeLayout, saveUserHomeLayout } from '../lib/homeLayoutPersistence.js';
import CanonicalFinancialWidget from './CanonicalFinancialWidget.jsx';
import { applyWidgetPermissions, buildHomePermissions, createRolePresetLayout, filterWidgetCatalog, resolveHomePeriod } from '../lib/homeDashboardModel.js';
import { getHomeFinancialWidget, loadHomeFinancialSnapshot } from '../lib/homeFinancialWidgets.js';
import QuickBookingModal from './QuickBookingModal.jsx';
import { DEFAULT_QUICK_ACTION_IDS, filterQuickActionsCatalog, getQuickAction, resolveQuickActions } from '../lib/quickActionsCatalog.js';
import poliedroGem from '../assets/icon-poliedra-gem.png';
import { logHomeLayoutEvent } from '../lib/homeLayoutDiagnostics.js';
import { buildActivityText } from '../lib/appointmentQuickHub.js';
import { MOBILE_DOCK_BOTTOM, MOBILE_DOCK_HEIGHT, MOBILE_DOCK_PROTECTED_GAP } from '../lib/poliedron/poliedronMobileDock.js';
import { HOME_ATTENTION_EMPTY_LABEL, buildHomeAttentionItems } from '../lib/homeAttention.js';
import { buildDataHealthActivities, ACTIVITY_KIND } from '../lib/domain/dataHealthActivities.js';
import { computeDataHealthScore } from '../lib/domain/dataHealthScore.js';
import { getOrCreatePrimaryConversation, appendConversationMessage, createChatRequestId } from '../lib/poliedron/conversationRepository.js';

// POL-UI-023: unica fonte per la label leggibile di ogni ACTIVITY_KIND —
// prima viveva solo dentro la useEffect del controllo dati automatico (per
// comporre la notifica in chat), qui riusata anche dalla nuova sezione
// "Poliedron" cliccabile in Home, così le due non possono mai raccontare
// il problema in due modi diversi.
const DATA_HEALTH_KIND_LABEL = {
  [ACTIVITY_KIND.YESTERDAY_APPOINTMENT_NOT_MARKED]: 'hanno prestazioni non ancora segnate come eseguite dopo l’appuntamento di ieri',
  [ACTIVITY_KIND.PLAN_AWAITING_ACCEPTANCE_DECISION]: 'hanno un piano con prestazioni già eseguite ma non ancora accettato né rifiutato',
  [ACTIVITY_KIND.PLAN_NEVER_STARTED]: 'hanno un piano aperto da settimane senza nessuna prestazione eseguita',
  [ACTIVITY_KIND.STALLED_TREATMENT]: 'hanno un piano che sembra fermo, senza un prossimo appuntamento in agenda',
  [ACTIVITY_KIND.ANAMNESI_MANCANTE]: 'non hanno ancora nessuna anamnesi compilata',
};

// La scheda paziente da aprire cliccando un'entry: anamnesi mancante porta
// dritti al tab dove si compila, tutto il resto (piani fermi/da accettare/
// mai iniziati, appuntamento di ieri non segnato) porta al tab Piani, dove
// quelle azioni si eseguono davvero.
const DATA_HEALTH_KIND_TAB = {
  [ACTIVITY_KIND.ANAMNESI_MANCANTE]: 'clinical',
};
const dataHealthKindTab = (kind) => DATA_HEALTH_KIND_TAB[kind] || 'piani';

// Stessa idea ma per i controlli del punteggio "Salute dati gestionale"
// (dataHealthScore.js) — le due mappe sono tenute separate perché gli id
// non coincidono (kind di dataHealthActivities.js vs check id di
// dataHealthScore.js), anche quando puntano allo stesso tab.
const DATA_HEALTH_SCORE_CHECK_TAB = {
  anagrafica: 'info',
  anamnesi: 'clinical',
  privacy: 'doc',
  piano_iniziato: 'piani',
  piano_deciso: 'piani',
  pagamenti: 'paga',
  impianti: 'impl',
};
const dataHealthScoreCheckTab = (checkId) => DATA_HEALTH_SCORE_CHECK_TAB[checkId] || 'info';

// Intestazione di gruppo (nome breve, terza persona) per la sezione
// Poliedron cliccabile — diversa dalla frase di DATA_HEALTH_KIND_LABEL
// sopra, pensata per continuare "Nome Cognome ... ", non per stare da sola
// come titolo di un gruppo di pazienti.
const DATA_HEALTH_KIND_TITLE = {
  [ACTIVITY_KIND.ANAMNESI_MANCANTE]: 'Anamnesi mancante',
  [ACTIVITY_KIND.PLAN_AWAITING_ACCEPTANCE_DECISION]: 'Piano da accettare o rifiutare',
  [ACTIVITY_KIND.PLAN_NEVER_STARTED]: 'Piano mai iniziato',
  [ACTIVITY_KIND.STALLED_TREATMENT]: 'Trattamento fermo',
  [ACTIVITY_KIND.YESTERDAY_APPOINTMENT_NOT_MARKED]: 'Appuntamento di ieri non segnato',
};
const DATA_HEALTH_KIND_ICON = {
  [ACTIVITY_KIND.ANAMNESI_MANCANTE]: 'book',
  [ACTIVITY_KIND.PLAN_AWAITING_ACCEPTANCE_DECISION]: 'plan',
  [ACTIVITY_KIND.PLAN_NEVER_STARTED]: 'warn',
  [ACTIVITY_KIND.STALLED_TREATMENT]: 'pulse',
  [ACTIVITY_KIND.YESTERDAY_APPOINTMENT_NOT_MARKED]: 'clk',
};

const PALETTE = [
  '#1A4E66','#2EC4B6','#2D9E61','#7C3AED','#E63946',
  '#F4A261','#EC4899','#0EA5E9','#84CC16','#F59E0B',
  '#6366F1','#14B8A6','#64748B','#DC2626','#059669',
];

const THEME_DEFAULT = {
  incMese: C?.suc || '#2D9E61',
  incAnno: C?.suc || '#2D9E61',
  lucaMese: '#7C3AED',
  lucaAnno: '#7C3AED',
  speseMese: C?.dan || '#E63946',
  speseAnno: C?.dan || '#E63946',
  margine: C?.suc || '#2D9E61',
  esegDaInc: C?.dan || '#E63946',
  accNonEseg: '#7C3AED',
  totAccettati: C?.acc || '#2EC4B6',
};

const loadTheme = () => {
  try { return { ...THEME_DEFAULT, ...JSON.parse(localStorage.getItem('dm_theme') || '{}') }; }
  catch { return THEME_DEFAULT; }
};
const saveTheme = (t) => { try { localStorage.setItem('dm_theme', JSON.stringify(t)); } catch {} };

const getSaluto = (nome) => { const ora = new Date().getHours(); const s = ora < 12 ? 'Buongiorno' : ora < 18 ? 'Buon pomeriggio' : 'Buonasera'; if (!nome) return s; return s + ', ' + nome.trim().split(' ')[0]; };

// POL-UI-015 §4: compact date/time readout for the mobile floating
// greeting bar only (desktop keeps its existing appointment-count meta
// line, unchanged). `now` ticks once a minute — enough for a live clock,
// not so often it triggers unnecessary re-renders of the whole Dashboard.
const fmtDataOra = (d) => d.toLocaleDateString('it-IT', { weekday: 'short', day: 'numeric', month: 'short' });
const fmtOra = (d) => d.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });

export default function Dashboard({ patients, setPatients, appointments, setAppointments, payments, plans, richiami = [], impegni = [], implants = [], onOpenPaz, appTypes, onGoAgenda, onGoRichiami, onNavigate, onNavigateNew, templates, userName: userNameProp, si, features, studioId, currentUserId, isStudioAdmin, studioMembership, activityPatientRequest, onActivityPatientRequestHandled }) {
  const homePermissions = buildHomePermissions({ membership: studioMembership, features, vertical: si?.vertical });
  const roleLayout = createRolePresetLayout(studioMembership?.capabilities);
  const availableWidgetCatalog = filterWidgetCatalog(HOME_WIDGET_REGISTRY, homePermissions);
  // Widget economico/operativi (preventivi, richiami, scadenze, ortodonzia,
  // statistiche, grafici): stessa fonte di calcolo di Controllo di Gestione,
  // vedi useControlloDati — evita di ricalcolare qui gli stessi numeri con
  // una logica potenzialmente diversa (era esattamente il problema di
  // Dashboard/ControlloGestione risolto in precedenza per i KPI economici).
  const [periodoEconomico, setPeriodoEconomico] = useState('mese');
  const {
    kpi: kpiPeriodo, kpiLoading: kpiPeriodoLoading, pagExt,
    mInc, aInc, extMese, extAnno, incassoLucaMese, incassoLucaAnno,
    esegDaInc, totEsegDaInc, accNonEseg, totAccNonEseg,
    preventiviAccettati, preventiviAttesa, preventiviRifiutati, totAccettati, tassoAccettazione,
    scadenzePagamento, scadenzeScadute, scadenzeProssime,
    pianiOrto,
    nuoviMese, mediaValore, topPrest,
    andamentoMensile, incassoPerPrestazione, incassoPerGiorno, speseMensili, speseCategoria,
    spese, calcPlanTot,
  } = useControlloDati({ studioId, patients, plans, payments, periodo: periodoEconomico, enabled: homePermissions.managementControl });

  const isDentistico = !si?.vertical || si.vertical === 'dentistico';
  const isFisio = si?.vertical === 'fisioterapista' || si?.vertical === 'massofisioterapista';
  const t = today();
  // POL-UI-023: Product Owner — "in Dashboard dobbiamo inserire sezione
  // poliedron cliccabile ... deve darci tutte le info, quindi dati
  // mancanti, ecc". Calcolato live dagli stessi dati che la useEffect qui
  // sotto già scansiona per generare le Attività/la notifica in chat — non
  // dipende da cosa è già stato salvato come todo (che può essere segnato
  // fatto/cancellato pur restando un problema reale), quindi la sezione
  // riflette sempre lo stato attuale, non solo l'ultima scansione.
  const dataHealthFindings = useMemo(
    () => buildDataHealthActivities({ patients, plans, appointments, today: t, formatDate: fmtD }),
    [patients, plans, appointments, t],
  );
  const [poliedronStatusOpen, setPoliedronStatusOpen] = useState(false);

  // POL-UI-024: Product Owner — "widget che dica la salute dei dati
  // gestionale (deve avere una percentuale)". `documenti_medici` non era
  // già caricato da nessuna parte in Dashboard/App.jsx (a differenza di
  // patients/plans/payments/appointments) — unico nuovo fetch di questo
  // giro, solo le due colonne che servono al controllo "documento privacy"
  // (mai il pdf_base64, che sarebbe enorme e qui inutile).
  const [healthScoreDocs, setHealthScoreDocs] = useState([]);
  useEffect(() => {
    if (!studioId) return;
    supabase.from('documenti_medici').select('paziente_id, tipo').then(({ data, error }) => { if (!error && data) setHealthScoreDocs(data); });
  }, [studioId]);
  const dataHealthScore = useMemo(() => computeDataHealthScore({
    patients, plans, dataHealthFindings, scadenzeScadute,
    documents: healthScoreDocs, implants, spese, today: t,
    financialDataAvailable: homePermissions.managementControl,
  }), [patients, plans, dataHealthFindings, scadenzeScadute, healthScoreDocs, implants, spese, t, homePermissions.managementControl]);
  const [poliedronHealthOpen, setPoliedronHealthOpen] = useState(false);
  const [expandedHealthCheckId, setExpandedHealthCheckId] = useState(null);

  const [userName, setUserName] = useState(userNameProp || '');
  // POL-UI-015 root-cause fix: `userId` used to be re-fetched from scratch
  // on every Dashboard mount via its own `supabase.auth.getSession()` call
  // — a redundant async gap racing against App.jsx's already-authoritative,
  // continuously up-to-date `session` (kept live via `onAuthStateChange`
  // for the whole app lifetime, exactly like `studioId` below). Both the
  // Home-layout load effect and `saveHomeCustomization` require `userId`
  // to be non-null before they run at all — while that internal fetch was
  // still pending (or occasionally never resolved, e.g. a mobile tab
  // resumed from background mid token-refresh), the layout effect kept
  // returning early and left the platform-default layout on screen. A
  // user who then opened "Personalizza Home" and saved would overwrite
  // their real, previously-saved personalization with that default —
  // exactly the "salvata ma non ripristinata" symptom, amplified on
  // mobile because backgrounded/resumed tabs make this async gap both
  // slower and more failure-prone than on a desktop tab that rarely
  // suspends. `currentUserId` is the same prop name/pattern App.jsx
  // already passes to Pazienti/SchedaPaz for `session?.user?.id` — no new
  // state, no new fetch, synchronously available on first render.
  const userId = currentUserId || null;

  // POL-UI-015 §4: drives the mobile floating greeting bar's live clock.
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      const m = session?.user?.user_metadata;
      if (m?.nome) setUserName((m.nome + ' ' + (m.cognome || '')).trim());
    });
  }, []);
  const anno = t.slice(0, 4);

  // ── Consigli Poliedron: consulente CFO/marketing proattivo, generato in
  // background (genera-consigli-ai) senza che nessuno apra la chat — stesso
  // spirito del bot Richiami. Solo per admin dello studio (RLS lo impone
  // comunque) e solo al livello Premium dell'assistente (è la funzione che
  // lo genera a deciderlo server-side; qui evitiamo solo la chiamata inutile).
  const [consigli, setConsigli] = useState([]);
  const [consigliLoading, setConsigliLoading] = useState(false);
  const [consigliErr, setConsigliErr] = useState('');
  const consigliAttivi = isStudioAdmin && features?.assistente_ai === 'premium';
  // POL-UI-015 §6: mobile-only "one card at a time" horizontal carousel —
  // the snap/swipe itself is native CSS scroll-snap (see .home-poliedron-
  // widget__track in PremiumVisualSystem.css), this only tracks which dot
  // to highlight. Unused on desktop, where the CSS rule below is a no-op
  // and the cards keep stacking vertically exactly as before.
  const [consigliCarouselIndex, setConsigliCarouselIndex] = useState(0);
  const onConsigliTrackScroll = (e) => {
    const el = e.currentTarget;
    setConsigliCarouselIndex(Math.round(el.scrollLeft / Math.max(1, el.clientWidth)));
  };

  const rigeneraConsigli = async () => {
    setConsigliLoading(true);
    setConsigliErr('');
    try {
      const { data, error } = await supabase.functions.invoke('genera-consigli-ai');
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setConsigli(data.consigli || []);
    } catch (e) {
      setConsigliErr(e.message || 'Errore nella generazione dei consigli');
    } finally {
      setConsigliLoading(false);
    }
  };

  const segnaLettoConsiglio = async (id) => {
    setConsigli((prev) => prev.map((c) => (c.id === id ? { ...c, letto: true } : c)));
    await supabase.from('ai_agent_consigli').update({ letto: true }).eq('id', id);
  };

  useEffect(() => {
    if (!consigliAttivi) return;
    let cancelled = false;
    supabase.from('ai_agent_consigli').select('*').order('creato_il', { ascending: false }).limit(4).then(({ data }) => {
      if (cancelled) return;
      setConsigli(data || []);
      const piuRecente = data && data[0] ? new Date(data[0].creato_il) : null;
      const settimanaFa = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      if (!piuRecente || piuRecente < settimanaFa) rigeneraConsigli();
    });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [consigliAttivi]);

  const [detailModal, setDetailModal] = useState(null);
  const [editApp, setEditApp] = useState(null);
  const [editForm, setEditForm] = useState(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [bookingOpen, setBookingOpen] = useState(false);
  // Brief, real Toast (same shared component Impostazioni already uses)
  // for short-lived Home confirmations — the "Da incassare" honest
  // placeholder (round 3) and "Paziente creato" (round 6, see
  // creaPazienteRapidoRicetta below) — never a fake navigation.
  const [homeToastMsg, setHomeToastMsg] = useState('');
  // Product Owner round 4 — "Ricetta" must land directly on DocMedico's
  // Ricetta tab, not just on the Pazienti list. Home has no current
  // patient, so a small inline picker (same SelettorePaziente pattern the
  // "Nuova attività" modal below already uses) is the minimal step still
  // needed before onOpenPaz(paz, 'doc', { type: 'ricetta' }) can open it.
  const [ricettaPickerOpen, setRicettaPickerOpen] = useState(false);
  const [ricettaPickerSearch, setRicettaPickerSearch] = useState('');
  // Product Owner round 6 — the picker's search field must also let the
  // user create a brand-new patient inline (name/surname only), then open
  // Ricetta for them immediately. Reuses SelettorePaziente's own existing
  // onCreaPaziente contract — the exact same "no results -> create inline"
  // UI Agenda.jsx's own quick-booking form already ships (creaPazienteRapido
  // there) — no new patient-creation logic invented, same uid()-based
  // optimistic local record, same plan-limit guard.
  const limitePazienti = features?.max_pazienti ?? null;
  // SelettorePaziente calls onChange(id) synchronously right after
  // onCreaPaziente returns — before the setPatients update above has
  // flushed into a re-render, so `patients.find(...)` below would not yet
  // see the brand-new record. Kept in a ref (not state, no extra render)
  // so the picker's onChange can hand it straight to onOpenPaz.
  const ricettaJustCreatedRef = useRef(null);
  const creaPazienteRapidoRicetta = (nome, cognome) => {
    if (!setPatients) return null;
    if (limitePazienti != null && patients.length >= limitePazienti) {
      setHomeToastMsg(`Hai raggiunto il limite di ${limitePazienti} pazienti del tuo piano.`);
      return null;
    }
    const id = uid();
    const nuovoPaziente = { nome, cognome, dataNascita: '', telefono: '', email: '', cf: '', indirizzo: '', cap: '', comune: '', provincia: '', opposizione_sts: false, note: '', id };
    ricettaJustCreatedRef.current = nuovoPaziente;
    setPatients((p) => [...p, nuovoPaziente]);
    setHomeToastMsg(`Paziente ${nome} ${cognome} creato ✓`);
    return id;
  };
  const [layoutLoading, setLayoutLoading] = useState(false);
  const [layoutSaving, setLayoutSaving] = useState(false);
  const [layoutError, setLayoutError] = useState('');
  // POL-UI-013 root-cause fix: a failed background load of the saved Home
  // layout must stay visible on the page itself, not only inside the
  // "Personalizza Home" modal — the modal previously cleared `layoutError`
  // unconditionally on open (see openHomeCustomizer below), so a load
  // failure was invisible by the time the user went to check/redo their
  // personalization, making a real backend failure look like "my changes
  // don't persist". `loadError` is intentionally separate from the
  // modal-scoped save error and is only cleared by a load that actually
  // succeeds (including a manual retry).
  const [loadError, setLoadError] = useState('');
  const [homeLayoutReloadToken, setHomeLayoutReloadToken] = useState(0);
  const retryHomeLayoutLoad = () => setHomeLayoutReloadToken((n) => n + 1);
  const [previewMode, setPreviewMode] = useState('desktop');
  const [mostraGraficiDash, setMostraGraficiDash] = useState(false);
  const [widgets, setWidgets] = useState(createDefaultHomeLayout);
  const [draftWidgets, setDraftWidgets] = useState(createDefaultHomeLayout);
  const [layoutSource, setLayoutSource] = useState('platform');
  const [inheritedLayout, setInheritedLayout] = useState(createDefaultHomeLayout);
  const [inheritedSource, setInheritedSource] = useState('platform');
  const [draftInherits, setDraftInherits] = useState(false);
  const [homePeriodId, setHomePeriodId] = useState('current_month');
  const [canonicalSnapshot, setCanonicalSnapshot] = useState(null);
  const [canonicalLoading, setCanonicalLoading] = useState(false);
  const [canonicalError, setCanonicalError] = useState(null);
  const [theme, setTheme] = useState(loadTheme);
  const [themeTab, setThemeTab] = useState('widgets'); // 'widgets' | 'colori'
  const isOn = (id) => { const w = widgets.find(x => x.id === id); return w ? w.visible !== false : true; };

  /* POL-UI-015 bugfix round 3 — see the "Salva Home" buttons below. Those
     buttons used to be `disabled={layoutSaving || layoutLoading}` while
     their styling only dimmed on `layoutSaving`, so during ANY background
     re-run of the layout load effect the primary action of the
     "Personalizza Home" modal looked completely enabled (full opacity,
     blue, `cursor:pointer`) but silently swallowed every click: no save,
     no request, no error, modal stays open — exactly the reported
     "Personalizza Home non salva realmente la configurazione". That the
     effect really does re-run after the editor is already reachable is
     visible in the production Supabase edge logs, where every single page
     load produces TWO sequential `user_home_layouts`/`studio_home_layouts`
     GET rounds ~300ms apart (run 1 with `studioMembership === null`, run 2
     once `capabilities` arrive and change this effect's dependency).

     The fix keeps saving always available (the draft is the user's
     explicit intent and `openHomeCustomizer` already refuses to open on a
     not-yet-loaded baseline) and instead makes a late background load
     unable to clobber a newer successful save: each save bumps
     `layoutSaveEpochRef`, and a load that resolves across a save is
     discarded instead of overwriting the just-persisted layout. */
  const layoutSaveEpochRef = useRef(0);

  /* POL-UI-015 round 4 diagnosed the "Salva Home" bug with an on-screen
     save-state readout under the button, because the Product Owner tests on a
     phone with no devtools console. That bug is fixed and merged, so
     POL-CHAT-001 §FASE 13 REMOVES the visual diagnostic block from the UI
     entirely — no badge, no on-screen state dump, no extra React state.

     What is intentionally kept: the internal, non-sensitive event trail
     (`logHomeLayoutEvent`), which is gated to dev/deploy-preview hosts, never
     runs in production, and logs only shape info (counts, source labels,
     booleans, widget ids). The SAVE LOGIC and the persistence path are
     untouched — this change is presentational only. */
  const traceHomeSave = (event, detail) => {
    logHomeLayoutEvent(event, detail);
  };

  useEffect(() => {
    if (!studioId || !userId) return;
    let cancelled = false;
    const startEpoch = layoutSaveEpochRef.current;
    setLayoutLoading(true);
    logHomeLayoutEvent('HOME_LAYOUT_LOAD_START');
    loadResolvedHomeLayout(supabase, studioId, userId, createRolePresetLayout(studioMembership?.capabilities))
      .then(({ layout, source, inheritedLayout: nextInherited, inheritedSource: nextInheritedSource }) => {
        if (!cancelled && layoutSaveEpochRef.current !== startEpoch) {
          // A save/reset completed while this read was in flight: the
          // committed state is already newer than this response.
          logHomeLayoutEvent('HOME_LAYOUT_LOAD_STALE');
        } else if (!cancelled) {
          // POL-UI-013C root-cause fix: `draftWidgets` is only ever
          // meaningful while the "Personalizza Home" modal is open, and
          // `openHomeCustomizer` already re-derives it fresh from `widgets`
          // every time the modal opens. This effect used to also call
          // `setDraftWidgets(layout)` here — if this background load
          // resolved WHILE the modal was already open (e.g. the user
          // opened it before the initial load finished, or triggered a
          // manual "Riprova" reload mid-edit), it silently overwrote
          // whatever the user was actively editing with the just-fetched
          // server layout, discarding unsaved changes with no warning.
          // The user would then save the (unintentionally reset) draft
          // and see their edit "not persist". Only `widgets` (the
          // committed, non-editing-state truth) needs to stay in sync
          // with the server here. `draftInherits` is the same story —
          // it's modal-scoped (drives the Save/Reset branching and label
          // while editing) and is already recomputed fresh from `widgets`
          // by `openHomeCustomizer` every time the modal opens, so it
          // must not be reset here either: doing so could silently flip
          // an in-progress edit's save target back to "inherit studio
          // default" mid-session, even after the user had already
          // started customizing (each edit handler sets it to `false`
          // first, which this effect could otherwise revert).
          setWidgets(layout); setLayoutSource(source);
          setInheritedLayout(nextInherited); setInheritedSource(nextInheritedSource);
          setLoadError('');
          logHomeLayoutEvent('HOME_LAYOUT_LOAD_SOURCE', source);
          logHomeLayoutEvent('HOME_LAYOUT_NORMALIZED', { widgets: layout.length });
          logHomeLayoutEvent('HOME_LAYOUT_LOAD_SUCCESS', { widgets: layout.length });
        }
      })
      .catch(() => {
        if (!cancelled) {
          setLoadError('La tua personalizzazione della Home non è stata caricata: potresti vedere il layout predefinito invece del tuo. Riprova.');
          logHomeLayoutEvent('HOME_LAYOUT_LOAD_ERROR');
        }
      })
      .finally(() => { if (!cancelled) setLayoutLoading(false); });
    return () => { cancelled = true; };
  }, [studioId, userId, JSON.stringify(studioMembership?.capabilities || []), homeLayoutReloadToken]);

  const homePeriod = resolveHomePeriod(homePeriodId);
  const visibleWidgets = applyWidgetPermissions(widgets, HOME_WIDGET_REGISTRY, homePermissions);
  const visibleDraftWidgets = applyWidgetPermissions(draftWidgets, HOME_WIDGET_REGISTRY, homePermissions);
  const hasVisibleFinancialWidget = visibleWidgets.some((item) => item.visible !== false && getHomeFinancialWidget(item.id));

  useEffect(() => {
    let cancelled = false;
    if (!homePermissions.managementControl || !hasVisibleFinancialWidget) {
      setCanonicalSnapshot(null); setCanonicalLoading(false); setCanonicalError(null);
      return () => { cancelled = true; };
    }
    setCanonicalLoading(true); setCanonicalError(null);
    loadHomeFinancialSnapshot(supabase, { authorized: true, period: resolveHomePeriod(homePeriodId) })
      .then(({ snapshot, error }) => {
        if (!cancelled) { setCanonicalSnapshot(snapshot); setCanonicalError(error || null); }
      })
      .catch((error) => { if (!cancelled) setCanonicalError(error); })
      .finally(() => { if (!cancelled) setCanonicalLoading(false); });
    return () => { cancelled = true; };
  }, [homePermissions.managementControl, hasVisibleFinancialWidget, homePeriodId]);

  const openHomeCustomizer = () => {
    // Defense in depth — see the trigger button's own comment for the race
    // this guard closes (draftWidgets must never start from a stale widgets
    // snapshot while the real layout is still loading).
    if (layoutLoading) return;
    setDraftWidgets(widgets.map((item) => ({ ...item })));
    setDraftInherits(layoutSource !== 'user');
    setLayoutError('');
    setPreviewMode('desktop');
    setThemeTab('widgets');
    setSettingsOpen(true);
  };

  /* POL-UI-015 round 4 §1 — the ids the draft actually changes with respect
     to the committed layout. Logged (ids only, no patient data, no
     identifiers) so a "Salva" that reports zero changes is immediately
     visible as such instead of looking like a failed save. */
  const changedDraftWidgetIds = () => {
    const committed = new Map(widgets.map((item) => [item.id, item]));
    const changed = draftWidgets.filter((item) => {
      const before = committed.get(item.id);
      if (!before) return true;
      return before.visible !== item.visible || before.order !== item.order || before.size !== item.size
        || JSON.stringify(before.config || null) !== JSON.stringify(item.config || null);
    }).map((item) => item.id);
    return changed;
  };

  const saveHomeCustomization = async () => {
    // POL-UI-015 round 4: FIRST statement of the handler, before any guard,
    // so the trail distinguishes "the click never reached this function"
    // (nothing logged at all — a UI/hit-target problem) from "it ran and
    // stopped at a specific stage".
    traceHomeSave('HOME_SAVE_CLICK');
    traceHomeSave('HOME_SAVE_STATE', {
      layoutSource,
      draftInherits,
      layoutLoading,
      layoutSaving,
      studioIdPresent: Boolean(studioId),
      userIdPresent: Boolean(userId),
      changedWidgetIds: changedDraftWidgetIds(),
    });
    if (!studioId || !userId) {
      traceHomeSave('HOME_SAVE_ERROR', { stage: 'identity-missing' });
      setLayoutError('Identità studio/utente non disponibile'); return;
    }
    layoutSaveEpochRef.current += 1;
    setLayoutSaving(true); setLayoutError('');
    logHomeLayoutEvent('HOME_LAYOUT_SAVE_START');
    try {
      if (draftInherits) {
        traceHomeSave('HOME_SAVE_BRANCH_INHERIT');
        await deleteUserHomeLayout(supabase, studioId, userId);
        try {
          const resolved = await loadResolvedHomeLayout(supabase, studioId, userId, roleLayout);
          setWidgets(resolved.layout); setDraftWidgets(resolved.layout); setLayoutSource(resolved.source);
          setInheritedLayout(resolved.inheritedLayout); setInheritedSource(resolved.inheritedSource);
        } catch {
          // POL-UI-013C: the delete above already succeeded — the user's
          // personal layout really was removed server-side — so a
          // failure here must not fall through to the generic "no
          // changes were applied" catch below, which would be false.
          // Fall back to the inherited layout already held in state
          // instead of leaving the stale pre-reset draft on screen.
          setWidgets(inheritedLayout); setDraftWidgets(inheritedLayout); setLayoutSource(inheritedSource);
        }
      } else {
        traceHomeSave('HOME_SAVE_BRANCH_USER');
        const saved = await saveUserHomeLayout(supabase, studioId, userId, draftWidgets);
        setWidgets(saved); setDraftWidgets(saved); setLayoutSource('user');
      }
      // POL-UI-015 round 3: reached only after `saveUserHomeLayout` /
      // `deleteUserHomeLayout` confirmed the write with a database
      // read-back, so closing the modal here really does mean "persisted".
      layoutSaveEpochRef.current += 1;
      setSettingsOpen(false);
      traceHomeSave('HOME_SAVE_SUCCESS');
      logHomeLayoutEvent('HOME_LAYOUT_SAVE_SUCCESS');
    } catch (error) {
      // POL-UI-015 round 3: surface the real reason (including the new
      // "salvataggio non confermato dal database" read-back failures)
      // instead of a single opaque message, and keep the modal open with
      // the user's draft intact so they can retry.
      setLayoutError(error?.message ? `Salvataggio non riuscito: ${error.message}` : 'Salvataggio non riuscito. Nessuna modifica è stata applicata.');
      traceHomeSave('HOME_SAVE_ERROR', { stage: 'save', message: error?.message || 'unknown' });
      logHomeLayoutEvent('HOME_LAYOUT_SAVE_ERROR');
    }
    finally { setLayoutSaving(false); }
  };

  const resetHomeCustomization = () => {
    setDraftWidgets(inheritedLayout.map((item) => ({ ...item })));
    setDraftInherits(true);
  };

  const saveStudioDefault = async () => {
    if (!isStudioAdmin || !studioId || !userId) return;
    setLayoutSaving(true); setLayoutError('');
    try {
      const saved = await saveStudioHomeLayout(supabase, studioId, userId, draftWidgets);
      setInheritedLayout(saved); setInheritedSource('studio');
      if (draftInherits) { setWidgets(saved); setDraftWidgets(saved); setLayoutSource('studio'); }
    } catch (error) { setLayoutError(error?.message ? `Salvataggio del predefinito studio non riuscito: ${error.message}` : 'Salvataggio del predefinito studio non riuscito.'); }
    finally { setLayoutSaving(false); }
  };
  const [todoList, setTodoList] = useState([]);
  const [todoInput, setTodoInput] = useState('');
  const [todoModal, setTodoModal] = useState(false);
  const [todoPatientId, setTodoPatientId] = useState('');
  const [todoPatientSearch, setTodoPatientSearch] = useState('');
  const [todoLoading, setTodoLoading] = useState(false);
  const openGenericTodoModal = () => {
    setTodoPatientId('');
    setTodoPatientSearch('');
    setTodoModal(true);
  };
  const closeTodoModal = () => {
    setTodoModal(false);
    setTodoPatientId('');
    setTodoPatientSearch('');
  };
  useEffect(() => {
    if (!activityPatientRequest?.patient) return;
    setTodoInput('');
    setTodoPatientId(String(activityPatientRequest.patient.id));
    setTodoPatientSearch('');
    setTodoModal(true);
    onActivityPatientRequestHandled?.(activityPatientRequest.id);
  }, [activityPatientRequest?.id]);
  useEffect(() => {
    loadTodos();
    // Realtime: aggiorna automaticamente quando cambiano i todo
    const channel = supabase.channel('todos-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'todos' }, () => { loadTodos(); })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const loadTodos = async () => {
    setTodoLoading(true);
    const { data, error } = await supabase.from('todos').select('*').order('created_at', { ascending: false });
    if (!error && data) setTodoList(data);
    setTodoLoading(false);
  };

  // Controllo dati automatico (POL-FIN-007): scansione deterministica
  // (nessuna chiamata AI, nessun costo) su pazienti/piani/appuntamenti —
  // Product Owner: "deve essere più chiaro, mandarmi notifica in chat, e
  // dirmi pazienti che non hanno dati aggiornati, inoltre poliedron deve
  // agire anche quando c'è un piano lì, senza una attività eseguita su
  // quel piano, così come pazienti che hanno prestazioni in piani che non
  // vengono teoricamente eseguite". UNA Attività per paziente per problema
  // (mai più bundle generico "N pazienti…"), sempre con paziente_id per il
  // click-through, con dedup stabile (dataHealthActivities.js) che
  // sopravvive anche se il promemoria è già stato segnato fatto o
  // cancellato — stesso comportamento del bot Richiami. Le nuove Attività
  // create in questo giro generano anche UNA notifica riassuntiva nella
  // Chat Poliedron (stessa conversazione persistente del campanellino),
  // così il controllo non vive solo, silenzioso, nel widget Attività.
  useEffect(() => {
    if (!patients?.length || !plans?.length) return;
    const entries = dataHealthFindings;
    if (!entries.length) return;
    (async () => {
      const { data: esistenti } = await supabase.from('todos').select('id, paziente_id, testo');
      const nuoveEntry = entries.filter((entry) => !(esistenti || []).some((row) =>
        String(row.paziente_id ?? '') === String(entry.pazienteId) && String(row.testo || '').includes(entry.dedupMarker)
      ));
      if (!nuoveEntry.length) return;

      const inserite = [];
      for (const entry of nuoveEntry) {
        const nuova = { id: Date.now() + inserite.length, testo: entry.message, fatto: false, data: t, paziente_id: entry.pazienteId };
        const { error } = await supabase.from('todos').insert([nuova]);
        if (!error) inserite.push({ entry, nuova });
      }
      if (!inserite.length) return;
      setTodoList((prev) => [...inserite.map((x) => x.nuova), ...prev]);

      // Notifica in Chat Poliedron — best-effort: un problema qui non deve
      // mai impedire la creazione delle Attività sopra, già andata a buon
      // fine.
      if (studioId && currentUserId) {
        try {
          const conversation = await getOrCreatePrimaryConversation({ client: supabase, studioId, userId: currentUserId });
          const perTipo = new Map();
          for (const { entry } of inserite) {
            const lista = perTipo.get(entry.kind) || [];
            if (!lista.includes(entry.patientName)) lista.push(entry.patientName);
            perTipo.set(entry.kind, lista);
          }
          const righe = [...perTipo.entries()].map(([kind, nomi]) => `• ${nomi.join(', ')} ${DATA_HEALTH_KIND_LABEL[kind] || kind}`);
          const content = `🩺 Controllo dati automatico — ${inserite.length} ${inserite.length === 1 ? 'nuova attività' : 'nuove attività'}:\n${righe.join('\n')}\n\nDettagli e conferma in Attività, sulla Home.`;
          await appendConversationMessage({
            client: supabase,
            conversationId: conversation.id,
            requestId: createChatRequestId(),
            role: 'assistant',
            content,
            metadata: { source: 'data_health_scan', count: inserite.length },
          });
        } catch { /* la notifica in chat è un extra: le Attività sono già salvate */ }
      }
    })();
  }, [dataHealthFindings, patients, plans, studioId, currentUserId]);

  const addTodo = async () => {
    if (!todoInput.trim()) return;
    const patient = patients.find((item) => String(item.id) === String(todoPatientId));
    const nuova = { id: Date.now(), testo: buildActivityText(todoInput, patient), fatto: false, data: t };
    const { error } = await supabase.from('todos').insert([nuova]);
    if (!error) {
      setTodoList(prev => [nuova, ...prev]);
      setTodoInput('');
      setTodoPatientId('');
      setTodoPatientSearch('');
    }
  };

  const toggleTodo = async (id) => {
    const todo = todoList.find(x => x.id === id);
    if (!todo) return;
    const { error } = await supabase.from('todos').update({ fatto: !todo.fatto }).eq('id', id);
    if (!error) setTodoList(prev => prev.map(x => x.id === id ? { ...x, fatto: !x.fatto } : x));
  };

  const deleteTodo = async (id) => {
    const { error } = await supabase.from('todos').delete().eq('id', id);
    if (!error) setTodoList(prev => prev.filter(x => x.id !== id));
  };

  const getColore = (a) => {
    if (a.colore) return a.colore;
    if (appTypes) { const t = appTypes.find(x => x.nome === a.tipo); if (t) return t.colore; }
    return C.pri;
  };

  // ── CALCOLI ──
  const todayApps = appointments.filter(a => a.data === t).sort((a, b) => a.ora.localeCompare(b.ora));
  const upcoming = [...appointments].filter(a => a.data > t).sort((a, b) => a.data.localeCompare(b.data) || a.ora.localeCompare(b.ora)).slice(0, 8);

  const apriEditApp = (a) => {
    setEditApp(a);
    setEditForm({ data: a.data, ora: a.ora, durata: a.durata, tipo: a.tipo, stato: a.stato || 'confermato', note: a.note || '' });
  };
  const salvaEditApp = () => {
    if (!editApp || !setAppointments) return;
    setAppointments(prev => prev.map(x => x.id === editApp.id ? { ...x, ...editForm, durata: Number(editForm.durata) } : x));
    setEditApp(null);
  };
  const eliminaEditApp = () => {
    if (!editApp || !setAppointments) return;
    if (!confirm('Eliminare questo appuntamento?')) return;
    setAppointments(prev => prev.filter(x => x.id !== editApp.id));
    setEditApp(null);
  };
  const eliminaAppuntamentoDiretto = (a) => {
    if (!setAppointments) return;
    if (!confirm('Eliminare questo appuntamento?')) return;
    setAppointments(prev => prev.filter(x => x.id !== a.id));
  };
  const domani = (() => { const d = new Date(t + 'T12:00'); d.setDate(d.getDate() + 1); return d.toISOString().slice(0,10); })();
  const domaniApps = appointments.filter(a => a.data === domani).sort((a, b) => a.ora.localeCompare(b.ora));

  const hInc = payments.filter(p => p.data === t).reduce((s, p) => s + Number(p.importo), 0);
  const speseMese = spese.filter(s => !s.ricorrente && s.data && s.data.startsWith(t.slice(0,7))).reduce((s, x) => s + Number(x.importo), 0);
  const speseAnnoTotale = kpiPeriodo ? kpiPeriodo.costi_totali : null;
  const margineAnno = kpiPeriodo ? kpiPeriodo.ebitda : null;
  const speseRicorrentiAnno = spese.filter(s => s.ricorrente).reduce((s, x) => {
    const m = { Mensile: 12, Bimestrale: 6, Trimestrale: 4, Semestrale: 2, Annuale: 1 }[x.frequenza] || 12;
    return s + Number(x.importo) * m;
  }, 0); // usata solo come nota informativa "proiezione a regime", non nel totale

  const promemoria = patients.flatMap(paz => (paz.annotazioni || []).filter(a => a.richiamo && !a.richiamo.fatto).map(a => ({ paz, ann: a, richiamo: a.richiamo }))).sort((a, b) => (a.richiamo.data || '').localeCompare(b.richiamo.data || ''));

  const CHART_PALETTE = [C.pri, C.acc, C.war, C.suc, '#7C3AED', C.dan, C.txl];
  const todoAttivi = todoList.filter(x => !x.fatto);
  const todoFatti = todoList.filter(x => x.fatto);

  /* ── POL-UI-017 R2 §2 — "Richiede attenzione" ─────────────────────────
     The mobile Home's priority area. It introduces NO new data: every
     input below is a value this component already had on screen in one of
     its widgets, just read once more and ranked.
       · richiami          — the same `richiami` prop the Richiami widget
                             renders, filtered by the same `stato === 'da_fare'`
                             + `dataScadenza` comparison it already uses;
       · scadenzeScadute   — straight from useControlloDati, which is only
                             computed at all when `homePermissions.
                             managementControl` is true (fail-closed: a user
                             without finance.management.read passes 0 and
                             the row simply never exists);
       · promemoria        — the same patient-annotation recalls the
                             "Attività e promemoria" widget lists;
       · todayApps         — the same list the Agenda widget renders;
       · consigli          — the same Poliedron advice rows, only when the
                             advice feature is actually active for this
                             studio (`consigliAttivi`).
     No backend call, no new table, no invented alert. */
  const isHomeWidgetOnScreen = (id) => visibleWidgets.some((item) => item.id === id && item.visible !== false);
  const attentionItems = buildHomeAttentionItems({
    today: t,
    nowTime: now.toTimeString().slice(0, 5),
    richiami,
    todayAppointments: todayApps,
    overduePlanDeadlines: homePermissions.managementControl ? (scadenzeScadute?.length || 0) : 0,
    // These two point INTO the page (their destination is a widget, not a
    // route), so they are only raised when that widget is actually on
    // screen for this user — a personalization that hides the widget also
    // removes the row, instead of leaving a tap that goes nowhere.
    overdueReminders: isHomeWidgetOnScreen('todo') ? promemoria.filter(p => p.richiamo.data < t).length : 0,
    unreadAdvice: consigliAttivi && isHomeWidgetOnScreen('consigli_ai') ? consigli.filter(c => !c.letto).length : 0,
    patientNameOfAppointment: (a) => {
      const p = patients.find(x => x.id === a.pazienteId);
      return p ? `${p.nome} ${p.cognome}` : '';
    },
  });

  /* Every destination here is an EXISTING route/handler already used by
     another widget on this page — the priority area is an entry point,
     never a second implementation of Richiami/Agenda/Scadenze. */
  const scrollToHomeWidget = (id) => {
    const frame = typeof document === 'undefined' ? null : document.querySelector(`.home-workspace [data-widget-id="${id}"]`);
    frame?.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
  };
  const runAttentionAction = (action) => {
    if (action === 'richiami') return onGoRichiami && onGoRichiami();
    if (action === 'agenda') return onGoAgenda && onGoAgenda();
    if (action === 'scadenze') return setDetailModal('scadenze');
    if (action === 'todo') return scrollToHomeWidget('todo');
    if (action === 'consigli') return scrollToHomeWidget('consigli_ai');
    return undefined;
  };
  const ATTENTION_TONE = { danger: C.dan, warn: C.war, info: C.pri };

  // `elevated`: opt-in variant with a more evident surface/border/shadow —
  // used only where explicitly asked (Preventivi widget, POL-UX-002 section
  // 11) so the default pastel/flat look other StatCard callers rely on
  // (Richiami, Scadenze, Ortodonzia, Statistiche) doesn't silently change.
  const StatCard = ({ label, value, sub, color = C.pri, bg, onClick, urgent, elevated }) => (
    <div onClick={onClick} style={{
      background: bg || (elevated ? C.sur : color + '12'),
      borderRadius: 12, padding: '12px 14px',
      border: `1px solid ${elevated ? color + '40' : color + '25'}`,
      boxShadow: elevated ? '0 6px 16px rgba(31,49,78,.08)' : 'none',
      cursor: onClick ? 'pointer' : 'default', position: 'relative',
    }}>
      {urgent && <div style={{ position: 'absolute', top: 8, right: 8, width: 8, height: 8, borderRadius: '50%', background: C.dan }} />}
      <div style={{ fontSize: 10, fontWeight: 800, color, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 900, color, lineHeight: 1.1 }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: color + 'AA', marginTop: 3 }}>{sub}</div>}
      {onClick && <div style={{ position: 'absolute', bottom: 8, right: 10, fontSize: 12, color: color + '80' }}>›</div>}
    </div>
  );

  return (
    <div className="home-page">
      {/* ── SETTINGS MODAL ── */}
      {settingsOpen && (
        <Modal title={<><Ic n="set" s={15} c={C.txt} /> Personalizza Home</>} onClose={() => setSettingsOpen(false)} wide>
          {/* TAB SWITCHER */}
          <div style={{ display: 'flex', background: C.bg, borderRadius: 9, border: `1px solid ${C.brd}`, marginBottom: 14, overflow: 'hidden' }}>
            {[['widgets','box','Widget'],['azioni','zap','Azioni rapide'],['colori','palette','Colori card']].map(([id, ic, lbl]) => (
              <button key={id} onClick={() => setThemeTab(id)} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '9px 0', border: 'none', background: themeTab === id ? C.pri : 'transparent', color: themeTab === id ? '#fff' : C.txm, fontWeight: 700, fontSize: 12, cursor: 'pointer' }}><Ic n={ic} s={12} c="currentColor" />{lbl}</button>
            ))}
          </div>

          {/* TAB WIDGET */}
          {themeTab === 'widgets' && <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <div style={{ fontSize: 12, color: C.txm }}>Aggiungi o rimuovi widget. Riordina con Sposta su/giù (anche su touch) oppure trascina; usa S/M/L per ridimensionare.</div>
              <div style={{ display: 'flex', gap: 4, background: C.bg, borderRadius: 8, padding: 3, flexShrink: 0 }}>
                {[['desktop','Desktop'],['mobile','Mobile']].map(([id,label]) => <button key={id} type="button" onClick={() => setPreviewMode(id)}
                  style={{ border: 'none', borderRadius: 6, padding: '5px 9px', cursor: 'pointer', fontSize: 11, fontWeight: 800, background: previewMode===id ? C.pri : 'transparent', color: previewMode===id ? '#fff' : C.txm }}>{label}</button>)}
              </div>
            </div>
            <div style={{ maxHeight: 210, overflowY: 'auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(210px,1fr))', gap: 6, marginBottom: 14 }}>
              {availableWidgetCatalog.map((widget) => {
                if (widget.id === 'consigli_ai' && !consigliAttivi) return null;
                if (widget.id === 'ortodonzia' && !isDentistico) return null;
                if (widget.id === 'fisio' && !isFisio) return null;
                const item = draftWidgets.find((entry) => entry.id === widget.id);
                return <div key={widget.id} style={{ display:'flex',alignItems:'center',justifyContent:'space-between',gap:8,padding:'9px 10px',background:C.bg,borderRadius:9,border:`1px solid ${C.brd}` }}>
                  <div style={{ minWidth:0 }}><div style={{ fontSize:10,color:C.txl,fontWeight:800,textTransform:'uppercase' }}>{widget.category}</div><div style={{ display:'flex',alignItems:'center',gap:6,fontSize:12,fontWeight:700,color:item?.visible ? C.txt : C.txl }}><Ic n={widget.ic} s={12} c="currentColor" />{widget.label}</div></div>
                  <button type="button" onClick={() => { setDraftInherits(false); setDraftWidgets((layout) => setHomeWidgetVisibility(layout,widget.id,!item?.visible)); }}
                    style={{ border:'none',borderRadius:8,padding:'6px 9px',cursor:'pointer',fontSize:11,fontWeight:800,background:item?.visible ? C.danL : C.priL,color:item?.visible ? C.dan : C.pri }}>{item?.visible ? 'Rimuovi' : 'Aggiungi'}</button>
                </div>;
              })}
            </div>
            <WidgetWorkspace layout={visibleDraftWidgets} editing previewMode={previewMode}
              onMove={(source,target) => { setDraftInherits(false); setDraftWidgets((layout) => moveHomeWidget(layout,source,target)); }}
              onMoveByOffset={(id,offset) => { setDraftInherits(false); setDraftWidgets((layout) => moveHomeWidgetByOffset(layout,id,offset)); }}
              onResize={(id,size) => { setDraftInherits(false); setDraftWidgets((layout) => setHomeWidgetSize(layout,id,size)); }}>
              {visibleDraftWidgets.filter((item) => item.visible).map((item) => {
                const widget=HOME_WIDGET_REGISTRY.find((entry)=>entry.id===item.id);
                return widget ? <div key={item.id} style={{ minHeight:72,padding:12,borderRadius:10,background:C.sur,border:`1px solid ${C.brd}` }}>
                  <div style={{ display:'flex',alignItems:'center',gap:7,fontWeight:800,fontSize:13 }}><Ic n={widget.ic} s={13} c={C.pri} />{widget.label}</div>
                  <div style={{ fontSize:11,color:C.txl,marginTop:5 }}>Anteprima layout · contenuto invariato</div>
                </div> : null;
              })}
            </WidgetWorkspace>
            {layoutError && <div role="alert" style={{ marginTop:10,fontSize:12,color:C.dan,fontWeight:700 }}>{layoutError}</div>}
            <div style={{ marginTop:10,fontSize:11,color:C.txm }}>
              {draftInherits ? `Eredita il predefinito ${inheritedSource === 'studio' ? 'dello studio' : inheritedSource === 'role' ? 'del ruolo/verticale' : 'della piattaforma'}.` : 'Personalizzazione personale: modifica solo la tua presentazione.'}
            </div>
            {/* POL-UI-015 round 4: `flexWrap` + a non-shrinkable primary
                action. This row holds four buttons and had neither, so on a
                phone (the Product Owner's actual test device is an iPhone)
                the browser squeezed every button to min-content and wrapped
                their labels mid-word, leaving "Salva Home" a sliver next to
                "Annulla" — a hostile hit target for the modal's primary
                action. Now the row wraps and the primary action keeps its
                full width and a 44px touch height. */}
            <div style={{ display:'flex',gap:8,marginTop:12,flexWrap:'wrap',alignItems:'center' }}>
              <button type="button" onClick={resetHomeCustomization} style={{ padding:'9px 12px',background:C.danL,border:'none',borderRadius:9,color:C.dan,fontWeight:700,fontSize:12,cursor:'pointer' }}>↺ Reset al default {inheritedSource === 'studio' ? 'studio' : inheritedSource === 'role' ? 'ruolo' : 'piattaforma'}</button>
              {isStudioAdmin && <button type="button" disabled={layoutSaving} onClick={saveStudioDefault} style={{ padding:'9px 12px',background:C.priL,border:`1px solid ${C.pri}33`,borderRadius:9,color:C.pri,fontWeight:700,fontSize:12,cursor:layoutSaving?'progress':'pointer',opacity:layoutSaving?0.6:1 }}>Salva come default studio</button>}
              <button type="button" onClick={() => setSettingsOpen(false)} style={{ marginLeft:'auto',padding:'9px 14px',background:C.bg,border:`1px solid ${C.brd}`,borderRadius:9,color:C.txm,fontWeight:700,fontSize:12,cursor:'pointer' }}>Annulla</button>
              {/* POL-UI-015 round 3: `disabled` and the disabled styling are
                  now derived from the SAME flag, so this control can never
                  again look enabled while ignoring clicks. */}
              <button type="button" disabled={layoutSaving} onClick={saveHomeCustomization} style={{ padding:'9px 16px',background:C.pri,border:'none',borderRadius:9,color:'#fff',fontWeight:800,fontSize:12,cursor:layoutSaving?'progress':'pointer',opacity:layoutSaving?0.6:1,flexShrink:0,whiteSpace:'nowrap',minHeight:44 }}>{layoutSaving ? 'Salvataggio…' : 'Salva Home'}</button>
            </div>
          </>}

          {/* TAB AZIONI RAPIDE */}
          {themeTab === 'azioni' && (() => {
            const qaItem = draftWidgets.find((w) => w.id === 'quick_actions');
            const chosenIds = qaItem?.config?.actions?.length ? qaItem.config.actions : DEFAULT_QUICK_ACTION_IDS;
            const allowed = filterQuickActionsCatalog({ permissions: homePermissions, features, vertical: si?.vertical });
            const allowedIds = new Set(allowed.map((a) => a.id));
            const active = chosenIds.filter((id) => allowedIds.has(id));
            const available = allowed.filter((a) => !active.includes(a.id));
            const updateActions = (nextIds) => { setDraftInherits(false); setDraftWidgets((layout) => setHomeWidgetConfig(layout, 'quick_actions', { actions: nextIds })); };
            const move = (id, offset) => {
              const idx = active.indexOf(id);
              const target = idx + offset;
              if (target < 0 || target >= active.length) return;
              const next = [...active];
              [next[idx], next[target]] = [next[target], next[idx]];
              updateActions(next);
            };
            return (
              <>
                <div style={{ fontSize: 12, color: C.txm, marginBottom: 12 }}>Scegli quali azioni rapide mostrare in Home e in che ordine. Le azioni non disponibili per il tuo ruolo/piano non sono elencate.</div>
                <div style={{ fontSize: 10, color: C.txl, fontWeight: 800, textTransform: 'uppercase', marginBottom: 6 }}>Attive</div>
                <div style={{ display: 'grid', gap: 6, marginBottom: 14 }}>
                  {active.length === 0 && <div style={{ fontSize: 12, color: C.txl, padding: '8px 0' }}>Nessuna azione rapida attiva.</div>}
                  {active.map((id, i) => {
                    const action = getQuickAction(id);
                    if (!action) return null;
                    return (
                      <div key={id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 10px', background: C.bg, borderRadius: 9, border: `1px solid ${C.brd}` }}>
                        <Ic n={action.ic} s={13} c={C.pri} />
                        <span style={{ flex: 1, fontSize: 12, fontWeight: 700 }}>{action.label}</span>
                        <button type="button" disabled={i === 0} onClick={() => move(id, -1)} style={{ minWidth: 32, minHeight: 32, border: `1px solid ${C.brd}`, borderRadius: 7, background: C.sur, cursor: i === 0 ? 'not-allowed' : 'pointer', opacity: i === 0 ? 0.4 : 1 }} aria-label={`Sposta su ${action.label}`}>↑</button>
                        <button type="button" disabled={i === active.length - 1} onClick={() => move(id, 1)} style={{ minWidth: 32, minHeight: 32, border: `1px solid ${C.brd}`, borderRadius: 7, background: C.sur, cursor: i === active.length - 1 ? 'not-allowed' : 'pointer', opacity: i === active.length - 1 ? 0.4 : 1 }} aria-label={`Sposta giù ${action.label}`}>↓</button>
                        <button type="button" onClick={() => updateActions(active.filter((x) => x !== id))} style={{ minWidth: 32, minHeight: 32, border: 'none', borderRadius: 7, background: C.danL, color: C.dan, fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }} aria-label={`Rimuovi ${action.label}`}><Ic n="x" s={13} c={C.dan} /></button>
                      </div>
                    );
                  })}
                </div>
                {available.length > 0 && <>
                  <div style={{ fontSize: 10, color: C.txl, fontWeight: 800, textTransform: 'uppercase', marginBottom: 6 }}>Disponibili</div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 6 }}>
                    {available.map((action) => (
                      <button key={action.id} type="button" onClick={() => updateActions([...active, action.id])}
                        style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 10px', background: '#fff', border: `1px solid ${C.brd}`, borderRadius: 9, cursor: 'pointer', fontSize: 12, fontWeight: 700, color: C.txt, textAlign: 'left' }}>
                        <Ic n={action.ic} s={13} c={C.pri} /><span style={{ flex: 1 }}>{action.label}</span><span style={{ color: C.pri, fontWeight: 800 }}>+</span>
                      </button>
                    ))}
                  </div>
                </>}
                <div style={{ display: 'flex', gap: 8, marginTop: 16, flexWrap: 'wrap', alignItems: 'center' }}>
                  <button type="button" onClick={() => setSettingsOpen(false)} style={{ marginLeft: 'auto', padding: '9px 14px', background: C.bg, border: `1px solid ${C.brd}`, borderRadius: 9, color: C.txm, fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>Annulla</button>
                  {/* POL-UI-015 round 3: same fix as the Widget tab's Salva button. */}
                  <button type="button" disabled={layoutSaving} onClick={saveHomeCustomization} style={{ padding: '9px 16px', background: C.pri, border: 'none', borderRadius: 9, color: '#fff', fontWeight: 800, fontSize: 12, cursor: layoutSaving ? 'progress' : 'pointer', opacity: layoutSaving ? 0.6 : 1, flexShrink: 0, whiteSpace: 'nowrap', minHeight: 44 }}>{layoutSaving ? 'Salvataggio…' : 'Salva Home'}</button>
                </div>
                {layoutError && <div role="alert" style={{ marginTop: 10, fontSize: 12, color: C.dan, fontWeight: 700 }}>{layoutError}</div>}
              </>
            );
          })()}

          {/* TAB COLORI */}
          {themeTab === 'colori' && <>
            <div style={{ fontSize: 12, color: C.txm, marginBottom: 14 }}>Scegli il colore per ogni card del pannello economico.</div>
            {[
              ['incMese', 'Incassato mese'],
              ['incAnno', 'Incassato anno'],
              ['lucaMese', 'Incasso mese'],
              ['lucaAnno', 'Incasso anno'],
              ['speseMese', 'Spese mese'],
              ['speseAnno', 'Spese anno'],
              ['margine', 'Margine stimato'],
              ['esegDaInc', 'Eseguito da incassare'],
              ['accNonEseg', 'Accettato da eseguire'],
              ['totAccettati', 'Totale accettati'],
            ].map(([key, label]) => (
              <div key={key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0', borderBottom: `1px solid ${C.brd}` }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: C.txt }}>{label}</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', maxWidth: 160, justifyContent: 'flex-end' }}>
                    {PALETTE.map(col => (
                      <button key={col} onClick={() => { const next = { ...theme, [key]: col }; setTheme(next); saveTheme(next); }}
                        style={{ width: 18, height: 18, borderRadius: 4, background: col, border: theme[key] === col ? '2px solid #000' : '1px solid rgba(0,0,0,0.15)', cursor: 'pointer', padding: 0, flexShrink: 0 }} />
                    ))}
                  </div>
                  <div style={{ width: 28, height: 28, borderRadius: 6, background: theme[key], border: '2px solid rgba(0,0,0,0.15)', flexShrink: 0 }} />
                </div>
              </div>
            ))}
            <button onClick={() => { setTheme(THEME_DEFAULT); saveTheme(THEME_DEFAULT); }} style={{ width: '100%', padding: '9px', marginTop: 12, background: C.danL, border: 'none', borderRadius: 9, color: C.dan, fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>↺ Ripristina colori predefiniti</button>
          </>}
        </Modal>
      )}

      {/* ── MODALS ── */}
      {detailModal === 'attesa' && (
        <Modal title={<><Ic n="clk" s={15} c={C.txt} /> Preventivi in attesa</>} onClose={() => setDetailModal(null)} wide>
          <div style={{ background: C.purL, borderRadius: 10, padding: '10px 14px', marginBottom: 12, display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ fontWeight: 700, color: C.pur }}>{preventiviAttesa.length} preventivi in attesa di risposta</span>
          </div>
          {preventiviAttesa.length === 0 && <div style={{ textAlign: 'center', color: C.txl, padding: 30 }}>Nessun preventivo in attesa</div>}
          {preventiviAttesa.map(pl => {
            const paz = patients.find(x => x.id === pl.pazienteId);
            if (!paz) return null;
            const tot = calcPlanTot(pl);
            return (
              <Crd key={pl.id} style={{ marginBottom: 8, borderLeft: `3px solid ${C.pur}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div onClick={() => { setDetailModal(null); onOpenPaz(paz, 'piani'); }} style={{ fontWeight: 700, color: C.pri, cursor: 'pointer', fontSize: 13 }}>{paz.nome} {paz.cognome} ›</div>
                    <div style={{ fontSize: 11, color: C.txm }}>{pl.titolo} · {fmtD(pl.data)}</div>
                  </div>
                  <span style={{ fontWeight: 900, color: C.pur }}>{fmt(tot)}</span>
                </div>
              </Crd>
            );
          })}
        </Modal>
      )}

      {detailModal === 'rifiutati' && (
        <Modal title={<><Ic n="x" s={15} c={C.txt} /> Preventivi rifiutati</>} onClose={() => setDetailModal(null)} wide>
          <div style={{ background: C.danL, borderRadius: 10, padding: '10px 14px', marginBottom: 12 }}>
            <span style={{ fontWeight: 700, color: C.dan }}>{preventiviRifiutati.length} preventivi non accettati</span>
          </div>
          {preventiviRifiutati.length === 0 && <div style={{ textAlign: 'center', color: C.txl, padding: 30 }}>Nessun preventivo rifiutato</div>}
          {preventiviRifiutati.map(pl => {
            const paz = patients.find(x => x.id === pl.pazienteId);
            if (!paz) return null;
            const tot = calcPlanTot(pl);
            return (
              <Crd key={pl.id} style={{ marginBottom: 8, borderLeft: `3px solid ${C.dan}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div onClick={() => { setDetailModal(null); onOpenPaz(paz, 'piani'); }} style={{ fontWeight: 700, color: C.pri, cursor: 'pointer', fontSize: 13 }}>{paz.nome} {paz.cognome} ›</div>
                    <div style={{ fontSize: 11, color: C.txm }}>{pl.titolo} · {fmtD(pl.data)}</div>
                  </div>
                  <span style={{ fontWeight: 900, color: C.dan }}>{fmt(tot)}</span>
                </div>
              </Crd>
            );
          })}
        </Modal>
      )}

      {detailModal === 'accettati' && (
        <Modal title={<><Ic n="ok" s={15} c={C.txt} /> Piani accettati</>} onClose={() => setDetailModal(null)} wide>
          <div style={{ background: '#E8FAF9', borderRadius: 10, padding: '10px 14px', marginBottom: 12, display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ fontWeight: 700, color: C.acc }}>Totale accettato</span>
            <span style={{ fontWeight: 900, fontSize: 18, color: C.acc }}>{fmt(totAccettati)}</span>
          </div>
          {preventiviAccettati.map(pl => { const paz = patients.find(x => x.id === pl.pazienteId); if (!paz) return null; const done = pl.voci.filter(v => v.eseguita).length; const pct = pl.voci.length ? Math.round(done/pl.voci.length*100) : 0; return (
            <Crd key={pl.id} style={{ marginBottom: 8, borderLeft: `3px solid ${C.acc}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                <div style={{ flex: 1 }}>
                  <div onClick={() => { setDetailModal(null); onOpenPaz(paz, 'piani'); }} style={{ fontWeight: 700, color: C.pri, cursor: 'pointer', fontSize: 13 }}>{paz.nome} {paz.cognome} ›</div>
                  <div style={{ fontSize: 11, color: C.txm }}>{pl.titolo}</div>
                  <div style={{ background: C.bg, borderRadius: 3, height: 4, marginTop: 5 }}><div style={{ height: '100%', width: `${pct}%`, background: C.acc, borderRadius: 3 }} /></div>
                  <div style={{ fontSize: 10, color: C.txl, marginTop: 2 }}>{done}/{pl.voci.length} eseguite</div>
                </div>
                <span style={{ fontWeight: 900, color: C.acc }}>{fmt(calcPlanTot(pl))}</span>
              </div>
            </Crd>
          ); })}
        </Modal>
      )}

      {detailModal === 'lucaMese' && (
        <Modal title={<><Ic n="brief" s={15} c={C.txt} /> Incasso — questo mese</>} onClose={() => setDetailModal(null)} wide>
          <div style={{ background: '#F5F3FF', borderRadius: 10, padding: '10px 14px', marginBottom: 12, display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ fontWeight: 700, color: '#7C3AED' }}>Totale mese</span>
            <span style={{ fontWeight: 900, fontSize: 18, color: '#7C3AED' }}>{fmt(incassoLucaMese)}</span>
          </div>
          <div style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: C.suc, textTransform: 'uppercase', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 5 }}><Ic n="home" s={11} c={C.suc} />Studio ({fmt(mInc)})</div>
            {payments.filter(p => p.data && p.data.startsWith(t.slice(0,7))).sort((a,b) => b.data.localeCompare(a.data)).map(pay => {
              const paz = patients.find(x => x.id === pay.pazienteId);
              return <Crd key={pay.id} style={{ marginBottom: 6, borderLeft: `3px solid ${C.suc}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div><div style={{ fontWeight: 700, fontSize: 13 }}>{paz ? `${paz.nome} ${paz.cognome}` : '—'}</div><div style={{ fontSize: 11, color: C.txm }}>{fmtD(pay.data)} · {pay.metodo}</div></div>
                  <span style={{ fontWeight: 800, color: C.suc }}>{fmt(pay.importo)}</span>
                </div>
              </Crd>;
            })}
            {payments.filter(p => p.data && p.data.startsWith(t.slice(0,7))).length === 0 && <div style={{ fontSize: 12, color: C.txl, padding: '8px 0' }}>Nessun pagamento studio questo mese</div>}
          </div>
          {extMese > 0 && <div>
            <div style={{ fontSize: 11, fontWeight: 800, color: '#7C3AED', textTransform: 'uppercase', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 5 }}><Ic n="shake" s={11} c="#7C3AED" />Collaborazioni ({fmt(extMese)})</div>
            {pagExt.filter(p => p.data && p.data.startsWith(t.slice(0,7))).map(pag => (
              <Crd key={pag.id} style={{ marginBottom: 6, borderLeft: '3px solid #7C3AED' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div><div style={{ fontWeight: 700, fontSize: 13 }}>{pag.collaborazione_nome}</div><div style={{ fontSize: 11, color: C.txm }}>{fmtD(pag.data)} · {pag.metodo}</div></div>
                  <span style={{ fontWeight: 800, color: '#7C3AED' }}>{fmt(pag.importo)}</span>
                </div>
              </Crd>
            ))}
          </div>}
        </Modal>
      )}

      {detailModal === 'lucaAnno' && (
        <Modal title={<><Ic n="brief" s={15} c={C.txt} /> Incasso — {anno}</>} onClose={() => setDetailModal(null)} wide>
          <div style={{ background: '#F5F3FF', borderRadius: 10, padding: '10px 14px', marginBottom: 12, display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ fontWeight: 700, color: '#7C3AED' }}>Totale anno {anno}</span>
            <span style={{ fontWeight: 900, fontSize: 18, color: '#7C3AED' }}>{fmt(incassoLucaAnno)}</span>
          </div>
          <div style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: C.suc, textTransform: 'uppercase', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 5 }}><Ic n="home" s={11} c={C.suc} />Studio ({fmt(aInc)})</div>
            {(() => {
              const mesiStudio = {};
              payments.filter(p => p.data && p.data.startsWith(anno)).forEach(p => { const m = p.data.slice(0,7); mesiStudio[m] = (mesiStudio[m] || 0) + Number(p.importo); });
              const MESI = ['Gen','Feb','Mar','Apr','Mag','Giu','Lug','Ago','Set','Ott','Nov','Dic'];
              return Object.entries(mesiStudio).sort((a,b) => b[0].localeCompare(a[0])).map(([m, tot]) => (
                <Crd key={m} style={{ marginBottom: 6, borderLeft: `3px solid ${C.suc}` }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontWeight: 600 }}>{MESI[parseInt(m.slice(5))-1]} {m.slice(0,4)}</span>
                    <span style={{ fontWeight: 800, color: C.suc }}>{fmt(tot)}</span>
                  </div>
                </Crd>
              ));
            })()}
          </div>
          {extAnno > 0 && <div>
            <div style={{ fontSize: 11, fontWeight: 800, color: '#7C3AED', textTransform: 'uppercase', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 5 }}><Ic n="shake" s={11} c="#7C3AED" />Collaborazioni ({fmt(extAnno)})</div>
            {(() => {
              const mesiExt = {};
              pagExt.filter(p => p.data && p.data.startsWith(anno)).forEach(p => { const key = p.collaborazione_nome + '|' + p.data.slice(0,7); mesiExt[key] = (mesiExt[key] || { nome: p.collaborazione_nome, mese: p.data.slice(0,7), tot: 0 }); mesiExt[key].tot += Number(p.importo); });
              const MESI = ['Gen','Feb','Mar','Apr','Mag','Giu','Lug','Ago','Set','Ott','Nov','Dic'];
              return Object.values(mesiExt).sort((a,b) => b.mese.localeCompare(a.mese)).map((x, i) => (
                <Crd key={i} style={{ marginBottom: 6, borderLeft: '3px solid #7C3AED' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <div><span style={{ fontWeight: 600 }}>{x.nome}</span><div style={{ fontSize: 11, color: C.txl }}>{MESI[parseInt(x.mese.slice(5))-1]} {x.mese.slice(0,4)}</div></div>
                    <span style={{ fontWeight: 800, color: '#7C3AED' }}>{fmt(x.tot)}</span>
                  </div>
                </Crd>
              ));
            })()}
          </div>}
        </Modal>
      )}

      {detailModal === 'spese' && (
        <Modal title={<><Ic n="eur" s={15} c={C.txt} /> Spese</>} onClose={() => setDetailModal(null)} wide>
          <div style={{ background: C.danL, borderRadius: 10, padding: '10px 14px', marginBottom: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
              <span style={{ fontWeight: 700, color: C.dan }}>Costi {anno} (dato reale a oggi)</span>
              <span style={{ fontWeight: 900, fontSize: 18, color: C.dan }}>{speseAnnoTotale == null ? '—' : fmt(speseAnnoTotale)}</span>
            </div>
            {speseRicorrentiAnno > 0 && <div style={{ fontSize: 11, color: C.txm }}>Se tutte le ricorrenti attuali restassero invariate un anno intero: {fmt(speseRicorrentiAnno)}/anno a regime</div>}
          </div>
          {margineAnno != null && margineAnno !== 0 && (
            <div style={{ background: margineAnno > 0 ? C.sucL : C.danL, borderRadius: 10, padding: '8px 14px', marginBottom: 12, display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontWeight: 700, color: margineAnno > 0 ? C.suc : C.dan }}>EBITDA {anno} (dato reale, stessa fonte di Controllo di Gestione)</span>
              <span style={{ fontWeight: 900, color: margineAnno > 0 ? C.suc : C.dan }}>{margineAnno > 0 ? '+' : ''}{fmt(margineAnno)}</span>
            </div>
          )}
          {spese.filter(s => s.ricorrente).length > 0 && (
            <>
              <div style={{ fontSize: 11, fontWeight: 800, color: C.war, textTransform: 'uppercase', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 5 }}><Ic n="refresh" s={11} c={C.war} />Ricorrenti</div>
              {spese.filter(s => s.ricorrente).map(s => {
                const m = { Mensile: 12, Bimestrale: 6, Trimestrale: 4, Semestrale: 2, Annuale: 1 }[s.frequenza] || 12;
                return <Crd key={s.id} style={{ marginBottom: 6, borderLeft: `3px solid ${C.war}` }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <div><div style={{ fontWeight: 700, fontSize: 13 }}>{s.titolo}</div><div style={{ fontSize: 11, color: C.txm }}>{s.frequenza} · {fmt(s.importo)} × {m}</div></div>
                    <span style={{ fontWeight: 800, color: C.war }}>{fmt(Number(s.importo) * m)}/anno</span>
                  </div>
                </Crd>;
              })}
            </>
          )}
          <div style={{ fontSize: 11, fontWeight: 800, color: C.dan, textTransform: 'uppercase', margin: '12px 0 8px', display: 'flex', alignItems: 'center', gap: 5 }}><Ic n="clip" s={11} c={C.dan} />Questo mese ({fmt(speseMese)})</div>
          {spese.filter(s => !s.ricorrente && s.data && s.data.startsWith(t.slice(0,7))).length === 0
            ? <div style={{ textAlign: 'center', color: C.txl, padding: 16 }}>Nessuna spesa questo mese</div>
            : spese.filter(s => !s.ricorrente && s.data && s.data.startsWith(t.slice(0,7))).map(s => (
              <Crd key={s.id} style={{ marginBottom: 6, borderLeft: `3px solid ${C.dan}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <div><div style={{ fontWeight: 700, fontSize: 13 }}>{s.titolo}</div><div style={{ fontSize: 11, color: C.txm }}>{s.categoria}</div></div>
                  <span style={{ fontWeight: 800, color: C.dan }}>{fmt(s.importo)}</span>
                </div>
              </Crd>
            ))
          }
        </Modal>
      )}

      {detailModal === 'esegDaInc' && (
        <Modal title={<><Ic n="eur" s={15} c={C.txt} /> Eseguito da incassare</>} onClose={() => setDetailModal(null)} wide>
          <div style={{ background: C.danL, borderRadius: 10, padding: '10px 14px', marginBottom: 12, display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ fontWeight: 700, color: C.dan }}>Totale da incassare</span>
            <span style={{ fontWeight: 900, fontSize: 18, color: C.dan }}>{fmt(totEsegDaInc)}</span>
          </div>
          {esegDaInc.map(({ paz, voci, tot }) => (
            <Crd key={paz.id} style={{ marginBottom: 9, borderLeft: `3px solid ${C.dan}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <div onClick={() => { setDetailModal(null); onOpenPaz(paz, 'piani'); }} style={{ fontWeight: 700, color: C.pri, cursor: 'pointer' }}>{paz.nome} {paz.cognome} ›</div>
                <span style={{ fontWeight: 900, color: C.dan }}>{fmt(tot)}</span>
              </div>
              {voci.map((v, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderTop: `1px solid ${C.brd}`, fontSize: 11 }}>
                  <span>{v.prestazione}{v.dente ? ` · d.${v.dente}` : ''}</span>
                  <span style={{ fontWeight: 700, color: C.dan }}>{fmt(v.prezzoScontato)}</span>
                </div>
              ))}
            </Crd>
          ))}
          {esegDaInc.length === 0 && <div style={{ textAlign: 'center', color: C.txl, padding: 30 }}>Nessuna prestazione eseguita da incassare</div>}
        </Modal>
      )}

      {detailModal === 'accNonEseg' && (
        <Modal title={<><Ic n="ok" s={15} c={C.txt} /> Accettato da eseguire</>} onClose={() => setDetailModal(null)} wide>
          <div style={{ background: C.purL, borderRadius: 10, padding: '10px 14px', marginBottom: 12, display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ fontWeight: 700, color: C.pur }}>Totale accettato da eseguire</span>
            <span style={{ fontWeight: 900, fontSize: 18, color: C.pur }}>{fmt(totAccNonEseg)}</span>
          </div>
          {accNonEseg.map(({ paz, voci, tot }) => (
            <Crd key={paz.id} style={{ marginBottom: 9, borderLeft: `3px solid ${C.pur}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <div onClick={() => { setDetailModal(null); onOpenPaz(paz, 'piani'); }} style={{ fontWeight: 700, color: C.pri, cursor: 'pointer' }}>{paz.nome} {paz.cognome} ›</div>
                <span style={{ fontWeight: 900, color: C.pur }}>{fmt(tot)}</span>
              </div>
              {voci.slice(0,4).map((v, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderTop: `1px solid ${C.brd}`, fontSize: 11 }}>
                  <span>{v.prestazione}{v.dente ? ` · d.${v.dente}` : ''}</span>
                  <span style={{ fontWeight: 700, color: C.pur }}>{fmt(v.prezzo)}</span>
                </div>
              ))}
              {voci.length > 4 && <div style={{ fontSize: 10, color: C.txl, textAlign: 'center', marginTop: 4 }}>+{voci.length-4} altre</div>}
            </Crd>
          ))}
        </Modal>
      )}

      {detailModal === 'scadenze' && (
        <Modal title={<><Ic n="cal" s={15} c={C.txt} /> Scadenze pagamento</>} onClose={() => setDetailModal(null)} wide>
          {scadenzePagamento.length === 0 && <div style={{ textAlign: 'center', color: C.txl, padding: 30 }}>Nessuna scadenza impostata</div>}
          {scadenzeScadute.length > 0 && (
            <>
              <div style={{ fontSize: 11, fontWeight: 800, color: C.dan, textTransform: 'uppercase', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 5 }}><Ic n="warn" s={11} c={C.dan} />Scadute ({scadenzeScadute.length})</div>
              {scadenzeScadute.map((s, i) => (
                <Crd key={i} style={{ marginBottom: 8, borderLeft: `3px solid ${C.dan}` }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div onClick={() => { setDetailModal(null); onOpenPaz(s.paz, 'paga'); }} style={{ fontWeight: 700, color: C.pri, cursor: 'pointer', fontSize: 13 }}>{s.paz.nome} {s.paz.cognome} ›</div>
                      <div style={{ fontSize: 11, color: C.txm }}>{s.pl.titolo}</div>
                      <div style={{ fontSize: 11, color: C.dan, fontWeight: 700 }}>Scadenza: {fmtD(s.scadenza)}</div>
                    </div>
                    <span style={{ fontWeight: 900, color: C.dan, fontSize: 16 }}>{fmt(s.importo)}</span>
                  </div>
                </Crd>
              ))}
            </>
          )}
          {scadenzeProssime.length > 0 && (
            <>
              <div style={{ fontSize: 11, fontWeight: 800, color: C.war, textTransform: 'uppercase', margin: '12px 0 8px', display: 'flex', alignItems: 'center', gap: 5 }}><Ic n="cal" s={11} c={C.war} />Prossime 30 giorni ({scadenzeProssime.length})</div>
              {scadenzeProssime.map((s, i) => (
                <Crd key={i} style={{ marginBottom: 8, borderLeft: `3px solid ${C.war}` }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div onClick={() => { setDetailModal(null); onOpenPaz(s.paz, 'paga'); }} style={{ fontWeight: 700, color: C.pri, cursor: 'pointer', fontSize: 13 }}>{s.paz.nome} {s.paz.cognome} ›</div>
                      <div style={{ fontSize: 11, color: C.txm }}>{s.pl.titolo}</div>
                      <div style={{ fontSize: 11, color: C.war, fontWeight: 700 }}>Scadenza: {fmtD(s.scadenza)}</div>
                    </div>
                    <span style={{ fontWeight: 900, color: C.war, fontSize: 16 }}>{fmt(s.importo)}</span>
                  </div>
                </Crd>
              ))}
            </>
          )}
          {scadenzeScadute.length === 0 && scadenzeProssime.length === 0 && scadenzePagamento.length > 0 && (
            <div style={{ textAlign: 'center', color: C.txl, padding: 30 }}>Tutte le scadenze sono lontane</div>
          )}
        </Modal>
      )}

      {detailModal === 'orto' && (
        <Modal title={<><Ic n="tooth" s={15} c={C.txt} /> Ortodonzia — mascherine</>} onClose={() => setDetailModal(null)} wide>
          {pianiOrto.length === 0 && <div style={{ textAlign: 'center', color: C.txl, padding: 30 }}>Nessun piano ortodontico attivo</div>}
          {pianiOrto.filter(o => o.cambioScaduto).length > 0 && (
            <>
              <div style={{ fontSize: 11, fontWeight: 800, color: C.dan, textTransform: 'uppercase', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 5 }}><Ic n="warn" s={11} c={C.dan} />Cambio mascherina scaduto</div>
              {pianiOrto.filter(o => o.cambioScaduto).map(o => (
                <Crd key={o.pl.id} style={{ marginBottom: 8, borderLeft: `3px solid ${C.dan}` }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div onClick={() => { setDetailModal(null); onOpenPaz(o.paz, 'piani'); }} style={{ fontWeight: 700, color: C.pri, cursor: 'pointer', fontSize: 13 }}>{o.paz.nome} {o.paz.cognome} ›</div>
                      <div style={{ fontSize: 11, color: C.txm }}>Mascherina {o.cons}/{o.tot || '?'} · prevista il {fmtD(o.prossima)}</div>
                    </div>
                    <Bdg ch={<span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><Ic n="warn" s={10} c={C.dan} />Scaduto</span>} co={C.dan} />
                  </div>
                </Crd>
              ))}
            </>
          )}
          {pianiOrto.filter(o => !o.cambioScaduto && !o.completato).length > 0 && (
            <>
              <div style={{ fontSize: 11, fontWeight: 800, color: C.pur, textTransform: 'uppercase', margin: '12px 0 8px', display: 'flex', alignItems: 'center', gap: 5 }}><Ic n="refresh" s={11} c={C.pur} />In corso</div>
              {pianiOrto.filter(o => !o.cambioScaduto && !o.completato).map(o => {
                const pct = o.tot > 0 ? Math.round(o.cons / o.tot * 100) : 0;
                return (
                  <Crd key={o.pl.id} style={{ marginBottom: 8, borderLeft: `3px solid ${C.pur}` }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                      <div onClick={() => { setDetailModal(null); onOpenPaz(o.paz, 'piani'); }} style={{ fontWeight: 700, color: C.pri, cursor: 'pointer', fontSize: 13 }}>{o.paz.nome} {o.paz.cognome} ›</div>
                      <span style={{ fontWeight: 800, color: C.pur }}>{o.cons}/{o.tot || '?'}</span>
                    </div>
                    {o.tot > 0 && <div style={{ background: C.bg, borderRadius: 4, height: 6 }}><div style={{ height: '100%', width: `${pct}%`, background: C.pur, borderRadius: 4 }} /></div>}
                    <div style={{ fontSize: 11, color: C.txl, marginTop: 4 }}>
                      {o.inAttesa ? 'Da avviare' : `Prossimo cambio: ${o.prossima ? fmtD(o.prossima) : '—'}`}
                    </div>
                  </Crd>
                );
              })}
            </>
          )}
          {pianiOrto.filter(o => o.completato).length > 0 && (
            <>
              <div style={{ fontSize: 11, fontWeight: 800, color: C.suc, textTransform: 'uppercase', margin: '12px 0 8px', display: 'flex', alignItems: 'center', gap: 5 }}><Ic n="ok" s={11} c={C.suc} />Completati</div>
              {pianiOrto.filter(o => o.completato).map(o => (
                <Crd key={o.pl.id} style={{ marginBottom: 8, borderLeft: `3px solid ${C.suc}` }}>
                  <div onClick={() => { setDetailModal(null); onOpenPaz(o.paz, 'piani'); }} style={{ fontWeight: 700, color: C.pri, cursor: 'pointer', fontSize: 13 }}>{o.paz.nome} {o.paz.cognome} ›</div>
                  <div style={{ fontSize: 11, color: C.suc }}>Ciclo di {o.tot} mascherine completato</div>
                </Crd>
              ))}
            </>
          )}
        </Modal>
      )}

      {todoModal && (
        <Modal title="+ Nuova attività" onClose={closeTodoModal}>
          <Fld label="Titolo">
            <textarea value={todoInput} onChange={e => setTodoInput(e.target.value)} autoFocus rows={4} placeholder={isDentistico ? 'es. Chiamare per preventivo' : 'es. Chiamare per controllo'} style={{ width: '100%', padding: '11px 12px', border: `1.5px solid ${C.brd}`, borderRadius: 10, fontSize: 13, color: C.txt, background: C.sur, boxSizing: 'border-box', resize: 'vertical', fontFamily: 'inherit' }} />
          </Fld>
          <Fld label="Paziente (opzionale)">
            <SelettorePaziente
              patients={patients}
              value={todoPatientId}
              onChange={(id) => setTodoPatientId(id || '')}
              search={todoPatientSearch}
              onSearchChange={setTodoPatientSearch}
              placeholder="Nessun paziente"
            />
            {todoPatientId && <button type="button" onClick={() => setTodoPatientId('')} style={{ marginTop: 5, padding: 0, border: 0, background: 'none', color: C.txm, fontSize: 11, cursor: 'pointer' }}>Rimuovi associazione</button>}
          </Fld>
          <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
            <Btn ch="Annulla" v="sec" onClick={closeTodoModal} full />
            <Btn ch="Aggiungi" onClick={() => { addTodo(); setTodoModal(false); }} dis={!todoInput.trim()} full />
          </div>
        </Modal>
      )}

      {ricettaPickerOpen && (
        <Modal title={<><Ic n="pill" s={15} c={C.txt} /> Ricetta — scegli paziente</>} onClose={() => { setRicettaPickerOpen(false); setRicettaPickerSearch(''); }}>
          <Fld label="Paziente">
            <SelettorePaziente
              patients={patients}
              value=""
              onChange={(id) => {
                const paz = (ricettaJustCreatedRef.current && String(ricettaJustCreatedRef.current.id) === String(id))
                  ? ricettaJustCreatedRef.current
                  : patients.find((p) => String(p.id) === String(id));
                if (!paz || !onOpenPaz) return;
                ricettaJustCreatedRef.current = null;
                setRicettaPickerOpen(false);
                setRicettaPickerSearch('');
                onOpenPaz(paz, 'doc', { type: 'ricetta' });
              }}
              search={ricettaPickerSearch}
              onSearchChange={setRicettaPickerSearch}
              placeholder="Cerca paziente, o scrivi nome e cognome per crearne uno nuovo…"
              onCreaPaziente={setPatients ? creaPazienteRapidoRicetta : undefined}
            />
          </Fld>
        </Modal>
      )}

      {bookingOpen && (
        <QuickBookingModal
          patients={patients} appTypes={appTypes} appointments={appointments} impegni={impegni}
          si={si} features={features} setAppointments={setAppointments}
          onClose={() => setBookingOpen(false)}
        />
      )}

      {homeToastMsg && <Toast msg={homeToastMsg} onDone={() => setHomeToastMsg('')} />}

      {/* ── HEADER ──
          POL-UI-015 §4/§3: on mobile this becomes a compact, sticky/
          floating pill (see .home-hero in PremiumVisualSystem.css) — the
          Dashboard content scrolls beneath it, it is never a solid
          full-width bar like the removed mobile header. Desktop keeps the
          exact pre-existing layout/behavior, untouched. */}
      <div className="home-hero">
        {/* POL-UI-017 R2 §1: the mobile hero must stay recognizably
            POLIEDRA, not a generic anonymous header. The brand mark is the
            SAME gem asset the Poliedron orb and the Consigli widget already
            use (no new asset, no second brand system) and is mobile-only —
            desktop already carries the brand in the premium sidebar, so
            showing it twice there would be noise. */}
        <img src={poliedroGem} alt="" aria-hidden="true" className="home-hero__mark" />
        <div className="home-hero__text">
          <div className="home-hero__greeting">{getSaluto(userName)} <span aria-hidden="true">👋</span></div>
          <div className="home-hero__meta">
            {todayApps.length > 0 ? `${todayApps.length} appuntament${todayApps.length === 1 ? 'o' : 'i'} oggi` : 'Nessun appuntamento oggi'}
            {si?.nome && <span className="home-hero__studio"> · {si.nome}</span>}
          </div>
          {/* Mobile-only date/time readout (task §4: "Buongiorno + data +
              ora"); hidden on desktop via CSS, where the meta line above
              already covers the greeting block's existing content.
              POL-UI-017 R2 §1: on mobile this single line now also carries
              today's appointment count — the one genuinely operational
              fact the (mobile-hidden) meta line above used to own — so the
              hero says everything useful in ONE compact row instead of
              stacking a greeting, a meta line and a datetime line. */}
          <div className="home-hero__datetime" aria-hidden="true">
            {fmtDataOra(now)} · {fmtOra(now)}
            {' · '}{todayApps.length > 0 ? `${todayApps.length} appuntament${todayApps.length === 1 ? 'o' : 'i'}` : 'nessun appuntamento'}
          </div>
        </div>
        <div className="home-hero__actions">
          {/* POL-UI-015 bugfix round 2 — ROOT CAUSE of "la personalizzazione
              non si salva": opening this modal while the initial layout
              load (`layoutLoading`) is still in flight seeds `draftWidgets`
              from the stale platform-default `widgets` snapshot. The Save
              button already correctly disables during `layoutLoading` (see
              below), but by the time it re-enables the real loaded layout
              has already landed in `widgets` — `draftWidgets` is never
              resynced while the modal is open (POL-UI-013C's own,
              deliberate anti-overwrite protection for in-progress edits),
              so saving at that point silently reverts every OTHER
              already-saved customization back to its default. Verified live
              (temporary QA harness): with a saved `wa:true` layout and an
              artificially delayed load, opening+editing+saving before the
              load resolved wiped `wa` back to `false` on the real backend.
              Disabling this button during the same `layoutLoading` window
              the Save button already respects closes the race at its
              source — the editor can no longer open with a stale baseline. */}
          {/* POL-UI-017 R2 §9: Home is configured occasionally, not daily,
              so on mobile this control collapses to a discreet 44x44 icon
              button (label hidden via CSS, never removed from the
              accessibility tree — see aria-label) instead of competing
              with the operational content beneath it. Desktop keeps the
              full labelled button. Nothing about what it opens, seeds or
              saves changes. */}
          <button className="home-hero__customize" disabled={layoutLoading} onClick={openHomeCustomizer} aria-busy={layoutLoading}
            aria-label={layoutLoading ? 'Caricamento della personalizzazione della Home' : 'Personalizza Home'} title="Personalizza Home">
            <Ic n="set" s={14} c={C.txm} />
            <span className="home-hero__customize-label">{layoutLoading ? 'Caricamento…' : 'Personalizza Home'}</span>
          </button>
        </div>
      </div>

      {/* POL-UI-013: page-level, persistent notice — a failed background
          load of the saved layout must stay visible here, not only inside
          the settings modal (see loadError declaration above for why). */}
      {loadError && (
        <div role="alert" data-testid="home-layout-load-error" style={{ display: 'flex', alignItems: 'center', gap: 10, justifyContent: 'space-between', flexWrap: 'wrap', marginBottom: 14, padding: '10px 14px', borderRadius: 12, background: C.danL, border: `1px solid ${C.dan}`, color: C.dan, fontSize: 12, fontWeight: 700 }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 7 }}><Ic n="warn" s={13} c={C.dan} />{loadError}</span>
          <button type="button" onClick={retryHomeLayoutLoad} style={{ border: 'none', borderRadius: 8, padding: '6px 10px', cursor: 'pointer', fontSize: 11, fontWeight: 800, background: C.dan, color: '#fff', flexShrink: 0 }}>Riprova</button>
        </div>
      )}

      {/* ── POL-UI-017 R2 §2 — RICHIEDE ATTENZIONE ──
          The mobile Home's priority area, rendered ABOVE the widget
          workspace so the first viewport answers "what needs me?" before
          anything else. It is page chrome, NOT a widget: it is deliberately
          absent from HOME_WIDGET_REGISTRY so it can never be reordered,
          resized, hidden or persisted, and so it cannot perturb the saved
          layout contract in any way (see §5/§9 — personalization must
          survive untouched).
          It is mobile-only by stylesheet (`.home-attention` is
          display:none above the mobile breakpoints): this round does not
          redesign desktop Home, and adding a new desktop band would be
          exactly that.
          When there is nothing to flag it collapses to ONE compact
          positive line — never a large empty box (§2). */}
      <section className="home-attention" aria-label="Richiede attenzione" data-testid="home-attention">
        {attentionItems.length === 0 ? (
          <p className="home-attention__clear">
            <Ic n="ok" s={13} c={C.suc} />{HOME_ATTENTION_EMPTY_LABEL}
          </p>
        ) : (
          <>
            <div className="home-section-label"><Ic n="warn" s={11} c={C.txm} />Richiede attenzione</div>
            <ul className="home-attention__list">
              {attentionItems.map((item) => {
                const tone = ATTENTION_TONE[item.tone] || C.pri;
                return (
                  <li key={item.id}>
                    <button type="button" className="home-attention__item" data-attention-id={item.id} data-tone={item.tone}
                      style={{ borderLeftColor: tone }} onClick={() => runAttentionAction(item.action)}>
                      <span className="home-attention__icon" style={{ background: tone + '1F' }}><Ic n={item.icon} s={14} c={tone} /></span>
                      <span className="home-attention__body">
                        <span className="home-attention__label" style={{ color: tone }}>{item.label}</span>
                        <span className="home-attention__detail">{item.detail}</span>
                      </span>
                      <span className="home-attention__chevron" aria-hidden="true">›</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </section>

      {/* ── WIDGET ORDINATI DINAMICAMENTE ──
         POL-UX-002 section 6: il selettore globale Mese/Anno è stato
         rimosso dalla Home. homePeriodId resta 'current_month' di default
         (mai più cambiato da qui) e continua ad alimentare
         loadHomeFinancialSnapshot/CanonicalFinancialWidget, che mostrano
         comunque il proprio periodo nell'header di ogni card — i dati
         canonici non dipendono da questo controllo rimosso. */}
      {/* POL-UI-017 R2 §4/§5 — `.home-workspace` exists only so the mobile
          priority banding (see `.home-workspace .home-widget-frame
          [data-widget-id=…]` in PremiumVisualSystem.css) can be scoped to
          the LIVE Home and can never reach the identical
          `.home-widget-frame` markup rendered inside the "Personalizza
          Home" preview — where the user must always see their own saved
          order, unbanded, or reordering would look broken. */}
      <div className="home-workspace">
      <WidgetWorkspace layout={visibleWidgets} editing={false} previewMode="desktop" onMove={() => {}} onResize={() => {}}>
      {visibleWidgets.filter(w => w.visible !== false).map(w => {
        const canonicalDefinition = getHomeFinancialWidget(w.id);
        if (canonicalDefinition) return <CanonicalFinancialWidget key={w.id} widgetId={w.id} snapshot={canonicalSnapshot} period={homePeriod} loading={canonicalLoading} error={canonicalError} />;
        if (w.id === 'quick_actions') {
          const quickActionContext = {
            onNavigate, onNavigateNew, onGoAgenda, onGoRichiami,
            openBooking: () => setBookingOpen(true),
            openTodoModal: openGenericTodoModal,
            openComingSoon: (msg) => setHomeToastMsg(msg),
            openRicettaPicker: () => setRicettaPickerOpen(true),
          };
          const activeActions = resolveQuickActions(w.config?.actions, { permissions: homePermissions, features, vertical: si?.vertical });
          /* POL-UI-017 R2 round 2 — the Product Owner asked for the quick-
             action set itself to be the dynamic, curated thing (via
             "Personalizza azioni rapide" in Impostazioni, see below) rather
             than an on-widget "+"/"Altro" expand toggle. The widget now
             simply renders whatever is configured/allowed — no truncation,
             no partition, no expand state — and desktop/mobile render the
             identical grid, exactly as `resolveQuickActions` resolved it. */
          return (
            <div key="quick_actions" className="home-quick-actions">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <div className="home-section-label" style={{ marginBottom: 0 }}><Ic n="zap" s={11} c={C.txm} />Azioni rapide</div>
                {onNavigate && (
                  <button type="button" className="home-list-link" onClick={() => onNavigate('set')} style={{ background: 'none', color: C.pri, fontWeight: 700 }}>
                    Personalizza ›
                  </button>
                )}
              </div>
              <div className="home-quick-actions__grid">
                {activeActions.map((action) => (
                  <button key={action.id} type="button" onClick={() => action.run(quickActionContext)}>
                    <span className="home-quick-actions__icon"><Ic n={action.ic} s={17} c={C.pri} /></span>
                    <span>{action.label}</span>
                  </button>
                ))}
              </div>
            </div>
          );
        }
        if (w.id === 'agenda') return (
          <div key="agenda" style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: C.txm, textTransform: 'uppercase', letterSpacing: '0.06em', display: 'flex', alignItems: 'center', gap: 5 }}><Ic n="cal" s={11} c={C.txm} />Agenda oggi</div>
              <button className="home-list-link" onClick={() => onGoAgenda && onGoAgenda()} style={{ background: C.priL, color: C.pri }}>Apri agenda ›</button>
            </div>
            {todayApps.length === 0 ? (
              <Crd style={{ textAlign: 'center', color: C.txl, padding: '16px 0', fontSize: 13 }}>Nessun appuntamento oggi</Crd>
            ) : (
              <Crd style={{ padding: 0, overflow: 'hidden' }}>
                {todayApps.map((a, i) => {
                  const p = patients.find(x => x.id === a.pazienteId);
                  const co = getColore(a);
                  const isPast = a.ora < new Date().toTimeString().slice(0, 5);
                  return (
                    <div key={a.id} onClick={() => onGoAgenda && onGoAgenda()} className="home-agenda-row" style={{ borderBottom: i < todayApps.length - 1 ? `1px solid ${C.brd}` : 'none', background: isPast ? '#fafafa' : '#fff' }}>
                      <div className="home-agenda-row__time" style={{ background: co + '20', borderLeft: `3px solid ${co}` }}>
                        <div className="home-agenda-row__time-value" style={{ color: co }}>{a.ora}</div>
                        <div className="home-agenda-row__time-dur" style={{ color: co }}>{a.durata}m</div>
                      </div>
                      <div className="home-agenda-row__name" style={{ color: isPast ? C.txm : C.txt }}>{p ? `${p.nome} ${p.cognome}` : '—'}</div>
                      <div className="home-agenda-row__badge"><Bdg ch={a.stato} co={a.stato === 'confermato' ? C.suc : C.war} /></div>
                      <div className="home-agenda-row__meta" style={{ color: C.txl }}>
                        <span className="home-agenda-row__dot" style={{ background: co }} />
                        <span className="home-agenda-row__type">{a.tipo}</span>
                      </div>
                    </div>
                  );
                })}
              </Crd>
            )}
            {hInc > 0 && <div style={{ marginTop: 6, background: C.sucL, borderRadius: 9, padding: '7px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: C.suc, display: 'inline-flex', alignItems: 'center', gap: 5 }}><Ic n="pay" s={12} c={C.suc} />Incassato oggi</span>
              <span style={{ fontSize: 15, fontWeight: 900, color: C.suc }}>{fmt(hInc)}</span>
            </div>}
          </div>
        );

        if (w.id === 'consigli_ai') {
          if (!consigliAttivi) return null;
          const nonLetti = consigli.filter((c) => !c.letto);
          return (
            <div key="consigli_ai" className="home-poliedron-widget" style={{ marginBottom: 16 }}>
              <div className="home-poliedron-widget__header">
                <div className="home-poliedron-widget__title">
                  <img src={poliedroGem} alt="" aria-hidden="true" className="home-poliedron-widget__gem" />
                  <div>
                    <div className="home-poliedron-widget__label">Poliedron</div>
                    <div className="home-poliedron-widget__heading">Consigli Poliedron</div>
                  </div>
                </div>
                <button onClick={rigeneraConsigli} disabled={consigliLoading} className="home-poliedron-widget__refresh">
                  {consigliLoading ? 'Genero…' : <><Ic n="refresh" s={11} c="currentColor" />Rigenera</>}
                </button>
              </div>
              {consigliErr && <div style={{ fontSize: 11, color: C.dan, marginBottom: 8 }}>{consigliErr}</div>}
              {!consigliLoading && consigli.length === 0 && !consigliErr && (
                <Crd style={{ textAlign: 'center', color: C.txl, padding: '16px 0', fontSize: 13 }}>Genero i primi consigli, un attimo…</Crd>
              )}
              {!consigliLoading && consigli.length > 0 && nonLetti.length === 0 && (
                <Crd style={{ textAlign: 'center', color: C.txl, padding: '16px 0', fontSize: 13 }}>Hai letto tutti i consigli di questa settimana</Crd>
              )}
              {nonLetti.length > 0 && (
                <div className="home-poliedron-widget__track" onScroll={onConsigliTrackScroll}>
                  {nonLetti.map((c) => {
                    const colore = c.categoria === 'cfo' ? C.pri : c.categoria === 'commerciale' ? C.war : C.pur;
                    const labelIc = c.categoria === 'cfo' ? 'eur' : c.categoria === 'commerciale' ? 'shake' : 'trend';
                    const labelTxt = c.categoria === 'cfo' ? 'CFO' : c.categoria === 'commerciale' ? 'Commerciale' : 'Marketing';
                    const label = <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><Ic n={labelIc} s={10} c={colore} />{labelTxt}</span>;
                    const paz = c.paziente_id ? patients.find(p => p.id === c.paziente_id) : null;
                    return (
                      <Crd key={c.id} className="home-poliedron-widget__card" style={{ marginBottom: 8, borderLeft: `3px solid ${colore}` }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ marginBottom: 5 }}><Bdg ch={label} co={colore} /></div>
                            <div style={{ fontWeight: 800, fontSize: 13, marginBottom: 3, color: C.txt }}>{c.titolo}</div>
                            <div style={{ fontSize: 12, color: C.txm, lineHeight: 1.45 }}>{c.testo}</div>
                            {paz && (
                              <div onClick={() => onOpenPaz(paz, 'info')} style={{ marginTop: 6, fontSize: 12, fontWeight: 700, color: C.pri, cursor: 'pointer' }}>{paz.nome} {paz.cognome} ›</div>
                            )}
                          </div>
                          <button className="home-list-icon-btn" onClick={() => segnaLettoConsiglio(c.id)} title="Segna come letto" style={{ background: C.sucL }}>
                            <Ic n="ok" s={13} c={C.suc} />
                          </button>
                        </div>
                      </Crd>
                    );
                  })}
                </div>
              )}
              {nonLetti.length > 1 && (
                <div className="home-poliedron-widget__dots" aria-hidden="true">
                  {nonLetti.map((c, i) => <span key={c.id} className={`home-poliedron-widget__dot${i === consigliCarouselIndex ? ' is-active' : ''}`} />)}
                </div>
              )}
            </div>
          );
        }

        if (w.id === 'poliedron_status') {
          const gruppi = new Map();
          for (const entry of dataHealthFindings) {
            const list = gruppi.get(entry.kind) || [];
            list.push(entry);
            gruppi.set(entry.kind, list);
          }
          return (
            <div key="poliedron_status" className="home-poliedron-widget" style={{ marginBottom: 16 }}>
              <div className="home-poliedron-widget__header">
                <div className="home-poliedron-widget__title">
                  <img src={poliedroGem} alt="" aria-hidden="true" className="home-poliedron-widget__gem" />
                  <div>
                    <div className="home-poliedron-widget__label">Poliedron</div>
                    <div className="home-poliedron-widget__heading">Controllo dati</div>
                  </div>
                </div>
                {dataHealthFindings.length > 0 && (
                  <button type="button" onClick={() => setPoliedronStatusOpen((v) => !v)} className="home-poliedron-widget__refresh" aria-expanded={poliedronStatusOpen}>
                    {dataHealthFindings.length} da controllare
                    <span aria-hidden="true" style={{ display: 'inline-block', transform: poliedronStatusOpen ? 'rotate(90deg)' : 'none', transition: 'transform 0.15s' }}>▶</span>
                  </button>
                )}
              </div>
              {dataHealthFindings.length === 0 ? (
                <Crd style={{ textAlign: 'center', color: C.suc, padding: '14px 0', fontSize: 13, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                  <Ic n="ok" s={13} c={C.suc} />Nessun dato mancante da controllare
                </Crd>
              ) : !poliedronStatusOpen ? (
                <button type="button" onClick={() => setPoliedronStatusOpen(true)} style={{ width: '100%', textAlign: 'left', background: 'none', border: 'none', padding: '2px 0', cursor: 'pointer', fontSize: 12, color: C.txm }}>
                  {[...gruppi.entries()].map(([kind, list]) => `${DATA_HEALTH_KIND_TITLE[kind] || kind} (${list.length})`).join(' · ')} — tocca per vedere pazienti e dettagli
                </button>
              ) : (
                [...gruppi.entries()].map(([kind, list]) => (
                  <Crd key={kind} style={{ marginBottom: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                      <Ic n={DATA_HEALTH_KIND_ICON[kind] || 'warn'} s={13} c={C.pri} />
                      <span style={{ fontSize: 12, fontWeight: 800, color: C.txt }}>{DATA_HEALTH_KIND_TITLE[kind] || kind}</span>
                      <Bdg ch={list.length} co={C.pri} />
                    </div>
                    {list.map((entry) => {
                      const paz = patients.find((p) => p.id === entry.pazienteId);
                      return (
                        <button key={entry.dedupKey} type="button" onClick={() => paz && onOpenPaz(paz, dataHealthKindTab(kind))}
                          style={{ width: '100%', textAlign: 'left', background: 'none', border: 'none', borderTop: `1px solid ${C.brd}`, padding: '7px 0', cursor: paz ? 'pointer' : 'default', display: 'flex', flexDirection: 'column', gap: 2 }}>
                          <span style={{ fontSize: 12, fontWeight: 700, color: paz ? C.pri : C.txt }}>{entry.patientName}{paz ? ' ›' : ''}</span>
                          <span style={{ fontSize: 11, color: C.txm }}>{entry.message}</span>
                        </button>
                      );
                    })}
                  </Crd>
                ))
              )}
            </div>
          );
        }

        if (w.id === 'poliedron_health_score') {
          const { percentage, checks } = dataHealthScore;
          const tone = percentage == null ? C.txl : percentage >= 80 ? C.suc : percentage >= 50 ? C.war : C.dan;
          const statusLabel = percentage == null ? 'Dati insufficienti' : percentage >= 80 ? 'Ottima' : percentage >= 50 ? 'Da migliorare' : 'Critica';
          const applicableChecks = checks.filter((c) => c.applicable);
          return (
            <div key="poliedron_health_score" className="home-poliedron-widget" style={{ marginBottom: 16 }}>
              <div className="home-poliedron-widget__header">
                <div className="home-poliedron-widget__title">
                  <img src={poliedroGem} alt="" aria-hidden="true" className="home-poliedron-widget__gem" />
                  <div>
                    <div className="home-poliedron-widget__label">Poliedron</div>
                    <div className="home-poliedron-widget__heading">Salute dati gestionale</div>
                  </div>
                </div>
              </div>
              {percentage == null ? (
                <Crd style={{ textAlign: 'center', color: C.txl, padding: '14px 0', fontSize: 13 }}>Non ci sono ancora abbastanza dati per calcolare un punteggio.</Crd>
              ) : (
                <>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 10 }}>
                    <div style={{ fontSize: 34, fontWeight: 900, color: tone }}>{percentage}%</div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 800, color: tone }}>{statusLabel}</div>
                      <div style={{ fontSize: 11, color: C.txm }}>Media di {applicableChecks.length} controlli automatici</div>
                    </div>
                  </div>
                  <div style={{ height: 6, borderRadius: 4, background: C.bg, overflow: 'hidden', marginBottom: 10 }} role="progressbar" aria-valuenow={percentage} aria-valuemin={0} aria-valuemax={100}>
                    <div style={{ height: '100%', width: `${percentage}%`, background: tone, borderRadius: 4, transition: 'width 0.2s' }} />
                  </div>
                  <button type="button" onClick={() => setPoliedronHealthOpen((v) => !v)} style={{ width: '100%', textAlign: 'left', background: 'none', border: 'none', padding: 0, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: 12, color: C.txm }}>{poliedronHealthOpen ? 'Nascondi il dettaglio' : 'Vedi il dettaglio per controllo'}</span>
                    <span aria-hidden="true" style={{ display: 'inline-block', transform: poliedronHealthOpen ? 'rotate(90deg)' : 'none', transition: 'transform 0.15s' }}>▶</span>
                  </button>
                  {poliedronHealthOpen && (
                    <div style={{ marginTop: 10 }}>
                      {applicableChecks.map((check) => {
                        const checkTone = check.passRate === 1 ? C.suc : check.passRate === 0 ? C.dan : C.war;
                        const isExpanded = expandedHealthCheckId === check.id;
                        const canExpand = check.scope === 'patient' && check.missingPatients.length > 0;
                        return (
                          <Crd key={check.id} style={{ marginBottom: 6, padding: 10 }}>
                            <button type="button"
                              onClick={() => canExpand ? setExpandedHealthCheckId(isExpanded ? null : check.id) : (check.scope === 'studio' && onNavigate ? onNavigate('spese') : undefined)}
                              style={{ width: '100%', textAlign: 'left', background: 'none', border: 'none', padding: 0, cursor: canExpand || check.scope === 'studio' ? 'pointer' : 'default', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                              <span style={{ fontSize: 12, fontWeight: 600, color: C.txt }}>{check.label}</span>
                              <span style={{ fontSize: 11, fontWeight: 800, color: checkTone, flexShrink: 0 }}>
                                {check.scope === 'studio' ? (check.passRate === 1 ? 'OK' : 'Da sistemare') : `${check.passedCount}/${check.totalCount}`}
                              </span>
                            </button>
                            {isExpanded && (
                              <div style={{ marginTop: 8 }}>
                                {check.missingPatients.map((p) => {
                                  const paz = patients.find((x) => x.id === p.pazienteId);
                                  return (
                                    <button key={p.pazienteId} type="button" onClick={() => paz && onOpenPaz(paz, dataHealthScoreCheckTab(check.id))}
                                      style={{ width: '100%', textAlign: 'left', background: 'none', border: 'none', borderTop: `1px solid ${C.brd}`, padding: '6px 0', cursor: paz ? 'pointer' : 'default', fontSize: 12, fontWeight: 700, color: paz ? C.pri : C.txt }}>
                                      {p.patientName}{paz ? ' ›' : ''}
                                    </button>
                                  );
                                })}
                              </div>
                            )}
                          </Crd>
                        );
                      })}
                    </div>
                  )}
                </>
              )}
            </div>
          );
        }

        if (w.id === 'todo') return (
          <div key="todo" style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: C.txm, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 5 }}><Ic n="okc" s={11} c={C.txm} />Attività e promemoria</div>
            <Crd style={{ marginBottom: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ fontSize: 12, fontWeight: 700 }}>Attività {todoAttivi.length > 0 && <span style={{ background: C.dan, color: '#fff', borderRadius: 8, padding: '1px 6px', fontSize: 10 }}>{todoAttivi.length}</span>}</span>
                <button className="home-list-link" onClick={openGenericTodoModal} style={{ background: C.pri, color: '#fff' }}>+ Aggiungi</button>
              </div>
              {todoLoading && <div style={{ fontSize: 12, color: C.txl, textAlign: 'center', padding: '8px 0' }}>Caricamento...</div>}
              {!todoLoading && todoAttivi.length === 0 && <div style={{ fontSize: 12, color: C.txl, textAlign: 'center', padding: '8px 0' }}>Nessuna attività in sospeso</div>}
              <div style={{ maxHeight: 220, overflowY: 'auto' }}>
                {todoAttivi.map(todo => {
                  // POL-FIN-007: le Attività generate dal controllo dati
                  // automatico portano paziente_id — cliccabili per aprire
                  // subito quel paziente, invece di dover cercarlo a mano.
                  const todoPaziente = todo.paziente_id != null ? patients.find((p) => String(p.id) === String(todo.paziente_id)) : null;
                  return (
                    <div key={todo.id} style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '7px 0', borderBottom: `1px solid ${C.brd}` }}>
                      <button className="home-list-checkbox" onClick={() => toggleTodo(todo.id)}><span style={{ border: `2px solid ${C.brd}` }} /></button>
                      {todoPaziente ? (
                        <button type="button" onClick={() => onOpenPaz(todoPaziente, 'piani')} style={{ flex: 1, fontSize: 12, fontWeight: 600, textAlign: 'left', background: 'none', border: 'none', padding: 0, color: C.pri, cursor: 'pointer', textDecoration: 'underline', textDecorationColor: C.pri + '50' }} title="Apri scheda paziente">{todo.testo}</button>
                      ) : (
                        <span style={{ flex: 1, fontSize: 12, fontWeight: 600 }}>{todo.testo}</span>
                      )}
                      <button className="home-list-icon-btn" onClick={() => { const msg = encodeURIComponent('Attività: ' + todo.testo); window.open('https://wa.me/?text=' + msg, '_blank'); }} title="Invia su WhatsApp"><Ic n="wa" s={13} c="#25D366" /></button>
                      <button className="home-list-icon-btn" onClick={() => deleteTodo(todo.id)}><Ic n="x" s={11} c={C.dan} /></button>
                    </div>
                  );
                })}
              </div>
              {todoFatti.length > 0 && <div style={{ marginTop: 6, fontSize: 10, color: C.txl, textAlign: 'center' }}>{todoFatti.length} completate</div>}
            </Crd>
            {promemoria.length > 0 && (
              <Crd>
                <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 5 }}><Ic n="pin" s={11} c={C.txt} />Promemoria {promemoria.filter(p => p.richiamo.data < t).length > 0 && <span style={{ background: C.dan, color: '#fff', borderRadius: 8, padding: '1px 6px', fontSize: 10 }}>{promemoria.filter(p => p.richiamo.data < t).length} scaduti</span>}</div>
                {promemoria.slice(0, 4).map(({ paz, ann, richiamo }, i) => (
                  <div key={i} style={{ padding: '6px 0', borderBottom: `1px solid ${C.brd}`, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ flex: 1 }}>
                      <div onClick={() => onOpenPaz(paz, 'info')} style={{ fontSize: 12, fontWeight: 700, color: C.pri, cursor: 'pointer' }}>{paz.nome} {paz.cognome} ›</div>
                      <div style={{ fontSize: 11, color: C.txm }}>{richiamo.testo}</div>
                    </div>
                    <span style={{ fontSize: 10, fontWeight: 700, color: richiamo.data < t ? C.dan : C.pur, flexShrink: 0 }}>{fmtD(richiamo.data)}</span>
                  </div>
                ))}
              </Crd>
            )}
          </div>
        );

        if (w.id === 'wa') {
          if (!waAbilitato(features)) return null;
          return (
          <div key="wa" style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: C.txm, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 5 }}><Ic n="wa" s={11} c={C.txm} />Reminder WhatsApp — domani</div>
            {domaniApps.length === 0 ? (
              <Crd style={{ textAlign: 'center', color: C.txl, padding: '16px 0', fontSize: 13 }}>Nessun appuntamento domani</Crd>
            ) : (
              <Crd>
                <div style={{ fontSize: 11, color: C.txm, marginBottom: 10 }}>
                  {domaniApps.length} appuntament{domaniApps.length === 1 ? 'o' : 'i'} domani — tocca WA per inviare il reminder
                </div>
                {domaniApps.map((a, i) => {
                  const p = patients.find(x => x.id === a.pazienteId);
                  const co = getColore(a);
                  const hasTel = p?.telefono;
                  const defMsg = p ? `Gentile ${p.nome},\nricordiamo il suo appuntamento:\n📅 ${fmtD(a.data)} alle ${a.ora}\n📌 ${a.tipo}\nPer variazioni contattarci entro 24h. Grazie!` : '';
                  return (
                    <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: i < domaniApps.length - 1 ? `1px solid ${C.brd}` : 'none' }}>
                      <div style={{ background: co + '20', borderRadius: 7, padding: '3px 7px', textAlign: 'center', flexShrink: 0, borderLeft: `3px solid ${co}` }}>
                        <div style={{ fontSize: 12, fontWeight: 900, color: co }}>{a.ora}</div>
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 700, fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p ? `${p.nome} ${p.cognome}` : '—'}</div>
                        <div style={{ fontSize: 10, color: C.txl }}>{a.tipo}</div>
                      </div>
                      {hasTel ? (
                        <button onClick={() => apriWaDiretto(p.telefono, defMsg)}
                          style={{ background: '#25D366', border: 'none', borderRadius: 7, padding: '6px 10px', cursor: 'pointer', color: '#fff', fontWeight: 700, fontSize: 11, flexShrink: 0 }}>
                          WA
                        </button>
                      ) : (
                        <span style={{ fontSize: 10, color: C.txl }}>no tel.</span>
                      )}
                    </div>
                  );
                })}
                <button onClick={() => {
                  domaniApps.forEach(a => {
                    const p = patients.find(x => x.id === a.pazienteId);
                    if (!p?.telefono) return;
                    const msg = `Gentile ${p.nome},\nricordiamo il suo appuntamento:\n📅 ${fmtD(a.data)} alle ${a.ora}\n📌 ${a.tipo}\nPer variazioni contattarci entro 24h. Grazie!`;
                    setTimeout(() => apriWaDiretto(p.telefono, msg), 500);
                  });
                }} style={{ width: '100%', marginTop: 10, padding: '9px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, background: '#25D366', border: 'none', borderRadius: 9, color: '#fff', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>
                  <Ic n="wa" s={12} c="#fff" />Invia reminder a tutti ({domaniApps.filter(a => patients.find(x => x.id === a.pazienteId)?.telefono).length}/{domaniApps.length})
                </button>
              </Crd>
            )}
          </div>
          );
        }

        if (w.id === 'appuntamenti' && upcoming.length > 0) return (
          <div key="appuntamenti" style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: C.txm, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 5 }}><Ic n="cal" s={11} c={C.txm} />Prossimi appuntamenti</div>
            <Crd>
              {upcoming.map((a, i) => {
                const p = patients.find(x => x.id === a.pazienteId);
                return (
                  <div key={a.id} onClick={() => apriEditApp(a)} className="home-upcoming-row" style={{ borderBottom: i < upcoming.length-1 ? `1px solid ${C.brd}` : 'none' }}>
                    <div className="home-upcoming-row__time" style={{ background: C.priL }}>
                      <div className="home-upcoming-row__date" style={{ color: C.pri }}>{a.data.slice(8)}/{a.data.slice(5,7)}</div>
                      <div className="home-upcoming-row__hour" style={{ color: C.priD }}>{a.ora}</div>
                    </div>
                    <div className="home-upcoming-row__name">{p ? `${p.nome} ${p.cognome}` : '—'}</div>
                    <div className="home-upcoming-row__badge"><Bdg ch={a.stato} co={a.stato === 'confermato' ? C.suc : C.war} /></div>
                    <div className="home-upcoming-row__meta" style={{ color: C.txm }}>{a.tipo}</div>
                    <button className="home-upcoming-row__del home-list-icon-btn" onClick={e => { e.stopPropagation(); eliminaAppuntamentoDiretto(a); }} title="Elimina">
                      <Ic n="del" s={14} c={C.dan} />
                    </button>
                  </div>
                );
              })}
            </Crd>
          </div>
        );

        if (w.id === 'economico') return (
          <div key="economico" style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: C.txm, textTransform: 'uppercase', letterSpacing: '0.06em', display: 'flex', alignItems: 'center', gap: 5 }}><Ic n="eur" s={11} c={C.txm} />Pannello economico</div>
              <div style={{ display: 'flex', gap: 4, background: C.bg, border: `1px solid ${C.brd}`, borderRadius: 8, padding: 3 }}>
                {[['mese', 'Mese'], ['anno', 'Anno']].map(([id, lbl]) => (
                  <button key={id} onClick={() => setPeriodoEconomico(id)} style={{ border: 'none', borderRadius: 6, padding: '4px 9px', fontSize: 11, fontWeight: 700, cursor: 'pointer', background: periodoEconomico === id ? C.pri : 'transparent', color: periodoEconomico === id ? '#fff' : C.txt }}>{lbl}</button>
                ))}
              </div>
            </div>
            <Crd className="pol-economico-summary" style={{ background: `linear-gradient(145deg, ${C.priD} 0%, ${C.pri} 60%, #0f172a 100%)`, border: 'none' }}>
              {kpiPeriodoLoading && <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: 13 }}>Calcolo in corso…</div>}
              {kpiPeriodo && !kpiPeriodoLoading && (
                <>
                  <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', padding: '5px 0' }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,0.85)' }}>Incassato</span>
                    <span style={{ fontSize: 17, fontWeight: 900, color: '#fff' }}>{fmt(kpiPeriodo.incassato)}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', padding: '5px 0', borderTop: '1px solid rgba(255,255,255,0.15)' }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,0.85)' }}>− Costi</span>
                    <span style={{ fontSize: 15, fontWeight: 800, color: 'rgba(255,255,255,0.9)' }}>{fmt(kpiPeriodo.costi_totali)}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', padding: '7px 0 0', borderTop: '1px solid rgba(255,255,255,0.15)' }}>
                    <span style={{ fontSize: 13, fontWeight: 800, color: '#fff' }}>= EBITDA</span>
                    <span style={{ fontSize: 20, fontWeight: 900, color: kpiPeriodo.ebitda >= 0 ? '#8CFFB0' : '#FFB0B0' }}>{fmt(kpiPeriodo.ebitda)}</span>
                  </div>
                </>
              )}
            </Crd>
            <Crd className="pol-economico-detail" style={{ padding: 0, overflow: 'hidden', marginTop: 8 }}>
              <div onClick={() => setDetailModal('esegDaInc')} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', cursor: 'pointer', background: totEsegDaInc > 0 ? C.danL : 'transparent' }}>
                <span style={{ fontSize: 12, color: totEsegDaInc > 0 ? C.dan : C.txm, fontWeight: totEsegDaInc > 0 ? 700 : 400, display: 'inline-flex', alignItems: 'center', gap: 5 }}><Ic n="eur" s={11} c={totEsegDaInc > 0 ? C.dan : C.txm} />Eseguito da incassare</span>
                <span style={{ fontSize: 13.5, fontWeight: 800, color: totEsegDaInc > 0 ? C.dan : C.txt }}>{fmt(totEsegDaInc)}</span>
              </div>
              <div onClick={() => setDetailModal('accNonEseg')} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', cursor: 'pointer', borderTop: `1px solid ${C.brd}` }}>
                <span style={{ fontSize: 12, color: C.txm, display: 'inline-flex', alignItems: 'center', gap: 5 }}><Ic n="ok" s={11} c={C.txm} />Accettato da eseguire</span>
                <span style={{ fontSize: 13.5, fontWeight: 800, color: C.txt }}>{fmt(totAccNonEseg)}</span>
              </div>
            </Crd>
          </div>
        );

        if (w.id === 'preventivi') return (
          <div key="preventivi" style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: C.txm, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 5 }}><Ic n="clip" s={11} c={C.txm} />Preventivi</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
              <StatCard label="Attesa" value={preventiviAttesa.length} color={C.pur} onClick={() => setDetailModal('attesa')} elevated />
              <StatCard label="Accettati" value={preventiviAccettati.length} sub={fmt(totAccettati)} color={C.acc} onClick={() => setDetailModal('accettati')} elevated />
              <StatCard label="Rifiutati" value={preventiviRifiutati.length} color={C.dan} onClick={() => setDetailModal('rifiutati')} elevated />
            </div>
          </div>
        );

        if (w.id === 'richiami') {
          // POL-UI-015: premium, operational Richiami widget — real fields
          // only (paziente/motivo/data/stato/scaduto), nothing invented.
          // 5 rows visible at once; beyond that the list scrolls internally
          // instead of growing the Dashboard, per spec §2. "Gestire" reuses
          // the existing Richiami page/route (Dashboard doesn't own
          // setRichiami, so it never duplicates the mutation logic already
          // in Richiami.jsx) — "aprire paziente" reuses the same onOpenPaz
          // every other widget on this page already calls.
          const t2 = today();
          const aperti = richiami.filter(r => r.stato === 'da_fare').sort((a, b) => a.dataScadenza.localeCompare(b.dataScadenza));
          const scad = aperti.filter(r => r.dataScadenza < t2).length;
          const hasOverflow = aperti.length > 5;
          return (
            <div key="richiami" style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 8 }}>
                <span style={{ fontSize: 11, fontWeight: 800, color: C.txm, textTransform: 'uppercase', letterSpacing: '0.06em', display: 'flex', alignItems: 'center', gap: 5 }}>
                  <Ic n="bell" s={11} c={C.txm} />Richiami
                  {aperti.length > 0 && <span style={{ background: scad > 0 ? C.dan : C.pur, color: '#fff', borderRadius: 8, padding: '1px 6px', fontSize: 10 }}>{aperti.length}</span>}
                </span>
                {aperti.length > 0 && <button className="home-list-link" onClick={() => onGoRichiami && onGoRichiami()} style={{ background: 'none', color: C.pri, fontWeight: 700 }}>Vedi tutti ›</button>}
              </div>
              <Crd style={{ padding: 0, overflow: 'hidden' }}>
                {aperti.length === 0 ? (
                  <EmptyState icon="bell" title="Nessun richiamo da gestire" />
                ) : (
                  <div className="home-richiami-list" style={hasOverflow ? { maxHeight: 272, overflowY: 'auto' } : undefined}>
                    {aperti.slice(0, hasOverflow ? undefined : 5).map((r, i, list) => {
                      const paz = patients.find(p => String(p.id) === String(r.pazienteId));
                      const cat = RICHIAMO_CATEGORIE[r.categoria] || RICHIAMO_CATEGORIE.generico;
                      const scaduto = r.dataScadenza < t2;
                      return (
                        <div key={r.id} role="button" tabIndex={0}
                          onClick={() => onGoRichiami && onGoRichiami()}
                          onKeyDown={(e) => { if (e.key === 'Enter') onGoRichiami && onGoRichiami(); }}
                          style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '9px 12px', borderBottom: i < list.length - 1 ? `1px solid ${C.brd}` : 'none', borderLeft: `3px solid ${cat.colore}`, cursor: 'pointer', minHeight: 44 }}>
                          <Ic n={cat.icona} s={13} c={cat.colore} />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div onClick={(e) => { e.stopPropagation(); if (paz) onOpenPaz(paz, 'info'); }}
                              style={{ fontWeight: 700, fontSize: 12, color: paz ? C.pri : C.txt, cursor: paz ? 'pointer' : 'default', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {paz ? `${paz.nome} ${paz.cognome}` : 'Paziente non trovato'}
                            </div>
                            <div style={{ fontSize: 11, color: C.txm, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.motivo || cat.label}</div>
                          </div>
                          <span style={{ fontSize: 10, fontWeight: 700, color: scaduto ? C.dan : C.txl, flexShrink: 0 }}>{scaduto ? 'Scaduto' : fmtD(r.dataScadenza)}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </Crd>
            </div>
          );
        }

        if (w.id === 'scadenze') return (
          <div key="scadenze" style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: C.txm, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 5 }}><Ic n="cal" s={11} c={C.txm} />Scadenze pagamento</div>
            <StatCard label="Totale" value={scadenzePagamento.length} sub={`${scadenzeScadute.length} scadute · ${scadenzeProssime.length} prossime 30gg`} color={scadenzeScadute.length > 0 ? C.dan : C.pri} urgent={scadenzeScadute.length > 0} onClick={() => setDetailModal('scadenze')} />
          </div>
        );

        if (w.id === 'ortodonzia') {
          if (!isDentistico) return null;
          return (
            <div key="ortodonzia" style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: C.txm, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 5 }}><Ic n="tooth" s={11} c={C.txm} />Ortodonzia</div>
              <StatCard label="Piani attivi" value={pianiOrto.filter(o => !o.completato).length} sub={`${pianiOrto.filter(o => o.cambioScaduto).length} da cambiare · ${pianiOrto.filter(o => o.inAttesa).length} da avviare`} color={pianiOrto.some(o => o.cambioScaduto) ? C.dan : C.pur} urgent={pianiOrto.some(o => o.cambioScaduto)} onClick={() => setDetailModal('orto')} />
            </div>
          );
        }

        if (w.id === 'statistiche') return (
          <div key="statistiche" style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: C.txm, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 5 }}><Ic n="chart" s={11} c={C.txm} />Statistiche</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <StatCard label="Pazienti totali" value={patients.length} sub={`+${nuoviMese} questo mese`} />
              <StatCard label="Tasso accettazione" value={`${tassoAccettazione}%`} color={tassoAccettazione >= 70 ? C.suc : tassoAccettazione >= 40 ? C.war : C.dan} onClick={() => setDetailModal('attesa')} />
              <StatCard label="Valore medio piano" value={fmt(mediaValore)} />
              {topPrest && <StatCard label="Top prestazione" value={topPrest[0].length > 18 ? topPrest[0].slice(0, 16) + '…' : topPrest[0]} sub={`${topPrest[1]}x eseguita`} color={C.acc} />}
            </div>
          </div>
        );

        if (w.id === 'grafici') return (
          <div key="grafici" style={{ marginBottom: 16 }}>
            <button onClick={() => setMostraGraficiDash(v => !v)} style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'none', border: 'none', padding: 0, marginBottom: 8, cursor: 'pointer' }}>
              <span style={{ fontSize: 11, fontWeight: 800, color: C.txm, textTransform: 'uppercase', letterSpacing: '0.06em', display: 'flex', alignItems: 'center', gap: 5 }}><Ic n="trend" s={11} c={C.txm} />Grafici e andamento</span>
              <span style={{ fontSize: 11, color: C.pri, fontWeight: 700 }}>{mostraGraficiDash ? 'Nascondi ▲' : 'Mostra ▼'}</span>
            </button>
            {mostraGraficiDash && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <Crd>
                  <div style={{ fontSize: 12.5, fontWeight: 700, color: C.txt, marginBottom: 8 }}>Ultimi mesi</div>
                  {andamentoMensile.length === 0 ? (
                    <div style={{ textAlign: 'center', color: C.txl, padding: '16px 0', fontSize: 13 }}>Nessun incasso registrato</div>
                  ) : (
                    <ResponsiveContainer width="100%" height={180}>
                      <ComposedChart data={andamentoMensile} margin={{ top: 4, right: 8, left: -22, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke={C.brd} vertical={false} />
                        <XAxis dataKey="mese" tick={{ fontSize: 11, fill: C.txl }} axisLine={{ stroke: C.brd }} tickLine={false} />
                        <YAxis tick={{ fontSize: 10, fill: C.txl }} axisLine={false} tickLine={false} width={42} />
                        <Tooltip contentStyle={{ background: C.txt, border: 'none', borderRadius: 8, color: C.sur, fontSize: 12 }} labelStyle={{ color: C.sur }} formatter={(v, n) => [fmt(v), n === 'incasso' ? 'Incasso' : 'Media mobile']} />
                        <Bar dataKey="incasso" fill={C.priL} radius={[6, 6, 0, 0]} barSize={22} />
                        <Line dataKey="media" stroke={C.pri} strokeWidth={2.5} dot={{ r: 3, fill: C.pri }} />
                      </ComposedChart>
                    </ResponsiveContainer>
                  )}
                </Crd>
                <Crd>
                  <div style={{ fontSize: 12.5, fontWeight: 700, color: C.txt, marginBottom: 8 }}>Dove incasso di più</div>
                  {incassoPerPrestazione.length === 0 ? (
                    <div style={{ textAlign: 'center', color: C.txl, padding: '16px 0', fontSize: 13 }}>Nessuna prestazione eseguita</div>
                  ) : (
                    <ResponsiveContainer width="100%" height={Math.max(140, incassoPerPrestazione.length * 34)}>
                      <BarChart data={incassoPerPrestazione} layout="vertical" margin={{ top: 4, right: 24, left: 4, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke={C.brd} horizontal={false} />
                        <XAxis type="number" tick={{ fontSize: 10, fill: C.txl }} axisLine={false} tickLine={false} />
                        <YAxis type="category" dataKey="tipo" tick={{ fontSize: 11, fill: C.txt }} axisLine={false} tickLine={false} width={92} />
                        <Tooltip contentStyle={{ background: C.txt, border: 'none', borderRadius: 8, color: C.sur, fontSize: 12 }} labelStyle={{ color: C.sur }} formatter={(v) => fmt(v)} />
                        <Bar dataKey="incasso" radius={[0, 6, 6, 0]} barSize={16}>
                          {incassoPerPrestazione.map((_, i) => <Cell key={i} fill={CHART_PALETTE[i % CHART_PALETTE.length]} />)}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </Crd>
                <Crd>
                  <div style={{ fontSize: 12.5, fontWeight: 700, color: C.txt, marginBottom: 8 }}>Incasso per giorno</div>
                  <ResponsiveContainer width="100%" height={160}>
                    <BarChart data={incassoPerGiorno} margin={{ top: 4, right: 8, left: -22, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke={C.brd} vertical={false} />
                      <XAxis dataKey="giorno" tick={{ fontSize: 11, fill: C.txl }} axisLine={{ stroke: C.brd }} tickLine={false} />
                      <YAxis tick={{ fontSize: 10, fill: C.txl }} axisLine={false} tickLine={false} width={42} />
                      <Tooltip contentStyle={{ background: C.txt, border: 'none', borderRadius: 8, color: C.sur, fontSize: 12 }} labelStyle={{ color: C.sur }} formatter={(v) => fmt(v)} />
                      <Bar dataKey="incasso" radius={[6, 6, 0, 0]} barSize={26}>
                        {incassoPerGiorno.map((d, i) => <Cell key={i} fill={d.top ? C.pri : C.priL} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </Crd>
                <Crd>
                  <div style={{ fontSize: 12.5, fontWeight: 700, color: C.txt, marginBottom: 8 }}>Andamento spese</div>
                  {speseMensili.length === 0 ? (
                    <div style={{ textAlign: 'center', color: C.txl, padding: '16px 0', fontSize: 13 }}>Nessuna spesa registrata</div>
                  ) : (
                    <ResponsiveContainer width="100%" height={180}>
                      <BarChart data={speseMensili} margin={{ top: 4, right: 8, left: -22, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke={C.brd} vertical={false} />
                        <XAxis dataKey="mese" tick={{ fontSize: 11, fill: C.txl }} axisLine={{ stroke: C.brd }} tickLine={false} />
                        <YAxis tick={{ fontSize: 10, fill: C.txl }} axisLine={false} tickLine={false} width={42} />
                        <Tooltip contentStyle={{ background: C.txt, border: 'none', borderRadius: 8, color: C.sur, fontSize: 12 }} labelStyle={{ color: C.sur }} formatter={(v, n) => [fmt(v), n === 'unaTantum' ? 'Una tantum' : 'Ricorrenti (quota mese)']} />
                        <Bar dataKey="ricorrenti" stackId="s" fill={C.war + '55'} radius={[0, 0, 0, 0]} barSize={22} />
                        <Bar dataKey="unaTantum" stackId="s" fill={C.dan} radius={[6, 6, 0, 0]} barSize={22} />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </Crd>
                {speseCategoria.length > 0 && (
                  <Crd>
                    <div style={{ fontSize: 12.5, fontWeight: 700, color: C.txt, marginBottom: 2 }}>Spese per categoria</div>
                    <div style={{ fontSize: 11, color: C.txl, marginBottom: 8 }}>Ricorrenti proiettate su base annua/12</div>
                    <ResponsiveContainer width="100%" height={Math.max(140, speseCategoria.length * 34)}>
                      <BarChart data={speseCategoria} layout="vertical" margin={{ top: 4, right: 24, left: 4, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke={C.brd} horizontal={false} />
                        <XAxis type="number" tick={{ fontSize: 10, fill: C.txl }} axisLine={false} tickLine={false} />
                        <YAxis type="category" dataKey="categoria" tick={{ fontSize: 11, fill: C.txt }} axisLine={false} tickLine={false} width={92} />
                        <Tooltip contentStyle={{ background: C.txt, border: 'none', borderRadius: 8, color: C.sur, fontSize: 12 }} labelStyle={{ color: C.sur }} formatter={(v) => fmt(v)} />
                        <Bar dataKey="tot" radius={[0, 6, 6, 0]} barSize={16}>
                          {speseCategoria.map((_, i) => <Cell key={i} fill={C.dan} fillOpacity={1 - i * 0.12} />)}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </Crd>
                )}
              </div>
            )}
          </div>
        );

        return null;
      })}
      </WidgetWorkspace>
      </div>

      {/* POL-UI-015 §5: dock-clearance spacer — zero-height/no-op above the
          719px mobile breakpoint (see .home-dock-clearance in
          PremiumVisualSystem.css), so the last widget above can never end
          up hidden or unclickable behind the floating mobile dock. Sized
          from the SAME canonical dock geometry constants Agenda already
          reuses (poliedronMobileDock.js) plus the physical safe area —
          never a value hand-tuned for one phone model. */}
      <div className="home-dock-clearance" style={{ height: `calc(${MOBILE_DOCK_BOTTOM + MOBILE_DOCK_HEIGHT + MOBILE_DOCK_PROTECTED_GAP}px + env(safe-area-inset-bottom, 0px))` }} aria-hidden="true" />

      {editApp && editForm && (
        <Modal title={<><Ic n="edit" s={15} c={C.txt} /> Modifica appuntamento</>} onClose={() => setEditApp(null)}>
          {(() => {
            const p = patients.find(x => x.id === editApp.pazienteId);
            return (
              <div style={{ background: C.priL, borderRadius: 9, padding: '9px 12px', marginBottom: 12 }}>
                <div style={{ fontWeight: 700, fontSize: 13 }}>{p ? `${p.nome} ${p.cognome}` : '—'}</div>
                {p?.telefono && <div style={{ fontSize: 11, color: C.txm }}>{p.telefono}</div>}
              </div>
            );
          })()}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <Fld label="Data"><Inp type="date" value={editForm.data} onChange={e => setEditForm(f => ({ ...f, data: e.target.value }))} /></Fld>
            <Fld label="Ora"><TimePicker value={editForm.ora} onChange={(v) => setEditForm(f => ({ ...f, ora: v }))} label="Orario appuntamento" /></Fld>
            <Fld label="Durata">
              <Sel value={editForm.durata} onChange={e => setEditForm(f => ({ ...f, durata: e.target.value }))}>
                {[15,30,45,60,90,120].map(d => <option key={d} value={d}>{d} min</option>)}
              </Sel>
            </Fld>
            <Fld label="Stato">
              <Sel value={editForm.stato} onChange={e => setEditForm(f => ({ ...f, stato: e.target.value }))}>
                <option value="confermato">Confermato</option>
                <option value="da confermare">Da confermare</option>
                <option value="annullato">Annullato</option>
              </Sel>
            </Fld>
          </div>
          <Fld label="Tipo visita">
            <Inp value={editForm.tipo} onChange={e => setEditForm(f => ({ ...f, tipo: e.target.value }))} />
          </Fld>
          <Fld label="Note"><Txt value={editForm.note} onChange={e => setEditForm(f => ({ ...f, note: e.target.value }))} /></Fld>
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <Btn ch="Elimina" v="dan" onClick={eliminaEditApp} />
            <Btn ch="Annulla" v="sec" onClick={() => setEditApp(null)} full />
            <Btn ch="Salva" onClick={salvaEditApp} full />
          </div>
        </Modal>
      )}
    </div>
  );
}
