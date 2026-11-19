// Area Legal usa le pratiche canoniche: le note manuali non passano dalla scansione.
export const STATI_LEGAL = ['aperta', 'in_corso', 'risolta', 'archiviata'];
const esito = ({ data, error }) => { if (error) throw new Error(error.message); return data; };
export function campiLegal(campi) {
  const titolo = String(campi.titolo || '').trim();
  if (!titolo) throw new Error('Inserisci il titolo della pratica');
  if (!STATI_LEGAL.includes(campi.stato)) throw new Error('Stato non valido');
  if (!['bassa', 'media', 'alta'].includes(campi.urgenza)) throw new Error('Urgenza non valida');
  return { titolo: titolo.slice(0, 200), note: String(campi.note || '').trim(), stato: campi.stato, urgenza: campi.urgenza };
}
export async function salvaPraticaLegal(db, id, campi) {
  const riga = { ...campiLegal(campi), aggiornata_il: new Date().toISOString() };
  const q = id ? db.from('pratiche').update(riga).eq('id', id) : db.from('pratiche').insert({ ...riga, fascicolo: 'legale' });
  return esito(await q.select('*').single());
}
export async function caricaLegal(db) {
  return esito(await db.from('v_pratiche').select('*').eq('fascicolo', 'legale').order('titolo', { ascending: true }));
}
export async function collegaLegal(db, documentoId, praticaId) {
  // Non sovrascrive collegamenti già presenti: se qualcuno lo ha collegato nel frattempo fallisce.
  return esito(await db.from('documenti').update({ pratica_id: praticaId }).eq('id', documentoId).is('pratica_id', null).neq('fascicolo', 'clinico_pazienti').select('id').single());
}
export async function scadenzaLegal(db, praticaId, data, descrizione) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data) || !descrizione.trim()) throw new Error('Inserisci data e descrizione');
  return esito(await db.from('scadenze').insert({ pratica_id: praticaId, data, descrizione: descrizione.trim(), completata: false, storica: false }).select('id').single());
}

/* ---------- LEGAL-SCHEDE (PO 2026-11-18): tabella scadenze e scheda pratica ---------- */
// Ambiti della tabella: legale (cause, atti, eredità) ed economico (fisco, conti, polizze, fornitori, immobili).
export const AMBITI = {
  legale: ['legale', 'successione'],
  economico: ['fiscale', 'conti', 'assicurazioni', 'previdenza', 'studio_fornitori', 'studio_fatture_emesse', 'immobili', 'veicoli'],
};
// Le bollette normali restano in Conti: delle utenze entrano solo messe in mora, diffide, solleciti, ingiunzioni.
const UTENZE_SERIE = /mora|diffid|sollecit|risoluzion|ingiun|recupero|insolut|distacco/i;
const FASCICOLI_TABELLA = [...AMBITI.legale, ...AMBITI.economico, 'utenze'];
export const ambitoDi = (fascicolo) => (AMBITI.legale.includes(fascicolo) ? 'legale' : AMBITI.economico.includes(fascicolo) || fascicolo === 'utenze' ? 'economico' : null);
// Numero di verbale/fattura nella descrizione o nel titolo: pagamenti con numeri diversi restano righe diverse.
const codicePagamento = (...testi) => (testi.join(' ').match(/\b(\d{5,}[a-z]{0,3}|\d{3,}[a-z]{1,3})\b/i)?.[1] || '').toUpperCase();

// Che tipo di scadenza è: perentoria (termini di legge), udienza, pagamento o altro.
export function tipoScadenza(descrizione, importo) {
  const t = String(descrizione || '').toLowerCase();
  if (/udienz/.test(t)) return 'udienza';
  if (/perentori|tassativ|decadenz|inderogabil|opposizion|costituzion|termine per (proporre|il deposito|la notifica)|deposito (telematico|memoria|note)/.test(t)) return 'perentoria';
  if (importo != null || /pagament|rata|saldo|addebit|rid\b|bollett|fattura/.test(t)) return 'pagamento';
  return 'altro';
}

