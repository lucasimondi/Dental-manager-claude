/* Il preventivo di un piano di cura in PDF. Un solo generatore, usato
   dall'anteprima del preventivo (PdfView) e da Poliedron, che lo prepara in
   chat: stesso aspetto, stesso file "Nome Cognome.pdf". */
import { jsPDF } from 'jspdf';
import { nomeFilePaziente } from './pdfLayout.js';

const BLU = [26, 78, 102];
const BLU_CHIARO = [74, 144, 196];
const TESTO = [26, 32, 44];
const GRIGIO = [113, 128, 150];
const GRIGIO_SCURO = [74, 85, 104];
const LINEA = [214, 222, 232];
const FONDO = [246, 249, 252];

// "€ 1.358,00": migliaia sempre col punto (toLocaleString non le mette sotto 10.000).
export const euroIt = (n) => {
  const [interi, decimali] = Math.abs(Number(n) || 0).toFixed(2).split('.');
  return `€ ${Number(n) < 0 ? '-' : ''}${interi.replace(/\B(?=(\d{3})+(?!\d))/g, '.')},${decimali}`;
};

/** Subtotale, sconto e totale del piano (stessa regola di Piani e PianoDrillDown). */
export function totaliPreventivo(piano) {
  const voci = Array.isArray(piano?.voci) ? piano.voci : [];
  const subtotale = voci.reduce((s, v) => s + (Number(v.prezzo) || 0), 0);
  const sconto = Number(piano?.sconto) || 0;
  const scontato = piano?.scontoTipo === 'pct' ? subtotale * (sconto / 100) : Math.min(sconto, subtotale);
  return { subtotale, sconto, scontato, totale: Math.max(0, subtotale - scontato) };
}

/** Il numero del preventivo: le ultime 6 cifre dell'id del piano. */
export const numeroPreventivo = (piano) => String(piano?.id ?? '').slice(-6).padStart(6, '0');

const dataIt = (iso) => {
  const d = iso ? new Date(`${String(iso).slice(0, 10)}T12:00`) : new Date();
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('it-IT');
};

/**
 * buildPreventivoPdf({ si, paziente, piano, data? }) -> { dataUrl, filename, titolo, tipoDoc }
 * `data` (YYYY-MM-DD) è la data di emissione: di default oggi.
 */
