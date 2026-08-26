import React, { Suspense, lazy, useState } from 'react';
import { Btn, Crd, Fld, Inp, Sel, Txt, Modal, Toast, Bdg, Ic, PhStr } from './ui';
import { C, fmt, fmtD, today, SCADENZA_PRESET, addMesi, rilevaRichiamo } from '../lib/utils';
import PdfView from './PdfView.jsx';

const DocMedico = lazy(() => import('./DocMedico.jsx'));
const DocFiscale = lazy(() => import('./DocFiscale.jsx'));
const PatientPhotos = lazy(() => import('./PatientPhotos.jsx'));
const PatientImplants = lazy(() => import('./PatientImplants.jsx'));
const PhysioCartella = lazy(() => import('./PhysioCartella.jsx'));
const PatientClinicalHistory = lazy(() => import('./PatientClinicalHistory.jsx'));
const PatientWorkspaceDocuments = lazy(() => import('./PatientWorkspaceDocuments.jsx'));
const PatientWorkspaceConsentFlow = lazy(() => import('./PatientWorkspaceDocuments.jsx').then((module) => ({ default: module.PatientWorkspaceConsentFlow })));

const prossimaDataMascherina = (orto) => {
  if (!orto?.dataConsegnaInizio || !orto?.mascherineConsegnate) return null;
  const ultima = orto.storico && orto.storico.length > 0 ? orto.storico[orto.storico.length - 1].data : orto.dataConsegnaInizio;
  const d = new Date(ultima + 'T12:00');
  d.setDate(d.getDate() + (orto.frequenzaSettimane || 2) * 7);
  return d.toISOString().slice(0, 10);
};

