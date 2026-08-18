# POL-003 / FIN-001 — Current financial formula inventory

Status: completed from repository evidence on 2026-08-18. This inventory describes current code; it does not certify or change production formulas.

## Evidence boundary

The repository contains the frontend callers and verified metadata for `get_kpi_periodo(uuid,date,date)` and `get_costo_orario(uuid)`, but not their production SQL bodies. Their tenant checks are verified; their complete formulas are not. The synthetic POL-002A fixture contains authorization stubs, not production financial logic. Therefore every unknown RPC formula below is explicitly marked unavailable rather than reconstructed.

The full production DDL for the legacy financial tables is also absent. Column names below are limited to fields demonstrably read or written by repository code.

## Current source map

| Source | Repository evidence | Current role |
|---|---|---|
| `plans` | `src/lib/supabase.js`, `Piani.jsx`, `SchedaPaz.jsx` | plan header plus JSON-like `voci`, plan discount, status, proposal/payment-deadline dates; line booleans `eseguita` and `incassata` |
| `payments` | `src/lib/supabase.js`, `Pagamenti.jsx`, `SchedaPaz.jsx` | patient payment amount/date/method/status; no proven allocation FK from payment to plan line |
| `pagamenti_esterni` | `Pagamenti.jsx`, `useControlloDati.js` | external amount/date/source; current client sums records without a demonstrated reconciliation contract |
| `documenti_fiscali` | `DocFiscale.jsx`, `ArchivioDocs.jsx`, `SchedaPaz.jsx` | issued document type/date/amount and PDF; no versioned financial RPC uses it in repository evidence |
| `spese` | `Spese.jsx`, `Costi.jsx`, `useControlloDati.js` | amount/date, fixed/variable classification, recurring flag/frequency and optional end date |
| `personale` | `Costi.jsx` | monthly cost, weekly hours, active flag |
| `macchinari` | `Costi.jsx`, `Listino.jsx`, `MarginalitaPrestazioni.jsx` | acquisition cost/date, amortization years, estimated annual uses and consumable cost/use |
| `materiali` | `Costi.jsx`, `Listino.jsx`, `MarginalitaPrestazioni.jsx` | unit/package cost evidence consumed by `costoUsoMateriale` |
| `prestazione_materiali`, `prestazione_macchinari` | `Listino.jsx`, `MarginalitaPrestazioni.jsx` | quantity links from pricelist service to attributable resources |
| `pricelist` | `Listino.jsx` | price and optional duration used for theoretical service margin |
| `studio_info.config_orario` | `Costi.jsx` | capacity configuration consumed by unversioned `get_costo_orario` |
| `appointments` | `useCockpitDati.js` | booked duration and cancellation status for client-side occupancy |
| `budget` | `Proiezioni.jsx` | monthly cash/fixed-cost/variable-cost targets, deliberately separate from actuals |

## Current formula inventory

