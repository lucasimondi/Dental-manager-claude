// POL-AI-010 passo 4b — preventivi e piani di cura dalla chat di Poliedron.
// Stesso contratto di pagamenti.js: prepare → riepilogo firmato → conferma
// dell'utente → execute. Come i pagamenti, si scrive SEMPRE dopo "Conferma"
// (decisione del Product Owner), qualunque sia l'autonomia dello studio.
//
// Semantica identica all'app (Piani.jsx, PianoDrillDown.jsx,
// src/lib/domain/treatmentPlanService.js):
// - nuovo piano: { titolo, data, voci, stato 'attivo', sconto, sconto_tipo 'pct'|'eur' };
//   voce = { prestazione, dente, prezzo, eseguita:false, incassata:false };
// - stato: 'attivo' (in attesa), 'accettato', 'rifiutato'; "concluso" non si
//   scrive mai (POL-FIN-007: è calcolato, tutte le voci eseguite);
// - prestazione eseguita: eseguita=true, dataEsec=oggi e, se la voce non ha
//   già un richiamo, richiamo proposto come rilevaRichiamo() dell'app.
// Il registro finanziario (trigger pol_003b_sync_plan_trg) legge le voci per
// posizione e non ha storni: qui le voci non si riordinano né si tolgono, e
// "eseguita" non si annulla. Nessuna formula di saldo o di totale scontato.
import { studioToday } from './confirmation.js';

export const PIANI_WRITES = new Set(['crea_piano_cura', 'aggiorna_stato_piano', 'segna_prestazione_eseguita']);
export const STATI_PIANO = Object.freeze(['attivo', 'accettato', 'rifiutato']);
export const TIPI_SCONTO = Object.freeze(['pct', 'eur']);
const MAX_VOCI = 40;
const MAX_PREZZO = 100_000;
const ETICHETTA_STATO = { attivo: 'in attesa', accettato: 'accettato', rifiutato: 'non accettato' };

const CERCA = "Cerca prima il paziente con cerca_pazienti (se più pazienti corrispondono chiedi quale).";
export const PIANI_TOOLS = [
  {
    name: 'crea_piano_cura',
    description: `Crea un piano di cura / preventivo per un paziente. L'utente vede un riepilogo da confermare: non dire che è creato finché non conferma. ${CERCA} Usa le prestazioni del listino (catalogo_prestazioni): se l'utente non dice il prezzo si usa quello del listino. Una voce per dente (es. due otturazioni sul 36 e sul 46 = due voci). Non inventare prestazioni, prezzi o sconti.`,
    input_schema: {
      type: 'object',
      properties: {
        paziente_id: { type: 'integer' },
        titolo: { type: 'string', description: "Es. 'Riabilitazione arcata inferiore'." },
        voci: {
          type: 'array',
          minItems: 1,
          maxItems: MAX_VOCI,
          items: {
            type: 'object',
            properties: {
              prestazione: { type: 'string', description: 'Nome della prestazione, come nel listino.' },
              prezzo: { type: 'number', description: 'Euro. Ometti per usare il prezzo del listino.' },
              dente: { type: 'string', description: 'Facoltativo, es. 36.' },
            },
            required: ['prestazione'],
          },
        },
        sconto: { type: 'number', description: 'Facoltativo, solo se l\'utente lo chiede.' },
        sconto_tipo: { type: 'string', enum: TIPI_SCONTO, description: "pct = percentuale (default), eur = euro." },
        stato: { type: 'string', enum: STATI_PIANO, description: "Default 'attivo' (in attesa di risposta). 'accettato' solo se l'utente dice che il paziente l'ha già accettato." },
      },
      required: ['paziente_id', 'titolo', 'voci'],
    },
  },
  {
    name: 'aggiorna_stato_piano',
    description: `Segna un piano di cura come accettato o non accettato dal paziente, o lo rimette in attesa ('attivo'). L'utente conferma il riepilogo. Trova prima il piano con storico_paziente; se il paziente ha più piani e non è chiaro quale, chiedi.`,
    input_schema: {
      type: 'object',
      properties: {
        piano_id: { type: 'integer' },
        stato: { type: 'string', enum: STATI_PIANO },
      },
      required: ['piano_id', 'stato'],
    },
  },
  {
    name: 'segna_prestazione_eseguita',
    description: `Segna come eseguita oggi una prestazione di un piano di cura (non si può annullare dalla chat). L'utente conferma il riepilogo. Trova prima il piano con storico_paziente; voce = posizione della prestazione nel piano, contando da 1 nell'ordine restituito; prestazione = il suo nome, per controllo. Se più prestazioni corrispondono, chiedi quale.`,
    input_schema: {
      type: 'object',
      properties: {
        piano_id: { type: 'integer' },
        voce: { type: 'integer', description: 'Posizione nel piano, da 1.' },
        prestazione: { type: 'string', description: 'Nome della prestazione in quella posizione.' },
      },
      required: ['piano_id', 'voce', 'prestazione'],
    },
  },
];

