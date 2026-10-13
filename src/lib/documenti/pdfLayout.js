/* Layout condiviso dei documenti medici in PDF (intestazione dello studio,
   box paziente, timbro/firma, piè di pagina) e la ricetta medica. Usato dal
   modulo Documenti (DocMedico) e da Poliedron, che prepara la ricetta in chat:
   stesso aspetto, stesso file. */
import { jsPDF } from 'jspdf';
import { fmtD, DEF_DOCUMENTI_SETTINGS } from '../utils.js';
import { applyConfiguredSignature } from '../pdfSignature.js';

export function studioIntestazione(si) {
  return {
    nome: si?.nome || 'Studio',
    spec: si?.spec || '',
    iscr: si?.iscr || '',
    addr: si?.addr1 || '',
    tel: si?.tel || '',
    email: si?.email || '',
    piva: si?.piva || '',
  };
}

/** Funzioni di disegno legate allo studio e alla data del documento. */
export function createPdfLayout({ si, data }) {
  const STUDIO = studioIntestazione(si);
  // Il timbro completo con firma scansionata compare per qualsiasi studio
  // che ne abbia caricata una da Impostazioni.
  const hasFirma = !!si?.firma_b64;

  const intestazione = (doc, W, M) => {
    let y = 18;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.setTextColor(26, 78, 102);
    doc.text(STUDIO.nome, W / 2, y, { align: 'center' }); y += 6;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(74, 144, 196);
    doc.text(STUDIO.spec, W / 2, y, { align: 'center' }); y += 5;
    doc.text(STUDIO.iscr, W / 2, y, { align: 'center' }); y += 5;
    doc.setTextColor(100, 100, 100);
    doc.text(`${STUDIO.addr}   |   Tel: ${STUDIO.tel}`, W / 2, y, { align: 'center' }); y += 7;
    doc.setDrawColor(26, 107, 138);
    doc.setLineWidth(0.5);
    doc.line(M, y, W - M, y); y += 8;
    return y;
  };

  const pazienteBox = (doc, paz, y, W, M) => {
    doc.setFillColor(245, 247, 250);
    doc.rect(M, y, W - M * 2, 14, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(113, 128, 150);
    doc.text('PAZIENTE', M + 3, y + 4);
    doc.text('DATA', W / 2, y + 4);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(11);
    doc.setTextColor(26, 32, 44);
    doc.text(`${paz.nome} ${paz.cognome}`, M + 3, y + 11);
    if (paz.dataNascita) {
      doc.setFontSize(8);
      doc.setTextColor(113, 128, 150);
      doc.text(`Nato/a il ${fmtD(paz.dataNascita)}`, M + 3, y + 16);
    }
    doc.setFontSize(11);
    doc.setTextColor(26, 32, 44);
    doc.text(new Date(data + 'T12:00').toLocaleDateString('it-IT'), W / 2, y + 11);
    return y + (paz.dataNascita ? 22 : 18);
  };

  const footer = (doc, W, M) => {
    const fY = 228;

    if (hasFirma) {
      // ── Timbro professionale con firma scansionata ──
      const tW = 60, tH = 21;
      const tX = (W - tW) / 2;
      const tY = fY + 5;
      const pad = 3;

      doc.setDrawColor(26, 78, 102);
      doc.setLineWidth(0.8);
      doc.roundedRect(tX, tY, tW, tH, 2.5, 2.5, 'S');
      doc.setLineWidth(0.3);
      doc.roundedRect(tX + 1, tY + 1, tW - 2, tH - 2, 2, 2, 'S');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(4.5);
      doc.setTextColor(26, 78, 102);
      doc.text(STUDIO.nome, tX + tW / 2, tY + 4.5, { align: 'center', maxWidth: tW - pad * 2 });

      doc.setDrawColor(26, 78, 102);
      doc.setLineWidth(0.2);
      doc.line(tX + 4, tY + 5.8, tX + tW - 4, tY + 5.8);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(3);
      doc.setTextColor(26, 78, 102);
      doc.text(STUDIO.spec, tX + tW / 2, tY + 8, { align: 'center', maxWidth: tW - pad * 2 });

      doc.text(STUDIO.iscr, tX + tW / 2, tY + 10.5, { align: 'center', maxWidth: tW - pad * 2 });

      doc.setLineWidth(0.2);
      doc.line(tX + 5, tY + 12, tX + tW - 5, tY + 12);

      doc.setFontSize(2.8);
      doc.text(STUDIO.addr, tX + tW / 2, tY + 14, { align: 'center', maxWidth: tW - pad * 2 });
      doc.text(`Tel. ${STUDIO.tel} · ${STUDIO.email}`, tX + tW / 2, tY + 16.5, { align: 'center', maxWidth: tW - pad * 2 });

      doc.setFontSize(2.5);
      doc.setTextColor(80, 110, 130);
      doc.text(`P.IVA ${STUDIO.piva}`, tX + tW / 2, tY + 19, { align: 'center', maxWidth: tW - pad * 2 });

      try {
        applyConfiguredSignature(doc, si.firma_b64, tX + tW / 2 - 14, tY - 4);
      } catch (e) { /* firma non leggibile: il timbro resta */ }
    } else {
      // ── Footer generico: nessuna firma personale ──
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(100, 100, 100);
      const righe = [STUDIO.nome, STUDIO.addr, [STUDIO.tel, STUDIO.email].filter(Boolean).join(' · ')].filter(Boolean);
      let yy = fY + 8;
      righe.forEach((r) => { doc.text(r, W / 2, yy, { align: 'center' }); yy += 4; });
    }

    // ── Footer testo ──
    doc.setDrawColor(200, 210, 220);
    doc.setLineWidth(0.3);
    doc.line(M, 283, W - M, 283);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(150, 160, 170);
    doc.text(`${STUDIO.nome} · ${STUDIO.addr} · P.IVA ${STUDIO.piva}`, W / 2, 287, { align: 'center' });
  };

  // Da chiamare UNA SOLA VOLTA a fine documento: ripete intestazione e
  // timbro/firma su ogni pagina e aggiunge "Pagina X di Y" se serve.
  const finalizzaMultipagina = (doc, W, M) => {
    const nPagine = doc.internal.getNumberOfPages();
    for (let p = 1; p <= nPagine; p++) {
      doc.setPage(p);
      if (p > 1) intestazione(doc, W, M);
      footer(doc, W, M);
      if (nPagine > 1) {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7.5);
        doc.setTextColor(150, 160, 170);
        doc.text(`Pagina ${p} di ${nPagine}`, W - M, 12, { align: 'right' });
      }
    }
  };

  return { STUDIO, hasFirma, intestazione, pazienteBox, footer, finalizzaMultipagina };
}

