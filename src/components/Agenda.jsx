import React, { useState, useRef, useEffect } from 'react';
import { Btn, Crd, Fld, Inp, Sel, Txt, Modal, Toast, Bdg, Ic, PhStr } from './ui';
import WaAction, { apriWaDiretto } from './ui/WaAction.jsx';
import { C, uid, fmtD, today, DEF_APP_TYPES } from '../lib/utils';

const WD_SHORT = ['Dom', 'Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab'];
const MESI = ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno', 'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'];
const toISO = (d) => d.toISOString().slice(0, 10);
const startOfWeek = (d) => {
  const dt = new Date(d + 'T12:00');
  const day = dt.getDay();
  dt.setDate(dt.getDate() + (day === 0 ? -6 : 1 - day));
  return dt;
};

function GridView({ days, slots, slotH, slotMin, oraInizio, appointments, setAppointments, patients, getColore, appPosition, apriNuovo, apriEdit, apriWA, selDay, setSelDay, setView, today: t, features }) {
  const containerRef = useRef(null); // unico scroll container
  const resizeRef = useRef(null);
  const [now, setNow] = useState(new Date());
  const [resizing, setResizing] = useState(null); // { id, startY, startDurata }

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    // Scroll iniziale alle 08:00
    const top8 = (8 * 60 / slotMin) * slotH;
    if (containerRef.current) containerRef.current.scrollTop = top8;
  }, [slotH, slotMin]);

  // Resize mouse handlers
  useEffect(() => {
    if (!resizing) return;
    const onMove = (e) => {
      const dy = (e.clientY || e.touches?.[0]?.clientY || 0) - resizing.startY;
      const deltaMins = Math.round(dy / slotH * slotMin / slotMin) * slotMin;
      const newDurata = Math.max(slotMin, resizing.startDurata + deltaMins);
      setAppointments(prev => prev.map(a => a.id === resizing.id ? { ...a, durata: newDurata } : a));
    };
    const onUp = () => setResizing(null);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    window.addEventListener('touchmove', onMove, { passive: true });
    window.addEventListener('touchend', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      window.removeEventListener('touchmove', onMove);
      window.removeEventListener('touchend', onUp);
    };
  }, [resizing, slotH, slotMin]);



  const nowMin = now.getHours() * 60 + now.getMinutes();
  const nowTop = (nowMin / slotMin) * slotH;
  const showNowLine = true;

  return (
    <div style={{ display: 'flex', flex: 1, overflow: 'hidden', border: `1px solid ${C.brd}`, borderRadius: 12, background: '#fff', minHeight: 0, boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

        {/* Header fisso: angolo vuoto + giorni */}
        <div style={{ display: 'flex', borderBottom: `1.5px solid ${C.brd}`, height: 44, flexShrink: 0, background: '#fafbfc' }}>
          <div style={{ width: 46, flexShrink: 0, borderRight: `1.5px solid ${C.brd}` }} />
          {days.map((d, di) => {
            const ds = toISO(d);
            const isToday = ds === t;
            const isSelected = ds === selDay;
            const isWeekend = d.getDay() === 0 || d.getDay() === 6;
            return (
              <div key={di} onClick={() => { setSelDay(ds); if (days.length > 1) setView('giorno'); }} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2, cursor: 'pointer', background: isSelected && days.length > 1 ? C.priL : isWeekend ? '#f5f5f7' : 'transparent', borderLeft: di > 0 ? `1.5px solid ${C.brd}` : 'none' }}>
                <div style={{ fontSize: 9, fontWeight: 700, color: isToday ? C.pri : isWeekend ? C.txl : C.txm, textTransform: 'uppercase', letterSpacing: '0.03em' }}>{WD_SHORT[d.getDay()]}</div>
                <div style={{ fontSize: 15, fontWeight: 900, color: isToday ? '#fff' : isSelected ? C.pri : C.txt, background: isToday ? C.pri : 'transparent', borderRadius: '50%', width: 25, height: 25, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{d.getDate()}</div>
              </div>
            );
          })}
        </div>

        {/* UN SOLO contenitore scrollabile — ore sticky a sinistra */}
        <div ref={containerRef} style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', WebkitOverflowScrolling: 'touch', position: 'relative' }}>
          <div style={{ display: 'flex', minHeight: slots.length * slotH }}>

            {/* Colonna ore — sticky */}
            <div style={{ width: 46, flexShrink: 0, borderRight: `1.5px solid ${C.brd}`, background: '#fafbfc', position: 'sticky', left: 0, zIndex: 3 }}>
              {slots.map((slot) => {
                const isHour = slot.endsWith(':00');
                return (
                  <div key={slot} style={{ height: slotH, borderBottom: `1px solid ${isHour ? C.brd : C.brd + '40'}`, display: 'flex', alignItems: 'flex-start', justifyContent: 'flex-end', paddingRight: 5, paddingTop: 2, boxSizing: 'border-box' }}>
                    <span style={{ fontSize: isHour ? 9.5 : 8, color: isHour ? C.txm : C.txl, fontWeight: isHour ? 800 : 500 }}>{isHour ? slot : ''}</span>
                  </div>
                );
              })}
            </div>

            {/* Griglia giorni */}
            <div style={{ flex: 1, display: 'flex', position: 'relative' }}>
          {days.map((d, di) => {
            const ds = toISO(d);
            const dayApps = appointments.filter(a => a.data === ds).sort((a, b) => a.ora.localeCompare(b.ora));
            const isToday = ds === t;
            const isWeekend = d.getDay() === 0 || d.getDay() === 6;
            return (
              <div key={di} style={{ flex: 1, position: 'relative', borderLeft: di > 0 ? `1.5px solid ${C.brd}` : 'none', background: isWeekend ? '#fcfcfd' : isToday ? '#fafdff' : '#fff' }}>
                {slots.map((slot) => {
                  const isHour = slot.endsWith(':00');
                  return (
                    <div key={slot} onClick={() => apriNuovo(ds, slot)} style={{ height: slotH, borderBottom: `1px solid ${isHour ? C.brd + '60' : C.brd + '25'}`, cursor: 'pointer', boxSizing: 'border-box' }}
                      onMouseEnter={e => e.currentTarget.style.background = C.priL + '70'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'} />
                  );
                })}
                {isToday && showNowLine && (
                  <div style={{ position: 'absolute', top: nowTop, left: di === 0 ? -6 : 0, right: 0, zIndex: 5, pointerEvents: 'none', display: 'flex', alignItems: 'center' }}>
                    {di === 0 && <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#E63946', flexShrink: 0 }} />}
                    <div style={{ flex: 1, height: 1.5, background: '#E63946' }} />
                  </div>
                )}
                {dayApps.map(a => {
                  const { top, height } = appPosition(a);
                  if (top < 0) return null;
                  const p = patients.find(x => x.id === a.pazienteId);
                  const co = getColore(a);
                  const isBeingResized = resizing?.id === a.id;
                  return (
                    <div key={a.id} style={{ position: 'absolute', top, left: 2, right: 2, height, background: co, borderRadius: 5, overflow: 'hidden', zIndex: isBeingResized ? 10 : 2, borderLeft: `3px solid ${co}DD`, boxShadow: isBeingResized ? '0 4px 12px rgba(0,0,0,0.3)' : '0 1px 3px rgba(0,0,0,0.15)', userSelect: 'none' }}>
                      {/* Contenuto appuntamento */}
                      <div onClick={e => { if (!isBeingResized) { e.stopPropagation(); apriEdit(a); } }} style={{ padding: '2px 5px', cursor: 'pointer', paddingBottom: 12 }}>
                        <div style={{ fontSize: 10, fontWeight: 800, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.ora} {p ? `${p.cognome}` : '—'}</div>
                        {height > 32 && <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.9)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.tipo}</div>}
                        {height > 48 && <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.7)' }}>{a.durata} min</div>}
                      </div>
                      {/* WA button */}
                      <WaAction tel={p?.telefono} features={features} variant="chip" onClick={() => apriWA(a)} style={{ position: 'absolute', top: 2, right: 2, zIndex: 3 }} />
                      {/* RESIZE HANDLE */}
                      <div
                        onMouseDown={e => { e.stopPropagation(); e.preventDefault(); setResizing({ id: a.id, startY: e.clientY, startDurata: Number(a.durata) }); }}
                        onTouchStart={e => { e.stopPropagation(); setResizing({ id: a.id, startY: e.touches[0].clientY, startDurata: Number(a.durata) }); }}
                        style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 12, cursor: 'ns-resize', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.15)', borderBottomLeftRadius: 5, borderBottomRightRadius: 5 }}>
                        <div style={{ width: 20, height: 2, background: 'rgba(255,255,255,0.6)', borderRadius: 1 }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Agenda({ patients, appointments, setAppointments, appTypes, initPazienteId, onClearInitPaz, templates, features }) {
  const tipiList = appTypes?.length ? appTypes : DEF_APP_TYPES;

  const [oraInizio, setOraInizio] = useState(() => { try { return Number(localStorage.getItem('ag_oraInizio') || 8); } catch { return 8; } });
  const [oraFine, setOraFine] = useState(() => { try { return Number(localStorage.getItem('ag_oraFine') || 20); } catch { return 20; } });
  const [slotMin, setSlotMin] = useState(() => { try { return Number(localStorage.getItem('ag_slotMin') || 30); } catch { return 30; } });
  const [tmpI, setTmpI] = useState(8);
  const [tmpF, setTmpF] = useState(20);
  const [tmpS, setTmpS] = useState(30);
  const [view, setView] = useState('settimana');
  const [selDay, setSelDay] = useState(today());
  const [modal, setModal] = useState(false);
  const [pazSearch, setPazSearch] = useState('');
  const [toast, setToast] = useState('');
  const [editApp, setEditApp] = useState(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [vd, setVd] = useState(new Date());
  const [form, setForm] = useState({ pazienteId: '', data: today(), ora: '09:00', durata: 30, tipo: tipiList[0]?.nome || 'Visita', colore: tipiList[0]?.colore || C.pri, note: '', stato: 'confermato' });
  const [waModal, setWaModal] = useState(null);
  const [waMsg, setWaMsg] = useState('');
  const [waTplId, setWaTplId] = useState('');

  const F = (f) => setForm(p => ({ ...p, ...f }));

  useEffect(() => {
    if (initPazienteId) {
      setForm(f => ({ ...f, pazienteId: String(initPazienteId) }));
      setModal(true);
      if (onClearInitPaz) onClearInitPaz();
    }
  }, [initPazienteId]);

  // slotH calcolato per far stare 8-20 (12 ore) nello schermo mobile (~700px - 180px header)
  const availH = typeof window !== 'undefined' ? Math.max(400, window.innerHeight - 180) : 520;
  const slotH = Math.floor(availH / (12 * 60 / slotMin));
  // Griglia sempre 00:00 - 24:00
  const slots = [];
  for (let h = 0; h < 24; h++) {
    for (let m = 0; m < 60; m += slotMin) {
      slots.push(`${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`);
    }
  }

  const getColore = (a) => a.colore || tipiList.find(t => t.nome === a.tipo)?.colore || C.pri;

  const appPosition = (a) => {
    const [ah, am] = a.ora.split(':').map(Number);
    const min = ah * 60 + am; // dalla mezzanotte
    const top = (min / slotMin) * slotH;
    const height = Math.max((Number(a.durata) / slotMin) * slotH - 2, slotH * 0.6);
    return { top, height };
  };

  const weekStart = startOfWeek(selDay);
  const weekDays = Array.from({ length: 7 }, (_, i) => { const d = new Date(weekStart); d.setDate(d.getDate() + i); return d; });
  const t = today();

  const apriNuovo = (data, ora) => {
    setPazSearch('');
    setEditApp(null);
    setForm({ pazienteId: '', data: data || selDay, ora: ora || '09:00', durata: 30, tipo: tipiList[0]?.nome || 'Visita', colore: tipiList[0]?.colore || C.pri, note: '', stato: 'confermato' });
    setModal(true);
  };

  const apriEdit = (a) => {
    setEditApp(a);
    setPazSearch('');
    setForm({ pazienteId: String(a.pazienteId), data: a.data, ora: a.ora, durata: a.durata, tipo: a.tipo, colore: a.colore || C.pri, note: a.note || '', stato: a.stato || 'confermato' });
    setModal(true);
  };

  const apriWA = (a) => {
    const p = patients.find(x => x.id === a.pazienteId);
    if (!p?.telefono) { alert('Nessun telefono per questo paziente'); return; }
    const defMsg = `Gentile ${p.nome},\nricordiamo il suo appuntamento:\n📅 ${fmtD(a.data)} alle ${a.ora}\n🦷 ${a.tipo}\nPer variazioni contattarci entro 24h. Grazie!`;
    setWaModal(a); setWaTplId(''); setWaMsg(defMsg);
  };

  const sendWA = () => {
    if (!waModal) return;
    const p = patients.find(x => x.id === waModal.pazienteId);
    if (!p?.telefono) return;
    apriWaDiretto(p.telefono, waMsg);
    setWaModal(null);
  };

  const selTplWA = (id) => {
    setWaTplId(id);
    if (!id || !waModal) return;
    const p = patients.find(x => x.id === waModal.pazienteId);
    const tpl = templates?.find(tt => String(tt.id) === String(id));
    if (tpl && p) setWaMsg(tpl.testo.replace(/{nome}/g, `${p.nome} ${p.cognome}`).replace(/{data}/g, fmtD(waModal.data)).replace(/{ora}/g, waModal.ora).replace(/{tipo}/g, waModal.tipo));
  };

  const save = () => {
    if (!form.pazienteId) return;
    if (editApp) {
      setAppointments(p => p.map(a => a.id === editApp.id ? { ...a, ...form, pazienteId: Number(form.pazienteId), durata: Number(form.durata) } : a));
      setToast('Aggiornato ✓');
    } else {
      setAppointments(p => [...p, { ...form, id: uid(), pazienteId: Number(form.pazienteId), durata: Number(form.durata) }]);
      setToast('Salvato ✓');
    }
    setModal(false);
  };

  const del = (id) => { if (confirm('Eliminare?')) setAppointments(p => p.filter(a => a.id !== id)); };

  const saveSettings = () => {
    if (tmpI >= tmpF) return;
    setOraInizio(tmpI); setOraFine(tmpF); setSlotMin(tmpS);
    localStorage.setItem('ag_oraInizio', tmpI);
    localStorage.setItem('ag_oraFine', tmpF);
    localStorage.setItem('ag_slotMin', tmpS);
    setSettingsOpen(false);
  };

  const navGiorno = (n) => { const d = new Date(selDay + 'T12:00'); d.setDate(d.getDate() + n); setSelDay(toISO(d)); };
  const navSettimana = (n) => { const d = new Date(selDay + 'T12:00'); d.setDate(d.getDate() + n * 7); setSelDay(toISO(d)); };

  const gridProps = { slots, slotH, slotMin, oraInizio, appointments, setAppointments, patients, getColore, appPosition, apriNuovo, apriEdit, apriWA, selDay, setSelDay, setView, today: t };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 130px)' }}>
      {toast && <Toast msg={toast} onDone={() => setToast('')} />}

      {/* HEADER */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, flexShrink: 0 }}>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 6 }}>
          {view === 'giorno' && <>
            <button onClick={() => navGiorno(-1)} style={{ background: C.bg, border: 'none', borderRadius: 7, width: 30, height: 30, cursor: 'pointer', fontSize: 16 }}>‹</button>
            <span style={{ fontWeight: 700, fontSize: 13, minWidth: 120 }}>{fmtD(selDay)}</span>
            <button onClick={() => navGiorno(1)} style={{ background: C.bg, border: 'none', borderRadius: 7, width: 30, height: 30, cursor: 'pointer', fontSize: 16 }}>›</button>
            {selDay !== t && <button onClick={() => setSelDay(t)} style={{ background: C.priL, border: 'none', borderRadius: 7, padding: '4px 8px', color: C.pri, fontWeight: 700, fontSize: 10, cursor: 'pointer' }}>Oggi</button>}
          </>}
          {view === 'settimana' && <>
            <button onClick={() => navSettimana(-1)} style={{ background: C.bg, border: 'none', borderRadius: 7, width: 30, height: 30, cursor: 'pointer', fontSize: 16 }}>‹</button>
            <span style={{ fontWeight: 700, fontSize: 12 }}>{weekDays[0].getDate()} {MESI[weekDays[0].getMonth()].slice(0,3)} – {weekDays[6].getDate()} {MESI[weekDays[6].getMonth()].slice(0,3)}</span>
            <button onClick={() => navSettimana(1)} style={{ background: C.bg, border: 'none', borderRadius: 7, width: 30, height: 30, cursor: 'pointer', fontSize: 16 }}>›</button>
            <button onClick={() => setSelDay(t)} style={{ background: C.priL, border: 'none', borderRadius: 7, padding: '4px 8px', color: C.pri, fontWeight: 700, fontSize: 10, cursor: 'pointer' }}>Oggi</button>
          </>}
          {view === 'mese' && <span style={{ fontWeight: 800, fontSize: 16 }}>Agenda</span>}
        </div>
        <button onClick={() => { setTmpI(oraInizio); setTmpF(oraFine); setTmpS(slotMin); setSettingsOpen(true); }} style={{ background: C.bg, border: `1px solid ${C.brd}`, borderRadius: 8, padding: '6px 8px', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
          <Ic n="set" s={15} c={C.txm} />
        </button>
        <Btn ch="+ Nuovo" onClick={() => apriNuovo()} />
      </div>

      {/* TAB SWITCHER */}
      <div style={{ display: 'flex', background: C.bg, borderRadius: 9, border: `1px solid ${C.brd}`, marginBottom: 10, overflow: 'hidden', flexShrink: 0 }}>
        {[['giorno','Giorno'],['settimana','Settimana'],['mese','Mese']].map(([id, lbl]) => (
          <button key={id} onClick={() => setView(id)} style={{ flex: 1, padding: '9px 0', border: 'none', background: view === id ? C.pri : 'transparent', color: view === id ? '#fff' : C.txm, fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>{lbl}</button>
        ))}
      </div>

      {/* VIEWS */}
      {view === 'giorno' && <GridView days={[new Date(selDay + 'T12:00')]} {...gridProps} features={features} />}
      {view === 'settimana' && <GridView days={weekDays} {...gridProps} features={features} />}
      {view === 'mese' && (() => {
        const K = vd.getFullYear(), mese = vd.getMonth();
        const primo = new Date(K, mese, 1).getDay();
        const giorni = new Date(K, mese + 1, 0).getDate();
        const celle = Array(primo === 0 ? 6 : primo - 1).fill(null).concat(Array.from({ length: giorni }, (_, i) => i + 1));
        return (
          <div>
            <Crd style={{ marginBottom: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                <button onClick={() => setVd(new Date(vd.getFullYear(), vd.getMonth() - 1, 1))} style={{ background: C.bg, border: 'none', borderRadius: 7, width: 32, height: 32, cursor: 'pointer', fontSize: 17 }}>‹</button>
                <span style={{ fontWeight: 700 }}>{MESI[mese]} {K}</span>
                <button onClick={() => setVd(new Date(vd.getFullYear(), vd.getMonth() + 1, 1))} style={{ background: C.bg, border: 'none', borderRadius: 7, width: 32, height: 32, cursor: 'pointer', fontSize: 17 }}>›</button>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 2, marginBottom: 4 }}>
                {['L','M','M','G','V','S','D'].map((d, i) => <div key={i} style={{ textAlign: 'center', fontSize: 10, fontWeight: 700, color: C.txm, padding: '2px 0' }}>{d}</div>)}
                {celle.map((g, i) => {
                  if (!g) return <div key={i} />;
                  const ds = `${K}-${String(mese+1).padStart(2,'0')}-${String(g).padStart(2,'0')}`;
                  const cnt = appointments.filter(a => a.data === ds).length;
                  const isSel = ds === selDay, isTod = ds === t;
                  return (
                    <div key={i} onClick={() => { setSelDay(ds); setView('giorno'); }} style={{ textAlign: 'center', padding: '5px 2px', borderRadius: 7, cursor: 'pointer', background: isSel ? C.pri : isTod ? C.priL : 'transparent', color: isSel ? '#fff' : isTod ? C.pri : C.txt, fontWeight: isSel || isTod ? 700 : 400, fontSize: 12, position: 'relative', minHeight: 28 }}>
                      {g}
                      {cnt > 0 && <div style={{ display: 'flex', gap: 1, justifyContent: 'center', position: 'absolute', bottom: 1, left: '50%', transform: 'translateX(-50%)' }}>
                        {Array.from({ length: Math.min(cnt, 3) }, (_, j) => <div key={j} style={{ width: 4, height: 4, borderRadius: '50%', background: isSel ? '#fff' : C.pri }} />)}
                      </div>}
                    </div>
                  );
                })}
              </div>
            </Crd>
            <div style={{ fontSize: 12, fontWeight: 700, color: C.txm, marginBottom: 8 }}>{fmtD(selDay)}</div>
            {appointments.filter(a => a.data === selDay).sort((a, b) => a.ora.localeCompare(b.ora)).map(a => {
              const p = patients.find(x => x.id === a.pazienteId);
              const co = getColore(a);
              return (
                <Crd key={a.id} style={{ marginBottom: 8, borderLeft: `4px solid ${co}`, cursor: 'pointer' }} onClick={() => apriEdit(a)}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ background: co + '20', borderRadius: 7, padding: '4px 7px', textAlign: 'center', flexShrink: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 900, color: co }}>{a.ora}</div>
                      <div style={{ fontSize: 9, color: co }}>{a.durata}m</div>
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 700 }}>{p ? `${p.nome} ${p.cognome}` : '—'}</div>
                      <div style={{ fontSize: 11, color: C.txm }}>{a.tipo}</div>
                    </div>
                    <div style={{ display: 'flex', gap: 5 }}>
                      <WaAction tel={p?.telefono} features={features} variant="icon" onClick={() => apriWA(a)} />
                      <button onClick={e => { e.stopPropagation(); del(a.id); }} style={{ background: C.danL, border: 'none', borderRadius: 6, padding: 6, cursor: 'pointer', display: 'flex' }}><Ic n="del" s={13} c={C.dan} /></button>
                    </div>
                  </div>
                </Crd>
              );
            })}
            {appointments.filter(a => a.data === selDay).length === 0 && <div style={{ textAlign: 'center', color: C.txl, padding: 20, fontSize: 13 }}>Nessun appuntamento — tocca un giorno per aggiungerne</div>}
          </div>
        );
      })()}

      {/* MODAL WA */}
      {waModal && (
        <Modal title="💬 Invia WhatsApp" onClose={() => setWaModal(null)}>
          {(() => { const p = patients.find(x => x.id === waModal.pazienteId); return (
            <div style={{ background: C.priL, borderRadius: 9, padding: '9px 12px', marginBottom: 12 }}>
              <div style={{ fontWeight: 700, fontSize: 13 }}>{p?.nome} {p?.cognome}</div>
              <div style={{ fontSize: 11, color: C.txm }}>📅 {fmtD(waModal.data)} · {waModal.ora} · {waModal.tipo}</div>
              {p?.telefono && <div style={{ fontSize: 11, color: C.txl }}>📱 {p.telefono}</div>}
            </div>
          ); })()}
          {templates?.length > 0 && (
            <Fld label="Template (opzionale)">
              <Sel value={waTplId} onChange={e => selTplWA(e.target.value)}>
                <option value="">Messaggio personalizzato</option>
                {templates.map(tt => <option key={tt.id} value={tt.id}>{tt.nome}</option>)}
              </Sel>
            </Fld>
          )}
          <Fld label="Messaggio"><Txt value={waMsg} onChange={e => setWaMsg(e.target.value)} rows={6} /></Fld>
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <Btn ch="Annulla" v="sec" onClick={() => setWaModal(null)} full />
            <Btn ch="Apri WhatsApp" onClick={sendWA} dis={!waMsg} full />
          </div>
        </Modal>
      )}

      {/* MODAL IMPOSTAZIONI */}
      {settingsOpen && (
        <Modal title="⚙️ Impostazioni agenda" onClose={() => setSettingsOpen(false)}>
          <div style={{ fontSize: 12, color: C.txm, marginBottom: 14 }}>Le impostazioni vengono salvate sul dispositivo.</div>
          <Fld label="Ora inizio giornata">
            <Sel value={tmpI} onChange={e => setTmpI(Number(e.target.value))}>
              {Array.from({ length: 16 }, (_, i) => i + 6).map(h => <option key={h} value={h}>{String(h).padStart(2,'0')}:00</option>)}
            </Sel>
          </Fld>
          <Fld label="Ora fine giornata">
            <Sel value={tmpF} onChange={e => setTmpF(Number(e.target.value))}>
              {Array.from({ length: 16 }, (_, i) => i + 6).map(h => <option key={h} value={h}>{String(h).padStart(2,'0')}:00</option>)}
            </Sel>
          </Fld>
          <Fld label="Dimensione slot">
            <Sel value={tmpS} onChange={e => setTmpS(Number(e.target.value))}>
              <option value={15}>15 minuti</option>
              <option value={30}>30 minuti (consigliato)</option>
              <option value={60}>60 minuti</option>
            </Sel>
          </Fld>
          {tmpI >= tmpF && <div style={{ background: C.danL, borderRadius: 8, padding: '8px 12px', marginBottom: 8, fontSize: 12, color: C.dan, fontWeight: 700 }}>⚠️ L'ora di inizio deve essere prima dell'ora di fine</div>}
          <div style={{ background: C.bg, borderRadius: 9, padding: '9px 12px', marginBottom: 10 }}>
            <div style={{ fontSize: 11, color: C.txm, fontWeight: 700 }}>{String(tmpI).padStart(2,'0')}:00 — {String(tmpF).padStart(2,'0')}:00 · slot da {tmpS} min · {Math.ceil((tmpF - tmpI) * 60 / tmpS)} slot totali</div>
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
            <Btn ch="Annulla" v="sec" onClick={() => setSettingsOpen(false)} full />
            <Btn ch="Salva" onClick={saveSettings} dis={tmpI >= tmpF} full />
          </div>
        </Modal>
      )}

      {/* MODAL NUOVO/MODIFICA */}
      {modal && (
        <Modal title={editApp ? '✏️ Modifica appuntamento' : '📅 Nuovo appuntamento'} onClose={() => setModal(false)} wide>
          <Fld label="Paziente">
            {(() => {
              const sel = patients.find(p => String(p.id) === String(form.pazienteId));
              const filtered = pazSearch.trim() ? patients.filter(p => `${p.nome} ${p.cognome} ${p.cognome} ${p.nome}`.toLowerCase().includes(pazSearch.toLowerCase())) : patients;
              return (
                <div style={{ position: 'relative' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, border: `1.5px solid ${sel && !pazSearch ? C.suc : C.brd}`, borderRadius: 10, padding: '10px 12px', background: C.sur }}>
                    {sel && !pazSearch ? (
                      <><div style={{ flex: 1 }}><div style={{ fontWeight: 700, fontSize: 14 }}>{sel.nome} {sel.cognome}</div>{sel.telefono && <div style={{ fontSize: 11, color: C.txl }}>{sel.telefono}</div>}</div>
                        <button onClick={() => { F({ pazienteId: '' }); setPazSearch(''); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.txl, fontSize: 18, padding: 0 }}>✕</button></>
                    ) : (
                      <input autoFocus value={pazSearch} onChange={e => { setPazSearch(e.target.value); if (!e.target.value) F({ pazienteId: '' }); }} placeholder="Cerca per nome o cognome…" style={{ flex: 1, border: 'none', background: 'transparent', fontSize: 14, color: C.txt, outline: 'none', fontFamily: 'inherit' }} />
                    )}
                  </div>
                  {(!sel || pazSearch) && filtered.length > 0 && (
                    <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 1000, background: C.sur, border: `1.5px solid ${C.pri}`, borderRadius: 10, boxShadow: '0 8px 24px rgba(0,0,0,0.15)', marginTop: 3, maxHeight: 200, overflowY: 'auto' }}>
                      {filtered.slice(0, 20).map(p => (
                        <div key={p.id} onClick={() => { F({ pazienteId: String(p.id) }); setPazSearch(''); }} style={{ padding: '10px 14px', cursor: 'pointer', borderBottom: `1px solid ${C.brd}` }} onMouseEnter={e => e.currentTarget.style.background = C.priL} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                          <div style={{ fontWeight: 700, fontSize: 13 }}>{p.cognome} {p.nome}</div>
                          {p.telefono && <div style={{ fontSize: 11, color: C.txl }}>{p.telefono}</div>}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })()}
          </Fld>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <Fld label="Data"><Inp type="date" value={form.data} onChange={e => F({ data: e.target.value })} /></Fld>
            <Fld label="Ora"><Inp type="time" value={form.ora} onChange={e => F({ ora: e.target.value })} /></Fld>
            <Fld label="Durata">
              <Sel value={form.durata} onChange={e => F({ durata: e.target.value })}>
                {[15,30,45,60,90,120].map(d => <option key={d} value={d}>{d} min</option>)}
              </Sel>
            </Fld>
            <Fld label="Stato">
              <Sel value={form.stato} onChange={e => F({ stato: e.target.value })}>
                <option value="confermato">Confermato</option>
                <option value="da confermare">Da confermare</option>
                <option value="annullato">Annullato</option>
              </Sel>
            </Fld>
          </div>
          <Fld label="Tipo visita">
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
              {tipiList.map(tipo => (
                <button key={tipo.id} onClick={() => F({ tipo: tipo.nome, colore: tipo.colore })} style={{ padding: '5px 10px', borderRadius: 20, border: `1.5px solid ${form.tipo === tipo.nome ? tipo.colore : C.brd}`, background: form.tipo === tipo.nome ? tipo.colore + '18' : C.sur, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: tipo.colore }} />
                  <span style={{ fontSize: 11, fontWeight: form.tipo === tipo.nome ? 700 : 500, color: form.tipo === tipo.nome ? tipo.colore : C.txm }}>{tipo.nome}</span>
                </button>
              ))}
            </div>
            <Inp value={form.tipo} onChange={e => F({ tipo: e.target.value })} placeholder="Personalizza tipo visita" />
          </Fld>
          <Fld label="Note"><Txt value={form.note} onChange={e => F({ note: e.target.value })} /></Fld>
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            {editApp && <Btn ch="Elimina" v="dan" onClick={() => { del(editApp.id); setModal(false); }} />}
            <Btn ch="Annulla" v="sec" onClick={() => setModal(false)} full />
            <Btn ch={editApp ? 'Aggiorna' : 'Salva'} onClick={save} dis={!form.pazienteId} full />
          </div>
        </Modal>
      )}
    </div>
  );
}