const euro = (n) => new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(n);
const descriviData = (iso) => new Intl.DateTimeFormat('it-IT', { timeZone: 'UTC', day: 'numeric', month: 'long', year: 'numeric' })
  .format(new Date(`${iso}T12:00:00Z`));
const normalizza = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim();
const testo = (v, max, nome) => {
  if (typeof v !== 'string' || !v.trim()) throw new Error(`${nome} mancante.`);
  if (v.trim().length > max) throw new Error(`${nome} troppo lungo.`);
  return v.trim();
};
const voceTesto = (v) => `${v.prestazione}${v.dente ? ` (dente ${v.dente})` : ''}`;

/** Id di un nuovo piano: stesso schema dell'app (uid() in src/lib/utils.js). */
export const nuovoIdPiano = () => Date.now() + Math.floor(Math.random() * 99999);

// Identico a RICHIAMO_KEYWORDS_PER_VERTICAL.dentistico / rilevaRichiamo() di
// src/lib/utils.js, come lo chiama PianoDrillDown.jsx (senza settore).
const RICHIAMO_KEYWORDS = [
  { match: /igien/i, tipo: 'Igiene orale', mesi: 6 },
  { match: /implant|impiant/i, tipo: 'Controllo impianto', mesi: 3 },
];
export function rilevaRichiamo(nomePrestazione) {
  if (!nomePrestazione) return null;
  const found = RICHIAMO_KEYWORDS.find((k) => k.match.test(nomePrestazione));
  return found ? { tipo: found.tipo, mesi: found.mesi } : null;
}
export function addMesi(iso, mesi) {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() + mesi);
  return d.toISOString().slice(0, 10);
}

/** Voci del nuovo piano: nome canonico e prezzo del listino quando corrispondono. */
export function costruisciVoci(voci, listino) {
  if (!Array.isArray(voci) || voci.length === 0) throw new Error('Indica almeno una prestazione.');
  if (voci.length > MAX_VOCI) throw new Error(`Al massimo ${MAX_VOCI} prestazioni per piano.`);
  const perNome = new Map((listino || []).map((p) => [normalizza(p.nome), p]));
  return voci.map((v) => {
    const nome = testo(v?.prestazione, 200, 'Prestazione');
    const dalListino = perNome.get(normalizza(nome));
    let prezzo = v.prezzo ?? dalListino?.prezzo;
    if (prezzo == null) throw new Error(`"${nome}" non è nel listino: chiedi all'utente il prezzo.`);
    prezzo = Number(prezzo);
    if (!Number.isFinite(prezzo) || prezzo < 0 || prezzo > MAX_PREZZO) throw new Error(`Prezzo non valido per "${nome}".`);
    const dente = v.dente == null || v.dente === '' ? '' : testo(String(v.dente), 20, 'Dente');
    return { prestazione: dalListino?.nome || nome, dente, prezzo: Math.round(prezzo * 100) / 100, eseguita: false, incassata: false };
  });
}

function sconto(input) {
  const valore = input.sconto == null ? 0 : Number(input.sconto);
  const tipo = input.sconto_tipo ?? 'pct';
  if (!TIPI_SCONTO.includes(tipo)) throw new Error('Tipo di sconto non valido: pct o eur.');
  if (!Number.isFinite(valore) || valore < 0 || (tipo === 'pct' && valore > 100) || valore > MAX_PREZZO) throw new Error('Sconto non valido.');
  return { sconto: Math.round(valore * 100) / 100, sconto_tipo: tipo };
}

