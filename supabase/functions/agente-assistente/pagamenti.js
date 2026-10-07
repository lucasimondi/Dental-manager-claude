// POL-AI-010 passo 4a — pagamenti dalla chat di Poliedron.
// Stesso contratto di pazienti.js (prepare → riepilogo → execute), con una
// Safe Autonomy: un pagamento con paziente/importo/piano verificati si registra
// direttamente; possibili duplicati e ambiguità restano fail-closed.
//
// Semantica identica all'app (IncassoModal / incassiActions.js):
// - colonne `payments`: paziente_id, data, importo, metodo, nota, stato, piano_id;
// - metodi Contanti / Carta / Bonifico / POS / Assegno;
// - stato "pagato" (incassato: entra nei saldi e nel registro finanziario
//   tramite i trigger esistenti) oppure "sospeso" (da incassare);
// - collegamento al piano: un solo piano aperto → automatico; più piani
//   aperti → si chiede quale, mai indovinare (POL-FIN-003); nessuno → NULL.
// Nessuna formula di saldo qui: i saldi restano quelli del database.
import { studioToday } from './confirmation.js';

export const PAGAMENTI_WRITES = new Set(['registra_pagamento_paziente']);
export const METODI_PAGAMENTO = Object.freeze(['Contanti', 'Carta', 'Bonifico', 'POS', 'Assegno']);
export const STATI_PAGAMENTO = Object.freeze(['pagato', 'sospeso']);
const MAX_IMPORTO = 1_000_000;
const PIANI_CHIUSI = new Set(['concluso', 'rifiutato']);

export const PAGAMENTI_TOOLS = [
  {
    name: 'registra_pagamento_paziente',
    description: "Registra un pagamento di un paziente. Cerca prima il paziente con cerca_pazienti (se più pazienti corrispondono chiedi quale). stato: 'pagato' se il paziente HA pagato (incassato), 'sospeso' se DEVE ancora pagare. Se il paziente ha più piani di cura aperti e l'utente non dice quale, chiedi a quale piano collegarlo (piano_id). Non inventare importi, date o metodi.",
    input_schema: {
      type: 'object',
      properties: {
        paziente_id: { type: 'integer' },
        importo: { type: 'number', description: 'Euro, maggiore di zero.' },
        stato: { type: 'string', enum: STATI_PAGAMENTO, description: "Default 'pagato'." },
        metodo: { type: 'string', enum: METODI_PAGAMENTO, description: "Default 'Contanti' se l'utente non lo dice." },
        data: { type: 'string', description: 'YYYY-MM-DD, default oggi. Non nel futuro.' },
        piano_id: { type: 'integer', description: 'Piano di cura a cui collegarlo, se il paziente ne ha più di uno aperto.' },
        nota: { type: 'string', description: 'Facoltativa, es. la prestazione pagata.' },
      },
      required: ['paziente_id', 'importo'],
    },
  },
];

const RE_DATA = /^\d{4}-\d{2}-\d{2}$/;
const dataValida = (s) => RE_DATA.test(s || '') && new Date(`${s}T12:00:00Z`).toISOString().slice(0, 10) === s;
const euro = (n) => new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(n);
const descriviData = (iso) => new Intl.DateTimeFormat('it-IT', { timeZone: 'UTC', day: 'numeric', month: 'long', year: 'numeric' })
  .format(new Date(`${iso}T12:00:00Z`));
const pianoAperto = (p) => !PIANI_CHIUSI.has(String(p?.stato || '').toLowerCase());

/** Importo in euro con al massimo due decimali, oppure Error. */
export function normalizzaImporto(valore) {
  // "1.234,50" (italiano) oppure "1234.5" / numero.
  const testo = typeof valore === 'string' ? valore.replace(/[€\s]/g, '') : null;
  const n = testo == null ? Number(valore) : testo.includes(',') ? Number(testo.replace(/\./g, '').replace(',', '.')) : Number(testo);
  if (!Number.isFinite(n) || n <= 0) throw new Error('Importo non valido: deve essere maggiore di zero.');
  if (n > MAX_IMPORTO) throw new Error('Importo troppo alto: controlla la cifra.');
  return Math.round(n * 100) / 100;
}

/**
 * Sceglie il piano a cui collegare il pagamento, con la regola dell'app:
 * piano indicato → deve essere un piano aperto del paziente; altrimenti un
 * solo piano aperto → quello; più di uno → errore che elenca i piani; nessuno → null.
 */
export function scegliPiano(piani, pianoId) {
  const aperti = (piani || []).filter(pianoAperto);
  if (pianoId != null) {
    const scelto = (piani || []).find((p) => String(p.id) === String(pianoId));
    if (!scelto) throw new Error('Il piano indicato non è di questo paziente.');
    if (!pianoAperto(scelto)) throw new Error(`Il piano "${scelto.titolo || scelto.id}" è ${scelto.stato}: scegline uno aperto o registra senza piano.`);
    return scelto;
  }
  if (aperti.length === 1) return aperti[0];
  if (aperti.length > 1) {
    const elenco = aperti.map((p) => `${p.titolo || 'Piano'} (piano_id ${p.id}${p.data ? `, del ${p.data}` : ''})`).join('; ');
    throw new Error(`Il paziente ha più piani di cura aperti: chiedi all'utente a quale collegare il pagamento. Piani: ${elenco}.`);
  }
  return null;
}

