// Poliedron assistente personale (PO 2026-10-18: "deve essere la mia assistente personale").
// Qui solo logica pura: agenda da mandare all'AI (mai i pazienti), domande sulla giornata che
// l'app risponde da sola, promemoria proposti da Poliedron e confermati da Luca con un tasto.
import { daIso, piuGiorni } from './agenda.js';

const GIORNI = ['domenica', 'lunedì', 'martedì', 'mercoledì', 'giovedì', 'venerdì', 'sabato'];
const nomeGiorno = (s) => `${GIORNI[daIso(s).getDay()]} ${daIso(s).toLocaleDateString('it-IT', { day: 'numeric', month: 'long' })}`;

export const SUGGERIMENTI_ASSISTENTE = [
  'Cosa ho oggi?',
  'Cosa devo pagare questa settimana?',
  'Ricordami di pagare il bollo auto il 30',
  'Trova depliant e pubblicità da eliminare',
];

export function benvenuto(ora = new Date().getHours()) {
  const saluto = ora < 13 ? 'Buongiorno' : ora < 18 ? 'Buon pomeriggio' : 'Buonasera';
  return `${saluto} Luca, sono Poliedron, la tua assistente personale. Tengo d'occhio agenda, pagamenti, documenti e pratiche: chiedimi cosa hai in programma, cosa devi pagare o di ricordarti qualcosa. Con la graffetta mi mandi una foto o un PDF e ci penso io.`;
}

/**
 * Testo dell'agenda per l'AI: gli impegni personali con titolo e orario; dello studio solo quanti
 * appuntamenti e la fascia oraria, mai i nomi dei pazienti né le note.
 */
export function agendaPerAssistente({ da, giorni = 7, impegni = [], appuntamenti = [] }) {
  const righe = [];
  for (let i = 0; i < giorni; i += 1) {
    const g = piuGiorni(da, i);
    const propri = impegni.filter((e) => e.data_inizio <= g && (e.data_fine || e.data_inizio) >= g)
      .map((e) => (e.tutto_il_giorno || !e.ora_inizio ? e.titolo : `${String(e.ora_inizio).slice(0, 5)} ${e.titolo}`));
    const studio = appuntamenti.filter((a) => a.data === g && a.stato !== 'annullato').map((a) => String(a.ora || '').slice(0, 5)).filter(Boolean).sort();
    const parti = [];
    if (studio.length) parti.push(`studio: ${studio.length} ${studio.length === 1 ? 'appuntamento' : 'appuntamenti'} ${studio[0]}–${studio[studio.length - 1]}`);
    if (propri.length) parti.push(`impegni: ${propri.join('; ')}`);
    righe.push(`${nomeGiorno(g)} (${g}): ${parti.length ? parti.join(' · ') : 'libero'}`);
  }
  return righe.join('\n');
}

// "Cosa ho oggi / domani / questa settimana?": l'app risponde da sola, anche senza AI.
export function giornataRichiesta(testo, oggi) {
  const t = String(testo || '').toLowerCase();
  if (!/\b(cosa|che) (ho|c'è|c’è|devo fare)|\bagenda\b|\bimpegni\b|\bprogramma\b|\bappuntamenti\b/.test(t)) return null;
  if (/\bpag|\bscad|\bbollett|\bdocument|\bpratic/.test(t)) return null;
  if (/dopodomani/.test(t)) return { da: piuGiorni(oggi, 2), a: piuGiorni(oggi, 2), titolo: 'Dopodomani' };
  if (/domani/.test(t)) return { da: piuGiorni(oggi, 1), a: piuGiorni(oggi, 1), titolo: 'Domani' };
  if (/settimana/.test(t)) return { da: oggi, a: piuGiorni(oggi, 6), titolo: 'Prossimi 7 giorni' };
  if (/\boggi\b|\bstamattina\b|\bstasera\b|\bagenda\b|\bimpegni\b|\bprogramma\b|\bappuntamenti\b/.test(t)) return { da: oggi, a: oggi, titolo: 'Oggi' };
  return null;
}

export const giorniTraDate = (da, a) => {
  const out = [];
  for (let g = da; g <= a; g = piuGiorni(g, 1)) out.push(g);
  return out;
};

// Scheda di un promemoria proposto: campi modificabili prima di aggiungerlo.
export function promemoriaIniziale(p) {
  return {
    cosa: p.cosa === 'pagamento' ? 'pagamento' : 'evento',
    titolo: p.titolo || '',
    data: p.data || '',
    ora: p.ora || '',
    ora_fine: p.ora_fine || '',
    importo: p.importo ?? '',
    categoria: p.categoria || '',
    ricorrenza: p.ricorrenza || '',
    note: p.note || '',
  };
}

const piuUnOra = (ora) => { const [h, m] = ora.split(':').map(Number); return `${String(Math.min(h + 1, 23)).padStart(2, '0')}:${String(m).padStart(2, '0')}`; };

/**
 * Aggiunge il promemoria confermato: pagamento → Da pagare (archivio); evento → agenda personale
 * (database dello studio, visibile anche lì come gli altri impegni). Le funzioni si passano da fuori.
 */
export async function aggiungiPromemoria(m, { nuovaScadenza, salvaImpegno }) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(m.data)) throw new Error('Scegli la data.');
  if (!String(m.titolo || '').trim()) throw new Error('Scrivi cosa ricordare.');
  if (m.cosa === 'pagamento') {
    await nuovaScadenza({ data: m.data, descrizione: m.titolo, importo: m.importo, categoria: m.categoria, ricorrenza: m.ricorrenza || null });
    return `Aggiunto a Da pagare per ${nomeGiorno(m.data)}`;
  }
  const conOra = /^\d{2}:\d{2}$/.test(m.ora || '');
  await salvaImpegno({
    titolo: m.titolo, tipo: 'personale', data_inizio: m.data, data_fine: m.data, tutto_il_giorno: !conOra,
    ora_inizio: conOra ? m.ora : null, ora_fine: conOra ? (/^\d{2}:\d{2}$/.test(m.ora_fine || '') && m.ora_fine > m.ora ? m.ora_fine : piuUnOra(m.ora)) : null,
    note: m.note || null,
  });
  return `In agenda ${nomeGiorno(m.data)}${conOra ? ` alle ${m.ora}` : ''}`;
}
