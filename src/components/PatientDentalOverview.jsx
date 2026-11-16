import React, { useMemo, useState } from 'react';
import { DENTAL_QUADRANTS, DENTAL_SELECTION_GROUPS, dentalEntryTeeth, patientDentalOverview, toggleDentalGroup } from '../lib/patientDentalOverview.js';
import { fmt, fmtD } from '../lib/utils';
import { markTreatmentItemCompleted, paidOnPlan, removeTreatmentItem, treatmentItemRemovalMessage, updateTreatmentItem } from '../lib/domain/treatmentPlanService.js';
import './PatientDentalOverview.css';

function ToothGlyph({ tooth }) {
  const molar = tooth % 10 >= 6, upper = Math.floor(tooth / 10) <= 2;
  // Upper teeth (Q1/Q2) are mirrored vertically: roots toward the top, crown toward the occlusal plane.
  return <svg viewBox="0 0 24 28" aria-hidden="true" focusable="false" data-arch={upper ? 'upper' : 'lower'}><g transform={upper ? 'matrix(1 0 0 -1 0 28)' : undefined}><path d={molar ? 'M5 3Q8 1 12 3Q16 1 19 3Q23 7 19 15L17 25Q16 28 14 24L12 17L10 24Q8 28 7 25L5 15Q1 7 5 3Z' : 'M7 3Q12 1 17 3Q21 6 18 13L14 25Q12 28 10 25L6 13Q3 6 7 3Z'} /><path d={molar ? 'M7 7L12 10L17 7M12 10V15' : 'M8 6Q12 8 16 6'} /></g></svg>;
}

