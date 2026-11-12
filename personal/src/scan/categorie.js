// SCAN-ORGANIZZA (PO 2026-11-12: «Prova con a b d») — categorie di «I miei documenti» (proposta B,
// come «I miei ID»): ogni documento ne ha una, scelta da sola dal nome, dall'origine (Carta d'identità)
// e dal testo letto dall'OCR; l'utente la può cambiare e allora resta la sua. Pure, testabili.

export const CATEGORIE = [
  { id: 'identita', nome: "Carta d'identità", sigla: 'CI', sfondo: '#e7ecfb', testo: '#101828', icona: '#3155c8' },
  { id: 'patente', nome: 'Patente', sigla: 'PA', sfondo: '#e2f3ea', testo: '#101828', icona: '#1d7a4c' },
  { id: 'sanitaria', nome: 'Tessera sanitaria e codice fiscale', sigla: 'TS', sfondo: '#f3eee2', testo: '#101828', icona: '#8a6a1b' },
  { id: 'passaporto', nome: 'Passaporto', sigla: 'PP', sfondo: '#a84e4e', testo: '#ffffff', icona: '#a84e4e' },
  { id: 'salute', nome: 'Referti e salute', sigla: 'RS', sfondo: '#2f6fd1', testo: '#ffffff', icona: '#2f6fd1' },
  { id: 'bollette', nome: 'Bollette', sigla: 'BO', sfondo: '#6d4bd6', testo: '#ffffff', icona: '#6d4bd6' },
  { id: 'spese', nome: 'Ricevute e spese', sigla: 'RI', sfondo: '#5b6472', testo: '#ffffff', icona: '#5b6472' },
  { id: 'certificati', nome: 'Certificati', sigla: 'CE', sfondo: '#f1e7f1', testo: '#101828', icona: '#8a3b8a' },
  { id: 'foto', nome: 'Foto tessera', sigla: 'FT', sfondo: '#fde8e7', testo: '#101828', icona: '#c0392b' },
  { id: 'generali', nome: 'Documenti generali', sigla: 'DG', sfondo: '#ffffff', testo: '#101828', icona: '#475467' },
];
export const categoria = (id) => CATEGORIE.find((c) => c.id === id) || CATEGORIE.at(-1);

const piega = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
// Ordine = priorità: i documenti d'identità prima delle parole generiche («totale», «ricevuta»).
const REGOLE = [
  ['passaporto', /\bpassaport|\bpassport\b/],
  ['patente', /\bpatente\b|driving licen[cs]e|permis de conduire/],
  ['identita', /carta d.?identita|\bc\.?i\.?e\b|identity card|carta identita/],
  ['sanitaria', /tessera sanitaria|codice fiscale|\bts-cns\b|tessera europea/],
  ['foto', /fototessera|foto tessera/],
  ['salute', /referto|ecografi|radiograf|analisi del sangue|esame|prescrizion|ricetta medica|visita|diagnosi|ospedal|\basl\b|\bausl\b|laboratorio|dentist|odontoiatr/],
  ['bollette', /bolletta|fornitura|\benel\b|\bhera\b|\biren\b|\ba2a\b|\beni plenitude\b|acquedotto|servizio idrico|\bgas\b|energia elettrica|\btari\b|telefonia|fibra/],
  ['certificati', /certificat|attestat|diploma|\bvisura\b|atto di nascita|stato di famiglia|residenza/],
  ['spese', /scontrino|ricevuta|fattura|documento commerciale|\btotale\b.*€|€.*\btotale\b|importo pagato|pagamento|\biva\b/],
];
// Origine nota (es. «Carta d'identità» di Scan con il tipo di tessera) vince sul resto.
const ORIGINI = { "Carta d'identità": 'identita', 'Patente di guida': 'patente', 'Tessera sanitaria': 'sanitaria' };

export function categoriaDa({ nome = '', testo = '', origine = '' } = {}) {
  for (const [prefisso, id] of Object.entries(ORIGINI)) if (String(nome).startsWith(prefisso) || origine === id) return id;
  const nomeP = piega(nome);
  for (const [id, re] of REGOLE) if (re.test(nomeP)) return id;
  const testoP = piega(testo).slice(0, 6000);
  for (const [id, re] of REGOLE) if (re.test(testoP)) return id;
  return 'generali';
}

// Scadenza (data AAAA-MM-GG) → avviso come nel portafoglio di Personal: scaduto / entro 90 giorni.
export function avvisoScadenza(data, oggi = new Date()) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data || '')) return null;
  const g = (d) => Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());
  const [a, m, gg] = data.split('-').map(Number);
  const giorni = Math.round((Date.UTC(a, m - 1, gg) - g(oggi)) / 86400000);
  if (giorni > 90) return null;
  return { giorni, scaduto: giorni < 0, testo: giorni < 0 ? 'scaduto' : giorni === 0 ? 'scade oggi' : `scade tra ${giorni} giorni` };
}

// Etichette: «#ecografia», senza spazi, minuscole, uniche, al massimo 10.
export function normalizzaEtichette(lista) {
  const out = [];
  for (const t of lista || []) {
    const e = piega(t).replace(/^#/, '').replace(/[^a-z0-9àèéìòù_-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 30);
    if (e && !out.includes(e)) out.push(e);
  }
  return out.slice(0, 10);
}