async function pianoOsservato(client, pianoId, studioId, observed) {
  if (!observed.plans?.has(pianoId)) throw new Error('Trova prima il piano con storico_paziente e chiedi quale, se il paziente ne ha più di uno.');
  const { data, error } = await client.from('plans').select('id, paziente_id, titolo, data, stato, voci, patients(nome, cognome)')
    .eq('studio_id', studioId).eq('id', pianoId).maybeSingle();
  if (error || !data) throw new Error('Piano non disponibile o accesso non consentito.');
  return data;
}
const chiDi = (piano) => `${piano.patients?.nome || ''} ${piano.patients?.cognome || ''}`.trim() || 'paziente';

export async function preparePiani(client, name, input = {}, studioId, observed) {
  const oggi = studioToday();

  if (name === 'crea_piano_cura') {
    if (!observed.patients.has(input.paziente_id)) throw new Error('Cerca prima il paziente e chiedi quale scegliere in caso di omonimia.');
    const titolo = testo(input.titolo, 120, 'Titolo');
    const stato = input.stato ?? 'attivo';
    if (!STATI_PIANO.includes(stato)) throw new Error('Stato non valido: attivo, accettato o rifiutato.');
    const sc = sconto(input);
    const [{ data: paz, error: errPaz }, { data: listino, error: errListino }, { data: esistenti, error: errEsistenti }] = await Promise.all([
      client.from('patients').select('id, nome, cognome').eq('studio_id', studioId).eq('id', input.paziente_id).single(),
      client.from('pricelist').select('nome, prezzo').eq('studio_id', studioId),
      client.from('plans').select('id, titolo, stato').eq('studio_id', studioId).eq('paziente_id', input.paziente_id),
    ]);
    if (errPaz || !paz) throw new Error('Paziente non disponibile o accesso non consentito.');
    if (errListino || errEsistenti) throw new Error('Non riesco a leggere listino e piani del paziente. Nessuna modifica eseguita.');
    const voci = costruisciVoci(input.voci, listino);
    const totale = voci.reduce((s, v) => s + v.prezzo, 0);
    if (sc.sconto_tipo === 'eur' && sc.sconto > totale) throw new Error('Lo sconto supera il totale delle prestazioni.');
    const chi = `${paz.nome || ''} ${paz.cognome || ''}`.trim();
    const doppio = (esistenti || []).find((p) => normalizza(p.titolo) === normalizza(titolo) && p.stato !== 'rifiutato');
    const avviso = doppio ? `Attenzione: ${chi} ha già un piano "${doppio.titolo}".` : null;
    const corpo = [
      `Paziente: ${chi}`,
      `Titolo: ${titolo}`,
      ...voci.map((v, i) => `${i + 1}. ${voceTesto(v)} — ${euro(v.prezzo)}`),
      `Totale prestazioni: ${euro(totale)}`,
      sc.sconto ? `Sconto: ${sc.sconto_tipo === 'pct' ? `${sc.sconto}%` : euro(sc.sconto)}` : null,
      `Stato: ${ETICHETTA_STATO[stato]}`,
    ].filter(Boolean).join('\n');
    return {
      azione: 'insert',
      dati: { paziente_id: paz.id, titolo, data: oggi, voci, stato, ...sc },
      avviso,
      summary: `Nuovo piano di cura\n${corpo}${avviso ? `\n${avviso}` : ''}`,
      done: `Piano di cura creato\n${corpo}`,
    };
  }

  if (name === 'aggiorna_stato_piano') {
    if (!STATI_PIANO.includes(input.stato)) throw new Error('Stato non valido: attivo, accettato o rifiutato.');
    const piano = await pianoOsservato(client, input.piano_id, studioId, observed);
    const prima = piano.stato ?? null;
    if ((prima || 'attivo') === input.stato) throw new Error(`Il piano è già ${ETICHETTA_STATO[input.stato]}.`);
    const corpo = `Paziente: ${chiDi(piano)}\nPiano: ${piano.titolo || `n. ${piano.id}`}\nStato: ${ETICHETTA_STATO[prima || 'attivo']} → ${ETICHETTA_STATO[input.stato]}`;
    return {
      azione: 'stato',
      pianoId: piano.id,
      prima,
      dati: { stato: input.stato },
      summary: `Aggiorna il piano di cura\n${corpo}`,
      done: `Piano di cura aggiornato\n${corpo}`,
    };
  }

  if (name === 'segna_prestazione_eseguita') {
    const piano = await pianoOsservato(client, input.piano_id, studioId, observed);
    const voci = Array.isArray(piano.voci) ? piano.voci : [];
    const indice = Number(input.voce) - 1;
    const voce = voci[indice];
    if (!Number.isInteger(indice) || !voce) throw new Error(`Il piano ha ${voci.length} prestazioni: indica la posizione giusta.`);
    const atteso = normalizza(input.prestazione);
    if (!atteso || !normalizza(voce.prestazione).includes(atteso) && !atteso.includes(normalizza(voce.prestazione))) {
      throw new Error(`Alla posizione ${input.voce} c'è "${voce.prestazione}", non "${input.prestazione}": rileggi il piano con storico_paziente.`);
    }
    if (voce.eseguita) throw new Error(`"${voceTesto(voce)}" risulta già eseguita${voce.dataEsec ? ` il ${voce.dataEsec}` : ''}.`);
    if (piano.stato === 'rifiutato') throw new Error('Il piano non è stato accettato: chiedi all\'utente se va prima segnato come accettato.');
    const r = voce.richiamoData ? null : rilevaRichiamo(voce.prestazione);
    const aggiornata = { ...voce, eseguita: true, dataEsec: oggi, ...(r ? { richiamoTipo: r.tipo, richiamoData: addMesi(oggi, r.mesi) } : {}) };
    const dopo = voci.map((v, j) => (j === indice ? aggiornata : v));
    const corpo = [
      `Paziente: ${chiDi(piano)}`,
      `Piano: ${piano.titolo || `n. ${piano.id}`}`,
      `Prestazione: ${voceTesto(voce)}`,
      `Eseguita il: ${descriviData(oggi)}`,
      r ? `Richiamo: ${r.tipo} entro il ${descriviData(aggiornata.richiamoData)}` : null,
    ].filter(Boolean).join('\n');
    return {
      azione: 'voci',
      pianoId: piano.id,
      prima: voci,
      dati: { voci: dopo },
      summary: `Segna prestazione eseguita\n${corpo}\nNon si potrà annullare dalla chat.`,
      done: `Prestazione eseguita\n${corpo}`,
    };
  }

  throw new Error('Azione non supportata');
}

