// PO pricing preset: one requested implant total, allocated in integer cents.
// This prepares quote lines only; canonical plan builders/save remain authoritative.
export const isImplantQuoteRequest = value => String(value || '').trim().toLocaleLowerCase('it-IT') === 'impianto';

export function implantQuoteRows(row) {
  const raw = String(row.price ?? '').trim().replace(',', '.');
  if (!/^\d+(?:\.\d{1,2})?$/.test(raw)) throw new Error('Inserisci il totale del preventivo impianto (almeno 650 €, massimo due decimali).');
  const [euros, decimals = ''] = raw.split('.');
  const cents = Number(euros) * 100 + Number(decimals.padEnd(2, '0'));
  if (!Number.isSafeInteger(cents) || cents < 65000) throw new Error('Il totale impianto deve essere almeno 650 €: 500 € impianto e 150 € moncone.');
  return [
    { description: 'Impianto osteointegrato', price: 500, tooth: row.tooth || '' },
    { description: 'Moncone', price: 150, tooth: row.tooth || '' },
    { description: 'Corona composito ceramica', price: (cents - 65000) / 100, tooth: row.tooth || '' },
  ];
}

export function expandImplantQuotes(items = [], quoteItems = []) {
  const implantItems = items.filter(row => isImplantQuoteRequest(row.description));
  return {
    items: items.filter(row => !isImplantQuoteRequest(row.description)),
    quoteItems: [...implantItems.flatMap(implantQuoteRows), ...quoteItems.flatMap(row => isImplantQuoteRequest(row.description) ? implantQuoteRows(row) : [row])],
    hasImplant: implantItems.length > 0 || quoteItems.some(row => isImplantQuoteRequest(row.description)),
  };
}
