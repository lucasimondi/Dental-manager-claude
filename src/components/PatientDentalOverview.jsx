import React, { useMemo, useState } from 'react';
import { DENTAL_QUADRANTS, DENTAL_SELECTION_GROUPS, dentalEntryTeeth, patientDentalOverview, toggleDentalGroup } from '../lib/patientDentalOverview.js';
import { fmtD } from '../lib/utils';
import './PatientDentalOverview.css';

function ToothGlyph({ tooth }) {
  const molar = tooth % 10 >= 6, upper = Math.floor(tooth / 10) <= 2;
  // Upper teeth (Q1/Q2) are mirrored vertically: roots toward the top, crown toward the occlusal plane.
  return <svg viewBox="0 0 24 28" aria-hidden="true" focusable="false" data-arch={upper ? 'upper' : 'lower'}><g transform={upper ? 'matrix(1 0 0 -1 0 28)' : undefined}><path d={molar ? 'M5 3Q8 1 12 3Q16 1 19 3Q23 7 19 15L17 25Q16 28 14 24L12 17L10 24Q8 28 7 25L5 15Q1 7 5 3Z' : 'M7 3Q12 1 17 3Q21 6 18 13L14 25Q12 28 10 25L6 13Q3 6 7 3Z'} /><path d={molar ? 'M7 7L12 10L17 7M12 10V15' : 'M8 6Q12 8 16 6'} /></g></svg>;
}

export default function PatientDentalOverview({ patientId, plans, onAddTreatment, onCreateQuote, onMarkDone, onUndoDone }) {
  const model = useMemo(()=>patientDentalOverview(plans,patientId),[plans,patientId]);
  const [filter,setFilter] = useState('done'), [selected,setSelected] = useState([]), [expanded,setExpanded] = useState(false);
  const canAdd = typeof onAddTreatment === 'function', canQuote = typeof onCreateQuote === 'function', canDone = typeof onMarkDone === 'function';
  const [doneNotice,setDoneNotice] = useState(null);
  const markDone = list => {
    const changes = onMarkDone(list.map(r=>({planId:r.planId,itemIndex:r.itemIndex,prestazione:r.prestazione,dente:r.dente || ''})));
    setDoneNotice(Array.isArray(changes) && changes.length ? {changes,count:changes.length} : {changes:[],count:0});
  };
  const toggle = d => { setExpanded(false); setSelected(s => s.includes(d) ? s.filter(t=>t!==d) : [...s,d].sort((a,b)=>a-b)); };
  const open = handler => handler?.({tooth:dentalEntryTeeth(selected)});
  const rows = model[filter].filter(row=>!selected.length || row.teeth.some(t=>selected.includes(t)));
  const selectedLabel = selected.join(' · ');
  return <section className="patient-dental-home" aria-label="Odontogramma e cure">
    <div className="patient-dental-heading"><div><span>CARTELLA ODONTOIATRICA</span><h2>Denti e cure</h2></div><span className="patient-dental-hint">Tocca uno o più denti, poi scegli cosa aggiungere</span></div>
    <div className="patient-dental-groups" role="group" aria-label="Selezione rapida">{DENTAL_SELECTION_GROUPS.map(g=>{
      const all = g.teeth.every(t=>selected.includes(t));
      return <button type="button" key={g.label} title={g.title} aria-pressed={all} onClick={()=>{setExpanded(false);setSelected(s=>toggleDentalGroup(s,g.teeth));}}>{g.label}</button>;
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
          {!!selected.length && <button type="button" className="patient-dental-clear" onClick={()=>{setSelected([]);setExpanded(false);}}>Deseleziona</button>}
          <button type="button" className="patient-dental-quote" disabled={!canQuote} onClick={()=>open(onCreateQuote)}>Preventivo</button>
          <button type="button" className="patient-dental-add" disabled={!canAdd} onClick={()=>open(onAddTreatment)}>{selected.length ? 'Aggiungi prestazioni' : '+ Senza dente'}</button>
        </div>
      </div>}
    </div><div className="patient-dental-history">
      <div className="patient-dental-history-head"><div role="group" aria-label="Mostra cure"><button type="button" aria-pressed={filter === 'done'} onClick={()=>{setFilter('done');setExpanded(false);}}>Eseguite <b>{model.done.length}</b></button><button type="button" aria-pressed={filter === 'pending'} onClick={()=>{setFilter('pending');setExpanded(false);}}>Da eseguire <b>{model.pending.length}</b></button></div>{!!selected.length && <button type="button" className="patient-dental-reset" onClick={()=>{setSelected([]);setExpanded(false);}}>{selected.length === 1 ? `Dente ${selected[0]}` : `${selected.length} denti`} ×</button>}</div>
      {doneNotice && <div className={`patient-dental-done-notice${doneNotice.count ? '' : ' is-error'}`} role="status">{doneNotice.count ? <><span>✓ {doneNotice.count === 1 ? '1 prestazione segnata eseguita oggi' : `${doneNotice.count} prestazioni segnate eseguite oggi`}</span>{typeof onUndoDone === 'function' && <button type="button" onClick={()=>{onUndoDone(doneNotice.changes);setDoneNotice(null);}}>Annulla</button>}</> : <span>Prestazione cambiata nel frattempo: riapri la scheda e riprova.</span>}<button type="button" aria-label="Chiudi avviso" onClick={()=>setDoneNotice(null)}>×</button></div>}
      {canDone && filter === 'pending' && selected.length > 0 && rows.length > 1 && <button type="button" className="patient-dental-done-all" onClick={()=>markDone(rows)}>✓ Segna eseguite tutte ({rows.length}) sui denti selezionati</button>}
      {!rows.length ? <p className="patient-dental-empty">{filter === 'done' ? 'Nessuna cura eseguita registrata' : 'Nessuna prestazione da eseguire'}{selected.length === 1 ? ` sul ${selected[0]}` : selected.length ? ' sui denti selezionati' : ''}.</p> : <ul>{(expanded ? rows : rows.slice(0,3)).map(row=><li key={row.key}><span className={`patient-dental-site ${filter}`}>{row.site}</span><div><strong>{row.name}</strong><small>{filter === 'done' ? row.dataEsec ? fmtD(row.dataEsec) : 'Data non registrata' : row.status} · {row.planTitle}</small></div>{filter === 'pending' && canDone ? <button type="button" className="patient-dental-done-button" aria-label={`Segna eseguita oggi: ${row.name}${row.dente ? ` dente ${row.dente}` : ''}`} onClick={()=>markDone([row])}>✓ Eseguita</button> : <span className={`patient-dental-status ${filter}`} aria-label={row.status}>{filter === 'done' ? '✓' : '○'}</span>}</li>)}</ul>}
      {rows.length > 3 && <button type="button" className="patient-dental-more" aria-expanded={expanded} onClick={()=>setExpanded(!expanded)}>{expanded ? 'Mostra meno' : `Mostra tutte (${rows.length})`}</button>}
    </div></div>
  </section>;
}