const parole = (s) => new Set(String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').split(/[^a-z0-9]+/).filter((w) => w.length > 3));
const simili = (a, b) => { const x = parole(a), y = parole(b); if (!x.size || !y.size) return false; let c = 0; for (const w of x) if (y.has(w)) c++; return c / Math.min(x.size, y.size) >= 0.4; };
const giorniFra = (a, b) => Math.round((Date.parse(b) - Date.parse(a)) / 864e5);

// Righe grezze (una per documento) → una riga per scadenza: stessa pratica (o stesso documento/riferimento) e
// stessa data diventano una sola riga con la descrizione più completa; scadenze perentorie simili della stessa
// pratica a pochi giorni di distanza diventano una riga con la data più vicina e il conflitto segnalato.
export function raggruppaScadenze(righe, oggi = new Date().toISOString().slice(0, 10)) {
  const gruppi = new Map();
  for (const r of righe) {
    const fascicolo = r.documento?.fascicolo || r.pratica?.fascicolo;
    if (fascicolo === 'clinico_pazienti') continue;
    const ambito = ambitoDi(fascicolo) || ambitoDi(r.pratica?.fascicolo);
    if (!ambito) continue;
    if (fascicolo === 'utenze' && !UTENZE_SERIE.test(`${r.descrizione} ${r.documento?.titolo || ''}`)) continue;
    const rif = r.pratica_id || r.documento?.pratica_id || r.documento_id || r.id;
    const tipo = tipoScadenza(r.descrizione, r.importo);
    const chiave = `${rif}|${r.data}|${tipo === 'pagamento' ? codicePagamento(r.descrizione, r.documento?.titolo) : ''}`;
    const g = gruppi.get(chiave);
    if (!g) {
      gruppi.set(chiave, { id: r.id, data: r.data, descrizione: r.descrizione, importo: r.importo ?? null, tipo, ambito, rif,
        pratica_id: r.pratica_id || r.documento?.pratica_id || null, pratica: r.pratica?.titolo || r.documento?.pratica?.titolo || null,
        documento_id: r.documento_id || null, titolo: r.pratica?.titolo || r.documento?.pratica?.titolo || r.documento?.titolo || '', fonti: 1, ids: [r.id], altre_date: [] });
    } else {
      g.fonti++; g.ids.push(r.id);
      if (String(r.descrizione || '').length > String(g.descrizione || '').length) g.descrizione = r.descrizione;
      if (r.importo != null && (g.importo == null || Number(r.importo) > Number(g.importo))) g.importo = r.importo;
      if (tipo === 'perentoria' || (tipo === 'udienza' && g.tipo !== 'perentoria')) g.tipo = tipo;
    }
  }
  const elenco = [...gruppi.values()].sort((a, b) => a.data.localeCompare(b.data));
  // Stessa scadenza con date diverse nei documenti: si tiene la più vicina e si segnala.
  const fuori = [];
  for (const s of elenco) {
    const gemella = fuori.find((x) => x.rif === s.rif && x.tipo === 'perentoria' && s.tipo === 'perentoria' && Math.abs(giorniFra(x.data, s.data)) <= 3 && simili(x.descrizione, s.descrizione));
    if (gemella) { gemella.altre_date.push(s.data); gemella.fonti += s.fonti; gemella.ids.push(...s.ids); continue; }
    fuori.push(s);
  }
  return fuori.map((s) => ({ ...s, giorni: giorniFra(oggi, s.data) }));
}

export async function scadenzeLegali(db, { giorni = 60, oggi = new Date().toISOString().slice(0, 10) } = {}) {
  const fino = new Date(Date.parse(oggi) + giorni * 864e5).toISOString().slice(0, 10);
  const righe = esito(await db.from('scadenze')
    .select('id, data, descrizione, importo, documento_id, pratica_id, documento:documenti(titolo, fascicolo, pratica_id, pratica:pratiche(titolo, fascicolo)), pratica:pratiche(titolo, fascicolo)')
    .eq('completata', false).eq('storica', false).gte('data', oggi).lte('data', fino).order('data').limit(1000));
  return raggruppaScadenze(righe.filter((r) => FASCICOLI_TABELLA.includes(r.documento?.fascicolo || r.pratica?.fascicolo)), oggi);
}

// Una scadenza fatta: tutte le righe unite in quella riga (i doppioni dei vari documenti).
export async function segnaScadenzeFatte(db, ids) {
  return esito(await db.from('scadenze').update({ completata: true }).in('id', ids).select('id'));
}

export async function schedaPratica(db, praticaId) {
  return esito(await db.from('pratiche_schede').select('*').eq('pratica_id', praticaId).maybeSingle());
}
export async function passiPratica(db, praticaId) {
  return esito(await db.from('promemoria_azioni').select('id, titolo, scadenza, priorita, stato, creato_il').eq('pratica_id', praticaId).neq('stato', 'rimosso').order('creato_il'));
}
export async function segnaPasso(db, id, fatto) {
  return esito(await db.from('promemoria_azioni').update({ stato: fatto ? 'gestito' : 'aperto', stato_il: new Date().toISOString() }).eq('id', id).select('id, stato').single());
}
export async function aggiungiPasso(db, pratica, testo, entro) {
  const t = String(testo || '').trim();
  if (!t) throw new Error('Scrivi il passo da fare');
  return esito(await db.from('promemoria_azioni').insert({
    pratica_id: pratica.id, titolo: t.slice(0, 200), scadenza: /^\d{4}-\d{2}-\d{2}$/.test(entro || '') ? entro : null,
    priorita: 'media', stato: 'aperto', categoria: ['legale', 'successione'].includes(pratica.fascicolo) ? 'legale' : 'soldi',
    spiegazione: `Passo della pratica «${pratica.titolo}».`,
  }).select('id, titolo, scadenza, priorita, stato, creato_il').single());
}

// Analizza (o rianalizza) la pratica: lo script legge i documenti e scrive scheda e passi. Mai i pazienti.
export async function analizzaPratica({ token, praticaId }, fetchImpl = fetch) {
  if (!token) throw new Error('Sessione scaduta: esci e rientra.');
  const { URL_CARICAMENTO } = await import('./archivio.js');
  const res = await fetchImpl(URL_CARICAMENTO, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ token, azione: 'scheda_pratica', pratica_id: praticaId }) });
  let r;
  try { r = await res.json(); } catch { throw new Error('Script non raggiungibile.'); }
  if (!r.ok) { const e = new Error(r.errore || 'Analisi non riuscita.'); e.clinico = !!r.clinico; throw e; }
  return r;
}

