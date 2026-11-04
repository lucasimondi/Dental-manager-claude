import React, { useId } from 'react';
import { euroIt } from '../lib/documenti/preventivoPdf.js';
import { expandRowsPerTooth, isMultiToothRow, rowsByTooth } from '../lib/patientToothEntry.js';
import './ToothEntryOptions.css';

// Rows actually saved: multi-tooth rows become one row per tooth unless "Voce unica" is chosen.
export const savedEntryRows = (rows, perTooth) => perTooth ? expandRowsPerTooth(rows) : rows;

// Shared by the patient editor and the agenda appointment form. markDone is optional (absent for quotes).
export default function ToothEntryOptions({ rows, perTooth, onPerTooth, markDone, onMarkDone, showSummary = true }) {
  const name = useId();
  const multi = rows.some(row => String(row.description || '').trim() && isMultiToothRow(row));
  const summary = multi && perTooth && showSummary ? rowsByTooth(expandRowsPerTooth(rows)) : [];
  return <>
    {typeof onMarkDone === 'function' && <fieldset className="tooth-entry-status"><legend>Stato delle prestazioni</legend><div>
      <label className={!markDone ? 'is-selected' : ''}><input type="radio" name={`${name}-done`} checked={!markDone} onChange={()=>onMarkDone(false)} /><span>Da eseguire<small>Restano in piano come da fare</small></span></label>
      <label className={markDone ? 'is-selected is-done' : ''}><input type="radio" name={`${name}-done`} checked={!!markDone} onChange={()=>onMarkDone(true)} /><span>✓ Eseguite oggi<small>Registrate come eseguite con la data di oggi</small></span></label>
    </div></fieldset>}
    {multi && <fieldset className="patient-tooth-mode"><legend>Più denti nella stessa riga</legend><div>
      <label className={perTooth ? 'is-selected' : ''}><input type="radio" name={`${name}-mode`} checked={perTooth} onChange={()=>onPerTooth(true)} /><span>Una voce per dente<small>Prezzo per ogni dente, eseguibile dente per dente</small></span></label>
      <label className={!perTooth ? 'is-selected' : ''}><input type="radio" name={`${name}-mode`} checked={!perTooth} onChange={()=>onPerTooth(false)} /><span>Voce unica<small>Un solo prezzo per tutti i denti (es. ponte, igiene)</small></span></label>
    </div></fieldset>}
    {summary.length > 0 && <div className="patient-tooth-summary" aria-label="Riepilogo per dente"><strong>Riepilogo per dente</strong><ul>{summary.map(group=><li key={group.site}><span>{group.site}</span><div>{group.items.map((item,i)=><p key={i}>{item.description}<b>{euroIt(Number(item.price) || 0)}</b></p>)}</div></li>)}</ul></div>}
  </>;
}
