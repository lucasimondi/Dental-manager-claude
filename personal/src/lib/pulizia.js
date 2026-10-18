// Pulizia in massa con Poliedron (PO 2026-10-18: "analizzare documenti e risolverli in massa …
// si possano cancellare anche le mail indietro e i documenti allegati che non servono").
// Poliedron propone (elenco con criteri), Luca sceglie e conferma: solo allora si esegue.
import { cestinaSuDrive, cestinaEmail, eliminaDocumenti } from './archivio.js';

export const TITOLI_PROPOSTA = {
  elimina: (n) => `Eliminare ${n} ${n === 1 ? 'documento' : 'documenti'}`,
  rianalizza: (n) => `Far rileggere ${n} ${n === 1 ? 'documento' : 'documenti'} all'AI`,
  risolvi_pratiche: (n) => `Segnare ${n} ${n === 1 ? 'pratica risolta' : 'pratiche risolte'}`,
};

export const titoloProposta = (p, n = p.n) => (TITOLI_PROPOSTA[p.tipo] || (() => 'Proposta'))(n);

// Solo gli elementi rimasti spuntati; la rianalisi non tocca mai i documenti dei pazienti.
export function elementiScelti(proposta, esclusi = new Set()) {
  return (proposta.elementi || []).filter((e) => !esclusi.has(e.id) && !(proposta.tipo === 'rianalizza' && e.fascicolo === 'clinico_pazienti'));
}

const aBlocchi = (a, n) => Array.from({ length: Math.ceil(a.length / n) }, (_, i) => a.slice(i * n, i * n + n));

/**
 * Esegue una proposta confermata. Eliminazione: prima il Cestino di Drive e di Gmail (lo script
 * controlla che i file e le email appartengano a documenti in archivio), poi l'archivio.
 */
export async function eseguiProposta({ proposta, elementi, db, token, ancheDrive = true, ancheEmail = true, avanzamento = () => {} }) {
  const ids = elementi.map((e) => e.id);
  if (!ids.length) return { fatti: 0 };
  if (proposta.tipo === 'elimina') {
    const drive = ancheDrive ? await cestinaSuDrive({ token, ids: elementi.map((e) => e.drive_file_id) }) : null;
    const email = ancheEmail ? await cestinaEmail({ token, ids }) : null;
    const fatti = await eliminaDocumenti(db, ids, avanzamento);
    return { fatti, file: drive ? drive.cestinati.length : 0, email: email ? email.cestinate : 0, emailTenute: email ? email.tenute : 0 };
  }
  const tabella = proposta.tipo === 'risolvi_pratiche' ? 'pratiche' : 'documenti';
  const campi = proposta.tipo === 'risolvi_pratiche' ? { stato: 'risolta', aggiornata_il: new Date().toISOString() } : { da_analizzare: true };
  let fatti = 0;
  for (const blocco of aBlocchi(ids, 100)) {
    let q = db.from(tabella).update(campi).in('id', blocco);
    if (proposta.tipo === 'risolvi_pratiche') q = q.in('stato', ['aperta', 'in_corso']);
    if (proposta.tipo === 'rianalizza') q = q.neq('fascicolo', 'clinico_pazienti');
    const { error } = await q;
    if (error) throw new Error(error.message);
    fatti += blocco.length;
    avanzamento(fatti, ids.length);
  }
  return { fatti };
}

export function esitoProposta(proposta, r) {
  if (proposta.tipo === 'elimina') {
    return [`${r.fatti} ${r.fatti === 1 ? 'documento eliminato' : 'documenti eliminati'}`,
      r.file ? `${r.file} file nel Cestino di Drive` : null,
      r.email ? `${r.email} email nel Cestino di Gmail` : null,
      r.emailTenute ? `${r.emailTenute} email tenute (hanno altri allegati utili)` : null].filter(Boolean).join(' · ');
  }
  if (proposta.tipo === 'risolvi_pratiche') return `${r.fatti} ${r.fatti === 1 ? 'pratica segnata risolta' : 'pratiche segnate risolte'}`;
  return `${r.fatti} ${r.fatti === 1 ? 'documento' : 'documenti'} in coda: l'AI li rilegge a ogni giro`;
}
