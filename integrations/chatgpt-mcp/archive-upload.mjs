import {prepareArchive} from './classification.mjs';

// Reuses the existing Google Apps Script: it creates the Drive file and the canonical
// documenti record. Do not write to the alternative poliedron_documenti_personali table.
export const DEFAULT_MAX_BYTES = 4 * 1024 * 1024;
const ALLOWED_MIME = new Set(['application/pdf','image/jpeg','image/png','image/webp']);
export function validateUpload({filename,mime,base64,description='',fascicolo,confirm=false},maxBytes=DEFAULT_MAX_BYTES) {
  const proposal=prepareArchive({filename,description,fascicolo});
  if(!confirm) throw Error('Explicit confirmation required');
  if(!ALLOWED_MIME.has(mime)) throw Error('Unsupported file type');
  if(typeof base64!=='string'||!base64.length||base64.length>Math.ceil(maxBytes/3)*4+8||!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(base64)) throw Error('Invalid file data');
  const size=Buffer.byteLength(base64,'base64');
  if(size===0||size>maxBytes) throw Error('File too large');
  return {proposal,size};
}
export async function uploadToCanonicalArchive({token,filename,mime,base64,description='',fascicolo,confirm=false}, {endpoint,fetchImpl=fetch}={}) {
  if(typeof token!=='string'||!token) throw Error('Authentication required');
  if(!endpoint||new URL(endpoint).protocol!=='https:') throw Error('Secure archive endpoint required');
  const {proposal}=validateUpload({filename,mime,base64,description,fascicolo,confirm});
  const response=await fetchImpl(endpoint,{
    method:'POST',redirect:'follow',
    headers:{'content-type':'text/plain;charset=utf-8'},
    body:JSON.stringify({token,dati:base64,nome:filename,mime,descrizione:description,fascicolo:proposal.fascicolo,portafoglio:false,nonAnalizzare:false,persona:null,categoria:null})
  });
  if(!response.ok) throw Error('Archive upload failed');
  let data;try{data=await response.json();}catch{throw Error('Invalid archive response');}
  if(data?.ok!==true)throw Error('Archive upload rejected');
  return {uploaded:true,registered:true,fascicolo:proposal.fascicolo,result:data};
}
