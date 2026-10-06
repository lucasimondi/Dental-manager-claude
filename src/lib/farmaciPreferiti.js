/* POL-UI-044 — scorciatoie per i farmaci più usati nella Ricetta.
   La lista dello studio vive in `studio_info.farmaci_preferiti` (jsonb,
   condivisa da tutti gli utenti dello studio, stessa RLS del resto di
   studio_info). Finché uno studio non la modifica la colonna è NULL e si
   usa la lista iniziale qui sotto — solo per le professioni che possono
   prescrivere e solo per l'odontoiatria (i dosaggi sono clinicamente
   specifici, come PROTOCOLLI_PREDEFINITI in DocMedico). Una lista salvata
   vuota ([]) resta vuota: è una scelta dello studio, non un "non
   configurato". */

export const MAX_FARMACI_PREFERITI = 60;
const MAX_LEN = { farmaco: 120, dosaggio: 80, posologia: 200, durata: 80, note: 200 };
const CAMPI = Object.keys(MAX_LEN);

// Punto di partenza modificabile da Impostazioni → Documenti: dosaggi e
// posologie vanno sempre verificati dal professionista.
export const FARMACI_PREFERITI_DEFAULT = Object.freeze([
  { id: 'def_amoxicillina', farmaco: 'Amoxicillina 1 g', dosaggio: '1 g', posologia: '1 compressa ogni 8 ore', durata: 'Per 6 giorni', note: '' },
  { id: 'def_augmentin', farmaco: 'Amoxicillina + acido clavulanico (Augmentin)', dosaggio: '875 mg + 125 mg', posologia: '1 compressa ogni 12 ore, all\'inizio dei pasti', durata: 'Per 6 giorni', note: '' },
  { id: 'def_clindamicina', farmaco: 'Clindamicina 300 mg', dosaggio: '300 mg', posologia: '1 capsula ogni 8 ore', durata: 'Per 6 giorni', note: 'In caso di allergia alle penicilline' },
  { id: 'def_zitromax', farmaco: 'Zitromax (azitromicina) 500 mg', dosaggio: '500 mg', posologia: '1 compressa al giorno', durata: 'Per 3 giorni', note: '' },
  { id: 'def_ibuprofene', farmaco: 'Ibuprofene 600 mg', dosaggio: '600 mg', posologia: '1 compressa ogni 8 ore a stomaco pieno, al bisogno', durata: 'Per 3 giorni', note: '' },
  { id: 'def_paracetamolo', farmaco: 'Paracetamolo 1000 mg', dosaggio: '1000 mg', posologia: '1 compressa ogni 8 ore, al bisogno', durata: 'Per 3 giorni', note: 'Non superare 3 g al giorno' },
  { id: 'def_ketoprofene', farmaco: 'Ketoprofene sale di lisina 80 mg', dosaggio: '80 mg', posologia: '1 bustina ogni 12 ore a stomaco pieno, al bisogno', durata: 'Per 3 giorni', note: '' },
  { id: 'def_toradol', farmaco: 'Toradol (ketorolac) 10 mg', dosaggio: '10 mg', posologia: '1 compressa ogni 6-8 ore a stomaco pieno, al bisogno', durata: 'Massimo 5 giorni', note: 'Non superare 40 mg al giorno' },
  { id: 'def_pantoprazolo', farmaco: 'Pantoprazolo 20 mg', dosaggio: '20 mg', posologia: '1 compressa al mattino a digiuno', durata: 'Per tutta la durata della terapia', note: 'Gastroprotezione' },
  { id: 'def_enteroboulardi', farmaco: 'Enteroboulardi', dosaggio: '', posologia: '1 capsula al giorno, lontano dall\'antibiotico', durata: 'Per tutta la durata della terapia antibiotica', note: '' },
  { id: 'def_xanax', farmaco: 'Xanax (alprazolam) 0,25 mg', dosaggio: '0,25 mg', posologia: '1 compressa la sera prima e 1 compressa 1 ora prima dell\'intervento', durata: '', note: 'Non guidare dopo l\'assunzione' },
  { id: 'def_clorexidina', farmaco: 'Clorexidina collutorio 0,20%', dosaggio: '10 ml', posologia: 'Sciacqui per 1 minuto, 2 volte al giorno', durata: 'Per 7 giorni', note: 'Non sciacquare con acqua subito dopo' },
]);