const COLONNE = 'id, paziente_id, titolo, data, voci, stato, sconto, sconto_tipo, scadenza_pagamento, ortodonzia';

/**
 * Esegue dopo la conferma: prima il claim (una conferma vale una volta), poi
 * la scrittura con il login dell'utente (RLS per studio). Le modifiche a un
 * piano esistente passano solo se il piano è ancora com'era nel riepilogo:
 * se qualcuno lo ha cambiato nel frattempo non si scrive nulla.
 */
export async function executePiani(client, proposal) {
  const { error: errClaim } = await client.from('poliedron_action_claims').insert({
    id: proposal.id, studio_id: proposal.studioId, user_id: proposal.userId,
  });
  if (errClaim?.code === '23505') throw new Error('Questa conferma è già stata usata.');
  if (errClaim) throw new Error('Impossibile acquisire la conferma. Nessuna modifica eseguita.');
  const p = proposal.piani;
  let query;
  if (p.azione === 'insert') {
    query = client.from('plans').insert({ id: nuovoIdPiano(), ...p.dati, studio_id: proposal.studioId, user_id: proposal.userId });
  } else {
    query = client.from('plans').update(p.dati).eq('studio_id', proposal.studioId).eq('id', p.pianoId);
    if (p.azione === 'stato') query = p.prima == null ? query.is('stato', null) : query.eq('stato', p.prima);
    else query = query.eq('voci', JSON.stringify(p.prima));
  }
  const { data, error } = await query.select(COLONNE).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error('il piano è stato modificato nel frattempo. Nessuna modifica eseguita: rileggilo e riprova.');
  return {
    text: `Fatto. ${p.done}`,
    changed: ['plans'],
    recordId: data.id,
    records: { plans: [data] },
  };
}
