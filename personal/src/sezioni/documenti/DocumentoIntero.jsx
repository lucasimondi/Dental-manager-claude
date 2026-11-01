import {useEffect,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import {Anteprima} from './AnteprimaDocumento.jsx';
import {preparaFile,comeFile,scaricaDocumento} from '../../lib/condividi.js';
import {BottoneCondividi,titoloDoc,tokenSessione} from '../../ui.jsx';
export function DocumentoIntero({doc,onInfo,onChiudi,mostra}) {
 const container=useRef(null),[file,setFile]=useState(null),[error,setError]=useState('');
 useEffect(()=>{let active=true;(async()=>{try{const f=comeFile(await preparaFile(doc.drive_file_id,await tokenSessione()));if(active)setFile(f);}catch(e){if(active)setError(e.message);}})();return()=>{active=false;};},[doc.drive_file_id]);
 useEffect(()=>{
  const old=document.activeElement,app=document.querySelector('.pp-app'),overflow=document.body.style.overflow;
  document.body.style.overflow='hidden';if(app)app.inert=true;container.current?.querySelector('button')?.focus();
  const key=e=>{if(e.key==='Escape'){e.preventDefault();onChiudi();}if(e.key==='Tab'){const elements=Array.from(container.current.querySelectorAll('button:not(:disabled),a[href]'));const first=elements[0],last=elements.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus();}}};
  document.addEventListener('keydown',key);return()=>{document.body.style.overflow=overflow;if(app)app.inert=false;document.removeEventListener('keydown',key);old?.focus?.({preventScroll:true});};
 },[onChiudi]);
 return createPortal(<div ref={container} className="pp-documento-intero" role="dialog" aria-modal="true" aria-label={titoloDoc(doc)}>
  <header><button onClick={onChiudi} aria-label="Chiudi documento">Chiudi</button><strong>{titoloDoc(doc)}</strong><button onClick={onInfo}>Info</button></header>
  <div className="pp-documento-tavola"><Anteprima doc={doc}/></div>
  <footer><BottoneCondividi doc={doc} mostra={mostra}/><button className="pp-bottone" disabled={!file} onClick={()=>scaricaDocumento(file)}>Scarica per allegare</button>{doc.drive_url&&<a className="pp-bottone" href={doc.drive_url} target="_blank" rel="noreferrer">Apri originale</a>}</footer>
  {error&&<p role="alert">{error}</p>}
 </div>,document.body);
}
