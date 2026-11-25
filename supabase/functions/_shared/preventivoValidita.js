// PREVENTIVI-LINEARI (PO 2026-11-25): «ha aggiunto prestazioni due volte [...] se poi modifico
// una prestazione deve segnalarmi che è già stata preventivata quindi il preventivo precedente
// perde di validità». Regole pure, condivise da app e Poliedron (nessun I/O):
// 1. una cura ancora da fare (stesso dente, stessa cura anche con nome diverso:
//    «Devitalizzazione» e «Devitalizzazione un canale») non si aggiunge una seconda volta in
//    silenzio: chi la aggiunge riceve l'elenco di dove è già preventivata;
// 2. un preventivo emesso resta valido finché ogni sua voce è nel piano con lo stesso nome, dente
//    e prezzo (e, se riporta tutto il piano, con lo stesso sconto). Altrimenti «Non più valido».

const norm = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

// Parole che non dicono «che cura è»: qualificativi di sede, numero di canali, articoli.
const GENERICHE = new Set(['con', 'del', 'della', 'dei', 'delle', 'per', 'sul', 'sulla', 'dente', 'denti', 'semplice', 'complessa',
  'complesso', 'canale', 'canali', 'uno', 'due', 'tre', 'quattro', 'superiore', 'inferiore', 'sup', 'inf', 'arcata', 'arcate',
  'elemento', 'elementi', 'provvisoria', 'provvisorio', 'definitiva', 'definitivo', 'nuova', 'nuovo', 'singola', 'singolo']);
const paroleChiave = (nome) => norm(nome).split(' ').filter((p) => p.length >= 4 && !GENERICHE.has(p));

const PIANI_APERTI = new Set(['attivo', 'accettato']);
const statoPiano = (p) => p?.stato || 'attivo';
const pazienteDi = (p) => p?.pazienteId ?? p?.paziente_id;
const denteDi = (v) => String(v?.dente ?? '').trim();
const prezzoDi = (v) => Math.round((Number(v?.prezzo) || 0) * 100);
const scontoDi = (p) => ({ sconto: Number(p?.sconto) || 0, tipo: (p?.scontoTipo ?? p?.sconto_tipo ?? 'pct') === 'pct' ? 'pct' : 'eur' });

