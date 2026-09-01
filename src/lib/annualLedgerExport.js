import { jsPDF } from 'jspdf';

// Product Owner follow-up: "deve essere possibile estrarre il pdf o excel
// da quella tabella" — the twelve-month ledger in AnnualFinancialOverview.jsx
// needs a real export, not just an on-screen view. No new dependency for
// the spreadsheet case: a semicolon-separated CSV (Italian locale — comma
// is the decimal separator there) opens directly in Excel, same as any
// "export to Excel" button that doesn't need multi-sheet/formatting. PDF
// reuses jsPDF (already a dependency, same library src/lib/pdfDocs.js
// already uses for every other document in this app) with a small manual
// table — twelve rows/six columns doesn't need the autotable plugin this
// project doesn't have installed.

const FIELDS = [
  ['prodotto', 'Prodotto'],
  ['incassato', 'Incassato'],
  ['costi_fissi_operativi', 'Costi fissi'],
  ['costi_variabili', 'Costi variabili'],
  ['ebitda_operativo_gestionale', 'EBITDA'],
];

const cellValue = (snapshot, field) => (snapshot?.[field] == null ? '' : Number(snapshot[field]));

const buildRows = (months, MONTHS) => months.map(({ index, snapshot }) => [MONTHS[index], ...FIELDS.map(([field]) => cellValue(snapshot, field))]);
const buildTotalsRow = (year, totals) => [`Totale ${year}`, ...FIELDS.map(([field]) => (totals?.[field] == null ? '' : Number(totals[field])))];

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

export function exportAnnualLedgerCsv({ year, months, MONTHS, totals }) {
  const header = ['Mese', ...FIELDS.map(([, label]) => label)];
  const rows = [...buildRows(months, MONTHS), buildTotalsRow(year, totals)];
  const cell = (value, isNumber) => {
    if (value === '' || value == null) return '';
    if (!isNumber) return `"${String(value).replace(/"/g, '""')}"`;
    return String(value).replace('.', ',');
  };
  const lines = [header, ...rows].map((row) => row.map((value, i) => cell(value, i > 0)).join(';'));
  // Leading BOM so Excel detects UTF-8 and renders accented characters correctly.
  const blob = new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
  const filename = `controllo_gestione_${year}.csv`;
  downloadBlob(blob, filename);
  return filename;
}

export function exportAnnualLedgerPdf({ year, months, MONTHS, totals }) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const W = 297, M = 14;
  let y = 20;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.setTextColor(26, 78, 102);
  doc.text(`Controllo di gestione — ${year}`, W / 2, y, { align: 'center' });
  y += 10;

  const header = ['Mese', ...FIELDS.map(([, label]) => label)];
  const rows = buildRows(months, MONTHS);
  const totalsRow = buildTotalsRow(year, totals);
  const colWidth = (W - M * 2) / header.length;
  const euro = (value) => (value === '' || value == null ? '—' : Number(value).toLocaleString('it-IT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }));
  const rowHeight = 8;

  doc.setFontSize(9.5);
  const drawRow = (cells, { header: isHeader, totals: isTotals } = {}) => {
    if (isHeader) { doc.setFillColor(230, 236, 242); doc.rect(M, y - 5.5, W - M * 2, rowHeight, 'F'); }
    if (isTotals) { doc.setDrawColor(26, 107, 138); doc.setLineWidth(0.5); doc.line(M, y - 5.5, W - M, y - 5.5); }
    doc.setFont('helvetica', isHeader || isTotals ? 'bold' : 'normal');
    doc.setTextColor(isHeader ? 60 : 30, isHeader ? 70 : 30, isHeader ? 80 : 30);
    cells.forEach((value, i) => {
      const text = i === 0 ? String(value) : euro(value);
      doc.text(text, i === 0 ? M + 2 : M + colWidth * (i + 1) - 2, y, { align: i === 0 ? 'left' : 'right' });
    });
    y += rowHeight;
  };
  drawRow(header, { header: true });
  rows.forEach((row) => drawRow(row));
  drawRow(totalsRow, { totals: true });

  const filename = `controllo_gestione_${year}.pdf`;
  downloadBlob(doc.output('blob'), filename);
  return filename;
}
