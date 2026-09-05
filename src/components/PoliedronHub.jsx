import React, { useState, useMemo, useEffect } from 'react';
import { C, fmtD, today } from '../lib/utils';
import { PageHeader, Crd, Bdg, Ic } from './ui';
import { supabase } from '../lib/supabase.js';
import { useControlloDati } from '../lib/useControlloDati';
import { buildHomePermissions } from '../lib/homeDashboardModel.js';
import { buildDataHealthActivities, ACTIVITY_KIND } from '../lib/domain/dataHealthActivities.js';
import { computeDataHealthScore, DATA_HEALTH_SCORE_CHECK } from '../lib/domain/dataHealthScore.js';
import { usePoliedronConsigli } from '../lib/poliedron/useConsigli.js';

/* POL-UI-025 — Product Owner, dopo aver visto i due widget "Poliedron" in
   Home: "deve essere aperta in una sezione dedicata, perché in home poi
   scorrere così va bene ma troppo incasinato... magari una sezione di
   poliedron dedicata alla salute dei dati, in cui metteremo altre cose".

   Nuova pagina di primo livello (stesso pattern sidebar/dropdown già
   usato da ControlloGestione.jsx — stesse classi CSS `management-*`,
   nessuno stile nuovo) con quattro sezioni:
   - Salute dati: il punteggio 0-100% (ex widget `poliedron_health_score`
     in Home) più gli "altri avvisi" che il punteggio non copre ancora
     (trattamento fermo, appuntamento di ieri non segnato — ex widget
     `poliedron_status`, filtrato sui soli kind non già rappresentati come
     check del punteggio, per non raccontare la stessa anamnesi/piano due
     volte in due punti della stessa pagina).
   - Consigli: i Consigli Poliedron (business/CFO/marketing), spostati qui
     da Home — usa lo stesso `usePoliedronConsigli` hook che Home stessa
     usava prima di questo giro (il fetch non può "seguire" un widget da
     una pagina all'altra: React smonta Dashboard quando si naviga altrove,
     quindi la logica va condivisa via hook, non spostata e basta).
   - Da chiarire: le bollette segnalate come anomale dal controllo
     BOLLETTE_QUALITA (scostamento dalla mediana storica) — il primo caso
     reale di "punto da chiarire", con altri che si aggiungeranno qui in
     futuro (vedi nota in fondo alla sezione).
   - Chat: non è una vera sezione — un tasto che porta alla pagina Chat
     Poliedron già esistente (`page === 'chat'` in App.jsx), così tutte le
     superfici Poliedron si raggiungono da un solo posto. */

const TABS = [
  { id: 'salute', icon: 'compass', label: 'Salute dati' },
  { id: 'consigli', icon: 'trend', label: 'Consigli' },
  { id: 'chiarire', icon: 'warn', label: 'Da chiarire' },
  { id: 'chat', icon: 'chat', label: 'Chat', external: true },
];

// Le stesse due mappe già usate in Dashboard.jsx per il vecchio widget
// `poliedron_status`, riportate qui perché quel widget non esiste più su
// Home — nessuna duplicazione di LOGICA (il calcolo resta in
// dataHealthActivities.js/dataHealthScore.js), solo di questa etichetta
// di presentazione.
const DATA_HEALTH_KIND_TITLE = {
  [ACTIVITY_KIND.STALLED_TREATMENT]: 'Trattamento fermo',
  [ACTIVITY_KIND.YESTERDAY_APPOINTMENT_NOT_MARKED]: 'Appuntamento di ieri non segnato',
};
const DATA_HEALTH_KIND_ICON = {
  [ACTIVITY_KIND.STALLED_TREATMENT]: 'pulse',
  [ACTIVITY_KIND.YESTERDAY_APPOINTMENT_NOT_MARKED]: 'clk',
};
// Solo questi due kind: gli altri tre (anamnesi mancante, piano non
// iniziato, piano non deciso) sono già rappresentati come check del
// punteggio qui sotto — ripeterli anche qui mostrerebbe lo stesso
// paziente due volte per lo stesso identico motivo.
const ALTRI_AVVISI_KINDS = new Set([ACTIVITY_KIND.STALLED_TREATMENT, ACTIVITY_KIND.YESTERDAY_APPOINTMENT_NOT_MARKED]);

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

