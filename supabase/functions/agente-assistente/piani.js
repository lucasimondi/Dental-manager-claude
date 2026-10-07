// POL-AI-010 passo 4b — preventivi e piani di cura dalla chat di Poliedron.
// I piani hanno lo stesso shape di Piani.jsx. Safe Autonomy: le azioni non
// distruttive e univoche si eseguono direttamente; conflitti/duplicati
// fermano il flusso e richiedono conferma o chiarimento.
import { studioToday } from './confirmation.js';

export const PIANI_WRITES = new Set(['crea_piano_cura','imposta_stato_piano','segna_prestazione_eseguita','aggiungi_prestazione_piano']);

export const PIANI_TOOLS = [{
  name: 'crea_piano_cura',
  description: "Crea un preventivo/piano di cura per un paziente. Cerca prima il paziente con cerca_pazienti. Se l'utente cita prestazioni del listino, usa catalogo_prestazioni e i prezzi reali; non inventare prezzi. Per una voce libera esplicitamente dettata dall'utente puoi usare nome e prezzo forniti dall'utente. Se paziente, prestazioni e prezzi sono verificati e non ci sono conflitti, esegui direttamente; in caso di dubbio fermati e chiedi.",
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
},
{
  name:'imposta_stato_piano',
  description:"Accetta o rifiuta un piano di cura esistente. Prima usa storico_paziente per leggere i piani reali e ottenere il piano_id. Non indovinare l'ID. Se piano e stato sono univoci, esegui direttamente; in caso di dubbio fermati e chiedi.",
  input_schema:{type:'object',properties:{paziente_id:{type:'integer'},piano_id:{type:'integer'},stato:{type:'string',enum:['accettato','rifiutato']}},required:['paziente_id','piano_id','stato']}
},
{
  name:'segna_prestazione_eseguita',
  description:"Segna come eseguita una prestazione di un piano esistente. Prima usa storico_paziente e identifica senza ambiguità piano e prestazione; usa voce_index restituito dall'elenco (indice a partire da 0). Non usare per annullare una prestazione già eseguita. Se piano e prestazione sono univoci, esegui direttamente; in caso di dubbio fermati e chiedi.",
  input_schema:{type:'object',properties:{paziente_id:{type:'integer'},piano_id:{type:'integer'},voce_index:{type:'integer',minimum:0}},required:['paziente_id','piano_id','voce_index']}
},
{
  name:'aggiungi_prestazione_piano',
  description:"Aggiunge una prestazione a un piano di cura esistente. Prima usa storico_paziente per ottenere il piano_id reale. Per una prestazione di listino usa catalogo_prestazioni e il prezzo reale; non inventare prezzi. Se paziente, piano, prestazione e prezzo sono univoci esegui direttamente. Se il piano è ambiguo, il prezzo manca o esiste una possibile voce duplicata, fermati e chiedi.",
  input_schema:{type:'object',properties:{paziente_id:{type:'integer'},piano_id:{type:'integer'},prestazione:{type:'string'},prezzo:{type:'number'},dente:{type:'string'}},required:['paziente_id','piano_id','prestazione','prezzo']}
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
  if(!PIANI_WRITES.has(name)) throw new Error('Azione non supportata');
  if(!observed.patients.has(input.paziente_id)) throw new Error('Cerca prima il paziente e chiedi quale scegliere in caso di omonimia.');

  const {data:paz,error:ep}=await client.from('patients').select('id, nome, cognome').eq('studio_id',studioId).eq('id',input.paziente_id).single();
  if(ep||!paz) throw new Error('Paziente non disponibile o accesso non consentito.');
  const chi=`${paz.nome||''} ${paz.cognome||''}`.trim();

  if(name==='crea_piano_cura'){
    const titolo=String(input.titolo||'').trim().slice(0,160);
    if(!titolo) throw new Error('Titolo del piano mancante.');
    if(!Array.isArray(input.voci)||!input.voci.length||input.voci.length>MAX_VOCI) throw new Error('Il piano deve contenere da 1 a 100 prestazioni.');
    const voci=input.voci.map((v)=>{
      const prestazione=String(v?.prestazione||'').trim().slice(0,200);
      if(!prestazione) throw new Error('Una prestazione non ha un nome.');
      return {prestazione,dente:v?.dente?String(v.dente).trim().slice(0,30):'',prezzo:numeroEuro(v.prezzo),eseguita:false,incassata:false};
    });
    const sconto=numeroEuro(input.sconto??0,'Sconto'), scontoTipo=input.sconto_tipo??'pct';
    if(!['pct','valore'].includes(scontoTipo)||(scontoTipo==='pct'&&sconto>100)) throw new Error('Sconto non valido.');
    const data=input.data??studioToday(); if(!validaData(data)) throw new Error('Data del piano non valida.');
    const scadenza=input.scadenza_pagamento||''; if(scadenza&&!validaData(scadenza)) throw new Error('Scadenza pagamento non valida.');
    const {data:simili,error:es}=await client.from('plans').select('id, titolo, data, stato').eq('studio_id',studioId).eq('paziente_id',paz.id).eq('titolo',titolo).limit(3);
    if(es) throw new Error('Non riesco a verificare i piani esistenti. Nessuna modifica eseguita.');
    const t=totale(voci,sconto,scontoTipo);
    const dati={paziente_id:paz.id,titolo,data,voci,stato:'attivo',sconto,sconto_tipo:scontoTipo,scadenza_pagamento:scadenza||null};
    const righe=voci.map((v,i)=>`${i+1}. ${v.prestazione}${v.dente?` — dente ${v.dente}`:''}: ${euro(v.prezzo)}`);
    const corpo=[`Paziente: ${chi}`,`Piano: ${titolo}`,...righe,`Subtotale: ${euro(t.sub)}`,sconto?`Sconto: ${scontoTipo==='pct'?sconto+'%':euro(sconto)}`:null,`Totale: ${euro(t.finale)}`,scadenza?`Scadenza pagamento: ${scadenza}`:null].filter(Boolean).join('\n');
    const avviso=simili?.length?`Attenzione: ${chi} ha già un piano chiamato “${titolo}”.`:null;
    return {dati,avviso,summary:`Crea piano di cura\n${corpo}${avviso?`\n${avviso}`:''}`,done:`Piano di cura creato\n${corpo}`};
  }

  const {data:plan,error:epl}=await client.from('plans').select('id, paziente_id, titolo, stato, voci, sconto, sconto_tipo').eq('studio_id',studioId).eq('id',input.piano_id).eq('paziente_id',paz.id).single();
  if(epl||!plan) throw new Error('Piano non trovato per questo paziente. Leggi prima lo storico del paziente.');

  if(name==='aggiungi_prestazione_piano'){
    const prestazione=String(input.prestazione||'').trim().slice(0,200);
    if(!prestazione) throw new Error('Prestazione mancante.');
    const prezzo=numeroEuro(input.prezzo);
    const dente=input.dente?String(input.dente).trim().slice(0,30):'';
    const duplicata=(plan.voci||[]).find((v)=>String(v.prestazione||'').trim().toLocaleLowerCase('it-IT')===prestazione.toLocaleLowerCase('it-IT') && String(v.dente||'')===dente);
    const nuova={prestazione,dente,prezzo,eseguita:false,incassata:false};
    const nuove=[...(plan.voci||[]),nuova];
    const corpo=`Paziente: ${chi}\nPiano: ${plan.titolo}\nPrestazione: ${prestazione}${dente?` — dente ${dente}`:''}\nPrezzo: ${euro(prezzo)}`;
    return {
      dati:{piano_id:plan.id,voci:nuove}, before:{voci:plan.voci||[]},
      avviso:duplicata?`Attenzione: nel piano “${plan.titolo}” esiste già “${prestazione}”${dente?` sul dente ${dente}`:''}.`:null,
      summary:`Aggiungi prestazione\n${corpo}`, done:`Prestazione aggiunta\n${corpo}`,
    };
  }

  if(name==='imposta_stato_piano'){
    if(!['accettato','rifiutato'].includes(input.stato)) throw new Error('Stato non valido.');
    if(plan.stato===input.stato) throw new Error(`Il piano è già ${input.stato}.`);
    const corpo=`Paziente: ${chi}\nPiano: ${plan.titolo}\nStato: ${plan.stato||'attivo'} → ${input.stato}`;
    return {dati:{piano_id:plan.id,stato:input.stato},before:{stato:plan.stato||'attivo'},summary:`Aggiorna piano di cura\n${corpo}`,done:`Piano aggiornato\n${corpo}`};
  }

  const idx=Number(input.voce_index);
  if(!Number.isInteger(idx)||idx<0||!Array.isArray(plan.voci)||!plan.voci[idx]) throw new Error('Prestazione non trovata nel piano.');
  const voce=plan.voci[idx];
  if(voce.eseguita===true) throw new Error('Questa prestazione risulta già eseguita.');
  const nuove=plan.voci.map((v,i)=>i===idx?{...v,eseguita:true,dataEsec:studioToday()}:v);
  const corpo=`Paziente: ${chi}\nPiano: ${plan.titolo}\nPrestazione: ${voce.prestazione}${voce.dente?` — dente ${voce.dente}`:''}`;
  return {dati:{piano_id:plan.id,voci:nuove},before:{voci:plan.voci},summary:`Segna prestazione eseguita\n${corpo}`,done:`Prestazione segnata come eseguita\n${corpo}`};
}
export const nuovoIdPiano=()=>Date.now()+Math.floor(Math.random()*99999);

export async function executePiani(client,proposal){
  const {error:claim}=await client.from('poliedron_action_claims').insert({id:proposal.id,studio_id:proposal.studioId,user_id:proposal.userId});
  if(claim?.code==='23505') throw new Error('Questa operazione è già stata eseguita.');
  if(claim) throw new Error('Impossibile acquisire l'operazione. Nessun piano modificato.');
  const dati=proposal.piani.dati;
  const query=proposal.name==='crea_piano_cura'
    ? client.from('plans').insert({id:nuovoIdPiano(),...dati,studio_id:proposal.studioId,user_id:proposal.userId})
    : client.from('plans').update(proposal.name==='imposta_stato_piano'?{stato:dati.stato}:{voci:dati.voci}).eq('studio_id',proposal.studioId).eq('id',dati.piano_id);
  const {data,error}=await query.select().single();
  if(error||!data) throw new Error(error?.message||'errore sconosciuto.');
  return {text:`Fatto. ${proposal.piani.done}`,changed:['plans'],recordId:data.id,records:{plans:[data]}};
}
