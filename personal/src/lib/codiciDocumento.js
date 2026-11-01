// Owner-only Personal settings row, encrypted before leaving this browser.
// The password and decrypted codes are never persisted, logged, shared or sent to AI.
const prefix='personal:codici-documento:';
const encode=(a)=>btoa(String.fromCharCode(...a));
const decode=(s)=>Uint8Array.from(atob(s),c=>c.charCodeAt(0));
async function key(password,salt,usage) {
  if(typeof password!=='string'||password.length<12)throw new Error('Usa una password di almeno 12 caratteri per proteggere i codici.');
  const seed=await crypto.subtle.importKey('raw',new TextEncoder().encode(password),'PBKDF2',false,['deriveKey']);
  return crypto.subtle.deriveKey({name:'PBKDF2',salt,iterations:600000,hash:'SHA-256'},seed,{name:'AES-GCM',length:256},false,[usage]);
}
export async function cifraCodici(id,codes,password) {
  const salt=crypto.getRandomValues(new Uint8Array(16)),iv=crypto.getRandomValues(new Uint8Array(12));
  const clear=new TextEncoder().encode(JSON.stringify({pin:String(codes.pin||'').slice(0,64),puk:String(codes.puk||'').slice(0,64)}));
  const cipher=await crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:new TextEncoder().encode(prefix+id)},await key(password,salt,'encrypt'),clear);
  return {v:1,salt:encode(salt),iv:encode(iv),cipher:encode(new Uint8Array(cipher))};
}
export async function decifraCodici(id,value,password) {
  if(value?.v!==1)throw new Error('Formato dei codici non riconosciuto.');
  try {
    const clear=await crypto.subtle.decrypt({name:'AES-GCM',iv:decode(value.iv),additionalData:new TextEncoder().encode(prefix+id)},await key(password,decode(value.salt),'decrypt'),decode(value.cipher));
    return JSON.parse(new TextDecoder().decode(clear));
  } catch {throw new Error('Password non corretta oppure codici non leggibili. Nessun dato è stato modificato.');}
}
export async function leggiCodici(db,id) {
  const {data,error}=await db.from('impostazioni_app').select('valore,aggiornato_il').eq('chiave',prefix+id).maybeSingle();
  if(error)throw new Error(error.message);
  return data;
}
export async function salvaCodici(db,id,codes,password,revision) {
  const row={chiave:prefix+id,valore:await cifraCodici(id,codes,password),aggiornato_il:new Date().toISOString()};
  const query=revision?db.from('impostazioni_app').update(row).eq('chiave',row.chiave).eq('aggiornato_il',revision):db.from('impostazioni_app').insert(row);
  const {data,error}=await query.select('aggiornato_il').maybeSingle();
  if(error||!data)throw new Error('Codici non salvati: ricarica prima di riprovare. '+(error?.code==='23505'?'Sono già stati modificati su un altro dispositivo.':error?.message||''));
  return {aggiornato_il:data.aggiornato_il,valore:row.valore};
}
