import React, { useState, useEffect, Suspense, lazy } from 'react';
import { supabase, DB } from './lib/supabase.js';
import { C, DEF_PRICE, DEF_TPL, DEF_STUDIO, DEF_TPL_GENERICO, getAppTypesDefault, getLogoSlug, NAV, PIANI_FEATURES_DEFAULT, computeFeatures, uid, applyBrandColors, applyHeaderColor } from './lib/utils';
import { generaRichiamiBot } from './lib/richiamiBot';
import { salvaPosizione, leggiPosizione, pulisciPosizione } from './lib/posizioneNavigazione';
// POL-AI-001: MobileDock (the POL-UI-009/010 poliedro-button-opens-full-nav-
// menu) is superseded by Poliedron — the same floating polyhedron concept,
// evolved into the app's universal command interface (search/navigate/
// create/analyze), mounted on both mobile and desktop now instead of
// mobile-only.
//
// Product Owner requirement (POL-AI-001 review round 2): Poliedron must be
// the single AI entry point in the UI — no second floating AI button.
// AssistenteAI.jsx (the separate chat widget, previously mounted here
// alongside Poliedron) is no longer rendered anywhere in the app shell.
// Its file and internal logic (the tool-confirmation loop for
// crea_appuntamento/modifica_appuntamento/elimina_appuntamento/
// registra_pagamento/crea_paziente, all driving the same agente-assistente
// edge function Poliedron's modelGateway.js also calls) are kept, not
// deleted — a future round can port that tool-execution loop into
// Poliedron's ASK/ANALYZE path behind the Model Gateway. See
// docs/coordination/handoffs.md for the full convergence record.
import Poliedron from './components/poliedron';
import { buildHomePermissions } from './lib/homeDashboardModel';
import PremiumSidebar from './components/PremiumSidebar.jsx';
import './styles/designTokens.css';
import './components/PremiumVisualSystem.css';
import { useIsMobile } from './lib/useIsMobile';
import { useTheme } from './lib/useTheme';
// POL-UI-004 Recovery: restored original Poliedra logo assets (verbatim,
// same files/mapping used before POL-UX-002 swapped them for a
// code-rendered wordmark). Root cause of that swap: the wordmark portion of
// these assets renders as a near-invisible hairline stroke against dark
// chrome — verified again here, still true. Restoring as directed; the
// icon mark itself is fully legible, only the "Poliedra" wordmark is faint.
import logoDentalWhite from './assets/logo-poliedra-dental-outline.png';
import logoSalusWhite from './assets/logo-poliedra-salus-outline.png';
import logoFisioWhite from './assets/logo-poliedra-fisio-outline.png';
import logoMindWhite from './assets/logo-poliedra-mind-outline.png';
import logoWellnessWhite from './assets/logo-poliedra-wellness-outline.png';
import logoFitWhite from './assets/logo-poliedra-fit-outline.png';
import logoMedicalWhite from './assets/logo-poliedra-medical-outline.png';

const LOGO_WHITE_PER_SLUG = { dental: logoDentalWhite, salus: logoSalusWhite, fisio: logoFisioWhite, mind: logoMindWhite, wellness: logoWellnessWhite, fit: logoFitWhite, medical: logoMedicalWhite };
import LoginScreen from './components/LoginScreen.jsx';
import LoadingScreen from './components/LoadingScreen.jsx';
import Dashboard from './components/Dashboard.jsx';
import QuickBookingModal from './components/QuickBookingModal.jsx';
const ControlloGestione = lazy(() => import('./components/ControlloGestione.jsx'));
const Pazienti = lazy(() => import('./components/Pazienti.jsx'));
const SchedaPaz = lazy(() => import('./components/SchedaPaz.jsx'));
const Piani = lazy(() => import('./components/Piani.jsx'));
const Pagamenti = lazy(() => import('./components/Pagamenti.jsx'));
const Spese = lazy(() => import('./components/Spese.jsx'));
const ArchivioDocs = lazy(() => import('./components/ArchivioDocs.jsx'));
const Listino = lazy(() => import('./components/Listino.jsx'));
const Agenda = lazy(() => import('./components/Agenda.jsx'));
const Richiami = lazy(() => import('./components/Richiami.jsx'));
const AgenteAISetup = lazy(() => import('./components/AgenteAISetup.jsx'));
const WhatsApp = lazy(() => import('./components/WhatsApp.jsx'));
const Impostazioni = lazy(() => import('./components/Impostazioni.jsx'));

