import React, { useState } from 'react';
import { Btn, Crd, EmptyState, Fld, Ic, Inp, Modal, Sel } from './ui';
import { C, fmt, fmtD, today, SCADENZA_PRESET, addMesi, rilevaRichiamo } from '../lib/utils';
import { markTreatmentItemCompleted, isTreatmentPlanCompleted } from '../lib/domain/treatmentPlanService.js';
import IncassoModal from './IncassoModal.jsx';
import PdfView from './PdfView.jsx';

const calcTot = (voci, sconto, scontoTipo) => {
  const sub = (voci || []).reduce((s, v) => s + Number(v.prezzo), 0);
  const sc = Number(sconto) || 0;
  const scontato = scontoTipo === 'pct' ? sub * (sc / 100) : Math.min(sc, sub);
  return { sub, scontato, finale: Math.max(0, sub - scontato) };
};

const STATO_LABEL = { attivo: 'In attesa', accettato: 'Accettato', rifiutato: 'Non accettato' };
const STATO_COLOR = { attivo: C.war, accettato: C.acc, rifiutato: C.dan };

const prossimaDataMascherina = (orto) => {
  if (!orto?.dataConsegnaInizio || !orto?.mascherineConsegnate) return null;
  const ultima = orto.storico && orto.storico.length > 0 ? orto.storico[orto.storico.length - 1].data : orto.dataConsegnaInizio;
  const d = new Date(ultima + 'T12:00');
  d.setDate(d.getDate() + (orto.frequenzaSettimane || 2) * 7);
  return d.toISOString().slice(0, 10);
};

/* POL-FIN-007: one plan-list-with-drill-down component, used identically by
   the general Piani page (after a patient is picked) and by SchedaPaz's own
   "Piani" tab (already patient-scoped) — Product Owner: "così anche il
   modulo Piano del paziente deve avere la stessa grafica di piani generale,
   con tutti i tastini". Level 1: plan NAMES only, with
   Cancella/Modifica/Accetta/Non accetta/Incassato. Click a name to drill
   into that plan's clean prestazioni list: Eseguito/Modifica/Elimina/
   Incassato per row. */
