import React, { useState } from 'react';
import { jsPDF } from 'jspdf';
import { Btn, Crd, Fld, Inp, Sel, Modal, Ic } from './ui';
import { C, fmt, fmtD, today } from '../lib/utils';

const STUDIO = {
  nome: 'Dott. Luca Simondi',
  spec: 'Medico Odontoiatra · Chirurgo Orale',
  iscr: 'Iscr. Ordine Medici ed Odontoiatri Cuneo n. 0577',
  addr: 'Corso Galileo Ferraris 11bis · 12100 Cuneo (CN)',
  tel: '320 5505397',
  email: 'dottorsimondi@gmail.com',
};


const FIRMA_B64 = 'data:image/jpeg;base64,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AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAP//aAAwDAQACAAMAAAAhAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAYoAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAEwoAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAcAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA08AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAkIAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAQgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAMMAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAoAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAkoAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAUMAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAYIAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAkoAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAsgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA4AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAEIAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAEgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAsIAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAcAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAUkAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAQQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAEAAAAAAAAAAAAAQgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA4gAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAEIAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAEMAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAMAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAsAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA0IAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAUoAAAAAAAAAAAAAAAoAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAUQgAAAAAAAAAAAAAoAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAQAAEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAYAAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAcMAAAAAAAAAAAIAAAgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAgcAAAAAAAAAEwAAoAgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAUAAAAAAAAAIgAAEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAsAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAIAAAAAAAUIAAAAEgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAMAAAAAAAAEIAAAAAgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAUEoAAAAAUgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAwUAAAAAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAgAAAcAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAEIAgAEEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAQAAMM4AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIAAwAAABDzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzyBTzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzgzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzygjzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzwyjzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzwxTzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzwDzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzxTzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzwTzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzgRzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzxzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzTTzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzxjzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzyzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzyjjzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzyTTzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzxTTzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzxzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzywzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzyhTzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzyxTzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzxzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzxBzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzgDzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzgDzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzyhTzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzRzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzxBTzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzxRTzzzzzzzzzzzzzgBTzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzxzzzzzzzzzzzzzBzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzyhzzzzzzzzzzzzzBzzxTzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzhTzyjzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzyjzzzzzzzzzzzgTzzyzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzQzzzzzzzzzzzDzyDxzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzyjwDzzzzzzzzzjzzyDBzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzxTzzzzzzzzzRzzzwAzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzyzzTzzzzzzzzTzzzzxzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzTzzzzzzzzhTzzzzyTzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzhDzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzwCzzzzzzyjzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzyjzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzyjTzzzQTzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzxyxzzyBzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzyzyyBSzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzz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';

const TIPI = [
  { id: 'ricetta', label: '💊 Ricetta medica', desc: 'Prescrizione farmaci e posologia' },
  { id: 'certificato', label: '📋 Certificato di visita', desc: 'Certificato per visita odontoiatrica' },
  { id: 'lettera', label: '✉️ Lettera per specialista', desc: 'Referral / lettera di consulenza' },
];

