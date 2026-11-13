import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { lockPageScroll } from './ui/Modal.jsx';
import Ic from './ui/Ic.jsx';
import { EntryRows } from './AppointmentWorkspace.jsx';
import PdfViewerModal from './ui/PdfViewerModal.jsx';
import { totaliPreventivo, euroIt } from '../lib/documenti/preventivoPdf.js';
import { patientQuoteProjection } from '../lib/patientQuoteProjection.js';
import { patientEntryViewport } from '../lib/patientEntryPresentation.js';
import './PatientPlanEntry.css';
import QuoteDeliveryActions from './QuoteDeliveryActions.jsx';
import { preparePatientEntry } from '../lib/appointmentEntry.js';
import { archivePreventivo, quoteRequestId } from '../lib/preventivi.js';
import { supabase } from '../lib/supabase.js';
import { dentalEntryTeeth } from '../lib/patientDentalOverview.js';
import { expandRowsPerTooth, isMultiToothRow, rowsByTooth, toothList } from '../lib/patientToothEntry.js';

const blankRow = () => ({ description: '', price: '', tooth: '' });
export default function PatientPlanEntry({ patient, mode, initialTooth = '', plans = [], pricelist = [], si, onSave, onClose, documentClient = supabase, sourcePlan, sourceItems = null, onUpdateSourcePrices }) {
  const quote = mode === 'quote';
  const seedTeeth = dentalEntryTeeth(initialTooth), fromChart = !!seedTeeth;
  const eligible = plans.filter(p => String(p.pazienteId) === String(patient.id) && ['attivo', 'accettato'].includes(p.stato));
  const [sourceId, setSourceId] = useState(sourcePlan ? String(sourcePlan.id) : '');
  const sourcePlans = sourcePlan ? [sourcePlan,...plans.filter(p=>String(p.id)!==String(sourcePlan.id))] : plans;
  // PREVENTIVO-DA-PRESTAZIONI (PO 2026-11-12): aperto da «Crea preventivo» con le voci spuntate in
  // Denti e cure. Si vedono solo quelle, ognuna col prezzo modificabile; niente sconto del piano intero.
  const selection = !!(sourcePlan && quote && Array.isArray(sourceItems) && sourceItems.some(i => sourcePlan.voci?.[i]));
  const [rows, setRows] = useState(() => selection ? sourceItems.filter(i => sourcePlan.voci[i]).map(i => ({ description: sourcePlan.voci[i].prestazione || 'Prestazione', price: String(sourcePlan.voci[i].prezzo ?? ''), tooth: sourcePlan.voci[i].dente || '', sourceIndex: i })) : sourcePlan ? sourcePlan.voci.map(v=>({description:v.prestazione,price:String(v.prezzo),tooth:v.dente || ''})) : [{...blankRow(),tooth:seedTeeth}]);
  const [planId, setPlanId] = useState(eligible.length === 1 ? String(eligible[0].id) : eligible.length ? '' : 'new');
  const [quoteScope, setQuoteScope] = useState(quote ? 'all' : 'entered');
  const [pdfPlanId, setPdfPlanId] = useState('');
  const archiveIds = useRef(new Map()), documentLock = useRef(false), deliveryLock = useRef(false);
  const [archivedDone, setArchivedDone] = useState(false);
  const [discount, setDiscount] = useState(selection ? '' : sourcePlan?.sconto || ''), [discountType, setDiscountType] = useState(sourcePlan?.scontoTipo === 'pct' || !sourcePlan?.scontoTipo ? 'pct' : 'eur');
  const [title, setTitle] = useState(sourcePlan?.titolo || (quote ? 'Preventivo' : 'Prestazioni occasionali'));
  const [saving, setSaving] = useState(false), [uncertain, setUncertain] = useState(false);
  const [error, setError] = useState(''), [success, setSuccess] = useState(null);
  const [pdf, setPdf] = useState(null), [typing, setTyping] = useState(false);
  const [viewport, setViewport] = useState(() => patientEntryViewport(window.visualViewport, window.innerHeight));
  const locked = useRef(false), shellRef = useRef(null), scrollRef = useRef(null), titleRef = useRef(null), inputRef = useRef(null), errorRef = useRef(null);
  const previousRows = useRef(rows.length), viewportMounted = useRef(false);
  const onCloseRef = useRef(onClose); onCloseRef.current = onClose;
  // Multi-tooth rows become one canonical row per tooth unless the operator asks for a single combined row.
  const [perTooth, setPerTooth] = useState(true);
  const multiTooth = rows.some(row => row.description.trim() && isMultiToothRow(row));
  const savedRows = perTooth && !selection ? expandRowsPerTooth(rows) : rows;
  const total = totaliPreventivo({ voci: savedRows.map(row => ({ prezzo: row.price })), sconto: discount, scontoTipo: discountType }).totale;
  const rowCount = savedRows.filter(row => row.description.trim()).length;
  const toothSummary = multiTooth && perTooth ? rowsByTooth(savedRows) : [];
  const close = () => { if (!locked.current && !documentLock.current && !deliveryLock.current) onCloseRef.current(); };
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
  useLayoutEffect(() => { if (!viewportMounted.current) { viewportMounted.current = true; return; } const id = requestAnimationFrame(revealInput); return () => cancelAnimationFrame(id); }, [viewport.height, viewport.top]);
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
      if (event.key === 'Escape') { event.preventDefault(); if (!locked.current && !documentLock.current && !deliveryLock.current) onCloseRef.current(); }
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
    if (success) return success;
    if (locked.current || uncertain) return;
    if (!rowCount) { setError('Inserisci almeno una prestazione.'); return; }
    locked.current = true; setSaving(true); setError('');
    try {
      const draft = { items: quote ? [] : savedRows, quoteItems: quote ? savedRows : [], planId, planTitle: title, quoteTitle: title, amount: '', quoteDiscount: discount, quoteDiscountType: discountType, implantPreset: !si?.vertical || si.vertical === 'dentistico' };
      let result;
      if (quote && sourceId) {
        const source = sourcePlans.find(p=>String(p.id)===sourceId && String(p.pazienteId)===String(patient.id));
        if (!source) throw new Error('Piano di origine non disponibile.');
        const proposed = preparePatientEntry({ patient, plans: [], draft }).quote;
        if (!proposed) throw new Error('Inserisci almeno una prestazione.');
        const documentPlan = {...proposed,id:source.id};
        let pricesUpdated = 0;
        if (selection && onUpdateSourcePrices) {
          const changes = rows.filter(r => Number.isInteger(r.sourceIndex) && source.voci?.[r.sourceIndex])
            .map(r => ({ index: r.sourceIndex, prezzo: Number(r.price) || 0, prestazione: source.voci[r.sourceIndex].prestazione || 'Prestazione', prima: Number(source.voci[r.sourceIndex].prezzo) || 0 }))
            .filter(c => c.prezzo !== c.prima);
          if (changes.length) { onUpdateSourcePrices(source.id, changes); pricesUpdated = changes.length; }
        }
        result = { quoteId: source.id, savedPlans: [documentPlan], documentOnly: true, pricesUpdated };
      } else result = await onSave(draft);
      inputRef.current?.blur(); setTyping(false);
      const savedPlans = result.savedPlans?.length ? result.savedPlans : [result.savedPlan || plans.find(p => String(p.id) === String(result.treatmentId))].filter(Boolean);
      const plan = savedPlans.find(p => String(p.id) === String(result.quoteId || result.treatmentId)) || savedPlans[0];
      setPdfPlanId(String(plan?.id || ''));
      const next = { ...result, plan, savedPlans, draft };
      setSuccess(next);
      scrollRef.current?.scrollTo({ top: 0 });
      titleRef.current?.focus({ preventScroll: true });
      return next;
    } catch (e) {
      setUncertain(!!e.writesStarted);
      setError(e.writesStarted ? `${e.completed || 0} operazioni confermate. ${e.message} Verifica il piano prima di riprovare.` : e.message);
    } finally { locked.current = false; setSaving(false); }
  };
  const prepareDocument = async () => {
    documentLock.current = true;
    try {
    const saved = success || await save();
    if (!saved?.plan) return null;
    const selected = saved.savedPlans.find(p => String(p.id) === pdfPlanId) || saved.plan;
    const projection = patientQuoteProjection(selected, saved.draft, quoteScope);
    const key = JSON.stringify([projection.id, projection.voci, projection.sconto, projection.scontoTipo]);
    if (!archiveIds.current.has(key)) archiveIds.current.set(key, quoteRequestId());
    const archived = await archivePreventivo(documentClient, { id: archiveIds.current.get(key), piano: projection, paziente: patient, si });
    setArchivedDone(true);
    return archived;
    } finally { documentLock.current = false; }
  };
  const documentPlan = success?.savedPlans?.find(p => String(p.id) === pdfPlanId) || success?.plan;
  let projection = null, projectionError = '';
  if (documentPlan) { try { projection = patientQuoteProjection(documentPlan, success.draft, quoteScope); } catch (cause) { projectionError = cause.message; } }
  const scopeChoices = <fieldset className="patient-quote-scope"><legend>Nel PDF del preventivo</legend><div>
    <label className={quoteScope === 'all' ? 'is-selected' : ''}><input type="radio" name="patient-quote-scope" value="all" checked={quoteScope === 'all'} onChange={()=>setQuoteScope('all')} /><span>Tutto il piano<small>Tutte le prestazioni del piano scelto</small></span></label>
    <label className={quoteScope === 'entered' ? 'is-selected' : ''}><input type="radio" name="patient-quote-scope" value="entered" checked={quoteScope === 'entered'} onChange={()=>setQuoteScope('entered')} /><span>{rowCount <= 1 ? 'Solo questa prestazione' : 'Solo le voci inserite ora'}<small>Prezzi delle singole voci, senza sconto globale</small></span></label>
  </div></fieldset>;
  const selectSource = id => {
    setSourceId(id);
    const source = sourcePlans.find(p=>String(p.id)===id);
    setRows(source ? source.voci.map(v=>({description:v.prestazione,price:String(v.prezzo),tooth:v.dente || ''})) : [blankRow()]);
    setDiscount(source?.sconto || '');setDiscountType(source?.scontoTipo === 'pct' || !source?.scontoTipo ? 'pct' : 'eur');setTitle(source?.titolo || 'Preventivo');
  };
  const patientName = [patient.nome, patient.cognome].filter(Boolean).join(' ');
  return createPortal(<div ref={shellRef} className={`patient-entry-overlay${viewport.height < 500 ? ' is-compact' : ''}`} style={{ top: viewport.top, height: viewport.height }}>
    <section role="dialog" aria-modal="true" aria-labelledby="patient-entry-title" className={`patient-entry-panel${quote ? ' is-quote' : ''}${fromChart && !selection ? ' from-dental-chart' : ''}`}>
      <header className="patient-entry-header">
        <div className="patient-entry-mark" aria-hidden="true"><Ic n={quote ? 'file' : 'tooth'} s={21} c="currentColor" /></div>
        <div className="patient-entry-heading"><span>{quote ? 'PREVENTIVO' : 'PRESTAZIONI'}{fromChart ? ` · ${(toothList(seedTeeth)?.length || 0) > 1 ? 'Denti' : 'Dente'} ${seedTeeth}` : ''}</span><h2 id="patient-entry-title" ref={titleRef} tabIndex={-1}>{patientName}</h2></div>
        <button type="button" className="patient-entry-close" aria-label="Chiudi" disabled={saving} onClick={close}><Ic n="x" s={20} c="currentColor" /></button>
      </header>
      <div className="patient-entry-scroll" ref={scrollRef} onFocusCapture={event => { if (event.target.matches('input,textarea')) { inputRef.current = event.target; setTyping(true); } }} onBlurCapture={event => { if (event.target === inputRef.current && !event.relatedTarget?.matches('input,textarea')) setTyping(false); }}>
        {success ? <div className="patient-entry-success" role="status"><div className="patient-entry-success-icon"><Ic n="ok" s={28} c="currentColor" /></div><span>OPERAZIONE COMPLETATA</span><h3>{quote ? archivedDone ? 'Preventivo archiviato' : 'Voci salvate · prepara il documento' : 'Prestazioni salvate'}</h3><p>{success.skipped ? `${success.skipped} prestazioni erano già presenti nel piano e non sono state duplicate.` : success.documentOnly ? success.pricesUpdated ? `Documento preparato dal piano. ${success.pricesUpdated === 1 ? 'Il prezzo cambiato è aggiornato' : `I ${success.pricesUpdated} prezzi cambiati sono aggiornati`} anche nelle prestazioni.` : 'Documento preparato dal piano. Il piano clinico non è stato modificato.' : 'Le voci sono ora nella scheda del paziente.'}</p>
          {documentPlan && <>
            {success.savedPlans.length > 1 && <label className="patient-entry-option-field">Piano per il preventivo<select value={pdfPlanId} onChange={e=>setPdfPlanId(e.target.value)}>{success.savedPlans.map(p=><option key={p.id} value={p.id}>{p.titolo}</option>)}</select></label>}
            {!quote && scopeChoices}
            {projection && <div className="patient-entry-saved-summary"><strong>{quoteScope === 'all' ? documentPlan.titolo : 'Preventivo della prestazione'}</strong><span>{projection.voci.length} {projection.voci.length === 1 ? 'voce' : 'voci'}</span><b>{euroIt(totaliPreventivo(projection).totale)}</b></div>}
            {projectionError && <p role="alert" className="patient-entry-error">{projectionError}</p>}
            {!quote && <button type="button" className="patient-entry-pdf" disabled={!projection} onClick={async () => { try { setPdf(await prepareDocument()); } catch (e) { setError(e.message); } }}><Ic n="file" s={19} c="currentColor" />Apri PDF del preventivo<Ic n="eye" s={16} c="currentColor" /></button>}
          </>}
        </div> : <>
          <div className="patient-entry-intro"><h3>{selection ? 'Preventivo pronto' : quote ? 'Prepara il preventivo' : 'Quali prestazioni vuoi inserire?'}</h3><p>{selection ? `${rows.length === 1 ? '1 prestazione' : `${rows.length} prestazioni`} da «Denti e cure». Controlla i prezzi, poi invia o salva.` : fromChart && (toothList(seedTeeth)?.length || 0) > 1 ? `Ogni prestazione vale per i denti ${seedTeeth}. Aggiungi più prestazioni con “Altra prestazione”; i denti di ogni riga restano modificabili.` : 'Cerca nel tuo listino o scrivi una voce libera.'}</p></div>
          {patient.anamnesiAllarme && <p role="alert" className="patient-entry-warning">Allarme anamnesi: verifica le segnalazioni nella scheda paziente.</p>}
          <fieldset className="patient-entry-fields" disabled={saving || uncertain}>
            {selection ? <div className="quote-pick" role="group" aria-label="Prestazioni nel preventivo">
              {rows.map((row, i) => <div className="quote-pick-row" key={row.sourceIndex ?? i}>
                <div><strong>{row.description}</strong><small>{row.tooth ? `Dente ${row.tooth}` : 'Generale'}</small></div>
                <label><span>Prezzo €</span><input type="number" min="0" step="0.01" inputMode="decimal" aria-label={`Prezzo ${row.description}${row.tooth ? ` sul ${row.tooth}` : ''}`} value={row.price} onChange={e => { const price = e.target.value; setRows(rs => rs.map((r, j) => j === i ? { ...r, price } : r)); }} /></label>
                <button type="button" aria-label={`Togli ${row.description} dal preventivo`} disabled={rows.length === 1} onClick={() => setRows(rs => rs.filter((_, j) => j !== i))}><Ic n="x" s={16} c="currentColor" /></button>
              </div>)}
              <p className="quote-pick-note">Un prezzo cambiato qui cambia anche nella prestazione del piano, e quindi in «Da pagare».</p>
            </div> : <>
            {quote && sourcePlans.some(p=>String(p.pazienteId)===String(patient.id)) && <label className="patient-entry-option-field">Prestazioni da preventivare<select value={sourceId} onChange={e=>selectSource(e.target.value)}><option value="" disabled={!onSave}>Nuovo preventivo · voci libere</option>{sourcePlans.filter(p=>String(p.pazienteId)===String(patient.id)).map(p=><option key={p.id} value={p.id}>{p.titolo} · {p.data}</option>)}</select><small>Dal piano: rimuovi le voci da escludere. Si salva un documento, senza duplicare il piano.</small></label>}
            <EntryRows rows={rows} onChange={setRows} pricelist={pricelist} dentist={!si?.vertical || si.vertical === 'dentistico'} name="Prestazione" allowDuplicate={false} compactTeeth collapseTeeth={fromChart || quote} newRowTooth={seedTeeth} />
            {multiTooth && <fieldset className="patient-tooth-mode"><legend>Più denti nella stessa riga</legend><div>
              <label className={perTooth ? 'is-selected' : ''}><input type="radio" name="patient-tooth-mode" checked={perTooth} onChange={()=>setPerTooth(true)} /><span>Una voce per dente<small>Prezzo per ogni dente, eseguibile dente per dente</small></span></label>
              <label className={!perTooth ? 'is-selected' : ''}><input type="radio" name="patient-tooth-mode" checked={!perTooth} onChange={()=>setPerTooth(false)} /><span>Voce unica<small>Un solo prezzo per tutti i denti (es. ponte, igiene)</small></span></label>
            </div></fieldset>}
            {toothSummary.length > 0 && <div className="patient-tooth-summary" aria-label="Riepilogo per dente"><strong>Riepilogo per dente</strong><ul>{toothSummary.map(group=><li key={group.site}><span>{group.site}</span><div>{group.items.map((item,i)=><p key={i}>{item.description}<b>{euroIt(Number(item.price) || 0)}</b></p>)}</div></li>)}</ul></div>}
            </>}
            {!quote && scopeChoices}
            {quote && <div className="quote-discount"><label>Sconto sul totale<input aria-label="Sconto sul totale" type="number" min="0" max={discountType === 'pct' ? 100 : undefined} inputMode="decimal" value={discount} placeholder="0" onChange={e=>setDiscount(e.target.value)} /></label><label>Tipo sconto<select value={discountType} onChange={e=>setDiscountType(e.target.value)}><option value="pct">%</option><option value="eur">€</option></select></label></div>}
            <details className="patient-entry-options" open={!quote && eligible.length > 1 && !planId}><summary>{quote ? 'Nome del preventivo' : 'Piano di destinazione'}</summary><div>
              {!quote && <label className="patient-entry-option-field">Salva nel piano<select value={planId} onChange={e => setPlanId(e.target.value)}><option value="">Scegli piano…</option>{eligible.map(p => <option key={p.id} value={p.id}>{p.titolo}</option>)}<option value="new">Nuovo piano</option></select></label>}
              {(quote || planId === 'new') && <label className="patient-entry-option-field">Titolo<input value={title} onChange={e => setTitle(e.target.value)} /></label>}
            </div></details>
          </fieldset>
        </>}
        {error && <p ref={errorRef} tabIndex={-1} role="alert" className="patient-entry-error">{error}</p>}
        <footer className="patient-entry-footer">
          {!success && <div className="patient-entry-summary"><span>{rowCount} {rowCount === 1 ? 'prestazione' : 'prestazioni'}<small>{quote ? 'Totale preventivo' : 'Totale nuove voci'}</small></span><strong>{euroIt(total)}</strong></div>}
          {(quote || success) && <QuoteDeliveryActions key={`${quoteScope}:${pdfPlanId && success?.savedPlans.length > 1 ? pdfPlanId : ''}`} disabled={saving || uncertain} prepare={prepareDocument} onPreview={setPdf} onBusyChange={busy=>{deliveryLock.current=busy;}} />}
          <div className="patient-entry-footer-actions">
            {typing && !success && <button type="button" className="patient-entry-keyboard" onMouseDown={e => e.preventDefault()} onClick={() => { inputRef.current?.blur(); setTyping(false); }}>Nascondi tastiera</button>}
            <button type="button" className="patient-entry-save" disabled={saving || uncertain} onClick={success ? close : quote ? () => prepareDocument().catch(e=>setError(e.message)) : () => save()}>{saving ? 'Salvataggio…' : success ? 'Torna al paziente' : quote ? 'Salva senza inviare' : 'Salva prestazioni'}<Ic n={success ? 'back' : 'ok'} s={17} c="currentColor" /></button>
          </div>
        </footer>
      </div>
    </section>
    {pdf && <PdfViewerModal titolo={pdf.titolo} dataUrl={pdf.dataUrl} filename={pdf.filename} zIndex={10001} onClose={() => setPdf(null)} />}
  </div>, document.body);
}