export default function PianoDrillDown({ plans, patients = [], setPlans, payments = [], setPayments, pricelist = [], si, features }) {
  const [expandedId, setExpandedId] = useState(null);
  const [confirmDelId, setConfirmDelId] = useState(null);
  const [editPlanId, setEditPlanId] = useState(null);
  const [editForm, setEditForm] = useState(null);
  const [addingVoceFor, setAddingVoceFor] = useState(null);
  const [newVoce, setNewVoce] = useState({ prestazione: '', dente: '', prezzo: '' });
  const [editingVoce, setEditingVoce] = useState(null); // { planId, index }
  const [editVoceForm, setEditVoceForm] = useState({ prestazione: '', dente: '', prezzo: '' });
  const [quickOffer, setQuickOffer] = useState(null); // { planId, itemIndex }
  const [incassoPrefill, setIncassoPrefill] = useState(null);
  const [pdfPlan, setPdfPlan] = useState(null);

  const patientOf = (plan) => patients.find((p) => p.id === plan.pazienteId);

  const toggleExpand = (planId) => setExpandedId((current) => (current === planId ? null : planId));

  const setStato = (planId, stato) => setPlans((current) => current.map((pl) => (pl.id === planId ? { ...pl, stato } : pl)));

  const delPlan = (id) => setConfirmDelId((current) => (current === id ? null : id));
  const confirmDelPlan = (id) => { setPlans((current) => current.filter((pl) => pl.id !== id)); setConfirmDelId(null); };

  const openEditPlan = (plan) => { setEditForm({ titolo: plan.titolo, data: plan.data, sconto: plan.sconto || 0, scontoTipo: plan.scontoTipo || 'pct', scadenzaPagamento: plan.scadenzaPagamento || '' }); setEditPlanId(plan.id); };
  const saveEditPlan = () => {
    if (!editForm?.titolo) return;
    setPlans((current) => current.map((pl) => (pl.id === editPlanId ? { ...pl, ...editForm } : pl)));
    setEditPlanId(null);
  };
  const setScadenzaPiano = (planId, data) => setPlans((current) => current.map((pl) => (pl.id === planId ? { ...pl, scadenzaPagamento: data } : pl)));

  const toggleEseguita = (plan, index) => {
    const voce = plan.voci[index];
    if (!voce.eseguita) {
      setPlans((current) => current.map((candidate) => {
        if (String(candidate.id) !== String(plan.id)) return candidate;
        const { plan: completed } = markTreatmentItemCompleted(candidate, index);
        // Auto-suggest a richiamo (same detection SchedaPaz.jsx already had)
        // only if this item doesn't already carry one.
        const already = completed.voci[index];
        if (already.richiamoData) return completed;
        const r = rilevaRichiamo(already.prestazione);
        if (!r) return completed;
        return { ...completed, voci: completed.voci.map((v, j) => (j === index ? { ...v, richiamoTipo: r.tipo, richiamoData: addMesi(today(), r.mesi) } : v)) };
      }));
      setQuickOffer({ planId: plan.id, itemIndex: index });
      return;
    }
    setPlans((current) => current.map((candidate) => {
      if (String(candidate.id) !== String(plan.id)) return candidate;
      const voci = candidate.voci.map((v, j) => (j === index ? { ...v, eseguita: false, dataEsec: null, incassata: false } : v));
      return { ...candidate, voci };
    }));
    setQuickOffer(null);
  };

  const setRichiamo = (planId, index, tipo, data) => setPlans((current) => current.map((pl) => (pl.id === planId ? { ...pl, voci: pl.voci.map((v, j) => (j === index ? { ...v, richiamoTipo: tipo, richiamoData: data } : v)) } : pl)));

  const removeItemFromPlan = (plan, index) => {
    const totalePagato = (payments || [])
      .filter((payment) => String(payment.pianoId) === String(plan.id) && String(payment.stato || '').toLowerCase() === 'pagato')
      .reduce((sum, payment) => sum + Number(payment.importo || 0), 0);
    const vociResidue = (plan.voci || []).filter((_, i) => i !== index);
    const { finale: nuovoTotale } = calcTot(vociResidue, plan.sconto || 0, plan.scontoTipo || 'pct');
    const eccedenza = Math.max(0, totalePagato - nuovoTotale);
    const message = eccedenza > 0
      ? `Il piano ha ${fmt(totalePagato)} di pagamenti collegati — rimuovendo questa prestazione il nuovo totale (${fmt(nuovoTotale)}) sarà inferiore a quanto già incassato: ${fmt(eccedenza)} diventerà un acconto libero sul piano. Il pagamento non verrà cancellato. Continuare?`
      : 'Rimuovere questa prestazione dal piano?';
    if (!confirm(message)) return;
    setPlans((current) => current.map((candidate) => {
      if (String(candidate.id) !== String(plan.id)) return candidate;
      return { ...candidate, voci: (candidate.voci || []).filter((_, i) => i !== index) };
    }));
  };

  const openEditVoce = (plan, index) => { const v = plan.voci[index]; setEditVoceForm({ prestazione: v.prestazione, dente: v.dente || '', prezzo: String(v.prezzo) }); setEditingVoce({ planId: plan.id, index }); };
  const saveEditVoce = () => {
    if (!editVoceForm.prestazione.trim()) return;
    setPlans((current) => current.map((pl) => (pl.id === editingVoce.planId ? {
      ...pl, voci: pl.voci.map((v, j) => (j === editingVoce.index ? { ...v, prestazione: editVoceForm.prestazione.trim(), dente: editVoceForm.dente.trim(), prezzo: Number(editVoceForm.prezzo) || 0 } : v)),
    } : pl)));
    setEditingVoce(null);
  };

  const addItemToPlan = (planId) => {
    if (!newVoce.prestazione.trim()) return;
    setPlans((current) => current.map((pl) => (String(pl.id) === String(planId) ? {
      ...pl, voci: [...(pl.voci || []), { prestazione: newVoce.prestazione.trim(), dente: newVoce.dente.trim(), prezzo: Number(newVoce.prezzo) || 0, eseguita: false, incassata: false }],
    } : pl)));
    setNewVoce({ prestazione: '', dente: '', prezzo: '' });
    setAddingVoceFor(null);
  };

  const avviaConsegnaOrto = (planId, data) => setPlans((current) => current.map((pl) => {
    if (pl.id !== planId) return pl;
    const orto = pl.ortodonzia || {};
    return { ...pl, ortodonzia: { ...orto, dataConsegnaInizio: data, mascherineConsegnate: 1, storico: [{ n: 1, data }] } };
  }));
  const consegnaMascherinaSuccessiva = (planId) => setPlans((current) => current.map((pl) => {
    if (pl.id !== planId) return pl;
    const orto = pl.ortodonzia || {};
    const nuovoNum = (orto.mascherineConsegnate || 0) + 1;
    return { ...pl, ortodonzia: { ...orto, mascherineConsegnate: nuovoNum, storico: [...(orto.storico || []), { n: nuovoNum, data: today() }] } };
  }));

  if (pdfPlan) return <PdfView pl={pdfPlan} paz={patientOf(pdfPlan)} si={si} features={features} onClose={() => setPdfPlan(null)} />;

  if (!plans.length) return <EmptyState icon="plan" title="Nessun piano di cura" />;

  return (
    <div>
      {plans.map((pl) => {
        const { finale: tot, scontato } = calcTot(pl.voci, pl.sconto || 0, pl.scontoTipo || 'pct');
        const done = pl.voci.filter((v) => v.eseguita).length;
        const pct = pl.voci.length ? Math.round((done / pl.voci.length) * 100) : 0;
        const terminato = isTreatmentPlanCompleted(pl);
        const stato = pl.stato || 'attivo';
        const statoC = STATO_COLOR[stato] || C.war;
        const expanded = expandedId === pl.id;
        return (
          <Crd key={pl.id} style={{ marginBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
              <button type="button" onClick={() => toggleExpand(pl.id)} style={{ flex: 1, minWidth: 0, textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 15, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span aria-hidden="true" style={{ color: C.txm, fontSize: 11, display: 'inline-block', width: 10, transform: expanded ? 'rotate(90deg)' : 'none', transition: 'transform 0.15s' }}>▶</span>
                  {pl.titolo}
                </div>
                <div style={{ fontSize: 11, color: C.txm, marginTop: 2 }}>{fmtD(pl.data)} · {done}/{pl.voci.length} eseguite · {pct}%</div>
                <div style={{ marginTop: 5, display: 'flex', gap: 5, flexWrap: 'wrap', alignItems: 'center' }}>
                  <span style={{ fontSize: 10, fontWeight: 800, color: statoC, background: statoC + '18', borderRadius: 6, padding: '2px 7px' }}>{STATO_LABEL[stato] || stato}</span>
                  {terminato && <span style={{ fontSize: 10, fontWeight: 800, color: C.suc, background: C.sucL, borderRadius: 6, padding: '2px 7px' }}>✓ Terminato</span>}
                </div>
              </button>
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <div style={{ fontWeight: 800, fontSize: 14, color: C.pri }}>{fmt(tot)}</div>
                {scontato > 0 && <div style={{ fontSize: 10, color: C.suc }}>Sconto −{fmt(scontato)}</div>}
              </div>
            </div>

            {/* Product Owner: "i tasti accetta ecc devono essere meno
                confusionari" — prima erano 6 pulsanti identici in fila.
                Ora: Accetta/Non accetta è UN controllo a due stati (si
                capisce a colpo d'occhio che è una scelta sola, non due
                azioni indipendenti), Incassato resta il pulsante
                principale ben visibile, e le azioni di servizio
                (PDF/Modifica/Cancella) diventano piccole icone raggruppate,
                meno invadenti perché usate meno spesso. */}
            <div style={{ marginTop: 9, display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
                <div style={{ display: 'flex', background: C.sur, borderRadius: 8, border: `1.5px solid ${C.brd}`, overflow: 'hidden', flexShrink: 0 }}>
                  <button onClick={() => setStato(pl.id, 'accettato')} disabled={stato === 'accettato'} style={{ padding: '7px 11px', border: 'none', background: stato === 'accettato' ? C.suc : 'transparent', color: stato === 'accettato' ? '#fff' : C.txm, fontWeight: 700, fontSize: 11, cursor: stato === 'accettato' ? 'default' : 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}><Ic n="ok" s={12} c={stato === 'accettato' ? '#fff' : C.txm} />Accetta</button>
                  <button onClick={() => setStato(pl.id, 'rifiutato')} disabled={stato === 'rifiutato'} style={{ padding: '7px 11px', border: 'none', borderLeft: `1.5px solid ${C.brd}`, background: stato === 'rifiutato' ? C.dan : 'transparent', color: stato === 'rifiutato' ? '#fff' : C.txm, fontWeight: 700, fontSize: 11, cursor: stato === 'rifiutato' ? 'default' : 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}><Ic n="x" s={12} c={stato === 'rifiutato' ? '#fff' : C.txm} />Non accetta</button>
                </div>
                <button onClick={() => setIncassoPrefill({ pazienteId: String(pl.pazienteId), lockedPianoId: pl.id, importo: String(tot || ''), nota: pl.titolo })} style={{ background: C.pri, border: 'none', borderRadius: 8, padding: '7px 12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, color: '#fff', fontWeight: 700, fontSize: 11 }}><Ic n="eur" s={12} c="#fff" />Incassato</button>
              </div>
              <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                <button onClick={() => setPdfPlan(pl)} title="Stampa PDF" aria-label="Stampa PDF" style={{ background: C.bg, border: `1px solid ${C.brd}`, borderRadius: 7, padding: 7, cursor: 'pointer', display: 'flex' }}><Ic n="prt" s={13} c={C.txm} /></button>
                <button onClick={() => openEditPlan(pl)} title="Modifica piano" aria-label="Modifica piano" style={{ background: C.bg, border: `1px solid ${C.brd}`, borderRadius: 7, padding: 7, cursor: 'pointer', display: 'flex' }}><Ic n="edit" s={13} c={C.txm} /></button>
                <button onClick={() => delPlan(pl.id)} title="Cancella piano" aria-label="Cancella piano" style={{ background: C.bg, border: `1px solid ${C.brd}`, borderRadius: 7, padding: 7, cursor: 'pointer', display: 'flex' }}><Ic n="del" s={13} c={C.dan} /></button>
              </div>
            </div>

            {confirmDelId === pl.id && (
              <div style={{ background: C.danL, borderRadius: 9, padding: '10px 12px', margin: '8px 0 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: C.dan }}>Eliminare questo piano?</span>
                <div style={{ display: 'flex', gap: 7, flexShrink: 0 }}>
                  <button onClick={() => setConfirmDelId(null)} style={{ background: '#fff', border: `1px solid ${C.brd}`, borderRadius: 7, padding: '5px 11px', fontSize: 12, fontWeight: 700, cursor: 'pointer', color: C.txm }}>No</button>
                  <button onClick={() => confirmDelPlan(pl.id)} style={{ background: C.dan, border: 'none', borderRadius: 7, padding: '5px 11px', fontSize: 12, fontWeight: 700, cursor: 'pointer', color: '#fff' }}>Sì, elimina</button>
                </div>
              </div>
            )}

            {pl.scadenzaPagamento !== undefined && (
              <div style={{ marginTop: 9, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
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
            )}

            {pl.ortodonzia?.attivo && (() => {
              const orto = pl.ortodonzia;
              const tot2 = Number(orto.mascherineTotali) || 0;
              const cons = orto.mascherineConsegnate || 0;
              const pctOrto = tot2 > 0 ? Math.min(100, Math.round((cons / tot2) * 100)) : 0;
              const prossima = prossimaDataMascherina(orto);
              const completato = tot2 > 0 && cons >= tot2;
              return (
                <div style={{ marginTop: 9, background: C.purL, borderRadius: 9, padding: 10 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <span style={{ fontSize: 11, fontWeight: 800, color: C.pur }}>🦷 Mascherine ortodontiche</span>
                    <span style={{ fontSize: 11, fontWeight: 800, color: C.pur }}>{cons}/{tot2 || '?'}</span>
                  </div>
                  {tot2 > 0 && <div style={{ background: '#fff', borderRadius: 4, height: 6, overflow: 'hidden', marginBottom: 7 }}><div style={{ height: '100%', width: `${pctOrto}%`, background: completato ? C.suc : C.pur, borderRadius: 4 }} /></div>}
                  {!orto.dataConsegnaInizio ? (
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                      <Inp type="date" defaultValue={today()} id={`orto-start-${pl.id}`} style={{ flex: 1, fontSize: 12, padding: '7px 9px' }} />
                      <button onClick={() => { const inp = document.getElementById(`orto-start-${pl.id}`); avviaConsegnaOrto(pl.id, inp.value || today()); }} style={{ background: C.pur, border: 'none', borderRadius: 7, padding: '8px 12px', color: '#fff', fontWeight: 700, fontSize: 11, cursor: 'pointer', whiteSpace: 'nowrap' }}>Avvia</button>
                    </div>
                  ) : completato ? (
                    <div style={{ fontSize: 11, fontWeight: 700, color: C.suc, textAlign: 'center', padding: '4px 0' }}>✓ Ciclo mascherine completato</div>
                  ) : (
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: 11, color: prossima && new Date(prossima + 'T12:00') < new Date(today() + 'T12:00') ? C.dan : C.pur, fontWeight: 700 }}>📅 Prossima: {prossima ? fmtD(prossima) : '—'}</span>
                      <button onClick={() => consegnaMascherinaSuccessiva(pl.id)} style={{ background: C.pur, border: 'none', borderRadius: 7, padding: '7px 12px', color: '#fff', fontWeight: 700, fontSize: 11, cursor: 'pointer' }}>+ Consegna n°{cons + 1}</button>
                    </div>
                  )}
                </div>
              );
            })()}

            {expanded && (
              <div style={{ marginTop: 10, borderTop: `1px solid ${C.brd}`, paddingTop: 10 }}>
                <div style={{ fontSize: 11, fontWeight: 800, color: C.txm, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>Prestazioni ({pl.voci.length})</div>
                {pl.voci.map((v, i) => {
                  const isEditing = editingVoce?.planId === pl.id && editingVoce?.index === i;
                  // Ogni prestazione è la sua PROPRIA card, ben separata dalle
                  // altre e dal resto del piano (Product Owner: "si capisce
                  // poco a vista d'occhio quali siano le prestazioni") — bordo
                  // colorato a sinistra (verde=eseguita, ambra=da eseguire),
                  // sfondo distinto, numero progressivo.
                  return (
                    <div key={i} style={{ background: v.eseguita ? C.sucL : C.sur, border: `1px solid ${v.eseguita ? C.suc + '40' : C.brd}`, borderLeft: `4px solid ${v.eseguita ? C.suc : C.war}`, borderRadius: 9, padding: '10px 12px', marginBottom: 8 }}>
                      {isEditing ? (
                        <div className="plan-inline-editor">
                          <Fld label="Prestazione"><Inp value={editVoceForm.prestazione} onChange={(e) => setEditVoceForm((f) => ({ ...f, prestazione: e.target.value }))} /></Fld>
                          <div className="plan-inline-editor__grid">
                            <Fld label="Dente (opzionale)"><Inp value={editVoceForm.dente} onChange={(e) => setEditVoceForm((f) => ({ ...f, dente: e.target.value }))} /></Fld>
                            <Fld label="Prezzo €"><Inp type="number" min="0" step="0.01" inputMode="decimal" value={editVoceForm.prezzo} onChange={(e) => setEditVoceForm((f) => ({ ...f, prezzo: e.target.value }))} /></Fld>
                          </div>
                          <div className="plan-inline-editor__actions"><Btn ch="Annulla" v="sec" sz="sm" onClick={() => setEditingVoce(null)} /><Btn ch="Salva" sz="sm" onClick={saveEditVoce} /></div>
                        </div>
                      ) : (
                        <>
                          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                            <div style={{ width: 20, height: 20, borderRadius: '50%', background: v.eseguita ? C.suc : '#fff', border: `1.5px solid ${v.eseguita ? C.suc : C.brd}`, color: v.eseguita ? '#fff' : C.txm, fontSize: 10, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 }}>{v.eseguita ? '✓' : i + 1}</div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontSize: 14, fontWeight: 700, color: v.eseguita ? C.txm : C.txt, textDecoration: v.eseguita ? 'line-through' : 'none' }}>{v.prestazione}{v.dente ? ` (d.${v.dente})` : ''}</div>
                              {v.dataEsec && <div style={{ fontSize: 10, color: C.suc, fontWeight: 700, marginTop: 1 }}>✓ Eseguita il {fmtD(v.dataEsec)}</div>}
                            </div>
                            <div style={{ fontWeight: 800, color: C.pri, fontSize: 13, flexShrink: 0 }}>{fmt(v.prezzo)}</div>
                          </div>
                          {v.eseguita && (
                            <div style={{ marginTop: 6, background: v.richiamoData ? C.purL : '#fff', borderRadius: 7, padding: '6px 8px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6, flexWrap: 'wrap' }}>
                                <span style={{ fontSize: 10, fontWeight: 700, color: v.richiamoData ? C.pur : C.txl }}>🔔 {v.richiamoData ? `${v.richiamoTipo || 'Richiamo'}: ${fmtD(v.richiamoData)}` : 'Nessun richiamo impostato'}</span>
                                <div style={{ display: 'flex', gap: 3 }}>
                                  {SCADENZA_PRESET.map((p) => (
                                    <button key={p.mesi} onClick={() => setRichiamo(pl.id, i, v.richiamoTipo || 'Controllo', addMesi(v.dataEsec || today(), p.mesi))} style={{ background: '#fff', border: `1px solid ${C.brd}`, borderRadius: 6, padding: '2px 6px', fontSize: 9, fontWeight: 700, color: C.txm, cursor: 'pointer' }}>{p.label}</button>
                                  ))}
                                  {v.richiamoData && <button onClick={() => setRichiamo(pl.id, i, '', null)} style={{ background: C.danL, border: 'none', borderRadius: 6, padding: '2px 6px', fontSize: 9, fontWeight: 700, color: C.dan, cursor: 'pointer' }}>✕</button>}
                                </div>
                              </div>
                            </div>
                          )}
                          <div style={{ display: 'flex', gap: 5, marginTop: 8, flexWrap: 'wrap' }}>
                            <button onClick={() => toggleEseguita(pl, i)} style={{ flex: '1 1 90px', padding: '6px 0', borderRadius: 7, border: `1.5px solid ${v.eseguita ? C.suc : C.brd}`, background: v.eseguita ? '#fff' : C.bg, color: v.eseguita ? C.suc : C.txm, fontWeight: 700, fontSize: 11, cursor: 'pointer' }}>{v.eseguita ? '✓ Eseguita' : '○ Segna eseguita'}</button>
                            <button onClick={() => openEditVoce(pl, i)} style={{ flex: '0 0 auto', padding: '6px 10px', borderRadius: 7, border: 'none', background: '#EDE9FE', color: C.pur, fontWeight: 700, fontSize: 11, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}><Ic n="edit" s={12} c={C.pur} />Modifica</button>
                            <button onClick={() => removeItemFromPlan(pl, i)} style={{ flex: '0 0 auto', padding: '6px 10px', borderRadius: 7, border: 'none', background: C.danL, color: C.dan, fontWeight: 700, fontSize: 11, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}><Ic n="del" s={12} c={C.dan} />Elimina</button>
                            <button onClick={() => setIncassoPrefill({ pazienteId: String(pl.pazienteId), lockedPianoId: pl.id, importo: String(v.prezzo || ''), nota: v.prestazione })} style={{ flex: '0 0 auto', padding: '6px 10px', borderRadius: 7, border: 'none', background: C.priL, color: C.pri, fontWeight: 700, fontSize: 11, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}><Ic n="eur" s={12} c={C.pri} />Incassato</button>
                          </div>
                          {quickOffer?.planId === pl.id && quickOffer?.itemIndex === i && v.eseguita && (
                            <label className="plan-quick-payment-offer">
                              <input type="checkbox" onChange={(event) => { if (event.target.checked) setIncassoPrefill({ pazienteId: String(pl.pazienteId), lockedPianoId: pl.id, importo: String(v.prezzo || ''), nota: v.prestazione }); }} /> Registra incasso adesso
                            </label>
                          )}
                        </>
                      )}
                    </div>
                  );
                })}
                {addingVoceFor === pl.id ? (
                  <div className="plan-inline-editor">
                    <Fld label="Prestazione"><Inp value={newVoce.prestazione} onChange={(e) => setNewVoce((v) => ({ ...v, prestazione: e.target.value }))} placeholder="Descrizione prestazione" /></Fld>
                    <div className="plan-inline-editor__grid"><Fld label="Dente (opzionale)"><Inp value={newVoce.dente} onChange={(e) => setNewVoce((v) => ({ ...v, dente: e.target.value }))} /></Fld><Fld label="Prezzo €"><Inp type="number" min="0" step="0.01" inputMode="decimal" value={newVoce.prezzo} onChange={(e) => setNewVoce((v) => ({ ...v, prezzo: e.target.value }))} /></Fld></div>
                    <Fld label="Dal listino"><Sel value="" onChange={(e) => { const item = pricelist.find((entry) => entry.nome === e.target.value); if (item) setNewVoce({ prestazione: item.nome, dente: '', prezzo: String(item.prezzo) }); }}><option value="">Seleziona…</option>{pricelist.map((item) => <option key={item.id} value={item.nome}>{item.nome} — {fmt(item.prezzo)}</option>)}</Sel></Fld>
                    <div className="plan-inline-editor__actions"><Btn ch="Annulla" v="sec" sz="sm" onClick={() => setAddingVoceFor(null)} /><Btn ch="Aggiungi" sz="sm" onClick={() => addItemToPlan(pl.id)} /></div>
                  </div>
                ) : <button type="button" className="plan-add-item" onClick={() => { setAddingVoceFor(pl.id); setNewVoce({ prestazione: '', dente: '', prezzo: '' }); }}>+ Aggiungi prestazione</button>}
              </div>
            )}
          </Crd>
        );
      })}

      {editPlanId && editForm && (
        <Modal title="Modifica piano" icon="edit" onClose={() => setEditPlanId(null)}>
          <Fld label="Titolo"><Inp value={editForm.titolo} onChange={(e) => setEditForm((f) => ({ ...f, titolo: e.target.value }))} /></Fld>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <Fld label="Data"><Inp type="date" value={editForm.data} onChange={(e) => setEditForm((f) => ({ ...f, data: e.target.value }))} /></Fld>
            <Fld label="Scadenza pagamento"><Inp type="date" value={editForm.scadenzaPagamento || ''} onChange={(e) => setEditForm((f) => ({ ...f, scadenzaPagamento: e.target.value }))} /></Fld>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
            <div style={{ display: 'flex', background: C.sur, borderRadius: 8, border: `1.5px solid ${C.brd}`, overflow: 'hidden', flexShrink: 0 }}>
              <button onClick={() => setEditForm((f) => ({ ...f, scontoTipo: 'pct' }))} style={{ padding: '8px 12px', border: 'none', background: editForm.scontoTipo === 'pct' ? C.pri : C.sur, color: editForm.scontoTipo === 'pct' ? '#fff' : C.txm, fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>%</button>
              <button onClick={() => setEditForm((f) => ({ ...f, scontoTipo: 'eur' }))} style={{ padding: '8px 12px', border: 'none', background: editForm.scontoTipo === 'eur' ? C.pri : C.sur, color: editForm.scontoTipo === 'eur' ? '#fff' : C.txm, fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>€</button>
            </div>
            <Fld label="Sconto"><Inp type="number" min="0" value={editForm.sconto} onChange={(e) => setEditForm((f) => ({ ...f, sconto: e.target.value }))} /></Fld>
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}><Btn ch="Annulla" v="sec" onClick={() => setEditPlanId(null)} full /><Btn ch="Salva" onClick={saveEditPlan} full /></div>
        </Modal>
      )}

      {incassoPrefill && (
        <IncassoModal
          prefill={incassoPrefill}
          patients={patients}
          plans={plans}
          setPayments={setPayments}
          onClose={() => setIncassoPrefill(null)}
        />
      )}
    </div>
  );
}
