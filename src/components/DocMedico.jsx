import React, { useState } from 'react';
import { jsPDF } from 'jspdf';
import { Btn, Crd, Fld, Inp, Sel, Modal, Ic } from './ui';
import { C, fmt, fmtD, today } from '../lib/utils';


const TIPI = [
  { id: 'ricetta', label: '💊 Ricetta medica', desc: 'Prescrizione farmaci e posologia' },
  { id: 'certificato', label: '📋 Certificato di visita', desc: 'Certificato attestante la visita effettuata' },
  { id: 'lettera', label: '✉️ Lettera per specialista', desc: 'Referral / lettera di consulenza' },
];

export default function DocMedico({ paz, si, onClose }) {
  // Lo studio "reale" di Luca (Studio Simondi): unico caso in cui mostriamo
  // il timbro professionale completo con firma scansionata personale.
  // Per qualsiasi altro studio (anche un altro dentista) usiamo un footer
  // generico con i SUOI dati, senza la firma di Luca.
  // Il timbro completo con firma scansionata compare per QUALSIASI studio
  // che ne abbia caricata una da Impostazioni — non solo per Studio Simondi.
  const hasFirma = !!si?.firma_b64;
  const isDentistico = !si?.vertical || si.vertical === 'dentistico';
  const STUDIO = {
    nome: si?.nome || 'Studio',
    spec: si?.spec || '',
    iscr: si?.iscr || '',
    addr: si?.addr1 || '',
    tel: si?.tel || '',
    email: si?.email || '',
    piva: si?.piva || '',
  };
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
    const fY = 228;

    if (hasFirma) {
      // ── TIMBRO PROFESSIONALE personale di Luca (con firma scansionata) ──
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
        doc.addImage(si.firma_b64, 'PNG', tX + tW / 2 - 14, tY - 4, 60, 36, undefined, 'FAST');
      } catch(e) {}
    } else {
      // ── Footer generico per qualsiasi altro studio: nessuna firma personale ──
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(100, 100, 100);
      const righe = [STUDIO.nome, STUDIO.addr, [STUDIO.tel, STUDIO.email].filter(Boolean).join(' · ')].filter(Boolean);
      let yy = fY + 8;
      righe.forEach((r) => { doc.text(r, W / 2, yy, { align: 'center' }); yy += 4; });
    }

    // ── FOOTER TESTO ──
    doc.setDrawColor(200, 210, 220);
    doc.setLineWidth(0.3);
    doc.line(M, 283, W - M, 283);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(150, 160, 170);
    doc.text(`${STUDIO.nome} · ${STUDIO.addr} · P.IVA ${STUDIO.piva}`, W / 2, 287, { align: 'center' });
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
    doc.text(new Date(data + 'T12:00').toLocaleDateString('it-IT'), M, y);

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
    doc.text(new Date(data + 'T12:00').toLocaleDateString('it-IT'), M, y);
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
              <textarea value={motivoCert} onChange={e => setMotivoCert(e.target.value)} rows={3} placeholder={isDentistico ? 'es. Visita di controllo, dolore dente 36, urgenza...' : 'es. Visita di controllo, prima visita, urgenza...'} style={{ width: '100%', padding: '10px 12px', border: `1.5px solid ${C.brd}`, borderRadius: 10, fontSize: 13, color: C.txt, background: C.sur, boxSizing: 'border-box', resize: 'vertical', fontFamily: 'inherit' }} />
            </Fld>
            <Fld label="Note cliniche (opzionale)">
              <textarea value={noteCert} onChange={e => setNoteCert(e.target.value)} rows={3} placeholder={isDentistico ? 'es. Riscontrata carie dente 46, pianificato trattamento...' : 'es. Osservazioni cliniche, piano di trattamento...'} style={{ width: '100%', padding: '10px 12px', border: `1.5px solid ${C.brd}`, borderRadius: 10, fontSize: 13, color: C.txt, background: C.sur, boxSizing: 'border-box', resize: 'vertical', fontFamily: 'inherit' }} />
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
              <textarea value={motivoLettera} onChange={e => setMotivoLettera(e.target.value)} rows={2} placeholder={isDentistico ? 'es. Valutazione per implantologia dente 36...' : 'es. Valutazione specialistica per...'} style={{ width: '100%', padding: '10px 12px', border: `1.5px solid ${C.brd}`, borderRadius: 10, fontSize: 13, color: C.txt, background: C.sur, boxSizing: 'border-box', resize: 'vertical', fontFamily: 'inherit' }} />
            </Fld>
            <Fld label="Anamnesi">
              <textarea value={anamnesi} onChange={e => setAnamnesi(e.target.value)} rows={3} placeholder="es. Paziente di 45 anni, diabetico compensato, in terapia con..." style={{ width: '100%', padding: '10px 12px', border: `1.5px solid ${C.brd}`, borderRadius: 10, fontSize: 13, color: C.txt, background: C.sur, boxSizing: 'border-box', resize: 'vertical', fontFamily: 'inherit' }} />
            </Fld>
            <Fld label="Diagnosi / Quadro clinico">
              <textarea value={diagnosi} onChange={e => setDiagnosi(e.target.value)} rows={3} placeholder={isDentistico ? 'es. Edentulismo settore posteriore sx mascella...' : 'es. Quadro clinico attuale...'} style={{ width: '100%', padding: '10px 12px', border: `1.5px solid ${C.brd}`, borderRadius: 10, fontSize: 13, color: C.txt, background: C.sur, boxSizing: 'border-box', resize: 'vertical', fontFamily: 'inherit' }} />
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
