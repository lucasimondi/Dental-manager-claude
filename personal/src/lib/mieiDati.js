// MIEI-DATI (PO 2026-11-25): i dati di Luca e delle sue società pronti da copiare (fatturazione, contatti, banca)
// con i consulenti che le seguono. Qui solo dati e testo, senza React: l'app e i test usano le stesse funzioni.
const esito = ({ data, error }) => { if (error) throw new Error(error.message); return data; };

export const GRUPPI = [
  ['fatturazione', 'Dati di fatturazione'],
  ['contatti', 'Contatti'],
  ['banca', 'Banca'],
  ['altro', 'Altro'],
];
export const TIPI = [['societa', 'Società'], ['persona', 'Persona'], ['altro', 'Altro']];
export const COLORI = ['blu', 'ambra', 'verde', 'viola', 'cielo', 'rosa'];
export const CAMPI_PERSONA = [['ruolo', 'Ruolo'], ['nome', 'Nome'], ['studio', 'Studio / indirizzo'], ['email', 'Email'], ['pec', 'PEC'], ['telefono', 'Telefono'], ['note', 'Note']];

const pulito = (s) => String(s ?? '').replace(/\s+/g, ' ').trim();

// Campi base di una scheda nuova: si compilano subito, quelli vuoti restano da compilare.
const BASE = {
  societa: [['fatturazione', 'Ragione sociale'], ['fatturazione', 'Sede legale'], ['fatturazione', 'Partita IVA'], ['fatturazione', 'Codice fiscale'], ['fatturazione', 'Codice destinatario SDI'], ['fatturazione', 'PEC'], ['fatturazione', 'Legale rappresentante'], ['banca', 'IBAN']],
  persona: [['fatturazione', 'Intestazione'], ['fatturazione', 'Indirizzo'], ['fatturazione', 'Partita IVA'], ['fatturazione', 'Codice fiscale'], ['fatturazione', 'Codice destinatario SDI'], ['fatturazione', 'PEC'], ['contatti', 'Email'], ['contatti', 'Cellulare'], ['banca', 'IBAN']],
  altro: [['altro', 'Descrizione'], ['altro', 'Riferimento']],
};
export function nuovaScheda(tipo = 'societa', nome = '', ordine = 0) {
  const t = BASE[tipo] ? tipo : 'altro';
  return {
    tipo: t, nome: pulito(nome) || (t === 'societa' ? 'Nuova società' : t === 'persona' ? 'Nuova persona' : 'Nuova scheda'),
    descrizione: '', colore: COLORI[ordine % COLORI.length], ordine,
    campi: BASE[t].map(([gruppo, etichetta], i) => ({ gruppo, etichetta, valore: i === 0 ? pulito(nome) : '' })),
    persone: [],
  };
}

export function iniziali(nome) {
  const parole = pulito(nome).replace(/^(dott\.?(ssa)?|avv\.?|ing\.?|geom\.?)\s+/i, '').split(' ').filter((p) => /^[\p{L}\d]/u.test(p) && !/^(di|e|&|s\.?a\.?s\.?|s\.?r\.?l\.?|stp|c\.?)$/i.test(p));
  return (parole.slice(0, 2).map((p) => p[0]).join('') || '?').toUpperCase();
}

export const campiDi = (s, gruppo) => (s.campi || []).map((c, i) => ({ ...c, i })).filter((c) => (GRUPPI.some(([g]) => g === c.gruppo) ? c.gruppo : 'altro') === gruppo);
export const daCompilare = (s) => (s.campi || []).filter((c) => !pulito(c.valore)).length;

// Il blocco da incollare in un'email o in un gestionale: nome e indirizzo su righe proprie, poi «Etichetta: valore».
// I campi vuoti si saltano.
const RIGA_LIBERA = /^(intestazione|ragione sociale|denominazione|sede|sede legale|indirizzo)$/i;
export function bloccoFatturazione(s) {
  const righe = campiDi(s, 'fatturazione').filter((c) => pulito(c.valore))
    .map((c) => (RIGA_LIBERA.test(pulito(c.etichetta)) ? pulito(c.valore) : `${pulito(c.etichetta)}: ${pulito(c.valore)}`));
  return righe.length ? righe.join('\n') : pulito(s.nome);
}
export function testoScheda(s) {
  const parti = [pulito(s.nome)];
  for (const [g, titolo] of GRUPPI) {
    const r = campiDi(s, g).filter((c) => pulito(c.valore));
    if (r.length) parti.push('', titolo.toUpperCase(), ...r.map((c) => `${pulito(c.etichetta)}: ${pulito(c.valore)}`));
  }
  if (s.persone?.length) parti.push('', 'CHI LA SEGUE', ...s.persone.map(testoPersona));
  return parti.join('\n');
}
export const testoPersona = (p) => [p.ruolo && `${pulito(p.ruolo)}:`, pulito(p.nome), p.studio && `(${pulito(p.studio)})`,
  p.email && `email ${pulito(p.email)}`, p.pec && `PEC ${pulito(p.pec)}`, p.telefono && `tel. ${pulito(p.telefono)}`].filter(Boolean).join(' ');

const testoCerca = (s) => [s.nome, s.descrizione, s.note, ...(s.campi || []).flatMap((c) => [c.etichetta, c.valore]),
  ...(s.persone || []).flatMap((p) => Object.values(p))].join(' ').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
export function filtra(schede, q) {
  const t = String(q || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
  return t ? schede.filter((s) => t.split(/\s+/).every((p) => testoCerca(s).includes(p))) : schede;
}

// Prima di salvare: niente spazi doppi, gruppi validi, consulenti senza nessun dato tolti.
export function campiScheda(s) {
  const gruppi = GRUPPI.map(([g]) => g);
  const out = {};
  if ('nome' in s) { out.nome = pulito(s.nome); if (!out.nome) throw new Error('Scrivi il nome della scheda'); }
  if ('descrizione' in s) out.descrizione = pulito(s.descrizione) || null;
  if ('note' in s) out.note = String(s.note ?? '').trim() || null;
  if ('tipo' in s) out.tipo = TIPI.some(([t]) => t === s.tipo) ? s.tipo : 'altro';
  if ('colore' in s) out.colore = COLORI.includes(s.colore) ? s.colore : COLORI[0];
  if ('ordine' in s) out.ordine = Number(s.ordine) || 0;
  if ('campi' in s) out.campi = (s.campi || []).map((c) => ({ gruppo: gruppi.includes(c.gruppo) ? c.gruppo : 'altro', etichetta: pulito(c.etichetta) || 'Campo', valore: pulito(c.valore) }));
  if ('persone' in s) out.persone = (s.persone || []).map((p) => Object.fromEntries(CAMPI_PERSONA.map(([k]) => [k, pulito(p[k])]).filter(([, v]) => v)))
    .filter((p) => Object.keys(p).length);
  return out;
}

export async function caricaSchede(db) {
  return esito(await db.from('miei_dati').select('*').is('archiviata_il', null).order('ordine').order('creato_il'));
}
export async function salvaScheda(db, id, campi) {
  return esito(await db.from('miei_dati').update(campiScheda(campi)).eq('id', id).select('*').single());
}
export async function creaScheda(db, scheda) {
  return esito(await db.from('miei_dati').insert(campiScheda(scheda)).select('*').single());
}
// Mai cancellazioni: la scheda si archivia.
export async function archiviaScheda(db, id) {
  return esito(await db.from('miei_dati').update({ archiviata_il: new Date().toISOString() }).eq('id', id).select('id').single());
}