| Metric / calculation | Current formula and attribution | Location(s) | Classification |
|---|---|---|---|
| Plan net total | `max(0, sum(line.price) - discount)`, where percentage discount is `subtotal * pct / 100` and fixed discount is `min(discount, subtotal)` | `Piani.jsx`, `SchedaPaz.jsx`, `DocFiscale.jsx`, `useControlloDati.js` | duplicated client formula |
| Accepted total | sum of the above plan net total for `stato='accettato'`; no acceptance date is visible | `useControlloDati.js` | client-side; period attribution missing |
| Acceptance rate | accepted plan count / count of active + accepted + rejected plans; rounded percentage | `useControlloDati.js` | client-side; denominator semantics not canonical |
| Executed / produced | several screens sum gross prices of lines with `eseguita=true`; `useControlloDati` allocates the plan discount proportionally only in selected executed analyses | `SchedaPaz.jsx`, `useControlloDati.js` | divergent client formulas |
| Executed not collected | proportional plan-net line amount for `eseguita && !incassata` in `useControlloDati`; gross line amount in payment modal and patient plan summaries | `useControlloDati.js`, `SchedaPaz.jsx` | materially divergent |
| Accepted not executed | gross line prices, without proportional plan discount | `useControlloDati.js`, `SchedaPaz.jsx` | inconsistent with accepted net total |
| Fatturato | fiscal document import computes discounted plan total; repository does not prove that `get_kpi_periodo` reads `documenti_fiscali` | `DocFiscale.jsx`, RPC unavailable | `PRODUCT_OWNER_DECISION_REQUIRED` and backend definition unavailable |
| Incassato (legacy tables) | sum `payments.importo` by payment date | `useControlloDati.js`, `Dashboard.jsx` | client-side cash calculation |
| Incassato with external payments | legacy payments plus every `pagamenti_esterni.importo` in the date range | `useControlloDati.js` | client-side; reconciliation status not demonstrated |
| Canonical-looking incassato | `kpi.incassato` from `get_kpi_periodo` | management-control screens | RPC formula unavailable/unversioned |
| Patient residual | `max(0, all plan net totals - all patient payments)` | `SchedaPaz.jsx`, `Pagamenti.jsx` | hides overpayment; ignores explicit invoice/credit basis |
| Payment-deadline amount | full plan net total, without subtracting receipts | `useControlloDati.js` | known discrepancy |
| Line collected state | manual `incassata` boolean; full payment may mark all executed lines, partial payment does not allocate deterministically | `Piani.jsx`, `SchedaPaz.jsx` | boolean state diverges from payment ledger |
| Recurring monthly cost | `amount / frequency_months` | `useControlloDati.js` | client-side |
| Period recurring contribution | monthly normalized amount multiplied by count of calendar months overlapped, capped at current month | `useControlloDati.js` | explicit duplicate of unversioned RPC formula |
| Annual recurring projection | `amount * {12,6,4,2,1}` without period overlap | `Spese.jsx`, `Dashboard.jsx` | forecast; differs from actual-period contribution |
| Fixed/variable cost | period expense contribution classified by `tipo_costo`; missing type is treated as variable | `useControlloDati.js` | client-side classification fallback |
| KPI costs | `kpi.costi_fissi`, `costi_variabili`, `costi_totali` | `get_kpi_periodo` callers | RPC formula unavailable/unversioned |
| Contribution margin | UI consumes `kpi.margine_contribuzione_pct`; absolute formula not exposed in current response evidence | `ControlloCockpit.jsx` | RPC formula unavailable |
| EBITDA | UI consumes `kpi.ebitda` and `kpi.ebitda_pct`, describing the denominator as fatturato/incassato inconsistently | dashboard/control components | RPC formula unavailable; labels divergent |
| Break-even | UI consumes `kpi.break_even`; considers it reached when `incassato >= break_even` | `useCockpitDati.js`, control screens | RPC formula unavailable; comparison uses cash |
| Hourly structure cost | UI consumes `get_costo_orario.costo_orario = total monthly cost / workable monthly hours` by displayed contract; exact SQL unavailable | `Costi.jsx`, `useCockpitDati.js` | RPC formula unavailable/unversioned |
| Capacity / occupancy | booked non-cancelled appointment minutes / RPC workable hours for approximated elapsed months | `useCockpitDati.js` | client-side derived metric |
| Service variable/material cost | linked quantity × material unit cost | `Listino.jsx`, `MarginalitaPrestazioni.jsx` | duplicated client formula |
| Machine cost/use | `(purchase_cost / max(amortization_years,1)) / annual_uses + consumable_cost_use` | `Costi.jsx`, `Listino.jsx`, `MarginalitaPrestazioni.jsx` | triplicated client formula; uses current cost values historically |
| Machine monthly quota | `purchase_cost / (max(amortization_years,1) * 12)` | `Costi.jsx` | client-side |
| Service time cost | `duration_minutes / 60 * structure_hourly_cost` | `MarginalitaPrestazioni.jsx` | client-side theoretical cost |
| Service margin | pricelist price − materials − machinery − time; percentage over price | `Listino.jsx`, `MarginalitaPrestazioni.jsx` | duplicated/theoretical; not historical production margin |
| Budget margin | target cash − target fixed costs − target variable costs | `Proiezioni.jsx` | client-side forecast, correctly separate from actuals |
| Production/hour | no canonical repository implementation found | — | missing; do not infer from occupancy |
| Collection/hour | no canonical repository implementation found | — | missing |
| DSO estimate | `(executed_not_collected / collected_in_period) * period_days`; null if collection or denominator absent | `salutestudio.js` | client-side estimate; payments not allocated to services |
| Studio health score | weighted normalized EBITDA %, break-even flag, acceptance, occupancy and DSO | `salutestudio.js` | client heuristic, not a canonical financial measure |