export async function preparePagamenti(client, name, input = {}, studioId, observed) {
  if (name !== 'registra_pagamento_paziente') throw new Error('Azione non supportata');
  if (!observed.patients.has(input.paziente_id)) throw new Error('Cerca prima il paziente e chiedi quale scegliere in caso di omonimia.');
  const importo = normalizzaImporto(input.importo);
  const stato = input.stato ?? 'pagato';
  if (!STATI_PAGAMENTO.includes(stato)) throw new Error('Stato non valido: pagato o sospeso.');
  const metodo = input.metodo ?? 'Contanti';
  if (!METODI_PAGAMENTO.includes(metodo)) throw new Error(`Metodo non valido: ${METODI_PAGAMENTO.join(', ')}.`);
  const oggi = studioToday();
  const data = input.data ?? oggi;
  if (!dataValida(data) || data > oggi) throw new Error('Data non valida o nel futuro.');
  const nota = typeof input.nota === 'string' && input.nota.trim() ? input.nota.trim().slice(0, 500) : null;

  const [{ data: paz, error: errPaz }, { data: piani, error: errPiani }, { data: simili, error: errSimili }] = await Promise.all([
    client.from('patients').select('id, nome, cognome').eq('studio_id', studioId).eq('id', input.paziente_id).single(),
    client.from('plans').select('id, titolo, stato, data').eq('studio_id', studioId).eq('paziente_id', input.paziente_id),
    client.from('payments').select('id').eq('studio_id', studioId).eq('paziente_id', input.paziente_id).eq('importo', importo).eq('data', data).limit(1),
  ]);
  if (errPaz || !paz) throw new Error('Paziente non disponibile o accesso non consentito.');
  if (errPiani || errSimili) throw new Error('Non riesco a verificare piani e pagamenti del paziente. Nessuna modifica eseguita.');
  const piano = scegliPiano(piani, input.piano_id);

  const chi = `${paz.nome || ''} ${paz.cognome || ''}`.trim();
  const dati = { paziente_id: paz.id, importo, data, metodo, stato, nota, piano_id: piano?.id ?? null };
  const corpo = [
    `Paziente: ${chi}`,
    `Importo: ${euro(importo)}`,
    `Data: ${descriviData(data)}`,
    `Metodo: ${metodo}`,
    `Stato: ${stato === 'pagato' ? 'pagato (incassato)' : 'sospeso (da incassare)'}`,
    `Piano di cura: ${piano ? piano.titolo || `n. ${piano.id}` : 'nessuno'}`,
    nota ? `Nota: ${nota}` : null,
  ].filter(Boolean).join('\n');
  const avviso = simili?.length ? `Attenzione: per ${chi} c'è già un pagamento di ${euro(importo)} in questa data.` : null;
  return {
    dati,
    before: null,
    avviso,
    summary: `Registra pagamento\n${corpo}${avviso ? `\n${avviso}` : ''}`,
    done: `Pagamento registrato\n${corpo}`,
  };
}

export const nuovoIdPagamento = () => Date.now() + Math.floor(Math.random() * 99999);

/**
 * Registra il pagamento dopo la conferma: prima il claim (la stessa conferma
 * non può essere usata due volte), poi l'insert con il login dell'utente
 * (RLS per studio). Un errore dopo il claim non scrive nulla: si ripete con
 * una nuova richiesta.
 */
export async function executePagamenti(client, proposal) {
  const { error: errClaim } = await client.from('poliedron_action_claims').insert({
    id: proposal.id, studio_id: proposal.studioId, user_id: proposal.userId,
  });
  if (errClaim?.code === '23505') throw new Error('Questa operazione è già stata eseguita.');
  if (errClaim) throw new Error('Impossibile acquisire l'operazione. Nessun pagamento registrato.');
  const { dati } = proposal.pagamenti;
  // payments.id non ha un default nel database: lo genera chi scrive, con lo
  // stesso schema dell'app (uid() in src/lib/utils.js).
  const { data, error } = await client.from('payments')
    .insert({ id: nuovoIdPagamento(), ...dati, studio_id: proposal.studioId, user_id: proposal.userId })
    .select('id, paziente_id, piano_id, data, importo, metodo, nota, stato')
    .single();
  if (error || !data) throw new Error(error?.message || 'errore sconosciuto.');
  return {
    text: `Fatto. ${proposal.pagamenti.done}`,
    changed: ['payments'],
    recordId: data.id,
    records: { payments: [data] },
  };
}
