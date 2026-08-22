import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase.js';
import { jsPDF } from 'jspdf';
import { Btn, Crd, Fld, Inp, Sel, Modal, Ic, PannelloInvioDocumento } from './ui';
import { C, fmt, fmtD, today, DEF_DOCUMENTI_SETTINGS } from '../lib/utils';
import { useFormPersistente } from '../lib/useFormPersistente';
import { generaXmlFatturaPA, scaricaXml, speseFatturaPAValida } from '../lib/fatturaPA.js';

const getNumeroProgressivo = (tipo) => {
  const key = tipo === 'fattura' ? 'dm_fattura_num' : 'dm_rimborso_num';
  const anno = new Date().getFullYear();
  const stored = JSON.parse(localStorage.getItem(key) || '{}');
  if (stored.anno !== anno) return { num: 1, anno };
  return { num: (stored.num || 0) + 1, anno };
};

const saveNumeroProgressivo = (tipo, num, anno) => {
  const key = tipo === 'fattura' ? 'dm_fattura_num' : 'dm_rimborso_num';
  localStorage.setItem(key, JSON.stringify({ num, anno }));
};

export default function DocFiscale({ paz, plans, si, onClose }) {
  const isDentistico = !si?.vertical || si.vertical === 'dentistico';
  const STUDIO = {
    nome: si?.nome || 'Studio',
    spec: si?.spec || '',
    iscr: si?.iscr || '',
    addr: si?.addr1 || '',
    tel: si?.tel || '',
    email: si?.email || '',
    piva: si?.piva || '',
    cf: si?.piva || '',
    iban: si?.iban || '',
    regime_fiscale: si?.regime_fiscale || 'sanitario_esente_art10',
    aliquota_iva: si?.aliquota_iva ?? 22,
    via: si?.via || '', cap: si?.cap || '', comune: si?.comune || '', provincia: si?.provincia || '',
    nome_cognome_titolare: si?.nome_cognome_titolare || '',
    progressivo_invio_sdi: si?.progressivo_invio_sdi || 0,
  };
  const isSanitario = STUDIO.regime_fiscale === 'sanitario_esente_art10';
  const dicituraRegime = STUDIO.regime_fiscale === 'ordinario'
    ? `IVA ${STUDIO.aliquota_iva}% inclusa`
    : STUDIO.regime_fiscale === 'forfettario'
      ? "Operazione effettuata ai sensi dell'art. 1, commi 54-89, Legge n. 190/2014 — regime forfettario, non soggetta a IVA"
      : "Operazione esente IVA ai sensi dell'art. 10, n. 18 del DPR 633/72";
  const [tipo, setTipo] = useState('fattura');
  const [step, setStep] = useState(1); // 1=tipo+voci, 2=anteprima
  const [generated, setGenerated] = useState(false);

  const initNum = getNumeroProgressivo('fattura');
  const [numero, setNumero] = useState(String(initNum.num).padStart(3, '0'));
  const [data, setData] = useState(today());
  const [voci, setVoci, clearVociDraft] = useFormPersistente(`doc_fiscale_voci_${paz?.id || 'x'}`, []);
  const [nuovaVoce, setNuovaVoce] = useState({ desc: '', importo: '' });
  const [selectedPiani, setSelectedPiani] = useState([]);
  const [iban, setIban] = useState(STUDIO.iban);
  const [tabView, setTabView] = useState('nuovo'); // 'nuovo' | 'archivio'
  const [archivio, setArchivio] = useState([]);
  const [archivioLoading, setArchivioLoading] = useState(false);
  const [selDoc, setSelDoc] = useState([]);

  const docSet = { ...DEF_DOCUMENTI_SETTINGS, ...(si?.documenti_settings || {}) };
  const [pronto, setPronto] = useState(null); // { dataUrl, filename, titolo, tipoDoc }
  const [studioId, setStudioId] = useState(null);
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setStudioId(session?.user?.app_metadata?.studio_id || null);
    });
  }, []);

  const loadArchivio = async () => {
    setArchivioLoading(true);
    const { data } = await supabase.from('documenti_fiscali')
      .select('id, tipo, numero, data, paziente_nome, importo, created_at')
      .eq('paziente_id', paz.id)
      .order('created_at', { ascending: false });
    if (data) setArchivio(data);
    setArchivioLoading(false);
  };

  useEffect(() => { if (tabView === 'archivio') loadArchivio(); }, [tabView]);

  const patPlans = plans.filter(pl => pl.pazienteId === paz.id);
  const totale = voci.reduce((s, v) => s + Number(v.importo), 0);

  const importaDaPiano = (pl) => {
    if (selectedPiani.includes(pl.id)) {
      setSelectedPiani(prev => prev.filter(id => id !== pl.id));
      setVoci(prev => prev.filter(v => v._pianoId !== pl.id));
    } else {
      setSelectedPiani(prev => [...prev, pl.id]);
      const sub = pl.voci.reduce((s, v) => s + Number(v.prezzo), 0);
      const sc = Number(pl.sconto) || 0;
      const scontato = pl.scontoTipo === 'pct' ? sub * (sc / 100) : Math.min(sc, sub);
      const finale = Math.max(0, sub - scontato);
      setVoci(prev => [...prev, ...pl.voci.map((v, i) => ({
        id: `${pl.id}_${i}`,
        _pianoId: pl.id,
        desc: v.prestazione + ((isDentistico && v.dente) ? ` (d.${v.dente})` : ''),
        importo: String(v.prezzo),
      }))]);
    }
  };

  const addVoce = () => {
    if (!nuovaVoce.desc || !nuovaVoce.importo) return;
    setVoci(prev => [...prev, { id: Date.now(), desc: nuovaVoce.desc, importo: nuovaVoce.importo }]);
    setNuovaVoce({ desc: '', importo: '' });
  };

  const removeVoce = (id) => setVoci(prev => prev.filter(v => v.id !== id));
  const updateVoce = (id, field, val) => setVoci(prev => prev.map(v => v.id === id ? { ...v, [field]: val } : v));

  const generaPdf = () => {
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const W = 210, M = 18;
    const CW = W - M * 2;
    let y = 20;

    const txt = (t, x, yy, opts = {}) => doc.text(String(t ?? ''), x, yy, opts);
    const hLine = (yy, c = [203, 213, 224]) => { doc.setDrawColor(...c); doc.setLineWidth(0.3); doc.line(M, yy, W - M, yy); };
    const box = (x, yy, w, h, r, g, b) => { doc.setFillColor(r, g, b); doc.rect(x, yy, w, h, 'F'); };

    // ── INTESTAZIONE STUDIO ──
    doc.setFont('helvetica', 'bolditalic'); doc.setFontSize(20); doc.setTextColor(26, 78, 102);
    txt(STUDIO.nome, W / 2, y, { align: 'center' }); y += 7;
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(74, 144, 196);
    txt(STUDIO.spec, W / 2, y, { align: 'center' }); y += 5;
    txt(STUDIO.iscr, W / 2, y, { align: 'center' }); y += 5;
    doc.setTextColor(74, 85, 104);
    txt(`${STUDIO.addr}   |   Tel: ${STUDIO.tel}   |   ${STUDIO.email}`, W / 2, y, { align: 'center' }); y += 4;
    txt(`P.IVA: ${STUDIO.piva}   |   C.F.: ${STUDIO.cf}`, W / 2, y, { align: 'center' }); y += 4;
    hLine(y); y += 6;

    // ── TITOLO DOCUMENTO ──
    const titoloDoc = tipo === 'fattura' ? 'FATTURA' : 'RIMBORSO SPESE';
    const tw = doc.getTextWidth(titoloDoc) + 14;
    box(W / 2 - tw / 2, y - 5, tw, 9, 26, 107, 138);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(13); doc.setTextColor(255, 255, 255);
    txt(titoloDoc, W / 2, y + 1, { align: 'center' }); y += 10;

    // ── BOX DOCUMENTO + PAZIENTE ──
    box(M, y, CW, 22, 247, 250, 252);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.setTextColor(113, 128, 150);
    txt('N° DOCUMENTO', M + 3, y + 4);
    txt('DATA', M + 50, y + 4);
    txt(tipo === 'fattura' ? 'PAZIENTE / CLIENTE' : 'PAZIENTE', M + 90, y + 4);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(11); doc.setTextColor(26, 32, 44);
    txt(numero, M + 3, y + 12);
    txt(new Date(data + 'T12:00').toLocaleDateString('it-IT'), M + 50, y + 12);
    txt(`${paz.nome} ${paz.cognome}`, M + 90, y + 12);
    if (paz.cf) {
      doc.setFontSize(8); doc.setTextColor(113, 128, 150);
      txt(`C.F.: ${paz.cf}`, M + 90, y + 18);
    }
    y += 27;

    // ── TABELLA VOCI ──
    const cols = [10, 108, 32]; // #, descrizione, importo
    box(M, y, CW, 8, 26, 107, 138);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.setTextColor(255, 255, 255);
    let cx = M + 2;
    ['#', 'Descrizione prestazione', 'Importo'].forEach((h, i) => { txt(h, cx, y + 5.5); cx += cols[i]; });
    y += 8;

    doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(26, 32, 44);
    voci.forEach((v, i) => {
      if (y > 240) { doc.addPage(); y = 20; }
      const rh = 8;
      if (i % 2 === 0) box(M, y, CW, rh, 247, 250, 252);
      cx = M + 2;
      txt(String(i + 1), cx, y + 5.5); cx += cols[0];
      const descLines = doc.splitTextToSize(v.desc, cols[1] - 4);
      txt(descLines[0], cx, y + 5.5); cx += cols[1];
      txt(`€ ${Number(v.importo).toFixed(2)}`, cx, y + 5.5);
      y += rh;
    });

    // ── TOTALE ──
    y += 3;
    const ivaImporto = STUDIO.regime_fiscale === 'ordinario' ? Math.round(totale * STUDIO.aliquota_iva) / 100 : 0;
    const totaleConIva = totale + ivaImporto;
    if (tipo === 'fattura') {
      box(M, y, CW, 7, 240, 248, 255);
      doc.setFontSize(8); doc.setTextColor(74, 85, 104);
      txt(dicituraRegime, M + 3, y + 4.5);
      y += 9;
      if (STUDIO.regime_fiscale === 'ordinario') {
        txt(`Imponibile € ${totale.toFixed(2)}   +   IVA ${STUDIO.aliquota_iva}% € ${ivaImporto.toFixed(2)}`, M + 3, y + 1);
        y += 6;
      }
    }
    box(M, y, CW, 10, 26, 107, 138);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(13); doc.setTextColor(255, 255, 255);
    txt('TOTALE', M + 3, y + 7);
    txt(`€ ${(tipo === 'fattura' ? totaleConIva : totale).toFixed(2)}`, W - M - 3, y + 7, { align: 'right' });
    y += 14;

    // ── NOTE LEGALI + IBAN ──
    if (tipo === 'rimborso') {
      doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.setTextColor(113, 128, 150);
      const noteText = 'Il presente documento attesta il rimborso delle spese sanitarie sostenute. Conservare ai fini della dichiarazione dei redditi.';
      const noteLines = doc.splitTextToSize(noteText, CW);
      noteLines.forEach((line, i) => { txt(line, M, y + i * 4); });
      y += noteLines.length * 4 + 6;

    }

    // ── IBAN (solo rimborso) ──
    if (tipo === 'rimborso' && iban) {
      y += 4;
      box(M, y, CW, 14, 232, 247, 238);
      doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.setTextColor(45, 158, 97);
      txt('COORDINATE BANCARIE PER IL RIMBORSO', M + 3, y + 5);
      doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.setTextColor(26, 32, 44);
      txt(`IBAN: ${iban}`, M + 3, y + 11);
      doc.setFontSize(7.5); doc.setTextColor(113, 128, 150);
      txt(`Intestato a: ${STUDIO.nome}`, W - M - 3, y + 11, { align: 'right' });
      y += 18;
    }

    // ── FOOTER ──
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7); doc.setTextColor(150, 150, 150);
    hLine(285);
    txt(`${STUDIO.nome}   |   ${STUDIO.addr}   |   Tel: ${STUDIO.tel}   |   P.IVA: ${STUDIO.piva}`, W / 2, 289, { align: 'center' });

    // salva numero progressivo
    saveNumeroProgressivo(tipo, parseInt(numero), new Date(data + 'T12:00').getFullYear());

    const nomeFile = `${tipo}_${String(numero).padStart(3,'0')}_${paz.cognome.replace(/\s+/g,'_')}_${data}.pdf`.toLowerCase();
    const pdfBase64 = doc.output('datauristring');

    // Salva in Supabase solo se l'impostazione per questo tipo di documento
    // (fattura/rimborso) è attiva dal Setup — l'utente può decidere di non
    // tenerne archivio pur continuando a generarlo e inviarlo.
    if (docSet[tipo] && studioId) {
      const docRecord = {
        id: Date.now(),
        studio_id: studioId,
        tipo,
        numero: String(numero).padStart(3, '0'),
        data,
        paziente_nome: `${paz.nome} ${paz.cognome}`,
        paziente_id: paz.id,
        importo: totale,
        pdf_base64: pdfBase64,
      };
      supabase.from('documenti_fiscali').insert([docRecord]).then(() => {
        if (tabView === 'archivio') loadArchivio();
      });
    }

    clearVociDraft();
    setPronto({ dataUrl: pdfBase64, filename: nomeFile, titolo: tipo === 'fattura' ? 'Fattura' : 'Rimborso spese', tipoDoc: tipo });
    setGenerated(true);
  };

  const xmlErrori = !isSanitario ? speseFatturaPAValida(STUDIO, paz) : [];

  const generaXml = async () => {
    if (xmlErrori.length > 0) return;
    const { xml, nomeFile } = generaXmlFatturaPA(STUDIO, paz, {
      numero, data,
      righe: voci.map((v) => ({ descrizione: v.desc, importo: v.importo })),
    });
    scaricaXml(xml, nomeFile);
    if (studioId) {
      await supabase.from('studio_info').update({ progressivo_invio_sdi: STUDIO.progressivo_invio_sdi + 1 }).eq('studio_id', studioId);
    }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: C.bg, zIndex: 500, display: 'flex', flexDirection: 'column' }}>
      {/* HEADER */}
      <div style={{ background: C.priD, padding: '12px 14px', paddingTop: 'max(12px,env(safe-area-inset-top))', display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
        <button onClick={onClose} aria-label="Indietro" style={{ width: 44, height: 44, background: 'rgba(255,255,255,0.12)', border: 'none', borderRadius: 10, padding: 0, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Ic n="back" s={20} c="#fff" />
        </button>
        <span style={{ color: '#fff', fontWeight: 800, fontSize: 15, flex: 1 }}>Documento fiscale</span>
        <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12 }}>{paz.nome} {paz.cognome}</span>
      </div>

      {/* TAB SWITCHER */}
      <div style={{ display: 'flex', background: C.bg, borderBottom: `1px solid ${C.brd}`, flexShrink: 0 }}>
        {[['nuovo', null, '+ Nuovo documento'], ['archivio', 'folder', 'Archivio']].map(([id, ic, lbl]) => (
          <button key={id} onClick={() => setTabView(id)} style={{ flex: 1, padding: '11px 0', border: 'none', background: 'transparent', borderBottom: tabView === id ? `2px solid ${C.pri}` : '2px solid transparent', color: tabView === id ? C.pri : C.txm, fontWeight: 700, fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}>{ic && <Ic n={ic} s={12} c={tabView === id ? C.pri : C.txm} />}{lbl}</button>
        ))}
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: 14 }}>

        {/* ── ARCHIVIO ── */}
        {tabView === 'archivio' && (
          <div>
            {archivioLoading && <div style={{ textAlign: 'center', color: C.txl, padding: 30 }}>Caricamento...</div>}
            {!archivioLoading && archivio.length === 0 && (
              <div style={{ textAlign: 'center', color: C.txl, padding: 40 }}>
                <div style={{ marginBottom: 10, display: 'flex', justifyContent: 'center' }}><Ic n="file" s={32} c={C.txl} /></div>
                <div style={{ fontWeight: 700 }}>Nessun documento salvato</div>
                <div style={{ fontSize: 12, marginTop: 4 }}>I documenti generati vengono salvati automaticamente</div>
              </div>
            )}
            {!archivioLoading && archivio.length > 0 && (
              <>
                {selDoc.length > 0 && (
                  <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                    <button onClick={async () => {
                      for (const id of selDoc) {
                        const doc = archivio.find(d => d.id === id);
                        if (!doc) continue;
                        const { data: full } = await supabase.from('documenti_fiscali').select('pdf_base64').eq('id', id).single();
                        if (full?.pdf_base64) {
                          const a = document.createElement('a');
                          a.href = full.pdf_base64;
                          a.download = `${doc.tipo}_${doc.numero}_${doc.paziente_nome.replace(/\s+/g,'_')}_${doc.data}.pdf`.toLowerCase();
                          a.style.display = 'none';
                          document.body.appendChild(a); a.click(); document.body.removeChild(a);
                          await new Promise(r => setTimeout(r, 300));
                        }
                      }
                    }} style={{ flex: 1, background: C.pri, border: 'none', borderRadius: 9, padding: '10px', color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                      <Ic n="download" s={13} c="#fff" />Scarica selezionati ({selDoc.length})
                    </button>
                    <button onClick={async () => {
                      if (!confirm(`Eliminare ${selDoc.length} documento/i?`)) return;
                      for (const id of selDoc) await supabase.from('documenti_fiscali').delete().eq('id', id);
                      setSelDoc([]);
                      loadArchivio();
                    }} style={{ background: C.danL, border: 'none', borderRadius: 9, padding: '10px 14px', color: C.dan, fontWeight: 700, fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                      <Ic n="del" s={14} c={C.dan} />
                    </button>
                  </div>
                )}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <button onClick={() => setSelDoc(selDoc.length === archivio.length ? [] : archivio.map(d => d.id))} style={{ background: C.bg, border: `1px solid ${C.brd}`, borderRadius: 7, padding: '5px 10px', fontSize: 11, fontWeight: 700, color: C.txm, cursor: 'pointer' }}>
                    {selDoc.length === archivio.length ? 'Deseleziona tutti' : 'Seleziona tutti'}
                  </button>
                  <span style={{ fontSize: 11, color: C.txl }}>{archivio.length} documenti</span>
                </div>
                {archivio.map(doc => {
                  const isSel = selDoc.includes(doc.id);
                  return (
                    <Crd key={doc.id} style={{ marginBottom: 8, border: isSel ? `2px solid ${C.pri}` : undefined, background: isSel ? C.priL : '#fff' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <button onClick={() => setSelDoc(prev => isSel ? prev.filter(x => x !== doc.id) : [...prev, doc.id])}
                          style={{ width: 22, height: 22, borderRadius: 6, border: `2px solid ${isSel ? C.pri : C.brd}`, background: isSel ? C.pri : '#fff', cursor: 'pointer', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}>
                          {isSel && <Ic n="ok" s={11} c="#fff" />}
                        </button>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 700, fontSize: 13, display: 'flex', alignItems: 'center', gap: 5 }}>
                            <Ic n={doc.tipo === 'fattura' ? 'receipt' : 'bank'} s={12} c={C.txt} />{doc.tipo === 'fattura' ? 'Fattura' : 'Rimborso'} n° {doc.numero}
                          </div>
                          <div style={{ fontSize: 11, color: C.txm }}>{fmtD(doc.data)} · {doc.paziente_nome}</div>
                        </div>
                        <div style={{ textAlign: 'right', flexShrink: 0 }}>
                          <div style={{ fontWeight: 800, color: C.pri, fontSize: 14 }}>{fmt(doc.importo)}</div>
                          <div style={{ display: 'flex', gap: 5, marginTop: 4 }}>
                            <button onClick={async () => {
                              const { data: full } = await supabase.from('documenti_fiscali').select('pdf_base64').eq('id', doc.id).single();
                              if (full?.pdf_base64) {
                                const a = document.createElement('a');
                                a.href = full.pdf_base64;
                                a.download = `${doc.tipo}_${doc.numero}_${doc.paziente_nome.replace(/\s+/g,'_')}_${doc.data}.pdf`.toLowerCase();
                                a.style.display = 'none';
                                document.body.appendChild(a); a.click(); document.body.removeChild(a);
                              }
                            }} style={{ background: C.priL, border: 'none', borderRadius: 6, padding: '4px 8px', cursor: 'pointer', fontSize: 11, fontWeight: 700, color: C.pri, display: 'flex' }}><Ic n="download" s={12} c={C.pri} /></button>
                            <button onClick={async () => {
                              if (!confirm('Eliminare?')) return;
                              await supabase.from('documenti_fiscali').delete().eq('id', doc.id);
                              loadArchivio();
                            }} style={{ background: C.danL, border: 'none', borderRadius: 6, padding: '4px 7px', cursor: 'pointer' }}><Ic n="del" s={12} c={C.dan} /></button>
                          </div>
                        </div>
                      </div>
                    </Crd>
                  );
                })}
              </>
            )}
          </div>
        )}

        {/* ── NUOVO DOCUMENTO ── */}
        {tabView === 'nuovo' && <>

        {/* TIPO DOCUMENTO */}
        <Crd style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: C.txm, textTransform: 'uppercase', marginBottom: 10 }}>Tipo documento</div>
          <div style={{ display: 'flex', gap: 8 }}>
            {[['fattura', 'receipt', 'Fattura', 'Documento fiscale con numero progressivo'], ['rimborso', 'bank', 'Rimborso spese', 'Nota spese per rimborso assicurativo']].map(([val, ic, lbl, sub]) => (
              <button key={val} onClick={() => { setTipo(val); setGenerated(false); const n = getNumeroProgressivo(val); setNumero(String(n.num).padStart(3,'0')); }} style={{ flex: 1, padding: 12, borderRadius: 10, border: `2px solid ${tipo === val ? C.pri : C.brd}`, background: tipo === val ? C.priL : C.sur, cursor: 'pointer', textAlign: 'left' }}>
                <div style={{ fontWeight: 800, fontSize: 14, color: tipo === val ? C.pri : C.txt, display: 'flex', alignItems: 'center', gap: 6 }}><Ic n={ic} s={13} c={tipo === val ? C.pri : C.txt} />{lbl}</div>
                <div style={{ fontSize: 10, color: C.txm, marginTop: 3 }}>{sub}</div>
              </button>
            ))}
          </div>
        </Crd>

        {/* DATI DOCUMENTO */}
        <Crd style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: C.txm, textTransform: 'uppercase', marginBottom: 10 }}>Dati documento</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <Fld label={`N° ${tipo === 'fattura' ? 'fattura' : 'documento'}`}>
              <Inp value={numero} onChange={e => setNumero(e.target.value)} placeholder="001" />
            </Fld>
            <Fld label="Data">
              <Inp type="date" value={data} onChange={e => setData(e.target.value)} />
            </Fld>
          </div>
          <div style={{ background: C.bg, borderRadius: 9, padding: 10, marginTop: 4 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: C.txm, marginBottom: 5 }}>PAZIENTE / DESTINATARIO</div>
            <div style={{ fontSize: 13, fontWeight: 700 }}>{paz.nome} {paz.cognome}</div>
            {paz.cf && <div style={{ fontSize: 11, color: C.txm, fontFamily: 'monospace' }}>C.F.: {paz.cf}</div>}
            {paz.indirizzo && <div style={{ fontSize: 11, color: C.txm }}>{paz.indirizzo}</div>}
          </div>
        </Crd>

        {/* IMPORTA DA PIANO */}
        {patPlans.length > 0 && (
          <Crd style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: C.txm, textTransform: 'uppercase', marginBottom: 10 }}>Importa da piano di cura</div>
            {patPlans.map(pl => {
              const sub = pl.voci.reduce((s, v) => s + Number(v.prezzo), 0);
              const sc = Number(pl.sconto) || 0;
              const scontato = pl.scontoTipo === 'pct' ? sub * (sc / 100) : Math.min(sc, sub);
              const tot = Math.max(0, sub - scontato);
              const sel = selectedPiani.includes(pl.id);
              return (
                <div key={pl.id} onClick={() => importaDaPiano(pl)} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', borderBottom: `1px solid ${C.brd}`, cursor: 'pointer' }}>
                  <div style={{ width: 22, height: 22, borderRadius: 6, border: `2px solid ${sel ? C.pri : C.brd}`, background: sel ? C.pri : '#fff', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {sel && <Ic n="ok" s={12} c="#fff" />}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: 13 }}>{pl.titolo}</div>
                    <div style={{ fontSize: 11, color: C.txm }}>{pl.voci.length} voci · {fmtD(pl.data)}</div>
                  </div>
                  <span style={{ fontWeight: 800, color: C.pri }}>{fmt(tot)}</span>
                </div>
              );
            })}
          </Crd>
        )}

        {/* VOCI MANUALI */}
        <Crd style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: C.txm, textTransform: 'uppercase', marginBottom: 10 }}>Voci documento</div>

          {/* aggiungi voce */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
            <Inp value={nuovaVoce.desc} onChange={e => setNuovaVoce(f => ({ ...f, desc: e.target.value }))} placeholder="Descrizione prestazione" style={{ flex: 2 }} />
            <Inp type="number" value={nuovaVoce.importo} onChange={e => setNuovaVoce(f => ({ ...f, importo: e.target.value }))} placeholder="€" style={{ flex: 1 }} />
            <button onClick={addVoce} style={{ background: C.pri, border: 'none', borderRadius: 9, padding: '0 13px', color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer', flexShrink: 0 }}>+</button>
          </div>

          {voci.length === 0 && <div style={{ textAlign: 'center', color: C.txl, padding: '12px 0', fontSize: 12 }}>Nessuna voce — importa da un piano o aggiungi manualmente</div>}

          {voci.map((v, i) => (
            <div key={v.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 0', borderBottom: `1px solid ${C.brd}` }}>
              <span style={{ fontSize: 11, color: C.txl, fontWeight: 700, flexShrink: 0, width: 18 }}>{i + 1}.</span>
              <input value={v.desc} onChange={e => updateVoce(v.id, 'desc', e.target.value)} style={{ flex: 1, border: 'none', background: 'transparent', fontSize: 12, color: C.txt, fontFamily: 'inherit' }} />
              <input type="number" value={v.importo} onChange={e => updateVoce(v.id, 'importo', e.target.value)} style={{ width: 70, border: `1px solid ${C.brd}`, borderRadius: 6, padding: '3px 6px', fontSize: 12, color: C.pri, fontWeight: 700, textAlign: 'right', fontFamily: 'inherit' }} />
              <button onClick={() => removeVoce(v.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 3, flexShrink: 0 }}><Ic n="x" s={13} c={C.dan} /></button>
            </div>
          ))}

          {voci.length > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 10, padding: '10px 0', borderTop: `2px solid ${C.pri}` }}>
              <span style={{ fontWeight: 800, fontSize: 14, color: C.txt }}>TOTALE</span>
              <span style={{ fontWeight: 900, fontSize: 18, color: C.pri }}>€ {totale.toFixed(2)}</span>
            </div>
          )}
          {tipo === 'fattura' && voci.length > 0 && (
            <div style={{ background: C.priL, borderRadius: 8, padding: '7px 10px', marginTop: 6 }}>
              <div style={{ fontSize: 11, color: C.pri, fontWeight: 600 }}>{dicituraRegime}</div>
              {STUDIO.regime_fiscale === 'ordinario' && (
                <div style={{ fontSize: 11, color: C.pri, marginTop: 2 }}>Totale con IVA: € {(totale + Math.round(totale * STUDIO.aliquota_iva) / 100).toFixed(2)}</div>
              )}
            </div>
          )}
        </Crd>

        {/* GENERA */}
        {/* IBAN (solo rimborso) */}
        {tipo === 'rimborso' && voci.length > 0 && (
          <Crd style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: C.txm, textTransform: 'uppercase', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}><Ic n="bank" s={11} c={C.txm} />IBAN per il rimborso</div>
            <Inp value={iban} onChange={e => setIban(e.target.value)} placeholder="es. IT60X0542811101000000123456" style={{ fontFamily: 'monospace', fontSize: 13 }} />
            <div style={{ fontSize: 10, color: C.txl, marginTop: 5 }}>Appare nel documento — modificabile per ogni rimborso</div>
          </Crd>
        )}

        {voci.length > 0 && !pronto && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
            <div style={{ display: 'flex', gap: 8 }}>
              <Btn ch="Annulla" v="sec" onClick={onClose} full />
              <Btn ch={`Genera ${tipo === 'fattura' ? 'Fattura' : 'Rimborso'} PDF`} ic="download" onClick={generaPdf} full />
            </div>
            {tipo === 'fattura' && !isSanitario && (
              <>
                {xmlErrori.length > 0 && (
                  <div style={{ background: C.danL, color: C.dan, borderRadius: 9, padding: '8px 12px', fontSize: 11 }}>
                    Per generare l'XML FatturaPA mancano: {xmlErrori.join(', ')}. Completa i dati in Impostazioni Studio e sulla scheda paziente.
                  </div>
                )}
                <Btn ch="Genera anche XML FatturaPA (upload manuale su AdE)" ic="upload" v="sec" onClick={generaXml} dis={xmlErrori.length > 0} full />
              </>
            )}
          </div>
        )}

        {pronto && (
          <PannelloInvioDocumento
            pronto={pronto}
            paziente={paz}
            archiviato={docSet[pronto.tipoDoc]}
            onChiudi={onClose}
            onNuovoDocumento={() => { setPronto(null); setGenerated(false); }}
          />
        )}
        </>
        }
      </div>
    </div>
  );
}
