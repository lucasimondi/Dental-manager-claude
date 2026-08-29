const planTotal = (plan) => {
  const subtotal = (plan.voci || []).reduce((sum, item) => sum + Number(item.prezzo || 0), 0);
  const discount = Number(plan.sconto || 0);
  const discounted = plan.scontoTipo === 'eur' ? Math.min(discount, subtotal) : subtotal * discount / 100;
  return { subtotal, total: Math.max(0, subtotal - discounted) };
};

/** Mirrors the canonical patient -> plan FIFO rule, then attributes the
 * plan's collected quota to its items in display order solely for the
 * removal warning. Payments remain patient-level and are never mutated. */
export function allocatedPaymentForItem(plans, payments, planId, itemIndex) {
  const target = (plans || []).find((plan) => String(plan.id) === String(planId));
  if (!target) return 0;
  let patientPaid = (payments || [])
    .filter((payment) => String(payment.pazienteId) === String(target.pazienteId) && String(payment.stato || '').toLowerCase() === 'pagato')
    .reduce((sum, payment) => sum + Number(payment.importo || 0), 0);
  const ordered = (plans || []).filter((plan) => String(plan.pazienteId) === String(target.pazienteId))
    .sort((a, b) => `${a.data || ''}:${a.id || ''}`.localeCompare(`${b.data || ''}:${b.id || ''}`));
  let paidOnTarget = 0;
  for (const plan of ordered) {
    const total = planTotal(plan).total;
    const allocated = Math.min(Math.max(0, patientPaid), total);
    if (String(plan.id) === String(planId)) { paidOnTarget = allocated; break; }
    patientPaid -= allocated;
  }
  const { subtotal, total } = planTotal(target);
  const ratio = subtotal > 0 ? total / subtotal : 0;
  let remaining = paidOnTarget;
  for (let index = 0; index < (target.voci || []).length; index += 1) {
    const itemTotal = Number(target.voci[index].prezzo || 0) * ratio;
    const allocated = Math.min(Math.max(0, remaining), itemTotal);
    if (index === itemIndex) return allocated;
    remaining -= allocated;
  }
  return 0;
}
