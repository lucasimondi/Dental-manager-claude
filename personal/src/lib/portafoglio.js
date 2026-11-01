export const TAG_STORICO = 'documento-personale-storico';
export const storicoPersonale = (d) => (d?.tag || []).includes(TAG_STORICO);
export const eFotografia = (d) => d?.fascicolo === 'foto_video' || /fotograf|fototessera|foto (?:personale|formato tessera)/i.test(`${d?.tipo_documento || ''} ${d?.titolo || ''}`);
export function documentoDaPersonal(d, categoria) {
  if (!d || eFotografia(d) || storicoPersonale(d) || d.fascicolo === 'clinico_pazienti') return false;
  return !!categoria || ((d.tag || []).includes('portafoglio') && d.fascicolo === 'identita');
}
export function dataScadenza(d) {
  const dati=d?.dati_estratti || {};
  const valore=dati.scadenza_documento || dati.data_scadenza || dati.scadenza;
  return /^\d{4}-\d{2}-\d{2}$/.test(valore || '') ? valore : null;
}
export function avvisoDocumento(d, oggi=new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Rome'}).format(new Date())) {
  const data=dataScadenza(d);
  if(!data)return null;
  const giorni=Math.round((Date.parse(data+'T12:00:00Z')-Date.parse(oggi+'T12:00:00Z'))/86400000);
  return {data,giorni,stato:giorni<0?'scaduto':giorni<=90?'in-scadenza':'valido',testo:giorni<0?'Scaduto':giorni===0?'Scade oggi':giorni<=90?`Scade tra ${giorni} giorni`:'Valido fino al'};
}
export const scadenzaIdentita = (s) => s?.categoria==='rinnovo_documento' || s?.documento?.fascicolo==='identita';

export async function archiviaPersonale(db, doc, archivia=true) {
  const tag=(doc.tag || []).filter(t=>t!==TAG_STORICO && t!=='portafoglio');
  if(archivia)tag.push(TAG_STORICO);else tag.push('portafoglio');
  const {error}=await db.from('documenti').update({tag}).eq('id',doc.id);
  if(error)throw new Error(error.message);
}
export async function salvaValidita(db,doc,data) {
  if(!/^\d{4}-\d{2}-\d{2}$/.test(data) || new Date(data+'T12:00:00Z').toISOString().slice(0,10)!==data)throw new Error('Scegli una data valida.');
  // Read latest metadata to preserve unrelated extracted fields.
  const current=await db.from('documenti').select('dati_estratti').eq('id',doc.id).single();
  if(current.error)throw new Error(current.error.message);
  const update=await db.from('documenti').update({dati_estratti:{...(current.data.dati_estratti||{}),scadenza_documento:data}}).eq('id',doc.id);
  if(update.error)throw new Error(update.error.message);
  const existing=await db.from('scadenze').select('id').eq('documento_id',doc.id).eq('categoria','rinnovo_documento').limit(1);
  if(existing.error)throw new Error(existing.error.message);
  const row={documento_id:doc.id,data,descrizione:`Rinnovo ${doc.titolo || 'documento'}${doc.persona?' · '+doc.persona:''}`,categoria:'rinnovo_documento',importo:null,completata:false,storica:false};
  const result=existing.data?.length ? await db.from('scadenze').update(row).eq('id',existing.data[0].id) : await db.from('scadenze').insert(row);
  if(result.error)throw new Error('Data salvata, ma promemoria non aggiornato: '+result.error.message);
}