## Verified RPC contracts, not formulas

`get_kpi_periodo(p_studio_id uuid, p_data_inizio date, p_data_fine date)` is SECURITY DEFINER and verifies JWT tenant or super-admin. Client code expects at least: `incassato`, `costi_fissi`, `costi_variabili`, `costi_totali`, `ebitda`, `ebitda_pct`, `break_even`, `break_even_nota`, `margine_contribuzione_pct`, `ticket_medio`, `n_pazienti_paganti` and plan-status counters.

`get_costo_orario(p_studio_id uuid)` has the same verified authorization pattern. Client code expects: `costo_orario`, `ore_lavorabili_mensili`, `costi_fissi_spese_mensili`, `costi_personale_mensili`, `costi_macchinari_mensili`, `totale_mensile` and `config_orario`.

Because their bodies are absent, FIN-001 cannot truthfully state how those outputs treat discounts, refunds, external payments, recurring-cost boundaries, invoices, tax, or historical costs.

## Critical duplication and divergence map

1. Plan discount arithmetic is repeated in at least four modules.
2. Proportional discount allocation exists for some executed metrics but not accepted backlog, patient execution summaries or payment suggestions.
3. Production is often labelled as incasso by service even when it is derived from executed line prices.
4. Patient residual and payment-deadline residual use different bases; overpayments are clamped away.
5. A payment ledger and line-level `incassata` booleans can disagree, especially for partial payments and reversals.
6. External payments are summed client-side without repository evidence of reconciliation.
7. Recurrence is duplicated between JavaScript and unavailable SQL, while annual projections use a different formula intentionally.
8. Service/material/machinery margin is duplicated and uses present configuration rather than effective-dated historical cost.
9. EBITDA, margin and break-even are displayed as authoritative but their SQL definitions are not versioned.
10. Fatturato has fiscal-document data but no proven canonical connection to current KPI SQL.
11. Production/hour and collection/hour have no canonical implementation.
12. Twelve separate monthly RPC requests are used for yearly actuals in `Proiezioni.jsx`.

## PRODUCT_OWNER_DECISION_REQUIRED

- Whether `PREVENTIVATO` is gross before plan discount or net after commercial discount. The two POL-003 design documents conflict; engine v1 therefore requires an explicit quote basis.
- Which lifecycle basis defines canonical `CREDITO_RESIDUO`: accepted, produced or invoiced. Engine v1 requires the caller to select it explicitly and does not clamp overpayments.
- VAT/tax inclusion basis for plan, invoice, cost and management-margin amounts.
- Whether acceptance cancellation reverses accepted value in the cancellation period, restates the original period, or is presented in both views.
- Whether production reversals/refunds affect only cash, current-period production, or both through separate explicit events.
- Rules for allocating payments to contracts, invoices and service lines, including prepayments and overpayments.
- When an external payment becomes reconciled and authoritative.
- Which cost categories belong in management EBITDA, contribution margin and operator-attributable cost.
- Economic-date versus cash-date cost views and recurring-expense expansion semantics.
- Productive capacity definition for structure, operator and resource hours.
- Legacy-to-canonical adapters for `plans`, `payments`, `documenti_fiscali`, `pagamenti_esterni`, `spese`, personnel, materials and machinery.

Until these decisions and the missing production SQL are captured, the canonical v1 engine remains additive and is not wired to legacy frontend calculations.
