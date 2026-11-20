// AGENDA-ETICHETTE (PO 2026-11-20): «le impostazioni devono essere comuni in tutto il software
// anche personal, devo poter inserire nuove etichette in agenda, gli impegni devono poter essere
// ripetibili, ci deve essere etichetta compleanni».
// Una sola lista di etichette per l'agenda unica, salvata dove vivono gli impegni: nel database
// dello studio, dentro studio_info.agenda_settings.etichette (jsonb già esistente, niente
// migrazione). Studio e Personal leggono e scrivono la stessa lista.
// Funzioni pure, senza Supabase: usate da src/components/Agenda.jsx, Impostazioni dello studio
// e da Personal (personal/src/lib/agenda.js, impostazioni).

export const ETICHETTA_COMPLEANNI = Object.freeze({ id: 'compleanni', nome: 'Compleanni', colore: '#e11d48' });

export const ETICHETTE_BASE = Object.freeze([
  Object.freeze({ id: 'personale', nome: 'Personale', colore: '#64748b' }),
  Object.freeze({ id: 'famiglia', nome: 'Famiglia', colore: '#db2777' }),
  ETICHETTA_COMPLEANNI,
  Object.freeze({ id: 'ferie', nome: 'Ferie', colore: '#f59e0b' }),
  Object.freeze({ id: 'chiamata', nome: 'Chiamata', colore: '#8b5cf6' }),
  Object.freeze({ id: 'sport', nome: 'Sport', colore: '#059669' }),
  Object.freeze({ id: 'viaggio', nome: 'Viaggio', colore: '#0284c7' }),
  Object.freeze({ id: 'altro', nome: 'Altro', colore: '#6b7280' }),
]);

// Il campo impegni_personali.tipo è vincolato nel database: l'etichetta scelta va in `etichetta`,
// `tipo` resta uno dei quattro valori ammessi.
export const TIPI_DB = Object.freeze(['personale', 'ferie', 'chiamata', 'altro']);
export const tipoPerDb = (id) => (TIPI_DB.includes(id) ? id : 'personale');

