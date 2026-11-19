// PRATICHE-PER-NOME (PO 2026-11-19: "Devi mettere le pratiche per nome poi quando le apro ci devono essere
// tutti gli elementi documenti date scadenze passi da fare").
// Elenchi delle pratiche in ordine alfabetico (italiano, senza badare a maiuscole e accenti, numeri in ordine
// naturale; «Avv.», «Dott.», «Studio» iniziali non contano) e sommario della pagina di una pratica.

const confronta = new Intl.Collator('it', { sensitivity: 'base', numeric: true }).compare;

export function chiaveNome(titolo) {
  return String(titolo || '').replace(/^\s*(?:avv\.?|avvocato|avv\.ti|dott\.?(?:ssa)?|dr\.?|studio)\s+/i, '').trim();
}

export function perNome(elenco = []) {
  return [...elenco].sort((a, b) => confronta(chiaveNome(a.titolo), chiaveNome(b.titolo)) || String(a.id).localeCompare(String(b.id)));
}

// Le voci del sommario in cima alla pagina della pratica: quante cose ci sono e dove saltare.
export function sommarioPratica({ documenti, scadenze = [], filo = 0, passi = [] } = {}) {
  const oggi = new Date().toISOString().slice(0, 10);
  const aperte = scadenze.filter((s) => !s.completata);
  const passiAperti = passi.filter((x) => x.stato !== 'gestito');
  const prima = (date) => date.filter(Boolean).sort()[0] || null;
  return [
    { id: 'pp-sez-scadenze', etichetta: 'Scadenze', n: aperte.length, prossima: prima(aperte.map((s) => s.data).filter((d) => d >= oggi)) },
    { id: 'pp-sez-passi', etichetta: 'Passi da fare', n: passiAperti.length, prossima: prima(passiAperti.map((x) => x.scadenza)) },
    { id: 'pp-sez-filo', etichetta: 'Date e fatti', n: filo, prossima: null },
    { id: 'pp-sez-documenti', etichetta: 'Documenti', n: documenti == null ? null : documenti.length, prossima: null },
  ];
}
