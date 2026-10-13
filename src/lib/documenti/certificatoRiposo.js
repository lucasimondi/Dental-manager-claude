/* Certificato riposo (Product Owner, 2026-10-13): stesso modello del
   certificato scritto a mano dal medico — attestazione della visita, giorni
   di riposo, "In fede" e i dati anagrafici del paziente presi dalla scheda
   (luogo e data di nascita, residenza, codice fiscale). Testi puri, testati in
   tests/certificatoRiposo.test.mjs; il PDF usa il layout condiviso. */
import { jsPDF } from 'jspdf';
import { fmtD } from '../utils.js';
import { createPdfLayout, nomeFilePaziente } from './pdfLayout.js';

const clean = (v) => String(v ?? '').trim();
const dataLunga = (iso) => new Date(`${iso}T12:00`).toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric' });

export const giorniRiposoValidi = (n) => {
  const g = Math.floor(Number(n));
  return Number.isFinite(g) && g >= 1 && g <= 365 ? g : null;
};

export const testoGiorniRiposo = (n) => (Number(n) === 1 ? 'almeno un giorno di riposo' : `almeno ${n} giorni di riposo`);

/** I paragrafi del certificato (senza intestazione, firma e dati anagrafici). */
export function testoCertificatoRiposo({ studio, paziente, dataVisita, giorni }) {
  const medico = [clean(studio?.nome), clean(studio?.spec)].filter(Boolean).join(', ');
  const nome = [clean(paziente?.nome), clean(paziente?.cognome)].filter(Boolean).join(' ');
  return [
    `Il sottoscritto ${medico}, certifica di aver visitato in data ${fmtD(dataVisita)} il/la Sig./Sig.ra ${nome}.`,
    `In base alla visita da me effettuata nel giorno ${dataLunga(dataVisita)} il paziente necessita di ${testoGiorniRiposo(giorni)}.`,
  ];
}

/** Le righe anagrafiche dalla scheda; i dati mancanti si saltano. */
export function datiAnagraficiPaziente(paziente) {
  const nome = [clean(paziente?.nome), clean(paziente?.cognome)].filter(Boolean).join(' ');
  const luogo = clean(paziente?.luogoNascita);
  const nascita = paziente?.dataNascita ? fmtD(paziente.dataNascita) : '';
  const nato = luogo && nascita ? `Nato/a a ${luogo} il ${nascita}` : luogo ? `Nato/a a ${luogo}` : nascita ? `Nato/a il ${nascita}` : '';
  const indirizzo = clean(paziente?.indirizzo);
  const provincia = clean(paziente?.provincia);
  const comune = [clean(paziente?.cap), clean(paziente?.comune), provincia && `(${provincia})`].filter(Boolean).join(' ');
  return [nome, nato, indirizzo && `Residente in ${indirizzo}`, comune, clean(paziente?.cf).toUpperCase()].filter(Boolean);
}

/** Il PDF: { dataUrl, filename, titolo, tipoDoc } — archiviato tra i certificati. */
export function buildCertificatoRiposoPdf({ si, paziente, data, dataVisita, giorni, note }) {
  const { STUDIO, intestazione, pazienteBox, finalizzaMultipagina } = createPdfLayout({ si, data });
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const W = 210, M = 18;
  let y = intestazione(doc, W, M);

  doc.setFillColor(26, 107, 138);
  doc.rect(M, y, W - M * 2, 9, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(255, 255, 255);
  doc.text('CERTIFICATO DI RIPOSO', W / 2, y + 6, { align: 'center' });
  y += 13;

  y = pazienteBox(doc, paziente, y, W, M);
  y += 8;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  doc.setTextColor(26, 32, 44);
  for (const paragrafo of testoCertificatoRiposo({ studio: STUDIO, paziente, dataVisita, giorni })) {
    const lines = doc.splitTextToSize(paragrafo, W - M * 2);
    doc.text(lines, M, y);
    y += lines.length * 6 + 4;
  }
  if (clean(note)) {
    const lines = doc.splitTextToSize(clean(note), W - M * 2);
    doc.text(lines, M, y);
    y += lines.length * 6 + 4;
  }
  doc.text('In fede', M, y);
  y += 12;

  const anagrafica = datiAnagraficiPaziente(paziente);
  doc.setFontSize(10.5);
  anagrafica.forEach((riga) => { doc.text(riga, M, y); y += 5.5; });

  y += 6;
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(9);
  doc.setTextColor(100, 100, 100);
  doc.text(fmtD(data), M, y);

  finalizzaMultipagina(doc, W, M);
  return { dataUrl: doc.output('datauristring'), filename: nomeFilePaziente(paziente), titolo: 'Certificato riposo', tipoDoc: 'certificato' };
}