const testo = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

/** Pulisce una voce (campi stringa troncati, id garantito). null se manca il nome. */
export function normalizzaFarmacoPreferito(voce, idFallback) {
  if (!voce || typeof voce !== 'object') return null;
  const out = {};
  for (const campo of CAMPI) out[campo] = testo(voce[campo], MAX_LEN[campo]);
  if (!out.farmaco) return null;
  const id = typeof voce.id === 'string' && voce.id.trim() ? voce.id.trim().slice(0, 64) : idFallback;
  return { id: id || `fp_${out.farmaco.toLowerCase().replace(/[^a-z0-9]+/g, '_')}`, ...out };
}

/** Lista pulita e senza id duplicati, al massimo MAX_FARMACI_PREFERITI voci. */
export function normalizzaListaFarmaciPreferiti(lista) {
  if (!Array.isArray(lista)) return [];
  const visti = new Set();
  const out = [];
  lista.forEach((voce, i) => {
    const pulita = normalizzaFarmacoPreferito(voce, `fp_${i}`);
    if (!pulita) return;
    let id = pulita.id;
    while (visti.has(id)) id = `${id}_${i}`;
    visti.add(id);
    out.push({ ...pulita, id });
  });
  return out.slice(0, MAX_FARMACI_PREFERITI);
}

/** Lista effettiva per lo studio: quella salvata, altrimenti la iniziale (solo odontoiatria). */
export function resolveFarmaciPreferiti(si) {
  if (Array.isArray(si?.farmaci_preferiti)) return normalizzaListaFarmaciPreferiti(si.farmaci_preferiti);
  const isDentistico = !si?.vertical || si.vertical === 'dentistico';
  return isDentistico ? FARMACI_PREFERITI_DEFAULT.map((v) => ({ ...v })) : [];
}

const norm = (v) => String(v || '').trim().toLowerCase().replace(/\s+/g, ' ');
const rigaVuota = (f) => !['farmaco', 'dosaggio', 'posologia', 'durata', 'note'].some((k) => String(f?.[k] || '').trim());

/**
 * Applica una scorciatoia alle righe "Farmaci prescritti" della ricetta:
 * riempie la prima riga ancora vuota, altrimenti ne aggiunge una. Se lo
 * stesso farmaco è già in ricetta non lo duplica (restituisce la stessa lista).
 */
export function applicaFarmacoPreferito(farmaci, preferito) {
  const lista = Array.isArray(farmaci) ? farmaci : [];
  if (!preferito?.farmaco) return lista;
  if (lista.some((f) => norm(f.farmaco) === norm(preferito.farmaco))) return lista;
  const riga = { farmaco: preferito.farmaco, dosaggio: preferito.dosaggio || '', posologia: preferito.posologia || '', durata: preferito.durata || '', note: preferito.note || '' };
  const vuota = lista.findIndex(rigaVuota);
  return vuota >= 0 ? lista.map((f, i) => (i === vuota ? riga : f)) : [...lista, riga];
}

/**
 * POL-AI-009: unisce i farmaci di una ricetta preparata da Poliedron alle
 * righe già presenti. Lo stesso farmaco già in ricetta viene sostituito con
 * i dati di Poliedron (il medico li ha appena dettati); gli altri riempiono
 * le righe vuote o si aggiungono in fondo.
 */
export function unisciFarmaciPreparati(farmaci, preparati) {
  let lista = Array.isArray(farmaci) ? [...farmaci] : [];
  for (const p of Array.isArray(preparati) ? preparati : []) {
    if (!String(p?.farmaco || '').trim()) continue;
    const riga = { farmaco: p.farmaco.trim(), dosaggio: p.dosaggio || '', posologia: p.posologia || '', durata: p.durata || '', note: p.note || '' };
    const uguale = lista.findIndex((f) => norm(f.farmaco) === norm(riga.farmaco));
    if (uguale >= 0) { lista = lista.map((f, i) => (i === uguale ? riga : f)); continue; }
    const vuota = lista.findIndex(rigaVuota);
    lista = vuota >= 0 ? lista.map((f, i) => (i === vuota ? riga : f)) : [...lista, riga];
  }
  return lista;
}
