// PRATICHE-CARTELLE (PO 2026-11-19, proposta B scelta: "Va bene la b"): ogni pratica è una cartella
// «Pratica <nome>» con le anteprime dei suoi documenti, i passi da fare e la prossima data; la si trova
// nell'elenco (Da gestire / Tutte / Chiuse) e nella ricerca della Home.

const esito = ({ data, error }) => { if (error) throw new Error(error.message || 'Errore archivio'); return data || []; };
const confronta = new Intl.Collator('it', { sensitivity: 'base', numeric: true }).compare;

export function nomePratica(p) {
  const t = String(p?.titolo || '').trim() || 'senza nome';
  return /^pratica\b/i.test(t) ? t : `Pratica ${t}`;
}

const CAMPI_ANTEPRIMA = 'id, pratica_id, titolo, fascicolo, drive_file_id, mime_type, nome_file_originale, email_data, data_documento';

// Le pratiche con anteprime (fino a 4 documenti con file, i più recenti), passi aperti e prossima data.
export async function caricaCartellePratiche(db, { testo = '', fascicolo = null } = {}) {
  let q = db.from('v_pratiche').select('*').order('titolo', { ascending: true }).limit(1000);
  const parole = String(testo || '').replace(/[%_,()*\\.:"]/g, ' ').trim();
  if (parole) q = q.ilike('titolo', `%${parole}%`);
  if (fascicolo) q = q.eq('fascicolo', fascicolo);
  const pratiche = esito(await q);
  if (!pratiche.length) return [];
  const ids = pratiche.map((p) => p.id);
  const [docs, passi] = await Promise.all([
    db.from('documenti').select(CAMPI_ANTEPRIMA).in('pratica_id', ids).neq('fascicolo', 'clinico_pazienti').not('drive_file_id', 'is', null)
      .order('email_data', { ascending: false, nullsFirst: false }).limit(3000).then(esito),
    db.from('promemoria_azioni').select('pratica_id, scadenza, priorita').in('pratica_id', ids).eq('stato', 'aperto').then(esito),
  ]);
  return arricchisci(pratiche, docs, passi);
}

export function arricchisci(pratiche, docs = [], passi = []) {
  const anteprime = new Map(), aperti = new Map();
  for (const d of docs) { const l = anteprime.get(d.pratica_id) || []; if (l.length < 4) { l.push(d); anteprime.set(d.pratica_id, l); } }
  for (const x of passi) { const l = aperti.get(x.pratica_id) || []; l.push(x); aperti.set(x.pratica_id, l); }
  return pratiche.map((p) => {
    const ps = aperti.get(p.id) || [];
    const prossimo = ps.map((x) => x.scadenza).filter(Boolean).sort()[0] || null;
    return { ...p, nome: nomePratica(p), anteprime: anteprime.get(p.id) || [], passiAperti: ps.length, prossimo,
      urgente: ps.some((x) => x.priorita === 'alta') || p.urgenza === 'alta' };
  }).sort((a, b) => confronta(a.nome, b.nome));
}

export const aperta = (p) => ['aperta', 'in_corso'].includes(p.stato);
export function filtraPratiche(elenco = [], filtro = 'gestire') {
  if (filtro === 'chiuse') return elenco.filter((p) => !aperta(p));
  if (filtro === 'tutte') return elenco.filter(aperta);
  return elenco.filter((p) => aperta(p) && p.passiAperti > 0);
}
export function contaFiltri(elenco = []) {
  return { gestire: filtraPratiche(elenco, 'gestire').length, tutte: filtraPratiche(elenco, 'tutte').length, chiuse: filtraPratiche(elenco, 'chiuse').length };
}
