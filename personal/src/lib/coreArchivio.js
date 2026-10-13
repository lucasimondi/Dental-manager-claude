// POL-VITA-001 — Core deterministico di Poliedron Personal.
// Capisce le richieste più comuni sull'archivio senza modello AI (decisione PO:
// "poliedron da solo deve comunque permettermi la ricerca e le azioni").
// Funzione pura: nessun accesso a rete o database.

const pulisci = (testo = '') => String(testo)
  .toLocaleLowerCase('it-IT')
  .normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/[’`]/g, "'")
  .replace(/[?!.,;:]+/g, ' ')
  .replace(/\s+/g, ' ')
  .trim();

// Parole con cui il PO chiama i fascicoli → codice in `fascicoli`.
const SINONIMI_FASCICOLI = [
  ['utenze', /\b(utenz\w*|bollett\w*|luce|gas|acqua|telefon\w*|internet)\b/],
  ['fiscale', /\b(fisc\w*|tass\w*|imposte?|agenzia (?:delle )?entrate|f24|730|irpef|imu|tari)\b/],
  ['conti', /\b(conti?|banc\w*|estratt\w* cont\w*)\b/],
  ['assicurazioni', /\b(assicuraz\w*|poliz\w*)\b/],
  ['legale', /\b(legal\w*|avvocat\w*|diffid\w*|contenzios\w*|decreti? ingiuntiv\w*)\b/],
  ['famiglia_scuola', /\b(scuol\w*|famiglia|figli\w*)\b/],
  ['immobili', /\b(cas[ae]|immobil\w*|catast\w*|condomin\w*|affitt\w*)\b/],
  ['veicoli', /\b(auto|veicol\w*|bollo auto|moto|multe?)\b/],
  ['previdenza', /\b(enpam|previdenz\w*|pension\w*|inps)\b/],
  ['successione', /\b(successi\w*|eredit\w*)\b/],
  ['identita', /\b(identita|carta d'identita|passaport\w*|patent\w*|codice fiscale)\b/],
  ['sanitario_famiglia', /\b(sanitar\w*|medic\w*|analisi|referti?)\b/],
  ['studio_fornitori', /\b(fornitor\w*)\b/],
  ['studio_fatture_emesse', /\b(fatture emesse|fatture? (?:mie|dello studio))\b/],
  ['servizi', /\b(abbonament\w*|servizi)\b/],
  ['acquisti', /\b(acquist\w*|ordini|amazon)\b/],
];

const RIEMPITIVI = /\b(cerca(?:mi)?|trova(?:mi)?|mostra(?:mi)?|fammi vedere|dov'e|dove (?:e|sta)|dammi|apri|il|lo|la|i|gli|le|un|una|uno|del|della|dello|dei|delle|di|documento|documenti|file|pdf|mail|email)\b/g;

const giorniPeriodo = (q) => {
  if (/\boggi\b/.test(q)) return 0;
  if (/\bdomani\b/.test(q)) return 1;
  if (/\b(questa|prossima) settimana\b|\b7 giorni\b/.test(q)) return 7;
  if (/\b(questo|prossimo) mese\b|\b30 giorni\b/.test(q)) return 30;
  const n = q.match(/\bentro (\d{1,3}) giorni\b/);
  return n ? Number(n[1]) : null;
};

export function fascicoloDaTesto(testo) {
  const q = pulisci(testo);
  for (const [codice, re] of SINONIMI_FASCICOLI) if (re.test(q)) return codice;
  return null;
}

export function capisciRichiesta(testo = '') {
  const q = pulisci(testo);
  if (!q) return { intento: 'VUOTO' };

  const debito = q.match(/^(?:quanto (?:devo|dobbiamo|resta da pagare)|cosa devo|debito con|quanto ho da pagare)\s+(?:all'|(?:alla|allo|agli|alle|ad|al|a|con|per)\s+)(.+)$/);
  if (debito) return { intento: 'DEBITO', controparte: debito[1].trim() };

  if (/\b(scadenz\w*|(?:devo|c'e da) pagare|da pagare|pagamenti in sospeso|cosa scade)\b/.test(q)) {
    return { intento: 'SCADENZE', entroGiorni: giorniPeriodo(q) };
  }

  if (/\b(cosa devo fare|azioni|urgent\w*|da gestire|da fare)\b/.test(q)) return { intento: 'AZIONI' };

  const pratica = q.match(/^(?:apri |mostra(?:mi)? )?(?:la )?pratica\s+(.+)$/);
  if (pratica) return { intento: 'PRATICA', testo: pratica[1].trim() };
  if (/^(?:le )?(?:mie )?pratiche(?: aperte)?$/.test(q)) return { intento: 'PRATICHE' };

  // Fascicolo intero solo se la richiesta non contiene altro oltre al nome del fascicolo
  // ("bollette", "mostrami le polizze"); "diffida condominio" resta una ricerca.
  const fascicolo = fascicoloDaTesto(q);
  if (fascicolo) {
    const re = new RegExp(SINONIMI_FASCICOLI.find(([c]) => c === fascicolo)[1].source, 'g');
    const resto = q.replace(re, ' ').replace(RIEMPITIVI, ' ').replace(/\b(tutt[ie]|mie|miei|fascicolo|cartella)\b/g, ' ').trim();
    if (!resto) return { intento: 'FASCICOLO', fascicolo };
  }

  const testoRicerca = q.replace(RIEMPITIVI, ' ').replace(/\s+/g, ' ').trim() || q;
  return { intento: 'CERCA', testo: testoRicerca };
}

export const euro = (n) => (n == null || Number.isNaN(Number(n)) ? '—'
  : Number(n).toLocaleString('it-IT', { style: 'currency', currency: 'EUR' }));

// Riepilogo "Quanto devo a X?" a partire dalle scadenze aperte dei documenti trovati.
export function riepilogoDebito(nomeControparte, scadenze = []) {
  const controparte = String(nomeControparte).replace(/(^|\s)\S/g, (c) => c.toLocaleUpperCase('it-IT'));
  const aperte = scadenze.filter((s) => !s.completata);
  const conImporto = aperte.filter((s) => s.importo != null);
  const totale = conImporto.reduce((t, s) => t + Number(s.importo), 0);
  const prossima = [...aperte].sort((a, b) => String(a.data).localeCompare(String(b.data)))[0] || null;
  let frase;
  if (!aperte.length) frase = `Nessuna scadenza aperta registrata per ${controparte}.`;
  else {
    frase = `${controparte}: ${euro(totale)} da pagare in ${aperte.length} scadenz${aperte.length === 1 ? 'a' : 'e'}`;
    if (conImporto.length < aperte.length) frase += ` (${aperte.length - conImporto.length} senza importo)`;
    if (prossima) frase += `. Prossima: ${new Date(`${prossima.data}T00:00:00`).toLocaleDateString('it-IT')}`;
    frase += '.';
  }
  return { totale, aperte, prossima, frase };
}
