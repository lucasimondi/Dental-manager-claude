export const PRODOTTO_RECONCILIATION_RPC = 'get_prodotto_reconciliation_v1';

export async function loadProdottoReconciliation(client, { dateFrom, dateTo, studioId }) {
  if (!client || !dateFrom || !dateTo || !studioId) {
    return { summary: null, groups: [], error: new Error('Periodo e studio sono obbligatori') };
  }

  const { data, error } = await client.rpc(PRODOTTO_RECONCILIATION_RPC, {
    p_data_inizio: dateFrom,
    p_data_fine: dateTo,
    p_studio_id: studioId,
  });
  if (error) return { summary: null, groups: [], error };

  const rows = Array.isArray(data) ? data : [];
  return {
    summary: rows.find((row) => row.group_kind === 'SUMMARY') || null,
    groups: rows.filter((row) => row.group_kind !== 'SUMMARY'),
    error: null,
  };
}
