// POL-AI-010 passo 4b — preventivi e piani di cura dalla chat di Poliedron.
// I piani creati qui hanno lo stesso shape di Piani.jsx e sono SEMPRE
// confermati prima della scrittura.
import { studioToday } from './confirmation.js';

export const PIANI_WRITES = new Set(['crea_piano_cura']);

export const PIANI_TOOLS = [{
  name: 'crea_piano_cura',
  description: "Crea un preventivo/piano di cura per un paziente. Cerca prima il paziente con cerca_pazienti. Se l'utente cita prestazioni del listino, usa catalogo_prestazioni e i prezzi reali; non inventare prezzi. Per una voce libera esplicitamente dettata dall'utente puoi usare nome e prezzo forniti dall'utente. Mostra sempre un riepilogo e attendi Conferma: non dire che il piano è salvato prima della conferma.",
  input_schema: {
    type: 'object',
    properties: {
      paziente_id: { type: 'integer' },
      titolo: { type: 'string' },
      data: { type: 'string', description: 'YYYY-MM-DD, default oggi.' },
      voci: { type: 'array', items: { type: 'object', properties: {
        prestazione: { type: 'string' }, prezzo: { type: 'number' },
        dente: { type: 'string' },
      }, required: ['prestazione','prezzo'] } },
      sconto: { type: 'number', description: '0 o maggiore.' },
      sconto_tipo: { type: 'string', enum: ['pct','valore'] },
      scadenza_pagamento: { type: 'string', description: 'YYYY-MM-DD, facoltativa.' },
    },
    required: ['paziente_id','titolo','voci'],
  },
}];

const RE_DATA=/^\d{4}-\d{2}-\d{2}$/;
const validaData=(s)=>RE_DATA.test(s||'') && new Date(s+'T12:00:00Z').toISOString().slice(0,10)===s;
const euro=(n)=>new Intl.NumberFormat('it-IT',{style:'currency',currency:'EUR'}).format(n);
const MAX_VOCI=100;
const MAX_PREZZO=1_000_000;

function numeroEuro(v, campo='Prezzo') {
  const n=Number(v);
  if(!Number.isFinite(n)||n<0||n>MAX_PREZZO) throw new Error(campo+' non valido.');
  return Math.round(n*100)/100;
}
function totale(voci,sconto,tipo){
  const sub=voci.reduce((a,v)=>a+v.prezzo,0);
  const rid=tipo==='valore'?Math.min(sconto,sub):sub*(sconto/100);
  return {sub, finale:Math.max(0,Math.round((sub-rid)*100)/100)};
}

export async function preparePiani(client,name,input={},studioId,observed){
  if(name!=='crea_piano_cura') throw new Error('Azione non supportata');
  if(!observed.patients.has(input.paziente_id)) throw new Error('Cerca prima il paziente e chiedi quale scegliere in caso di omonimia.');
  const titolo=String(input.titolo||'').trim().slice(0,160);
  if(!titolo) throw new Error('Titolo del piano mancante.');
  if(!Array.isArray(input.voci)||!input.voci.length||input.voci.length>MAX_VOCI) throw new Error('Il piano deve contenere da 1 a 100 prestazioni.');
  const voci=input.voci.map((v)=>{
    const prestazione=String(v?.prestazione||'').trim().slice(0,200);
    if(!prestazione) throw new Error('Una prestazione non ha un nome.');
    return {prestazione, dente:v?.dente?String(v.dente).trim().slice(0,30):'', prezzo:numeroEuro(v.prezzo), eseguita:false, incassata:false};
  });
  const sconto=numeroEuro(input.sconto??0,'Sconto');
  const scontoTipo=input.sconto_tipo??'pct';
  if(!['pct','valore'].includes(scontoTipo)||(scontoTipo==='pct'&&sconto>100)) throw new Error('Sconto non valido.');
  const data=input.data??studioToday();
  if(!validaData(data)) throw new Error('Data del piano non valida.');
  const scadenza=input.scadenza_pagamento||'';
  if(scadenza&&!validaData(scadenza)) throw new Error('Scadenza pagamento non valida.');

  const [{data:paz,error:ep},{data:simili,error:es}]=await Promise.all([
    client.from('patients').select('id, nome, cognome').eq('studio_id',studioId).eq('id',input.paziente_id).single(),
    client.from('plans').select('id, titolo, data, stato').eq('studio_id',studioId).eq('paziente_id',input.paziente_id).eq('titolo',titolo).limit(3),
  ]);
  if(ep||!paz) throw new Error('Paziente non disponibile o accesso non consentito.');
  if(es) throw new Error('Non riesco a verificare i piani esistenti. Nessuna modifica eseguita.');
  const t=totale(voci,sconto,scontoTipo);
  const chi=`${paz.nome||''} ${paz.cognome||''}`.trim();
  const dati={paziente_id:paz.id,titolo,data,voci,stato:'attivo',sconto,sconto_tipo:scontoTipo,scadenza_pagamento:scadenza||null};
  const righe=voci.map((v,i)=>`${i+1}. ${v.prestazione}${v.dente?` — dente ${v.dente}`:''}: ${euro(v.prezzo)}`);
  const corpo=[`Paziente: ${chi}`,`Piano: ${titolo}`,...righe,`Subtotale: ${euro(t.sub)}`,sconto?`Sconto: ${scontoTipo==='pct'?sconto+'%':euro(sconto)}`:null,`Totale: ${euro(t.finale)}`,scadenza?`Scadenza pagamento: ${scadenza}`:null].filter(Boolean).join('\n');
  const avviso=simili?.length?`Attenzione: ${chi} ha già un piano chiamato “${titolo}”.`:null;
  return {dati,avviso,confermaSempre:true,summary:`Crea piano di cura\n${corpo}${avviso?`\n${avviso}`:''}`,done:`Piano di cura creato\n${corpo}`};
}

export const nuovoIdPiano=()=>Date.now()+Math.floor(Math.random()*99999);

export async function executePiani(client,proposal){
  const {error:claim}=await client.from('poliedron_action_claims').insert({id:proposal.id,studio_id:proposal.studioId,user_id:proposal.userId});
  if(claim?.code==='23505') throw new Error('Questa conferma è già stata usata.');
  if(claim) throw new Error('Impossibile acquisire la conferma. Nessun piano creato.');
  const {data,error}=await client.from('plans').insert({id:nuovoIdPiano(),...proposal.piani.dati,studio_id:proposal.studioId,user_id:proposal.userId}).select().single();
  if(error||!data) throw new Error(error?.message||'errore sconosciuto.');
  return {text:`Fatto. ${proposal.piani.done}`,changed:['plans'],recordId:data.id,records:{plans:[data]}};
}