export default function PatientDentalOverview({ patientId, plans, payments, onAddTreatment, onCreateQuote, onOpenQuotes, setPlans }) {
  const model = useMemo(()=>patientDentalOverview(plans,patientId),[plans,patientId]);
  // PRESTAZIONI-TUTTE (PO 2026-11-11: "voglio vederle tutte le prestazioni, poi lasciami filtri"):
  // si vedono tutte (niente più «prime 3»), filtri Tutte · Da eseguire · Eseguite, più i denti selezionati.
  const [filter,setFilter] = useState('all'), [selected,setSelected] = useState([]), [conferma,setConferma] = useState(null);
  // PREVENTIVO-DA-PRESTAZIONI (PO 2026-11-12: "sotto prestazioni deve esserci subito il tasto preventivo,
  // selezionabili tutte insieme o una ad una e con un tasto si genera"): ogni riga si spunta da sola
  // (mai gruppi che ne spuntano altre), «Tutte» spunta quelle in vista; «Modifica» cambia nome, dente e prezzo.
  const [picked,setPicked] = useState([]), [modifica,setModifica] = useState(null), [azioni,setAzioni] = useState(null);
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
  const chiediElimina = row => { const plan = voceDi(row); if (plan) { setModifica(null); setConferma({ key: row.key, messaggio: treatmentItemRemovalMessage(plan, row.itemIndex, paidOnPlan(payments, plan.id)) }); } };
  const elimina = row => {
    setConferma(null);
    if (!voceDi(row)) return;
    setPlans?.(cur => cur.map(p => String(p.id) === String(row.planId) ? removeTreatmentItem(p, row.itemIndex) : p));
    setPicked([]); // gli indici delle voci successive cambiano: la spunta riparte da zero
  };
  const apriModifica = row => { setConferma(null); setModifica({ key: row.key, prestazione: row.name, dente: row.dente || '', prezzo: String(row.price) }); };
  const salvaModifica = row => {
    if (!modifica?.prestazione.trim() || !voceDi(row)) return;
    const { prestazione, dente, prezzo } = modifica;
    setPlans?.(cur => cur.map(p => String(p.id) === String(row.planId) ? updateTreatmentItem(p, row.itemIndex, { prestazione, dente, prezzo }) : p));
    setModifica(null);
  };
  const open = handler => handler?.({tooth:dentalEntryTeeth(selected)});
  const tutte = [...model.pending.map(r => ({ ...r, kind: 'pending' })), ...model.done.map(r => ({ ...r, kind: 'done' }))];
  const rows = (filter === 'all' ? tutte : tutte.filter(r => r.kind === filter)).filter(row=>!selected.length || row.teeth.some(t=>selected.includes(t)));
  const selectedLabel = selected.join(' · ');
  const pickedRows = tutte.filter(r => picked.includes(r.key));
  const pickedPlans = [...new Set(pickedRows.map(r => String(r.planId)))];
  const pickedTotal = pickedRows.reduce((sum, r) => sum + r.price, 0);
  const allOn = rows.length > 0 && rows.every(r => picked.includes(r.key));
  const togglePick = key => setPicked(p => p.includes(key) ? p.filter(k => k !== key) : [...p, key]);
  const toggleAll = () => setPicked(p => allOn ? p.filter(k => !rows.some(r => r.key === k)) : [...new Set([...p, ...rows.map(r => r.key)])]);
  // PO 2026-11-13: "posso generare preventivi anche su piani diversi" — le voci spuntate possono
  // stare in piani diversi; con più piani la lista è divisa per piano e ogni piano ha «Tutto il piano».
  const creaPreventivo = () => {
    const voci = pickedRows.filter(r => voceDi(r));
    if (!canQuote || !voci.length) return;
    onCreateQuote({ tooth: dentalEntryTeeth(voci.flatMap(r => r.teeth)), sourcePlanId: voci[0].planId, sourceRefs: voci.map(r => ({ planId: r.planId, index: r.itemIndex })) });
  };
  const planOrder = (plans || []).map(p => String(p.id));
  const groups = new Set(rows.map(r => String(r.planId))).size > 1
    ? planOrder.map(id => ({ id, title: rows.find(r => String(r.planId) === id)?.planTitle, rows: rows.filter(r => String(r.planId) === id) })).filter(g => g.rows.length)
    : null;
  const togglePlan = g => { const on = g.rows.every(r => picked.includes(r.key)); setPicked(p => on ? p.filter(k => !g.rows.some(r => r.key === k)) : [...new Set([...p, ...g.rows.map(r => r.key)])]); };
  const planHead = g => {
    const on = g.rows.every(r => picked.includes(r.key)), some = !on && g.rows.some(r => picked.includes(r.key));
    return <li key={`plan:${g.id}`} className="patient-dental-plan-head">
      {canQuote ? <label><input type="checkbox" checked={on} ref={el => { if (el) el.indeterminate = some; }} onChange={() => togglePlan(g)} aria-label={`Spunta tutto il piano ${g.title}`} /><span><strong>{g.title}</strong><small>{g.rows.length === 1 ? '1 prestazione' : `${g.rows.length} prestazioni`} · Tutto il piano</small></span></label> : <span><strong>{g.title}</strong></span>}
      <b>{fmt(g.rows.reduce((sum, r) => sum + r.price, 0))}</b>
    </li>;
  };
  const renderRow = row => {
        const etichetta = `${row.name}${row.site !== 'Generale' ? ` sul ${row.site}` : ''}`, on = picked.includes(row.key);
        if (conferma?.key === row.key) return <li key={row.key} className="patient-dental-confirm" role="alertdialog" aria-label={`Cancellare ${etichetta}?`}><div><strong>Cancellare «{etichetta}»?</strong><small>{conferma.messaggio === 'Rimuovere questa prestazione dal piano?' ? row.planTitle : conferma.messaggio}</small></div><button type="button" className="patient-dental-confirm-no" onClick={()=>setConferma(null)}>Annulla</button><button type="button" className="patient-dental-confirm-yes" onClick={()=>elimina(row)}>Cancella</button></li>;
        if (modifica?.key === row.key) return <li key={row.key} className="patient-dental-edit" role="group" aria-label={`Modifica ${etichetta}`}>
          <div className="patient-dental-edit-fields">
            <label className="is-wide">Prestazione<input value={modifica.prestazione} onChange={e=>setModifica(m=>({...m,prestazione:e.target.value}))} /></label>
            <label>Dente<input inputMode="numeric" placeholder="Generale" value={modifica.dente} onChange={e=>setModifica(m=>({...m,dente:e.target.value}))} /></label>
            <label>Prezzo €<input type="number" min="0" step="0.01" inputMode="decimal" value={modifica.prezzo} onChange={e=>setModifica(m=>({...m,prezzo:e.target.value}))} /></label>
          </div>
          <div className="patient-dental-edit-actions"><button type="button" className="patient-dental-confirm-no" onClick={()=>setModifica(null)}>Annulla</button><button type="button" className="patient-dental-edit-save" disabled={!modifica.prestazione.trim()} onClick={()=>salvaModifica(row)}>Salva</button></div>
        </li>;
        const aperta = azioni === row.key;
        return <li key={row.key} className={`patient-dental-row${on ? ' is-picked' : ''}${aperta ? ' is-open' : ''}`}>
          <div className="patient-dental-row-main">
            {canQuote && <input type="checkbox" className="patient-dental-pick" checked={on} onChange={()=>togglePick(row.key)} aria-label={`Includi nel preventivo: ${etichetta}`} />}
            <button type="button" className="patient-dental-row-open" aria-expanded={aperta} aria-label={`${etichetta}: azioni`} onClick={()=>setAzioni(a => a === row.key ? null : row.key)}>
              <span className={`patient-dental-site ${row.kind}`}>{row.site === 'Generale' ? 'Bocca' : row.site}</span>
              <span className="patient-dental-row-text"><strong>{row.name}</strong><small>{row.kind === 'done' ? `✓ Eseguita${row.dataEsec ? ` · ${fmtD(row.dataEsec)}` : ''}` : 'Da eseguire'}{groups ? '' : ` · ${row.planTitle}`}</small></span>
              <b className="patient-dental-price">{fmt(row.price)}</b>
              <svg className="patient-dental-chev" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M6 9l6 6 6-6"/></svg>
            </button>
          </div>
          {aperta && <div className="patient-dental-row-actions">
            {row.kind === 'pending' && setPlans ? <button type="button" className="patient-dental-done-button" aria-label={`Segna eseguito: ${etichetta}`} onClick={()=>segnaEseguito(row)}>✓ Eseguito</button> : <span className={`patient-dental-status ${row.kind}`} aria-label={row.status}>{row.kind === 'done' ? '✓ Eseguita' : '○'}</span>}
            {setPlans && <button type="button" className="patient-dental-edit-button" aria-label={`Modifica prestazione: ${etichetta}`} onClick={()=>apriModifica(row)}><svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M4 20h4L19 9l-4-4L4 16zM13.5 6.5l4 4"/></svg>Modifica</button>}
            {setPlans && <button type="button" className="patient-dental-delete-button" title="Cancella prestazione" aria-label={`Cancella prestazione: ${etichetta}`} onClick={()=>chiediElimina(row)}><svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3"/></svg>Cancella</button>}
          </div>}
        </li>;
  };
  return <section className="patient-dental-home" aria-label="Odontogramma e cure">
    <div className="patient-dental-heading"><div><span>CARTELLA ODONTOIATRICA</span><h2>Denti e cure</h2></div>{canAdd && <button type="button" className="patient-dental-add-top" onClick={()=>open(onAddTreatment)}>+ Aggiungi</button>}</div>
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
      {/* PO 2026-11-13 ("più semplice ed intuitiva"): la barra dei denti compare solo con denti scelti;
          il preventivo si fa da un solo posto, la barra sopra le prestazioni. */}
      {canAdd && !!selected.length && <div className="patient-dental-actionbar has-selection" role="region" aria-label="Azioni sui denti selezionati">
        <div className="patient-dental-actionbar-info" aria-live="polite"><strong>{selected.length === 1 ? '1 dente' : `${selected.length} denti`}</strong><span>{selectedLabel}</span></div>
        <div className="patient-dental-actionbar-buttons">
          <button type="button" className="patient-dental-clear" onClick={()=>setSelected([])}>Deseleziona</button>
          <button type="button" className="patient-dental-add" onClick={()=>open(onAddTreatment)}>+ Aggiungi qui</button>
        </div>
      </div>}
    </div><div className="patient-dental-history">
      <div className="patient-dental-history-head"><div role="group" aria-label="Filtra prestazioni">{[['all','Tutte',tutte.length],['pending','Da eseguire',model.pending.length],['done','Eseguite',model.done.length]].map(([id,nome,n])=><button type="button" key={id} aria-pressed={filter === id} onClick={()=>setFilter(id)}>{nome} <b>{n}</b></button>)}</div>{canQuote && !!rows.length && <label className="patient-dental-pickall"><input type="checkbox" checked={allOn} onChange={toggleAll} />Tutte</label>}{!!selected.length && <button type="button" className="patient-dental-reset" onClick={()=>setSelected([])}>{selected.length === 1 ? `Dente ${selected[0]}` : `${selected.length} denti`} ×</button>}</div>
      {canQuote && <div className="patient-dental-quotebar" role="region" aria-label="Preventivo dalle prestazioni">
        <button type="button" className="patient-dental-quote-create" disabled={!pickedRows.length} onClick={creaPreventivo}><span>Crea preventivo<small>{pickedRows.length ? (pickedRows.length === 1 ? '1 prestazione' : `${pickedRows.length} prestazioni`) : 'Spunta le prestazioni'}</small></span>{!!pickedRows.length && <b>{fmt(pickedTotal)}</b>}</button>
        {onOpenQuotes && <button type="button" className="patient-dental-quote-list" onClick={onOpenQuotes}><svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M7 3h7l5 5v13H7zM14 3v5h5M10 13h6M10 17h4"/></svg>Preventivi</button>}
        {pickedPlans.length > 1 && <p>Prestazioni da {pickedPlans.length} piani: vanno tutte nello stesso preventivo.</p>}
      </div>}
      {!rows.length ? <p className="patient-dental-empty">{filter === 'done' ? 'Nessuna cura eseguita registrata' : filter === 'pending' ? 'Nessuna prestazione da eseguire' : 'Nessuna prestazione registrata'}{selected.length === 1 ? ` sul ${selected[0]}` : selected.length ? ' sui denti selezionati' : ''}.</p> : <ul>{groups ? groups.flatMap(g => [planHead(g), ...g.rows.map(renderRow)]) : rows.map(renderRow)}</ul>}
    </div></div>
  </section>;
}
