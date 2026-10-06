// POL-AI-009: Poliedron ricorda e prepara documenti.
// Logica pura (niente rete, niente database), testata da
// tests/poliedronMemoriaRicette.test.mjs.
//
// - Memoria: `ricorda` / `dimentica` scrivono nella tabella
//   public.poliedron_memoria dell'utente (con il suo login, sotto RLS); le
//   voci vengono rilette a ogni richiesta e messe nel prompt.
// - Ricetta: `prepara_ricetta` non genera né salva nulla. Restituisce all'app
//   i farmaci, e l'app apre il modulo Ricetta già compilato: il medico
//   controlla e genera lui il PDF (Master Context: l'AI non finalizza atti
//   clinici).

export const CATEGORIE_MEMORIA = Object.freeze(['preferenza', 'prescrizione', 'studio', 'altro']);
export const MAX_TESTO_MEMORIA = 500;
export const MAX_CARATTERI_MEMORIA_PROMPT = 6000;
export const MAX_FARMACI_RICETTA = 10;
const MAX_CAMPO = { farmaco: 120, dosaggio: 80, posologia: 200, durata: 80, note: 200 };

const testo = (valore, max) => (typeof valore === 'string' ? valore.replace(/[\u0000-\u001f]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max) : '');

/** Chiave stabile per un farmaco: una sola voce di memoria per farmaco. Identica a src/lib/poliedron/memoryRepository.js. */
export function chiaveFarmaco(nome) {
  const pulito = testo(nome, 120).toLowerCase();
  return pulito ? `farmaco:${pulito}` : null;
}

/** Testo della voce di memoria per una posologia abituale. Identico a src/lib/poliedron/memoryRepository.js. */
export function testoPrescrizione(f) {
  const nome = testo(f?.farmaco, MAX_CAMPO.farmaco);
  if (!nome) return '';
  const dettagli = [
    testo(f.dosaggio, MAX_CAMPO.dosaggio) && `dosaggio ${testo(f.dosaggio, MAX_CAMPO.dosaggio)}`,
    testo(f.posologia, MAX_CAMPO.posologia),
    testo(f.durata, MAX_CAMPO.durata),
    testo(f.note, MAX_CAMPO.note) && `note: ${testo(f.note, MAX_CAMPO.note)}`,
  ].filter(Boolean);
  return `${nome}: ${dettagli.join(', ') || 'nessun dettaglio'}`.slice(0, MAX_TESTO_MEMORIA);
}

export const STRUMENTI_MEMORIA = Object.freeze([
  {
    name: 'ricorda',
    description: "Salva qualcosa da ricordare in tutte le conversazioni future con questo utente: preferenze (come vuole le risposte, abitudini), posologie che usa di solito, informazioni stabili sullo studio. Usalo quando l'utente te lo chiede o ti corregge su qualcosa che vale anche in futuro. Non salvare dati clinici di un singolo paziente (quelli vanno nella sua scheda) né dati temporanei.",
    input_schema: {
      type: 'object',
      properties: {
        testo: { type: 'string', description: 'Cosa ricordare, in una frase chiara (max 500 caratteri).' },
        categoria: { type: 'string', enum: CATEGORIE_MEMORIA },
        farmaco: { type: 'string', description: 'Solo per categoria prescrizione: nome del farmaco, così la nuova posologia sostituisce la precedente.' },
      },
      required: ['testo', 'categoria'],
    },
  },
  {
    name: 'dimentica',
    description: "Cancella una voce della memoria (id dall'elenco 'Cosa ricordi di questo utente'), quando l'utente chiede di dimenticarla o non è più vera.",
    input_schema: {
      type: 'object',
      properties: { id: { type: 'integer' } },
      required: ['id'],
    },
  },
]);

