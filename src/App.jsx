import React, { useState, useEffect } from 'react';
import { supabase, DB } from './lib/supabase.js';
import { C, DEF_PRICE, DEF_TPL, DEF_STUDIO, DEF_APP_TYPES, DEF_TPL_GENERICO, DEF_APP_TYPES_GENERICO, NAV, PIANI_FEATURES_DEFAULT, computeFeatures } from './lib/utils';
import { useTheme } from './lib/useTheme';
import { Ic } from './components/ui';
import AssistenteAI from './components/AssistenteAI.jsx';
import logoDentalWhite from './assets/logo-poliedra-dental-outline.png';
import logoSalusWhite from './assets/logo-poliedra-salus-outline.png';
import LoginScreen from './components/LoginScreen.jsx';
import LoadingScreen from './components/LoadingScreen.jsx';
import Dashboard from './components/Dashboard.jsx';
import Pazienti from './components/Pazienti.jsx';
import SchedaPaz from './components/SchedaPaz.jsx';
import Piani from './components/Piani.jsx';
import Pagamenti from './components/Pagamenti.jsx';
import Spese from './components/Spese.jsx';
import ArchivioDocs from './components/ArchivioDocs.jsx';
import Listino from './components/Listino.jsx';
import Agenda from './components/Agenda.jsx';
import WhatsApp from './components/WhatsApp.jsx';
import Impostazioni from './components/Impostazioni.jsx';
import MasterDashboard from './components/MasterDashboard.jsx';

