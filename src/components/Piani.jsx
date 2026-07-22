import React, { useState, useEffect } from 'react';
import { Btn, Crd, Fld, Inp, Sel, Txt, Modal, Toast, Bdg, Ic, SearchSel } from './ui';
import { C, uid, fmt, today, SCADENZA_PRESET, addMesi } from '../lib/utils';
import Odontogramma from './Odontogramma.jsx';
import PdfView from './PdfView.jsx';

export default function Piani({ patients, plans, setPlans, pricelist, templates, si, initPatId, onClearInitPat, onOpenPaz }) {
  const isDentistico = !si?.vertical || si.vertical === 'dentistico';
  const [modal, setModal] = useState(false);
  const [pazSearch, setPazSearch] = useState('');
  const ortoVuoto = { attivo: false, mascherineTotali: '', frequenzaSettimane: 2, dataConsegnaInizio: '', mascherineConsegnate: 0, storico: [] };
  const [form, setForm] = useState({ pazienteId: '', titolo: '', data: today(), voci: [], stato: 'attivo', sconto: 0, scontoTipo: 'pct', scadenzaPagamento: '', ortodonzia: null });
  const [nv, setNv] = useState({ prestazione: '', dente: '', prezzo: '' });
  const [selectedDenti, setSelectedDenti] = useState([]);
  const [waModal, setWaModal] = useState(null);
  const [waMsg, setWaMsg] = useState('');
  const [pdfPlan, setPdfPlan] = useState(null);
  const [toast, setToast] = useState('');
  const [selPiani, setSelPiani] = useState([]);
  const [filtro, setFiltro] = useState(null); // null=tutti | 'attivo'|'accettato'|'rifiutato'|'concluso'|'inCorso'
  const [filtroModal, setFiltroModal] = useState(null);

  useEffect(() => {
    if (initPatId) {
      setForm({ pazienteId: String(initPatId), titolo: '', data: today(), voci: [], stato: 'attivo', sconto: 0, scontoTipo: 'pct', scadenzaPagamento: '', ortodonzia: null });
      setNv({ prestazione: '', dente: '', prezzo: '' });
      setSelectedDenti([]);
      setModal(true);
      onClearInitPat && onClearInitPat();
    }
  }, [initPatId]);

  const kpi = {
    totali: plans.length,
    attivi: plans.filter((p) => (p.stato || 'attivo') === 'attivo').length,
    accettati: plans.filter((p) => p.stato === 'accettato').length,
    rifiutati: plans.filter((p) => p.stato === 'rifiutato').length,
    conclusi: plans.filter((p) => p.stato === 'concluso').length,
    inCorso: plans.filter((p) => { const d = p.voci.filter((v) => v.eseguita).length; return d > 0 && d < p.voci.length; }).length,
  };

  const pianiFiltrati = (stato) => {
    if (stato === 'inCorso') return plans.filter(p => { const d = p.voci.filter(v => v.eseguita).length; return d > 0 && d < p.voci.length; });
    if (stato === 'totali') return plans;
    return plans.filter(p => (p.stato || 'attivo') === stato);
  };

  const calcTot = (voci, sconto, scontoTipo) => {
    const sub = voci.reduce((s, v) => s + Number(v.prezzo), 0);
    const sc = Number(sconto) || 0;
    const scontato = scontoTipo === 'pct' ? sub * (sc / 100) : Math.min(sc, sub);
    return { sub, scontato, finale: Math.max(0, sub - scontato) };
  };

  const addVoce = () => {
    if (!nv.prestazione) return;
    const prezzoUnit = Number(nv.prezzo) || 0;
    const denti = selectedDenti.length > 0 ? selectedDenti.slice().sort((a, b) => a - b) : [];
    if (denti.length > 1) {
      const nuove = denti.map((d) => ({ prestazione: nv.prestazione, dente: String(d), prezzo: prezzoUnit, eseguita: false, incassata: false }));
      setForm((f) => ({ ...f, voci: [...f.voci, ...nuove] }));
    } else {
      const denteStr = denti.length === 1 ? String(denti[0]) : (nv.dente || '');
      setForm((f) => ({ ...f, voci: [...f.voci, { prestazione: nv.prestazione, dente: denteStr, prezzo: prezzoUnit, eseguita: false, incassata: false }] }));
    }
    setNv({ prestazione: '', dente: '', prezzo: '' });
    setSelectedDenti([]);
  };

  const save = () => {
    if (!form.pazienteId || !form.titolo || !form.voci.length) return;
    setPlans((p) => [...p, { ...form, id: uid(), pazienteId: Number(form.pazienteId) }]);
    setModal(false);
    setToast('Piano salvato ✓');
  };

  const toggleEseguita = (plId, i) => setPlans((p) => p.map((pl) => {
    if (pl.id !== plId) return pl;
    const nuoveVoci = pl.voci.map((v, j) => (j === i ? { ...v, eseguita: !v.eseguita, dataEsec: !v.eseguita ? today() : null, incassata: !v.eseguita ? v.incassata : false } : v));
    const tutteEseguite = nuoveVoci.every((v) => v.eseguita);
    return { ...pl, voci: nuoveVoci, stato: tutteEseguite ? 'concluso' : (pl.stato === 'concluso' ? 'attivo' : pl.stato) };
  }));
  const toggleIncassata = (plId, i) => setPlans((p) => p.map((pl) => (pl.id === plId ? { ...pl, voci: pl.voci.map((v, j) => (j === i ? { ...v, incassata: !v.incassata } : v)) } : pl)));
  const setStato = (plId, stato) => setPlans((p) => p.map((pl) => (pl.id === plId ? { ...pl, stato } : pl)));
  const del = (id) => { if (confirm('Eliminare piano?')) setPlans((p) => p.filter((pl) => pl.id !== id)); };
  const selPr = (nome) => { const item = pricelist.find((p) => p.nome === nome); setNv((v) => ({ ...v, prestazione: nome, prezzo: item ? item.prezzo : v.prezzo })); };

  const openWA = (pl, mode) => {
    const p = patients.find((x) => x.id === pl.pazienteId);
    const { scontato, finale } = calcTot(pl.voci, pl.sconto || 0, pl.scontoTipo || 'pct');
    const vociTxt = pl.voci.map((v, i) => `${i + 1}. ${v.prestazione}${v.dente ? ` (d.${v.dente})` : ''} — ${fmt(v.prezzo)}`).join('\n');
    const scontoTxt = scontato > 0 ? `\n🏷️ Sconto: −${fmt(scontato)}` : '';
    const nomeStudio = si?.nome || 'Studio';
    const msg = mode === 'piano'
      ? `Gentile ${p?.nome || ''} ${p?.cognome || ''},\npiano di cura *${pl.titolo}*:\n\n${vociTxt}${scontoTxt}\n\n💰 *Totale: ${fmt(finale)}*\n\nGrazie, ${nomeStudio}.`
      : `Gentile ${p?.nome || ''} ${p?.cognome || ''},\nil suo preventivo *${pl.titolo}* è pronto.${scontoTxt}\n\n💰 *Totale: ${fmt(finale)}*\n\nContattarci per confermare.\nGrazie, ${nomeStudio}.`;
    setWaMsg(msg);
    setWaModal({ pl, paz: p });
  };
  const sendWA = () => {
    if (!waModal?.paz?.telefono || !waMsg) return;
    window.open(`https://wa.me/39${waModal.paz.telefono.replace(/\D/g, '')}?text=${encodeURIComponent(waMsg)}`, '_blank');
    setWaModal(null);
  };
  const fillTpl = (tplId, pl, paz) => {
    const t = templates.find((x) => x.id === Number(tplId));
    if (!t) return;
    const { finale } = calcTot(pl.voci, pl.sconto || 0, pl.scontoTipo || 'pct');
    const voci = pl.voci.map((v, i) => `${i + 1}. ${v.prestazione}${v.dente ? ` (d.${v.dente})` : ''} — ${fmt(v.prezzo)}`).join('\n');
    setWaMsg(t.testo.replace(/{nome}/g, `${paz?.nome || ''} ${paz?.cognome || ''}`).replace(/{totale}/g, fmt(finale)).replace(/{voci}/g, voci).replace(/{data}/g, '').replace(/{ora}/g, '').replace(/{tipo}/g, ''));
  };

  const toggleSel = (id) => setSelPiani((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  const generaPdfMulti = (paz) => {
    const pianiSel = plans.filter((pl) => selPiani.includes(pl.id));
    if (!pianiSel.length) return;
    const vociTot = pianiSel.flatMap((pl) => pl.voci);
    const totSconti = pianiSel.reduce((s, pl) => {
      const sub = pl.voci.reduce((a, v) => a + Number(v.prezzo), 0);
      const sc = Number(pl.sconto) || 0;
      return s + (pl.scontoTipo === 'pct' ? sub * (sc / 100) : Math.min(sc, sub));
    }, 0);
    const virtuale = {
      id: 'multi', titolo: pianiSel.length === 1 ? pianiSel[0].titolo : `Preventivo combinato (${pianiSel.length} piani)`,
      data: today(), voci: vociTot, sconto: totSconti, scontoTipo: 'eur', stato: 'attivo', pazienteId: paz?.id,
    };
    setPdfPlan(virtuale);
  };

  if (pdfPlan) {
    const p = patients.find((x) => x.id === pdfPlan.pazienteId);
    return <PdfView pl={pdfPlan} paz={p} si={si} onClose={() => setPdfPlan(null)} />;
  }

  return (
    <div>
      {toast && <Toast msg={toast} onDone={() => setToast('')} />}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <div style={{ fontSize: 20, fontWeight: 800 }}>Piani di cura</div>
        <Btn ch="Nuovo" ic="plus" onClick={() => { setForm({ pazienteId: '', titolo: '', data: today(), voci: [], stato: 'attivo', sconto: 0, scontoTipo: 'pct', scadenzaPagamento: '', ortodonzia: null }); setNv({ prestazione: '', dente: '', prezzo: '' }); setSelectedDenti([]); setModal(true); }} />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 14 }}>
        {[['Totali', kpi.totali, C.pri, 'totali'], ['Attivi', kpi.attivi, C.war, 'attivo'], ['Accettati', kpi.accettati, C.acc, 'accettato'], ['Rifiutati', kpi.rifiutati, C.dan, 'rifiutato'], ['Conclusi', kpi.conclusi, C.suc, 'concluso'], ['In corso', kpi.inCorso, C.pur, 'inCorso']].map(([l, v, co, key]) => (
          <Crd key={l} onClick={() => { setFiltroModal(key); }} style={{ padding: 11, display: 'flex', alignItems: 'center', gap: 9, cursor: 'pointer', border: filtro === key ? `2px solid ${co}` : undefined, background: filtro === key ? co + '10' : '#fff', position: 'relative' }}>
            <div style={{ background: co + '20', borderRadius: 8, padding: 7, flexShrink: 0 }}><Ic n="plan" s={16} c={co} /></div>
            <div>
              <div style={{ fontSize: 18, fontWeight: 800, color: filtro === key ? co : C.txt }}>{v}</div>
              <div style={{ fontSize: 10, color: filtro === key ? co : C.txm, fontWeight: 600 }}>{l}</div>
            </div>
            <div style={{ position: 'absolute', top: 4, right: 6, fontSize: 10, color: co, opacity: 0.5 }}>›</div>
          </Crd>
        ))}
      </div>

      {filtro && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, background: C.priL, borderRadius: 9, padding: '8px 12px' }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: C.pri }}>Filtro: {filtro === 'totali' ? 'Tutti' : filtro === 'inCorso' ? 'In corso' : filtro.charAt(0).toUpperCase() + filtro.slice(1)}</span>
          <button onClick={() => setFiltro(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.dan, fontWeight: 700, fontSize: 12 }}>✕ Rimuovi</button>
        </div>
      )}

      {filtroModal && (
        <Modal title={`📋 ${filtroModal === 'totali' ? 'Tutti i piani' : filtroModal === 'inCorso' ? 'In corso' : filtroModal.charAt(0).toUpperCase() + filtroModal.slice(1)}`} onClose={() => setFiltroModal(null)} wide>
          <div style={{ marginBottom: 12, display: 'flex', gap: 8 }}>
            <Btn ch="Mostra solo questi" onClick={() => { setFiltro(filtroModal); setFiltroModal(null); }} full />
            <Btn ch="Mostra tutti" v="sec" onClick={() => { setFiltro(null); setFiltroModal(null); }} full />
          </div>
          {pianiFiltrati(filtroModal).length === 0 && <div style={{ textAlign: 'center', color: C.txl, padding: 30 }}>Nessun piano in questa categoria</div>}
          {pianiFiltrati(filtroModal).map(pl => {
            const p = patients.find(x => x.id === pl.pazienteId);
            const { finale: tot } = calcTot(pl.voci, pl.sconto || 0, pl.scontoTipo || 'pct');
            const done = pl.voci.filter(v => v.eseguita).length;
            const pct = pl.voci.length ? Math.round(done / pl.voci.length * 100) : 0;
            const statoC = { attivo: C.war, accettato: C.acc, concluso: C.suc, rifiutato: C.dan }[pl.stato || 'attivo'] || C.war;
            return (
              <Crd key={pl.id} style={{ marginBottom: 9, borderLeft: `3px solid ${statoC}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{pl.titolo}</div>
                    <div style={{ fontSize: 12, color: C.txm }}>{p?.nome} {p?.cognome}</div>
                    <div style={{ fontSize: 11, color: C.txl, marginTop: 2 }}>{pl.data} · {done}/{pl.voci.length} eseguite · {pct}%</div>
                    <div style={{ background: C.bg, borderRadius: 4, height: 4, overflow: 'hidden', marginTop: 5 }}>
                      <div style={{ height: '100%', width: `${pct}%`, background: pct === 100 ? C.suc : C.pri, borderRadius: 4 }} />
                    </div>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{ fontWeight: 800, fontSize: 14, color: C.pri }}>{fmt(tot)}</div>
                    <Bdg ch={pl.stato || 'attivo'} co={statoC} />
                    <div style={{ marginTop: 6 }}>
                      <button onClick={() => { setFiltroModal(null); setPdfPlan(pl); }} style={{ background: C.priL, border: 'none', borderRadius: 7, padding: '5px 9px', cursor: 'pointer', color: C.pri, fontWeight: 700, fontSize: 11 }}>PDF</button>
                    </div>
                  </div>
                </div>
              </Crd>
            );
          })}
        </Modal>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {(filtro ? pianiFiltrati(filtro) : plans).map((pl) => {
          const p = patients.find((x) => x.id === pl.pazienteId);
          const { sub, scontato, finale: tot } = calcTot(pl.voci, pl.sconto || 0, pl.scontoTipo || 'pct');
          const done = pl.voci.filter((v) => v.eseguita).length;
          const pct = pl.voci.length ? Math.round((done / pl.voci.length) * 100) : 0;
          const statoC = { attivo: C.war, accettato: C.acc, concluso: C.suc, rifiutato: C.dan }[pl.stato || 'attivo'] || C.war;
          const isSel = selPiani.includes(pl.id);
          return (
            <Crd key={pl.id} style={{ border: isSel ? `2px solid ${C.pri}` : undefined }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8, marginBottom: 8 }}>
                <div style={{ display: 'flex', gap: 8, minWidth: 0, flex: 1 }}>
                  <button onClick={() => toggleSel(pl.id)} style={{ marginTop: 2, width: 20, height: 20, borderRadius: 6, border: `2px solid ${isSel ? C.pri : C.brd}`, background: isSel ? C.pri : '#fff', cursor: 'pointer', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}>
                    {isSel && <Ic n="ok" s={11} c="#fff" />}
                  </button>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{pl.titolo}</div>
                    <div style={{ fontSize: 11, color: C.txm }}>
                      {p && onOpenPaz ? <span onClick={() => onOpenPaz(p, 'piani')} style={{ color: C.pri, cursor: 'pointer', fontWeight: 700, textDecoration: 'underline', textDecorationColor: C.pri + '60' }}>{p.nome} {p.cognome}</span> : `${p?.nome || ''} ${p?.cognome || ''}`}
                      {' · '}{pl.data}
                    </div>
                    <div style={{ marginTop: 6, display: 'flex', gap: 5, flexWrap: 'wrap' }}><Bdg ch={pl.stato || 'attivo'} co={statoC} /></div>
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 5, flexShrink: 0 }}>
                  <button onClick={() => setPdfPlan(pl)} style={{ background: C.priL, border: 'none', borderRadius: 8, padding: '7px 10px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, color: C.pri, fontWeight: 700, fontSize: 11 }}>
                    <Ic n="prt" s={13} c={C.pri} />Stampa PDF
                  </button>
                  <button onClick={() => del(pl.id)} style={{ background: C.danL, border: 'none', borderRadius: 8, padding: '7px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Ic n="del" s={14} c={C.dan} /></button>
                </div>
              </div>
              <div style={{ background: C.bg, borderRadius: 5, height: 5, overflow: 'hidden', marginBottom: 4 }}>
                <div style={{ height: '100%', width: `${pct}%`, background: pct === 100 ? C.suc : C.pri, borderRadius: 5 }} />
              </div>
              <div style={{ fontSize: 10, color: C.txm, marginBottom: 10 }}>{done}/{pl.voci.length} eseguite · {pct}%</div>
              {pl.voci.map((v, i) => (
                <div key={i} style={{ padding: '7px 0', borderBottom: `1px solid ${C.brd}` }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: v.eseguita ? C.txm : C.txt, textDecoration: v.eseguita ? 'line-through' : 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{v.prestazione}</div>
                      {v.dente && <div style={{ fontSize: 10, color: C.txl }}>Dente: {v.dente}</div>}
                      {v.dataEsec && <div style={{ fontSize: 10, color: C.suc }}>Eseguita il {v.dataEsec}</div>}
                    </div>
                    <div style={{ fontWeight: 700, color: C.pri, flexShrink: 0, fontSize: 12 }}>{fmt(v.prezzo)}</div>
                  </div>
                  <div style={{ display: 'flex', gap: 5, marginTop: 5 }}>
                    <button onClick={() => toggleEseguita(pl.id, i)} style={{ flex: 1, padding: '6px 0', borderRadius: 7, border: `1.5px solid ${v.eseguita ? C.suc : C.brd}`, background: v.eseguita ? C.sucL : C.bg, color: v.eseguita ? C.suc : C.txm, fontWeight: 700, fontSize: 11, cursor: 'pointer' }}>
                      {v.eseguita ? '✓ Eseguita' : '○ Segna eseguita'}
                    </button>
                    {v.eseguita && (
                      <button onClick={() => toggleIncassata(pl.id, i)} style={{ flex: 1, padding: '6px 0', borderRadius: 7, border: `1.5px solid ${v.incassata ? C.suc : C.dan}`, background: v.incassata ? C.sucL : C.danL, color: v.incassata ? C.suc : C.dan, fontWeight: 700, fontSize: 11, cursor: 'pointer' }}>
                        {v.incassata ? '€ Incassata' : '€ Da incassare'}
                      </button>
                    )}
                  </div>
                </div>
              ))}
              <div style={{ textAlign: 'right', fontWeight: 800, color: C.pri, marginTop: 7, fontSize: 13 }}>Totale: {fmt(tot)}</div>
              <div style={{ marginTop: 9, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                <button onClick={() => openWA(pl, 'piano')} style={{ background: '#25D366', border: 'none', borderRadius: 8, padding: '6px 11px', color: '#fff', fontWeight: 700, fontSize: 11, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}><Ic n="wa" s={12} c="#fff" />Piano WA</button>
                <button onClick={() => openWA(pl, 'preventivo')} style={{ background: '#128C7E', border: 'none', borderRadius: 8, padding: '6px 11px', color: '#fff', fontWeight: 700, fontSize: 11, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}><Ic n="send" s={12} c="#fff" />Prev. WA</button>
                <Sel value={pl.stato || 'attivo'} onChange={(e) => setStato(pl.id, e.target.value)} style={{ padding: '6px 8px', fontSize: 11, borderRadius: 8, width: 'auto', flex: 1 }}>
                  <option value="attivo">Attivo</option><option value="accettato">Accettato ✓</option><option value="rifiutato">Rifiutato ✗</option><option value="concluso">Concluso ✓</option>
                </Sel>
              </div>
            </Crd>
          );
        })}
        {plans.length === 0 && <div style={{ textAlign: 'center', color: C.txl, padding: 40 }}>Nessun piano di cura</div>}
      </div>

      {modal && (
        <Modal title="Nuovo piano di cura" onClose={() => setModal(false)} wide>
          <Fld label="Paziente">
            {(() => {
              const sel = patients.find(p => String(p.id) === String(form.pazienteId));
              const filtered = pazSearch.trim()
                ? patients.filter(p => `${p.nome} ${p.cognome}`.toLowerCase().includes(pazSearch.toLowerCase()))
                : patients;
              return (
                <div style={{ position: 'relative' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, border: `1.5px solid ${C.brd}`, borderRadius: 10, padding: '10px 12px', background: C.sur, cursor: 'text' }} onClick={() => { setPazSearch(''); }}>
                    {sel && !pazSearch ? (
                      <span style={{ flex: 1, fontSize: 14, color: C.txt, fontWeight: 600 }}>{sel.nome} {sel.cognome}</span>
                    ) : (
                      <input
                        autoFocus={!!pazSearch || !sel}
                        value={pazSearch}
                        onChange={e => { setPazSearch(e.target.value); if (!e.target.value) setForm(f => ({ ...f, pazienteId: '' })); }}
                        placeholder={sel ? `${sel.nome} ${sel.cognome}` : 'Cerca paziente…'}
                        style={{ flex: 1, border: 'none', background: 'transparent', fontSize: 14, color: C.txt, outline: 'none', fontFamily: 'inherit' }}
                      />
                    )}
                    {sel && <button onClick={e => { e.stopPropagation(); setForm(f => ({ ...f, pazienteId: '' })); setPazSearch(''); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.txl, fontSize: 16, padding: 0 }}>✕</button>}
                  </div>
                  {(pazSearch || !sel) && filtered.length > 0 && (
                    <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 1000, background: C.sur, border: `1.5px solid ${C.pri}`, borderRadius: 10, boxShadow: '0 8px 24px rgba(0,0,0,0.12)', marginTop: 3, maxHeight: 220, overflowY: 'auto' }}>
                      {filtered.slice(0, 20).map(p => (
                        <div key={p.id} onClick={() => { setForm(f => ({ ...f, pazienteId: String(p.id) })); setPazSearch(''); }}
                          style={{ padding: '10px 14px', cursor: 'pointer', borderBottom: `1px solid ${C.brd}`, fontSize: 13, fontWeight: 600 }}
                          onMouseEnter={e => e.currentTarget.style.background = C.bg}
                          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                          {p.nome} {p.cognome}
                          {p.telefono && <span style={{ fontSize: 11, color: C.txl, marginLeft: 8 }}>{p.telefono}</span>}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })()}
          </Fld>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <Fld label="Titolo"><Inp value={form.titolo} onChange={(e) => setForm((f) => ({ ...f, titolo: e.target.value }))} placeholder={isDentistico ? 'es. Piano conservativa' : 'es. Piano di trattamento'} /></Fld>
            <Fld label="Data"><Inp type="date" value={form.data} onChange={(e) => setForm((f) => ({ ...f, data: e.target.value }))} /></Fld>
          </div>
          <Fld label="Stato preventivo">
            <div style={{ display: 'flex', gap: 6 }}>
              {[['attivo', '⏳ In attesa', C.war], ['accettato', '✓ Accettato', C.acc], ['rifiutato', '✗ Non accettato', C.dan]].map(([val, lbl, co]) => {
                const sel = form.stato === val;
                return (
                  <button key={val} onClick={() => setForm((f) => ({ ...f, stato: val }))} style={{ flex: 1, padding: '9px 4px', borderRadius: 9, border: `1.5px solid ${sel ? co : C.brd}`, background: sel ? co + '18' : C.sur, color: sel ? co : C.txm, fontWeight: sel ? 800 : 600, fontSize: 11.5, cursor: 'pointer' }}>{lbl}</button>
                );
              })}
            </div>
          </Fld>
          <Fld label="Scadenza pagamento (opzionale)">
            <div style={{ display: 'flex', gap: 6, marginBottom: 7 }}>
              {SCADENZA_PRESET.map((p) => {
                const sel = form._presetScadenza === p.mesi;
                return (
                  <button key={p.mesi} onClick={() => setForm((f) => ({ ...f, scadenzaPagamento: addMesi(f.data || today(), p.mesi), _presetScadenza: p.mesi }))} style={{ flex: 1, padding: '7px 4px', borderRadius: 8, border: `1.5px solid ${sel ? C.pri : C.brd}`, background: sel ? C.priL : C.sur, color: sel ? C.pri : C.txm, fontWeight: sel ? 800 : 600, fontSize: 11, cursor: 'pointer' }}>{p.label}</button>
                );
              })}
              {form.scadenzaPagamento && <button onClick={() => setForm((f) => ({ ...f, scadenzaPagamento: '', _presetScadenza: null }))} style={{ padding: '7px 10px', borderRadius: 8, border: `1px solid ${C.brd}`, background: C.sur, color: C.txl, fontWeight: 700, fontSize: 11, cursor: 'pointer' }}>✕</button>}
            </div>
            <Inp type="date" value={form.scadenzaPagamento || ''} onChange={(e) => setForm((f) => ({ ...f, scadenzaPagamento: e.target.value, _presetScadenza: null }))} />
          </Fld>

          {isDentistico && (
          <div style={{ background: form.ortodonzia?.attivo ? C.purL : C.bg, borderRadius: 10, padding: 11, marginBottom: 11, border: form.ortodonzia?.attivo ? `1.5px solid ${C.pur}40` : 'none' }}>
            <button onClick={() => setForm((f) => ({ ...f, ortodonzia: f.ortodonzia?.attivo ? { ...ortoVuoto } : { ...ortoVuoto, attivo: true } }))} style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'none', border: 'none', cursor: 'pointer', padding: 0, width: '100%' }}>
              <div style={{ width: 20, height: 20, borderRadius: 6, border: `2px solid ${form.ortodonzia?.attivo ? C.pur : C.brd}`, background: form.ortodonzia?.attivo ? C.pur : '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                {form.ortodonzia?.attivo && <Ic n="ok" s={11} c="#fff" />}
              </div>
              <span style={{ fontSize: 13, fontWeight: 700, color: form.ortodonzia?.attivo ? C.pur : C.txt }}>🦷 Piano ortodontico (mascherine invisibili)</span>
            </button>
            {form.ortodonzia?.attivo && (
              <div style={{ marginTop: 12 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <Fld label="N° totale mascherine">
                    <Inp type="number" min="1" value={form.ortodonzia.mascherineTotali} onChange={(e) => setForm((f) => ({ ...f, ortodonzia: { ...f.ortodonzia, mascherineTotali: e.target.value } }))} placeholder="es. 20" />
                  </Fld>
                  <Fld label="Cambio ogni">
                    <Sel value={form.ortodonzia.frequenzaSettimane} onChange={(e) => setForm((f) => ({ ...f, ortodonzia: { ...f.ortodonzia, frequenzaSettimane: Number(e.target.value) } }))}>
                      <option value={1}>1 settimana</option><option value={2}>2 settimane</option>
                    </Sel>
                  </Fld>
                </div>
                {form.ortodonzia.mascherineTotali > 0 && (
                  <div style={{ background: '#fff', borderRadius: 8, padding: 10, marginTop: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: C.txm }}>⏱️ Durata stimata del trattamento</span>
                    <span style={{ fontSize: 14, fontWeight: 900, color: C.pur }}>
                      {(() => { const settimane = Number(form.ortodonzia.mascherineTotali) * form.ortodonzia.frequenzaSettimane; const mesi = Math.round((settimane / 4.345) * 10) / 10; return `~${settimane} sett. (${mesi} mesi)`; })()}
                    </span>
                  </div>
                )}
                <div style={{ fontSize: 10, color: C.txl, marginTop: 7, lineHeight: 1.5 }}>
                  La consegna della prima mascherina e il conteggio delle successive si gestiscono dalla scheda del paziente, dopo aver salvato il piano.
                </div>
              </div>
            )}
          </div>
          )}

          <div style={{ background: C.bg, borderRadius: 10, padding: 11, marginBottom: 11 }}>
            <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 9 }}>Aggiungi prestazione</div>
            <Fld label="Prestazione (digita o scegli dal listino)">
              <div style={{ display: 'flex', gap: 8, marginBottom: 7 }}>
                <Inp
                  value={nv.prestazione}
                  onChange={(e) => setNv((v) => ({ ...v, prestazione: e.target.value }))}
                  placeholder="Digita nome prestazione…"
                  style={{ flex: 1 }}
                />
              </div>
              <Sel value={nv.prestazione} onChange={(e) => selPr(e.target.value)}>
                <option value="">Scegli dal listino…</option>
                {pricelist.map((p) => <option key={p.id} value={p.nome}>{p.nome} — {fmt(p.prezzo)}</option>)}
              </Sel>
            </Fld>
            {isDentistico && (
              <>
                <Odontogramma selected={selectedDenti} onChange={setSelectedDenti} onDenteChange={(v) => setNv((n) => ({ ...n, dente: v }))} />
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <Fld label={`Dente${nv.dente ? ' ✓' : ''}`}><Inp value={nv.dente} onChange={(e) => { setNv((v) => ({ ...v, dente: e.target.value })); if (!e.target.value) setSelectedDenti([]); }} placeholder="es. 16, 26 (opzionale)" /></Fld>
                  <Fld label="Prezzo €"><Inp type="number" value={nv.prezzo} onChange={(e) => setNv((v) => ({ ...v, prezzo: e.target.value }))} /></Fld>
                </div>
              </>
            )}
            {!isDentistico && (
              <Fld label="Prezzo €"><Inp type="number" value={nv.prezzo} onChange={(e) => setNv((v) => ({ ...v, prezzo: e.target.value }))} /></Fld>
            )}
            <Btn ch="+ Aggiungi" onClick={addVoce} full />
          </div>

          {form.voci.length > 0 && (
            <div style={{ marginBottom: 11 }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: C.txm, textTransform: 'uppercase', marginBottom: 7 }}>Prestazioni aggiunte</div>
              {form.voci.map((v, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', padding: '7px 0', borderBottom: `1px solid ${C.brd}`, gap: 8 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{v.prestazione}</div>
                    {v.dente && <div style={{ fontSize: 10, color: C.txl }}>Dente {v.dente}</div>}
                  </div>
                  <span style={{ fontWeight: 700, color: C.pri, fontSize: 12, flexShrink: 0 }}>{fmt(v.prezzo)}</span>
                  <button onClick={() => setForm((f) => ({ ...f, voci: f.voci.filter((_, j) => j !== i) }))} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 3 }}><Ic n="x" s={13} c={C.dan} /></button>
                </div>
              ))}
              <div style={{ background: C.priL, borderRadius: 10, padding: 11, marginTop: 10 }}>
                <div style={{ fontSize: 11, fontWeight: 800, color: C.pri, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Sconto</div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <div style={{ display: 'flex', background: C.sur, borderRadius: 8, border: `1.5px solid ${C.brd}`, overflow: 'hidden', flexShrink: 0 }}>
                    <button onClick={() => setForm((f) => ({ ...f, scontoTipo: 'pct' }))} style={{ padding: '8px 12px', border: 'none', background: form.scontoTipo === 'pct' ? C.pri : C.sur, color: form.scontoTipo === 'pct' ? '#fff' : C.txm, fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>%</button>
                    <button onClick={() => setForm((f) => ({ ...f, scontoTipo: 'eur' }))} style={{ padding: '8px 12px', border: 'none', background: form.scontoTipo === 'eur' ? C.pri : C.sur, color: form.scontoTipo === 'eur' ? '#fff' : C.txm, fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>€</button>
                  </div>
                  <Inp type="number" inputMode="decimal" min="0" max={form.scontoTipo === 'pct' ? 100 : undefined} value={form.sconto || ''} placeholder={form.scontoTipo === 'pct' ? 'es. 10' : 'es. 50'} onChange={(e) => setForm((f) => ({ ...f, sconto: e.target.value }))} style={{ flex: 1 }} />
                  {Number(form.sconto) > 0 && <button onClick={() => setForm((f) => ({ ...f, sconto: 0 }))} style={{ background: C.danL, border: 'none', borderRadius: 7, padding: '8px 10px', color: C.dan, fontWeight: 700, fontSize: 11, cursor: 'pointer', flexShrink: 0 }}>✕</button>}
                </div>
              </div>
              {(() => {
                const { sub, scontato, finale } = calcTot(form.voci, form.sconto || 0, form.scontoTipo || 'pct');
                return (
                  <div style={{ marginTop: 10, background: C.priD, borderRadius: 10, padding: '10px 14px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ color: 'rgba(255,255,255,0.7)', fontSize: 12 }}>Subtotale</span>
                      <span style={{ color: '#fff', fontWeight: 700, fontSize: 13 }}>{fmt(sub)}</span>
                    </div>
                    {scontato > 0 && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
                        <span style={{ color: '#86efac', fontSize: 12 }}>Sconto {form.scontoTipo === 'pct' ? `${form.sconto}%` : `€ ${Number(form.sconto).toFixed(2)}`}</span>
                        <span style={{ color: '#86efac', fontWeight: 700, fontSize: 13 }}>−{fmt(scontato)}</span>
                      </div>
                    )}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 6, paddingTop: 6, borderTop: '1px solid rgba(255,255,255,0.2)' }}>
                      <span style={{ color: '#fff', fontWeight: 800, fontSize: 14 }}>Totale</span>
                      <span style={{ color: '#fff', fontWeight: 900, fontSize: 18 }}>{fmt(finale)}</span>
                    </div>
                  </div>
                );
              })()}
            </div>
          )}
          <div style={{ display: 'flex', gap: 8 }}>
            <Btn ch="Annulla" v="sec" onClick={() => setModal(false)} full />
            <Btn ch="Salva piano" onClick={save} dis={!form.pazienteId || !form.titolo || !form.voci.length} full />
          </div>
        </Modal>
      )}

      {waModal && (
        <Modal title="Invia su WhatsApp" onClose={() => setWaModal(null)} wide>
          <div style={{ background: C.bg, borderRadius: 9, padding: 10, marginBottom: 11 }}>
            <div style={{ fontSize: 13, fontWeight: 700 }}>{waModal.paz?.nome} {waModal.paz?.cognome}</div>
          </div>
          <Fld label="Template (opzionale)">
            <Sel onChange={(e) => fillTpl(e.target.value, waModal.pl, waModal.paz)}>
              <option value="">Messaggio libero</option>
              {templates.map((t) => <option key={t.id} value={t.id}>{t.nome}</option>)}
            </Sel>
          </Fld>
          <Fld label="Messaggio"><Txt value={waMsg} onChange={(e) => setWaMsg(e.target.value)} rows={9} /></Fld>
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <Btn ch="Annulla" v="sec" onClick={() => setWaModal(null)} full />
            <Btn ch="Apri WhatsApp" v="wa" ic="wa" onClick={sendWA} dis={!waMsg} full />
          </div>
        </Modal>
      )}
    </div>
  );
}
