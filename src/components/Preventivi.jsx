import React, { lazy, Suspense, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase.js';
import { listPreventivi, loadPreventivo, archiveQuoteRow, quoteTotal } from '../lib/preventivi.js';
import { euroIt } from '../lib/documenti/preventivoPdf.js';
import QuoteDeliveryActions from './QuoteDeliveryActions.jsx';
import './Preventivi.css';
const PatientPlanEntry = lazy(() => import('./PatientPlanEntry.jsx'));
const PdfViewerModal = lazy(() => import('./ui/PdfViewerModal.jsx'));

export default function Preventivi({ patients = [], plans = [], pricelist = [], si, onSave, patient, client = supabase, autoOpenNew, onAutoOpenNewHandled }) {
  const [rows,setRows] = useState([]), [query,setQuery] = useState(''), [search,setSearch] = useState(''), [archived,setArchived] = useState(false);
  const [loading,setLoading] = useState(true), [error,setError] = useState(''), [retry,setRetry] = useState(0);
  const [creating,setCreating] = useState(false), [selected,setSelected] = useState(''), [editor,setEditor] = useState(null), [versionSource,setVersionSource] = useState(null), [viewer,setViewer] = useState(null);
  useEffect(()=>{if(autoOpenNew){setCreating(true);onAutoOpenNewHandled?.();}},[autoOpenNew,onAutoOpenNewHandled]);
  const [offset,setOffset] = useState(0), [more,setMore] = useState(false), [working,setWorking] = useState(false);
  useEffect(()=>{const timer=setTimeout(()=>{setOffset(0);setSearch(query);},250);return()=>clearTimeout(timer);},[query]);
  useEffect(() => {
    let active = true; setLoading(true); setError('');
    listPreventivi(client, { patientId: patient?.id, archived, offset, query: search }).then(data => {
      if (!active) return;
      setRows(current => offset ? [...current,...data] : data); setMore(data.length === 50);
    }).catch(e => { if(active)setError(e.message); }).finally(()=>{if(active)setLoading(false);});
    return () => { active=false; };
  }, [client,patient?.id,archived,offset,retry,search]);
  const refresh = () => { setOffset(0); setRetry(v=>v+1); };
  const openEditor = (p,source = null) => { setEditor(p); setVersionSource(source); setCreating(false); };
  const toggle = async row => {
    if(working)return;setWorking(true);setError('');
    try { await archiveQuoteRow(client,row.id,!archived);refresh(); }
    catch(e) { setError(e.message); } finally {setWorking(false);}
  };
  const open = async row => {
    if(working)return;setWorking(true);setError('');
    try { setViewer(await loadPreventivo(client,row.id)); }
    catch(e) {setError(e.message);} finally {setWorking(false);}
  };
  const visible = rows;
  return <section className="quotes-page" aria-label="Preventivi">
    <header className="quotes-heading"><div><small>DOCUMENTI DELLO STUDIO</small><h2>Preventivi</h2><p>{patient ? `${patient.nome} ${patient.cognome}` : 'PDF salvati, pronti da inviare di nuovo.'}</p></div>{onSave && <button type="button" onClick={()=>patient ? openEditor(patient) : setCreating(v=>!v)}>+ Nuovo</button>}</header>
    {creating && <div className="quote-select-patient"><label>Paziente<select value={selected} onChange={e=>{setSelected(e.target.value);const p=patients.find(p=>String(p.id)===e.target.value);if(p)openEditor(p);}}><option value="">Scegli il paziente…</option>{patients.map(p=><option key={p.id} value={p.id}>{p.nome} {p.cognome}</option>)}</select></label></div>}
    <div className="quotes-tools"><input aria-label="Cerca preventivi" placeholder="Paziente, numero, data o titolo…" value={query} onChange={e=>setQuery(e.target.value)} /><button type="button" aria-pressed={archived} onClick={()=>{setArchived(v=>!v);setRows([]);setOffset(0);}}>{archived ? 'Mostra attivi' : 'Archivio'}</button></div>
    {error && <p role="alert">{error} <button type="button" onClick={refresh}>Riprova</button></p>}
    {loading && <p role="status">Caricamento preventivi…</p>}
    {!loading && !error && !visible.length && <div className="quotes-empty">Nessun preventivo trovato.{!archived && <p>Crea un preventivo oppure usa Invia PDF su un piano esistente.</p>}</div>}
    <div className="quotes-list">{visible.map(row=><article className="quote-card" key={row.id}>
      <div className="quote-card-top"><div><small>N° {row.numero} · {new Date(`${row.data}T12:00`).toLocaleDateString('it-IT')}</small><h3>{row.paziente_nome}</h3><p>{row.titolo}</p></div><strong>{euroIt(quoteTotal(row))}</strong></div>
      <QuoteDeliveryActions prepare={()=>loadPreventivo(client,row.id)} onPreview={setViewer} />
      <div className="quote-card-menu"><button type="button" disabled={working} onClick={()=>open(row)}>Apri PDF</button><button type="button" disabled={working || !row.piano_id || !(patient || patients.find(p=>String(p.id)===String(row.paziente_id)))} onClick={()=>openEditor(patient || patients.find(p=>String(p.id)===String(row.paziente_id)), row.plan_snapshot)}>Modifica / nuova versione</button><button type="button" disabled={working} onClick={()=>toggle(row)}>{archived ? 'Ripristina' : 'Archivia'}</button></div>
    </article>)}</div>
    {more && <button type="button" disabled={loading} onClick={()=>setOffset(v=>v+50)}>Carica altri</button>}
    {editor && <Suspense fallback={<p role="status">Apertura preventivo…</p>}><PatientPlanEntry patient={editor} sourcePlan={versionSource} mode="quote" plans={plans} pricelist={pricelist} si={si} documentClient={client} onSave={onSave ? draft=>onSave(editor,draft) : undefined} onClose={()=>{setEditor(null);refresh();}} /></Suspense>}
    {viewer && <Suspense fallback={null}><PdfViewerModal {...viewer} zIndex={12000} onClose={()=>setViewer(null)} /></Suspense>}
  </section>;
}