export default function App() {
  const { theme, toggleTheme } = useTheme();
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
  const [initPatId, setInitPatId] = useState(null);
  const [agendaInitPaz, setAgendaInitPaz] = useState(null);
  const [schedaDashPaz, setSchedaDashPaz] = useState(null);
  const [syncError, setSyncError] = useState(null);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [showMasterDashboard, setShowMasterDashboard] = useState(false);
  const [studioAttivo, setStudioAttivo] = useState(true);
  const [features, setFeatures] = useState(PIANI_FEATURES_DEFAULT.base);

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
        const [p, a, pl, py, pr, tp, at, im, si] = await Promise.all([
          DB.getAll('dm_p'),
          DB.getAll('dm_a'),
          DB.getAll('dm_pl'),
          DB.getAll('dm_py'),
          DB.getAll('dm_pr'),
          DB.getAll('dm_tp'),
          DB.getAll('dm_at'),
          DB.getAll('dm_im'),
          DB.getStudioInfo(),
        ]);
        if (cancelled) return;
        setPatients(p || []);
        setAppointments(a || []);
        setPlans(pl || []);
        setPayments(py || []);
        setImplants(im || []);

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
          const seeded = await Promise.all((isDentisticoNew ? DEF_APP_TYPES : DEF_APP_TYPES_GENERICO).map((item) => { const { id, ...rest } = item; return DB.insert('dm_at', rest); }));
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
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [session]);

  useEffect(() => {
    if (!session) { setIsSuperAdmin(false); setStudioAttivo(true); setFeatures(PIANI_FEATURES_DEFAULT.base); return; }
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
      }
    })();
    return () => { cancelled = true; };
  }, [session]);

  useEffect(() => {
    if ((page === 'wa' && !features.whatsapp) || (page === 'spese' && !features.spese)) setPage('home');
  }, [page, features]);

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
            let falliti = 0;
            for (const item of nuovi) {
              try {
                const { id: tempId, ...rest } = item;
                const saved = await DB.insert(key, rest);
                setLocal((curr) => curr.map((x) => (x.id === tempId ? { ...x, id: saved.id } : x)));
              } catch (e) {
                console.error('insert', key, e);
                falliti++;
              }
            }
            if (falliti > 0 && onError) onError(`${falliti} elemento/i non salvato/i sul cloud. Controlla i campi obbligatori (es. nome/cognome) e riprova.`);
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

  const setStudioInfoSync = (updaterOrVal) => {
    setStudioInfo((prev) => {
      const next = typeof updaterOrVal === 'function' ? updaterOrVal(prev) : updaterOrVal;
      DB.setStudioInfo(next).catch((e) => console.error('Errore salvataggio studio info', e));
      return next;
    });
  };

  const goNuovoPiano = (id) => { setInitPatId(id); setPage('piani'); };
  const goSchedaPaz = (paz, tab = 'paga') => setSchedaDashPaz({ paz, tab });
  const goAgendaPaz = (pazId) => { setAgendaInitPaz(pazId); setPage('agenda'); };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setPatients([]); setAppointments([]); setPlans([]); setPayments([]);
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

  if (showMasterDashboard) return <MasterDashboard onClose={() => setShowMasterDashboard(false)} />;

  const navVisibile = NAV.filter((n) => (n.id !== 'wa' || features.whatsapp) && (n.id !== 'spese' || features.spese));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100dvh', background: C.bg, overflow: 'hidden' }}>
      <div style={{ background: C.priD, padding: '11px 14px', paddingTop: 'max(11px,env(safe-area-inset-top))', display: 'flex', alignItems: 'center', gap: 9, flexShrink: 0 }}>
        {features.custom_branding && studioInfo?.custom_logo_b64 ? (
          <img src={studioInfo.custom_logo_b64} alt={studioInfo?.nome || 'Logo'} style={{ height: 40, maxWidth: 160, display: 'block', objectFit: 'contain' }} />
        ) : (
          <img
            src={(!studioInfo?.vertical || studioInfo.vertical === 'dentistico') ? logoDentalWhite : logoSalusWhite}
            alt="Poliedra"
            style={{ height: 48, display: 'block' }}
          />
        )}
        <div style={{ marginLeft: 'auto', fontSize: 11, color: 'rgba(255,255,255,0.55)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 10 }}>
          {userName && <span style={{ color: 'rgba(255,255,255,0.8)', fontWeight: 700 }}>{userName}</span>}
          <span style={{ color: 'rgba(255,255,255,0.3)' }}>·</span>
          <span>{navVisibile.find((n) => n.id === page)?.l}</span>
          {isSuperAdmin && <button onClick={() => setShowMasterDashboard(true)} title="Dashboard Master" style={{ background: 'rgba(255,255,255,0.12)', border: 'none', borderRadius: 6, padding: '4px 8px', color: '#fff', fontSize: 10, fontWeight: 700, cursor: 'pointer' }}>🛠️</button>}
          <button onClick={handleLogout} title="Esci" style={{ background: 'rgba(255,255,255,0.12)', border: 'none', borderRadius: 6, padding: '4px 8px', color: '#fff', fontSize: 10, fontWeight: 700, cursor: 'pointer' }}>Esci</button>
        </div>
      </div>

      {syncError && (
        <div style={{ background: C.danL, borderBottom: `2px solid ${C.dan}`, padding: '9px 14px', display: 'flex', alignItems: 'flex-start', gap: 8, flexShrink: 0 }}>
          <span style={{ fontSize: 15, flexShrink: 0 }}>⚠️</span>
          <span style={{ flex: 1, fontSize: 12, fontWeight: 600, color: '#C53030', lineHeight: 1.4 }}>{syncError}</span>
          <button onClick={() => setSyncError(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, flexShrink: 0, color: '#C53030', fontWeight: 800, fontSize: 14 }}>✕</button>
        </div>
      )}

      {schedaDashPaz && (
        <SchedaPaz
          paz={schedaDashPaz.paz}
          initTab={schedaDashPaz.tab}
          plans={plans} setPlans={setPlansSync}
          payments={payments}
          appointments={appointments}
          si={studioInfo}
          features={features}
          onClose={() => setSchedaDashPaz(null)}
          onEdit={() => setSchedaDashPaz(null)}
          onNuovoPiano={(id) => { setSchedaDashPaz(null); goNuovoPiano(id); }}
        />
      )}

      <div id="app-scroll" style={{ flex: 1, overflowY: 'auto', padding: 13, paddingBottom: 78 }}>
        {page === 'home' && <Dashboard patients={patients} appointments={appointments} setAppointments={setAppointmentsSync} payments={payments} plans={plans} onOpenPaz={goSchedaPaz} appTypes={appTypes} onGoAgenda={() => setPage('agenda')} templates={templates} userName={userName} si={studioInfo} features={features} />}
        {page === 'paz' && (
          <Pazienti
            patients={patients} setPatients={setPatientsSync}
            plans={plans} setPlans={setPlansSync}
            payments={payments} setPayments={setPaymentsSync} appointments={appointments} si={studioInfo}
            features={features}
            onNuovoPiano={goNuovoPiano}
            implants={implants} setImplants={setImplantsSync}
            setAppointments={setAppointmentsSync}
            onNuovoAppuntamento={goAgendaPaz}
            templates={templates}
          />
        )}
        {page === 'piani' && (
          <Piani
            patients={patients} plans={plans} setPlans={setPlansSync}
            pricelist={pricelist} templates={templates} si={studioInfo} features={features}
            initPatId={initPatId} onClearInitPat={() => setInitPatId(null)}
            onOpenPaz={goSchedaPaz}
          />
        )}
        {page === 'paga' && <Pagamenti patients={patients} payments={payments} setPayments={setPaymentsSync} plans={plans} />}
        {page === 'listino' && <Listino pricelist={pricelist} setPricelist={setPricelistSync} si={studioInfo} />}
        {page === 'agenda' && <Agenda patients={patients} appointments={appointments} setAppointments={setAppointmentsSync} appTypes={appTypes} initPazienteId={agendaInitPaz} onClearInitPaz={() => setAgendaInitPaz(null)} templates={templates} userName={userName} features={features} />}
        {page === 'spese' && <Spese />}
        {page === 'archivio' && <ArchivioDocs patients={patients} onApriDocFiscale={(p) => goSchedaPaz(p, 'doc')} onApriDocMedico={(p) => goSchedaPaz(p, 'doc')} />}
        {page === 'wa' && <WhatsApp patients={patients} appointments={appointments} templates={templates} setTemplates={setTemplatesSync} />}
        {page === 'set' && <Impostazioni studioInfo={studioInfo} setStudioInfo={setStudioInfoSync} appTypes={appTypes} setAppTypes={setAppTypesSync} currentUserId={session?.user?.id} onNomeChange={(n) => setUserName(n)} features={features} theme={theme} toggleTheme={toggleTheme} />}
      </div>

      <AssistenteAI />

      <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, background: C.sur, borderTop: `1px solid ${C.brd}`, display: 'grid', gridTemplateColumns: `repeat(${navVisibile.length + 1},1fr)`, paddingBottom: 'env(safe-area-inset-bottom,0px)', zIndex: 100, boxShadow: '0 -2px 10px rgba(0,0,0,0.07)' }}>
        {navVisibile.map((n) => (
          <button key={n.id} onClick={() => setPage(n.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '7px 1px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, color: page === n.id ? C.pri : C.txl }}>
            <div style={{ background: page === n.id ? C.priL : 'transparent', borderRadius: 7, padding: '3px 5px' }}><Ic n={n.ic} s={17} c={page === n.id ? C.pri : C.txl} /></div>
            <span style={{ fontSize: 8, fontWeight: page === n.id ? 800 : 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '100%' }}>{n.l}</span>
          </button>
        ))}
        <button onClick={() => supabase.auth.signOut()} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '7px 1px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, color: C.txl }}>
          <div style={{ borderRadius: 7, padding: '3px 5px' }}><Ic n="x" s={17} c={C.txl} /></div>
          <span style={{ fontSize: 8, fontWeight: 500 }}>Esci</span>
        </button>
      </div>
    </div>
  );
}

