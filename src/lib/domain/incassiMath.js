/* POL-FIN-002 — pure aggregation helpers over get_saldo_piano rows.
   No I/O, no supabase import: safe to use from src/components/SchedaPaz.jsx,
   which per tests/patientRecordRecovery.test.mjs must stay self-contained
   (no useEffect/supabase/Promise.all — see POL-UI-PATIENT-FREEZE-PROD).
   Fetching happens in the parent (src/App.jsx) via incassiService.js;
   components only aggregate/format what they're handed as props. */

const ZERO_SALDO = { totale_piano: 0, totale_eseguito: 0, totale_pagato: 0, saldo_piano: 0, eseguito_non_pagato: 0, acconto: 0 };

/** Aggregates a set of get_saldo_piano rows (e.g. a patient's plans) into
 *  one summary. GREATEST(0,...) columns stay additive across plans since
 *  each plan's own eseguito_non_pagato/acconto are already non-negative and
 *  mutually exclusive per plan. */
export function aggregateSaldi(rows) {
  return (rows || []).reduce((acc, r) => ({
    totale_piano: acc.totale_piano + Number(r.totale_piano || 0),
    totale_eseguito: acc.totale_eseguito + Number(r.totale_eseguito || 0),
    totale_pagato: acc.totale_pagato + Number(r.totale_pagato || 0),
    saldo_piano: acc.saldo_piano + Number(r.saldo_piano || 0),
    eseguito_non_pagato: acc.eseguito_non_pagato + Number(r.eseguito_non_pagato || 0),
    acconto: acc.acconto + Number(r.acconto || 0),
  }), { ...ZERO_SALDO });
}

/* POL-FIN-008 — Product Owner: registered a payment before any plan
   existed for the patient, then created a plan afterwards; the payment
   never showed up in "Pagato" at all. Root cause: get_saldo_piano's
   totale_pagato (what aggregateSaldi sums) is PER-PLAN — it only counts
   payments already linked via payments.piano_id, by definition excluding
   any payment made before a plan existed to link it to (piano_id stays
   NULL forever until manually assigned). "Pagato" at the top of the
   patient record should mean "money this patient has actually given us",
   full stop — not "money already reconciled against a specific plan
   line". Same convention Incassi.jsx already uses for its own studio-wide
   "Incassato" KPI (stato === 'pagato', case-insensitive) — extended here
   to the single-patient scope instead of inventing a second definition of
   "paid". Deliberately payments-only (no RPC, no piano_id filter): this is
   a plain additive sum over data already loaded, not a re-derivation of
   the get_saldo_piano/FIFO formula that must stay server-side. */
export function totalePagatoPaziente(payments) {
  return (payments || [])
    .filter((payment) => String(payment?.stato || '').toLowerCase() === 'pagato')
    .reduce((sum, payment) => sum + Number(payment?.importo || 0), 0);
}
