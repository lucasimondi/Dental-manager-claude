import React, { useEffect, useRef, useState } from 'react';
import { Modal } from './ui';
import { EntryRows } from './AppointmentWorkspace.jsx';
import PdfViewerModal from './ui/PdfViewerModal.jsx';
import { buildPreventivoPdf } from '../lib/documenti/preventivoPdf.js';
import './PatientPlanEntry.css';

const blankRow = () => ({ description: '', price: '', tooth: '' });
export default function PatientPlanEntry({ patient, mode, plans = [], pricelist = [], si, features, onSave, onClose }) {
  const quote = mode === 'quote';
  const eligible = plans.filter(p => String(p.pazienteId) === String(patient.id) && ['attivo', 'accettato'].includes(p.stato));
  const [rows, setRows] = useState([blankRow()]);
  const [planId, setPlanId] = useState(eligible.length === 1 ? String(eligible[0].id) : eligible.length ? '' : 'new');
  const [title, setTitle] = useState(quote ? 'Preventivo' : 'Prestazioni occasionali');
  const [saving, setSaving] = useState(false), [uncertain, setUncertain] = useState(false);
  const [error, setError] = useState(''), [message, setMessage] = useState('');
  const [savedPlan, setSavedPlan] = useState(null), [pdf, setPdf] = useState(null);
  const locked = useRef(false), contentRef = useRef(null);
  useEffect(() => {
    const previous = document.activeElement;
    const sheet = contentRef.current?.closest('[role="dialog"]');
    sheet?.querySelector('input[list]')?.focus({ preventScroll: true });
    const keyboard = event => {
      if (!sheet?.contains(event.target)) return;
      if (event.key === 'Escape') { event.preventDefault(); if (!locked.current) onClose(); }
      if (event.key !== 'Tab') return;
      const controls = [...sheet.querySelectorAll('button:not(:disabled),input:not(:disabled),select:not(:disabled),summary')].filter(el => el.getClientRects().length);
      const first = controls[0], last = controls[controls.length - 1];
      if (event.shiftKey && event.target === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && event.target === last) { event.preventDefault(); first?.focus(); }
    };
    document.addEventListener('keydown', keyboard);
    return () => { document.removeEventListener('keydown', keyboard); if (previous?.isConnected) previous.focus({ preventScroll: true }); };
  }, []);

  const listId = React.useId();
  const close = () => { if (!locked.current) onClose(); };
  const save = async exit => {
    if (locked.current || uncertain) return;
    if (!rows.some(r => r.description.trim() || r.price !== '' || r.tooth.trim())) { setError('Inserisci almeno una prestazione.'); return; }
    locked.current = true; setSaving(true); setError(''); setMessage('');
    try {
      const result = await onSave({ items: quote ? [] : rows, quoteItems: quote ? rows : [], planId, planTitle: title, quoteTitle: title, amount: '', implantPreset: !si?.vertical || si.vertical === 'dentistico' });
      if (result.savedPlan) setSavedPlan(result.savedPlan);
      if (result.treatmentId) setPlanId(String(result.treatmentId));
      setRows([blankRow()]);
      if (exit) onClose();
      else setMessage(result.skipped ? `Salvato. ${result.skipped} prestazioni già presenti: non duplicate.` : quote ? 'Preventivo salvato. Puoi aprire il PDF.' : 'Prestazioni salvate.');
    } catch (e) {
      setUncertain(!!e.writesStarted);
      setError(e.writesStarted ? `${e.completed || 0} operazioni confermate. ${e.message} Chiudi e verifica il piano prima di riprovare.` : e.message);
    } finally { locked.current = false; setSaving(false); }
  };
  return <Modal wide mobileVariant="fullscreen" title={`${quote ? 'Nuovo preventivo' : 'Aggiungi prestazione'} · ${patient.nome || ''} ${patient.cognome || ''}`} onClose={close} sheetClassName="patient-entry-sheet" backdropClassName="patient-entry-backdrop">
    <div ref={contentRef} className="patient-plan-entry">
      {patient.anamnesiAllarme && <p role="alert" className="appointment-workspace-alert">Allarme anamnesi: verifica le segnalazioni nella scheda paziente.</p>}
      <fieldset disabled={saving || uncertain}>
        {!quote && <div className="appointment-field"><label htmlFor={`${listId}-plan`}>Salva nel piano</label><select id={`${listId}-plan`} value={planId} onChange={e => setPlanId(e.target.value)}><option value="">Scegli piano…</option>{eligible.map(p => <option key={p.id} value={p.id}>{p.titolo}</option>)}<option value="new">Nuovo piano</option></select></div>}
        <datalist id={listId}>{pricelist.map(p => <option key={p.id} value={p.nome}>{p.prezzo} €</option>)}</datalist>
        <EntryRows rows={rows} onChange={setRows} listId={listId} pricelist={pricelist} dentist={!si?.vertical || si.vertical === 'dentistico'} name={quote ? 'Voce preventivo' : 'Prestazione'} />
        <details><summary>Nome {quote ? 'preventivo' : 'nuovo piano'}</summary><div className="appointment-field"><label htmlFor={`${listId}-title`}>Titolo</label><input id={`${listId}-title`} value={title} onChange={e => setTitle(e.target.value)} /></div></details>
      </fieldset>
      {error && <p role="alert" className="appointment-save-error">{error}</p>}
      {message && <p role="status">{message}</p>}
      {savedPlan && <button type="button" className="appointment-secondary-button" onClick={() => { try { setPdf(buildPreventivoPdf({ si, paziente: patient, piano: savedPlan })); } catch (e) { setError(e.message); } }}>Apri PDF salvato</button>}
      <div className="appointment-save-bar"><button type="button" className="appointment-secondary-button" disabled={saving || uncertain} onClick={() => save(false)}>{saving ? 'Salvataggio…' : 'Salva'}</button><button type="button" className="appointment-primary-button" disabled={saving || uncertain} onClick={() => save(true)}>Salva e chiudi</button></div>
      {pdf && <PdfViewerModal titolo={pdf.titolo} dataUrl={pdf.dataUrl} filename={pdf.filename} zIndex={10001} onClose={() => setPdf(null)} />}
    </div>
  </Modal>;
}
