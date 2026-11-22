// PERSONAL-ESPLORA-WIN11 fase 3 — barra delle applicazioni e Start stile Windows 11 (logica pura).
// Sostituisce il dock senza cambiare destinazioni né viste salvate: Oggi, Agenda, Assistente
// (Poliedron) e Personale («altro») restano le stesse viste; Documenti, Studio e le altre sezioni
// sono in Start. Esplora file è una pagina (tipo 'esplora').

// Icone centrate: Start · Oggi · Agenda · Esplora file · Assistente · Personale.
export const VOCI_BARRA = [
  { id: 'start', nome: 'Start' },
  { id: 'oggi', nome: 'Oggi', vista: 'oggi' },
  { id: 'agenda', nome: 'Agenda', vista: 'agenda' },
  { id: 'esplora', nome: 'Esplora file', pagina: 'esplora' },
  { id: 'poliedron', nome: 'Assistente', vista: 'poliedron' },
  { id: 'altro', nome: 'Personale', vista: 'altro' },
];
const VISTE_BARRA = new Set(VOCI_BARRA.filter((v) => v.vista).map((v) => v.id));

/**
 * Quale icona è attiva. Start aperto vince; poi Esplora se è la pagina in cima; poi la vista.
 * Le viste che non sono nella barra (Documenti, Conti, Legal…) accendono «Personale», come prima.
 */
export function voceAttiva({ vista, pagine = [], start = false }) {
  if (start) return 'start';
  if (pagine.length && pagine[pagine.length - 1]?.tipo === 'esplora') return 'esplora';
  if (VISTE_BARRA.has(vista)) return vista;
  return 'altro';
}

/**
 * PR #337: app «aperte ma non in primo piano» (trattino corto da 6 px): la vista sotto una pagina aperta
 * e Esplora file quando è aperto sotto un'altra pagina.
 */
export function vociAperte({ vista, pagine = [], start = false }) {
  const fuori = new Set();
  const attiva = voceAttiva({ vista, pagine, start });
  if (pagine.length) fuori.add(VISTE_BARRA.has(vista) ? vista : 'altro');
  if (pagine.some((p) => p.tipo === 'esplora')) fuori.add('esplora');
  fuori.delete(attiva);
  return fuori;
}
// Badge rossi sulle icone: Oggi = scadenze/promemoria urgenti, Esplora = documenti da gestire.
export const badgeBarra = (id, conteggi = {}) => (id === 'oggi' ? Number(conteggi.urgenti) || 0 : id === 'esplora' ? Number(conteggi.esplora) || 0 : 0);

// Le sezioni in «Aggiunte» (griglia di 4 colonne), ognuna col suo pallino quando c'è un conteggio.
// azione: { vai: vista } | { apri: { tipo } } | { href } ; conteggio: chiave in `conteggi`.
export const AGGIUNTE = [
  { id: 'oggi', nome: 'Oggi', azione: { vai: 'oggi' }, conteggio: 'urgenti' },
  { id: 'agenda', nome: 'Agenda', azione: { vai: 'agenda' } },
  { id: 'documenti', nome: 'Documenti', azione: { vai: 'documenti' }, conteggio: 'documenti' },
  { id: 'esplora', nome: 'Esplora', azione: { apri: { tipo: 'esplora' } }, conteggio: 'esplora' },
  { id: 'dafare', nome: 'Da fare', azione: { vai: 'dafare' }, conteggio: 'dafare' },
  { id: 'conti', nome: 'Conti', azione: { vai: 'conti' } },
  { id: 'legal', nome: 'Legal', azione: { vai: 'legal' } },
  { id: 'pratiche', nome: 'Pratiche', azione: { vai: 'legal' } },
  { id: 'personali', nome: 'Portafoglio', azione: { vai: 'personali' } },
  { id: 'diario', nome: 'Diario', azione: { vai: 'diario' } },
  { id: 'note', nome: 'Note', azione: { vai: 'note' } },
  { id: 'password', nome: 'Password', azione: { vai: 'password' } },
  { id: 'foto', nome: 'Foto', azione: { vai: 'foto' } },
  { id: 'concordato', nome: 'Concordato', azione: { vai: 'concordato' } },
  { id: 'studio', nome: 'Studio', azione: { href: 'studio' } },
  { id: 'impostazioni', nome: 'Impostazioni', azione: { apri: { tipo: 'impostazioni' } } },
];

export const vociStart = (conteggi = {}) => AGGIUNTE.map((v) => ({ ...v, n: v.conteggio ? Number(conteggi[v.conteggio]) || 0 : 0 }));

// Il numero accanto all'ora: i promemoria «Da fare» aperti (gli stessi delle notifiche sul telefono).
export const numeroNotifiche = (conteggi = {}) => Number(conteggi.dafare) || 0;

// Ora e data come nella barra di Windows: «14:05» e «21/11/2026», fuso di Roma.
export function oraData(d = new Date(), fuso = 'Europe/Rome') {
  const ora = new Intl.DateTimeFormat('it-IT', { timeZone: fuso, hour: '2-digit', minute: '2-digit', hour12: false }).format(d);
  const data = new Intl.DateTimeFormat('it-IT', { timeZone: fuso, day: '2-digit', month: '2-digit', year: 'numeric' }).format(d);
  return { ora, data, breve: data.slice(0, 5) }; // breve «21/11» per i telefoni stretti
}

// «luca.simondi@…» → «Luca».
export function nomeUtente(email = '') {
  const p = String(email).split('@')[0].split(/[._-]/)[0] || '';
  return p ? p.charAt(0).toUpperCase() + p.slice(1).toLowerCase() : 'Account';
}

// «Consigliati»: prima i file recenti del telefono, poi (se servono) gli ultimi documenti dell'archivio.
export function consigliati(recenti = [], documenti = [], max = 6) {
  const fuori = recenti.slice(0, max).map((r) => ({ chiave: `r:${r.id}`, tipo: 'recente', id: r.id, nome: r.nome, quando: r.data, mime: r.tipo }));
  for (const d of documenti) {
    if (fuori.length >= max) break;
    fuori.push({ chiave: `d:${d.id}`, tipo: 'documento', id: d.id, nome: d.titolo || d.nome_file_originale || 'Documento', quando: Date.parse(d.creato_il || d.email_data || '') || null, mime: d.mime_type });
  }
  return fuori;
}

export const etichettaNumero = (n) => (!n || n < 1 ? null : n > 99 ? '99+' : String(n));
