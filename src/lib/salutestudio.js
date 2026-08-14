// ─────────────────────────────────────────────────────────────────
// Punteggio Salute Studio — funzione pura, nessuna chiamata di rete,
// nessuno stato. Riceve solo numeri già calcolati altrove (RPC
// get_kpi_periodo, get_costo_orario, liste operative di useControlloDati)
// e restituisce un punteggio 0-100 più il dettaglio dei singoli fattori,
// così l'interfaccia può sempre mostrare "perché" e non solo "quanto".
//
// Cinque fattori pesati, ciascuno con la propria curva di normalizzazione
// a 0-100 e una motivazione esplicita (nessun peso o soglia arbitraria
// senza commento):
//
// 1. EBITDA % sul fatturato (peso 30) — indicatore di redditività diretta.
//    0% o negativo → 0 punti. 35%+ → 100 punti (soglia "ottimo" per uno
//    studio odontoiatrico, tipicamente 20-30% è già una buona gestione).
// 2. Break-even raggiunto (peso 15) — sì/no netto. Se il break-even non è
//    calcolabile (studio ancora sul metodo "costi variabili manuali", non
//    "percentuale sul fatturato" — vedi get_kpi_periodo), il fattore viene
//    ESCLUSO dalla media invece di essere stimato: non abbiamo un numero
//    reale per questo caso, quindi non ne inventiamo uno.
// 3. Tasso di accettazione preventivi (peso 20) — già un valore 0-100%,
//    usato direttamente come punteggio.
// 4. Occupazione agenda (peso 15) — ore prenotate ÷ ore lavorabili del
//    periodo (stessa base oraria di get_costo_orario). Tetto a 100 punti:
//    oltre il 100% di occupazione (giornate serrate) non vale "di più".
// 5. DSO stimato — Days Sales Outstanding (peso 20): giorni medi stimati
//    tra prestazione eseguita e incasso, calcolato come
//    (eseguito da incassare ÷ incassato nel periodo) × giorni del periodo.
//    È una formula contabile standard applicata a dati reali, ma resta
//    una STIMA (il DB non collega un pagamento a una prestazione precisa):
//    va sempre mostrata in UI con l'etichetta "stimato". 0gg → 100 punti,
//    60gg+ → 0 punti (60 giorni è la soglia informalmente critica per la
//    liquidità di uno studio).
//
// I pesi dei fattori esclusi (es. break-even non calcolabile) vengono
// redistribuiti proporzionalmente sui fattori rimasti, così la somma dei
// pesi usati è sempre 100 e il punteggio resta confrontabile nel tempo.

const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
const lerp100 = (v, hiValueFor100) => clamp((v / hiValueFor100) * 100, 0, 100);

const FATTORI_BASE = [
  { id: 'ebitda', peso: 30, label: 'EBITDA' },
  { id: 'breakeven', peso: 15, label: 'Break-even' },
  { id: 'accettazione', peso: 20, label: 'Accettazione' },
  { id: 'occupazione', peso: 15, label: 'Agenda' },
  { id: 'dso', peso: 20, label: 'Incasso' },
];

export function calcolaSaluteStudio({
  ebitdaPct = null,
  breakEvenSuperato = null, // true | false | null (non calcolabile)
  tassoAccettazione = null, // 0-100
  oreOccupatePct = null, // 0-100+
  dsoGiorni = null, // number | null
}) {
  const punteggi = {};
  if (ebitdaPct != null) punteggi.ebitda = lerp100(Math.max(0, ebitdaPct), 35);
  if (breakEvenSuperato != null) punteggi.breakeven = breakEvenSuperato ? 100 : 30;
  if (tassoAccettazione != null) punteggi.accettazione = clamp(tassoAccettazione, 0, 100);
  if (oreOccupatePct != null) punteggi.occupazione = clamp(oreOccupatePct, 0, 100);
  if (dsoGiorni != null) punteggi.dso = clamp(100 - (dsoGiorni / 60) * 100, 0, 100);

  const fattoriDisponibili = FATTORI_BASE.filter((f) => punteggi[f.id] != null);
  const pesoTotale = fattoriDisponibili.reduce((s, f) => s + f.peso, 0);

  if (pesoTotale === 0) return { punteggio: null, fattori: [] };

  const punteggio = Math.round(
    fattoriDisponibili.reduce((s, f) => s + punteggi[f.id] * (f.peso / pesoTotale), 0)
  );

  const fattori = fattoriDisponibili.map((f) => ({ id: f.id, label: f.label, punteggio: Math.round(punteggi[f.id]) }));

  return { punteggio, fattori };
}

// DSO (Days Sales Outstanding) stimato — vedi nota al punto 5 sopra.
// giorniPeriodo: numero di giorni coperti da incassato/eseguitoDaIncassare.
export function calcolaDsoStimato(eseguitoDaIncassare, incassatoPeriodo, giorniPeriodo) {
  if (!incassatoPeriodo || incassatoPeriodo <= 0 || !giorniPeriodo) return null;
  return (eseguitoDaIncassare / incassatoPeriodo) * giorniPeriodo;
}