export const STRUMENTO_RICETTA = Object.freeze({
  name: 'prepara_ricetta',
  description: "Prepara una ricetta medica: apre all'utente il modulo Ricetta del paziente già compilato, che il medico controlla e poi genera. Trova prima il paziente con cerca_pazienti; se più pazienti corrispondono chiedi quale. Usa i farmaci, i dosaggi, le posologie e le durate detti dal medico. Se il medico non dice posologia o durata e nella memoria o nei farmaci frequenti dello studio c'è quella abituale per quel farmaco, usala e dillo nella risposta ('ho usato la posologia che usi di solito'); se non c'è, lascia il campo vuoto e segnalalo. Non inventare mai farmaci o dosi. Non dire che la ricetta è stata generata o inviata: è pronta da verificare.",
  input_schema: {
    type: 'object',
    properties: {
      paziente_id: { type: 'integer', description: 'ID del paziente (da cerca_pazienti).' },
      farmaci: {
        type: 'array',
        minItems: 1,
        maxItems: MAX_FARMACI_RICETTA,
        items: {
          type: 'object',
          properties: {
            farmaco: { type: 'string', description: "Nome commerciale o principio attivo, con la forma se detta (es. 'Amoxicillina 1 g')." },
            dosaggio: { type: 'string' },
            posologia: { type: 'string', description: "Es. '1 compressa ogni 8 ore'." },
            durata: { type: 'string', description: "Es. 'Per 6 giorni'." },
            note: { type: 'string' },
          },
          required: ['farmaco'],
        },
      },
    },
    required: ['paziente_id', 'farmaci'],
  },
});

/** Input di `ricorda` → riga da salvare. Lancia un Error leggibile dal modello. */
export function normalizzaMemoria(input) {
  const contenuto = testo(input?.testo, MAX_TESTO_MEMORIA);
  if (!contenuto) throw new Error('Testo da ricordare mancante.');
  const categoria = CATEGORIE_MEMORIA.includes(input?.categoria) ? input.categoria : 'altro';
  const chiave = categoria === 'prescrizione' && input?.farmaco ? chiaveFarmaco(input.farmaco) : null;
  return { categoria, chiave, testo: contenuto };
}

/** Sezione del prompt con le voci più recenti, entro un tetto di caratteri. */
export function sezioneMemoria(righe) {
  if (!Array.isArray(righe) || righe.length === 0) {
    return "\n\n## Cosa ricordi di questo utente\n\nAncora niente. Quando l'utente ti dice qualcosa che vale anche in futuro (o ti corregge), salvalo con lo strumento ricorda.";
  }
  const linee = [];
  let totale = 0;
  for (const r of righe) {
    const linea = `- [${r.id}] (${r.categoria}) ${testo(r.testo, MAX_TESTO_MEMORIA)}`;
    if (totale + linea.length > MAX_CARATTERI_MEMORIA_PROMPT) break;
    linee.push(linea);
    totale += linea.length + 1;
  }
  return `\n\n## Cosa ricordi di questo utente\n\nLo hai imparato dalle conversazioni e dalle ricette che ha fatto. Usalo senza ripeterlo ogni volta; se una voce non è più vera, aggiornala (ricorda) o cancellala (dimentica).\n${linee.join('\n')}`;
}

/** Farmaci frequenti dello studio (Impostazioni → Documenti) come riferimento per le ricette. */
export function sezioneFarmaciFrequenti(lista) {
  if (!Array.isArray(lista) || lista.length === 0) return '';
  const linee = lista.slice(0, 60).map((f) => `- ${testoPrescrizione(f)}`).filter((l) => l.length > 2);
  if (!linee.length) return '';
  return `\n\n## Farmaci frequenti dello studio\n\nPosologie predefinite dello studio, da usare in prepara_ricetta solo quando il medico non ne dice una diversa:\n${linee.join('\n')}`;
}

/** Input di `prepara_ricetta` → { pazienteId, farmaci }. Lancia un Error leggibile dal modello. */
export function normalizzaRicetta(input) {
  const pazienteId = Number(input?.paziente_id);
  if (!Number.isSafeInteger(pazienteId) || pazienteId <= 0) throw new Error('paziente_id mancante: cerca prima il paziente.');
  if (!Array.isArray(input?.farmaci)) throw new Error('Indica almeno un farmaco.');
  const farmaci = input.farmaci.slice(0, MAX_FARMACI_RICETTA).map((f) => ({
    farmaco: testo(f?.farmaco, MAX_CAMPO.farmaco),
    dosaggio: testo(f?.dosaggio, MAX_CAMPO.dosaggio),
    posologia: testo(f?.posologia, MAX_CAMPO.posologia),
    durata: testo(f?.durata, MAX_CAMPO.durata),
    note: testo(f?.note, MAX_CAMPO.note),
  })).filter((f) => f.farmaco);
  if (!farmaci.length) throw new Error('Indica almeno un farmaco.');
  return { pazienteId, farmaci };
}

/** Il documento che l'app aprirà: solo id e campi del modulo, nessun PDF. */
export function documentoRicetta(paziente, farmaci) {
  return {
    tipo: 'ricetta',
    paziente_id: paziente.id,
    paziente_nome: [paziente.nome, paziente.cognome].filter(Boolean).join(' '),
    farmaci,
  };
}