const testo = (s) => String(s ?? '').trim();
export const slugEtichetta = (s) => testo(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'etichetta';
const coloreValido = (c, riserva = '#64748b') => (/^#[0-9a-f]{6}$/i.test(testo(c)) ? testo(c).toLowerCase() : riserva);

// Lista pulita: nomi non vuoti, niente doppioni (per id o per nome), colori validi.
// Se non c'è niente di salvato → le etichette di base. «Compleanni» c'è sempre.
export function normalizzaEtichette(lista, { aggiuntive = [] } = {}) {
  const sorgente = Array.isArray(lista) && lista.length ? lista : [...ETICHETTE_BASE, ...(Array.isArray(aggiuntive) ? aggiuntive : [])];
  const visti = new Set();
  const out = [];
  for (const e of sorgente) {
    if (!e || !testo(e.nome)) continue;
    const id = testo(e.id) || slugEtichetta(e.nome);
    const chiaveNome = testo(e.nome).toLowerCase();
    if (visti.has(id) || visti.has(`nome:${chiaveNome}`)) continue;
    visti.add(id); visti.add(`nome:${chiaveNome}`);
    out.push({ id, nome: testo(e.nome), colore: coloreValido(e.colore, ETICHETTE_BASE.find((b) => b.id === id)?.colore) });
  }
  if (!out.some((e) => e.id === ETICHETTA_COMPLEANNI.id)) out.push({ ...ETICHETTA_COMPLEANNI });
  return out;
}

export const etichetteDaImpostazioni = (agendaSettings) => normalizzaEtichette(agendaSettings?.etichette);

// Nuova etichetta con id unico rispetto a quelle esistenti.
export function nuovaEtichetta(esistenti, nome, colore) {
  const n = testo(nome);
  if (!n) throw new Error('Scrivi il nome dell’etichetta.');
  if (esistenti.some((e) => e.nome.toLowerCase() === n.toLowerCase())) throw new Error(`L’etichetta «${n}» c’è già.`);
  const base = slugEtichetta(n);
  let id = base;
  for (let i = 2; esistenti.some((e) => e.id === id); i += 1) id = `${base}_${i}`;
  return { id, nome: n, colore: coloreValido(colore, '#8460cc') };
}

// Un impegno può arrivare dallo studio (camelCase) o da Personal (snake_case).
const idEtichetta = (imp) => testo(imp?.etichetta) || testo(imp?.tipo) || 'personale';
export const etichettaImpegno = (imp, etichette) => {
  const id = idEtichetta(imp);
  return etichette.find((e) => e.id === id || e.nome.toLowerCase() === id.toLowerCase()) || null;
};
export const coloreImpegno = (imp, etichette, riserva = '#64748b') => imp?.colore || etichettaImpegno(imp, etichette)?.colore || riserva;
export const nomeEtichettaImpegno = (imp, etichette) => etichettaImpegno(imp, etichette)?.nome || idEtichetta(imp);

// Le ripetizioni: ogni occorrenza è un impegno a sé con lo stesso recurrence_id (come prima),
// così si modifica o si cancella anche una sola volta.
export const RIPETIZIONI = Object.freeze([
  ['nessuna', 'Non si ripete'],
  ['giornaliera', 'Ogni giorno'],
  ['settimanale', 'Ogni settimana'],
  ['quindicinale', 'Ogni 2 settimane'],
  ['mensile', 'Ogni mese'],
  ['annuale', 'Ogni anno'],
]);
// Fin dove ripetere se non si sceglie: un anno, i compleanni per 30 anni.
export const ANNI_PREDEFINITI = Object.freeze({ annuale: 30 });
export const MASSIMO_OCCORRENZE = 366;

const due = (n) => String(n).padStart(2, '0');
const isoLocale = (d) => `${d.getFullYear()}-${due(d.getMonth() + 1)}-${due(d.getDate())}`;
const daIsoLocale = (s) => { const [a, m, g] = s.split('-').map(Number); return new Date(a, m - 1, g, 12); };

export function fineRipetizionePredefinita(dataInizio, frequenza) {
  if (!dataInizio || !frequenza || frequenza === 'nessuna') return dataInizio || '';
  const d = daIsoLocale(dataInizio);
  d.setFullYear(d.getFullYear() + (ANNI_PREDEFINITI[frequenza] || 1));
  d.setDate(d.getDate() - 1);
  return isoLocale(d);
}

// Date delle occorrenze, prima compresa, fino a `finoAl` incluso. Mesi e anni restano sul giorno
// di partenza (31 → ultimo giorno del mese; 29 febbraio → 28 negli anni non bisestili).
export function dateRipetizione(dataInizio, finoAl, frequenza, massimo = MASSIMO_OCCORRENZE) {
  if (!dataInizio) return [];
  if (!frequenza || frequenza === 'nessuna' || frequenza === 'no') return [dataInizio];
  if (!finoAl || finoAl < dataInizio) return [];
  const passi = { giornaliera: 1, settimanale: 7, quindicinale: 14, due_settimane: 14 };
  const mesi = { mensile: 1, annuale: 12 };
  if (!passi[frequenza] && !mesi[frequenza]) return [];
  const limite = Math.max(1, Math.min(MASSIMO_OCCORRENZE, Number(massimo) || MASSIMO_OCCORRENZE));
  const inizio = daIsoLocale(dataInizio);
  const giorno = inizio.getDate();
  const out = [];
  for (let i = 0; out.length < limite; i += 1) {
    let d;
    if (mesi[frequenza]) {
      d = new Date(inizio.getFullYear(), inizio.getMonth() + i * mesi[frequenza], 1, 12);
      const ultimo = new Date(d.getFullYear(), d.getMonth() + 1, 0, 12).getDate();
      d.setDate(Math.min(giorno, ultimo));
    } else {
      d = new Date(inizio.getFullYear(), inizio.getMonth(), inizio.getDate() + i * passi[frequenza], 12);
    }
    const data = isoLocale(d);
    if (data > finoAl) break;
    out.push(data);
  }
  return out;
}

// Quanti giorni dopo l'inizio finisce un impegno di più giorni (per ripeterlo uguale).
export function durataGiorni(dataInizio, dataFine) {
  if (!dataInizio || !dataFine || dataFine <= dataInizio) return 0;
  return Math.round((daIsoLocale(dataFine) - daIsoLocale(dataInizio)) / 86400000);
}
export function piuGiorniIso(data, n) {
  const d = daIsoLocale(data);
  d.setDate(d.getDate() + n);
  return isoLocale(d);
}
