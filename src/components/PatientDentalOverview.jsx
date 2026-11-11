import React, { useMemo, useState } from 'react';
import { DENTAL_QUADRANTS, DENTAL_SELECTION_GROUPS, dentalEntryTeeth, patientDentalOverview, toggleDentalGroup } from '../lib/patientDentalOverview.js';
import { fmtD } from '../lib/utils';
import { markTreatmentItemCompleted, paidOnPlan, removeTreatmentItem, treatmentItemRemovalMessage } from '../lib/domain/treatmentPlanService.js';
import './PatientDentalOverview.css';

function ToothGlyph({ tooth }) {
  const molar = tooth % 10 >= 6, upper = Math.floor(tooth / 10) <= 2;
  // Upper teeth (Q1/Q2) are mirrored vertically: roots toward the top, crown toward the occlusal plane.
  return <svg viewBox="0 0 24 28" aria-hidden="true" focusable="false" data-arch={upper ? 'upper' : 'lower'}><g transform={upper ? 'matrix(1 0 0 -1 0 28)' : undefined}><path d={molar ? 'M5 3Q8 1 12 3Q16 1 19 3Q23 7 19 15L17 25Q16 28 14 24L12 17L10 24Q8 28 7 25L5 15Q1 7 5 3Z' : 'M7 3Q12 1 17 3Q21 6 18 13L14 25Q12 28 10 25L6 13Q3 6 7 3Z'} /><path d={molar ? 'M7 7L12 10L17 7M12 10V15' : 'M8 6Q12 8 16 6'} /></g></svg>;
}