export function buildPreventivoPdf({ si = {}, paziente = {}, piano, data }) {
  const isDentistico = !si?.vertical || si.vertical === 'dentistico';
  const voci = Array.isArray(piano?.voci) ? piano.voci : [];
  const { scontato, totale, subtotale, sconto } = totaliPreventivo(piano);
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const W = 210, H = 297, M = 16, CW = W - M * 2;
  const FONDO_PAGINA = H - 24; // sotto: firme e piè di pagina
  const txt = (t, x, y, opts) => doc.text(String(t ?? ''), x, y, opts);
  const colore = (c) => doc.setTextColor(...c);
  const font = (stile, size) => { doc.setFont('helvetica', stile); doc.setFontSize(size); };
  const linea = (y, c = LINEA, w = 0.3) => { doc.setDrawColor(...c); doc.setLineWidth(w); doc.line(M, y, W - M, y); };
  const box = (x, y, w, h, c) => { doc.setFillColor(...c); doc.rect(x, y, w, h, 'F'); };

  // ── Intestazione dello studio ──
  let y = 20;
  font('bolditalic', 22); colore(BLU);
  txt(si.nome || 'Studio', W / 2, y, { align: 'center' }); y += 7;
  if (si.spec) { font('normal', 9.5); colore(BLU_CHIARO); txt(si.spec, W / 2, y, { align: 'center' }); y += 5; }
  if (si.iscr) { font('normal', 8.5); colore(BLU_CHIARO); txt(si.iscr, W / 2, y, { align: 'center' }); y += 5; }
  const contatti = [si.tel && `Tel. ${si.tel}`, si.email, si.piva && `P.IVA ${si.piva}`].filter(Boolean).join('   ·   ');
  if (contatti) { y += 1; font('normal', 8); colore(GRIGIO_SCURO); txt(contatti, W / 2, y, { align: 'center', maxWidth: CW }); y += 4; }
  y += 2; linea(y, BLU, 0.6); y += 11;

  // ── Titolo del documento ──
  font('bold', 20); colore(TESTO);
  doc.setCharSpace(1.2);
  txt('PREVENTIVO', M, y);
  doc.setCharSpace(0);
  font('normal', 9); colore(GRIGIO);
  txt(`N° ${numeroPreventivo(piano)}`, W - M, y - 5, { align: 'right' });
  txt(`Data ${dataIt(data)}`, W - M, y, { align: 'right' });
  y += 9;

  // ── Paziente e piano di cura, in due riquadri affiancati ──
  const gap = 6, colW = (CW - gap) / 2;
  const nome = [paziente?.nome, paziente?.cognome].filter(Boolean).join(' ');
  const datiPaziente = [
    paziente?.cf && `C.F. ${String(paziente.cf).toUpperCase()}`,
    paziente?.dataNascita && `Nato/a il ${dataIt(paziente.dataNascita)}`,
    paziente?.indirizzo,
  ].filter(Boolean);
  const titoloPiano = doc.splitTextToSize(String(piano?.titolo || 'Piano di cura'), colW - 10).slice(0, 2);
  const datiPiano = [
    `${voci.length} ${voci.length === 1 ? 'prestazione' : 'prestazioni'}`,
    piano?.scadenzaPagamento && `Scadenza pagamento ${dataIt(piano.scadenzaPagamento)}`,
  ].filter(Boolean);
  const altezzaRiquadro = Math.max(14 + datiPaziente.length * 4.6, 10 + titoloPiano.length * 5.2 + datiPiano.length * 4.6) + 4;
  const riquadro = (x, etichetta) => {
    box(x, y, colW, altezzaRiquadro, FONDO);
    doc.setFillColor(...BLU_CHIARO); doc.rect(x, y, 1.2, altezzaRiquadro, 'F');
    font('bold', 7.5); colore(GRIGIO);
    doc.setCharSpace(0.4); txt(etichetta, x + 5, y + 6); doc.setCharSpace(0);
  };
  riquadro(M, 'PAZIENTE');
  font('bold', 12); colore(TESTO);
  txt(nome || '—', M + 5, y + 12.5, { maxWidth: colW - 10 });
  font('normal', 8.5); colore(GRIGIO_SCURO);
  datiPaziente.forEach((riga, i) => txt(riga, M + 5, y + 18 + i * 4.6, { maxWidth: colW - 10 }));
  const x2 = M + colW + gap;
  riquadro(x2, 'PIANO DI CURA');
  font('bold', 11); colore(TESTO);
  titoloPiano.forEach((riga, i) => txt(riga, x2 + 5, y + 12.5 + i * 5.2));
  font('normal', 8.5); colore(GRIGIO_SCURO);
  const yDatiPiano = y + 12.5 + titoloPiano.length * 5.2 + 0.5;
  datiPiano.forEach((riga, i) => txt(riga, x2 + 5, yDatiPiano + i * 4.6));
  y += altezzaRiquadro + 9;

  // ── Tabella delle prestazioni ──
  const colN = M + 3;
  const colPrest = M + 11;
  const colDente = M + 112;
  const colStato = M + 132;
  const colImporto = W - M - 3;
  const larghezzaPrest = (isDentistico ? colDente : colStato) - colPrest - 4;
  const testata = () => {
    box(M, y, CW, 8, BLU);
    font('bold', 8); colore([255, 255, 255]);
    txt('#', colN, y + 5.3);
    txt('PRESTAZIONE', colPrest, y + 5.3);
    if (isDentistico) txt('DENTE', colDente, y + 5.3);
    txt('STATO', colStato, y + 5.3);
    txt('IMPORTO', colImporto, y + 5.3, { align: 'right' });
    y += 8;
  };
  testata();
  voci.forEach((v, i) => {
    font('normal', 9.5);
    const righe = doc.splitTextToSize(String(v.prestazione || ''), larghezzaPrest);
    const h = Math.max(9, 4.5 + righe.length * 4.5);
    if (y + h > FONDO_PAGINA - 10) { doc.addPage(); y = 20; testata(); }
    if (i % 2 === 1) box(M, y, CW, h, FONDO);
    const base = y + 6;
    font('normal', 9); colore(GRIGIO);
    txt(String(i + 1), colN, base);
    font('normal', 9.5); colore(TESTO);
    righe.forEach((r, ri) => txt(r, colPrest, base + ri * 4.5));
    if (isDentistico) txt(v.dente || '—', colDente, base);
    font('bold', 8);
    if (v.eseguita) { colore([45, 158, 97]); txt('Eseguita', colStato, base); }
    else { colore([224, 128, 64]); txt('Da eseguire', colStato, base); }
    font('normal', 9.5); colore(TESTO);
    txt(euroIt(v.prezzo), colImporto, base, { align: 'right' });
    y += h;
    doc.setDrawColor(...LINEA); doc.setLineWidth(0.2); doc.line(M, y, W - M, y);
  });

  // ── Totali, allineati a destra ──
  const righeTotali = scontato > 0 ? 3 : 1;
  if (y + 8 + righeTotali * 7 + 4 > FONDO_PAGINA) { doc.addPage(); y = 20; }
  y += 6;
  const totX = W - M - 82;
  if (scontato > 0) {
    font('normal', 9.5); colore(GRIGIO_SCURO);
    txt('Subtotale', totX + 4, y + 4); txt(euroIt(subtotale), colImporto, y + 4, { align: 'right' }); y += 7;
    colore([45, 158, 97]);
    txt(`Sconto ${piano?.scontoTipo === 'pct' ? `${sconto}%` : ''}`.trim(), totX + 4, y + 4);
    txt(`- ${euroIt(scontato)}`, colImporto, y + 4, { align: 'right' }); y += 7;
  }
  box(totX, y, W - M - totX, 11, BLU);
  font('bold', 10); colore([255, 255, 255]);
  doc.setCharSpace(0.6); txt('TOTALE', totX + 4, y + 7.3); doc.setCharSpace(0);
  font('bold', 13);
  txt(euroIt(totale), colImporto, y + 7.6, { align: 'right' });
  y += 19;

  // ── Note del paziente (come nell'anteprima) ──
  if (paziente?.note) {
    font('normal', 8.5);
    const noteLines = doc.splitTextToSize(String(paziente.note), CW - 10);
    const boxH = 9 + noteLines.length * 4.2;
    if (y + boxH > FONDO_PAGINA - 30) { doc.addPage(); y = 20; }
    box(M, y, CW, boxH, [255, 251, 235]);
    font('bold', 8); colore([120, 53, 15]); txt('Note', M + 5, y + 5.5);
    font('normal', 8.5);
    noteLines.forEach((ln, li) => txt(ln, M + 5, y + 10 + li * 4.2));
    y += boxH + 8;
  }

  // ── Firme: in fondo all'ultima pagina ──
  if (y > FONDO_PAGINA - 20) doc.addPage();
  const yF = FONDO_PAGINA - 4;
  const firmaW = 70;
  doc.setDrawColor(...GRIGIO); doc.setLineWidth(0.3);
  doc.line(M, yF, M + firmaW, yF);
  doc.line(W - M - firmaW, yF, W - M, yF);
  font('normal', 8); colore(GRIGIO);
  txt('Il medico', M, yF + 4.5);
  txt('Il paziente, per accettazione', W - M - firmaW, yF + 4.5);

  // ── Piè di pagina su ogni pagina ──
  const piede = [si.tel && `Tel. ${si.tel}`, si.addr1, si.addr2, si.email].filter(Boolean).join('   ·   ');
  const pagine = doc.internal.getNumberOfPages();
  for (let p = 1; p <= pagine; p++) {
    doc.setPage(p);
    linea(H - 14);
    font('normal', 7.5); colore(GRIGIO_SCURO);
    const righePiede = doc.splitTextToSize(piede, CW).slice(0, 2);
    righePiede.forEach((r, i) => txt(r, W / 2, H - 9.5 + i * 3.6, { align: 'center' }));
    if (pagine > 1) { colore(GRIGIO); txt(`Pagina ${p} di ${pagine}`, W - M, 12, { align: 'right' }); }
  }

  return {
    dataUrl: doc.output('datauristring'),
    filename: nomeFilePaziente(paziente),
    titolo: `Preventivo · ${nome || 'Paziente'}`,
    tipoDoc: 'preventivo',
  };
}