/** Stessa cura: nome uguale, oppure una parola che identifica la cura in comune. */
export function stessaCura(a, b) {
  const na = norm(a), nb = norm(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  const pb = new Set(paroleChiave(b));
  return paroleChiave(a).some((p) => pb.has(p));
}

/** Stessa cura sullo stesso dente; senza dente vale solo tra voci senza dente. */
export const stessaVoce = (a, b) => denteDi(a) === denteDi(b) && stessaCura(a?.prestazione, b?.prestazione);

/**
 * Le voci nuove che sono già, ancora da fare, in un piano aperto dello stesso paziente.
 * `escludi` = [{ pianoId, indice }] voci da non contare (quella che si sta modificando).
 * Ritorna [{ voce, piano, indice, esistente, identica }].
 */
export function giaPreventivate(plans, pazienteId, voci, { escludi = [] } = {}) {
  const fuori = new Set(escludi.map((e) => `${e.pianoId}:${e.indice}`));
  const trovate = [];
  for (const voce of voci || []) {
    if (!norm(voce?.prestazione)) continue;
    for (const piano of plans || []) {
      if (String(pazienteDi(piano)) !== String(pazienteId) || !PIANI_APERTI.has(statoPiano(piano))) continue;
      (piano.voci || []).forEach((esistente, indice) => {
        if (esistente?.eseguita || fuori.has(`${piano.id}:${indice}`) || !stessaVoce(voce, esistente)) return;
        trovate.push({ voce, piano, indice, esistente, identica: norm(voce.prestazione) === norm(esistente.prestazione) && prezzoDi(voce) === prezzoDi(esistente) });
      });
    }
  }
  return trovate;
}

const euro = (n) => new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(Number(n) || 0);
const dataIt = (d) => (/^\d{4}-\d{2}-\d{2}/.test(String(d || '')) ? String(d).slice(0, 10).split('-').reverse().join('/') : '');
const etichetta = (v) => `${String(v?.prestazione || 'Prestazione').trim()}${denteDi(v) ? ` sul ${denteDi(v)}` : ''}`;

export function messaggioGiaPreventivate(trovate) {
  if (!trovate?.length) return '';
  const righe = trovate.slice(0, 6).map((t) => `${etichetta(t.voce)}: già in «${t.piano.titolo || 'Piano'}»${t.piano.data ? ` del ${dataIt(t.piano.data)}` : ''} come ${etichetta(t.esistente)} (${euro(t.esistente.prezzo)})`);
  const altre = trovate.length > 6 ? `\n…e altre ${trovate.length - 6}.` : '';
  return `${trovate.length === 1 ? 'Questa prestazione è già preventivata e non ancora eseguita' : 'Queste prestazioni sono già preventivate e non ancora eseguite'}:\n${righe.join('\n')}${altre}\nPer cambiare prezzo o cura modifica la voce che c'è già: aggiungendola di nuovo la stessa cura risulterà due volte (anche in «Da pagare»).`;
}

/** Confronta un preventivo emesso (plan_snapshot) con il piano com'è adesso. */
export function confrontaPreventivo(snapshot, piano) {
  if (!piano) return { valido: false, motivi: ['Il piano di cura non esiste più.'] };
  const correnti = (piano.voci || []).map((v) => ({ v, usata: false }));
  const motivi = [];
  for (const voce of snapshot?.voci || []) {
    const uguale = correnti.find((c) => !c.usata && norm(c.v.prestazione) === norm(voce.prestazione) && denteDi(c.v) === denteDi(voce) && prezzoDi(c.v) === prezzoDi(voce));
    if (uguale) { uguale.usata = true; continue; }
    const cambiata = correnti.find((c) => !c.usata && stessaVoce(c.v, voce));
    if (cambiata) {
      cambiata.usata = true;
      motivi.push(norm(cambiata.v.prestazione) === norm(voce.prestazione)
        ? `${etichetta(voce)}: ${euro(voce.prezzo)} → ${euro(cambiata.v.prezzo)}`
        : `${etichetta(voce)} (${euro(voce.prezzo)}) ora è ${etichetta(cambiata.v)} (${euro(cambiata.v.prezzo)})`);
    } else motivi.push(`${etichetta(voce)} non è più nel piano`);
  }
  // Uno sconto vale solo per il documento che lo riporta: confrontarlo solo se il preventivo
  // riportava tutto il piano (gli estratti di singole prestazioni non hanno sconto).
  const prima = scontoDi(snapshot), ora = scontoDi(piano);
  if ((prima.sconto > 0 || (snapshot?.voci || []).length === (piano.voci || []).length) && (prima.sconto !== ora.sconto || (prima.sconto > 0 && prima.tipo !== ora.tipo))) {
    motivi.push(`Sconto: ${prima.sconto ? (prima.tipo === 'pct' ? `${prima.sconto}%` : euro(prima.sconto)) : 'nessuno'} → ${ora.sconto ? (ora.tipo === 'pct' ? `${ora.sconto}%` : euro(ora.sconto)) : 'nessuno'}`);
  }
  return { valido: motivi.length === 0, motivi };
}

/** I preventivi (righe di `preventivi`) validi prima della modifica e non più validi dopo. */
export function preventiviResiNonValidi(preventivi, primaPiano, dopoPiano) {
  return (preventivi || []).filter((q) => String(q.piano_id) === String(primaPiano?.id) && !q.archiviato
    && confrontaPreventivo(q.plan_snapshot, primaPiano).valido && !confrontaPreventivo(q.plan_snapshot, dopoPiano).valido);
}

export function messaggioPreventiviNonValidi(preventivi) {
  if (!preventivi?.length) return '';
  const elenco = preventivi.slice(0, 4).map((q) => `N° ${q.numero}${q.data ? ` del ${dataIt(q.data)}` : ''}`).join(', ');
  return preventivi.length === 1
    ? `Questa voce è già nel preventivo ${elenco}, già preparato per il paziente: con questa modifica quel preventivo non sarà più valido e andrà rifatto.`
    : `Questa voce è già nei preventivi ${elenco}: con questa modifica non saranno più validi e andranno rifatti.`;
}

/**
 * «Modifica / nuova versione» di un preventivo: le righe del nuovo documento diventano il piano.
 * Riga uguale (nome e dente) a una voce → stessa voce, prezzo aggiornato se cambiato; riga della
 * stessa cura sullo stesso dente con un altro nome → quella voce rinominata; altrimenti voce nuova.
 * Le voci del piano che non sono nel documento restano nel piano (il documento è un estratto).
 * Le voci già eseguite non si toccano. Ritorna { piano, cambiate, aggiunte }.
 */
export function applicaVociAlPiano(piano, voci) {
  const nuove = (piano?.voci || []).map((v) => ({ ...v }));
  const usate = new Set();
  let cambiate = 0, aggiunte = 0;
  const trova = (test) => nuove.findIndex((v, i) => !usate.has(i) && !v.eseguita && test(v));
  for (const voce of voci || []) {
    if (!norm(voce?.prestazione)) continue;
    let i = trova((v) => norm(v.prestazione) === norm(voce.prestazione) && denteDi(v) === denteDi(voce));
    if (i < 0) i = trova((v) => stessaVoce(v, voce));
    if (i < 0) {
      // Già eseguita con lo stesso nome e dente: è la stessa voce, non una nuova.
      const fatta = nuove.findIndex((v, j) => !usate.has(j) && v.eseguita && norm(v.prestazione) === norm(voce.prestazione) && denteDi(v) === denteDi(voce));
      if (fatta >= 0) { usate.add(fatta); continue; }
      nuove.push({ prestazione: String(voce.prestazione).trim(), dente: denteDi(voce), prezzo: Number(voce.prezzo) || 0, eseguita: false, incassata: false });
      usate.add(nuove.length - 1); aggiunte++; continue;
    }
    usate.add(i);
    const v = nuove[i], prestazione = String(voce.prestazione).trim(), prezzo = Number(voce.prezzo) || 0;
    if (v.prestazione !== prestazione || prezzoDi(v) !== prezzoDi(voce)) { nuove[i] = { ...v, prestazione, prezzo }; cambiate++; }
  }
  return { piano: { ...piano, voci: nuove }, cambiate, aggiunte };
}
