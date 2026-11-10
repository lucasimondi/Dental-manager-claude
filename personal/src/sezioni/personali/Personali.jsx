// Only current household identity/personal documents, never ordinary photographs.
import { useEffect, useMemo, useState } from 'react';
import { archivioDb } from '../../lib/supabasePersonal.js';
import { documentiPersonali } from '../../lib/archivio.js';
import { categoriaDi, personaDi } from '../../lib/impostazioni.js';
import { documentoDaPersonal, avvisoDocumento } from '../../lib/portafoglio.js';
import { preparaFile, comeFile, condividi, scaricaDocumento } from '../../lib/condividi.js';
import { dataBreve, titoloDoc, Sezione, Chips, tokenSessione } from '../../ui.jsx';
import { Miniatura } from '../../Miniatura.jsx';
import { IconaPiu, IconaFreccia, IconaCuore } from '../../Icone.jsx';

export function VistaPersonali({ctx}) {
  const {esegui,apri,versione,impostazioni}=ctx;
  const {persone,categorie}=impostazioni;
  const [docs,setDocs]=useState(null),[scheda,setScheda]=useState('tutti'),[scelti,setScelti]=useState([]),[files,setFiles]=useState(null);
  useEffect(()=>{let active=true;esegui(async()=>{const data=await documentiPersonali(archivioDb);if(active)setDocs(data);});return()=>{active=false;};},[esegui,versione]);
  const arr=useMemo(()=>(docs||[]).map(d=>({...d,_cat:categoriaDi(d,categorie),_persona:personaDi(d,persone)})),[docs,categorie,persone]);
  const attivi=arr.filter(d=>documentoDaPersonal(d,d._cat)&&persone.includes(d._persona));
  const disponibili=attivi.map(d=>d.id).sort().join(',');
  useEffect(()=>{const ids=new Set(disponibili.split(','));setScelti(xs=>{const validi=xs.filter(id=>ids.has(id));return validi.length===xs.length?xs:validi;});},[disponibili]);
  const key=scelti.slice().sort().join(',');
  useEffect(()=>{
    setFiles(null);let active=true;
    const selected=attivi.filter(d=>scelti.includes(d.id));
    if(!selected.length||selected.length>10)return;
    (async()=>{try{const token=await tokenSessione();const fs=await Promise.all(selected.map(d=>preparaFile(d.drive_file_id,token).then(comeFile)));if(active)setFiles({key,fs});}catch{if(active)setFiles({key,error:true});}})();
    return()=>{active=false;};
  },[key,docs]); // Selected originals are prepared before the share gesture.
  const invia=async()=>{try{const result=await condividi({titolo:'Documenti personali',files:files.fs});if(result==='non_disponibile')ctx.mostra('Scegli Scarica sul documento, poi allega da Download o Drive nella tua app mail.');}catch(e){ctx.mostra(e.message);}};
  if(!docs)return null;
  return <>
    <Chips voci={[["tutti","Tutti"],...categorie.map(c=>[c.id,c.nome])]} attiva={scheda} onScegli={setScheda}/>
    <button className="pp-invito pp-invito-salute" onClick={()=>apri({tipo:'salute'})}><IconaCuore size={22}/><span><strong>La mia salute ed esami</strong><br/>Referti, esami e ricette: selezionali e inviali insieme</span><IconaFreccia size={16}/></button>
    <p className="pp-riga-meta">Seleziona carta d'identità e codice fiscale per inviarli insieme.</p>
    {persone.map(persona=>{
      const elenco=attivi.filter(d=>d._persona===persona&&(scheda==='tutti'||d._cat===scheda));
      return <Sezione key={persona} titolo={persona}>
        <div className="pp-carte pp-portafoglio-carte">
          {elenco.map(d=>{const avviso=avvisoDocumento(d);return <article className="pp-personal-card" key={d.id}>
            <button className="pp-personal-apri" onClick={()=>apri({tipo:'documento',id:d.id})}>
              <Miniatura doc={d} grande/>
              <strong>{categorie.find(c=>c.id===d._cat)?.nome||titoloDoc(d)}</strong>
              <span>{titoloDoc(d)}</span>
              {avviso&&<span className={'pp-validita '+avviso.stato}>{avviso.testo} · {dataBreve(avviso.data)}</span>}
            </button>
            <label className="pp-personal-seleziona"><input type="checkbox" checked={scelti.includes(d.id)} disabled={!scelti.includes(d.id)&&scelti.length>=10} onChange={()=>setScelti(xs=>xs.includes(d.id)?xs.filter(id=>id!==d.id):[...xs,d.id])}/>Seleziona per inviare</label>
          </article>;})}
          <button className="pp-carta pp-carta-nuova" onClick={()=>apri({tipo:'carica',opzioni:{persona,categoria:scheda==='tutti'?null:scheda,fascicolo:'identita',portafoglio:true}})}><IconaPiu size={24}/><span>Aggiungi documento</span></button>
        </div>
      </Sezione>;
    })}
    {scelti.length>0&&<div className="pp-personal-invio" role="region" aria-label="Invia documenti insieme">
      <strong>{scelti.length} documenti selezionati</strong>
      <button className="pp-bottone" disabled={!files||files.key!==key||files.error} onClick={invia}>{!files?'Preparo i file…':'Invia insieme · Mail / WhatsApp'}</button>
      {files?.error&&<p role="alert">File non disponibili. Riprova dalla scheda del documento.</p>}
      {files?.fs?.map((file,i)=><button key={i} className="pp-testo-link" onClick={()=>scaricaDocumento(file)}>Scarica {file.name}</button>)}
      <button className="pp-testo-link" onClick={()=>setScelti([])}>Annulla selezione</button>
      <small>Dal pulsante Allega della mail puoi scegliere le copie in Download oppure Drive → Archivio personale.</small>
    </div>}
  </>;
}