export default function PatientDentalOverview({ patientId, plans, payments, onAddTreatment, onCreateQuote, setPlans }) {
  const model = useMemo(()=>patientDentalOverview(plans,patientId),[plans,patientId]);
  // PRESTAZIONI-TUTTE (PO 2026-11-11: "voglio vederle tutte le prestazioni, poi lasciami filtri"):
  // si vedono tutte (niente più «prime 3»), filtri Tutte · Da eseguire · Eseguite, più i denti selezionati.
  const [filter,setFilter] = useState('all'), [selected,setSelected] = useState([]), [conferma,setConferma] = useState(null);
  const canAdd = typeof onAddTreatment === 'function', canQuote = typeof onCreateQuote === 'function';
  // PO 2026-11-10: toccando un dente con prestazioni da fare si vedono subito quelle, ognuna col tasto «Eseguito».
  const toggle = d => { if (!selected.includes(d) && model.teeth[d]?.pending > 0) setFilter('pending'); setSelected(s => s.includes(d) ? s.filter(t=>t!==d) : [...s,d].sort((a,b)=>a-b)); };
  // Stessa regola canonica di Piani (markTreatmentItemCompleted: eseguita + data di oggi), salvata con setPlans.
  const segnaEseguito = row => setPlans?.(cur => cur.map(p => String(p.id) === String(row.planId) ? markTreatmentItemCompleted(p, row.itemIndex).plan : p));
  // PRESTAZIONI-ELIMINA (PO 2026-11-11): ogni prestazione ha il tasto per cancellarla, con la
  // stessa conferma di Piani (avvisa se ci sono pagamenti collegati; i pagamenti non si cancellano).
  // PRESTAZIONI-ELIMINA fix: la conferma è nella riga stessa (window.confirm nell'app Android, una
  // WebView, risponde sempre «no» e la prestazione non si cancellava).
  const voceDi = row => {
    const plan = (plans || []).find(p => String(p.id) === String(row.planId));
    const voce = plan?.voci?.[row.itemIndex];
    return voce && (voce.prestazione || 'Prestazione') === row.name ? plan : null; // mai una voce diversa da quella mostrata
  };
  const chiediElimina = row => { const plan = voceDi(row); if (plan) setConferma({ key: row.key, messaggio: treatmentItemRemovalMessage(plan, row.itemIndex, paidOnPlan(payments, plan.id)) }); };
  const elimina = row => {
    setConferma(null);
    if (!voceDi(row)) return;
    setPlans?.(cur => cur.map(p => String(p.id) === String(row.planId) ? removeTreatmentItem(p, row.itemIndex) : p));
  };
  const open = handler => handler?.({tooth:dentalEntryTeeth(selected)});
  const tutte = [...model.pending.map(r => ({ ...r, kind: 'pending' })), ...model.done.map(r => ({ ...r, kind: 'done' }))];
  const rows = (filter === 'all' ? tutte : tutte.filter(r => r.kind === filter)).filter(row=>!selected.length || row.teeth.some(t=>selected.includes(t)));
  const selectedLabel = selected.join(' · ');
  return <section className="patient-dental-home" aria-label="Odontogramma e cure">
    <div className="patient-dental-heading"><div><span>CARTELLA ODONTOIATRICA</span><h2>Denti e cure</h2></div><span className="patient-dental-hint">Tocca uno o più denti, poi scegli cosa aggiungere</span></div>
    <div className="patient-dental-groups" role="group" aria-label="Selezione rapida">{DENTAL_SELECTION_GROUPS.map(g=>{
      const all = g.teeth.every(t=>selected.includes(t));
      return <button type="button" key={g.label} title={g.title} aria-pressed={all} onClick={()=>setSelected(s=>toggleDentalGroup(s,g.teeth))}>{g.label}</button>;
    })}</div>
    <div className="patient-dental-layout"><div>
      <div className="patient-dental-chart" role="group" aria-label="Odontogramma permanente · selezione multipla">{DENTAL_QUADRANTS.map(q=><div className="patient-dental-quadrant" key={q.label}><small>{q.label}</small><div>{q.teeth.map(d=>{
        const state=model.teeth[d], on=selected.includes(d), label=[`Dente ${d}`,`${state.done} cure eseguite`,`${state.pending} da eseguire`,on ? 'selezionato' : 'tocca per selezionare'].join(' · ');
        return <button type="button" key={d} aria-label={label} aria-pressed={on} className={`${state.done ? 'has-done ' : ''}${state.pending ? 'has-pending ' : ''}${on ? 'is-selected' : ''}`} onClick={()=>toggle(d)}><ToothGlyph tooth={d}/><b>{d}</b><span className="patient-dental-dots" aria-hidden="true">{state.done > 0 && <i className="done"/>}{state.pending > 0 && <i className="pending"/>}</span></button>;
      })}</div></div>)}</div>
      <p className="patient-dental-orientation">Vista frontale · destra e sinistra del paziente</p>
      <div className="patient-dental-legend"><span><i className="done"/>Eseguita</span><span><i className="pending"/>Da eseguire / proposta</span><span>Bianco: nessuna voce registrata</span></div>
      {(canAdd || canQuote) && <div className={`patient-dental-actionbar${selected.length ? ' has-selection' : ''}`} role="region" aria-label="Azioni sui denti selezionati">
        <div className="patient-dental-actionbar-info" aria-live="polite">{selected.length ? <><strong>{selected.length === 1 ? '1 dente' : `${selected.length} denti`}</strong><span>{selectedLabel}</span></> : <><strong>Nessun dente selezionato</strong><span>Prestazione generale, senza dente</span></>}</div>
        <div className="patient-dental-actionbar-buttons">
          {!!selected.length && <button type="button" className="patient-dental-clear" onClick={()=>setSelected([])}>Deseleziona</button>}
          <button type="button" className="patient-dental-quote" disabled={!canQuote} onClick={()=>open(onCreateQuote)}>Preventivo</button>
          <button type="button" className="patient-dental-add" disabled={!canAdd} onClick={()=>open(onAddTreatment)}>{selected.length ? 'Aggiungi prestazioni' : '+ Senza dente'}</button>
        </div>
      </div>}
    </div><div className="patient-dental-history">
      <div className="patient-dental-history-head"><div role="group" aria-label="Filtra prestazioni">{[['all','Tutte',tutte.length],['pending','Da eseguire',model.pending.length],['done','Eseguite',model.done.length]].map(([id,nome,n])=><button type="button" key={id} aria-pressed={filter === id} onClick={()=>setFilter(id)}>{nome} <b>{n}</b></button>)}</div>{!!selected.length && <button type="button" className="patient-dental-reset" onClick={()=>setSelected([])}>{selected.length === 1 ? `Dente ${selected[0]}` : `${selected.length} denti`} ×</button>}</div>
      {!rows.length ? <p className="patient-dental-empty">{filter === 'done' ? 'Nessuna cura eseguita registrata' : filter === 'pending' ? 'Nessuna prestazione da eseguire' : 'Nessuna prestazione registrata'}{selected.length === 1 ? ` sul ${selected[0]}` : selected.length ? ' sui denti selezionati' : ''}.</p> : <ul>{rows.map(row=>{
        const etichetta = `${row.name}${row.site !== 'Generale' ? ` sul ${row.site}` : ''}`;
        if (conferma?.key === row.key) return <li key={row.key} className="patient-dental-confirm" role="alertdialog" aria-label={`Cancellare ${etichetta}?`}><div><strong>Cancellare «{etichetta}»?</strong><small>{conferma.messaggio === 'Rimuovere questa prestazione dal piano?' ? row.planTitle : conferma.messaggio}</small></div><button type="button" className="patient-dental-confirm-no" onClick={()=>setConferma(null)}>Annulla</button><button type="button" className="patient-dental-confirm-yes" onClick={()=>elimina(row)}>Cancella</button></li>;
        return <li key={row.key}><span className={`patient-dental-site ${row.kind}`}>{row.site}</span><div><strong>{row.name}</strong><small>{row.kind === 'done' ? `Eseguita · ${row.dataEsec ? fmtD(row.dataEsec) : 'data non registrata'}` : row.status} · {row.planTitle}</small></div>{row.kind === 'pending' && setPlans ? <button type="button" className="patient-dental-done-button" aria-label={`Segna eseguito: ${etichetta}`} onClick={()=>segnaEseguito(row)}>✓ Eseguito</button> : <span className={`patient-dental-status ${row.kind}`} aria-label={row.status}>{row.kind === 'done' ? '✓' : '○'}</span>}{setPlans && <button type="button" className="patient-dental-delete-button" title="Cancella prestazione" aria-label={`Cancella prestazione: ${etichetta}`} onClick={()=>chiediElimina(row)}><svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3"/></svg></button>}</li>;
      })}</ul>}
    </div></div>
  </section>;
}
