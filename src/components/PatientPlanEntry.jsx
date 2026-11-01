import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { lockPageScroll } from './ui/Modal.jsx';
import Ic from './ui/Ic.jsx';
import { EntryRows } from './AppointmentWorkspace.jsx';
import PdfViewerModal from './ui/PdfViewerModal.jsx';
import { buildPreventivoPdf, totaliPreventivo, euroIt } from '../lib/documenti/preventivoPdf.js';
import { patientEntryViewport } from '../lib/patientEntryPresentation.js';
import './PatientPlanEntry.css';

const blankRow = () => ({ description: '', price: '', tooth: '' });
export default function PatientPlanEntry({ patient, mode, plans = [], pricelist = [], si, onSave, onClose }) {
  const quote = mode === 'quote';
  const eligible = plans.filter(p => String(p.pazienteId) === String(patient.id) && ['attivo', 'accettato'].includes(p.stato));
  const [rows, setRows] = useState([blankRow()]);
  const [planId, setPlanId] = useState(eligible.length === 1 ? String(eligible[0].id) : eligible.length ? '' : 'new');
  const [title, setTitle] = useState(quote ? 'Preventivo' : 'Prestazioni occasionali');
  const [saving, setSaving] = useState(false), [uncertain, setUncertain] = useState(false);
  const [error, setError] = useState(''), [success, setSuccess] = useState(null);
  const [pdf, setPdf] = useState(null), [typing, setTyping] = useState(false);
  const [viewport, setViewport] = useState(() => patientEntryViewport(window.visualViewport, window.innerHeight));
  const locked = useRef(false), shellRef = useRef(null), scrollRef = useRef(null), titleRef = useRef(null), inputRef = useRef(null), errorRef = useRef(null);
  const previousRows = useRef(rows.length);
  const onCloseRef = useRef(onClose); onCloseRef.current = onClose;
  const total = totaliPreventivo({ voci: rows.map(row => ({ prezzo: row.price })) }).totale;
  const rowCount = rows.filter(row => row.description.trim()).length;
  const close = () => { if (!locked.current) onCloseRef.current(); };
  const revealInput = () => {
    const input = inputRef.current, scroller = scrollRef.current;
    if (!input?.isConnected || document.activeElement !== input || !scroller?.contains(input)) return;
    const field = input.getBoundingClientRect(), view = scroller.getBoundingClientRect();
    if (field.bottom > view.bottom - 18) scroller.scrollTop += field.bottom - view.bottom + 18;
    else if (field.top < view.top + 12) scroller.scrollTop -= view.top + 12 - field.top;
  };
  useLayoutEffect(() => {
    const visual = window.visualViewport;
    const update = () => setViewport(patientEntryViewport(visual, window.innerHeight));
    visual?.addEventListener('resize', update); visual?.addEventListener('scroll', update);
    window.addEventListener('resize', update); update();
    return () => { visual?.removeEventListener('resize', update); visual?.removeEventListener('scroll', update); window.removeEventListener('resize', update); };
  }, []);
  useLayoutEffect(() => { const id = requestAnimationFrame(revealInput); return () => cancelAnimationFrame(id); }, [viewport.height, viewport.top]);
  useLayoutEffect(() => {
    if (rows.length > previousRows.current) {
      const inputs = scrollRef.current?.querySelectorAll('input[role="combobox"]');
      const input = inputs?.[inputs.length - 1];
      inputRef.current = input; input?.focus({ preventScroll: true }); revealInput();
    }
    previousRows.current = rows.length;
  }, [rows.length]);
  useLayoutEffect(() => {
    if (!error) return;
    inputRef.current?.blur(); setTyping(false);
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    errorRef.current?.focus({ preventScroll: true });
  }, [error]);
  useEffect(() => {
    const previous = document.activeElement, shell = shellRef.current;
    const release = lockPageScroll();
    // Portal sits beside the mounted patient record. Prevent background keyboard/touch actions.
    const background = [...document.body.children].filter(el => el !== shell);
    const states = background.map(el => [el, el.inert]); background.forEach(el => { el.inert = true; });
    titleRef.current?.focus({ preventScroll: true });
    const keyboard = event => {
      if (!shell?.contains(event.target)) return;
      if (event.key === 'Escape') { event.preventDefault(); if (!locked.current) onCloseRef.current(); }
      if (event.key !== 'Tab') return;
      const controls = [...shell.querySelectorAll('button:not(:disabled),input:not(:disabled),select:not(:disabled),summary')].filter(el => el.tabIndex >= 0 && el.getClientRects().length);
      const first = controls[0], last = controls[controls.length - 1];
      if (event.shiftKey && (event.target === first || event.target === titleRef.current)) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && event.target === last) { event.preventDefault(); first?.focus(); }
    };
    document.addEventListener('keydown', keyboard);
    return () => { document.removeEventListener('keydown', keyboard); states.forEach(([el, inert]) => { el.inert = inert; }); release(); if (previous?.isConnected) previous.focus({ preventScroll: true }); };
  }, []);
  const save = async () => {
    if (locked.current || uncertain) return;
    if (!rowCount) { setError('Inserisci almeno una prestazione.'); return; }
    locked.current = true; setSaving(true); setError('');
    try {
      const result = await onSave({ items: quote ? [] : rows, quoteItems: quote ? rows : [], planId, planTitle: title, quoteTitle: title, amount: '', implantPreset: !si?.vertical || si.vertical === 'dentistico' });
      inputRef.current?.blur(); setTyping(false);
      setSuccess({ ...result, plan: result.savedPlan || plans.find(p => String(p.id) === String(result.treatmentId)) });
      scrollRef.current?.scrollTo({ top: 0 });
      titleRef.current?.focus({ preventScroll: true });
    } catch (e) {
      setUncertain(!!e.writesStarted);
      setError(e.writesStarted ? `${e.completed || 0} operazioni confermate. ${e.message} Verifica il piano prima di riprovare.` : e.message);
    } finally { locked.current = false; setSaving(false); }
  };
  const patientName = [patient.nome, patient.cognome].filter(Boolean).join(' ');
  return createPortal(<div ref={shellRef} className={`patient-entry-overlay${viewport.height < 500 ? ' is-compact' : ''}`} style={{ top: viewport.top, height: viewport.height }}>
    <section role="dialog" aria-modal="true" aria-labelledby="patient-entry-title" className="patient-entry-panel">
      <header className="patient-entry-header">
        <div className="patient-entry-mark" aria-hidden="true"><Ic n={quote ? 'file' : 'tooth'} s={21} c="currentColor" /></div>
        <div className="patient-entry-heading"><span>{quote ? 'PREVENTIVO' : 'PRESTAZIONI'}</span><h2 id="patient-entry-title" ref={titleRef} tabIndex={-1}>{patientName}</h2></div>
        <button type="button" className="patient-entry-close" aria-label="Chiudi" disabled={saving} onClick={close}><Ic n="x" s={20} c="currentColor" /></button>
      </header>
      <div className="patient-entry-scroll" ref={scrollRef} onFocusCapture={event => { if (event.target.matches('input,textarea')) { inputRef.current = event.target; setTyping(true); } }} onBlurCapture={event => { if (event.target === inputRef.current && !event.relatedTarget?.matches('input,textarea')) setTyping(false); }}>
        {success ? <div className="patient-entry-success" role="status"><div className="patient-entry-success-icon"><Ic n="ok" s={28} c="currentColor" /></div><span>OPERAZIONE COMPLETATA</span><h3>{quote ? 'Preventivo salvato' : 'Prestazioni salvate'}</h3><p>{success.skipped ? `${success.skipped} prestazioni erano già presenti nel piano e non sono state duplicate.` : 'Le voci sono ora nella scheda del paziente.'}</p>
          {success.plan && <><div className="patient-entry-saved-summary"><strong>{success.plan.titolo}</strong><span>{success.plan.voci?.length || 0} voci</span><b>{euroIt(totaliPreventivo(success.plan).totale)}</b></div><button type="button" className="patient-entry-pdf" onClick={() => { try { setPdf(buildPreventivoPdf({ si, paziente: patient, piano: success.plan })); } catch (e) { setError(e.message); } }}><Ic n="file" s={19} c="currentColor" />Apri PDF salvato<Ic n="eye" s={16} c="currentColor" /></button></>}
        </div> : <>
          <div className="patient-entry-intro"><h3>{quote ? 'Prepara il preventivo' : 'Quali prestazioni vuoi inserire?'}</h3><p>Cerca nel tuo listino o scrivi una voce libera.</p></div>
          {patient.anamnesiAllarme && <p role="alert" className="patient-entry-warning">Allarme anamnesi: verifica le segnalazioni nella scheda paziente.</p>}
          <fieldset className="patient-entry-fields" disabled={saving || uncertain}>
            <EntryRows rows={rows} onChange={setRows} pricelist={pricelist} dentist={!si?.vertical || si.vertical === 'dentistico'} name="Prestazione" allowDuplicate={false} />
            <details className="patient-entry-options" open={!quote && eligible.length > 1 && !planId}><summary>{quote ? 'Nome del preventivo' : 'Piano di destinazione'}</summary><div>
              {!quote && <label className="patient-entry-option-field">Salva nel piano<select value={planId} onChange={e => setPlanId(e.target.value)}><option value="">Scegli piano…</option>{eligible.map(p => <option key={p.id} value={p.id}>{p.titolo}</option>)}<option value="new">Nuovo piano</option></select></label>}
              {(quote || planId === 'new') && <label className="patient-entry-option-field">Titolo<input value={title} onChange={e => setTitle(e.target.value)} /></label>}
            </div></details>
          </fieldset>
        </>}
        {error && <p ref={errorRef} tabIndex={-1} role="alert" className="patient-entry-error">{error}</p>}
      </div>
      <footer className="patient-entry-footer">
        {!success && <div className="patient-entry-summary"><span>{rowCount} {rowCount === 1 ? 'prestazione' : 'prestazioni'}<small>{quote ? 'Totale preventivo' : 'Totale nuove voci'}</small></span><strong>{euroIt(total)}</strong></div>}
        <div className="patient-entry-footer-actions">
          {typing && !success && <button type="button" className="patient-entry-keyboard" onMouseDown={e => e.preventDefault()} onClick={() => { inputRef.current?.blur(); setTyping(false); }}>Nascondi tastiera</button>}
          <button type="button" className="patient-entry-save" disabled={saving || uncertain} onClick={success ? close : save}>{saving ? 'Salvataggio…' : success ? 'Torna al paziente' : quote ? 'Salva preventivo' : 'Salva prestazioni'}<Ic n={success ? 'back' : 'ok'} s={17} c="currentColor" /></button>
        </div>
      </footer>
    </section>
    {pdf && <PdfViewerModal titolo={pdf.titolo} dataUrl={pdf.dataUrl} filename={pdf.filename} zIndex={10001} onClose={() => setPdf(null)} />}
  </div>, document.body);
}
