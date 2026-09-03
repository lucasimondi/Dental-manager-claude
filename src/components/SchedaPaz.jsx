import React, { Suspense, lazy, useState } from 'react';
import { Btn, Crd, Bdg, Ic, PhStr } from './ui';
import { C, fmt, fmtD, today } from '../lib/utils';
import { aggregateSaldi } from '../lib/domain/incassiMath.js';
import PianoDrillDown from './PianoDrillDown.jsx';

const DocMedico = lazy(() => import('./DocMedico.jsx'));
const DocFiscale = lazy(() => import('./DocFiscale.jsx'));
const PatientPhotos = lazy(() => import('./PatientPhotos.jsx'));
const PatientImplants = lazy(() => import('./PatientImplants.jsx'));
const PhysioCartella = lazy(() => import('./PhysioCartella.jsx'));
const PatientClinicalHistory = lazy(() => import('./PatientClinicalHistory.jsx'));
const PatientPrivacy = lazy(() => import('./PatientPrivacy.jsx'));
const PatientQuickActions = lazy(() => import('./PatientQuickActions.jsx'));
const PatientWorkspaceDocuments = lazy(() => import('./PatientWorkspaceDocuments.jsx'));
const PatientWorkspaceConsentFlow = lazy(() => import('./PatientWorkspaceDocuments.jsx').then((module) => ({ default: module.PatientWorkspaceConsentFlow })));