export default function App() {
  const { theme, toggleTheme } = useTheme();
  const isMobile = useIsMobile();
  const [session, setSession] = useState(undefined);
  const [dataLoading, setDataLoading] = useState(true);
  const [page, setPage] = useState('home');
  const [patients, setPatients] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [plans, setPlans] = useState([]);
  const [payments, setPayments] = useState([]);
  const [pricelist, setPricelist] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [studioInfo, setStudioInfo] = useState(DEF_STUDIO);
  const [appTypes, setAppTypes] = useState([]);
  const [userName, setUserName] = useState('');
  const [implants, setImplants] = useState([]);
  const [impegni, setImpegni] = useState([]);
  const [richiami, setRichiami] = useState([]);
  const [initPatId, setInitPatId] = useState(null);
  // POL-UX-001 bugfix: Home quick actions "Nuovo paziente"/"Nuovo preventivo"/
  // "Pagamento" must open the real creation form on arrival, not just land on
  // the list page. Mirrors the existing initPatId pattern (set target page,
  // consumer opens its own real modal, then clears it) instead of a second
  // navigation mechanism.
  const [autoOpenNew, setAutoOpenNew] = useState(null); // 'paz' | 'piani' | 'paga' | 'richiami' | 'spese' | null
  const [agendaInitPaz, setAgendaInitPaz] = useState(null);
  const [schedaDashPaz, setSchedaDashPaz] = useState(null);
  const [quickHubRecallRequest, setQuickHubRecallRequest] = useState(null);
  const [quickHubActivityRequest, setQuickHubActivityRequest] = useState(null);
  const [quickHubPoliedronRequest, setQuickHubPoliedronRequest] = useState(null);
  // POL-AI-002A §20 — set by Poliedron's direct "ric"/"fat"/"doc" commands
  // so ArchivioDocs opens already filtered instead of on its unfiltered
  // default view; App.jsx never reads it, only threads it through.
  const [archivioFiltroTipoHint, setArchivioFiltroTipoHint] = useState(null);
  const [poliedronBookingOpen, setPoliedronBookingOpen] = useState(false);
  const [syncError, setSyncError] = useState(null);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [isStudioAdmin, setIsStudioAdmin] = useState(false);
  const [studioMembership, setStudioMembership] = useState(null);
  const [studioAttivo, setStudioAttivo] = useState(true);
  const [features, setFeatures] = useState(PIANI_FEATURES_DEFAULT.base);

  // Colori brand (piano Premium): riapplica pri/priL/priD/acc sopra la palette
  // di tema ogni volta che cambia il tema (altrimenti il toggle chiaro/scuro li
  // sovrascriverebbe), i colori salvati dallo studio, o se la feature si disattiva.
  // Il colore header (con opacità) va applicato DOPO, nello stesso effetto: se
  // non impostato ricade sul C.priD appena risolto da applyBrandColors sopra.
  useEffect(() => {
    applyBrandColors(theme, features?.custom_colors ? { pri: studioInfo?.custom_colore_primario, acc: studioInfo?.custom_colore_accento } : null);
    applyHeaderColor(features?.custom_colors ? { colore: studioInfo?.header_colore, opacita: studioInfo?.header_opacita } : null);
  }, [theme, features?.custom_colors, studioInfo?.custom_colore_primario, studioInfo?.custom_colore_accento, studioInfo?.header_colore, studioInfo?.header_opacita]);

  useEffect(() => {
    // Inizializza sessione — se non risponde entro 3s forza null (no session)
    let resolved = false;
    const timeout = setTimeout(() => {
      if (!resolved) { resolved = true; setSession(null); }
    }, 3000);

    supabase.auth.getSession().then(({ data }) => {
      if (!resolved) {
        resolved = true;
        clearTimeout(timeout);
        const sess = data.session;
        setSession(sess ?? null);
        const m = sess?.user?.user_metadata;
        if (m?.nome) setUserName((m.nome + ' ' + (m.cognome || '')).trim());
      }
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, sess) => {
      resolved = true;
      clearTimeout(timeout);
      setSession(sess ?? null);
      const m = sess?.user?.user_metadata;
      if (m?.nome) setUserName((m.nome + ' ' + (m.cognome || '')).trim());
      else setUserName('');
    });
    return () => { listener.subscription.unsubscribe(); clearTimeout(timeout); };
  }, []);

  useEffect(() => {
    if (!session) return;
    let cancelled = false;
    (async () => {
      setDataLoading(true);
      try {
        const [p, a, pl, py, pr, tp, at, im, ip, ri, si] = await Promise.all([
          DB.getAll('dm_p'),
          DB.getAll('dm_a'),
          DB.getAll('dm_pl'),
          DB.getAll('dm_py'),
          DB.getAll('dm_pr'),
          DB.getAll('dm_tp'),
          DB.getAll('dm_at'),
          DB.getAll('dm_im'),
          DB.getAll('dm_ip'),
          DB.getAll('dm_ri'),
          DB.getStudioInfo(),
        ]);
        if (cancelled) return;
        setPatients(p || []);
        setAppointments(a || []);
        setPlans(pl || []);
        setPayments(py || []);
        setImplants(im || []);
        setImpegni(ip || []);
        setRichiami(ri || []);

        // Determina il vertical PRIMA di seedare, usando 'si' appena arrivato dalla stessa fetch
        // (non ancora salvato in state) — default 'dentistico' se lo studio non l'ha ancora impostato
        const isDentisticoNew = !si?.vertical || si.vertical === 'dentistico';

        if (!pr || pr.length === 0) {
          if (isDentisticoNew) {
            const seeded = await Promise.all(DEF_PRICE.map((item) => { const { id, ...rest } = item; return DB.insert('dm_pr', rest); }));
            setPricelist(seeded);
          } else {
            // Nessun listino dentale precompilato per verticali non dentistici: il professionista
            // costruisce il proprio listino da zero (i prezzi variano troppo tra specializzazioni).
            setPricelist([]);
          }
        } else setPricelist(pr);

        if (!tp || tp.length === 0) {
          const seeded = await Promise.all((isDentisticoNew ? DEF_TPL : DEF_TPL_GENERICO).map((item) => { const { id, ...rest } = item; return DB.insert('dm_tp', rest); }));
          setTemplates(seeded);
        } else setTemplates(tp);

        if (!at || at.length === 0) {
          const seeded = await Promise.all(getAppTypesDefault(si?.vertical).map((item) => { const { id, ...rest } = item; return DB.insert('dm_at', rest); }));
          setAppTypes(seeded);
        } else setAppTypes(at);

        setStudioInfo(si || DEF_STUDIO);
      } catch (err) {
        console.error('Errore caricamento dati cloud:', err);
      }
      if (!cancelled) setDataLoading(false);
    })();
    return () => { cancelled = true; };
  }, [session]);

  // Ripristino della posizione dopo un ricaricamento "a freddo" dell'app
  // (schermo spento a lungo, cambio app, memoria del telefono che scarica
  // la pagina in background): se prima di allora l'utente era su una
  // pagina o dentro la scheda di un paziente con un form in corso, lo
  // riportiamo esattamente lì. Il contenuto scritto nei form (testo,
  // farmaci, voci) è già salvato separatamente da useFormPersistente — qui
  // ricostruiamo solo il "dove eravamo", altrimenti quel testo non
  // verrebbe mai riletto perché il componente che lo conterrebbe non si
  // rimonterebbe mai da solo.
  useEffect(() => {
    if (dataLoading) return;
    const pos = leggiPosizione();
    if (!pos) return;
    // La pagina NON viene ripristinata: l'app deve sempre aprirsi su Dashboard
    // (page resta 'home', il suo default), qualunque fosse l'ultima pagina
    // visitata prima della chiusura/ricarica. Il resto della posizione (scheda
    // paziente con form in corso) continua a essere ripristinato normalmente.
    if (pos.schedaPazId != null) {
      const paz = patients.find((p) => String(p.id) === String(pos.schedaPazId));
      if (paz) setSchedaDashPaz({ paz, tab: pos.schedaPazTab || 'paga' });
      else pulisciPosizione(['schedaPazId', 'schedaPazTab']); // paziente non più esistente: niente da ripristinare
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dataLoading]);

  // Salva la pagina corrente ad ogni cambio, per poterla ripristinare dopo
  // un ricaricamento a freddo. Evitiamo di scrivere durante il ripristino
  // stesso (dataLoading true) per non sovrascrivere la posizione appena letta.
  useEffect(() => {
    if (dataLoading) return;
    salvaPosizione({ page });
  }, [page, dataLoading]);

  // Aggiornamento automatico: appointments/patients/payments possono essere scritti
  // anche fuori dal flusso normale dell'app (es. dall'assistente AI, o da un altro
  // dispositivo/utente dello stesso studio) — senza questo, restano visibili solo
  // dopo un ricaricamento manuale della pagina.
  useEffect(() => {
    if (!session) return;
    const channel = supabase
      .channel('dm-external-sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'appointments' }, async () => {
        const a = await DB.getAll('dm_a');
        setAppointments(a || []);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'patients' }, async () => {
        const p = await DB.getAll('dm_p');
        setPatients(p || []);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'payments' }, async () => {
        const py = await DB.getAll('dm_py');
        setPayments(py || []);
      })
      // POL-AI-005B: Poliedron's action executor writes treatment plans
      // directly via DB.insert/update ("outside the normal app flow",
      // exactly what this whole channel exists for per the comment above)
      // — without this, a Poliedron-confirmed clinical write would only
      // become visible in Piani.jsx/SchedaPaz after a manual reload.
      .on('postgres_changes', { event: '*', schema: 'public', table: 'plans' }, async () => {
        const pl = await DB.getAll('dm_pl');
        setPlans(pl || []);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'impegni_personali' }, async () => {
        const ip = await DB.getAll('dm_ip');
        setImpegni(ip || []);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'richiami' }, async () => {
        const ri = await DB.getAll('dm_ri');
        setRichiami(ri || []);
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [session]);

  useEffect(() => {
    if (!session) { setIsSuperAdmin(false); setIsStudioAdmin(false); setStudioMembership(null); setStudioAttivo(true); setFeatures(PIANI_FEATURES_DEFAULT.base); return; }
    let cancelled = false;
    (async () => {
      const { data: admin } = await supabase.rpc('is_super_admin');
      if (!cancelled) setIsSuperAdmin(!!admin);

      const studioId = session?.user?.app_metadata?.studio_id;
      if (studioId) {
        const { data: st } = await supabase.from('studios').select('attivo, piano, feature_overrides').eq('id', studioId).maybeSingle();
        if (!cancelled) {
          setStudioAttivo(st ? st.attivo !== false : true);
          setFeatures(computeFeatures(st?.piano || 'base', st?.feature_overrides));
        }

        // Fail closed anche nell'interfaccia: i controlli admin sono mostrati
        // solo quando esiste una membership attiva e coerente con lo studio.
        // La barriera autorevole resta public.is_studio_admin() lato database.
        const { data: mio } = await supabase.from('studio_users').select('ruolo, stato').eq('user_id', session.user.id).eq('studio_id', studioId).maybeSingle();
        const { data: capabilities, error: capabilityError } = mio?.stato === 'attivo'
          ? await supabase.rpc('get_my_studio_capabilities_v1', { p_studio_id: studioId })
          : { data: [], error: null };
        if (!cancelled) {
          setStudioMembership(mio ? { ...mio, capabilities: !capabilityError && Array.isArray(capabilities) ? capabilities : [] } : null);
          setIsStudioAdmin(!!mio && mio.ruolo === 'admin' && mio.stato === 'attivo');
        }
      }
    })();
    return () => { cancelled = true; };
  }, [session]);

  useEffect(() => {
    if (
      (page === 'wa' && !features.whatsapp) ||
      (page === 'spese' && !features.spese) ||
      (page === 'archivio' && !features.archivio_documenti) ||
      (page === 'controllo' && !features.controllo_gestione) ||
      (page === 'agenteai' && (!features.assistente_ai || features.assistente_ai === 'off' || !isStudioAdmin))
    ) setPage('home');
  }, [page, features, isStudioAdmin]);

  const makeSyncSetter = (key, setLocal, onError) => {
    return (updater) => {
      setLocal((prev) => {
        const next = typeof updater === 'function' ? updater(prev) : updater;
        const prevIds = new Set(prev.map((x) => x.id));
        const nextIds = new Set(next.map((x) => x.id));

        prev.forEach((item) => {
          if (!nextIds.has(item.id)) DB.remove(key, item.id).catch((e) => { console.error('remove', key, e); onError && onError(`Errore eliminazione: ${e.message || e}`); });
        });

        const nuovi = next.filter((item) => !prevIds.has(item.id));
        if (nuovi.length > 0) {
          (async () => {
            const errori = [];
            for (const item of nuovi) {
              try {
                const { id: tempId, ...rest } = item;
                const saved = await DB.insert(key, rest);
                setLocal((curr) => curr.map((x) => (x.id === tempId ? { ...x, ...saved } : x)));
              } catch (e) {
                console.error('insert', key, e);
                errori.push(e?.message || String(e));
                // Non è mai stato salvato sul cloud: toglierlo dallo stato locale invece di
                // lasciarlo lì come elemento "fantasma", che altrimenti sparirebbe in modo
                // imprevedibile al primo refresh realtime (es. dopo un'altra modifica andata
                // a buon fine) confondendo chi lo aveva appena inserito.
                setLocal((curr) => curr.filter((x) => x.id !== item.id));
              }
            }
            if (errori.length > 0 && onError) onError(`${errori.length} elemento/i non salvato/i sul cloud: ${errori[0]}`);
          })();
        }

        next.forEach((item) => {
          if (prevIds.has(item.id)) {
            const before = prev.find((x) => x.id === item.id);
            if (before && JSON.stringify(before) !== JSON.stringify(item)) {
              const { id, ...rest } = item;
              DB.update(key, id, rest).catch((e) => { console.error('update', key, e); onError && onError(`Errore salvataggio: ${e.message || e}`); });
            }
          }
        });

        return next;
      });
    };
  };

  const setPatientsSync = makeSyncSetter('dm_p', setPatients, setSyncError);
  const setAppointmentsSync = makeSyncSetter('dm_a', setAppointments, setSyncError);
  const setPlansSync = makeSyncSetter('dm_pl', setPlans, setSyncError);
  const setPaymentsSync = makeSyncSetter('dm_py', setPayments, setSyncError);
  const setPricelistSync = makeSyncSetter('dm_pr', setPricelist, setSyncError);
  const setTemplatesSync = makeSyncSetter('dm_tp', setTemplates, setSyncError);
  const setAppTypesSync = makeSyncSetter('dm_at', setAppTypes, setSyncError);
  const setImplantsSync = makeSyncSetter('dm_im', setImplants, setSyncError);
  const setImpegniSync = makeSyncSetter('dm_ip', setImpegni, setSyncError);
  const setRichiamiSync = makeSyncSetter('dm_ri', setRichiami, setSyncError);

  // Scansione automatica del bot Richiami: ogni volta che pazienti, piani,
  // pagamenti o agenda cambiano (es. si segna un'igiene come eseguita, si
  // registra un pagamento sospeso), ricalcola le proposte e le applica —
  // così i richiami restano aggiornati indipendentemente dalla pagina in cui
  // si trova l'utente, senza bisogno di aprire apposta la sezione Richiami.
  // La guardia "nulla da cambiare" evita un loop: applicare un array vuoto
  // di modifiche produrrebbe comunque un nuovo riferimento di stato e
  // rieseguirebbe l'effetto all'infinito.
  useEffect(() => {
    if (dataLoading || !session) return;
    const { proposte, daRimuovere } = generaRichiamiBot({ patients, plans, payments, appointments, richiami });
    if (proposte.length === 0 && daRimuovere.length === 0) return;
    setRichiamiSync((prev) => [
      ...prev.filter((r) => !daRimuovere.includes(r.id)),
      ...proposte.map((p) => ({ ...p, id: uid() })),
    ]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dataLoading, session, patients, plans, payments, appointments, richiami]);

  const setStudioInfoSync = (updaterOrVal) => {
    setStudioInfo((prev) => {
      const next = typeof updaterOrVal === 'function' ? updaterOrVal(prev) : updaterOrVal;
      DB.setStudioInfo(next).catch((e) => console.error('Errore salvataggio studio info', e));
      return next;
    });
  };

  const goNuovoPiano = (id) => { setInitPatId(id); setPage('piani'); };
  const goNuovoElemento = (target) => { setAutoOpenNew(target); setPage(target); };
  const goSchedaPaz = (paz, tab = 'paga') => {
    setSchedaDashPaz({ paz, tab });
    salvaPosizione({ schedaPazId: paz.id, schedaPazTab: tab });
  };
  const requestId = () => `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const openQuickHubRecall = (patient) => {
    setQuickHubRecallRequest({ id: requestId(), patient });
    setPage('richiami');
  };
  const openQuickHubActivity = (patient) => {
    setQuickHubActivityRequest({ id: requestId(), patient });
    setPage('home');
  };
  const openQuickHubPoliedron = ({ command, patient, appointment }) => {
    setQuickHubPoliedronRequest({ id: requestId(), command, patient, appointment });
  };
  const openPrescription = ({ patient, drug = '' }) => {
    if (!patient) return;
    const documentRequest = { type: 'ricetta', prefill: { farmaco: drug }, requestId: `${Date.now()}-${patient.id}` };
    setSchedaDashPaz({ paz: patient, tab: 'doc', documentRequest });
    salvaPosizione({ schedaPazId: patient.id, schedaPazTab: 'doc', schedaPazModaleDoc: 'medico' });
  };
  const goAgendaPaz = (pazId) => { setAgendaInitPaz(pazId); setPage('agenda'); };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setPatients([]); setAppointments([]); setPlans([]); setPayments([]); setImpegni([]); setRichiami([]);
    setPricelist([]); setTemplates([]); setAppTypes([]); setStudioInfo(DEF_STUDIO); setImplants([]);
    setPage('home');
  };

  if (session === undefined) return <LoadingScreen />;
  if (session === null) return <LoginScreen onLogin={() => {}} />;
  if (dataLoading) return <LoadingScreen />;

  if (!studioAttivo && !isSuperAdmin) {
    return (
      <div style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: C.bg, padding: 24, textAlign: 'center' }}>
        <div>
          <div style={{ fontSize: 40, marginBottom: 12 }}>⏸️</div>
          <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 8 }}>Account sospeso</div>
          <div style={{ fontSize: 13, color: C.txm, marginBottom: 20, maxWidth: 320 }}>Il tuo account è temporaneamente sospeso. Contatta l'assistenza per maggiori informazioni.</div>
          <button onClick={handleLogout} style={{ background: C.pri, border: 'none', borderRadius: 10, padding: '11px 22px', color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>Esci</button>
        </div>
      </div>
    );
  }

  const navVisibile = NAV.filter((n) =>
    (n.id !== 'wa' || features.whatsapp) &&
    (n.id !== 'spese' || features.spese) &&
    (n.id !== 'archivio' || features.archivio_documenti) &&
    (n.id !== 'controllo' || features.controllo_gestione) &&
    (n.id !== 'agenteai' || isStudioAdmin)
  );

  // POL-AI-001 §12: the exact capability-based permissions object Dashboard's
  // own quick actions already compute from — Poliedron's action registry
  // reuses it (via isQuickActionAllowed) instead of a second RBAC model.
  const homePermissions = buildHomePermissions({ membership: studioMembership, features, vertical: studioInfo?.vertical });

  const sidebarLogoSrc = features.custom_logo && studioInfo?.custom_logo_b64
    ? studioInfo.custom_logo_b64
    : LOGO_WHITE_PER_SLUG[getLogoSlug(studioInfo?.vertical)];
  const navigateFromPoliedron = (nextPage) => {
    setSchedaDashPaz(null);
    pulisciPosizione(['schedaPazId', 'schedaPazTab']);
    setPage(nextPage);
  };

  return (
    <div className={isMobile ? 'app-shell app-shell--mobile' : 'app-shell app-shell--desktop'} style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', height: '100dvh', minHeight: '100dvh', background: C.bg, overflow: 'hidden' }}>
      {!isMobile && (
        <PremiumSidebar
          nav={navVisibile}
          page={page}
          setPage={navigateFromPoliedron}
          logoSrc={sidebarLogoSrc}
          studioName={studioInfo?.nome}
          userName={userName}
          onLogout={handleLogout}
        />
      )}
      <div className="app-main" style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0, minHeight: 0, overflow: 'hidden' }}>
      {/* POL-UI-005: mobile top header (logo/page name/Esci) removed — it cost
          too much vertical space for no real value on a small screen and kept
          this wrapper permanently dark (see PremiumVisualSystem.css). The app
          is now genuinely fullscreen on mobile: #app-scroll below carries
          safe-area-inset-top itself instead of a header absorbing it, and
          Esci moved into Impostazioni → Profilo (bottom of that screen).
          Desktop/tablet keep PremiumSidebar (branding + Esci) untouched. */}

      {syncError && (
        <div style={{ background: C.danL, borderBottom: `2px solid ${C.dan}`, padding: '9px 14px', display: 'flex', alignItems: 'flex-start', gap: 8, flexShrink: 0 }}>
          <span style={{ fontSize: 15, flexShrink: 0 }}>⚠️</span>
          <span style={{ flex: 1, fontSize: 12, fontWeight: 600, color: '#C53030', lineHeight: 1.4 }}>{syncError}</span>
          <button onClick={() => setSyncError(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, flexShrink: 0, color: '#C53030', fontWeight: 800, fontSize: 14 }}>✕</button>
        </div>
      )}

      {schedaDashPaz && (
        <Suspense fallback={null}>
          <SchedaPaz
            key={schedaDashPaz.paz.id}
            paz={schedaDashPaz.paz}
            initTab={schedaDashPaz.tab}
            plans={plans} setPlans={setPlansSync}
            payments={payments}
            appointments={appointments}
            pricelist={pricelist}
            si={studioInfo}
            features={features}
            studioMembership={studioMembership}
            currentUserId={session?.user?.id}
            isStudioAdmin={isStudioAdmin}
            onClose={() => { setSchedaDashPaz(null); pulisciPosizione(['schedaPazId', 'schedaPazTab']); }}
            onEdit={() => setSchedaDashPaz(null)}
            onNuovoPiano={(id) => { setSchedaDashPaz(null); goNuovoPiano(id); }}
            initialDocumentRequest={schedaDashPaz.documentRequest}
            onDocumentRequestHandled={(requestId) => setSchedaDashPaz((current) =>
              current?.documentRequest?.requestId === requestId
                ? { ...current, documentRequest: null }
                : current
            )}
          />
        </Suspense>
      )}

      <div id="app-scroll" style={{
        flex: '1 1 auto', minWidth: 0, minHeight: 0, width: '100%', maxWidth: '100%', boxSizing: 'border-box',
        overflowY: isMobile && page === 'agenda' ? 'hidden' : 'auto',
        overflowX: 'hidden', overscrollBehavior: 'contain',
        // POL-UI-010 (structural): #app-scroll only ever had flex:1 from ITS
        // OWN parent — it never declared display:flex itself, so its child
        // was plain block content. Agenda's root relied on height:'100%' to
        // stretch to #app-scroll's box, and percentage heights inside a
        // flex-sized-but-not-flex-container ancestor are exactly the class
        // of thing iOS Safari is known to resolve unreliably (WebKit can
        // treat the flex item's height as indefinite for descendants'
        // percentage resolution, even though it renders with a real size) —
        // this is why the real-device iPhone test still showed a dead strip
        // after Agenda's own internal flex/ResizeObserver fixes: the chain
        // was already broken one level above Agenda entirely. Making
        // #app-scroll itself a column flex container for mobile Agenda lets
        // Agenda's root use flex:1/minHeight:0 (the same pattern already
        // relied on everywhere else in Agenda.jsx, verified reliable) instead
        // of a percentage height — no other page is affected.
        display: isMobile && page === 'agenda' ? 'flex' : undefined,
        flexDirection: isMobile && page === 'agenda' ? 'column' : undefined,
        padding: 13,
        // POL-UI-015 §3: Dashboard follows the same fullscreen principle
        // Agenda already established — its own floating greeting bar owns
        // the top safe-area (see Dashboard.jsx's sticky header), so the
        // outer shell contributes zero top inset for Home too, instead of
        // the standard frame every other (non-fullscreen) page still keeps.
        paddingTop: isMobile ? ((page === 'agenda' || page === 'home') ? 0 : 'calc(13px + env(safe-area-inset-top, 0px))') : 13,
        // Agenda owns an inner scroller and must extend beneath the floating
        // dock through the physical safe area. Home scrolls here (normal
        // document flow) but also owns its own dock-clearance spacer
        // beneath its last widget (see Dashboard.jsx), so it only needs the
        // bare physical safe area here, same as every other non-Agenda page.
        paddingBottom: isMobile
          ? (page === 'agenda' ? 0 : 'env(safe-area-inset-bottom, 0px)')
          : 28,
        scrollPaddingBottom: isMobile ? 'calc(94px + env(safe-area-inset-bottom, 0px))' : undefined,
        // POL-UI-004 Agenda mobile final: the Agenda grid should read as an
        // almost-fullscreen surface, not a page floating inside the app's
        // usual side gutter. Narrowed only for this page/breakpoint — every
        // other page keeps the standard mobile inset.
        // POL-UI-006: the standard mobile inset is a hair wider than
        // desktop's (15 vs 13) — a small, deliberate safety margin so
        // content never touches/exceeds the screen edge on real devices,
        // plus explicit overflow-x:hidden above as a hard backstop: no
        // page can ever force the whole app to scroll sideways again.
        // POL-UI-015 §3: Home gets the same zero left/right inset as
        // Agenda on mobile — Dashboard.jsx applies its own internal
        // horizontal padding to widget content, so the outer wrapper shows
        // no grey framing while cards still keep their own breathing room.
        paddingLeft: isMobile ? ((page === 'agenda' || page === 'home') ? (page === 'agenda' ? 6 : 0) : 15) : undefined,
        paddingRight: isMobile ? ((page === 'agenda' || page === 'home') ? (page === 'agenda' ? 6 : 0) : 15) : undefined,
      }}>
        {page === 'home' && <Dashboard patients={patients} appointments={appointments} setAppointments={setAppointmentsSync} payments={payments} plans={plans} richiami={richiami} impegni={impegni} onOpenPaz={goSchedaPaz} appTypes={appTypes} onGoAgenda={() => setPage('agenda')} onGoRichiami={() => setPage('richiami')} onNavigate={setPage} onNavigateNew={goNuovoElemento} templates={templates} userName={userName} si={studioInfo} features={features} studioId={session?.user?.app_metadata?.studio_id} currentUserId={session?.user?.id} isStudioAdmin={isStudioAdmin} studioMembership={studioMembership} activityPatientRequest={quickHubActivityRequest} onActivityPatientRequestHandled={(id) => setQuickHubActivityRequest((current) => current?.id === id ? null : current)} />}
        {page !== 'home' && (
          <Suspense fallback={<LoadingScreen />}>
            {page === 'paz' && (
              <Pazienti
                patients={patients} setPatients={setPatientsSync}
                plans={plans} setPlans={setPlansSync}
                payments={payments} setPayments={setPaymentsSync} appointments={appointments} si={studioInfo}
                features={features}
                studioMembership={studioMembership}
                currentUserId={session?.user?.id}
                isStudioAdmin={isStudioAdmin}
                onNuovoPiano={goNuovoPiano}
                implants={implants} setImplants={setImplantsSync}
                setAppointments={setAppointmentsSync}
                onNuovoAppuntamento={goAgendaPaz}
                templates={templates}
                pricelist={pricelist}
                autoOpenNew={autoOpenNew === 'paz'} onAutoOpenNewHandled={() => setAutoOpenNew(null)}
              />
            )}
            {page === 'piani' && (
              <Piani
                patients={patients} plans={plans} setPlans={setPlansSync}
                pricelist={pricelist} templates={templates} si={studioInfo} features={features}
                initPatId={initPatId} onClearInitPat={() => setInitPatId(null)}
                onOpenPaz={goSchedaPaz}
                autoOpenNew={autoOpenNew === 'piani'} onAutoOpenNewHandled={() => setAutoOpenNew(null)}
              />
            )}
            {page === 'paga' && <Pagamenti patients={patients} payments={payments} setPayments={setPaymentsSync} plans={plans} autoOpenNew={autoOpenNew === 'paga'} onAutoOpenNewHandled={() => setAutoOpenNew(null)} />}
            {page === 'listino' && <Listino pricelist={pricelist} setPricelist={setPricelistSync} si={studioInfo} />}
            {page === 'agenda' && <Agenda patients={patients} setPatients={setPatientsSync} appointments={appointments} setAppointments={setAppointmentsSync} appTypes={appTypes} initPazienteId={agendaInitPaz} onClearInitPaz={() => setAgendaInitPaz(null)} templates={templates} userName={userName} features={features} impegni={impegni} setImpegni={setImpegniSync} si={studioInfo} setStudioInfo={setStudioInfoSync} onOpenPatient={(patient) => goSchedaPaz(patient, 'info')} onOpenRecall={openQuickHubRecall} onOpenActivity={openQuickHubActivity} onPoliedronCommand={openQuickHubPoliedron} />}
            {page === 'richiami' && <Richiami patients={patients} plans={plans} payments={payments} appointments={appointments} richiami={richiami} setRichiami={setRichiamiSync} templates={templates} features={features} onOpenPaz={goSchedaPaz} si={studioInfo} autoOpenNew={autoOpenNew === 'richiami'} onAutoOpenNewHandled={() => setAutoOpenNew(null)} initialPatientRequest={quickHubRecallRequest} onInitialPatientRequestHandled={(id) => setQuickHubRecallRequest((current) => current?.id === id ? null : current)} />}
            {page === 'spese' && <Spese studioId={session?.user?.app_metadata?.studio_id} autoOpenNew={autoOpenNew === 'spese'} onAutoOpenNewHandled={() => setAutoOpenNew(null)} />}
            {page === 'controllo' && <ControlloGestione studioId={session?.user?.app_metadata?.studio_id} patients={patients} plans={plans} payments={payments} appointments={appointments} pricelist={pricelist} onOpenPaz={goSchedaPaz} isDentistico={!studioInfo?.vertical || studioInfo.vertical === 'dentistico'} />}
            {page === 'archivio' && <ArchivioDocs patients={patients} onApriDocFiscale={(p) => goSchedaPaz(p, 'doc')} onApriDocMedico={(p) => goSchedaPaz(p, 'doc')} onApriDocConsenso={(p) => goSchedaPaz(p, 'doc')} initialFiltroTipo={archivioFiltroTipoHint} />}
            {page === 'wa' && <WhatsApp patients={patients} appointments={appointments} templates={templates} setTemplates={setTemplatesSync} />}
            {page === 'agenteai' && <AgenteAISetup features={features} />}
            {page === 'set' && <Impostazioni studioInfo={studioInfo} setStudioInfo={setStudioInfoSync} appTypes={appTypes} setAppTypes={setAppTypesSync} currentUserId={session?.user?.id} onNomeChange={(n) => setUserName(n)} features={features} theme={theme} toggleTheme={toggleTheme} isStudioAdmin={isStudioAdmin} onLogout={handleLogout} />}
          </Suspense>
        )}
      </div>

      <Poliedron
        isMobile={isMobile}
        page={page}
        setPage={navigateFromPoliedron}
        patients={patients}
        plans={plans}
        payments={payments}
        pricelist={pricelist}
        appointments={appointments}
        richiami={richiami}
        impegni={impegni}
        goSchedaPaz={goSchedaPaz}
        features={features}
        isStudioAdmin={isStudioAdmin}
        vertical={studioInfo?.vertical}
        studioId={session?.user?.app_metadata?.studio_id}
        currentPatient={schedaDashPaz?.paz || null}
        onArchivioFilterHint={setArchivioFiltroTipoHint}
        openPrescription={openPrescription}
        openNew={goNuovoElemento}
        openBooking={() => setPoliedronBookingOpen(true)}
        quickActionCtx={{ permissions: homePermissions, features, vertical: studioInfo?.vertical }}
        supabaseClient={supabase}
        externalCommandRequest={quickHubPoliedronRequest}
        onExternalCommandHandled={(id) => setQuickHubPoliedronRequest((current) => current?.id === id ? null : current)}
      />
      {poliedronBookingOpen && (
        <Suspense fallback={null}>
          <QuickBookingModal
            patients={patients}
            appTypes={appTypes}
            appointments={appointments}
            impegni={impegni}
            si={studioInfo}
            features={features}
            setAppointments={setAppointmentsSync}
            onClose={() => setPoliedronBookingOpen(false)}
          />
        </Suspense>
      )}
      </div>
    </div>
  );
}