/** Nome del file di ogni documento del paziente: "Nome Cognome.pdf" (PO).
    Senza caratteri che i telefoni o WhatsApp non accettano in un nome file. */
export function nomeFilePaziente(paziente) {
  return nomeFileDaNome([paziente?.nome, paziente?.cognome].map((v) => String(v || '').trim()).filter(Boolean).join(' '));
}

/** Stessa regola partendo dal nome completo già scritto (es. `paziente_nome` dell'archivio). */
export function nomeFileDaNome(nomeCompleto) {
  const nome = String(nomeCompleto || '').replace(/[\\/:*?"<>|\u0000-\u001f]+/g, ' ').replace(/\s+/g, ' ').trim();
  return `${nome || 'Paziente'}.pdf`;
}

/** La ricetta medica in PDF: { dataUrl, filename, titolo, tipoDoc }. */
export function buildRicettaPdf({ si, paziente, farmaci, data }) {
  const { STUDIO, intestazione, pazienteBox, finalizzaMultipagina } = createPdfLayout({ si, data });
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const W = 210, M = 18;
  let y = intestazione(doc, W, M);

  doc.setFillColor(26, 107, 138);
  doc.rect(M, y, W - M * 2, 9, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(255, 255, 255);
  doc.text('RICETTA MEDICA', W / 2, y + 6, { align: 'center' });
  y += 13;

  y = pazienteBox(doc, paziente, y, W, M);
  y += 4;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(26, 107, 138);
  doc.text('PRESCRIZIONE:', M, y); y += 6;

  farmaci.filter((f) => f.farmaco.trim()).forEach((f, i) => {
    const details = [f.dosaggio && `Dosaggio: ${f.dosaggio}`, f.posologia && `Posologia: ${f.posologia}`, f.durata && `Durata: ${f.durata}`, f.note && `Note: ${f.note}`].filter(Boolean);
    const rh = 10 + details.length * 5;
    if (y + rh > 220) { doc.addPage(); y = 52; }
    doc.setFillColor(i % 2 === 0 ? 247 : 255, i % 2 === 0 ? 250 : 255, i % 2 === 0 ? 252 : 255);
    doc.rect(M, y, W - M * 2, rh, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(26, 32, 44);
    doc.text(`${i + 1}. ${f.farmaco}`, M + 3, y + 7);
    if (details.length) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(74, 85, 104);
      details.forEach((line, detailIndex) => doc.text(line, M + 5, y + 13 + detailIndex * 5));
    }
    y += rh + 2;
  });

  y += 8;
  y += 4;
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(8);
  doc.setTextColor(130, 130, 130);
  doc.text('Ricetta valida 30 giorni dalla data di emissione. · Medico prescrittore: ' + STUDIO.nome, M, y);

  finalizzaMultipagina(doc, W, M);
  return {
    dataUrl: doc.output('datauristring'),
    filename: nomeFilePaziente(paziente),
    titolo: 'Ricetta medica',
    tipoDoc: 'ricetta',
  };
}

/** Saves the PDF in the patient's archive when the studio keeps that document type. Returns the row or null. */
export async function archiviaDocumento(client, { si, studioId, paziente, tipoDoc, titolo, data, dataUrl }) {
  const settings = { ...DEF_DOCUMENTI_SETTINGS, ...(si?.documenti_settings || {}) };
  if (!client || !settings[tipoDoc] || !studioId) return null;
  const { data: saved, error } = await client.from('documenti_medici').insert([{
    studio_id: studioId,
    paziente_id: paziente.id,
    paziente_nome: `${paziente.nome} ${paziente.cognome}`,
    tipo: tipoDoc,
    titolo,
    data,
    pdf_base64: dataUrl,
  }]).select('id, tipo, titolo, data, paziente_id, created_at').single();
  return error ? null : saved;
}
