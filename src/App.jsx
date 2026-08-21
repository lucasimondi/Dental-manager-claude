import React, { useState, useEffect, Suspense, lazy } from 'react';
import { supabase, DB } from './lib/supabase.js';
import { C, DEF_PRICE, DEF_TPL, DEF_STUDIO, DEF_TPL_GENERICO, getAppTypesDefault, getLogoSlug, NAV, PIANI_FEATURES_DEFAULT, computeFeatures, mergeDockSettings, uid, applyBrandColors, applyHeaderColor } from './lib/utils.js';
import { generaRichiamiBot } from './lib/richiamiBot';
import { salvaPosizione, leggiPosizione, pulisciPosizione } from './lib/posizioneNavigazione';
import PolyhedronMenu from './components/PolyhedronMenu.jsx';
import PremiumSidebar from './components/PremiumSidebar.jsx';
import './styles/designTokens.css';
import './components/PremiumVisualSystem.css';
import { useIsMobile } from './lib/useIsMobile';
import { useTheme } from './lib/useTheme';
import AssistenteAI from './components/AssistenteAI.jsx';
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
  const [autoOpenNew, setAutoOpenNew] = useState(null);
  const [agendaInitPaz, setAgendaInitPaz] = useState(null);
  const [schedaDashPaz, setSchedaDashPaz] = useState(null);
  const [syncError, setSyncError] = useState(null);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [isStudioAdmin, setIsStudioAdmin] = useState(false);
  const [studioMembership, setStudioMembership] = useState(null);
  const [studioAttivo, setStudioAttivo] = useState(true);
  const [features, setFeatures] = useState(PIANI_FEATURES_DEFAULT.base);

  useEffect(() => {
    applyBrandColors(theme, features?.custom_colors ? { pri: studioInfo?.custom_colore_primario, acc: studioInfo?.custom_colore_accento } : null);
    applyHeaderColor(features?.custom_colors ? { colore: studioInfo?.header_colore, opacita: studioInfo?.header_opacita } : null);
  }, [theme, features?.custom_colors, studioInfo?.custom_colore_primario, studioInfo?.custom_colore_accento, studioInfo?.header_colore, studioInfo?.header_opacita]);

  useEffect(() => {
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

        const isDentisticoNew = !si?.vertical || si.vertical === 'dentistico';

        if (!pr || pr.length === 0) {
          if (isDentisticoNew) {
            const seeded = await Promise.all(DEF_PRICE.map((item) => { const { id, ...rest } = item; return DB.insert('dm_pr', rest); }));
            setPricelist(seeded);
          } else {
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

  useEffect(() => {
    if (dataLoading) return;
    const pos = leggiPosizione();
    if (!pos) return;
    if (pos.schedaPazId != null) {
      const paz = patients.find((p) => String(p.id) === String(pos.schedaPazId));
      if (paz) setSchedaDashPaz({ paz, tab: pos.schedaPazTab || 'paga' });
      else pulisciPosizione(['schedaPazId', 'schedaPazTab']);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dataLoading]);

  useEffect(() => {
    if (dataLoading) return;
    salvaPosizione({ page });
  }, [page, dataLoading]);

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
                setLocal((curr) => curr.map((x) => (x.id === tempId ? { ...x, id: saved.id } : x)));
              } catch (e) {
                console.error('insert', key, e);
                errori.push(e?.message || String(e));
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

  const sidebarLogoSrc = features.custom_logo && studioInfo?.custom_logo_b64
    ? studioInfo.custom_logo_b64
    : LOGO_WHITE_PER_SLUG[getLogoSlug(studioInfo?.vertical)];

  return (
    <div className={isMobile ? 'app-shell app-shell--mobile' : 'app-shell app-shell--desktop'} style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', height: '100dvh', background: C.bg }}>
      {!isMobile && (
        <PremiumSidebar
          nav={navVisibile}
          page={page}
          setPage={setPage}
          logoSrc={sidebarLogoSrc}
          studioName={studioInfo?.nome}
          userName={userName}
          onLogout={handleLogout}
        />
      )}
      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0, height: '100dvh', overflow: 'hidden' }}>
      {syncError && (
        <div style={{ background: C.danL, borderBottom: `2px solid ${C.dan}`, padding: '9px 14px', display: 'flex', alignItems: 'flex-start', gap: 8, flexShrink: 0 }}>
          <span style={{ fontSize: 15, flexShrink: 0 }}>⚠️</span>
          <span style={{ flex: 1, fontSize: 12, fontWeight: 600, color: '#C53030', lineHeight: 1.4 }}>{syncError}</span>
          <button onClick={() => setSyncError(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, flexShrink: 0, color: '#C53030', fontWeight: 800, fontSize: 14 }}>×</button>
        </div>
      )}

      {schedaDashPaz && (
        <Suspense fallback={null}>
          <SchedaPaz
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
          />
        </Suspense>
      )}

      <div id="app-scroll" style={{
        flex: 1, minWidth: 0, maxWidth: '100%', boxSizing: 'border-box',
        overflowY: 'auto', overflowX: 'hidden', overscrollBehavior: 'contain',
        padding: 13,
        paddingTop: isMobile ? 'calc(13px + env(safe-area-inset-top, 0px))' : 13,
        paddingBottom: isMobile ? 'calc(60px + env(safe-area-inset-bottom, 0px))' : 28,
        paddingLeft: isMobile ? (page === 'agenda' ? 6 : 15) : undefined,
        paddingRight: isMobile ? (page === 'agenda' ? 6 : 15) : undefined,
      }}>
        {page === 'home' && <Dashboard patients={patients} appointments={appointments} setAppointments={setAppointmentsSync} payments={payments} plans={plans} richiami={richiami} impegni={impegni} si={studioInfo} features={features} studioMembership={studioMembership} currentUserId={session?.user?.id} isStudioAdmin={isStudioAdmin} onNuovoPiano={goNuovoPiano} onNuovoElemento={goNuovoElemento} onSchedaPaz={goSchedaPaz} onAgendaPaz={goAgendaPaz} templates={templates} />}
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
            {page === 'agenda' && <Agenda patients={patients} setPatients={setPatientsSync} appointments={appointments} setAppointments={setAppointmentsSync} appTypes={appTypes} initPazienteId={agendaInitPaz} onClearInitPaz={() => setAgendaInitPaz(null)} templates={templates} features={features} impegni={impegni} setImpegni={setImpegniSync} si={studioInfo} setStudioInfo={setStudioInfoSync} />}
            {page === 'richiami' && <Richiami patients={patients} plans={plans} payments={payments} appointments={appointments} richiami={richiami} setRichiami={setRichiamiSync} templates={templates} />}
            {page === 'spese' && <Spese studioId={session?.user?.app_metadata?.studio_id} />}
            {page === 'controllo' && <ControlloGestione studioId={session?.user?.app_metadata?.studio_id} patients={patients} plans={plans} payments={payments} appointments={appointments} pricelist={pricelist} />}
            {page === 'archivio' && <ArchivioDocs patients={patients} onApriDocFiscale={(p) => goSchedaPaz(p, 'doc')} onApriDocMedico={(p) => goSchedaPaz(p, 'doc')} onApriDocConsenso={(p) => goSchedaPaz(p, 'doc')} />}
            {page === 'wa' && <WhatsApp patients={patients} appointments={appointments} templates={templates} setTemplates={setTemplatesSync} />}
            {page === 'agenteai' && <AgenteAISetup features={features} />}
            {page === 'set' && <Impostazioni studioInfo={studioInfo} setStudioInfo={setStudioInfoSync} appTypes={appTypes} setAppTypes={setAppTypesSync} currentUserId={session?.user?.id} onNomeChange={(n) => setUserName(n)} onLogout={handleLogout} />}
          </Suspense>
        )}
      </div>

      <AssistenteAI />

      {isMobile && (
        <PolyhedronMenu
          page={page}
          setPage={setPage}
          nav={navVisibile}
          features={features}
          isStudioAdmin={isStudioAdmin}
        />
      )}
      </div>
    </div>
  );
}
