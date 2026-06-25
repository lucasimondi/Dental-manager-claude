import React, { useState, useEffect } from 'react';
import { Crd, Bdg, Modal, Ic, Btn } from './ui';
import { C, fmt, fmtD, today } from '../lib/utils';

const SECTIONS_DEFAULT = {
  oggi: true, economico: true, controllo: true, kpi: true, todo: true, appuntamenti: true,
};

export default function Dashboard({ patients, appointments, payments, plans, onOpenPaz }) {
  const t = today();
  const anno = t.slice(0, 4);
  const [detailModal, setDetailModal] = useState(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [sections, setSections] = useState(() => {
    try { return { ...SECTIONS_DEFAULT, ...JSON.parse(localStorage.getItem('dm_dash_sections') || '{}') }; } catch { return SECTIONS_DEFAULT; }
  });
  const [todoList, setTodoList] = useState(() => {
    try { return JSON.parse(localStorage.getItem('dm_todo') || '[]'); } catch { return []; }
  });
  const [todoInput, setTodoInput] = useState('');
  const [todoModal, setTodoModal] = useState(false);

  const toggleSection = (key) => {
    const next = { ...sections, [key]: !sections[key] };
    setSections(next);
    localStorage.setItem('dm_dash_sections', JSON.stringify(next));
  };

  const saveTodo = (list) => { setTodoList(list); try { localStorage.setItem('dm_todo', JSON.stringify(list)); } catch {} };
  const addTodo = () => { if (!todoInput.trim()) return; saveTodo([{ id: Date.now(), testo: todoInput.trim(), fatto: false, data: t }, ...todoList]); setTodoInput(''); };
  const toggleTodo = (id) => saveTodo(todoList.map(x => x.id === id ? { ...x, fatto: !x.fatto } : x));
  const deleteTodo = (id) => saveTodo(todoList.filter(x => x.id !== id));

  // ── CALCOLI ──
  const todayApps = appointments.filter(a => a.data === t).sort((a, b) => a.ora.localeCompare(b.ora));
  const upcoming = [...appointments].filter(a => a.data > t).sort((a, b) => a.data.localeCompare(b.data) || a.ora.localeCompare(b.ora)).slice(0, 8);

  const mInc = payments.filter(p => p.data && p.data.startsWith(t.slice(0, 7))).reduce((s, p) => s + Number(p.importo), 0);
  const aInc = payments.filter(p => p.data && p.data.startsWith(anno)).reduce((s, p) => s + Number(p.importo), 0);
  const hInc = payments.filter(p => p.data === t).reduce((s, p) => s + Number(p.importo), 0);

  const calcPlanTot = (pl) => {
    const sub = pl.voci.reduce((s, v) => s + Number(v.prezzo), 0);
    const sc = Number(pl.sconto) || 0;
    const scontato = pl.scontoTipo === 'pct' ? sub * (sc / 100) : Math.min(sc, sub);
    return Math.max(0, sub - scontato);
  };

  const esegDaInc = patients.map(paz => {
    const patPlans = plans.filter(pl => pl.pazienteId === paz.id);
    const voci = patPlans.flatMap(pl => {
      const subTot = pl.voci.reduce((s, v) => s + Number(v.prezzo), 0);
      const sc = Number(pl.sconto) || 0;
      const scontato = pl.scontoTipo === 'pct' ? subTot * (sc / 100) : Math.min(sc, subTot);
      const fattore = subTot > 0 ? Math.max(0, subTot - scontato) / subTot : 1;
      return pl.voci.filter(v => v.eseguita && !v.incassata).map(v => ({ ...v, pianoTitolo: pl.titolo, prezzoScontato: Number(v.prezzo) * fattore }));
    });
    return { paz, voci, tot: voci.reduce((s, v) => s + v.prezzoScontato, 0) };
  }).filter(x => x.tot > 0).sort((a, b) => b.tot - a.tot);
  const totEsegDaInc = esegDaInc.reduce((s, x) => s + x.tot, 0);

  const accNonEseg = patients.map(paz => {
    const patPlans = plans.filter(pl => pl.pazienteId === paz.id && pl.stato === 'accettato');
    const voci = patPlans.flatMap(pl => pl.voci.filter(v => !v.eseguita).map(v => ({ ...v, pianoTitolo: pl.titolo })));
    return { paz, voci, tot: voci.reduce((s, v) => s + Number(v.prezzo), 0) };
  }).filter(x => x.tot > 0).sort((a, b) => b.tot - a.tot);
  const totAccNonEseg = accNonEseg.reduce((s, x) => s + x.tot, 0);

  const daEseguire = plans.flatMap(pl => pl.voci.filter(v => !v.eseguita)).length;
  const preventiviAccettati = plans.filter(pl => pl.stato === 'accettato');
  const totAccettati = preventiviAccettati.reduce((s, pl) => s + calcPlanTot(pl), 0);
  const preventiviAttesa = plans.filter(pl => (pl.stato || 'attivo') === 'attivo');
  const preventiviRifiutati = plans.filter(pl => pl.stato === 'rifiutato');
  const tassoAccettazione = (preventiviAttesa.length + preventiviAccettati.length + preventiviRifiutati.length) > 0
    ? Math.round(preventiviAccettati.length / (preventiviAttesa.length + preventiviAccettati.length + preventiviRifiutati.length) * 100) : 0;

  const oggiD = new Date(t + 'T12:00');
  const tra30 = new Date(oggiD); tra30.setDate(tra30.getDate() + 30);
  const richiamiScaduti = plans.flatMap(pl => { const paz = patients.find(x => x.id === pl.pazienteId); if (!paz) return []; return pl.voci.filter(v => v.richiamoData && new Date(v.richiamoData + 'T12:00') < oggiD).map(v => ({ paz, pl, v })); });
  const richiamiProssimi = plans.flatMap(pl => { const paz = patients.find(x => x.id === pl.pazienteId); if (!paz) return []; return pl.voci.filter(v => { if (!v.richiamoData) return false; const d = new Date(v.richiamoData + 'T12:00'); return d >= oggiD && d <= tra30; }).map(v => ({ paz, pl, v })); });

  const scadenzePagamento = plans.filter(pl => pl.scadenzaPagamento).map(pl => {
    const paz = patients.find(x => x.id === pl.pazienteId);
    if (!paz) return null;
    return { pl, paz, scadenza: pl.scadenzaPagamento, importo: calcPlanTot(pl) };
  }).filter(Boolean).sort((a, b) => a.scadenza.localeCompare(b.scadenza));
  const scadenzeScadute = scadenzePagamento.filter(s => new Date(s.scadenza + 'T12:00') < oggiD);
  const scadenzeProssime = scadenzePagamento.filter(s => { const d = new Date(s.scadenza + 'T12:00'); return d >= oggiD && d <= tra30; });

  const promemoria = patients.flatMap(paz => (paz.annotazioni || []).filter(a => a.richiamo && !a.richiamo.fatto).map(a => ({ paz, ann: a, richiamo: a.richiamo }))).sort((a, b) => (a.richiamo.data || '').localeCompare(b.richiamo.data || ''));

  // Ortodonzia
  const pianiOrto = plans.filter(pl => pl.ortodonzia?.attivo).map(pl => {
    const paz = patients.find(x => x.id === pl.pazienteId);
    if (!paz) return null;
    const orto = pl.ortodonzia;
    const cons = orto.mascherineConsegnate || 0;
    const tot2 = Number(orto.mascherineTotali) || 0;
    const prossima = (() => { if (!orto.dataConsegnaInizio) return null; const ultima = orto.storico?.length > 0 ? orto.storico[orto.storico.length-1].data : orto.dataConsegnaInizio; const d = new Date(ultima + 'T12:00'); d.setDate(d.getDate() + (orto.frequenzaSettimane || 2) * 7); return d.toISOString().slice(0,10); })();
    return { pl, paz, orto, cons, tot: tot2, completato: tot2 > 0 && cons >= tot2, prossima, cambioScaduto: prossima && prossima <= t, inAttesa: !orto.dataConsegnaInizio };
  }).filter(Boolean);

  // KPI
  const nuoviMese = patients.filter(p => { const d = new Date(Number(p.id)); return !isNaN(d) && d.toISOString().startsWith(t.slice(0, 7)); }).length;
  const mediaValore = plans.length > 0 ? plans.reduce((s, pl) => s + calcPlanTot(pl), 0) / plans.length : 0;
  const prestCount = {}; plans.forEach(pl => pl.voci.forEach(v => { if (v.eseguita) prestCount[v.prestazione] = (prestCount[v.prestazione] || 0) + 1; }));
  const topPrest = Object.entries(prestCount).sort((a, b) => b[1] - a[1])[0];
  const todoAttivi = todoList.filter(x => !x.fatto);
  const todoFatti = todoList.filter(x => x.fatto);

  const MESI = ['Gen','Feb','Mar','Apr','Mag','Giu','Lug','Ago','Set','Ott','Nov','Dic'];

  const SectionToggle = ({ id, label }) => (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', borderBottom: `1px solid ${C.brd}` }}>
      <span style={{ fontSize: 13, fontWeight: 600, color: C.txt }}>{label}</span>
      <button onClick={() => toggleSection(id)} style={{ width: 44, height: 24, borderRadius: 12, background: sections[id] ? C.pri : C.brd, border: 'none', cursor: 'pointer', position: 'relative', transition: 'background 0.2s' }}>
        <div style={{ width: 18, height: 18, borderRadius: '50%', background: '#fff', position: 'absolute', top: 3, left: sections[id] ? 23 : 3, transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }} />
      </button>
    </div>
  );

  const StatCard = ({ label, value, sub, color = C.pri, bg, onClick, urgent }) => (
    <div onClick={onClick} style={{ background: bg || (color + '12'), borderRadius: 12, padding: '12px 14px', border: `1px solid ${color}25`, cursor: onClick ? 'pointer' : 'default', position: 'relative' }}>
      {urgent && <div style={{ position: 'absolute', top: 8, right: 8, width: 8, height: 8, borderRadius: '50%', background: C.dan }} />}
      <div style={{ fontSize: 10, fontWeight: 800, color, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 900, color, lineHeight: 1.1 }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: color + 'AA', marginTop: 3 }}>{sub}</div>}
      {onClick && <div style={{ position: 'absolute', bottom: 8, right: 10, fontSize: 12, color: color + '80' }}>›</div>}
    </div>
  );

  return (
    <div>
      {/* ── SETTINGS MODAL ── */}
      {settingsOpen && (
        <Modal title="⚙️ Personalizza dashboard" onClose={() => setSettingsOpen(false)}>
          <div style={{ fontSize: 12, color: C.txm, marginBottom: 12 }}>Attiva o disattiva le sezioni della dashboard.</div>
          {[['oggi', '🌅 Appuntamenti di oggi'], ['economico', '💰 Pannello economico'], ['controllo', '🎛️ Controllo studio'], ['kpi', '📊 KPI e statistiche'], ['todo', '✅ Attività e promemoria'], ['appuntamenti', '📅 Prossimi appuntamenti']].map(([id, lbl]) => (
            <SectionToggle key={id} id={id} label={lbl} />
          ))}
        </Modal>
      )}

      {/* ── MODALS ── */}
      {detailModal === 'accettati' && (
        <Modal title="✓ Piani accettati" onClose={() => setDetailModal(null)} wide>
          <div style={{ background: '#E8FAF9', borderRadius: 10, padding: '10px 14px', marginBottom: 12, display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ fontWeight: 700, color: C.acc }}>Totale accettato</span>
            <span style={{ fontWeight: 900, fontSize: 18, color: C.acc }}>{fmt(totAccettati)}</span>
          </div>
          {preventiviAccettati.map(pl => { const paz = patients.find(x => x.id === pl.pazienteId); if (!paz) return null; const done = pl.voci.filter(v => v.eseguita).length; const pct = pl.voci.length ? Math.round(done/pl.voci.length*100) : 0; return (
            <Crd key={pl.id} style={{ marginBottom: 8, borderLeft: `3px solid ${C.acc}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                <div style={{ flex: 1 }}>
                  <div onClick={() => { setDetailModal(null); onOpenPaz(paz, 'piani'); }} style={{ fontWeight: 700, color: C.pri, cursor: 'pointer', fontSize: 13 }}>{paz.nome} {paz.cognome} ›</div>
                  <div style={{ fontSize: 11, color: C.txm }}>{pl.titolo}</div>
                  <div style={{ background: C.bg, borderRadius: 3, height: 4, marginTop: 5 }}><div style={{ height: '100%', width: `${pct}%`, background: C.acc, borderRadius: 3 }} /></div>
                  <div style={{ fontSize: 10, color: C.txl, marginTop: 2 }}>{done}/{pl.voci.length} eseguite</div>
                </div>
                <span style={{ fontWeight: 900, color: C.acc }}>{fmt(calcPlanTot(pl))}</span>
              </div>
            </Crd>
          ); })}
        </Modal>
      )}

      {detailModal === 'esegDaInc' && (
        <Modal title="💰 Eseguito da incassare" onClose={() => setDetailModal(null)} wide>
          <div style={{ background: C.danL, borderRadius: 10, padding: '10px 14px', marginBottom: 12, display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ fontWeight: 700, color: C.dan }}>Totale da incassare</span>
            <span style={{ fontWeight: 900, fontSize: 18, color: C.dan }}>{fmt(totEsegDaInc)}</span>
          </div>
          {esegDaInc.map(({ paz, voci, tot }) => (
            <Crd key={paz.id} style={{ marginBottom: 9, borderLeft: `3px solid ${C.dan}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <div onClick={() => { setDetailModal(null); onOpenPaz(paz, 'piani'); }} style={{ fontWeight: 700, color: C.pri, cursor: 'pointer' }}>{paz.nome} {paz.cognome} ›</div>
                <span style={{ fontWeight: 900, color: C.dan }}>{fmt(tot)}</span>
              </div>
              {voci.map((v, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderTop: `1px solid ${C.brd}`, fontSize: 11 }}>
                  <span>{v.prestazione}{v.dente ? ` · d.${v.dente}` : ''}</span>
                  <span style={{ fontWeight: 700, color: C.dan }}>{fmt(v.prezzoScontato)}</span>
                </div>
              ))}
            </Crd>
          ))}
          {esegDaInc.length === 0 && <div style={{ textAlign: 'center', color: C.txl, padding: 30 }}>Nessuna prestazione eseguita da incassare 🎉</div>}
        </Modal>
      )}

      {detailModal === 'accNonEseg' && (
        <Modal title="✓ Accettato da eseguire" onClose={() => setDetailModal(null)} wide>
          <div style={{ background: C.purL, borderRadius: 10, padding: '10px 14px', marginBottom: 12, display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ fontWeight: 700, color: C.pur }}>Totale accettato da eseguire</span>
            <span style={{ fontWeight: 900, fontSize: 18, color: C.pur }}>{fmt(totAccNonEseg)}</span>
          </div>
          {accNonEseg.map(({ paz, voci, tot }) => (
            <Crd key={paz.id} style={{ marginBottom: 9, borderLeft: `3px solid ${C.pur}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <div onClick={() => { setDetailModal(null); onOpenPaz(paz, 'piani'); }} style={{ fontWeight: 700, color: C.pri, cursor: 'pointer' }}>{paz.nome} {paz.cognome} ›</div>
                <span style={{ fontWeight: 900, color: C.pur }}>{fmt(tot)}</span>
              </div>
              {voci.slice(0,4).map((v, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderTop: `1px solid ${C.brd}`, fontSize: 11 }}>
                  <span>{v.prestazione}{v.dente ? ` · d.${v.dente}` : ''}</span>
                  <span style={{ fontWeight: 700, color: C.pur }}>{fmt(v.prezzo)}</span>
                </div>
              ))}
              {voci.length > 4 && <div style={{ fontSize: 10, color: C.txl, textAlign: 'center', marginTop: 4 }}>+{voci.length-4} altre</div>}
            </Crd>
          ))}
        </Modal>
      )}

      {detailModal === 'richiami' && (
        <Modal title="🔔 Richiami" onClose={() => setDetailModal(null)} wide>
          {richiamiScaduti.length > 0 && <><div style={{ fontSize: 11, fontWeight: 800, color: C.dan, textTransform: 'uppercase', marginBottom: 8 }}>⚠️ Scaduti ({richiamiScaduti.length})</div>
          {richiamiScaduti.map((r, i) => <Crd key={i} style={{ marginBottom: 7, borderLeft: `3px solid ${C.dan}` }}><div style={{ display: 'flex', justifyContent: 'space-between' }}><div onClick={() => { setDetailModal(null); onOpenPaz(r.paz, 'info'); }} style={{ fontWeight: 700, color: C.pri, cursor: 'pointer', fontSize: 13 }}>{r.paz.nome} {r.paz.cognome} ›</div><span style={{ fontSize: 11, fontWeight: 700, color: C.dan }}>{fmtD(r.v.richiamoData)}</span></div><div style={{ fontSize: 11, color: C.txm }}>{r.v.richiamoTipo || 'Controllo'}</div></Crd>)}</>}
          {richiamiProssimi.length > 0 && <><div style={{ fontSize: 11, fontWeight: 800, color: C.pur, textTransform: 'uppercase', margin: '12px 0 8px' }}>📅 Prossimi 30gg ({richiamiProssimi.length})</div>
          {richiamiProssimi.map((r, i) => <Crd key={i} style={{ marginBottom: 7, borderLeft: `3px solid ${C.pur}` }}><div style={{ display: 'flex', justifyContent: 'space-between' }}><div onClick={() => { setDetailModal(null); onOpenPaz(r.paz, 'info'); }} style={{ fontWeight: 700, color: C.pri, cursor: 'pointer', fontSize: 13 }}>{r.paz.nome} {r.paz.cognome} ›</div><span style={{ fontSize: 11, fontWeight: 700, color: C.pur }}>{fmtD(r.v.richiamoData)}</span></div></Crd>)}</>}
          {richiamiScaduti.length === 0 && richiamiProssimi.length === 0 && <div style={{ textAlign: 'center', color: C.txl, padding: 30 }}>Nessun richiamo 🎉</div>}
        </Modal>
      )}

      {detailModal === 'scadenze' && (
        <Modal title="📆 Scadenze pagamento" onClose={() => setDetailModal(null)} wide>
          {scadenzeScadute.length > 0 && <><div style={{ fontSize: 11, fontWeight: 800, color: C.dan, textTransform: 'uppercase', marginBottom: 8 }}>⚠️ Scadute</div>{scadenzeScadute.map((s, i) => <Crd key={i} style={{ marginBottom: 7, borderLeft: `3px solid ${C.dan}` }}><div style={{ display: 'flex', justifyContent: 'space-between' }}><div onClick={() => { setDetailModal(null); onOpenPaz(s.paz, 'paga'); }} style={{ fontWeight: 700, color: C.pri, cursor: 'pointer' }}>{s.paz.nome} {s.paz.cognome} ›</div><span style={{ fontWeight: 800, color: C.dan }}>{fmt(s.importo)}</span></div><div style={{ fontSize: 11, color: C.txm }}>{s.pl.titolo} · scad. {fmtD(s.scadenza)}</div></Crd>)}</>}
          {scadenzeProssime.length > 0 && <><div style={{ fontSize: 11, fontWeight: 800, color: C.war, textTransform: 'uppercase', margin: '12px 0 8px' }}>📅 Prossime 30gg</div>{scadenzeProssime.map((s, i) => <Crd key={i} style={{ marginBottom: 7, borderLeft: `3px solid ${C.war}` }}><div style={{ display: 'flex', justifyContent: 'space-between' }}><div onClick={() => { setDetailModal(null); onOpenPaz(s.paz, 'paga'); }} style={{ fontWeight: 700, color: C.pri, cursor: 'pointer' }}>{s.paz.nome} {s.paz.cognome} ›</div><span style={{ fontWeight: 800, color: C.war }}>{fmt(s.importo)}</span></div></Crd>)}</>}
        </Modal>
      )}

      {detailModal === 'orto' && (
        <Modal title="🦷 Ortodonzia" onClose={() => setDetailModal(null)} wide>
          {pianiOrto.filter(o => o.cambioScaduto).length > 0 && <><div style={{ fontSize: 11, fontWeight: 800, color: C.dan, textTransform: 'uppercase', marginBottom: 8 }}>⚠️ Cambio scaduto</div>{pianiOrto.filter(o => o.cambioScaduto).map(o => <Crd key={o.pl.id} style={{ marginBottom: 7, borderLeft: `3px solid ${C.dan}` }}><div onClick={() => { setDetailModal(null); onOpenPaz(o.paz, 'piani'); }} style={{ fontWeight: 700, color: C.pri, cursor: 'pointer' }}>{o.paz.nome} {o.paz.cognome} ›</div><div style={{ fontSize: 11, color: C.txm }}>Masch. {o.cons}/{o.tot||'?'} · prevista {fmtD(o.prossima)}</div></Crd>)}</>}
          {pianiOrto.filter(o => !o.cambioScaduto && !o.inAttesa && !o.completato).map(o => { const pct = o.tot > 0 ? Math.round(o.cons/o.tot*100) : 0; return <Crd key={o.pl.id} style={{ marginBottom: 7, borderLeft: `3px solid ${C.pur}` }}><div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}><div onClick={() => { setDetailModal(null); onOpenPaz(o.paz, 'piani'); }} style={{ fontWeight: 700, color: C.pri, cursor: 'pointer' }}>{o.paz.nome} {o.paz.cognome} ›</div><span style={{ fontWeight: 800, color: C.pur }}>{o.cons}/{o.tot||'?'}</span></div><div style={{ background: C.bg, borderRadius: 3, height: 5 }}><div style={{ height: '100%', width: `${pct}%`, background: C.pur, borderRadius: 3 }} /></div><div style={{ fontSize: 10, color: C.txl, marginTop: 3 }}>Prossimo: {o.prossima ? fmtD(o.prossima) : '—'}</div></Crd>; })}
          {pianiOrto.length === 0 && <div style={{ textAlign: 'center', color: C.txl, padding: 30 }}>Nessun piano ortodontico</div>}
        </Modal>
      )}

      {todoModal && (
        <Modal title="+ Nuova attività" onClose={() => setTodoModal(false)}>
          <textarea value={todoInput} onChange={e => setTodoInput(e.target.value)} autoFocus rows={4} placeholder="es. Richiamare Rossi per RX&#10;es. Ordinare viti Nobel 4.3mm" style={{ width: '100%', padding: '11px 12px', border: `1.5px solid ${C.brd}`, borderRadius: 10, fontSize: 13, color: C.txt, background: C.sur, boxSizing: 'border-box', resize: 'vertical', fontFamily: 'inherit' }} />
          <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
            <Btn ch="Annulla" v="sec" onClick={() => setTodoModal(false)} full />
            <Btn ch="Aggiungi" onClick={() => { addTodo(); setTodoModal(false); }} dis={!todoInput.trim()} full />
          </div>
        </Modal>
      )}

      {/* ── HEADER ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 900, color: C.txt }}>
            {new Date().getHours() < 12 ? '🌅' : new Date().getHours() < 18 ? '☀️' : '🌙'} Buongiorno
          </div>
          <div style={{ fontSize: 12, color: C.txl, marginTop: 1 }}>{new Date().toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</div>
        </div>
        <button onClick={() => setSettingsOpen(true)} style={{ background: C.bg, border: `1px solid ${C.brd}`, borderRadius: 10, padding: '8px 12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, color: C.txm, fontSize: 12, fontWeight: 700 }}>
          <Ic n="set" s={14} c={C.txm} /> Personalizza
        </button>
      </div>

      {/* ── OGGI ── */}
      {sections.oggi && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: C.txm, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>🌅 Oggi — {todayApps.length} appuntament{todayApps.length === 1 ? 'o' : 'i'}</div>
          {todayApps.length === 0 ? (
            <Crd style={{ textAlign: 'center', color: C.txl, padding: '20px 0', fontSize: 13 }}>Nessun appuntamento oggi</Crd>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {todayApps.map(a => {
                const p = patients.find(x => x.id === a.pazienteId);
                const isPast = a.ora < new Date().toTimeString().slice(0, 5);
                return (
                  <Crd key={a.id} style={{ padding: '10px 12px', borderLeft: `4px solid ${isPast ? C.brd : C.pri}`, background: isPast ? '#fafafa' : '#fff' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ background: isPast ? C.bg : C.priL, borderRadius: 8, padding: '4px 8px', textAlign: 'center', flexShrink: 0 }}>
                        <div style={{ fontSize: 14, fontWeight: 900, color: isPast ? C.txl : C.priD }}>{a.ora}</div>
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 700, fontSize: 13, color: isPast ? C.txm : C.txt }}>{p ? `${p.nome} ${p.cognome}` : '—'}</div>
                        <div style={{ fontSize: 11, color: C.txl }}>{a.tipo} · {a.durata}min</div>
                      </div>
                      <Bdg ch={a.stato} co={a.stato === 'confermato' ? C.suc : C.war} />
                    </div>
                  </Crd>
                );
              })}
            </div>
          )}
          {hInc > 0 && <div style={{ marginTop: 8, background: C.sucL, borderRadius: 9, padding: '8px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: C.suc }}>💳 Incassato oggi</span>
            <span style={{ fontSize: 15, fontWeight: 900, color: C.suc }}>{fmt(hInc)}</span>
          </div>}
        </div>
      )}

      {/* ── ECONOMICO ── */}
      {sections.economico && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: C.txm, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>💰 Economico</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
            <StatCard label="Incassato mese" value={fmt(mInc)} color={C.suc} />
            <StatCard label={`Incassato ${anno}`} value={fmt(aInc)} color={C.suc} />
            <StatCard label="Eseguito da incassare" value={fmt(totEsegDaInc)} color={C.dan} onClick={() => setDetailModal('esegDaInc')} urgent={totEsegDaInc > 0} />
            <StatCard label="Accettato da eseguire" value={fmt(totAccNonEseg)} color={C.pur} onClick={() => setDetailModal('accNonEseg')} />
            <StatCard label="Totale accettati" value={fmt(totAccettati)} sub={`${preventiviAccettati.length} piani`} color={C.acc} onClick={() => setDetailModal('accettati')} />
            <StatCard label="Da eseguire" value={daEseguire} sub="prestazioni" color={C.war} />
          </div>
        </div>
      )}

      {/* ── KPI ── */}
      {sections.kpi && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: C.txm, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>📊 Statistiche</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <StatCard label="Pazienti totali" value={patients.length} sub={`+${nuoviMese} questo mese`} color={C.pri} />
            <StatCard label="Tasso accettazione" value={`${tassoAccettazione}%`} sub={`${preventiviAccettati.length}/${preventiviAttesa.length + preventiviAccettati.length + preventiviRifiutati.length} prev.`} color={tassoAccettazione >= 70 ? C.suc : tassoAccettazione >= 40 ? C.war : C.dan} />
            <StatCard label="Valore medio piano" value={fmt(mediaValore)} color={C.pri} />
            {topPrest && <StatCard label="Top prestazione" value={topPrest[0].length > 18 ? topPrest[0].slice(0,16)+'…' : topPrest[0]} sub={`${topPrest[1]}x eseguita`} color={C.acc} />}
          </div>
        </div>
      )}

      {/* ── CONTROLLO STUDIO ── */}
      {sections.controllo && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: C.txm, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>🎛️ Controllo studio</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <div onClick={() => setDetailModal('accettati')} style={{ background: C.priL, borderRadius: 12, padding: 12, border: `1px solid ${C.pri}25`, cursor: 'pointer' }}>
              <div style={{ fontSize: 10, fontWeight: 800, color: C.pri, textTransform: 'uppercase' }}>📋 Preventivi</div>
              <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
                <div style={{ flex: 1, textAlign: 'center' }}>
                  <div style={{ fontSize: 18, fontWeight: 900, color: C.pur }}>{preventiviAttesa.length}</div>
                  <div style={{ fontSize: 9, color: C.txl }}>in attesa</div>
                </div>
                <div style={{ flex: 1, textAlign: 'center', borderLeft: `1px solid ${C.brd}` }}>
                  <div style={{ fontSize: 18, fontWeight: 900, color: C.acc }}>{preventiviAccettati.length}</div>
                  <div style={{ fontSize: 9, color: C.txl }}>accettati</div>
                </div>
                <div style={{ flex: 1, textAlign: 'center', borderLeft: `1px solid ${C.brd}` }}>
                  <div style={{ fontSize: 18, fontWeight: 900, color: C.dan }}>{preventiviRifiutati.length}</div>
                  <div style={{ fontSize: 9, color: C.txl }}>rifiutati</div>
                </div>
              </div>
            </div>
            <div onClick={() => setDetailModal('richiami')} style={{ background: richiamiScaduti.length > 0 ? C.danL : '#FEF3E2', borderRadius: 12, padding: 12, border: `1px solid ${richiamiScaduti.length > 0 ? C.dan : C.war}25`, cursor: 'pointer', position: 'relative' }}>
              {richiamiScaduti.length > 0 && <div style={{ position: 'absolute', top: 8, right: 8, width: 8, height: 8, borderRadius: '50%', background: C.dan }} />}
              <div style={{ fontSize: 10, fontWeight: 800, color: richiamiScaduti.length > 0 ? C.dan : C.war, textTransform: 'uppercase' }}>🔔 Richiami</div>
              <div style={{ fontSize: 22, fontWeight: 900, color: richiamiScaduti.length > 0 ? C.dan : C.war, marginTop: 4 }}>{richiamiScaduti.length + richiamiProssimi.length}</div>
              <div style={{ fontSize: 10, color: C.txl }}>{richiamiScaduti.length} scaduti · {richiamiProssimi.length} prossimi</div>
            </div>
            <div onClick={() => setDetailModal('scadenze')} style={{ background: scadenzeScadute.length > 0 ? C.danL : C.priL, borderRadius: 12, padding: 12, border: `1px solid ${scadenzeScadute.length > 0 ? C.dan : C.pri}25`, cursor: 'pointer', position: 'relative' }}>
              {scadenzeScadute.length > 0 && <div style={{ position: 'absolute', top: 8, right: 8, width: 8, height: 8, borderRadius: '50%', background: C.dan }} />}
              <div style={{ fontSize: 10, fontWeight: 800, color: scadenzeScadute.length > 0 ? C.dan : C.pri, textTransform: 'uppercase' }}>📆 Scadenze</div>
              <div style={{ fontSize: 22, fontWeight: 900, color: scadenzeScadute.length > 0 ? C.dan : C.pri, marginTop: 4 }}>{scadenzePagamento.length}</div>
              <div style={{ fontSize: 10, color: C.txl }}>{scadenzeScadute.length} scadute · {scadenzeProssime.length} prossime</div>
            </div>
            <div onClick={() => setDetailModal('orto')} style={{ background: pianiOrto.some(o => o.cambioScaduto) ? C.danL : C.purL, borderRadius: 12, padding: 12, border: `1px solid ${pianiOrto.some(o => o.cambioScaduto) ? C.dan : C.pur}25`, cursor: 'pointer' }}>
              <div style={{ fontSize: 10, fontWeight: 800, color: pianiOrto.some(o => o.cambioScaduto) ? C.dan : C.pur, textTransform: 'uppercase' }}>🦷 Ortodonzia</div>
              <div style={{ fontSize: 22, fontWeight: 900, color: pianiOrto.some(o => o.cambioScaduto) ? C.dan : C.pur, marginTop: 4 }}>{pianiOrto.filter(o => !o.completato).length}</div>
              <div style={{ fontSize: 10, color: C.txl }}>{pianiOrto.filter(o => o.cambioScaduto).length} da cambiare · {pianiOrto.filter(o => o.inAttesa).length} da avviare</div>
            </div>
          </div>
        </div>
      )}

      {/* ── TODO + PROMEMORIA ── */}
      {sections.todo && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: C.txm, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>✅ Attività e promemoria</div>
          <Crd style={{ marginBottom: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={{ fontSize: 12, fontWeight: 700 }}>Attività {todoAttivi.length > 0 && <span style={{ background: C.dan, color: '#fff', borderRadius: 8, padding: '1px 6px', fontSize: 10 }}>{todoAttivi.length}</span>}</span>
              <button onClick={() => setTodoModal(true)} style={{ background: C.pri, border: 'none', borderRadius: 7, padding: '5px 10px', color: '#fff', fontWeight: 700, fontSize: 11, cursor: 'pointer' }}>+ Aggiungi</button>
            </div>
            {todoAttivi.length === 0 && <div style={{ fontSize: 12, color: C.txl, textAlign: 'center', padding: '8px 0' }}>Nessuna attività in sospeso 🎉</div>}
            {todoAttivi.slice(0, 5).map(todo => (
              <div key={todo.id} style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '7px 0', borderBottom: `1px solid ${C.brd}` }}>
                <button onClick={() => toggleTodo(todo.id)} style={{ width: 20, height: 20, borderRadius: 5, border: `2px solid ${C.brd}`, background: '#fff', cursor: 'pointer', flexShrink: 0, padding: 0 }} />
                <span style={{ flex: 1, fontSize: 12, fontWeight: 600 }}>{todo.testo}</span>
                <button onClick={() => deleteTodo(todo.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2 }}><Ic n="x" s={11} c={C.dan} /></button>
              </div>
            ))}
            {todoFatti.length > 0 && <div style={{ marginTop: 6, fontSize: 10, color: C.txl, textAlign: 'center' }}>{todoFatti.length} completate</div>}
          </Crd>
          {promemoria.length > 0 && (
            <Crd>
              <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 8 }}>📌 Promemoria {promemoria.filter(p => p.richiamo.data < t).length > 0 && <span style={{ background: C.dan, color: '#fff', borderRadius: 8, padding: '1px 6px', fontSize: 10 }}>{promemoria.filter(p => p.richiamo.data < t).length} scaduti</span>}</div>
              {promemoria.slice(0, 4).map(({ paz, ann, richiamo }, i) => (
                <div key={i} style={{ padding: '6px 0', borderBottom: `1px solid ${C.brd}`, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ flex: 1 }}>
                    <div onClick={() => onOpenPaz(paz, 'info')} style={{ fontSize: 12, fontWeight: 700, color: C.pri, cursor: 'pointer' }}>{paz.nome} {paz.cognome} ›</div>
                    <div style={{ fontSize: 11, color: C.txm }}>{richiamo.testo}</div>
                  </div>
                  <span style={{ fontSize: 10, fontWeight: 700, color: richiamo.data < t ? C.dan : C.pur, flexShrink: 0 }}>{fmtD(richiamo.data)}</span>
                </div>
              ))}
              {promemoria.length > 4 && <div style={{ fontSize: 11, color: C.txl, textAlign: 'center', marginTop: 6 }}>+{promemoria.length-4} altri</div>}
            </Crd>
          )}
        </div>
      )}

      {/* ── PROSSIMI APPUNTAMENTI ── */}
      {sections.appuntamenti && upcoming.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: C.txm, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>📅 Prossimi appuntamenti</div>
          <Crd>
            {upcoming.map((a, i) => {
              const p = patients.find(x => x.id === a.pazienteId);
              return (
                <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: i < upcoming.length-1 ? `1px solid ${C.brd}` : 'none' }}>
                  <div style={{ background: C.priL, borderRadius: 7, padding: '4px 7px', textAlign: 'center', minWidth: 44, flexShrink: 0 }}>
                    <div style={{ fontSize: 9, color: C.pri, fontWeight: 700 }}>{a.data.slice(8)}/{a.data.slice(5,7)}</div>
                    <div style={{ fontSize: 12, fontWeight: 800, color: C.priD }}>{a.ora}</div>
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p ? `${p.nome} ${p.cognome}` : '—'}</div>
                    <div style={{ fontSize: 11, color: C.txm }}>{a.tipo}</div>
                  </div>
                  <Bdg ch={a.stato} co={a.stato === 'confermato' ? C.suc : C.war} />
                </div>
              );
            })}
          </Crd>
        </div>
      )}
    </div>
  );
}
