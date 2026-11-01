import {useEffect,useState} from 'react';
import {archivioDb} from '../../lib/supabasePersonal.js';
import {scadenzeAperte} from '../../lib/archivio.js';
import {scadenzaIdentita,storicoPersonale} from '../../lib/portafoglio.js';
import {Sezione,dataBreve} from '../../ui.jsx';
export function ScadenzePersonali({ctx}) {
 const [elenco,setElenco]=useState([]);
 useEffect(()=>{let active=true;scadenzeAperte(archivioDb,90).then(xs=>{if(active)setElenco(xs.filter(s=>scadenzaIdentita(s)&&!storicoPersonale(s.documento)));}).catch(()=>{});return()=>{active=false;};},[ctx.versione]);
 if(!elenco.length)return null;
 return <Sezione titolo="Documenti da rinnovare">{elenco.map(s=><button key={s.id} className="pp-riga" onClick={()=>ctx.apri({tipo:'documento',id:s.documento_id})}><span className="pp-riga-testo"><strong>{s.documento?.titolo||s.descrizione}</strong><span className="pp-riga-meta">Scadenza · {dataBreve(s.data)}</span></span></button>)}</Sezione>;
}
