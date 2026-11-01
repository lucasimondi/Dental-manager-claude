import React, { useMemo, useState } from 'react';
import { DENTAL_QUADRANTS, patientDentalOverview } from '../lib/patientDentalOverview.js';
import { fmtD } from '../lib/utils';
import './PatientDentalOverview.css';

function ToothGlyph({ tooth }) {
  const molar = tooth % 10 >= 6;
  return <svg viewBox="0 0 24 28" aria-hidden="true" focusable="false"><path d={molar ? 'M5 3Q8 1 12 3Q16 1 19 3Q23 7 19 15L17 25Q16 28 14 24L12 17L10 24Q8 28 7 25L5 15Q1 7 5 3Z' : 'M7 3Q12 1 17 3Q21 6 18 13L14 25Q12 28 10 25L6 13Q3 6 7 3Z'} /><path d={molar ? 'M7 7L12 10L17 7M12 10V15' : 'M8 6Q12 8 16 6'} /></svg>;
}

export default function PatientDentalOverview({ patientId, plans, onAddTreatment, onCreateQuote }) {
  const model = useMemo(()=>patientDentalOverview(plans,patientId),[plans,patientId]);
  const [mode,setMode] = useState('treatment'), [filter,setFilter] = useState('done');
  const [tooth,setTooth] = useState(''), [expanded,setExpanded] = useState(false);
  const canAdd = typeof onAddTreatment === 'function', canQuote = typeof onCreateQuote === 'function';
  const open = value => { setTooth(String(value || '')); (mode === 'quote' ? onCreateQuote : onAddTreatment)?.({tooth:String(value || '')}); };
  const rows = model[filter].filter(row=>!tooth || row.teeth.includes(Number(tooth)));
  return <section className="patient-dental-home" aria-label="Odontogramma e cure">
    <div className="patient-dental-heading"><div><span>CARTELLA ODONTOIATRICA</span><h2>Denti e cure</h2></div><span className="patient-dental-hint">Tocca un dente per aggiungere</span></div>
    {(canAdd || canQuote) && <div className="patient-dental-tools"><div role="group" aria-label="Azione sul dente">
      <button type="button" aria-pressed={mode === 'treatment'} disabled={!canAdd} onClick={()=>setMode('treatment')}>Prestazione</button>
      <button type="button" aria-pressed={mode === 'quote'} disabled={!canQuote} onClick={()=>setMode('quote')}>Preventivo</button>
    </div><button type="button" className="patient-dental-general" disabled={mode === 'quote' ? !canQuote : !canAdd} onClick={()=>open('')}>+ Senza dente</button></div>}
    <div className="patient-dental-layout"><div>
      <div className="patient-dental-chart" role="group" aria-label="Odontogramma permanente">{DENTAL_QUADRANTS.map(q=><div className="patient-dental-quadrant" key={q.label}><small>{q.label}</small><div>{q.teeth.map(d=>{
        const state=model.teeth[d], label=[`Dente ${d}`,`${state.done} cure eseguite`,`${state.pending} da eseguire`,mode === 'quote' ? 'aggiungi al preventivo' : 'aggiungi prestazione'].join(' · ');
        return <button type="button" key={d} aria-label={label} className={`${state.done ? 'has-done ' : ''}${state.pending ? 'has-pending ' : ''}${tooth === String(d) ? 'is-selected' : ''}`} disabled={mode === 'quote' ? !canQuote : !canAdd} onClick={()=>open(d)}><ToothGlyph tooth={d}/><b>{d}</b><span className="patient-dental-dots" aria-hidden="true">{state.done > 0 && <i className="done"/>}{state.pending > 0 && <i className="pending"/>}</span></button>;
      })}</div></div>)}</div>
      <div className="patient-dental-legend"><span><i className="done"/>Eseguita</span><span><i className="pending"/>Da eseguire / proposta</span><span>Bianco: nessuna voce registrata</span></div>
    </div><div className="patient-dental-history">
      <div className="patient-dental-history-head"><div role="group" aria-label="Mostra cure"><button type="button" aria-pressed={filter === 'done'} onClick={()=>{setFilter('done');setExpanded(false);}}>Eseguite <b>{model.done.length}</b></button><button type="button" aria-pressed={filter === 'pending'} onClick={()=>{setFilter('pending');setExpanded(false);}}>Da eseguire <b>{model.pending.length}</b></button></div>{tooth && <button type="button" className="patient-dental-reset" onClick={()=>{setTooth('');setExpanded(false);}}>Dente {tooth} ×</button>}</div>
      {!rows.length ? <p className="patient-dental-empty">{filter === 'done' ? 'Nessuna cura eseguita registrata' : 'Nessuna prestazione da eseguire'}{tooth ? ` sul ${tooth}` : ''}.</p> : <ul>{(expanded ? rows : rows.slice(0,3)).map(row=><li key={row.key}><span className={`patient-dental-site ${filter}`}>{row.site}</span><div><strong>{row.name}</strong><small>{filter === 'done' ? row.dataEsec ? fmtD(row.dataEsec) : 'Data non registrata' : row.status} · {row.planTitle}</small></div><span className={`patient-dental-status ${filter}`} aria-label={row.status}>{filter === 'done' ? '✓' : '○'}</span></li>)}</ul>}
      {rows.length > 3 && <button type="button" className="patient-dental-more" aria-expanded={expanded} onClick={()=>setExpanded(!expanded)}>{expanded ? 'Mostra meno' : `Mostra tutte (${rows.length})`}</button>}
    </div></div>
  </section>;
}
