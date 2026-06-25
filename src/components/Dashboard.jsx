import React, { useState } from 'react';
import { Crd, Bdg, Modal, Ic, Btn } from './ui';
import { C, fmt, fmtD, today } from '../lib/utils';

export default function Dashboard({ patients, appointments, payments, plans, onOpenPaz }) {
  const t = today();
  const anno = t.slice(0, 4);
  const [detailModal, setDetailModal] = useState(null);
  const [todoList, setTodoList] = useState(() => {
    try { return JSON.parse(localStorage.getItem('dm_todo') || '[]'); } catch { return []; }
  });
  const [todoInput, setTodoInput] = useState('');
  const [todoModal, setTodoModal] = useState(false);

  const todayApps = appointments.filter((a) => a.data === t);
  const mInc = payments.filter((p) => p.data && p.data.startsWith(t.slice(0, 7))).reduce((s, p) => s + Number(p.importo), 0);
  const upcoming = [...appointments].filter((a) => a.data >= t).sort((a, b) => a.data.localeCompare(b.data) || a.ora.localeCompare(b.ora)).slice(0, 6);

  // ── PROMEMORIA: richiami da note cliniche non ancora fatti ──
  const promemoria = patients.flatMap(paz =>
    (paz.annotazioni || [])
      .filter(ann => ann.richiamo && !ann.richiamo.fatto)
      .map(ann => ({ paz, ann, richiamo: ann.richiamo }))
  ).sort((a, b) => (a.richiamo.data || '').localeCompare(b.richiamo.data || ''));
  const promemoriScaduti = promemoria.filter(p => p.richiamo.data && p.richiamo.data < t);
  const promemoriOggi = promemoria.filter(p => p.richiamo.data === t);

  // Calcolo basato su pagamenti reali (dovuto piani - pagamenti registrati)
  const saldoPerPaz = patients.map((paz) => {
    const patPlans = plans.filter((pl) => pl.pazienteId === paz.id);
    const dovuto = patPlans.reduce((s, pl) => {
      const sub = pl.voci.reduce((a, v) => a + Number(v.prezzo), 0);
      const sc = Number(pl.sconto) || 0;
      const scontato = pl.scontoTipo === 'pct' ? sub * (sc / 100) : Math.min(sc, sub);
      return s + Math.max(0, sub - scontato);
    }, 0);
    const pagato = payments.filter((p) => p.pazienteId === paz.id).reduce((s, p) => s + Number(p.importo), 0);
    const pagatoAnno = payments.filter((p) => p.pazienteId === paz.id && p.data && p.data.startsWith(anno)).reduce((s, p) => s + Number(p.importo), 0);
    const totDaInc = Math.max(0, dovuto - pagato);
    return { paz, dovuto, pagato, pagatoAnno, totDaInc, totIncAnno: pagatoAnno };
  }).filter((x) => x.dovuto > 0 || x.pagato > 0);

  const totDaInc = saldoPerPaz.reduce((s, x) => s + x.totDaInc, 0);
  const totIncAnno = saldoPerPaz.reduce((s, x) => s + x.totIncAnno, 0);
  const nPazDaInc = saldoPerPaz.filter((x) => x.totDaInc > 0).length;
  const nPazInc = saldoPerPaz.filter((x) => x.totIncAnno > 0).length;
  const righeDAInc = saldoPerPaz.filter((x) => x.totDaInc > 0).sort((a, b) => b.totDaInc - a.totDaInc);
  const righeInc = saldoPerPaz.filter((x) => x.totIncAnno > 0).sort((a, b) => b.totIncAnno - a.totIncAnno);


  // ── ESEGUITO DA INCASSARE (voci eseguite ma non incassate) ──
  const esegDaInc = patients.map(paz => {
    const patPlans = plans.filter(pl => pl.pazienteId === paz.id);
    const voci = patPlans.flatMap(pl => pl.voci.filter(v => v.eseguita && !v.incassata).map(v => ({ ...v, pianoTitolo: pl.titolo })));
    const tot = voci.reduce((s, v) => s + Number(v.prezzo), 0);
    return { paz, voci, tot };
  }).filter(x => x.tot > 0).sort((a, b) => b.tot - a.tot);
  const totEsegDaInc = esegDaInc.reduce((s, x) => s + x.tot, 0);

  // ── ACCETTATO NON ESEGUITO (piani accettati con voci da fare) ──
  const accNonEseg = patients.map(paz => {
    const patPlans = plans.filter(pl => pl.pazienteId === paz.id && pl.stato === 'accettato');
    const voci = patPlans.flatMap(pl => pl.voci.filter(v => !v.eseguita).map(v => ({ ...v, pianoTitolo: pl.titolo })));
    const tot = voci.reduce((s, v) => s + Number(v.prezzo), 0);
    return { paz, voci, tot };
  }).filter(x => x.tot > 0).sort((a, b) => b.tot - a.tot);
  const totAccNonEseg = accNonEseg.reduce((s, x) => s + x.tot, 0);

  // ── DA ESEGUIRE (tutte le prestazioni non ancora eseguite) ──
  const daEseguire = patients.map(paz => {
    const patPlans = plans.filter(pl => pl.pazienteId === paz.id);
    const voci = patPlans.flatMap(pl => pl.voci.filter(v => !v.eseguita).map(v => ({ ...v, pianoTitolo: pl.titolo, pianoStato: pl.stato })));
    const tot = voci.reduce((s, v) => s + Number(v.prezzo), 0);
    return { paz, voci, tot };
  }).filter(x => x.tot > 0).sort((a, b) => b.tot - a.tot);
  const totDaEseguire = daEseguire.reduce((s, x) => s + x.tot, 0);

  // PREVENTIVI
  const preventiviAttesa = plans.filter((pl) => (pl.stato || 'attivo') === 'attivo').map((pl) => ({ pl, paz: patients.find((x) => x.id === pl.pazienteId) })).filter((x) => x.paz);
  const preventiviRifiutati = plans.filter((pl) => pl.stato === 'rifiutato').map((pl) => ({ pl, paz: patients.find((x) => x.id === pl.pazienteId) })).filter((x) => x.paz);
  const preventiviAccettati = plans.filter((pl) => pl.stato === 'accettato').map((pl) => {
    const paz = patients.find((x) => x.id === pl.pazienteId);
    const sub = pl.voci.reduce((s, v) => s + Number(v.prezzo), 0);
    const sc = Number(pl.sconto) || 0;
    const scontato = pl.scontoTipo === 'pct' ? sub * (sc / 100) : Math.min(sc, sub);
    return { pl, paz, tot: Math.max(0, sub - scontato) };
  }).filter((x) => x.paz);
  const totAccettati = preventiviAccettati.reduce((s, x) => s + x.tot, 0);

  // RICHIAMI
  const oggiD = new Date(t + 'T12:00');
  const tra30 = new Date(oggiD); tra30.setDate(tra30.getDate() + 30);
  const richiamiTutti = plans.flatMap((pl) => {
    const paz = patients.find((x) => x.id === pl.pazienteId);
    if (!paz) return [];
    return pl.voci.filter((v) => v.richiamoData).map((v) => ({ paz, pl, v, data: v.richiamoData }));
  });
  const richiamiScaduti = richiamiTutti.filter((r) => new Date(r.data + 'T12:00') < oggiD).sort((a, b) => a.data.localeCompare(b.data));
  const richiamiProssimi = richiamiTutti.filter((r) => { const d = new Date(r.data + 'T12:00'); return d >= oggiD && d <= tra30; }).sort((a, b) => a.data.localeCompare(b.data));
  const richiamiTotali = richiamiScaduti.length + richiamiProssimi.length;

  // SCADENZE PAGAMENTO
  const scadenzePagamento = plans.map((pl) => {
    const paz = patients.find((x) => x.id === pl.pazienteId);
    if (!paz || !pl.scadenzaPagamento) return null;
    const sub = pl.voci.reduce((s, v) => s + Number(v.prezzo), 0);
    const sc = Number(pl.sconto) || 0;
    const scontato = pl.scontoTipo === 'pct' ? sub * (sc / 100) : Math.min(sc, sub);
    const totPiano = Math.max(0, sub - scontato);
    const pagatoPaz = payments.filter((p) => p.pazienteId === paz.id).reduce((s, p) => s + Number(p.importo), 0);
    const dovutoPaz = plans.filter((pp) => pp.pazienteId === paz.id).reduce((s, pp) => {
      const sub2 = pp.voci.reduce((a, v) => a + Number(v.prezzo), 0);
      const sc2 = Number(pp.sconto) || 0;
      const scontato2 = pp.scontoTipo === 'pct' ? sub2 * (sc2 / 100) : Math.min(sc2, sub2);
      return s + Math.max(0, sub2 - scontato2);
    }, 0);
    const residuoStimato = Math.min(totPiano, Math.max(0, dovutoPaz - pagatoPaz));
    if (residuoStimato <= 0) return null;
    return { pl, paz, scadenza: pl.scadenzaPagamento, importo: residuoStimato };
  }).filter(Boolean).sort((a, b) => a.scadenza.localeCompare(b.scadenza));
  const scadenzeScadute = scadenzePagamento.filter((s) => new Date(s.scadenza + 'T12:00') < oggiD);
  const scadenzeProssime = scadenzePagamento.filter((s) => { const d = new Date(s.scadenza + 'T12:00'); return d >= oggiD && d <= tra30; });

  // PREVISIONALE
  const previsionaleMesi = (() => {
    const mesi = {};
    scadenzePagamento.forEach((s) => { const k = s.scadenza.slice(0, 7); mesi[k] = (mesi[k] || 0) + s.importo; });
    return Object.entries(mesi).sort((a, b) => a[0].localeCompare(b[0])).slice(0, 6);
  })();
  const MESI_NOMI = ['Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu', 'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic'];
  // ── ORTODONZIA IN CORSO ──
  const prossimaDataMascherinaDash = (orto) => {
    if (!orto?.dataConsegnaInizio || !orto?.mascherineConsegnate) return null;
    const ultima = orto.storico && orto.storico.length > 0 ? orto.storico[orto.storico.length - 1].data : orto.dataConsegnaInizio;
    const d = new Date(ultima + 'T12:00');
    d.setDate(d.getDate() + (orto.frequenzaSettimane || 2) * 7);
    return d.toISOString().slice(0, 10);
  };
  const pianiOrto = plans.filter(pl => pl.ortodonzia?.attivo).map(pl => {
    const paz = patients.find(x => x.id === pl.pazienteId);
    if (!paz) return null;
    const orto = pl.ortodonzia;
    const tot = Number(orto.mascherineTotali) || 0;
    const cons = orto.mascherineConsegnate || 0;
    const completato = tot > 0 && cons >= tot;
    const prossima = prossimaDataMascherinaDash(orto);
    const inAttesa = !orto.dataConsegnaInizio;
    const cambioScaduto = prossima && prossima <= t;
    return { pl, paz, orto, tot, cons, completato, prossima, inAttesa, cambioScaduto };
  }).filter(Boolean);
  const ortoAttivi = pianiOrto.filter(o => !o.completato);
  const ortoCambioOggi = ortoAttivi.filter(o => o.cambioScaduto);

  // ── TO-DO STUDIO ──
  const saveTodo = (list) => {
    setTodoList(list);
    try { localStorage.setItem('dm_todo', JSON.stringify(list)); } catch {}
  };
  const addTodo = () => {
    if (!todoInput.trim()) return;
    saveTodo([{ id: Date.now(), testo: todoInput.trim(), fatto: false, data: t }, ...todoList]);
    setTodoInput('');
  };
  const toggleTodo = (id) => saveTodo(todoList.map(x => x.id === id ? { ...x, fatto: !x.fatto } : x));
  const deleteTodo = (id) => saveTodo(todoList.filter(x => x.id !== id));
  const todoAttivi = todoList.filter(x => !x.fatto);
  const todoFatti = todoList.filter(x => x.fatto);


  return (
    <div>
      {detailModal === 'accettati' && (
        <Modal title="✓ Piani accettati" onClose={() => setDetailModal(null)} wide>
          <div style={{ background: '#E8FAF9', borderRadius: 10, padding: '10px 14px', marginBottom: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: C.acc }}>Totale accettato</span>
            <span style={{ fontSize: 20, fontWeight: 900, color: C.acc }}>{fmt(totAccettati)}</span>
          </div>
          {preventiviAccettati.length === 0 && <div style={{ textAlign: 'center', color: C.txl, padding: 30 }}>Nessun piano accettato</div>}
          {preventiviAccettati.map(({ pl, paz, tot }) => {
            const done = pl.voci.filter(v => v.eseguita).length;
            const pct = pl.voci.length ? Math.round(done / pl.voci.length * 100) : 0;
            return (
              <Crd key={pl.id} style={{ marginBottom: 9, borderLeft: `3px solid ${C.acc}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div onClick={() => { setDetailModal(null); onOpenPaz(paz, 'piani'); }} style={{ fontWeight: 700, fontSize: 14, color: C.pri, cursor: 'pointer' }}>{paz.nome} {paz.cognome} ›</div>
                    <div style={{ fontSize: 11, color: C.txm }}>{pl.titolo} · {fmtD(pl.data)}</div>
                    <div style={{ background: C.bg, borderRadius: 4, height: 4, overflow: 'hidden', marginTop: 6 }}>
                      <div style={{ height: '100%', width: `${pct}%`, background: pct === 100 ? C.suc : C.acc, borderRadius: 4 }} />
                    </div>
                    <div style={{ fontSize: 10, color: C.txl, marginTop: 3 }}>{done}/{pl.voci.length} eseguite · {pct}%</div>
                  </div>
                  <span style={{ fontWeight: 900, fontSize: 16, color: C.acc, flexShrink: 0 }}>{fmt(tot)}</span>
                </div>
              </Crd>
            );
          })}
        </Modal>
      )}

      {detailModal === 'prevent' && (
        <Modal title="📋 Preventivi da gestire" onClose={() => setDetailModal(null)} wide>
          {preventiviAttesa.length === 0 && preventiviRifiutati.length === 0 && <div style={{ textAlign: 'center', color: C.txl, padding: 30 }}>Nessun preventivo in sospeso 🎉</div>}
          {preventiviAttesa.length > 0 && (
            <>
              <div style={{ fontSize: 11, fontWeight: 800, color: C.war, textTransform: 'uppercase', marginBottom: 8 }}>⏳ In attesa di accettazione ({preventiviAttesa.length})</div>
              {preventiviAttesa.map(({ pl, paz }) => {
                const sub = pl.voci.reduce((s, v) => s + Number(v.prezzo), 0);
                return (
                  <Crd key={pl.id} style={{ marginBottom: 8, borderLeft: `3px solid ${C.war}` }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                      <div>
                        <div onClick={() => { setDetailModal(null); onOpenPaz(paz, 'piani'); }} style={{ fontWeight: 700, fontSize: 13, color: C.pri, cursor: 'pointer' }}>{paz.nome} {paz.cognome} ›</div>
                        <div style={{ fontSize: 11, color: C.txm }}>{pl.titolo} · {fmtD(pl.data)}</div>
                      </div>
                      <span style={{ fontWeight: 800, color: C.war, fontSize: 14 }}>{fmt(sub)}</span>
                    </div>
                  </Crd>
                );
              })}
            </>
          )}
          {preventiviRifiutati.length > 0 && (
            <>
              <div style={{ fontSize: 11, fontWeight: 800, color: C.dan, textTransform: 'uppercase', margin: '14px 0 8px' }}>✗ Rifiutati ({preventiviRifiutati.length})</div>
              {preventiviRifiutati.map(({ pl, paz }) => (
                <Crd key={pl.id} style={{ marginBottom: 8, borderLeft: `3px solid ${C.dan}` }}>
                  <div onClick={() => { setDetailModal(null); onOpenPaz(paz, 'piani'); }} style={{ fontWeight: 700, fontSize: 13, color: C.pri, cursor: 'pointer' }}>{paz.nome} {paz.cognome} ›</div>
                  <div style={{ fontSize: 11, color: C.txm }}>{pl.titolo} · {fmtD(pl.data)}</div>
                </Crd>
              ))}
            </>
          )}
        </Modal>
      )}

      {detailModal === 'richiami' && (
        <Modal title="🔔 Richiami clinici" onClose={() => setDetailModal(null)} wide>
          {richiamiTotali === 0 && <div style={{ textAlign: 'center', color: C.txl, padding: 30 }}>Nessun richiamo in scadenza 🎉</div>}
          {richiamiScaduti.length > 0 && (
            <>
              <div style={{ fontSize: 11, fontWeight: 800, color: C.dan, textTransform: 'uppercase', marginBottom: 8 }}>⚠️ Scaduti ({richiamiScaduti.length})</div>
              {richiamiScaduti.map((r, i) => (
                <Crd key={i} style={{ marginBottom: 8, borderLeft: `3px solid ${C.dan}` }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                    <div>
                      <div onClick={() => { setDetailModal(null); onOpenPaz(r.paz, 'paga'); }} style={{ fontWeight: 700, fontSize: 13, color: C.pri, cursor: 'pointer' }}>{r.paz.nome} {r.paz.cognome} ›</div>
                      <div style={{ fontSize: 11, color: C.txm }}>{r.v.richiamoTipo || 'Controllo'}{r.paz.telefono ? ' · 📞 ' + r.paz.telefono : ''}</div>
                    </div>
                    <span style={{ fontWeight: 800, color: C.dan, fontSize: 12 }}>{fmtD(r.data)}</span>
                  </div>
                </Crd>
              ))}
            </>
          )}
          {richiamiProssimi.length > 0 && (
            <>
              <div style={{ fontSize: 11, fontWeight: 800, color: C.pur, textTransform: 'uppercase', margin: '14px 0 8px' }}>📅 Prossimi 30 giorni ({richiamiProssimi.length})</div>
              {richiamiProssimi.map((r, i) => (
                <Crd key={i} style={{ marginBottom: 8, borderLeft: `3px solid ${C.pur}` }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                    <div>
                      <div onClick={() => { setDetailModal(null); onOpenPaz(r.paz, 'paga'); }} style={{ fontWeight: 700, fontSize: 13, color: C.pri, cursor: 'pointer' }}>{r.paz.nome} {r.paz.cognome} ›</div>
                      <div style={{ fontSize: 11, color: C.txm }}>{r.v.richiamoTipo || 'Controllo'}{r.paz.telefono ? ' · 📞 ' + r.paz.telefono : ''}</div>
                    </div>
                    <span style={{ fontWeight: 800, color: C.pur, fontSize: 12 }}>{fmtD(r.data)}</span>
                  </div>
                </Crd>
              ))}
            </>
          )}
        </Modal>
      )}

      {detailModal === 'scadenze' && (
        <Modal title="📆 Scadenze pagamento" onClose={() => setDetailModal(null)} wide>
          {scadenzePagamento.length === 0 && <div style={{ textAlign: 'center', color: C.txl, padding: 30 }}>Nessuna scadenza impostata</div>}
          {scadenzeScadute.length > 0 && (
            <>
              <div style={{ fontSize: 11, fontWeight: 800, color: C.dan, textTransform: 'uppercase', marginBottom: 8 }}>⚠️ Scadute ({scadenzeScadute.length})</div>
              {scadenzeScadute.map((s, i) => (
                <Crd key={i} style={{ marginBottom: 8, borderLeft: `3px solid ${C.dan}` }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                    <div>
                      <div onClick={() => { setDetailModal(null); onOpenPaz(s.paz, 'paga'); }} style={{ fontWeight: 700, fontSize: 13, color: C.pri, cursor: 'pointer' }}>{s.paz.nome} {s.paz.cognome} ›</div>
                      <div style={{ fontSize: 11, color: C.txm }}>{s.pl.titolo} · scadenza {fmtD(s.scadenza)}</div>
                    </div>
                    <span style={{ fontWeight: 800, color: C.dan, fontSize: 14 }}>{fmt(s.importo)}</span>
                  </div>
                </Crd>
              ))}
            </>
          )}
          {scadenzeProssime.length > 0 && (
            <>
              <div style={{ fontSize: 11, fontWeight: 800, color: C.war, textTransform: 'uppercase', margin: '14px 0 8px' }}>📅 Prossimi 30 giorni ({scadenzeProssime.length})</div>
              {scadenzeProssime.map((s, i) => (
                <Crd key={i} style={{ marginBottom: 8, borderLeft: `3px solid ${C.war}` }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                    <div>
                      <div onClick={() => { setDetailModal(null); onOpenPaz(s.paz, 'paga'); }} style={{ fontWeight: 700, fontSize: 13, color: C.pri, cursor: 'pointer' }}>{s.paz.nome} {s.paz.cognome} ›</div>
                      <div style={{ fontSize: 11, color: C.txm }}>{s.pl.titolo} · scadenza {fmtD(s.scadenza)}</div>
                    </div>
                    <span style={{ fontWeight: 800, color: C.war, fontSize: 14 }}>{fmt(s.importo)}</span>
                  </div>
                </Crd>
              ))}
            </>
          )}
        </Modal>
      )}

      {detailModal === 'prev' && (
        <Modal title="📈 Previsionale incassi" onClose={() => setDetailModal(null)} wide>
          <div style={{ fontSize: 12, color: C.txm, marginBottom: 14, lineHeight: 1.5 }}>Stima basata sulle scadenze di pagamento impostate sui piani di cura.</div>
          {previsionaleMesi.length === 0 && <div style={{ textAlign: 'center', color: C.txl, padding: 30 }}>Nessuna scadenza impostata per il previsionale</div>}
          {previsionaleMesi.map(([mese, importo]) => {
            const [yy, mm] = mese.split('-');
            const max = Math.max(...previsionaleMesi.map((x) => x[1]));
            const pct = max > 0 ? Math.round((importo / max) * 100) : 0;
            return (
              <div key={mese} style={{ marginBottom: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: C.txt }}>{MESI_NOMI[Number(mm) - 1]} {yy}</span>
                  <span style={{ fontSize: 13, fontWeight: 800, color: C.pri }}>{fmt(importo)}</span>
                </div>
                <div style={{ background: C.bg, borderRadius: 5, height: 8, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${pct}%`, background: C.pri, borderRadius: 5 }} />
                </div>
              </div>
            );
          })}
          {previsionaleMesi.length > 0 && (
            <div style={{ marginTop: 14, paddingTop: 12, borderTop: `1px solid ${C.brd}`, display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 13, fontWeight: 800 }}>Totale previsto</span>
              <span style={{ fontSize: 16, fontWeight: 900, color: C.pri }}>{fmt(previsionaleMesi.reduce((s, x) => s + x[1], 0))}</span>
            </div>
          )}
        </Modal>
      )}

      {detailModal === 'esegDaInc' && (
        <Modal title="💰 Eseguito da incassare" onClose={() => setDetailModal(null)} wide>
          <div style={{ background: C.danL, borderRadius: 10, padding: '10px 14px', marginBottom: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: C.dan }}>Prestazioni eseguite non ancora incassate</span>
            <span style={{ fontSize: 20, fontWeight: 900, color: C.dan }}>{fmt(totEsegDaInc)}</span>
          </div>
          {esegDaInc.length === 0 && <div style={{ textAlign: 'center', color: C.txl, padding: 30 }}>Nessuna prestazione eseguita da incassare 🎉</div>}
          {esegDaInc.map(({ paz, voci, tot }) => (
            <Crd key={paz.id} style={{ marginBottom: 10, borderLeft: `3px solid ${C.dan}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <div onClick={() => { setDetailModal(null); onOpenPaz(paz, 'piani'); }} style={{ fontWeight: 700, fontSize: 14, color: C.pri, cursor: 'pointer' }}>{paz.nome} {paz.cognome} ›</div>
                <span style={{ fontWeight: 900, fontSize: 16, color: C.dan }}>{fmt(tot)}</span>
              </div>
              {voci.map((v, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderTop: `1px solid ${C.brd}`, fontSize: 12 }}>
                  <div><span style={{ fontWeight: 600 }}>{v.prestazione}</span>{v.dente ? ` · d.${v.dente}` : ''}<div style={{ fontSize: 10, color: C.txl }}>{v.pianoTitolo}</div></div>
                  <span style={{ fontWeight: 700, color: C.dan }}>{fmt(v.prezzo)}</span>
                </div>
              ))}
            </Crd>
          ))}
        </Modal>
      )}

      {detailModal === 'accNonEseg' && (
        <Modal title="✓ Accettato da eseguire" onClose={() => setDetailModal(null)} wide>
          <div style={{ background: C.purL, borderRadius: 10, padding: '10px 14px', marginBottom: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: C.pur }}>Piani accettati con prestazioni ancora da eseguire</span>
            <span style={{ fontSize: 20, fontWeight: 900, color: C.pur }}>{fmt(totAccNonEseg)}</span>
          </div>
          {accNonEseg.length === 0 && <div style={{ textAlign: 'center', color: C.txl, padding: 30 }}>Nessun piano accettato da eseguire 🎉</div>}
          {accNonEseg.map(({ paz, voci, tot }) => (
            <Crd key={paz.id} style={{ marginBottom: 10, borderLeft: `3px solid ${C.pur}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <div onClick={() => { setDetailModal(null); onOpenPaz(paz, 'piani'); }} style={{ fontWeight: 700, fontSize: 14, color: C.pri, cursor: 'pointer' }}>{paz.nome} {paz.cognome} ›</div>
                <span style={{ fontWeight: 900, fontSize: 16, color: C.pur }}>{fmt(tot)}</span>
              </div>
              {voci.map((v, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderTop: `1px solid ${C.brd}`, fontSize: 12 }}>
                  <div><span style={{ fontWeight: 600 }}>{v.prestazione}</span>{v.dente ? ` · d.${v.dente}` : ''}<div style={{ fontSize: 10, color: C.txl }}>{v.pianoTitolo}</div></div>
                  <span style={{ fontWeight: 700, color: C.pur }}>{fmt(v.prezzo)}</span>
                </div>
              ))}
            </Crd>
          ))}
        </Modal>
      )}

      {detailModal === 'daEseg' && (
        <Modal title="🔧 Totale da eseguire" onClose={() => setDetailModal(null)} wide>
          <div style={{ background: '#FEF3E2', borderRadius: 10, padding: '10px 14px', marginBottom: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: C.war }}>Tutte le prestazioni non ancora eseguite</span>
            <span style={{ fontSize: 20, fontWeight: 900, color: C.war }}>{fmt(totDaEseguire)}</span>
          </div>
          {daEseguire.length === 0 && <div style={{ textAlign: 'center', color: C.txl, padding: 30 }}>Nessuna prestazione da eseguire 🎉</div>}
          {daEseguire.map(({ paz, voci, tot }) => (
            <Crd key={paz.id} style={{ marginBottom: 10, borderLeft: `3px solid ${C.war}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <div onClick={() => { setDetailModal(null); onOpenPaz(paz, 'piani'); }} style={{ fontWeight: 700, fontSize: 14, color: C.pri, cursor: 'pointer' }}>{paz.nome} {paz.cognome} ›</div>
                <span style={{ fontWeight: 900, fontSize: 16, color: C.war }}>{fmt(tot)}</span>
              </div>
              {voci.slice(0, 5).map((v, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderTop: `1px solid ${C.brd}`, fontSize: 12 }}>
                  <div>
                    <span style={{ fontWeight: 600 }}>{v.prestazione}</span>{v.dente ? ` · d.${v.dente}` : ''}
                    <div style={{ fontSize: 10, color: C.txl }}>{v.pianoTitolo} · {v.pianoStato || 'attivo'}</div>
                  </div>
                  <span style={{ fontWeight: 700, color: C.war }}>{fmt(v.prezzo)}</span>
                </div>
              ))}
              {voci.length > 5 && <div style={{ fontSize: 11, color: C.txl, textAlign: 'center', marginTop: 5 }}>+{voci.length - 5} altre prestazioni</div>}
            </Crd>
          ))}
        </Modal>
      )}

      {detailModal === 'daInc' && (
        <Modal title="⚠️ Da incassare — tutti i pazienti" onClose={() => setDetailModal(null)} wide>
          <div style={{ background: C.danL, borderRadius: 10, padding: '10px 14px', marginBottom: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: C.dan }}>Totale da incassare</span>
            <span style={{ fontSize: 20, fontWeight: 900, color: C.dan }}>{fmt(totDaInc)}</span>
          </div>
          {righeDAInc.length === 0 && <div style={{ textAlign: 'center', color: C.txl, padding: 30 }}>Nessun residuo 🎉</div>}
          {righeDAInc.map(({ paz, totDaInc: tot, dovuto, pagato }) => (
            <Crd key={paz.id} style={{ marginBottom: 10, borderLeft: `3px solid ${C.dan}` }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 8 }}>
                <div>
                  <div onClick={() => { setDetailModal(null); onOpenPaz(paz, 'paga'); }} style={{ fontWeight: 700, fontSize: 14, color: C.pri, cursor: 'pointer', textDecoration: 'underline', textDecorationColor: C.pri + '60' }}>{paz.nome} {paz.cognome} ›</div>
                  {paz.telefono && <div style={{ fontSize: 11, color: C.txm }}>📞 {paz.telefono}</div>}
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 18, fontWeight: 900, color: C.dan }}>{fmt(tot)}</div>
                  <div style={{ fontSize: 10, color: C.txm }}>dovuto {fmt(dovuto)} · pagato {fmt(pagato)}</div>
                </div>
              </div>
            </Crd>
          ))}
        </Modal>
      )}

      {detailModal === 'inc' && (
        <Modal title={`✓ Incassate ${anno} — tutti i pazienti`} onClose={() => setDetailModal(null)} wide>
          <div style={{ background: C.sucL, borderRadius: 10, padding: '10px 14px', marginBottom: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: C.suc }}>Totale incassato {anno}</span>
            <span style={{ fontSize: 20, fontWeight: 900, color: C.suc }}>{fmt(totIncAnno)}</span>
          </div>
          {righeInc.length === 0 && <div style={{ textAlign: 'center', color: C.txl, padding: 30 }}>Nessun incasso registrato</div>}
          {righeInc.map(({ paz, totIncAnno: tot }) => {
            const patPay = payments.filter((p) => p.pazienteId === paz.id && p.data && p.data.startsWith(anno));
            return (
              <Crd key={paz.id} style={{ marginBottom: 10, borderLeft: `3px solid ${C.suc}` }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 6 }}>
                  <div>
                    <div onClick={() => { setDetailModal(null); onOpenPaz(paz, 'paga'); }} style={{ fontWeight: 700, fontSize: 14, color: C.pri, cursor: 'pointer', textDecoration: 'underline', textDecorationColor: C.pri + '60' }}>{paz.nome} {paz.cognome} ›</div>
                    {paz.telefono && <div style={{ fontSize: 11, color: C.txm }}>📞 {paz.telefono}</div>}
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 18, fontWeight: 900, color: C.suc }}>{fmt(tot)}</div>
                    <div style={{ fontSize: 10, color: C.txm }}>{patPay.length} pagament{patPay.length === 1 ? 'o' : 'i'}</div>
                  </div>
                </div>
                {patPay.map((p, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderTop: `1px solid ${C.brd}`, fontSize: 12 }}>
                    <span style={{ color: C.txm }}>{fmtD(p.data)} · {p.metodo}</span>
                    <span style={{ fontWeight: 700, color: C.suc }}>{fmt(p.importo)}</span>
                  </div>
                ))}
              </Crd>
            );
          })}
        </Modal>
      )}

      <div style={{ marginBottom: 18 }}>
        <div style={{ fontSize: 20, fontWeight: 800, color: C.txt }}>Buongiorno 👋</div>
        <div style={{ fontSize: 13, color: C.txl, marginTop: 2 }}>{fmtD(t)}</div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
        <Crd style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 12 }}>
          <div style={{ background: C.priL, borderRadius: 10, padding: 9 }}><Ic n="pz" s={20} c={C.pri} /></div>
          <div><div style={{ fontSize: 19, fontWeight: 800 }}>{patients.length}</div><div style={{ fontSize: 11, color: C.txm, fontWeight: 600 }}>Pazienti</div></div>
        </Crd>
        <Crd style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 12 }}>
          <div style={{ background: '#E8FAF9', borderRadius: 10, padding: 9 }}><Ic n="cal" s={20} c={C.acc} /></div>
          <div><div style={{ fontSize: 19, fontWeight: 800 }}>{todayApps.length}</div><div style={{ fontSize: 11, color: C.txm, fontWeight: 600 }}>Oggi</div></div>
        </Crd>
        <Crd style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 12 }}>
          <div style={{ background: C.sucL, borderRadius: 10, padding: 9 }}><Ic n="eur" s={20} c={C.suc} /></div>
          <div><div style={{ fontSize: 17, fontWeight: 800 }}>{fmt(mInc)}</div><div style={{ fontSize: 11, color: C.txm, fontWeight: 600 }}>Incasso mese</div></div>
        </Crd>
        <Crd style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 12 }}>
          <div style={{ background: '#FEF3E2', borderRadius: 10, padding: 9 }}><Ic n="plan" s={20} c={C.war} /></div>
          <div><div style={{ fontSize: 19, fontWeight: 800 }}>{plans.flatMap((pl) => pl.voci.filter((v) => !v.eseguita)).length}</div><div style={{ fontSize: 11, color: C.txm, fontWeight: 600 }}>Da eseguire</div></div>
        </Crd>
      </div>

      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 11, fontWeight: 800, color: C.txm, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>🎛️ Controllo studio</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <div style={{ background: C.purL, borderRadius: 12, padding: 14, border: `1px solid ${C.pur}40`, position: 'relative' }}>
            <div style={{ fontSize: 10, fontWeight: 800, color: C.pur, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>📋 Preventivi</div>
            <div style={{ display: 'flex', gap: 6 }}>
              <div onClick={() => setDetailModal('prevent')} style={{ flex: 1, background: 'rgba(124,58,237,0.08)', borderRadius: 9, padding: '8px 10px', cursor: 'pointer' }}>
                <div style={{ fontSize: 18, fontWeight: 900, color: C.pur }}>{preventiviAttesa.length + preventiviRifiutati.length}</div>
                <div style={{ fontSize: 10, color: C.pur + 'BB' }}>{preventiviAttesa.length} attesa · {preventiviRifiutati.length} rif.</div>
              </div>
              <div onClick={() => setDetailModal('accettati')} style={{ flex: 1, background: 'rgba(46,196,182,0.12)', borderRadius: 9, padding: '8px 10px', cursor: 'pointer' }}>
                <div style={{ fontSize: 16, fontWeight: 900, color: C.acc }}>{fmt(totAccettati)}</div>
                <div style={{ fontSize: 10, color: C.acc + 'BB' }}>{preventiviAccettati.length} accettati ✓</div>
              </div>
            </div>
          </div>
          <div onClick={() => setDetailModal('richiami')} style={{ background: richiamiScaduti.length > 0 ? C.danL : '#FEF3E2', borderRadius: 12, padding: 14, border: `1px solid ${richiamiScaduti.length > 0 ? C.dan : C.war}40`, cursor: 'pointer', position: 'relative' }}>
            <div style={{ position: 'absolute', top: 10, right: 10, fontSize: 14, opacity: 0.5 }}>›</div>
            <div style={{ fontSize: 10, fontWeight: 800, color: richiamiScaduti.length > 0 ? C.dan : C.war, textTransform: 'uppercase', letterSpacing: '0.06em' }}>🔔 Richiami</div>
            <div style={{ fontSize: 22, fontWeight: 900, color: richiamiScaduti.length > 0 ? C.dan : C.war, marginTop: 4 }}>{richiamiTotali}</div>
            <div style={{ fontSize: 11, color: (richiamiScaduti.length > 0 ? C.dan : C.war) + 'BB', marginTop: 2 }}>{richiamiScaduti.length} scaduti · {richiamiProssimi.length} prossimi</div>
          </div>
          <div onClick={() => setDetailModal('scadenze')} style={{ background: scadenzeScadute.length > 0 ? C.danL : C.priL, borderRadius: 12, padding: 14, border: `1px solid ${scadenzeScadute.length > 0 ? C.dan : C.pri}40`, cursor: 'pointer', position: 'relative' }}>
            <div style={{ position: 'absolute', top: 10, right: 10, fontSize: 14, opacity: 0.5 }}>›</div>
            <div style={{ fontSize: 10, fontWeight: 800, color: scadenzeScadute.length > 0 ? C.dan : C.pri, textTransform: 'uppercase', letterSpacing: '0.06em' }}>📆 Scadenze</div>
            <div style={{ fontSize: 22, fontWeight: 900, color: scadenzeScadute.length > 0 ? C.dan : C.pri, marginTop: 4 }}>{fmt(scadenzePagamento.reduce((s, x) => s + x.importo, 0))}</div>
            <div style={{ fontSize: 11, color: (scadenzeScadute.length > 0 ? C.dan : C.pri) + 'BB', marginTop: 2 }}>{scadenzeScadute.length} scadute · {scadenzeProssime.length} prossime</div>
          </div>
          <div onClick={() => setDetailModal('prev')} style={{ background: C.sucL, borderRadius: 12, padding: 14, border: `1px solid ${C.suc}40`, cursor: 'pointer', position: 'relative' }}>
            <div style={{ position: 'absolute', top: 10, right: 10, fontSize: 14, opacity: 0.5 }}>›</div>
            <div style={{ fontSize: 10, fontWeight: 800, color: C.suc, textTransform: 'uppercase', letterSpacing: '0.06em' }}>📈 Previsionale</div>
            <div style={{ fontSize: 22, fontWeight: 900, color: C.suc, marginTop: 4 }}>{fmt(previsionaleMesi.reduce((s, x) => s + x[1], 0))}</div>
            <div style={{ fontSize: 11, color: C.suc + 'BB', marginTop: 2 }}>prossimi 6 mesi</div>
          </div>
          <div onClick={() => setDetailModal('orto')} style={{ background: ortoCambioOggi.length > 0 ? C.danL : C.purL, borderRadius: 12, padding: 14, border: `1px solid ${ortoCambioOggi.length > 0 ? C.dan : C.pur}40`, cursor: 'pointer', position: 'relative', gridColumn: '1 / -1' }}>
            <div style={{ position: 'absolute', top: 10, right: 10, fontSize: 14, opacity: 0.5 }}>›</div>
            <div style={{ fontSize: 10, fontWeight: 800, color: ortoCambioOggi.length > 0 ? C.dan : C.pur, textTransform: 'uppercase', letterSpacing: '0.06em' }}>🦷 Ortodonzia — mascherine</div>
            <div style={{ fontSize: 22, fontWeight: 900, color: ortoCambioOggi.length > 0 ? C.dan : C.pur, marginTop: 4 }}>{pianiOrto.length} pazienti</div>
            <div style={{ fontSize: 11, color: (ortoCambioOggi.length > 0 ? C.dan : C.pur) + 'BB', marginTop: 2 }}>{ortoCambioOggi.length} da cambiare oggi · {ortoAttivi.filter(o=>o.inAttesa).length} da avviare · {ortoAttivi.filter(o=>!o.inAttesa&&!o.cambioScaduto).length} in corso</div>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 8 }}>
        <div onClick={() => setDetailModal('esegDaInc')} style={{ background: C.danL, borderRadius: 12, padding: 14, border: `1px solid ${C.dan}40`, cursor: 'pointer', position: 'relative', userSelect: 'none' }}>
          <div style={{ position: 'absolute', top: 10, right: 10, fontSize: 14, opacity: 0.5 }}>›</div>
          <div style={{ fontSize: 10, fontWeight: 800, color: C.dan, textTransform: 'uppercase', letterSpacing: '0.06em' }}>💰 Eseguito da incassare</div>
          <div style={{ fontSize: 22, fontWeight: 900, color: C.dan, marginTop: 4 }}>{fmt(totEsegDaInc)}</div>
          <div style={{ fontSize: 11, color: C.dan + 'BB', marginTop: 2 }}>{esegDaInc.length} pazienti</div>
        </div>
        <div onClick={() => setDetailModal('inc')} style={{ background: C.sucL, borderRadius: 12, padding: 14, border: `1px solid ${C.suc}40`, cursor: 'pointer', position: 'relative', userSelect: 'none' }}>
          <div style={{ position: 'absolute', top: 10, right: 10, fontSize: 14, opacity: 0.5 }}>›</div>
          <div style={{ fontSize: 10, fontWeight: 800, color: C.suc, textTransform: 'uppercase', letterSpacing: '0.06em' }}>✓ Incassate {anno}</div>
          <div style={{ fontSize: 22, fontWeight: 900, color: C.suc, marginTop: 4 }}>{fmt(totIncAnno)}</div>
          <div style={{ fontSize: 11, color: C.suc + 'BB', marginTop: 2 }}>{nPazInc} pazienti</div>
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
        <div onClick={() => setDetailModal('accNonEseg')} style={{ background: C.purL, borderRadius: 12, padding: 14, border: `1px solid ${C.pur}40`, cursor: 'pointer', position: 'relative', userSelect: 'none' }}>
          <div style={{ position: 'absolute', top: 10, right: 10, fontSize: 14, opacity: 0.5 }}>›</div>
          <div style={{ fontSize: 10, fontWeight: 800, color: C.pur, textTransform: 'uppercase', letterSpacing: '0.06em' }}>✓ Accettato da eseguire</div>
          <div style={{ fontSize: 22, fontWeight: 900, color: C.pur, marginTop: 4 }}>{fmt(totAccNonEseg)}</div>
          <div style={{ fontSize: 11, color: C.pur + 'BB', marginTop: 2 }}>{accNonEseg.length} pazienti</div>
        </div>
        <div onClick={() => setDetailModal('daEseg')} style={{ background: '#FEF3E2', borderRadius: 12, padding: 14, border: `1px solid ${C.war}40`, cursor: 'pointer', position: 'relative', userSelect: 'none' }}>
          <div style={{ position: 'absolute', top: 10, right: 10, fontSize: 14, opacity: 0.5 }}>›</div>
          <div style={{ fontSize: 10, fontWeight: 800, color: C.war, textTransform: 'uppercase', letterSpacing: '0.06em' }}>🔧 Totale da eseguire</div>
          <div style={{ fontSize: 22, fontWeight: 900, color: C.war, marginTop: 4 }}>{fmt(totDaEseguire)}</div>
          <div style={{ fontSize: 11, color: C.war + 'BB', marginTop: 2 }}>{daEseguire.length} pazienti</div>
        </div>
      </div>


      {detailModal === 'orto' && (
        <Modal title="🦷 Ortodonzia — mascherine in corso" onClose={() => setDetailModal(null)} wide>
          {ortoCambioOggi.length > 0 && (
            <>
              <div style={{ fontSize: 11, fontWeight: 800, color: C.dan, textTransform: 'uppercase', marginBottom: 8 }}>⚠️ Cambio mascherina dovuto ({ortoCambioOggi.length})</div>
              {ortoCambioOggi.map(o => (
                <Crd key={o.pl.id} style={{ marginBottom: 8, borderLeft: `3px solid ${C.dan}` }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div onClick={() => { setDetailModal(null); onOpenPaz(o.paz, 'piani'); }} style={{ fontWeight: 700, fontSize: 13, color: C.pri, cursor: 'pointer' }}>{o.paz.nome} {o.paz.cognome} ›</div>
                      <div style={{ fontSize: 11, color: C.txm }}>Masch. {o.cons}/{o.tot||'?'} · prevista {fmtD(o.prossima)}</div>
                    </div>
                    <Bdg ch="scaduta" co={C.dan} />
                  </div>
                </Crd>
              ))}
            </>
          )}
          {ortoAttivi.filter(o => !o.cambioScaduto && !o.inAttesa).length > 0 && (
            <>
              <div style={{ fontSize: 11, fontWeight: 800, color: C.pur, textTransform: 'uppercase', margin: '14px 0 8px' }}>🔄 In corso</div>
              {ortoAttivi.filter(o => !o.cambioScaduto && !o.inAttesa).map(o => {
                const pct = o.tot > 0 ? Math.round(o.cons / o.tot * 100) : 0;
                return (
                  <Crd key={o.pl.id} style={{ marginBottom: 8, borderLeft: `3px solid ${C.pur}` }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                      <div onClick={() => { setDetailModal(null); onOpenPaz(o.paz, 'piani'); }} style={{ fontWeight: 700, fontSize: 13, color: C.pri, cursor: 'pointer' }}>{o.paz.nome} {o.paz.cognome} ›</div>
                      <span style={{ fontSize: 12, fontWeight: 800, color: C.pur }}>{o.cons}/{o.tot||'?'}</span>
                    </div>
                    {o.tot > 0 && <div style={{ background: C.bg, borderRadius: 4, height: 5, overflow: 'hidden', marginBottom: 4 }}><div style={{ height: '100%', width: `${pct}%`, background: C.pur, borderRadius: 4 }} /></div>}
                    <div style={{ fontSize: 10, color: C.txl }}>Prossimo cambio: {o.prossima ? fmtD(o.prossima) : '—'}</div>
                  </Crd>
                );
              })}
            </>
          )}
          {pianiOrto.filter(o => o.inAttesa).length > 0 && (
            <>
              <div style={{ fontSize: 11, fontWeight: 800, color: C.war, textTransform: 'uppercase', margin: '14px 0 8px' }}>🆕 Da avviare</div>
              {pianiOrto.filter(o => o.inAttesa).map(o => (
                <Crd key={o.pl.id} style={{ marginBottom: 8, borderLeft: `3px solid ${C.war}` }}>
                  <div onClick={() => { setDetailModal(null); onOpenPaz(o.paz, 'piani'); }} style={{ fontWeight: 700, fontSize: 13, color: C.pri, cursor: 'pointer' }}>{o.paz.nome} {o.paz.cognome} ›</div>
                  <div style={{ fontSize: 11, color: C.txm }}>Ciclo da {o.tot||'?'} masch. — da avviare</div>
                </Crd>
              ))}
            </>
          )}
          {pianiOrto.filter(o => o.completato).length > 0 && (
            <>
              <div style={{ fontSize: 11, fontWeight: 800, color: C.suc, textTransform: 'uppercase', margin: '14px 0 8px' }}>✓ Completati</div>
              {pianiOrto.filter(o => o.completato).map(o => (
                <Crd key={o.pl.id} style={{ marginBottom: 8, borderLeft: `3px solid ${C.suc}` }}>
                  <div onClick={() => { setDetailModal(null); onOpenPaz(o.paz, 'piani'); }} style={{ fontWeight: 700, fontSize: 13, color: C.pri, cursor: 'pointer' }}>{o.paz.nome} {o.paz.cognome} ›</div>
                  <div style={{ fontSize: 11, color: C.suc }}>Ciclo di {o.tot} mascherine completato ✓</div>
                </Crd>
              ))}
            </>
          )}
          {pianiOrto.length === 0 && <div style={{ textAlign: 'center', color: C.txl, padding: 30 }}>Nessun piano ortodontico attivo</div>}
        </Modal>
      )}

      {/* ── TO-DO STUDIO ── */}
      <Crd style={{ marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: C.txt, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            ✅ Attività da fare {todoAttivi.length > 0 && <span style={{ background: C.dan, color: '#fff', borderRadius: 10, padding: '1px 7px', fontSize: 10, marginLeft: 5 }}>{todoAttivi.length}</span>}
          </div>
          <button onClick={() => setTodoModal(true)} style={{ background: C.pri, border: 'none', borderRadius: 8, padding: '6px 11px', color: '#fff', fontWeight: 700, fontSize: 11, cursor: 'pointer' }}>+ Aggiungi</button>
        </div>
        {todoAttivi.length === 0 && <div style={{ textAlign: 'center', color: C.txl, fontSize: 12, padding: '8px 0' }}>Nessuna attività in sospeso 🎉</div>}
        {todoAttivi.map(todo => (
          <div key={todo.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: `1px solid ${C.brd}` }}>
            <button onClick={() => toggleTodo(todo.id)} style={{ width: 22, height: 22, borderRadius: 6, border: `2px solid ${C.brd}`, background: '#fff', cursor: 'pointer', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: C.txt }}>{todo.testo}</div>
              <div style={{ fontSize: 10, color: C.txl, marginTop: 1 }}>Aggiunto il {fmtD(todo.data)}</div>
            </div>
            <button onClick={() => deleteTodo(todo.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, flexShrink: 0 }}><Ic n="del" s={13} c={C.dan} /></button>
          </div>
        ))}
        {todoFatti.length > 0 && (
          <div style={{ marginTop: 8, paddingTop: 8, borderTop: `1px solid ${C.brd}` }}>
            <div style={{ fontSize: 10, color: C.txl, fontWeight: 700, marginBottom: 5 }}>✓ Completate ({todoFatti.length})</div>
            {todoFatti.slice(0, 3).map(todo => (
              <div key={todo.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '5px 0' }}>
                <button onClick={() => toggleTodo(todo.id)} style={{ width: 22, height: 22, borderRadius: 6, border: `2px solid ${C.suc}`, background: C.suc, cursor: 'pointer', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}>
                  <Ic n="ok" s={11} c="#fff" />
                </button>
                <span style={{ fontSize: 12, color: C.txl, textDecoration: 'line-through', flex: 1 }}>{todo.testo}</span>
                <button onClick={() => deleteTodo(todo.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}><Ic n="del" s={12} c={C.txl} /></button>
              </div>
            ))}
          </div>
        )}
      </Crd>

      {todoModal && (
        <Modal title="+ Nuova attività" onClose={() => setTodoModal(false)}>
          <div style={{ fontSize: 12, color: C.txm, marginBottom: 12 }}>Aggiungi un promemoria, un paziente in sospeso, un ordine da fare, ecc.</div>
          <textarea value={todoInput} onChange={e => setTodoInput(e.target.value)} autoFocus rows={4} placeholder="es. Richiamare Rossi per conferma piano&#10;es. Ordinare viti impianto Nobel 4.3mm&#10;es. Verificare RX Bianchi dente 46" style={{ width: '100%', padding: '11px 12px', border: `1.5px solid ${C.brd}`, borderRadius: 10, fontSize: 13, color: C.txt, background: C.sur, boxSizing: 'border-box', resize: 'vertical', fontFamily: 'inherit' }} />
          <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
            <Btn ch="Annulla" v="sec" onClick={() => setTodoModal(false)} full />
            <Btn ch="Aggiungi" onClick={() => { addTodo(); setTodoModal(false); }} dis={!todoInput.trim()} full />
          </div>
        </Modal>
      )}

      {promemoria.length > 0 && (
        <Crd style={{ marginBottom: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: C.pur, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              📌 Promemoria {promemoriScaduti.length > 0 && <span style={{ background: C.dan, color: '#fff', borderRadius: 10, padding: '1px 7px', fontSize: 10, marginLeft: 5 }}>{promemoriScaduti.length} scaduti</span>}
            </div>
            <span style={{ fontSize: 11, color: C.txl }}>{promemoria.length} totali</span>
          </div>
          {promemoria.slice(0, 5).map(({ paz, ann, richiamo }) => {
            const scaduto = richiamo.data && richiamo.data < t;
            const oggi2 = richiamo.data === t;
            return (
              <div key={ann.id} style={{ padding: '8px 0', borderBottom: `1px solid ${C.brd}`, display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div onClick={() => onOpenPaz(paz, 'info')} style={{ fontWeight: 700, fontSize: 13, color: C.pri, cursor: 'pointer' }}>{paz.nome} {paz.cognome} ›</div>
                  <div style={{ fontSize: 12, color: C.txt, marginTop: 1 }}>{richiamo.testo}</div>
                  <div style={{ fontSize: 10, color: scaduto ? C.dan : oggi2 ? C.war : C.txl, fontWeight: 700, marginTop: 2 }}>
                    {scaduto ? '⚠️ Scaduto · ' : oggi2 ? '📅 Oggi · ' : '📅 '}{fmtD(richiamo.data)}
                  </div>
                </div>
              </div>
            );
          })}
          {promemoria.length > 5 && <div style={{ fontSize: 11, color: C.txl, textAlign: 'center', marginTop: 8 }}>+{promemoria.length - 5} altri promemoria</div>}
        </Crd>
      )}

            <Crd>
        <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 10 }}>Prossimi appuntamenti</div>
        {upcoming.length === 0 && <div style={{ color: C.txl, fontSize: 13, textAlign: 'center', padding: '14px 0' }}>Nessun appuntamento</div>}
        {upcoming.map((a) => {
          const p = patients.find((x) => x.id === a.pazienteId);
          return (
            <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 0', borderBottom: `1px solid ${C.brd}` }}>
              <div style={{ background: C.priL, borderRadius: 8, padding: '5px 7px', textAlign: 'center', minWidth: 40, flexShrink: 0 }}>
                <div style={{ fontSize: 10, color: C.pri, fontWeight: 700 }}>{a.data.slice(8)}/{a.data.slice(5, 7)}</div>
                <div style={{ fontSize: 12, color: C.priD, fontWeight: 800 }}>{a.ora}</div>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p ? `${p.nome} ${p.cognome}` : '—'}</div>
                <div style={{ fontSize: 12, color: C.txm }}>{a.tipo}</div>
              </div>
              <Bdg ch={a.stato} co={a.stato === 'confermato' ? C.suc : C.war} />
            </div>
          );
        })}
      </Crd>
    </div>
  );
}
