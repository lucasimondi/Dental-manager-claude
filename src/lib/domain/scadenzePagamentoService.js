// Prezzo netto di un piano (somma voci - sconto), stessa formula usata da
// useControlloDati.js per "preventivi accettati" — estratta qui perché
// serve anche a computeScadenzePagamento, sotto.
export function calcPlanTot(pl) {
  const sub = (pl.voci || []).reduce((s, v) => s + Number(v.prezzo), 0);
  const sc = Number(pl.sconto) || 0;
  const scontato = pl.scontoTipo === 'pct' ? sub * (sc / 100) : Math.min(sc, sub);
  return Math.max(0, sub - scontato);
}

// Product Owner: "mi dà due scadenze di pagamento (Capraro e Savalli) ma poi
// quando si va sulla scheda loro non hanno da pagare". Questo elenco
// includeva qualunque piano con una data di scadenza impostata, senza mai
// controllare se il piano fosse già stato saldato — una scadenza restava
// visibile per sempre anche dopo che il paziente aveva pagato tutto. "Da
// pagare" reale, per piano, è quanto già registrato via payments.piano_id
// collegato a QUESTO piano (stessa fonte usata da get_saldo_piano lato
// server) — un pagamento non ancora assegnato a nessun piano non riduce il
// residuo di uno specifico piano finché non viene assegnato (vedi Incassi
// "Pagamenti da assegnare", POL-FIN-008).
export function computeScadenzePagamento(plans, patients, payments) {
  return (plans || []).filter((pl) => pl.scadenzaPagamento).map((pl) => {
    const paz = (patients || []).find((x) => x.id === pl.pazienteId);
    if (!paz) return null;
    const pagatoSulPiano = (payments || [])
      .filter((p) => p.pianoId === pl.id && String(p.stato || '').toLowerCase() === 'pagato')
      .reduce((s, p) => s + Number(p.importo || 0), 0);
    const residuo = Math.max(0, calcPlanTot(pl) - pagatoSulPiano);
    if (residuo <= 0) return null;
    return { pl, paz, scadenza: pl.scadenzaPagamento, importo: residuo };
  }).filter(Boolean).sort((a, b) => a.scadenza.localeCompare(b.scadenza));
}