export default function DocMedico({ paz, onClose }) {
  const [tipo, setTipo] = useState('ricetta');
  const [data, setData] = useState(today());
  const [generated, setGenerated] = useState(false);

  // Ricetta
  const [farmaci, setFarmaci] = useState([{ farmaco: '', posologia: '', durata: '' }]);

  // Certificato
  const [motivoCert, setMotivoCert] = useState('');
  const [dataVisita, setDataVisita] = useState(today());
  const [noteCert, setNoteCert] = useState('');

  // Lettera
  const [specialista, setSpecialista] = useState('');
  const [motivoLettera, setMotivoLettera] = useState('');
  const [anamnesi, setAnamnesi] = useState('');
  const [diagnosi, setDiagnosi] = useState('');
  const [richiesta, setRichiesta] = useState('');

  const addFarmaco = () => setFarmaci(f => [...f, { farmaco: '', posologia: '', durata: '' }]);
  const updFarmaco = (i, field, val) => setFarmaci(f => f.map((x, j) => j === i ? { ...x, [field]: val } : x));
  const delFarmaco = (i) => setFarmaci(f => f.filter((_, j) => j !== i));

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
    const fY = 248; // spazio per timbro+firma più grande

    // ── LINEA SEPARATORE ──
    doc.setDrawColor(200, 210, 220);
    doc.setLineWidth(0.4);
    doc.line(M, fY, W - M, fY);

    // ── TIMBRO PROFESSIONALE (sinistra) ──
    const tX = M, tY = fY + 4, tW = 80, tH = 30;
    // Bordo timbro stile ovale/rettangolo arrotondato
    doc.setDrawColor(26, 78, 102);
    doc.setLineWidth(1.2);
    doc.roundedRect(tX, tY, tW, tH, 4, 4, 'S');
    doc.setLineWidth(0.4);
    doc.roundedRect(tX + 1.5, tY + 1.5, tW - 3, tH - 3, 3, 3, 'S');

    // Contenuto timbro
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(26, 78, 102);
    doc.text('Dott. Luca Simondi', tX + tW / 2, tY + 7, { align: 'center' });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6);
    doc.setTextColor(26, 78, 102);
    doc.text('Medico Odontoiatra · Chirurgo Orale', tX + tW / 2, tY + 12, { align: 'center' });
    doc.text('Iscr. Ordine Medici Cuneo n. 0577', tX + tW / 2, tY + 16.5, { align: 'center' });

    doc.setDrawColor(26, 78, 102);
    doc.setLineWidth(0.3);
    doc.line(tX + 6, tY + 19, tX + tW - 6, tY + 19);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(5.5);
    doc.setTextColor(26, 78, 102);
    doc.text('C.so Galileo Ferraris 11bis · 12100 Cuneo', tX + tW / 2, tY + 23, { align: 'center' });
    doc.text('Tel. 320 5505397', tX + tW / 2, tY + 27, { align: 'center' });

    // ── FIRMA SOVRAPPOSTA al timbro (leggermente in basso a destra) ──
    try {
      doc.addImage(FIRMA_B64, 'JPEG', tX + 20, tY + 8, 48, 26, undefined, 'FAST');
    } catch(e) {}

    // ── SEZIONE FIRMA (destra) ──
    const fDX = W - M - 65;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(100, 120, 140);
    doc.text('Firma del medico', fDX, fY + 10);
    doc.setDrawColor(26, 107, 138);
    doc.setLineWidth(0.5);
    doc.line(fDX, fY + 32, W - M, fY + 32);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(100, 120, 140);
    doc.text(STUDIO.nome, fDX, fY + 36);

    // ── FOOTER TESTO ──
    doc.setDrawColor(200, 210, 220);
    doc.setLineWidth(0.3);
    doc.line(M, 283, W - M, 283);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(150, 160, 170);
    doc.text(`${STUDIO.nome} · ${STUDIO.addr} · Tel: ${STUDIO.tel} · ${STUDIO.email}`, W / 2, 287, { align: 'center' });
  };

  const generaRicetta = () => {
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const W = 210, M = 18;
    let y = intestazione(doc, W, M);

    // Titolo
    doc.setFillColor(26, 107, 138);
    doc.rect(M, y, W - M * 2, 9, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(255, 255, 255);
    doc.text('RICETTA MEDICA', W / 2, y + 6, { align: 'center' });
    y += 13;

    y = pazienteBox(doc, paz, y, W, M);
    y += 4;

    // Farmaci
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(26, 107, 138);
    doc.text('PRESCRIZIONE:', M, y); y += 6;

    farmaci.filter(f => f.farmaco.trim()).forEach((f, i) => {
      if (y > 240) { doc.addPage(); y = 20; }
      doc.setFillColor(i % 2 === 0 ? 247 : 255, i % 2 === 0 ? 250 : 255, i % 2 === 0 ? 252 : 255);
      const rh = f.durata ? 18 : 13;
      doc.rect(M, y, W - M * 2, rh, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(26, 32, 44);
      doc.text(`${i + 1}. ${f.farmaco}`, M + 3, y + 7);
      if (f.posologia) {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        doc.setTextColor(74, 85, 104);
        doc.text(`Posologia: ${f.posologia}`, M + 5, y + 13);
      }
      if (f.durata) {
        doc.text(`Durata: ${f.durata}`, M + 5 + (f.posologia ? 80 : 0), y + 13);
      }
      y += rh + 2;
    });

    y += 8;
    y += 4;
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(8);
    doc.setTextColor(130, 130, 130);
    doc.text('Ricetta valida 30 giorni dalla data di emissione. · Medico prescrittore: ' + STUDIO.nome, M, y);

    footer(doc, W, M);
    const blob = doc.output('blob');
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ricetta_${paz.cognome}_${data}.pdf`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 5000);
    setGenerated(true);
  };

  const generaCertificato = () => {
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const W = 210, M = 18;
    let y = intestazione(doc, W, M);

    doc.setFillColor(26, 107, 138);
    doc.rect(M, y, W - M * 2, 9, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(255, 255, 255);
    doc.text('CERTIFICATO DI VISITA', W / 2, y + 6, { align: 'center' });
    y += 13;

    y = pazienteBox(doc, paz, y, W, M);
    y += 8;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(11);
    doc.setTextColor(26, 32, 44);
    const testo = `Il sottoscritto ${STUDIO.nome}, ${STUDIO.spec}, certifica di aver visitato in data ${new Date(dataVisita + 'T12:00').toLocaleDateString('it-IT')} il/la Sig./Sig.ra ${paz.nome} ${paz.cognome}${paz.dataNascita ? `, nato/a il ${fmtD(paz.dataNascita)}` : ''}.`;
    const lines = doc.splitTextToSize(testo, W - M * 2);
    doc.text(lines, M, y);
    y += lines.length * 6 + 6;

    if (motivoCert) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.text('Motivo della visita:', M, y); y += 6;
      doc.setFont('helvetica', 'normal');
      const mLines = doc.splitTextToSize(motivoCert, W - M * 2);
      doc.text(mLines, M, y);
      y += mLines.length * 6 + 6;
    }

    if (noteCert) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.text('Note cliniche:', M, y); y += 6;
      doc.setFont('helvetica', 'normal');
      const nLines = doc.splitTextToSize(noteCert, W - M * 2);
      doc.text(nLines, M, y);
      y += nLines.length * 6 + 6;
    }

    y += 4;
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(9);
    doc.setTextColor(100, 100, 100);
    doc.text(`Cuneo, ${new Date(data + 'T12:00').toLocaleDateString('it-IT')}`, M, y);

    footer(doc, W, M);
    const blob = doc.output('blob');
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `certificato_${paz.cognome}_${data}.pdf`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 5000);
    setGenerated(true);
  };

  const generaLettera = () => {
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const W = 210, M = 18;
    let y = intestazione(doc, W, M);

    doc.setFillColor(26, 107, 138);
    doc.rect(M, y, W - M * 2, 9, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(255, 255, 255);
    doc.text('LETTERA PER SPECIALISTA', W / 2, y + 6, { align: 'center' });
    y += 13;

    y = pazienteBox(doc, paz, y, W, M);
    y += 8;

    if (specialista) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(26, 107, 138);
      doc.text(`Alla cortese attenzione del/della: ${specialista}`, M, y); y += 8;
    }

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(26, 32, 44);

    const intro = `Gentile Collega, Le invio il/la Sig./Sig.ra ${paz.nome} ${paz.cognome}${paz.dataNascita ? ` (nato/a il ${fmtD(paz.dataNascita)})` : ''} per consulenza specialistica.`;
    const introLines = doc.splitTextToSize(intro, W - M * 2);
    doc.text(introLines, M, y); y += introLines.length * 5.5 + 6;

    const sections = [
      { label: 'Motivo della consulenza', value: motivoLettera },
      { label: 'Anamnesi', value: anamnesi },
      { label: 'Diagnosi / Quadro clinico attuale', value: diagnosi },
      { label: 'Si richiede', value: richiesta },
    ];

    sections.filter(s => s.value).forEach(s => {
      if (y > 240) { doc.addPage(); y = 20; }
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(26, 107, 138);
      doc.text(s.label + ':', M, y); y += 5;
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(26, 32, 44);
      const sLines = doc.splitTextToSize(s.value, W - M * 2);
      doc.text(sLines, M, y); y += sLines.length * 5.5 + 6;
    });

    y += 4;
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(9);
    doc.setTextColor(100, 100, 100);
    doc.text(`Cuneo, ${new Date(data + 'T12:00').toLocaleDateString('it-IT')}`, M, y);
    y += 5;
    doc.setFont('helvetica', 'normal');
    doc.text('Distinti saluti,', M, y);

    footer(doc, W, M);
    const blob = doc.output('blob');
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `lettera_${paz.cognome}_${data}.pdf`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 5000);
    setGenerated(true);
  };

  const genera = () => {
    setGenerated(false);
    if (tipo === 'ricetta') generaRicetta();
    else if (tipo === 'certificato') generaCertificato();
    else generaLettera();
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: C.bg, zIndex: 500, display: 'flex', flexDirection: 'column' }}>
      {/* HEADER */}
      <div style={{ background: C.priD, padding: '12px 14px', paddingTop: 'max(12px,env(safe-area-inset-top))', display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
        <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.12)', border: 'none', borderRadius: 8, padding: 8, cursor: 'pointer', display: 'flex' }}>
          <Ic n="back" s={18} c="#fff" />
        </button>
        <div style={{ flex: 1 }}>
          <div style={{ color: '#fff', fontWeight: 800, fontSize: 15 }}>📄 Documenti medici</div>
          <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: 11 }}>{paz.nome} {paz.cognome}</div>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: 14 }}>
        {/* TIPO DOCUMENTO */}
        <Crd style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: C.txm, textTransform: 'uppercase', marginBottom: 10 }}>Tipo documento</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {TIPI.map(t => (
              <button key={t.id} onClick={() => { setTipo(t.id); setGenerated(false); }} style={{ padding: '12px 14px', borderRadius: 10, border: `2px solid ${tipo === t.id ? C.pri : C.brd}`, background: tipo === t.id ? C.priL : C.sur, cursor: 'pointer', textAlign: 'left' }}>
                <div style={{ fontWeight: 800, fontSize: 14, color: tipo === t.id ? C.pri : C.txt }}>{t.label}</div>
                <div style={{ fontSize: 11, color: C.txm, marginTop: 2 }}>{t.desc}</div>
              </button>
            ))}
          </div>
        </Crd>

        {/* DATA */}
        <Crd style={{ marginBottom: 14 }}>
          <Fld label="Data documento">
            <Inp type="date" value={data} onChange={e => setData(e.target.value)} />
          </Fld>
        </Crd>

        {/* ── RICETTA ── */}
        {tipo === 'ricetta' && (
          <Crd style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: C.txm, textTransform: 'uppercase', marginBottom: 10 }}>💊 Farmaci prescritti</div>
            {farmaci.map((f, i) => (
              <div key={i} style={{ background: C.bg, borderRadius: 10, padding: 12, marginBottom: 10, border: `1px solid ${C.brd}` }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: C.txm }}>Farmaco {i + 1}</span>
                  {farmaci.length > 1 && <button onClick={() => delFarmaco(i)} style={{ background: C.danL, border: 'none', borderRadius: 6, padding: '3px 7px', cursor: 'pointer' }}><Ic n="x" s={11} c={C.dan} /></button>}
                </div>
                <Fld label="Nome farmaco / principio attivo">
                  <Inp value={f.farmaco} onChange={e => updFarmaco(i, 'farmaco', e.target.value)} placeholder="es. Amoxicillina 875mg, Ibuprofene 600mg..." />
                </Fld>
                <Fld label="Posologia">
                  <Inp value={f.posologia} onChange={e => updFarmaco(i, 'posologia', e.target.value)} placeholder="es. 1 compressa ogni 8 ore ai pasti" />
                </Fld>
                <Fld label="Durata">
                  <Inp value={f.durata} onChange={e => updFarmaco(i, 'durata', e.target.value)} placeholder="es. Per 5 giorni" />
                </Fld>
              </div>
            ))}
            <button onClick={addFarmaco} style={{ width: '100%', padding: '10px', border: `2px dashed ${C.brd}`, borderRadius: 10, background: 'transparent', color: C.pri, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>+ Aggiungi farmaco</button>
          </Crd>
        )}

        {/* ── CERTIFICATO ── */}
        {tipo === 'certificato' && (
          <Crd style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: C.txm, textTransform: 'uppercase', marginBottom: 10 }}>📋 Dati certificato</div>
            <Fld label="Data visita">
              <Inp type="date" value={dataVisita} onChange={e => setDataVisita(e.target.value)} />
            </Fld>
            <Fld label="Motivo della visita">
              <textarea value={motivoCert} onChange={e => setMotivoCert(e.target.value)} rows={3} placeholder="es. Visita di controllo, dolore dente 36, urgenza..." style={{ width: '100%', padding: '10px 12px', border: `1.5px solid ${C.brd}`, borderRadius: 10, fontSize: 13, color: C.txt, background: C.sur, boxSizing: 'border-box', resize: 'vertical', fontFamily: 'inherit' }} />
            </Fld>
            <Fld label="Note cliniche (opzionale)">
              <textarea value={noteCert} onChange={e => setNoteCert(e.target.value)} rows={3} placeholder="es. Riscontrata carie dente 46, pianificato trattamento..." style={{ width: '100%', padding: '10px 12px', border: `1.5px solid ${C.brd}`, borderRadius: 10, fontSize: 13, color: C.txt, background: C.sur, boxSizing: 'border-box', resize: 'vertical', fontFamily: 'inherit' }} />
            </Fld>
          </Crd>
        )}

        {/* ── LETTERA SPECIALISTA ── */}
        {tipo === 'lettera' && (
          <Crd style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: C.txm, textTransform: 'uppercase', marginBottom: 10 }}>✉️ Dati lettera</div>
            <Fld label="Destinatario (specialista)">
              <Inp value={specialista} onChange={e => setSpecialista(e.target.value)} placeholder="es. Dott. Rossi, Chirurgo Maxillo-Facciale..." />
            </Fld>
            <Fld label="Motivo della consulenza">
              <textarea value={motivoLettera} onChange={e => setMotivoLettera(e.target.value)} rows={2} placeholder="es. Valutazione per implantologia dente 36..." style={{ width: '100%', padding: '10px 12px', border: `1.5px solid ${C.brd}`, borderRadius: 10, fontSize: 13, color: C.txt, background: C.sur, boxSizing: 'border-box', resize: 'vertical', fontFamily: 'inherit' }} />
            </Fld>
            <Fld label="Anamnesi">
              <textarea value={anamnesi} onChange={e => setAnamnesi(e.target.value)} rows={3} placeholder="es. Paziente di 45 anni, diabetico compensato, in terapia con..." style={{ width: '100%', padding: '10px 12px', border: `1.5px solid ${C.brd}`, borderRadius: 10, fontSize: 13, color: C.txt, background: C.sur, boxSizing: 'border-box', resize: 'vertical', fontFamily: 'inherit' }} />
            </Fld>
            <Fld label="Diagnosi / Quadro clinico">
              <textarea value={diagnosi} onChange={e => setDiagnosi(e.target.value)} rows={3} placeholder="es. Edentulismo settore posteriore sx mascella..." style={{ width: '100%', padding: '10px 12px', border: `1.5px solid ${C.brd}`, borderRadius: 10, fontSize: 13, color: C.txt, background: C.sur, boxSizing: 'border-box', resize: 'vertical', fontFamily: 'inherit' }} />
            </Fld>
            <Fld label="Si richiede">
              <textarea value={richiesta} onChange={e => setRichiesta(e.target.value)} rows={2} placeholder="es. Valutazione per intervento chirurgico e piano di trattamento..." style={{ width: '100%', padding: '10px 12px', border: `1.5px solid ${C.brd}`, borderRadius: 10, fontSize: 13, color: C.txt, background: C.sur, boxSizing: 'border-box', resize: 'vertical', fontFamily: 'inherit' }} />
            </Fld>
          </Crd>
        )}

        {/* GENERA */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          <Btn ch="Annulla" v="sec" onClick={onClose} full />
          <Btn ch={generated ? '✓ Scaricato — genera di nuovo' : `⬇️ Genera PDF`} onClick={genera} full />
        </div>

        {generated && (
          <div style={{ background: C.sucL, border: `1px solid ${C.suc}`, borderRadius: 10, padding: '11px 14px', marginBottom: 20, textAlign: 'center' }}>
            <div style={{ fontWeight: 700, color: C.suc }}>✓ PDF generato e scaricato</div>
            <div style={{ fontSize: 11, color: C.txm, marginTop: 3 }}>Controlla la cartella Download</div>
          </div>
        )}
      </div>
    </div>
  );
}
