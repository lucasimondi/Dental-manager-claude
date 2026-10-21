import React, { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase.js';
import { appointmentDocumentItems, loadAppointmentDocuments } from '../lib/appointmentDocuments.js';
import { loadPatientDocumentPdf } from '../lib/patientWorkspaceDocuments.js';
import { nomeFileDaNome } from '../lib/documenti/pdfLayout.js';
import { fmtD } from '../lib/utils.js';
const PdfViewerModal = lazy(() => import('./ui/PdfViewerModal.jsx'));

export default function AppointmentDocuments({ patient, plans, si, reloadToken, client = supabase }) {
  const [documents,setDocuments] = useState([]), [loading,setLoading] = useState(true);
  const [error,setError] = useState(''), [retry,setRetry] = useState(0);
  const [filter,setFilter] = useState('all'), [query,setQuery] = useState(''), [all,setAll] = useState(false);
  const [viewer,setViewer] = useState(null), [busy,setBusy] = useState(false);
  const mounted = useRef(true), locked = useRef(false);
  useEffect(() => { mounted.current=true; return () => { mounted.current=false; }; }, []);
  useEffect(() => {
    let active=true;
    setLoading(true);setError('');setDocuments([]);
    loadAppointmentDocuments(client,patient.id).then(rows => { if(active)setDocuments(rows); })
      .catch(() => { if(active)setError('Archivio non disponibile. Riprova.'); })
      .finally(() => { if(active)setLoading(false); });
    return () => { active=false; };
  }, [client,patient.id,reloadToken,retry]);
  const items=appointmentDocumentItems(plans,documents,patient.id).filter(item =>
    (filter==='all' || item.category===filter) && `${item.title} ${item.type}`.toLocaleLowerCase('it-IT').includes(query.trim().toLocaleLowerCase('it-IT')));
  const open = async item => {
    if(locked.current)return;
    locked.current=true;setBusy(true);setError('');
    try {
      let pdf;
      if(item.plan) {
        const {buildPreventivoPdf}=await import('../lib/documenti/preventivoPdf.js');
        pdf=buildPreventivoPdf({si,paziente:patient,piano:item.plan});
      } else pdf={titolo:item.title,filename:nomeFileDaNome(item.patientName),dataUrl:await loadPatientDocumentPdf(client,item.document)};
      if(mounted.current)setViewer(pdf);
    } catch { if(mounted.current)setError('Impossibile aprire il PDF. Riprova.'); }
    finally { locked.current=false;if(mounted.current)setBusy(false); }
  };
  return <section className="appointment-documents" aria-label="Documenti del paziente">
    <h2>Documenti del paziente</h2>
    <div className="appointment-document-filters" role="group" aria-label="Filtra documenti">{[['all','Tutti'],['quotes','Preventivi'],['prescriptions','Ricette']].map(([id,label])=><button type="button" key={id} aria-pressed={filter===id} onClick={()=>{setFilter(id);setAll(false);}}>{label}</button>)}</div>
    <input className="appointment-document-search" aria-label="Cerca nei documenti" placeholder="Cerca per titolo…" value={query} onChange={e=>{setQuery(e.target.value);setAll(false);}} />
    {loading && <p role="status">Caricamento archivio…</p>}
    {error && <p role="alert">{error} <button type="button" onClick={()=>setRetry(v=>v+1)}>Riprova</button></p>}
    {!items.length && !loading && !error && <p>Nessun documento trovato.</p>}
    {(all?items:items.slice(0,3)).map(item=><button type="button" className="appointment-document-row" key={item.key} disabled={busy} onClick={()=>open(item)} aria-label={`Apri ${item.title}`}><span><strong>{item.title}</strong><small>{item.type} · {fmtD(item.date)}</small></span><span>Apri PDF</span></button>)}
    {!all && items.length>3 && <button type="button" className="appointment-text-button" onClick={()=>setAll(true)}>Mostra tutti ({items.length})</button>}
    {viewer && <Suspense fallback={<p role="status">Apertura PDF…</p>}><PdfViewerModal {...viewer} zIndex={11000} onClose={()=>setViewer(null)} /></Suspense>}
  </section>;
}