function SaluteDati({ patients, dataHealthScore, dataHealthFindings, onOpenPaz }) {
  const [expandedCheckId, setExpandedCheckId] = useState(null);
  const [expandedAvviso, setExpandedAvviso] = useState(null);

  const { percentage, checks } = dataHealthScore;
  const tone = percentage == null ? C.txl : percentage >= 80 ? C.suc : percentage >= 50 ? C.war : C.dan;
  const statusLabel = percentage == null ? 'Dati insufficienti' : percentage >= 80 ? 'Ottima' : percentage >= 50 ? 'Da migliorare' : 'Critica';
  const applicableChecks = checks.filter((c) => c.applicable);

  const avvisiGruppi = new Map();
  for (const entry of dataHealthFindings) {
    if (!ALTRI_AVVISI_KINDS.has(entry.kind)) continue;
    const list = avvisiGruppi.get(entry.kind) || [];
    list.push(entry);
    avvisiGruppi.set(entry.kind, list);
  }

  return (
    <div>
      <Crd style={{ marginBottom: 14 }}>
        {percentage == null ? (
          <div style={{ textAlign: 'center', color: C.txl, padding: '14px 0', fontSize: 13 }}>Non ci sono ancora abbastanza dati per calcolare un punteggio.</div>
        ) : (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 10 }}>
              <div style={{ fontSize: 40, fontWeight: 900, color: tone }}>{percentage}%</div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 800, color: tone }}>{statusLabel}</div>
                <div style={{ fontSize: 11, color: C.txm }}>Media di {applicableChecks.length} controlli automatici</div>
              </div>
            </div>
            <div style={{ height: 7, borderRadius: 4, background: C.bg, overflow: 'hidden' }} role="progressbar" aria-valuenow={percentage} aria-valuemin={0} aria-valuemax={100}>
              <div style={{ height: '100%', width: `${percentage}%`, background: tone, borderRadius: 4, transition: 'width 0.2s' }} />
            </div>
          </>
        )}
      </Crd>

      {applicableChecks.map((check) => {
        const checkTone = check.passRate === 1 ? C.suc : check.passRate === 0 ? C.dan : C.war;
        const isExpanded = expandedCheckId === check.id;
        const canExpand = check.scope === 'patient' && check.missingPatients.length > 0;
        return (
          <Crd key={check.id} style={{ marginBottom: 8, padding: 12 }}>
            <button type="button" onClick={() => canExpand && setExpandedCheckId(isExpanded ? null : check.id)}
              style={{ width: '100%', textAlign: 'left', background: 'none', border: 'none', padding: 0, cursor: canExpand ? 'pointer' : 'default', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: C.txt }}>{check.label}</span>
              <span style={{ fontSize: 12, fontWeight: 800, color: checkTone, flexShrink: 0 }}>
                {check.scope === 'studio' && check.totalCount <= 1 ? (check.passRate === 1 ? 'OK' : 'Da sistemare') : `${check.passedCount}/${check.totalCount}`}
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

      {avvisiGruppi.size > 0 && (
        <div style={{ marginTop: 18 }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: C.txm, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>Altri avvisi</div>
          {[...avvisiGruppi.entries()].map(([kind, list]) => {
            const isExpanded = expandedAvviso === kind;
            return (
              <Crd key={kind} style={{ marginBottom: 8 }}>
                <button type="button" onClick={() => setExpandedAvviso(isExpanded ? null : kind)} style={{ width: '100%', textAlign: 'left', background: 'none', border: 'none', padding: 0, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Ic n={DATA_HEALTH_KIND_ICON[kind] || 'warn'} s={13} c={C.pri} />
                  <span style={{ fontSize: 12, fontWeight: 800, color: C.txt, flex: 1 }}>{DATA_HEALTH_KIND_TITLE[kind] || kind}</span>
                  <Bdg ch={list.length} co={C.pri} />
                </button>
                {isExpanded && list.map((entry) => {
                  const paz = patients.find((p) => p.id === entry.pazienteId);
                  return (
                    <button key={entry.dedupKey} type="button" onClick={() => paz && onOpenPaz(paz, 'piani')}
                      style={{ width: '100%', textAlign: 'left', background: 'none', border: 'none', borderTop: `1px solid ${C.brd}`, padding: '7px 0', marginTop: 8, cursor: paz ? 'pointer' : 'default', display: 'flex', flexDirection: 'column', gap: 2 }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: paz ? C.pri : C.txt }}>{entry.patientName}{paz ? ' ›' : ''}</span>
                      <span style={{ fontSize: 11, color: C.txm }}>{entry.message}</span>
                    </button>
                  );
                })}
              </Crd>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Consigli({ consigliAttivi, patients, onOpenPaz }) {
  const { consigli, loading, err, rigenera, segnaLetto } = usePoliedronConsigli({ enabled: consigliAttivi });
  const nonLetti = consigli.filter((c) => !c.letto);
  // Stesso carosello "una card alla volta" su mobile già usato quando
  // questo widget viveva in Home (scroll-snap nativo via CSS, vedi
  // .home-poliedron-widget__track in PremiumVisualSystem.css) — riusato
  // qui perché la pagina Poliedron resta comunque visitata da telefono,
  // dove impilare tutti i consigli in verticale è meno leggibile.
  const [carouselIndex, setCarouselIndex] = useState(0);
  const onTrackScroll = (e) => {
    const el = e.currentTarget;
    setCarouselIndex(Math.round(el.scrollLeft / Math.max(1, el.clientWidth)));
  };

  if (!consigliAttivi) {
    return <Crd style={{ textAlign: 'center', color: C.txl, padding: '18px 0', fontSize: 13 }}>I Consigli Poliedron non sono attivi per questo studio (serve il livello Premium dell'assistente).</Crd>;
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 10 }}>
        <button onClick={rigenera} disabled={loading} className="home-poliedron-widget__refresh">
          {loading ? 'Genero…' : <><Ic n="refresh" s={11} c="currentColor" />Rigenera</>}
        </button>
      </div>
      {err && <div style={{ fontSize: 11, color: C.dan, marginBottom: 8 }}>{err}</div>}
      {!loading && consigli.length === 0 && !err && (
        <Crd style={{ textAlign: 'center', color: C.txl, padding: '16px 0', fontSize: 13 }}>Genero i primi consigli, un attimo…</Crd>
      )}
      {!loading && consigli.length > 0 && nonLetti.length === 0 && (
        <Crd style={{ textAlign: 'center', color: C.txl, padding: '16px 0', fontSize: 13 }}>Hai letto tutti i consigli di questa settimana</Crd>
      )}
      {nonLetti.length > 0 && (
        <div className="home-poliedron-widget__track" onScroll={onTrackScroll}>
          {nonLetti.map((c) => {
            const colore = c.categoria === 'cfo' ? C.pri : c.categoria === 'commerciale' ? C.war : C.pur;
            const labelIc = c.categoria === 'cfo' ? 'eur' : c.categoria === 'commerciale' ? 'shake' : 'trend';
            const labelTxt = c.categoria === 'cfo' ? 'CFO' : c.categoria === 'commerciale' ? 'Commerciale' : 'Marketing';
            const label = <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><Ic n={labelIc} s={10} c={colore} />{labelTxt}</span>;
            const paz = c.paziente_id ? patients.find((p) => p.id === c.paziente_id) : null;
            return (
              <Crd key={c.id} className="home-poliedron-widget__card" style={{ marginBottom: 8, borderLeft: `3px solid ${colore}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ marginBottom: 5 }}><Bdg ch={label} co={colore} /></div>
                    <div style={{ fontWeight: 800, fontSize: 13, marginBottom: 3, color: C.txt }}>{c.titolo}</div>
                    <div style={{ fontSize: 12, color: C.txm, lineHeight: 1.45 }}>{c.testo}</div>
                    {paz && <div onClick={() => onOpenPaz(paz, 'info')} style={{ marginTop: 6, fontSize: 12, fontWeight: 700, color: C.pri, cursor: 'pointer' }}>{paz.nome} {paz.cognome} ›</div>}
                  </div>
                  <button className="home-list-icon-btn" onClick={() => segnaLetto(c.id)} title="Segna come letto" style={{ background: C.sucL }}>
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
          {nonLetti.map((c, i) => <span key={c.id} className={`home-poliedron-widget__dot${i === carouselIndex ? ' is-active' : ''}`} />)}
        </div>
      )}
    </div>
  );
}

function DaChiarire({ dataHealthScore }) {
  const bolletteQualita = dataHealthScore.checks.find((c) => c.id === DATA_HEALTH_SCORE_CHECK.BOLLETTE_QUALITA);
  const anomalies = bolletteQualita?.anomalies || [];

  return (
    <div>
      {anomalies.length === 0 ? (
        <Crd style={{ textAlign: 'center', color: C.suc, padding: '18px 0', fontSize: 13, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
          <Ic n="ok" s={13} c={C.suc} />Nessun punto da chiarire al momento
        </Crd>
      ) : (
        <>
          <div style={{ fontSize: 11, fontWeight: 800, color: C.txm, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>Bollette con importo fuori dallo storico</div>
          {anomalies.map((a) => (
            <Crd key={a.data + a.importo} style={{ marginBottom: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 800, color: C.txt }}>{a.titolo || 'Bolletta (Utenze)'}</div>
                  <div style={{ fontSize: 11, color: C.txm }}>{fmtD(a.data)} — media storica {a.baseline}€</div>
                </div>
                <div style={{ fontSize: 16, fontWeight: 900, color: C.war }}>{a.importo}€</div>
              </div>
            </Crd>
          ))}
        </>
      )}
      <Crd style={{ marginTop: 18, background: C.bg, border: 'none' }}>
        <div style={{ fontSize: 11, color: C.txm, lineHeight: 1.5 }}>
          Qui arriveranno altri punti che richiedono una tua conferma, man mano che Poliedron li troverà — non solo dati mancanti, ma anche cose da verificare.
        </div>
      </Crd>
    </div>
  );
}

export default function PoliedronHub({
  patients = [], plans = [], appointments = [], payments = [], implants = [],
  studioId, isStudioAdmin, features, studioMembership, si, onOpenPaz, onNavigate,
}) {
  const [section, setSection] = useState('salute');
  const active = TABS.find((item) => item.id === section);
  const homePermissions = buildHomePermissions({ membership: studioMembership, features, vertical: si?.vertical });
  const { spese, scadenzeScadute } = useControlloDati({ studioId, patients, plans, payments, periodo: 'mese', enabled: homePermissions.managementControl });
  const consigliAttivi = isStudioAdmin && features?.assistente_ai === 'premium';
  const t = today();

  const dataHealthFindings = useMemo(
    () => buildDataHealthActivities({ patients, plans, appointments, today: t, formatDate: fmtD }),
    [patients, plans, appointments, t],
  );
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

  const handleTabClick = (item) => {
    if (item.external) { onNavigate && onNavigate('chat'); return; }
    setSection(item.id);
  };

  return (
    <div className="management-hub">
      <div className="management-hub__header">
        <PageHeader icon="compass" title="Poliedron" subtitle="Salute dati, consigli e punti da chiarire" />
      </div>
      <div className="management-layout">
        <aside className="management-nav" aria-label="Aree Poliedron">
          {TABS.map((item) => (
            <button type="button" key={item.id} className={!item.external && section === item.id ? 'is-active' : ''} onClick={() => handleTabClick(item)}>
              <Ic n={item.icon} s={15} c={!item.external && section === item.id ? C.pri : C.txm} /><span>{item.label}</span>
            </button>
          ))}
        </aside>
        <label className="management-nav-mobile">Area
          <select value={section} onChange={(event) => {
            const item = TABS.find((tab) => tab.id === event.target.value);
            item && handleTabClick(item);
          }}>
            {TABS.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
          </select>
        </label>
        <main className="management-hub__section" aria-label={active?.label}>
          {section === 'salute' && <SaluteDati patients={patients} dataHealthScore={dataHealthScore} dataHealthFindings={dataHealthFindings} onOpenPaz={onOpenPaz} />}
          {section === 'consigli' && <Consigli consigliAttivi={consigliAttivi} patients={patients} onOpenPaz={onOpenPaz} />}
          {section === 'chiarire' && <DaChiarire dataHealthScore={dataHealthScore} />}
        </main>
      </div>
    </div>
  );
}
