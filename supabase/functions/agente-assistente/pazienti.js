// POL-AI-010 step 2 — patient record and clinical organisation from Poliedron.
// Same contract as agenda.js: the model only PREPARES; the server builds the
// canonical data and a readable summary; the write happens after the user's
// confirmation, in one transaction (poliedron_execute_pazienti_v1).
import { studioToday } from './confirmation.js';

export const PAZIENTI_WRITES = new Set([
  'crea_paziente', 'modifica_paziente', 'aggiungi_nota_paziente',
  'crea_richiamo', 'crea_promemoria', 'crea_impegno_personale',
]);

const TABELLA = {
  crea_paziente: 'patients', modifica_paziente: 'patients', aggiungi_nota_paziente: 'patients',
  crea_richiamo: 'richiami', crea_promemoria: 'todos', crea_impegno_personale: 'impegni_personali',
};

const CAMPI_ANAGRAFICA = ['telefono', 'email', 'indirizzo', 'cap', 'comune', 'provincia', 'data_nascita', 'cf', 'consenso_whatsapp'];
const CATEGORIE_RICHIAMO = ['clinico', 'preventivo', 'incasso', 'generico'];
const TIPI_IMPEGNO = ['personale', 'ferie', 'chiamata', 'altro'];
const PREPARA = 'Prepara la proposta; nessuna scrittura prima della conferma dell\'utente. Cerca prima il paziente con cerca_pazienti e chiedi quale in caso di omonimia. Non inventare ID.';

export const PAZIENTI_TOOLS = [
  {
    name: 'scheda_paziente',
    description: 'Scheda di un paziente: anagrafica, consenso WhatsApp, ultime note, allarme anamnesi, richiami da fare e prossimi appuntamenti. Usalo per rispondere su un paziente o prima di modificarlo.',
    input_schema: { type: 'object', properties: { paziente_id: { type: 'integer' } }, required: ['paziente_id'] },
  },
  {
    name: 'crea_paziente',
    description: `Nuova anagrafica paziente. Controlla prima con cerca_pazienti che non esista già. ${PREPARA}`,
    input_schema: {
      type: 'object',
      properties: {
        nome: { type: 'string' }, cognome: { type: 'string' }, telefono: { type: 'string' }, email: { type: 'string' },
        data_nascita: { type: 'string', description: 'YYYY-MM-DD' }, cf: { type: 'string', description: 'Codice fiscale' },
        note: { type: 'string' },
        consenso_whatsapp: { type: 'boolean', description: 'true solo se l\'utente dice esplicitamente che il paziente ha dato il consenso.' },
      },
      required: ['nome', 'cognome'],
    },
  },
  {
    name: 'modifica_paziente',
    description: `Aggiorna l'anagrafica (contatti, indirizzo, data di nascita, codice fiscale, consenso WhatsApp). Solo i campi da cambiare. ${PREPARA}`,
    input_schema: {
      type: 'object',
      properties: {
        paziente_id: { type: 'integer' }, telefono: { type: 'string' }, email: { type: 'string' }, indirizzo: { type: 'string' },
        cap: { type: 'string' }, comune: { type: 'string' }, provincia: { type: 'string' },
        data_nascita: { type: 'string', description: 'YYYY-MM-DD' }, cf: { type: 'string' },
        consenso_whatsapp: { type: 'boolean', description: 'Solo se l\'utente lo dice esplicitamente.' },
      },
      required: ['paziente_id'],
    },
  },
  {
    name: 'aggiungi_nota_paziente',
    description: `Aggiunge una nota datata alla scheda del paziente (le note esistenti restano). ${PREPARA}`,
    input_schema: { type: 'object', properties: { paziente_id: { type: 'integer' }, testo: { type: 'string' } }, required: ['paziente_id', 'testo'] },
  },
  {
    name: 'crea_richiamo',
    description: `Crea un richiamo per il paziente nella sezione Richiami. ${PREPARA}`,
    input_schema: {
      type: 'object',
      properties: {
        paziente_id: { type: 'integer' },
        categoria: { type: 'string', enum: CATEGORIE_RICHIAMO, description: 'Default generico' },
        motivo: { type: 'string' },
        data_scadenza: { type: 'string', description: 'YYYY-MM-DD, entro quando richiamare' },
      },
      required: ['paziente_id', 'data_scadenza'],
    },
  },
  {
    name: 'crea_promemoria',
    description: `Crea un'attività/promemoria per lo studio (visibile in Attività), facoltativamente legata a un paziente. ${PREPARA}`,
    input_schema: {
      type: 'object',
      properties: { testo: { type: 'string' }, data: { type: 'string', description: 'YYYY-MM-DD, facoltativa' }, paziente_id: { type: 'integer' } },
      required: ['testo'],
    },
  },
  {
    name: 'crea_impegno_personale',
    description: `Blocca l'agenda per ferie, chiamate o impegni non legati a un paziente. ${PREPARA}`,
    input_schema: {
      type: 'object',
      properties: {
        titolo: { type: 'string' }, tipo: { type: 'string', enum: TIPI_IMPEGNO },
        data_inizio: { type: 'string', description: 'YYYY-MM-DD' }, data_fine: { type: 'string', description: 'YYYY-MM-DD' },
        tutto_il_giorno: { type: 'boolean' }, ora_inizio: { type: 'string', description: 'HH:MM' }, ora_fine: { type: 'string', description: 'HH:MM' },
        note: { type: 'string' },
      },
      required: ['titolo', 'data_inizio'],
    },
  },
];