export default function SchedaPaz({ paz, plans, payments, appointments, si, onClose, onEdit, onNuovoPiano, setPlans, initTab, documentClient, initialDocumentRequest, onDocumentRequestHandled = () => {}, implants = [], setImplants, studioMembership, currentUserId, isStudioAdmin }) {
  const [tab, setTab] = useState(initTab || 'info');
  const [documentFlow, setDocumentFlow] = useState(() => initialDocumentRequest?.type === 'ricetta' ? 'ricetta' : null);
  const [documentsReloadToken, setDocumentsReloadToken] = useState(0);
  const [pdfPlan, setPdfPlan] = useState(null);
  const [selPiani, setSelPiani] = useState([]);
  const [editPianoModal, setEditPianoModal] = useState(null);
  const [editForm, setEditForm] = useState(null);
  const [confirmDelId, setConfirmDelId] = useState(null);

  // Recovery boundary: legacy rows can contain null/non-array JSON fields.
  // Normalize before render so a single malformed historical row cannot take
  // down the whole patient record.
  const patPlans = (Array.isArray(plans) ? plans : [])
    .filter((pl) => pl?.pazienteId === paz.id)
    .map((pl) => ({ ...pl, voci: Array.isArray(pl.voci) ? pl.voci : [] }));
  const patPay = [...(Array.isArray(payments) ? payments : []).filter((p) => p?.pazienteId === paz.id)].reverse();
  const patApp = [...(Array.isArray(appointments) ? appointments : []).filter((a) => a?.pazienteId === paz.id)]
    .sort((a, b) => String(b.data || '').localeCompare(String(a.data || '')));

  const totDovuto = patPlans.reduce((s, pl) => {
    const sub = pl.voci.reduce((a, v) => a + Number(v.prezzo), 0);
    const sc = Number(pl.sconto) || 0;
    const scontato = pl.scontoTipo === 'pct' ? sub * (sc / 100) : Math.min(sc, sub);
    return s + Math.max(0, sub - scontato);
  }, 0);
  const totPaid = patPay.reduce((s, p) => s + Number(p.importo), 0);
  const totDaPagare = Math.max(0, totDovuto - totPaid);
  const pctPagato = totDovuto > 0 ? Math.min(100, Math.round((totPaid / totDovuto) * 100)) : 0;

  const toggleEseguita = (plId, i) => setPlans((prev) => prev.map((pl) => {
    if (pl.id !== plId) return pl;
    const nuoveVoci = pl.voci.map((v, j) => {
      if (j !== i) return v;
      const nowEseguita = !v.eseguita;
      let extra = {};
      if (nowEseguita) {
        const r = rilevaRichiamo(v.prestazione);
        if (r && !v.richiamoData) extra = { richiamoTipo: r.tipo, richiamoData: addMesi(today(), r.mesi) };
      }
      return { ...v, eseguita: nowEseguita, dataEsec: nowEseguita ? today() : null, incassata: nowEseguita ? v.incassata : false, ...extra };
    });
    const tutteEseguite = nuoveVoci.every((v) => v.eseguita);
    return { ...pl, voci: nuoveVoci, stato: tutteEseguite ? 'concluso' : (pl.stato === 'concluso' ? 'attivo' : pl.stato) };
  }));
  const setRichiamo = (plId, i, tipo, data) => setPlans((prev) => prev.map((pl) => (pl.id === plId ? { ...pl, voci: pl.voci.map((v, j) => (j === i ? { ...v, richiamoTipo: tipo, richiamoData: data } : v)) } : pl)));
  const setScadenzaPiano = (plId, data) => setPlans((prev) => prev.map((pl) => (pl.id === plId ? { ...pl, scadenzaPagamento: data } : pl)));
  const avviaConsegnaOrto = (plId, data) => setPlans((prev) => prev.map((pl) => {
    if (pl.id !== plId) return pl;
    const orto = pl.ortodonzia || {};
    return { ...pl, ortodonzia: { ...orto, dataConsegnaInizio: data, mascherineConsegnate: 1, storico: [{ n: 1, data }] } };
  }));
  const consegnaMascherinaSuccessiva = (plId) => setPlans((prev) => prev.map((pl) => {
    if (pl.id !== plId) return pl;
    const orto = pl.ortodonzia || {};
    const nuovoNum = (orto.mascherineConsegnate || 0) + 1;
    return { ...pl, ortodonzia: { ...orto, mascherineConsegnate: nuovoNum, storico: [...(orto.storico || []), { n: nuovoNum, data: today() }] } };
  }));
  const toggleIncassata = (plId, i) => setPlans((prev) => prev.map((pl) => (pl.id === plId ? { ...pl, voci: pl.voci.map((v, j) => (j === i ? { ...v, incassata: !v.incassata } : v)) } : pl)));
  const delPiano = (id) => setConfirmDelId((prev) => (prev === id ? null : id));
  const confirmDel = (id) => { setPlans((p) => p.filter((pl) => pl.id !== id)); setConfirmDelId(null); };

  const openEditPiano = (pl) => { setEditForm({ ...pl, sconto: pl.sconto || 0, scontoTipo: pl.scontoTipo || 'pct' }); setEditPianoModal(pl.id); };
  const saveEdit = () => {
    if (!editForm.titolo) return;
    setPlans((p) => p.map((pl) => (pl.id === editPianoModal ? { ...pl, ...editForm } : pl)));
    setEditPianoModal(null);
  };
  const delVoceEdit = (i) => setEditForm((f) => ({ ...f, voci: f.voci.filter((_, j) => j !== i) }));

  const toggleSel = (id) => setSelPiani((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  const selAll = () => setSelPiani(patPlans.map((p) => p.id));
  const deselAll = () => setSelPiani([]);

  const generaPdfMulti = () => {
    const pianiSel = patPlans.filter((pl) => selPiani.includes(pl.id));
    if (!pianiSel.length) return;
    const vociTot = pianiSel.flatMap((pl) => pl.voci);
    const totSconti = pianiSel.reduce((s, pl) => {
      const sub = pl.voci.reduce((a, v) => a + Number(v.prezzo), 0);
      const sc = Number(pl.sconto) || 0;
      return s + (pl.scontoTipo === 'pct' ? sub * (sc / 100) : Math.min(sc, sub));
    }, 0);
    const virtuale = { id: 'multi', titolo: pianiSel.length === 1 ? pianiSel[0].titolo : `Preventivo combinato (${pianiSel.length} piani)`, data: today(), voci: vociTot, sconto: totSconti, scontoTipo: 'eur', stato: 'attivo', pazienteId: paz.id };
    setPdfPlan(virtuale);
  };

  if (pdfPlan) return <PdfView pl={pdfPlan} paz={paz} si={si} onClose={() => setPdfPlan(null)} />;

  const isDentistico = !si?.vertical || si.vertical === 'dentistico';
  const isFisio = si?.vertical === 'fisioterapista' || si?.vertical === 'massofisioterapista';
  const capabilities = new Set(studioMembership?.stato === 'attivo' ? (studioMembership?.capabilities || []) : []);
  const physioFullAccess = capabilities.has('clinical.physiotherapist');
  const physioOperationalAccess = capabilities.has('clinical.personal_trainer') || capabilities.has('clinical.massage_therapist');
  const canAccessPhysio = isFisio && (physioFullAccess || physioOperationalAccess);
  const canManagePhysioTeam = physioFullAccess || isStudioAdmin === true;
  const TABS = [{ id: 'info', l: '📋 Info' }, { id: 'clinical', l: '🩺 Anamnesi' }, { id: 'piani', l: '🦷 Piani' }, ...(isDentistico ? [{ id: 'impl', l: '🦷 Impianti' }] : []), ...(canAccessPhysio ? [{ id: 'fisio', l: '💪 Fisioterapia' }] : []), { id: 'paga', l: '💰 Pagamenti' }, { id: 'foto', l: '📷 Foto' }, { id: 'app', l: '📅 Agenda' }, { id: 'doc', l: '📄 Documenti' }];

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
        {[{ l: 'Piani', v: patPlans.length }, { l: 'Pagato', v: fmt(totPaid) }, { l: 'Da pagare', v: fmt(totDaPagare) }, { l: 'Visite', v: patApp.length }].map((s) => (
          <div key={s.l} style={{ flex: 1, textAlign: 'center', padding: '8px 2px', borderRight: '1px solid rgba(255,255,255,0.1)' }}>
            <div style={{ color: s.l === 'Da pagare' && totDaPagare > 0 ? '#FCA5A5' : '#fff', fontWeight: 800, fontSize: 12 }}>{s.v}</div>
            <div style={{ color: 'rgba(255,255,255,0.55)', fontSize: 9 }}>{s.l}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', background: C.sur, borderBottom: `1px solid ${C.brd}`, flexShrink: 0 }}>
        {TABS.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{ flex: 1, padding: '11px 4px', background: 'none', border: 'none', borderBottom: `2.5px solid ${tab === t.id ? C.pri : 'transparent'}`, color: tab === t.id ? C.pri : C.txm, fontWeight: tab === t.id ? 700 : 500, fontSize: 11, cursor: 'pointer', whiteSpace: 'nowrap' }}>{t.l}</button>
        ))}
      </div>

      <div style={{ flex: 1, padding: 14, overflowY: 'auto' }}>
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
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, gap: 8, flexWrap: 'wrap' }}>
              <Btn ch="+ Nuovo piano" v="pri" sz="sm" onClick={() => onNuovoPiano(paz.id)} />
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                {selPiani.length > 0 ? (
                  <>
                    <button onClick={deselAll} style={{ fontSize: 11, fontWeight: 700, color: C.txm, background: C.bg, border: `1px solid ${C.brd}`, borderRadius: 7, padding: '5px 9px', cursor: 'pointer' }}>✕ Deseleziona</button>
                    <button onClick={generaPdfMulti} style={{ fontSize: 11, fontWeight: 700, color: '#fff', background: C.pri, border: 'none', borderRadius: 7, padding: '5px 11px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}><Ic n="prt" s={11} c="#fff" />PDF ({selPiani.length})</button>
                  </>
                ) : (
                  <button onClick={selAll} style={{ fontSize: 11, fontWeight: 700, color: C.pri, background: C.priL, border: 'none', borderRadius: 7, padding: '5px 9px', cursor: 'pointer' }}>Seleziona tutti</button>
                )}
              </div>
            </div>

            {patPlans.length === 0 && <div style={{ textAlign: 'center', color: C.txl, padding: 40 }}>Nessun piano di cura</div>}
            {patPlans.map((pl) => {
              const sub = pl.voci.reduce((s, v) => s + Number(v.prezzo), 0);
              const sc = Number(pl.sconto) || 0;
              const scontato = pl.scontoTipo === 'pct' ? sub * (sc / 100) : Math.min(sc, sub);
              const tot = Math.max(0, sub - scontato);
              const done = pl.voci.filter((v) => v.eseguita).length;
              const pct = pl.voci.length ? Math.round((done / pl.voci.length) * 100) : 0;
              const terminato = pct === 100;
              const isSel = selPiani.includes(pl.id);
              const statoEff = terminato ? 'concluso' : (pl.stato || 'attivo');
              const statoC = { attivo: C.war, accettato: C.acc, concluso: C.suc, rifiutato: C.dan }[statoEff] || C.war;

              return (
                <Crd key={pl.id} style={{ marginBottom: 12, border: `2px solid ${isSel ? C.pri : terminato ? C.suc + '50' : C.brd}`, background: terminato ? C.sucL + '40' : '#fff' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 8 }}>
                    <button onClick={() => toggleSel(pl.id)} style={{ marginTop: 2, width: 22, height: 22, borderRadius: 6, border: `2px solid ${isSel ? C.pri : C.brd}`, background: isSel ? C.pri : '#fff', cursor: 'pointer', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}>
                      {isSel && <Ic n="ok" s={12} c="#fff" />}
                    </button>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 700, fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{pl.titolo}</div>
                      <div style={{ fontSize: 11, color: C.txm }}>{fmtD(pl.data)}</div>
                      <div style={{ marginTop: 4, display: 'flex', gap: 5, flexWrap: 'wrap', alignItems: 'center' }}>
                        <Bdg ch={terminato ? '✓ Terminato' : statoEff} co={statoC} />
                        {terminato && <span style={{ fontSize: 10, color: C.suc, fontWeight: 700 }}>Tutte le prestazioni eseguite</span>}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 5, flexShrink: 0 }}>
                      <button onClick={() => setPdfPlan(pl)} title="PDF" style={{ background: C.priL, border: 'none', borderRadius: 7, padding: '6px 8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 3, color: C.pri, fontWeight: 700, fontSize: 10 }}>
                        <Ic n="prt" s={12} c={C.pri} />Stampa PDF
                      </button>
                      <button onClick={() => openEditPiano(pl)} title="Modifica" style={{ background: '#EDE9FE', border: 'none', borderRadius: 7, padding: '6px 8px', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                        <Ic n="edit" s={13} c={C.pur} />
                      </button>
                      <button onClick={(e) => { e.stopPropagation(); delPiano(pl.id); }} title="Elimina" style={{ background: C.danL, border: 'none', borderRadius: 7, padding: '6px 8px', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                        <Ic n="del" s={13} c={C.dan} />
                      </button>
                    </div>
                  </div>

                  <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 10, color: C.txl, fontWeight: 700 }}>💰 Scadenza pagamento:</span>
                    {pl.scadenzaPagamento ? (
                      <span style={{ fontSize: 11, fontWeight: 700, color: new Date(pl.scadenzaPagamento) < new Date(today()) ? C.dan : C.pri }}>{fmtD(pl.scadenzaPagamento)}</span>
                    ) : <span style={{ fontSize: 11, color: C.txl }}>non impostata</span>}
                    <div style={{ display: 'flex', gap: 3 }}>
                      {SCADENZA_PRESET.map((p) => (
                        <button key={p.mesi} onClick={() => setScadenzaPiano(pl.id, addMesi(today(), p.mesi))} style={{ background: C.bg, border: `1px solid ${C.brd}`, borderRadius: 6, padding: '2px 6px', fontSize: 9, fontWeight: 700, color: C.txm, cursor: 'pointer' }}>{p.label}</button>
                      ))}
                      {pl.scadenzaPagamento && <button onClick={() => setScadenzaPiano(pl.id, '')} style={{ background: C.danL, border: 'none', borderRadius: 6, padding: '2px 6px', fontSize: 9, fontWeight: 700, color: C.dan, cursor: 'pointer' }}>✕</button>}
                    </div>
                  </div>

                  {pl.ortodonzia?.attivo && (() => {
                    const orto = pl.ortodonzia;
                    const tot2 = Number(orto.mascherineTotali) || 0;
                    const cons = orto.mascherineConsegnate || 0;
                    const pctOrto = tot2 > 0 ? Math.min(100, Math.round((cons / tot2) * 100)) : 0;
                    const prossima = prossimaDataMascherina(orto);
                    const completato = tot2 > 0 && cons >= tot2;
                    return (
                      <div style={{ marginTop: 8, background: C.purL, borderRadius: 9, padding: 10 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                          <span style={{ fontSize: 11, fontWeight: 800, color: C.pur }}>🦷 Mascherine ortodontiche</span>
                          <span style={{ fontSize: 11, fontWeight: 800, color: C.pur }}>{cons}/{tot2 || '?'}</span>
                        </div>
                        {tot2 > 0 && (
                          <div style={{ background: '#fff', borderRadius: 4, height: 6, overflow: 'hidden', marginBottom: 7 }}>
                            <div style={{ height: '100%', width: `${pctOrto}%`, background: completato ? C.suc : C.pur, borderRadius: 4 }} />
                          </div>
                        )}
                        {!orto.dataConsegnaInizio ? (
                          <div>
                            <div style={{ fontSize: 10, color: C.txm, marginBottom: 6 }}>Imposta la data di consegna della prima mascherina per avviare il conteggio.</div>
                            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                              <Inp type="date" defaultValue={today()} id={`orto-start-${pl.id}`} style={{ flex: 1, fontSize: 12, padding: '7px 9px' }} />
                              <button onClick={() => { const inp = document.getElementById(`orto-start-${pl.id}`); avviaConsegnaOrto(pl.id, inp.value || today()); }} style={{ background: C.pur, border: 'none', borderRadius: 7, padding: '8px 12px', color: '#fff', fontWeight: 700, fontSize: 11, cursor: 'pointer', whiteSpace: 'nowrap' }}>Avvia</button>
                            </div>
                          </div>
                        ) : completato ? (
                          <div style={{ fontSize: 11, fontWeight: 700, color: C.suc, textAlign: 'center', padding: '4px 0' }}>✓ Ciclo mascherine completato</div>
                        ) : (
                          <div>
                            <div style={{ fontSize: 10, color: C.txm, marginBottom: 2 }}>Ultima consegnata: <b>n° {cons}</b>{orto.storico?.length > 0 && ` il ${fmtD(orto.storico[orto.storico.length - 1].data)}`}</div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 6 }}>
                              <span style={{ fontSize: 11, color: prossima && new Date(prossima + 'T12:00') < new Date(today() + 'T12:00') ? C.dan : C.pur, fontWeight: 700 }}>
                                📅 Prossima: {prossima ? fmtD(prossima) : '—'}
                              </span>
                              <button onClick={() => consegnaMascherinaSuccessiva(pl.id)} style={{ background: C.pur, border: 'none', borderRadius: 7, padding: '7px 12px', color: '#fff', fontWeight: 700, fontSize: 11, cursor: 'pointer' }}>+ Consegna n°{cons + 1}</button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })()}

                  {confirmDelId === pl.id && (
                    <div style={{ background: C.danL, borderRadius: 9, padding: '10px 12px', marginBottom: 8, marginTop: 8, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: C.dan }}>Eliminare questo piano?</span>
                      <div style={{ display: 'flex', gap: 7, flexShrink: 0 }}>
                        <button onClick={() => setConfirmDelId(null)} style={{ background: '#fff', border: `1px solid ${C.brd}`, borderRadius: 7, padding: '5px 11px', fontSize: 12, fontWeight: 700, cursor: 'pointer', color: C.txm }}>No</button>
                        <button onClick={() => confirmDel(pl.id)} style={{ background: C.dan, border: 'none', borderRadius: 7, padding: '5px 11px', fontSize: 12, fontWeight: 700, cursor: 'pointer', color: '#fff' }}>Sì, elimina</button>
                      </div>
                    </div>
                  )}

                  <div style={{ background: C.bg, borderRadius: 5, height: 6, overflow: 'hidden', marginBottom: 4 }}>
                    <div style={{ height: '100%', width: `${pct}%`, background: terminato ? C.suc : C.pri, borderRadius: 5, transition: 'width 0.3s' }} />
                  </div>
                  <div style={{ fontSize: 10, color: C.txm, marginBottom: 10 }}>{done}/{pl.voci.length} eseguite · {pct}%</div>

                  {pl.voci.map((v, i) => (
                    <div key={i} style={{ padding: '7px 0', borderBottom: `1px solid ${C.brd}` }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ flex: 1, fontSize: 12, fontWeight: 600, color: v.eseguita ? C.txm : C.txt, textDecoration: v.eseguita ? 'line-through' : 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{v.prestazione}{v.dente ? ` (d.${v.dente})` : ''}</span>
                        <span style={{ fontWeight: 700, color: C.pri, fontSize: 12, flexShrink: 0 }}>{fmt(v.prezzo)}</span>
                      </div>
                      {v.dataEsec && <div style={{ fontSize: 10, color: C.suc, marginTop: 1 }}>Eseguita il {fmtD(v.dataEsec)}</div>}
                      {v.eseguita && (
                        <div style={{ marginTop: 5, background: v.richiamoData ? C.purL : C.bg, borderRadius: 7, padding: '6px 8px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6, flexWrap: 'wrap' }}>
                            <span style={{ fontSize: 10, fontWeight: 700, color: v.richiamoData ? C.pur : C.txl }}>
                              🔔 {v.richiamoData ? `${v.richiamoTipo || 'Richiamo'}: ${fmtD(v.richiamoData)}` : 'Nessun richiamo impostato'}
                            </span>
                            <div style={{ display: 'flex', gap: 3 }}>
                              {SCADENZA_PRESET.map((p) => (
                                <button key={p.mesi} onClick={() => setRichiamo(pl.id, i, v.richiamoTipo || 'Controllo', addMesi(v.dataEsec || today(), p.mesi))} style={{ background: '#fff', border: `1px solid ${C.brd}`, borderRadius: 6, padding: '2px 6px', fontSize: 9, fontWeight: 700, color: C.txm, cursor: 'pointer' }}>{p.label}</button>
                              ))}
                              {v.richiamoData && <button onClick={() => setRichiamo(pl.id, i, '', null)} style={{ background: C.danL, border: 'none', borderRadius: 6, padding: '2px 6px', fontSize: 9, fontWeight: 700, color: C.dan, cursor: 'pointer' }}>✕</button>}
                            </div>
                          </div>
                        </div>
                      )}
                      <div style={{ display: 'flex', gap: 5, marginTop: 5 }}>
                        <button onClick={() => toggleEseguita(pl.id, i)} style={{ flex: 1, padding: '6px 0', borderRadius: 7, border: `1.5px solid ${v.eseguita ? C.suc : C.brd}`, background: v.eseguita ? C.sucL : C.bg, color: v.eseguita ? C.suc : C.txm, fontWeight: 700, fontSize: 11, cursor: 'pointer' }}>
                          {v.eseguita ? '✓ Eseguita' : '○ Segna eseguita'}
                        </button>
                        {v.eseguita && (
                          <button onClick={() => toggleIncassata(pl.id, i)} style={{ flex: 1, padding: '6px 0', borderRadius: 7, border: `1.5px solid ${v.incassata ? C.suc : C.dan}`, background: v.incassata ? C.sucL : C.danL, color: v.incassata ? C.suc : C.dan, fontWeight: 700, fontSize: 11, cursor: 'pointer' }}>
                            {v.incassata ? '€ Incassata' : '€ Da incassare'}
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                  {scontato > 0 && <div style={{ fontSize: 11, color: C.suc, textAlign: 'right', marginTop: 5 }}>Sconto: −{fmt(scontato)}</div>}
                  <div style={{ textAlign: 'right', fontWeight: 800, color: C.pri, marginTop: 4 }}>Totale: {fmt(tot)}</div>
                </Crd>
              );
            })}

            {selPiani.length > 0 && (() => {
              const pianiSel = patPlans.filter((p) => selPiani.includes(p.id));
              const totSel = pianiSel.reduce((s, pl) => {
                const sub = pl.voci.reduce((a, v) => a + Number(v.prezzo), 0);
                const sc = Number(pl.sconto) || 0;
                const scontato = pl.scontoTipo === 'pct' ? sub * (sc / 100) : Math.min(sc, sub);
                return s + Math.max(0, sub - scontato);
              }, 0);
              return (
                <div style={{ position: 'sticky', bottom: 0, background: C.priD, borderRadius: 12, padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 }}>
                  <div>
                    <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: 11 }}>{selPiani.length} pian{selPiani.length === 1 ? 'o' : 'i'} selezionat{selPiani.length === 1 ? 'o' : 'i'}</div>
                    <div style={{ color: '#fff', fontWeight: 900, fontSize: 18 }}>{fmt(totSel)}</div>
                  </div>
                  <button onClick={generaPdfMulti} style={{ background: C.acc, border: 'none', borderRadius: 9, padding: '10px 16px', color: '#fff', fontWeight: 800, fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Ic n="prt" s={15} c="#fff" />Genera PDF
                  </button>
                </div>
              );
            })()}
          </div>
        )}

        {tab === 'paga' && (
          <div>
            <Crd style={{ marginBottom: 12, background: C.priD, border: 'none' }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: 'rgba(255,255,255,0.6)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>Situazione finanziaria</div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <div><div style={{ fontSize: 10, color: 'rgba(255,255,255,0.55)' }}>Dovuto totale</div><div style={{ fontSize: 16, fontWeight: 800, color: '#fff' }}>{fmt(totDovuto)}</div></div>
                <div style={{ textAlign: 'center' }}><div style={{ fontSize: 10, color: 'rgba(255,255,255,0.55)' }}>Pagato</div><div style={{ fontSize: 16, fontWeight: 800, color: '#86efac' }}>{fmt(totPaid)}</div></div>
                <div style={{ textAlign: 'right' }}><div style={{ fontSize: 10, color: 'rgba(255,255,255,0.55)' }}>Da pagare</div><div style={{ fontSize: 16, fontWeight: 800, color: totDaPagare > 0 ? '#FCA5A5' : '#86efac' }}>{fmt(totDaPagare)}</div></div>
              </div>
              <div style={{ background: 'rgba(255,255,255,0.15)', borderRadius: 6, height: 8, overflow: 'hidden', marginBottom: 4 }}>
                <div style={{ height: '100%', width: `${pctPagato}%`, background: pctPagato >= 100 ? '#86efac' : '#60a5fa', borderRadius: 6, transition: 'width 0.3s' }} />
              </div>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)', textAlign: 'right' }}>{pctPagato}% saldato</div>
            </Crd>
            {patPlans.length > 0 && (
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 11, fontWeight: 800, color: C.txm, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 7 }}>Dettaglio per piano</div>
                {patPlans.map((pl) => {
                  const sub = pl.voci.reduce((s, v) => s + Number(v.prezzo), 0);
                  const sc = Number(pl.sconto) || 0;
                  const scontato = pl.scontoTipo === 'pct' ? sub * (sc / 100) : Math.min(sc, sub);
                  const plTot = Math.max(0, sub - scontato);
                  const plEseg = pl.voci.filter((v) => v.eseguita).reduce((s, v) => s + Number(v.prezzo), 0);
                  const plDaFare = pl.voci.filter((v) => !v.eseguita).reduce((s, v) => s + Number(v.prezzo), 0);
                  return (
                    <Crd key={pl.id} style={{ marginBottom: 8, borderLeft: `3px solid ${C.pri}` }}>
                      <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 6 }}>{pl.titolo}</div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        {[['Totale piano', plTot, C.pri], ['Eseguito', plEseg, C.acc], ['Da eseguire', plDaFare, C.war]].map(([l, v, co]) => (
                          <div key={l} style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span style={{ fontSize: 11, color: C.txm }}>{l}</span>
                            <span style={{ fontSize: 12, fontWeight: 700, color: co }}>{fmt(v)}</span>
                          </div>
                        ))}
                        {scontato > 0 && (
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span style={{ fontSize: 11, color: C.suc }}>Sconto</span>
                            <span style={{ fontSize: 12, fontWeight: 700, color: C.suc }}>−{fmt(scontato)}</span>
                          </div>
                        )}
                      </div>
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
        {tab === 'clinical' && <Suspense fallback={<div role="status" style={{ padding: 20, textAlign: 'center', color: C.txm }}>Caricamento anamnesi…</div>}><PatientClinicalHistory patient={paz} /></Suspense>}
      </div>

      {(documentFlow === 'ricetta' || documentFlow === 'medico') && (
        <Suspense fallback={<div role="status" style={{ position: 'fixed', inset: 0, zIndex: 700, background: C.bg, padding: 24 }}>Caricamento editor ricetta…</div>}>
          <DocMedico
            paz={paz}
            si={si}
            initialType={documentFlow === 'ricetta' ? 'ricetta' : undefined}
            initialPrefill={documentFlow === 'ricetta' ? initialDocumentRequest?.prefill : undefined}
            requestId={documentFlow === 'ricetta' ? initialDocumentRequest?.requestId : undefined}
            onInitialRequestHandled={onDocumentRequestHandled}
            onClose={() => { setDocumentFlow(null); onDocumentRequestHandled(initialDocumentRequest?.requestId); }}
            onDocumentSaved={() => { setDocumentsReloadToken((value) => value + 1); setDocumentFlow(null); setTab('doc'); onDocumentRequestHandled(initialDocumentRequest?.requestId); }}
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

      {editPianoModal && editForm && (
        <Modal title="Modifica piano" onClose={() => setEditPianoModal(null)} wide>
          <Fld label="Titolo"><Inp value={editForm.titolo} onChange={(e) => setEditForm((f) => ({ ...f, titolo: e.target.value }))} /></Fld>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <Fld label="Data"><Inp type="date" value={editForm.data} onChange={(e) => setEditForm((f) => ({ ...f, data: e.target.value }))} /></Fld>
            <Fld label="Stato">
              <Sel value={editForm.stato || 'attivo'} onChange={(e) => setEditForm((f) => ({ ...f, stato: e.target.value }))}>
                <option value="attivo">Attivo</option><option value="accettato">Accettato ✓</option><option value="rifiutato">Rifiutato ✗</option><option value="concluso">Concluso ✓</option>
              </Sel>
            </Fld>
          </div>
          <Fld label="Sconto">
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <div style={{ display: 'flex', background: C.bg, borderRadius: 8, border: `1.5px solid ${C.brd}`, overflow: 'hidden', flexShrink: 0 }}>
                <button onClick={() => setEditForm((f) => ({ ...f, scontoTipo: 'pct' }))} style={{ padding: '8px 12px', border: 'none', background: editForm.scontoTipo === 'pct' ? C.pri : C.sur, color: editForm.scontoTipo === 'pct' ? '#fff' : C.txm, fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>%</button>
                <button onClick={() => setEditForm((f) => ({ ...f, scontoTipo: 'eur' }))} style={{ padding: '8px 12px', border: 'none', background: editForm.scontoTipo === 'eur' ? C.pri : C.sur, color: editForm.scontoTipo === 'eur' ? '#fff' : C.txm, fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>€</button>
              </div>
              <Inp type="number" value={editForm.sconto || ''} placeholder="0" onChange={(e) => setEditForm((f) => ({ ...f, sconto: e.target.value }))} style={{ flex: 1 }} />
            </div>
          </Fld>
          <div style={{ fontSize: 11, fontWeight: 800, color: C.txm, textTransform: 'uppercase', marginBottom: 6 }}>Prestazioni</div>
          {editForm.voci.map((v, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 0', borderBottom: `1px solid ${C.brd}` }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{v.prestazione}{v.dente ? ` · d.${v.dente}` : ''}</div>
                <div style={{ fontSize: 11, color: C.txm }}>{fmt(v.prezzo)}</div>
              </div>
              <button onClick={() => delVoceEdit(i)} style={{ background: C.danL, border: 'none', borderRadius: 6, padding: '5px 7px', cursor: 'pointer', flexShrink: 0 }}>
                <Ic n="del" s={12} c={C.dan} />
              </button>
            </div>
          ))}
          {(() => {
            const sub = editForm.voci.reduce((s, v) => s + Number(v.prezzo), 0);
            const sc = Number(editForm.sconto) || 0;
            const scontato = editForm.scontoTipo === 'pct' ? sub * (sc / 100) : Math.min(sc, sub);
            const finale = Math.max(0, sub - scontato);
            return (
              <div style={{ background: C.priD, borderRadius: 9, padding: '10px 14px', marginTop: 10 }}>
                {scontato > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12 }}>Sconto</span>
                    <span style={{ color: '#86efac', fontWeight: 700 }}>−{fmt(scontato)}</span>
                  </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#fff', fontWeight: 800 }}>Totale</span>
                  <span style={{ color: '#fff', fontWeight: 900, fontSize: 17 }}>{fmt(finale)}</span>
                </div>
              </div>
            );
          })()}
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <Btn ch="Annulla" v="sec" onClick={() => setEditPianoModal(null)} full />
            <Btn ch="Salva modifiche" onClick={saveEdit} full />
          </div>
        </Modal>
      )}
    </div>
  );
}
