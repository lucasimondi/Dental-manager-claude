// DOCUMENTI-AZIONI (PO 2026-11-19: "nella cartelle delle pratiche e in tutte le cartelle dove ci sono documenti
// i documenti stessi devono essere elencati ed essere apribili scaricabili spostabili e poi deve esserci la
// possibilità di selezionarli uno ad uno anche tutti e a quel punto scaricabili tutti insieme o inviabili tutti
// insieme"). Azioni comuni a tutti gli elenchi di documenti.
import { vociPacchetto, scaricaFile, creaZip, MAX_FILE_ZIP } from './pacchetto.js';
const esito = ({ data, error }) => { if (error) throw new Error(error.message || 'Errore del database'); return data || []; };

// Sposta i documenti in una pratica (o li toglie, con null). Mai i documenti dei pazienti.
export async function spostaInPratica(db, documenti, praticaId) {
  const ids = documenti.filter((d) => d.fascicolo !== 'clinico_pazienti').map((d) => d.id);
  if (!ids.length) return [];
  return esito(await db.from('documenti').update({ pratica_id: praticaId || null }).in('id', ids).select('id'));
}

// Voci della scelta di una pratica: aperte prima, poi le altre; in ordine di nome (già ordinate da chi chiama).
export function vociPratiche(pratiche = [], attuale = null) {
  const aperta = (p) => ['aperta', 'in_corso'].includes(p.stato);
  return [
    ...(attuale ? [{ id: '__nessuna', nome: 'Togli dalla pratica', meta: 'il documento resta in archivio' }] : []),
    ...pratiche.filter(aperta).map((p) => ({ id: p.id, nome: p.titolo, meta: `${p.n_documenti ?? 0} documenti`, attivo: p.id === attuale })),
    ...pratiche.filter((p) => !aperta(p)).map((p) => ({ id: p.id, nome: p.titolo, meta: `chiusa · ${p.n_documenti ?? 0} documenti`, attivo: p.id === attuale })),
  ];
}

// Prepara i file dei documenti scelti: file singoli o un solo ZIP (con password facoltativa).
// `prendiFile(doc)` restituisce il File del documento (da Drive, tramite lo script).
export async function preparaInvio(documenti, { formato, nome, password, protezione }, prendiFile, onAvanzamento) {
  const { voci, esclusi } = vociPacchetto({ cartelle: [], documentiScelti: documenti });
  if (!voci.length) return { fase: 'errore', messaggio: esclusi.length ? `Nessun file da inviare (${esclusi.join(', ')}).` : 'Nessun documento scelto.' };
  if (voci.length > MAX_FILE_ZIP) return { fase: 'errore', messaggio: `Sono ${voci.length} file: al massimo ${MAX_FILE_ZIP} alla volta.` };
  const { file, errori } = await scaricaFile(voci, prendiFile, onAvanzamento);
  if (!file.length) return { fase: 'errore', messaggio: 'Non sono riuscito a scaricare i file. Riprova tra poco.' };
  const files = formato === 'zip' ? [await creaZip({ nome, file, password, protezione })] : file.map((f) => f.file);
  return { fase: 'pronto', files, password: !!password, esclusi: [...esclusi, ...errori.map((e) => `${e} (non scaricato)`)] };
}