export default function SchedaPaz({ paz, plans, payments, appointments, si, onClose, onEdit, onNuovoPiano, setPlans, initTab, documentClient, initialDocumentRequest, onDocumentRequestHandled = () => {}, implants = [], setImplants, setPatients, setPayments, richiami = [], setRichiami, onNuovoAppuntamento, onPatientChange, studioMembership, currentUserId, isStudioAdmin, saldiPiani = {}, pricelist = [] }) {
  const [tab, setTab] = useState(initTab || 'info');
  const [documentFlow, setDocumentFlow] = useState(() => initialDocumentRequest?.type === 'ricetta' ? 'ricetta' : null);
  const [documentsReloadToken, setDocumentsReloadToken] = useState(0);

  // Recovery boundary: legacy rows can contain null/non-array JSON fields.
  // Normalize before render so a single malformed historical row cannot take
  // down the whole patient record.
  const patPlans = (Array.isArray(plans) ? plans : [])
    .filter((pl) => pl?.pazienteId === paz.id)
    .map((pl) => ({ ...pl, voci: Array.isArray(pl.voci) ? pl.voci : [] }));
  const patPay = [...(Array.isArray(payments) ? payments : []).filter((p) => p?.pazienteId === paz.id)].reverse();
  const patApp = [...(Array.isArray(appointments) ? appointments : []).filter((a) => a?.pazienteId === paz.id)]
    .sort((a, b) => String(b.data || '').localeCompare(String(a.data || '')));

  // POL-FIN-002: "Da incassare" is the canonical saldo_piano (totale_piano -
  // totale_pagato) computed server-side by get_saldo_piano — never
  // recomputed here. The parent (App.jsx) fetches it and hands it down as
  // the saldiPiani prop; this component takes no data-fetching hook and no
  // direct backend-client import of its own — see
  // tests/patientRecordRecovery.test.mjs, a regression guard from the
  // POL-UI-PATIENT-FREEZE-PROD incident.
  const patPlanIds = patPlans.map((pl) => pl.id);
  const saldiCaricati = patPlanIds.length === 0 || patPlanIds.every((id) => saldiPiani[id]);
  const aggSaldi = aggregateSaldi(patPlanIds.map((id) => saldiPiani[id]).filter(Boolean));
  const totDaPagare = aggSaldi.saldo_piano;
  const pctPagato = aggSaldi.totale_piano > 0 ? Math.min(100, Math.round((aggSaldi.totale_pagato / aggSaldi.totale_piano) * 100)) : 0;

  const isDentistico = !si?.vertical || si.vertical === 'dentistico';
  const isFisio = si?.vertical === 'fisioterapista' || si?.vertical === 'massofisioterapista';
  const capabilities = new Set(studioMembership?.stato === 'attivo' ? (studioMembership?.capabilities || []) : []);
  const physioFullAccess = capabilities.has('clinical.physiotherapist');
  const physioOperationalAccess = capabilities.has('clinical.personal_trainer') || capabilities.has('clinical.massage_therapist');
  const canAccessPhysio = isFisio && (physioFullAccess || physioOperationalAccess);
  const canManagePhysioTeam = physioFullAccess || isStudioAdmin === true;
  // POL-FIN-007f: Product Owner, twice now, on the section tabs — first
  // "troppo ingombrante", then (after an icon-only compaction round) still
  // "ancora non mi piace... un modo più funzionale e pro". A tab strip
  // (wrapped grid or icon-only) was never going to read as "pro" no matter
  // how compact — the pattern this app already uses for the same problem
  // (many sections, limited width) is ControlloGestione.jsx's persistent
  // icon+label sidebar on desktop / dropdown selector on mobile
  // (`.management-nav`/`.management-nav-mobile`). Mirrored here verbatim as
  // `.patient-record-nav`/`.patient-record-nav-mobile` for visual
  // consistency with the rest of the app, not a bespoke one-off look.
  // Real icons (the same Ic set every other module already uses) replace
  // the emoji now that full labels are always shown, sidebar or dropdown.
  const TABS = [{ id: 'info', icon: 'user', label: 'Info' }, { id: 'clinical', icon: 'pulse', label: 'Anamnesi' }, { id: 'piani', icon: 'tooth', label: 'Piani' }, ...(isDentistico ? [{ id: 'impl', icon: 'tag', label: 'Impianti' }] : []), ...(canAccessPhysio ? [{ id: 'fisio', icon: 'zap', label: 'Fisioterapia' }] : []), { id: 'paga', icon: 'pay', label: 'Pagamenti' }, { id: 'foto', icon: 'folder', label: 'Foto' }, { id: 'app', icon: 'cal', label: 'Agenda' }, { id: 'doc', icon: 'file', label: 'Documenti' }, ...(isStudioAdmin ? [{ id: 'privacy', icon: 'lock', label: 'Privacy' }] : [])];

  return (
    <div style={{ position: 'fixed', inset: 0, background: C.bg, zIndex: 500, display: 'flex', flexDirection: 'column' }}>
      <div style={{ background: C.priD, padding: '12px 14px', paddingTop: 'max(12px,env(safe-area-inset-top))', display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
        <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.12)', border: 'none', borderRadius: 8, padding: 8, cursor: 'pointer', display: 'flex' }}><Ic n="back" s={18} c="#fff" /></button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ color: '#fff', fontWeight: 800, fontSize: 15, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{paz.nome} {paz.cognome}</div>
          {paz.cf && <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: 11, fontFamily: 'monospace' }}>{paz.cf}</div>}
        </div>
        <button onClick={() => onEdit(paz)} style={{ background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: 8, padding: '6px 11px', cursor: 'pointer', color: '#fff', fontWeight: 700, fontSize: 12, display: 'flex', alignItems: 'center', gap: 4 }}><Ic n="edit" s={13} c="#fff" />Modifica</button>
      </div>

      <div style={{ background: C.priD, display: 'flex', borderTop: '1px solid rgba(255,255,255,0.1)', flexShrink: 0 }}>
        {[{ l: 'Piani', v: patPlans.length }, { l: 'Pagato', v: saldiCaricati ? fmt(aggSaldi.totale_pagato) : '…' }, { l: 'Da pagare', v: saldiCaricati ? fmt(totDaPagare) : '…' }, { l: 'Visite', v: patApp.length }].map((s) => (
          <div key={s.l} style={{ flex: 1, textAlign: 'center', padding: '8px 2px', borderRight: '1px solid rgba(255,255,255,0.1)' }}>
            <div style={{ color: s.l === 'Da pagare' && totDaPagare > 0 ? '#FCA5A5' : '#fff', fontWeight: 800, fontSize: 12 }}>{s.v}</div>
            <div style={{ color: 'rgba(255,255,255,0.55)', fontSize: 9 }}>{s.l}</div>
          </div>
        ))}
      </div>

      <div className="patient-record-body">
        <aside className="patient-record-nav" aria-label="Sezioni scheda paziente">
          {TABS.map((t) => (
            <button type="button" key={t.id} className={tab === t.id ? 'is-active' : ''} onClick={() => setTab(t.id)}>
              <Ic n={t.icon} s={15} c={tab === t.id ? C.pri : C.txm} /><span>{t.label}</span>
            </button>
          ))}
        </aside>
        <label className="patient-record-nav-mobile">Sezione
          <select value={tab} onChange={(event) => setTab(event.target.value)}>
            {TABS.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
          </select>
        </label>

      <div className="patient-record-content">
        {tab === 'info' && (
          <div>
            {paz.telefono && (
              <Crd style={{ marginBottom: 10 }}>
                <div style={{ fontWeight: 700, fontSize: 13 }}>📞 {paz.telefono}</div>
                <PhStr tel={paz.telefono} />
              </Crd>
            )}
            <Crd style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: C.pri, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>Anagrafica</div>
              {[['Nascita', fmtD(paz.dataNascita)], ['C.F.', paz.cf || '—'], ['Indirizzo', paz.indirizzo || '—'], ['Email', paz.email || '—']].map(([l, v]) => (
                <div key={l} style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', borderBottom: `1px solid ${C.brd}`, gap: 10 }}>
                  <span style={{ fontSize: 11, color: C.txm, fontWeight: 600, flexShrink: 0 }}>{l}</span>
                  <span style={{ fontSize: 12, color: C.txt, textAlign: 'right', wordBreak: 'break-word' }}>{v}</span>
                </div>
              ))}
            </Crd>
            <Suspense fallback={<div role="status" style={{ padding: 12, color: C.txm }}>Caricamento azioni…</div>}><PatientQuickActions patient={paz} plans={patPlans} setPatients={setPatients} setPayments={setPayments} richiami={richiami} setRichiami={setRichiami} onNewAppointment={onNuovoAppuntamento} onPatientChange={onPatientChange} /></Suspense>
            {paz.note && (
              <Crd style={{ background: '#FFFBEB', border: '1px solid #FCD34D' }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#92400E', textTransform: 'uppercase', marginBottom: 5 }}>⚠️ Note cliniche</div>
                <div style={{ fontSize: 13, color: '#78350F', lineHeight: 1.6 }}>{paz.note}</div>
              </Crd>
            )}
          </div>
        )}

        {tab === 'piani' && (
          <div>
            <div style={{ marginBottom: 10 }}>
              <Btn ch="+ Nuovo piano" v="pri" sz="sm" onClick={() => onNuovoPiano(paz.id)} />
            </div>
            {/* POL-FIN-007: stessa grafica/tastini della pagina Piani
                generale (PianoDrillDown.jsx) — qui già scoperto al paziente,
                nessun elenco pazienti da attraversare. */}
            <PianoDrillDown
              plans={patPlans}
              patients={[paz]}
              setPlans={setPlans}
              payments={payments}
              setPayments={setPayments}
              pricelist={pricelist}
              si={si}
            />
          </div>
        )}

        {tab === 'paga' && (
          <div>
            <Crd style={{ marginBottom: 12, background: C.priD, border: 'none' }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: 'rgba(255,255,255,0.6)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>Situazione finanziaria</div>
              <div style={{ marginBottom: 10 }}>
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.55)' }}>Da incassare</div>
                <div style={{ fontSize: 26, fontWeight: 900, color: saldiCaricati ? (aggSaldi.saldo_piano > 0 ? '#FCA5A5' : '#86efac') : 'rgba(255,255,255,0.4)' }}>
                  {saldiCaricati ? fmt(aggSaldi.saldo_piano) : '…'}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
                <div style={{ flex: 1, background: 'rgba(255,255,255,0.08)', borderRadius: 8, padding: '8px 10px' }}>
                  <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.55)' }}>Eseguito non pagato</div>
                  <div style={{ fontSize: 14, fontWeight: 800, color: '#FCD34D' }}>{saldiCaricati ? fmt(aggSaldi.eseguito_non_pagato) : '…'}</div>
                </div>
                <div style={{ flex: 1, background: 'rgba(255,255,255,0.08)', borderRadius: 8, padding: '8px 10px' }}>
                  <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.55)' }}>Acconto</div>
                  <div style={{ fontSize: 14, fontWeight: 800, color: '#86efac' }}>{saldiCaricati ? fmt(aggSaldi.acconto) : '…'}</div>
                </div>
              </div>
              <div style={{ background: 'rgba(255,255,255,0.15)', borderRadius: 6, height: 8, overflow: 'hidden', marginBottom: 4 }}>
                <div style={{ height: '100%', width: `${pctPagato}%`, background: pctPagato >= 100 ? '#86efac' : '#60a5fa', borderRadius: 6, transition: 'width 0.3s' }} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'rgba(255,255,255,0.5)' }}>
                <span>Eseguito {saldiCaricati ? fmt(aggSaldi.totale_eseguito) : '…'} · Pagato {saldiCaricati ? fmt(aggSaldi.totale_pagato) : '…'}</span>
                <span>{pctPagato}% saldato</span>
              </div>
            </Crd>
            {patPlans.length > 0 && (
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 11, fontWeight: 800, color: C.txm, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 7 }}>Dettaglio per piano</div>
                {patPlans.map((pl) => {
                  const s = saldiPiani[pl.id];
                  return (
                    <Crd key={pl.id} style={{ marginBottom: 8, borderLeft: `3px solid ${C.pri}` }}>
                      <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 6 }}>{pl.titolo}</div>
                      {!s ? (
                        <div style={{ fontSize: 11, color: C.txl }}>Caricamento saldo…</div>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                          {[['Totale piano', Number(s.totale_piano), C.pri], ['Da incassare', Number(s.saldo_piano), Number(s.saldo_piano) > 0 ? C.dan : C.suc]].map(([l, v, co]) => (
                            <div key={l} style={{ display: 'flex', justifyContent: 'space-between' }}>
                              <span style={{ fontSize: 11, color: C.txm }}>{l}</span>
                              <span style={{ fontSize: 12, fontWeight: 700, color: co }}>{fmt(v)}</span>
                            </div>
                          ))}
                          {Number(s.eseguito_non_pagato) > 0 && (
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                              <span style={{ fontSize: 11, color: C.txm }}>Eseguito non pagato</span>
                              <span style={{ fontSize: 12, fontWeight: 700, color: C.war }}>{fmt(Number(s.eseguito_non_pagato))}</span>
                            </div>
                          )}
                          {Number(s.acconto) > 0 && (
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                              <span style={{ fontSize: 11, color: C.suc }}>Acconto</span>
                              <span style={{ fontSize: 12, fontWeight: 700, color: C.suc }}>{fmt(Number(s.acconto))}</span>
                            </div>
                          )}
                        </div>
                      )}
                    </Crd>
                  );
                })}
              </div>
            )}
            <div style={{ fontSize: 11, fontWeight: 800, color: C.txm, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 7 }}>Pagamenti registrati</div>
            {patPay.length === 0 && <div style={{ textAlign: 'center', color: C.txl, padding: '20px 0' }}>Nessun pagamento registrato</div>}
            {patPay.map((p) => (
              <Crd key={p.id} style={{ marginBottom: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ background: C.sucL, borderRadius: 9, padding: 8, flexShrink: 0 }}><Ic n="eur" s={16} c={C.suc} /></div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 15, fontWeight: 800, color: C.suc }}>{fmt(p.importo)}</div>
                    <div style={{ fontSize: 11, color: C.txm, marginTop: 2 }}>{fmtD(p.data)}{p.nota ? ' · ' + p.nota : ''}</div>
                    <div style={{ marginTop: 4, display: 'flex', gap: 4, flexWrap: 'wrap' }}><Bdg ch={p.metodo} co={C.pri} /><Bdg ch={p.stato} co={p.stato === 'pagato' ? C.suc : C.war} /></div>
                  </div>
                </div>
              </Crd>
            ))}
            {totDaPagare > 0 && (
              <Crd style={{ background: '#FEF3E2', border: `1px solid ${C.war}40`, marginTop: 4 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: '#92400E' }}>⏳ Saldo residuo</span>
                  <span style={{ fontSize: 17, fontWeight: 900, color: C.dan }}>{fmt(totDaPagare)}</span>
                </div>
              </Crd>
            )}
          </div>
        )}

        {tab === 'app' && (
          <div>
            {patApp.length === 0 && <div style={{ textAlign: 'center', color: C.txl, padding: 40 }}>Nessun appuntamento</div>}
            {patApp.map((a) => (
              <Crd key={a.id} style={{ marginBottom: 8, borderLeft: `3px solid ${a.data >= today() ? C.pri : C.brd}` }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ background: a.data >= today() ? C.priL : C.bg, borderRadius: 8, padding: '5px 7px', textAlign: 'center', minWidth: 40, flexShrink: 0 }}>
                    <div style={{ fontSize: 10, color: a.data >= today() ? C.pri : C.txl, fontWeight: 700 }}>{a.data.slice(8)}/{a.data.slice(5, 7)}</div>
                    <div style={{ fontSize: 12, fontWeight: 800, color: a.data >= today() ? C.priD : C.txm }}>{a.ora}</div>
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: 13 }}>{a.tipo}</div>
                    <div style={{ fontSize: 11, color: C.txm }}>{a.durata}min{a.note ? ' · ' + a.note : ''}</div>
                  </div>
                  <Bdg ch={a.stato} co={a.stato === 'confermato' ? C.suc : a.stato === 'annullato' ? C.dan : C.war} />
                </div>
              </Crd>
            ))}
          </div>
        )}

        {tab === 'doc' && (
          <div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
              <Btn ch="Nuova ricetta" v="pri" sz="sm" onClick={() => setDocumentFlow('ricetta')} />
              <Btn ch="Documento medico" v="sec" sz="sm" onClick={() => setDocumentFlow('medico')} />
              <Btn ch="Fattura / rimborso" v="sec" sz="sm" onClick={() => setDocumentFlow('fiscale')} />
              <Btn ch="Nuovo consenso" v="sec" sz="sm" onClick={() => setDocumentFlow('consenso')} />
            </div>
            <Suspense fallback={<div role="status" style={{ padding: 20, textAlign: 'center', color: C.txm }}>Caricamento documenti…</div>}>
              <PatientWorkspaceDocuments patientId={paz.id} client={documentClient} reloadToken={documentsReloadToken} />
            </Suspense>
          </div>
        )}
        {tab === 'foto' && <Suspense fallback={<div role="status" style={{ padding: 20, textAlign: 'center', color: C.txm }}>Caricamento modulo foto…</div>}><PatientPhotos patientId={paz.id} client={documentClient} /></Suspense>}
        {tab === 'impl' && isDentistico && <Suspense fallback={<div role="status" style={{ padding: 20, textAlign: 'center', color: C.txm }}>Caricamento impianti…</div>}><PatientImplants patientId={paz.id} implants={implants} setImplants={setImplants} /></Suspense>}
        {tab === 'fisio' && canAccessPhysio && <Suspense fallback={<div role="status" style={{ padding: 20, textAlign: 'center', color: C.txm }}>Caricamento cartella fisioterapica…</div>}><PhysioCartella paziente_id={paz.id} studio_id={si?.studio_id} paziente={paz} studio={si} accessMode={physioFullAccess ? 'full' : 'operational'} currentUserId={currentUserId} canManageTeam={canManagePhysioTeam} /></Suspense>}
        {tab === 'clinical' && <Suspense fallback={<div role="status" style={{ padding: 20, textAlign: 'center', color: C.txm }}>Caricamento anamnesi…</div>}><PatientClinicalHistory patient={paz} setPatients={setPatients} onPatientChange={onPatientChange} studio={si} /></Suspense>}
        {tab === 'privacy' && isStudioAdmin && <Suspense fallback={<div role="status" style={{ padding: 20, textAlign: 'center', color: C.txm }}>Caricamento strumenti privacy…</div>}><PatientPrivacy patient={paz} setPatients={setPatients} client={documentClient} onPatientDeleted={onClose} /></Suspense>}
      </div>
      </div>

      {(documentFlow === 'ricetta' || documentFlow === 'medico') && (
        <Suspense fallback={<div role="status" style={{ position: 'fixed', inset: 0, zIndex: 9999, background: C.bg, padding: 24 }}>Caricamento editor ricetta…</div>}>
          <DocMedico
            paz={paz}
            si={si}
            initialType={documentFlow === 'ricetta' ? 'ricetta' : undefined}
            initialPrefill={documentFlow === 'ricetta' ? initialDocumentRequest?.prefill : undefined}
            requestId={documentFlow === 'ricetta' ? initialDocumentRequest?.requestId : undefined}
            onInitialRequestHandled={onDocumentRequestHandled}
            onClose={() => { setDocumentFlow(null); onDocumentRequestHandled(initialDocumentRequest?.requestId); }}
            onDocumentSaved={() => { setDocumentsReloadToken((value) => value + 1); }}
          />
        </Suspense>
      )}
      {documentFlow === 'fiscale' && (
        <Suspense fallback={<div role="status" style={{ position: 'fixed', inset: 0, zIndex: 700, background: C.bg, padding: 24 }}>Caricamento documento fiscale…</div>}>
          <DocFiscale paz={paz} plans={plans} si={si} onClose={() => { setDocumentsReloadToken((value) => value + 1); setDocumentFlow(null); setTab('doc'); }} />
        </Suspense>
      )}
      {documentFlow === 'consenso' && (
        <Suspense fallback={<div role="status" style={{ position: 'fixed', inset: 0, zIndex: 700, background: C.bg, padding: 24 }}>Caricamento modelli consenso…</div>}>
          <PatientWorkspaceConsentFlow patient={paz} client={documentClient} onClose={() => setDocumentFlow(null)} />
        </Suspense>
      )}

    </div>
  );
}