const RE_DATA = /^\d{4}-\d{2}-\d{2}$/;
const RE_ORA = /^([01]\d|2[0-3]):[0-5]\d$/;
const RE_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const dataValida = (s) => RE_DATA.test(s || '') && new Date(`${s}T12:00:00Z`).toISOString().slice(0, 10) === s;
const testo = (v, max, nome) => {
  if (v == null) return null;
  if (typeof v !== 'string') throw new Error(`${nome} non valido`);
  const t = v.trim();
  if (t.length > max) throw new Error(`${nome} troppo lungo`);
  return t || null;
};
const descriviData = (iso) => new Intl.DateTimeFormat('it-IT', { timeZone: 'UTC', weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  .format(new Date(`${iso}T12:00:00Z`));

async function pazienteOsservato(client, id, studioId, observed) {
  if (!observed.patients.has(id)) throw new Error('Cerca prima il paziente e chiedi quale scegliere in caso di omonimia.');
  const { data, error } = await client.from('patients').select('id, nome, cognome, ' + CAMPI_ANAGRAFICA.join(', '))
    .eq('studio_id', studioId).eq('id', id).single();
  if (error || !data) throw new Error('Paziente non disponibile o accesso non consentito.');
  return data;
}

function anagrafica(input, { obbligatori = false } = {}) {
  const d = {};
  if (obbligatori) {
    d.nome = testo(input.nome, 100, 'Nome');
    d.cognome = testo(input.cognome, 100, 'Cognome');
    if (!d.nome || !d.cognome) throw new Error('Nome e cognome obbligatori');
    if (input.note !== undefined) d.note = testo(input.note, 4000, 'Note');
  }
  if (input.telefono !== undefined) d.telefono = testo(input.telefono, 30, 'Telefono');
  if (input.email !== undefined) {
    d.email = testo(input.email, 200, 'Email');
    if (d.email && !RE_EMAIL.test(d.email)) throw new Error('Email non valida');
  }
  for (const [k, max] of [['indirizzo', 200], ['cap', 10], ['comune', 100]]) if (input[k] !== undefined) d[k] = testo(input[k], max, k);
  if (input.provincia !== undefined) {
    d.provincia = testo(input.provincia, 2, 'Provincia');
    if (d.provincia && !/^[A-Za-z]{2}$/.test(d.provincia)) throw new Error('Provincia: usa la sigla di due lettere');
  }
  if (input.data_nascita !== undefined && input.data_nascita !== null) {
    if (!dataValida(input.data_nascita) || input.data_nascita > studioToday()) throw new Error('Data di nascita non valida');
    d.data_nascita = input.data_nascita;
  }
  if (input.cf !== undefined) {
    d.cf = testo(input.cf, 16, 'Codice fiscale');
    if (d.cf && !/^[A-Za-z0-9]{16}$/.test(d.cf)) throw new Error('Codice fiscale non valido');
  }
  if (input.consenso_whatsapp !== undefined) {
    if (typeof input.consenso_whatsapp !== 'boolean') throw new Error('Consenso WhatsApp non valido');
    d.consenso_whatsapp = input.consenso_whatsapp;
  }
  return d;
}

const ETICHETTE = {
  telefono: 'Telefono', email: 'Email', indirizzo: 'Indirizzo', cap: 'CAP', comune: 'Comune', provincia: 'Provincia',
  data_nascita: 'Data di nascita', cf: 'Codice fiscale', consenso_whatsapp: 'Consenso WhatsApp', note: 'Note',
};
const valore = (k, v) => (v == null || v === '' ? '—' : k === 'consenso_whatsapp' ? (v ? 'sì' : 'no') : String(v));

export async function preparePazienti(client, name, input = {}, studioId, observed) {
  const oggi = studioToday();
  if (name === 'crea_paziente') {
    const dati = anagrafica(input, { obbligatori: true });
    const { data: omonimi } = await client.from('patients').select('id')
      .eq('studio_id', studioId).ilike('nome', dati.nome).ilike('cognome', dati.cognome).limit(3);
    const righe = Object.entries(dati).filter(([k]) => !['nome', 'cognome'].includes(k)).map(([k, v]) => `${ETICHETTE[k]}: ${valore(k, v)}`);
    const avviso = omonimi?.length ? `\nAttenzione: in anagrafica c'è già un paziente ${dati.nome} ${dati.cognome}.` : '';
    return { dati, before: null, summary: `Nuovo paziente\n${dati.nome} ${dati.cognome}${righe.length ? `\n${righe.join('\n')}` : ''}${avviso}` };
  }

  if (name === 'crea_impegno_personale') {
    const titolo = testo(input.titolo, 120, 'Titolo');
    if (!titolo) throw new Error('Titolo obbligatorio');
    const tipo = input.tipo ?? 'personale';
    if (!TIPI_IMPEGNO.includes(tipo)) throw new Error('Tipo di impegno non valido');
    const inizio = input.data_inizio, fine = input.data_fine ?? input.data_inizio;
    if (!dataValida(inizio) || !dataValida(fine) || inizio < oggi || fine < inizio) throw new Error('Date dell\'impegno non valide');
    const tutto = input.tutto_il_giorno !== false;
    if (!tutto && (!RE_ORA.test(input.ora_inizio || '') || !RE_ORA.test(input.ora_fine || '') || input.ora_fine <= input.ora_inizio)) throw new Error('Orario dell\'impegno non valido');
    const dati = { titolo, tipo, data_inizio: inizio, data_fine: fine, tutto_il_giorno: tutto,
      ora_inizio: tutto ? null : input.ora_inizio, ora_fine: tutto ? null : input.ora_fine, note: testo(input.note, 1000, 'Note') };
    const quando = fine !== inizio ? `dal ${descriviData(inizio)} al ${descriviData(fine)}` : descriviData(inizio);
    return { dati, before: null, summary: `Blocca l'agenda: ${titolo} (${tipo})\n${quando}, ${tutto ? 'tutto il giorno' : `dalle ${dati.ora_inizio} alle ${dati.ora_fine}`}` };
  }

  if (name === 'crea_promemoria') {
    const t = testo(input.testo, 500, 'Testo');
    if (!t) throw new Error('Testo del promemoria obbligatorio');
    if (input.data != null && !dataValida(input.data)) throw new Error('Data non valida');
    let chi = null;
    if (input.paziente_id != null) chi = await pazienteOsservato(client, input.paziente_id, studioId, observed);
    return {
      dati: { testo: t, data: input.data ?? null, paziente_id: chi?.id ?? null },
      before: null,
      summary: `Nuova attività: ${t}${input.data ? `\nEntro: ${descriviData(input.data)}` : ''}${chi ? `\nPaziente: ${chi.nome} ${chi.cognome}` : ''}`,
    };
  }

  // From here on the action is about one specific patient.
  const paz = await pazienteOsservato(client, input.paziente_id, studioId, observed);
  const chi = `${paz.nome || ''} ${paz.cognome || ''}`.trim();

  if (name === 'modifica_paziente') {
    const { paziente_id: _ignorato, ...resto } = input;
    const dati = anagrafica(resto);
    const campi = Object.keys(dati).filter((k) => String(dati[k] ?? '') !== String(paz[k] ?? ''));
    if (!campi.length) throw new Error('Nessun dato da cambiare rispetto alla scheda attuale.');
    const before = Object.fromEntries(campi.map((k) => [k, paz[k] ?? null]));
    const cambi = Object.fromEntries(campi.map((k) => [k, dati[k]]));
    return {
      dati: { paziente_id: paz.id, ...cambi },
      before,
      summary: `Aggiorna la scheda di ${chi}\n${campi.map((k) => `${ETICHETTE[k]}: ${valore(k, paz[k])} → ${valore(k, dati[k])}`).join('\n')}`,
    };
  }

  if (name === 'aggiungi_nota_paziente') {
    const t = testo(input.testo, 2000, 'Nota');
    if (!t) throw new Error('Testo della nota obbligatorio');
    return { dati: { paziente_id: paz.id, testo: t }, before: null, summary: `Nota nella scheda di ${chi}\n"${t}"` };
  }

  if (name === 'crea_richiamo') {
    const categoria = input.categoria ?? 'generico';
    if (!CATEGORIE_RICHIAMO.includes(categoria)) throw new Error('Categoria del richiamo non valida');
    if (!dataValida(input.data_scadenza) || input.data_scadenza < oggi) throw new Error('Data del richiamo non valida o passata');
    const motivo = testo(input.motivo, 300, 'Motivo');
    return {
      dati: { paziente_id: paz.id, categoria, motivo, data_scadenza: input.data_scadenza },
      before: null,
      summary: `Richiamo per ${chi}\n${motivo || 'Richiamo'} (${categoria}), entro ${descriviData(input.data_scadenza)}`,
    };
  }

  throw new Error('Azione non supportata');
}

export async function executePazienti(client, proposal) {
  const { data, error } = await client.rpc('poliedron_execute_pazienti_v1', {
    p_id: proposal.id, p_studio: proposal.studioId, p_azione: proposal.name,
    p_dati: proposal.pazienti.dati, p_before: proposal.pazienti.before,
  });
  if (error) throw new Error(error.message);
  return { text: `Fatto.\n${proposal.pazienti.summary}`, changed: [TABELLA[proposal.name]], recordId: data };
}

export async function schedaPaziente(client, input, studioId) {
  const id = input.paziente_id;
  const { data: p, error } = await client.from('patients')
    .select('id, nome, cognome, data_nascita, telefono, email, indirizzo, comune, provincia, cf, note, annotazioni, consenso_whatsapp, consenso_whatsapp_il, anamnesi_allarme, anamnesi_compilata_il')
    .eq('studio_id', studioId).eq('id', id).maybeSingle();
  if (error || !p) return { error: 'Paziente non trovato' };
  const oggi = studioToday();
  const [{ data: richiami }, { data: appuntamenti }] = await Promise.all([
    client.from('richiami').select('id, categoria, motivo, data_scadenza').eq('studio_id', studioId).eq('paziente_id', id).eq('stato', 'da_fare').order('data_scadenza', { ascending: true }).limit(10),
    client.from('appointments').select('id, data, ora, tipo, stato').eq('studio_id', studioId).eq('paziente_id', id).gte('data', oggi).order('data', { ascending: true }).limit(5),
  ]);
  const { annotazioni, ...anagraficaPaziente } = p;
  return {
    ...anagraficaPaziente,
    ultime_note: (Array.isArray(annotazioni) ? annotazioni : []).slice(-10).map((n) => ({ data: n.data, testo: n.testo })),
    richiami_da_fare: richiami || [],
    prossimi_appuntamenti: (appuntamenti || []).filter((a) => a.stato !== 'annullato'),
    nota_anamnesi: p.anamnesi_allarme ? 'ATTENZIONE: anamnesi con segnalazioni. Per i dettagli apri la scheda nell\'app.' : null,
  };
}