/* ---------- PRATICHE-WORKFLOW (PO 2026-11-18): filo temporale, verifica, avanzamento ---------- */
export const STATI_ANALISI = { da_fare: 'Da analizzare', letta: 'Documenti letti', analizzata: 'Da verificare', da_aggiornare: 'Documenti nuovi: da aggiornare', verificata: 'Verificata' };
// Filo temporale in ordine di data; gli eventi senza data vanno in fondo.
export function filoOrdinato(filo) {
  return (Array.isArray(filo) ? filo : []).filter((x) => x && x.evento).slice().sort((a, b) => String(a.data || '9999').localeCompare(String(b.data || '9999')));
}
// Luca conferma (o toglie la conferma a) una scheda: unica scrittura su pratiche_schede permessa all'app.
export async function confermaScheda(db, praticaId, conferma = true) {
  return esito(await db.rpc('conferma_scheda', { p_pratica: praticaId, p_conferma: conferma }));
}
// Quante pratiche legali aperte hanno una scheda, e quante sono verificate.
export function avanzamentoSchede(pratiche, schede) {
  const aperte = (pratiche || []).filter((p) => ['aperta', 'in_corso'].includes(p.stato));
  const per = new Map((schede || []).map((s) => [s.pratica_id, s.stato_analisi]));
  const analizzate = aperte.filter((p) => per.has(p.pratica_id || p.id)).length;
  const verificate = aperte.filter((p) => per.get(p.pratica_id || p.id) === 'verificata').length;
  return { totale: aperte.length, analizzate, verificate };
}
export async function statiSchede(db) {
  return esito(await db.from('pratiche_schede').select('pratica_id, stato_analisi'));
}
