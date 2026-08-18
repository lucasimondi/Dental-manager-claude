import { jsPDF } from 'jspdf';
import { fmtD } from './utils';

/* ── REPORT PERCORSO FISIOTERAPICO ──
   Genera un PDF di riepilogo (valutazione iniziale → rivalutazione più
   recente → obiettivi → sedute → programma domiciliare) a partire dai dati
   già caricati in PhysioCartella. Nessuna scrittura su database: solo
   generazione lato client, riusa lo stile visivo di pdfConsenso.js senza
   toccarne il codice. Il professionista può rivedere/modificare il
   contenuto prima di consegnarlo (punto 15 della richiesta originale). */

const intestazione = (doc, W, M, studio) => {
  let y = 18;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(26, 78, 102);
  doc.text(studio?.nome || '', W / 2, y, { align: 'center' }); y += 6;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(74, 144, 196);
  if (studio?.spec) { doc.text(studio.spec, W / 2, y, { align: 'center' }); y += 5; }
  doc.setTextColor(100, 100, 100);
  doc.text(`${studio?.addr1 || ''}   ${studio?.tel ? '|   Tel: ' + studio.tel : ''}`, W / 2, y, { align: 'center' }); y += 7;
  doc.setDrawColor(26, 107, 138);
  doc.setLineWidth(0.5);
  doc.line(M, y, W - M, y); y += 8;
  return y;
};

const sezione = (doc, titolo, y, W, M) => {
  if (y > 260) { doc.addPage(); y = 18; }
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(24, 95, 165);
  doc.text(titolo, M, y);
  return y + 6;
};

const riga = (doc, testo, y, W, M, opts = {}) => {
  if (y > 270) { doc.addPage(); y = 18; }
  doc.setFont('helvetica', opts.bold ? 'bold' : 'normal');
  doc.setFontSize(opts.size || 10);
  doc.setTextColor(...(opts.color || [26, 32, 44]));
  const lines = doc.splitTextToSize(testo, W - M * 2);
  doc.text(lines, M, y);
  return y + lines.length * (opts.lineHeight || 5) + 2;
};

export function generaReportPercorso({ studio, paziente, valutazioni = [], obiettivi = [], diario = [], prescrizioni = [] }) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const W = doc.internal.pageSize.getWidth();
  const M = 16;
  let y = intestazione(doc, W, M, studio);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(26, 32, 44);
  doc.text('Riepilogo percorso fisioterapico', M, y); y += 8;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(90, 100, 115);
  doc.text(`${paziente?.nome || ''} ${paziente?.cognome || ''}`.trim(), M, y); y += 5;
  doc.text(`Generato il ${new Date().toLocaleDateString('it-IT')}`, M, y); y += 10;

  const inizialeVal = [...valutazioni].reverse().find((v) => v.tipo === 'iniziale') || [...valutazioni].reverse()[0];
  const ultimaVal = valutazioni[0];

  if (inizialeVal) {
    y = sezione(doc, 'Valutazione iniziale', y, W, M);
    y = riga(doc, `${fmtD(inizialeVal.data)}${inizialeVal.distretto ? ' · ' + inizialeVal.distretto : ''}`, y, W, M, { bold: true });
    if (inizialeVal.motivo_visita) y = riga(doc, inizialeVal.motivo_visita, y, W, M);
    if (inizialeVal.dolore_riposo !== null) y = riga(doc, `Dolore a riposo: ${inizialeVal.dolore_riposo}/10 · durante esercizio: ${inizialeVal.dolore_esercizio ?? '—'}/10`, y, W, M);
    y += 3;
  }

  if (ultimaVal && ultimaVal.id !== inizialeVal?.id) {
    y = sezione(doc, `Rivalutazione più recente (${fmtD(ultimaVal.data)})`, y, W, M);
    if (ultimaVal.dolore_riposo !== null) y = riga(doc, `Dolore a riposo: ${ultimaVal.dolore_riposo}/10 · durante esercizio: ${ultimaVal.dolore_esercizio ?? '—'}/10`, y, W, M);
    if (ultimaVal.dati && Object.keys(ultimaVal.dati).length) {
      Object.entries(ultimaVal.dati).forEach(([k, v]) => { y = riga(doc, `${k}: ${v}`, y, W, M, { size: 9.5 }); });
    }
    y += 3;
  }

  if (obiettivi.length) {
    y = sezione(doc, 'Obiettivi', y, W, M);
    obiettivi.forEach((ob) => {
      const pct = (ob.valore_iniziale !== null && ob.valore_attuale !== null && ob.valore_target !== null && ob.valore_target !== ob.valore_iniziale)
        ? Math.max(0, Math.min(100, Math.round(((ob.valore_attuale - ob.valore_iniziale) / (ob.valore_target - ob.valore_iniziale)) * 100)))
        : null;
      y = riga(doc, `${ob.descrizione}${pct !== null ? ` — ${pct}%` : ''} (${ob.stato})`, y, W, M);
    });
    y += 3;
  }

  if (diario.length) {
    y = sezione(doc, `Diario sedute (${diario.length} registrate)`, y, W, M);
    diario.slice(0, 10).forEach((d) => {
      y = riga(doc, `${fmtD(d.data)} · seduta ${d.numero_seduta}${d.trattamenti_svolti ? ' — ' + d.trattamenti_svolti : ''}`, y, W, M, { size: 9.5 });
    });
    if (diario.length > 10) y = riga(doc, `… e altre ${diario.length - 10} sedute`, y, W, M, { size: 9, color: [140, 148, 160] });
    y += 3;
  }

  const attive = prescrizioni.filter((p) => p.attiva);
  if (attive.length) {
    y = sezione(doc, 'Programma domiciliare attuale', y, W, M);
    attive.forEach((p) => {
      const dose = [p.serie && p.ripetizioni ? `${p.serie}×${p.ripetizioni}` : null, p.frequenza_settimanale ? `${p.frequenza_settimanale}×/sett` : null].filter(Boolean).join(' · ');
      y = riga(doc, `${p.physio_esercizi?.nome || 'Esercizio'}${dose ? ' — ' + dose : ''}`, y, W, M, { size: 9.5 });
    });
  }

  const nomeFile = `report-fisioterapico-${(paziente?.cognome || 'paziente').toLowerCase().replace(/\s+/g, '-')}-${new Date().toISOString().slice(0, 10)}.pdf`;
  doc.save(nomeFile);
}
