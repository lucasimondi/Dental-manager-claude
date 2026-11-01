import {useEffect,useState} from 'react';
import {archivioDb} from '../../lib/supabasePersonal.js';
import {leggiCodici,decifraCodici,salvaCodici} from '../../lib/codiciDocumento.js';
export function CodiciDocumento({id}) {
 const [row,setRow]=useState(undefined),[password,setPassword]=useState(''),[codes,setCodes]=useState(null),[visible,setVisible]=useState(false),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
 const blocca=()=>{setPassword('');setCodes(null);setVisible(false);setMessage('');};
 useEffect(()=>{let active=true;leggiCodici(archivioDb,id).then(r=>{if(active)setRow(r);}).catch(()=>{if(active)setMessage('Impossibile caricare i codici.');});return()=>{active=false;};},[id]);
 useEffect(()=>{const hide=()=>{if(document.hidden)blocca();};document.addEventListener('visibilitychange',hide);return()=>document.removeEventListener('visibilitychange',hide);},[]);
 const sblocca=async()=>{setBusy(true);setMessage('');try{setCodes(row?await decifraCodici(id,row.valore,password):{pin:'',puk:''});}catch(e){setMessage(e.message);}finally{setBusy(false);}};
 const salva=async()=>{setBusy(true);setMessage('');try{const saved=await salvaCodici(archivioDb,id,codes,password,row?.aggiornato_il);setRow(saved);blocca();setMessage('Codici salvati e bloccati.');}catch(e){setMessage(e.message);}finally{setBusy(false);}};
 return <section className="pp-codici"><h3>PIN e PUK protetti</h3>
 <p className="pp-riga-meta">Cifrati con una password scelta da te. Non vengono inclusi nei file condivisi. Conserva la password: senza non posso recuperare i codici.</p>
 {!codes?<><label className="pp-campo">{row?'Password dei codici':'Scegli la password dei codici'}<input type="password" autoComplete="off" value={password} minLength={12} onChange={e=>setPassword(e.target.value)}/></label><button className="pp-bottone" disabled={busy||row===undefined||password.length<12} onClick={sblocca}>{row?'Sblocca':'Inserisci PIN e PUK'}</button></>:<>
 {['pin','puk'].map(k=><label key={k} className="pp-campo">{k.toUpperCase()}<input type={visible?'text':'password'} autoComplete="off" maxLength={64} value={codes[k]} onChange={e=>setCodes({...codes,[k]:e.target.value})}/></label>)}
 <label><input type="checkbox" checked={visible} onChange={e=>setVisible(e.target.checked)}/> Mostra codici</label>
 <div className="pp-azioni"><button className="pp-bottone" disabled={busy} onClick={salva}>Salva codici</button><button className="pp-bottone pp-bottone-chiaro" disabled={busy} onClick={blocca}>Blocca senza salvare</button></div>
 </>}{message&&<p role="status">{message}</p>}</section>;
}
