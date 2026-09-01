/* POL-FIN-004 — pure helpers for the "Leggi estratto conto" import flow in
   Incassi.jsx. The edge function (estrai-pagamenti-estratto-conto) only
   extracts raw rows { data, importo, descrizione } from the uploaded
   document; everything here is deterministic and runs entirely on data
   already loaded client-side (patients/plans/payments) — no I/O, no new
   query, same principle as incassiActions.js's unassignedPaymentsForMultiPlanPatients. */

import { uid } from '../utils.js';
import { trovaPazienteInTesto } from '../ricercaPazienti.js';
import { planAssignmentForPatient } from './incassiActions.js';

/** Decorates each extracted row with a pazienteId guess (or null — never
 *  guessed when ambiguous, see trovaPazienteInTesto). The operator confirms
 *  or corrects every row before anything is registered; this never writes. */
export function matchPaymentsToPatients(righe, patients) {
  return (righe || []).map((riga) => {
    const paziente = trovaPazienteInTesto(patients, riga.descrizione);
    return { ...riga, pazienteId: paziente ? paziente.id : null };
  });
}

const DUPLICATE_WINDOW_DAYS = 5;
const daysBetween = (a, b) => Math.abs((new Date(a) - new Date(b)) / 86400000);

/** Flags rows that look like they may already be registered in the app
 *  (same amount, date within a few days) — defaults them unchecked in the
 *  review UI so a bank-statement import doesn't silently double-register a
 *  payment already entered by hand. Amount+date only, not a patient match:
 *  a cautious heuristic, not a claim of certainty. */
export function flagPossibleDuplicates(righe, payments) {
  const registrati = (payments || []).filter((payment) => String(payment.stato || '').toLowerCase() === 'pagato');
  return (righe || []).map((riga) => {
    const possibileDuplicato = Boolean(riga.data) && registrati.some((payment) =>
      Math.abs(Number(payment.importo) - Number(riga.importo)) < 0.01 &&
      payment.data && daysBetween(riga.data, payment.data) <= DUPLICATE_WINDOW_DAYS
    );
    return { ...riga, possibileDuplicato };
  });
}

/** Informational summary shown before confirming: statement total, what's
 *  already registered in the app for the same period (any stato:'pagato'
 *  payment, not only bank transfers — informational, not a strict
 *  reconciliation), and how many extracted rows look like duplicates. No
 *  financial formula is computed here beyond plain sums already used
 *  elsewhere (e.g. Incassi.jsx's own "Incassato" KPI). */
export function riepilogoEstrattoConto(righe, payments, { periodoDa, periodoA } = {}) {
  const totaleEstrattoConto = (righe || []).reduce((sum, riga) => sum + Number(riga.importo || 0), 0);
  const date = (righe || []).map((riga) => riga.data).filter(Boolean).sort();
  const da = periodoDa || date[0] || null;
  const a = periodoA || date[date.length - 1] || null;
  const totaleRegistratoPeriodo = (da && a)
    ? (payments || [])
      .filter((payment) => String(payment.stato || '').toLowerCase() === 'pagato' && payment.data >= da && payment.data <= a)
      .reduce((sum, payment) => sum + Number(payment.importo || 0), 0)
    : null;
  const possibiliDuplicati = (righe || []).filter((riga) => riga.possibileDuplicato).length;
  return { totaleEstrattoConto, totaleRegistratoPeriodo, periodoDa: da, periodoA: a, possibiliDuplicati };
}

/** Builds real payment objects (POL-FIN-003 shape, piano_id included) from
 *  the rows the operator selected — only rows that already carry a
 *  pazienteId (resolved by matchPaymentsToPatients or picked manually in
 *  the review UI) are built; anything else is skipped rather than guessed. */
export function buildPaymentsFromEstrattoConto(righeSelezionate, plans) {
  return (righeSelezionate || [])
    .filter((riga) => riga.pazienteId)
    .map((riga) => {
      const assignment = planAssignmentForPatient(plans, riga.pazienteId);
      const pianoId = assignment.mode === 'auto' ? assignment.pianoId : (riga.pianoId ? Number(riga.pianoId) : undefined);
      return {
        id: uid(), pazienteId: Number(riga.pazienteId), data: riga.data, importo: Number(riga.importo),
        metodo: 'Bonifico', nota: riga.descrizione, stato: 'pagato',
        ...(pianoId !== undefined ? { pianoId } : {}),
      };
    });
}
