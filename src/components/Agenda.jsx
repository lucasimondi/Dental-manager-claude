import React, { useState, useRef, useEffect } from 'react';
import { Btn, Crd, Fld, Inp, Sel, Txt, Modal, Toast, Bdg, Ic, PhStr } from './ui';
import { C, uid, fmtD, today, DEF_APP_TYPES } from '../lib/utils';

const WD_SHORT = ['Dom', 'Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab'];
const MESI = ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno', 'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'];
const toISO = (d) => d.toISOString().slice(0, 10);
const startOfWeek = (d) => { const dt = new Date(d + 'T12:00'); const day = dt.getDay(); dt.setDate(dt.getDate() + (day === 0 ? -6 : 1 - day)); return dt; };

// Genera slot orari
const genSlots = (oraInizio, oraFine, minuti) => {
  const slots = [];
  let h = oraInizio, m = 0;
  while (h < oraFine || (h === oraFine && m === 0)) {
    slots.push(`${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`);
    m += minuti;
    if (m >= 60) { h += Math.floor(m / 60); m = m % 60; }
  }
  return slots;
};

const SLOT_H = 48; // altezza in px per ogni slot da 30min

export default function Agenda({ patients, appointments, setAppointments, appTypes, initPazienteId, onClearInitPaz }) {
  const tipiList = appTypes?.length ? appTypes : DEF_APP_TYPES;
  const [view, setView] = useState('settimana');
  const [selDay, setSelDay] = useState(today());
  const [modal, setModal] = useState(false);
  const [pazSearch, setPazSearch] = useState('');
  const [toast, setToast] = useState('');
  const [editApp, setEditApp] = useState(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [vd, setVd] = useState(new Date());

  // Impostazioni griglia
  const [oraInizio, setOraInizio] = useState(() => { try { return Number(localStorage.getItem('ag_oraInizio') || 8); } catch { return 8; } });
  const [oraFine, setOraFine] = useState(() => { try { return Number(localStorage.getItem('ag_oraFine') || 20); } catch { return 20; } });
  const [slotMin, setSlotMin] = useState(() => { try { return Number(localStorage.getItem('ag_slotMin') || 30); } catch { return 30; } });

  const saveSettings = (i, f, s) => {
    setOraInizio(i); setOraFine(f); setSlotMin(s);
    localStorage.setItem('ag_oraInizio', i);
    localStorage.setItem('ag_oraFine', f);
    localStorage.setItem('ag_slotMin', s);
    setSettingsOpen(false);
  };

  const slots = genSlots(oraInizio, oraFine, slotMin);
  const slotH = slotMin === 15 ? 36 : slotMin === 30 ? 48 : 64; // px per slot

  const [form, setForm] = useState({ pazienteId: initPazienteId || '', data: today(), ora: '09:00', durata: 30, tipo: tipiList[0]?.nome || 'Visita', colore: tipiList[0]?.colore || C.pri, note: '', stato: 'confermato' });
  const F = (f) => setForm(p => ({ ...p, ...f }));

  useEffect(() => {
    if (initPazienteId) { setForm(f => ({ ...f, pazienteId: String(initPazienteId) })); setModal(true); if (onClearInitPaz) onClearInitPaz(); }
  }, [initPazienteId]);

  const getColore = (a) => a.colore || tipiList.find(t => t.nome === a.tipo)?.colore || C.pri;

  const apriNuovo = (data, ora) => {
    setPazSearch('');
    setEditApp(null);
    setForm({ pazienteId: '', data: data || selDay, ora: ora || '09:00', durata: 30, tipo: tipiList[0]?.nome || 'Visita', colore: tipiList[0]?.colore || C.pri, note: '', stato: 'confermato' });
    setModal(true);
  };

  const apriEdit = (a) => {
    setEditApp(a);
    setPazSearch('');
    setForm({ pazienteId: String(a.pazienteId), data: a.data, ora: a.ora, durata: a.durata, tipo: a.tipo, colore: a.colore || C.pri, note: a.note || '', stato: a.stato });
    setModal(true);
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
  const sendWA = (a) => {
    const p = patients.find(x => x.id === a.pazienteId);
    if (!p?.telefono) return;
    const msg = encodeURIComponent(`Gentile ${p.nome},\nricordiamo il suo appuntamento:\n📅 ${fmtD(a.data)} alle ${a.ora}\n🦷 ${a.tipo}\nPer variazioni contattarci entro 24h. Grazie!`);
    window.open(`https://wa.me/39${p.telefono.replace(/\D/g, '')}?text=${msg}`, '_blank');
  };

  // Calcola posizione e altezza di un appuntamento nella griglia
  const appPosition = (a) => {
    const [ah, am] = a.ora.split(':').map(Number);
    const minutiDaInizio = (ah - oraInizio) * 60 + am;
    const top = (minutiDaInizio / slotMin) * slotH;
    const height = Math.max((Number(a.durata) / slotMin) * slotH - 2, slotH / 2);
    return { top, height };
  };

  // Settimana corrente
  const weekStart = startOfWeek(selDay);
  const weekDays = Array.from({ length: 7 }, (_, i) => { const d = new Date(weekStart); d.setDate(d.getDate() + i); return d; });

  const GridView = ({ days }) => {
    const scrollRef = useRef(null);
    useEffect(() => {
      if (scrollRef.current) scrollRef.current.scrollTop = ((9 - oraInizio) / (oraFine - oraInizio)) * scrollRef.current.scrollHeight * 0.3;
    }, []);

    const colW = days.length === 1 ? '100%' : `${100 / days.length}%`;
    const t = today();

    return (
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden', border: `1px solid ${C.brd}`, borderRadius: 10, background: '#fff' }}>
        {/* Colonna ore */}
        <div style={{ width: 44, flexShrink: 0, borderRight: `1px solid ${C.brd}` }}>
          <div style={{ height: 40, borderBottom: `1px solid ${C.brd}` }} />
          <div ref={scrollRef} style={{ overflowY: 'auto', height: 'calc(100vh - 220px)' }}>
            {slots.map((slot, i) => (
              <div key={slot} style={{ height: slotH, borderBottom: i % 2 === 0 ? `1px solid ${C.brd}` : `1px dashed ${C.brd}30`, display: 'flex', alignItems: 'flex-start', justifyContent: 'flex-end', paddingRight: 4, paddingTop: 2 }}>
                <span style={{ fontSize: 9, color: C.txl, fontWeight: 600 }}>{i % (60 / slotMin) === 0 ? slot : ''}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Colonne giorni */}
        <div style={{ flex: 1, overflowX: 'auto', display: 'flex', flexDirection: 'column' }}>
          {/* Header giorni */}
          <div style={{ display: 'flex', borderBottom: `1px solid ${C.brd}`, height: 40, flexShrink: 0 }}>
            {days.map((d, di) => {
              const ds = toISO(d);
              const isToday = ds === t;
              const isSelected = ds === selDay;
              return (
                <div key={di} onClick={() => { setSelDay(ds); if (view === 'settimana') setView('giorno'); }} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', background: isSelected ? C.priL : 'transparent', borderLeft: di > 0 ? `1px solid ${C.brd}` : 'none' }}>
                  <div style={{ fontSize: 9, fontWeight: 700, color: isToday ? C.pri : C.txl, textTransform: 'uppercase' }}>{WD_SHORT[d.getDay()]}</div>
                  <div style={{ fontSize: 16, fontWeight: 900, color: isToday ? '#fff' : isSelected ? C.pri : C.txt, background: isToday ? C.pri : 'transparent', borderRadius: '50%', width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1 }}>{d.getDate()}</div>
                </div>
              );
            })}
          </div>

          {/* Griglia scrollabile */}
          <div style={{ flex: 1, overflowY: 'auto', display: 'flex', position: 'relative' }} id="agenda-grid-scroll">
            {days.map((d, di) => {
              const ds = toISO(d);
              const dayApps = appointments.filter(a => a.data === ds).sort((a, b) => a.ora.localeCompare(b.ora));
              return (
                <div key={di} style={{ flex: 1, position: 'relative', borderLeft: di > 0 ? `1px solid ${C.brd}` : 'none', minWidth: days.length > 1 ? 80 : 'auto' }}>
                  {/* Slot cliccabili */}
                  {slots.map((slot, si) => (
                    <div key={slot} onClick={() => apriNuovo(ds, slot)} style={{ height: slotH, borderBottom: si % 2 === 0 ? `1px solid ${C.brd}20` : `1px dashed ${C.brd}10`, cursor: 'pointer', '&:hover': { background: C.priL } }}
                      onMouseEnter={e => e.currentTarget.style.background = C.priL + '40'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'} />
                  ))}
                  {/* Appuntamenti */}
                  {dayApps.map(a => {
                    const { top, height } = appPosition(a);
                    if (top < 0) return null;
                    const p = patients.find(x => x.id === a.pazienteId);
                    const co = getColore(a);
                    return (
                      <div key={a.id} onClick={() => apriEdit(a)} style={{ position: 'absolute', top, left: 2, right: 2, height, background: co + 'E0', borderRadius: 5, padding: '2px 4px', cursor: 'pointer', overflow: 'hidden', zIndex: 2, borderLeft: `3px solid ${co}` }}>
                        <div style={{ fontSize: 10, fontWeight: 800, color: '#fff', lineHeight: 1.2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.ora} {p ? `${p.nome} ${p.cognome}` : '—'}</div>
                        {height > 30 && <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.85)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.tipo}</div>}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  };

  // Vista mese (calendario classico)
  const MonthView = () => {
    const K = vd.getFullYear(), mese = vd.getMonth();
    const primo = new Date(K, mese, 1).getDay();
    const giorni = new Date(K, mese + 1, 0).getDate();
    const celle = Array(primo === 0 ? 6 : primo - 1).fill(null).concat(Array.from({ length: giorni }, (_, i) => i + 1));
    const t = today();
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
                <div key={i} onClick={() => { setSelDay(ds); setView('giorno'); }} style={{ textAlign: 'center', padding: '5px 2px', borderRadius: 7, cursor: 'pointer', background: isSel ? C.pri : isTod ? C.priL : 'transparent', color: isSel ? '#fff' : isTod ? C.pri : C.txt, fontWeight: isSel || isTod ? 700 : 400, fontSize: 12, position: 'relative' }}>
                  {g}
                  {cnt > 0 && <div style={{ display: 'flex', gap: 1, justifyContent: 'center', position: 'absolute', bottom: 2, left: '50%', transform: 'translateX(-50%)' }}>
                    {Array.from({ length: Math.min(cnt, 3) }, (_, i) => <div key={i} style={{ width: 4, height: 4, borderRadius: '50%', background: isSel ? '#fff' : C.pri }} />)}
                  </div>}
                </div>
              );
            })}
          </div>
        </Crd>
        {/* Lista appuntamenti giorno selezionato */}
        <div style={{ fontSize: 12, fontWeight: 700, color: C.txm, marginBottom: 8 }}>{fmtD(selDay)} · {appointments.filter(a => a.data === selDay).length} appuntamenti</div>
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
                  <button onClick={e => { e.stopPropagation(); sendWA(a); }} style={{ background: '#25D366', border: 'none', borderRadius: 6, padding: 6, cursor: 'pointer', display: 'flex' }}><Ic n="wa" s={13} c="#fff" /></button>
                  <button onClick={e => { e.stopPropagation(); del(a.id); }} style={{ background: C.danL, border: 'none', borderRadius: 6, padding: 6, cursor: 'pointer', display: 'flex' }}><Ic n="del" s={13} c={C.dan} /></button>
                </div>
              </div>
            </Crd>
          );
        })}
        {appointments.filter(a => a.data === selDay).length === 0 && <div style={{ textAlign: 'center', color: C.txl, padding: 20 }}>Nessun appuntamento — tocca un giorno per aggiungerne</div>}
      </div>
    );
  };

  const navGiorno = (n) => { const d = new Date(selDay + 'T12:00'); d.setDate(d.getDate() + n); setSelDay(toISO(d)); };
  const navSettimana = (n) => { const d = new Date(selDay + 'T12:00'); d.setDate(d.getDate() + n * 7); setSelDay(toISO(d)); };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {toast && <Toast msg={toast} onDone={() => setToast('')} />}

      {/* HEADER */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, flexShrink: 0 }}>
        <div style={{ flex: 1 }}>
          {view === 'giorno' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <button onClick={() => navGiorno(-1)} style={{ background: C.bg, border: 'none', borderRadius: 7, width: 30, height: 30, cursor: 'pointer', fontSize: 16 }}>‹</button>
              <span style={{ fontWeight: 700, fontSize: 13 }}>{fmtD(selDay)}</span>
              <button onClick={() => navGiorno(1)} style={{ background: C.bg, border: 'none', borderRadius: 7, width: 30, height: 30, cursor: 'pointer', fontSize: 16 }}>›</button>
              {selDay !== today() && <button onClick={() => setSelDay(today())} style={{ background: C.priL, border: 'none', borderRadius: 7, padding: '4px 8px', color: C.pri, fontWeight: 700, fontSize: 10, cursor: 'pointer' }}>Oggi</button>}
            </div>
          )}
          {view === 'settimana' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <button onClick={() => navSettimana(-1)} style={{ background: C.bg, border: 'none', borderRadius: 7, width: 30, height: 30, cursor: 'pointer', fontSize: 16 }}>‹</button>
              <span style={{ fontWeight: 700, fontSize: 12 }}>{weekDays[0].getDate()} {MESI[weekDays[0].getMonth()].slice(0,3)} – {weekDays[6].getDate()} {MESI[weekDays[6].getMonth()].slice(0,3)}</span>
              <button onClick={() => navSettimana(1)} style={{ background: C.bg, border: 'none', borderRadius: 7, width: 30, height: 30, cursor: 'pointer', fontSize: 16 }}>›</button>
            </div>
          )}
          {view === 'mese' && <span style={{ fontWeight: 800, fontSize: 16 }}>Agenda</span>}
        </div>
        <button onClick={() => setSettingsOpen(true)} style={{ background: C.bg, border: `1px solid ${C.brd}`, borderRadius: 8, padding: '6px 8px', cursor: 'pointer', display: 'flex' }}><Ic n="set" s={15} c={C.txm} /></button>
        <Btn ch="+ Nuovo" onClick={() => apriNuovo()} />
      </div>

      {/* TAB SWITCHER */}
      <div style={{ display: 'flex', background: C.bg, borderRadius: 9, border: `1px solid ${C.brd}`, marginBottom: 10, overflow: 'hidden', flexShrink: 0 }}>
        {[['giorno','Giorno'],['settimana','Settimana'],['mese','Mese']].map(([id, lbl]) => (
          <button key={id} onClick={() => setView(id)} style={{ flex: 1, padding: '9px 0', border: 'none', background: view === id ? C.pri : 'transparent', color: view === id ? '#fff' : C.txm, fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>{lbl}</button>
        ))}
      </div>

      {/* VIEWS */}
      {view === 'giorno' && <GridView days={[new Date(selDay + 'T12:00')]} />}
      {view === 'settimana' && <GridView days={weekDays} />}
      {view === 'mese' && <MonthView />}

      {/* MODAL IMPOSTAZIONI GRIGLIA */}
      {settingsOpen && (() => {
        const [tmpI, setTmpI] = useState(oraInizio);
        const [tmpF, setTmpF] = useState(oraFine);
        const [tmpS, setTmpS] = useState(slotMin);
        return (
          <Modal title="⚙️ Impostazioni griglia" onClose={() => setSettingsOpen(false)}>
            <Fld label="Ora inizio">
              <Sel value={tmpI} onChange={e => setTmpI(Number(e.target.value))}>
                {Array.from({ length: 16 }, (_, i) => i + 6).map(h => <option key={h} value={h}>{String(h).padStart(2,'0')}:00</option>)}
              </Sel>
            </Fld>
            <Fld label="Ora fine">
              <Sel value={tmpF} onChange={e => setTmpF(Number(e.target.value))}>
                {Array.from({ length: 16 }, (_, i) => i + 6).map(h => <option key={h} value={h}>{String(h).padStart(2,'0')}:00</option>)}
              </Sel>
            </Fld>
            <Fld label="Dimensione slot">
              <Sel value={tmpS} onChange={e => setTmpS(Number(e.target.value))}>
                <option value={15}>15 minuti</option>
                <option value={30}>30 minuti</option>
                <option value={60}>60 minuti</option>
              </Sel>
            </Fld>
            <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
              <Btn ch="Annulla" v="sec" onClick={() => setSettingsOpen(false)} full />
              <Btn ch="Salva" onClick={() => saveSettings(tmpI, tmpF, tmpS)} full />
            </div>
          </Modal>
        );
      })()}

      {/* MODAL NUOVO / MODIFICA APPUNTAMENTO */}
      {modal && (
        <Modal title={editApp ? '✏️ Modifica appuntamento' : '📅 Nuovo appuntamento'} onClose={() => setModal(false)} wide>
          <Fld label="Paziente">
            {(() => {
              const sel = patients.find(p => String(p.id) === String(form.pazienteId));
              const filtered = pazSearch.trim()
                ? patients.filter(p => `${p.nome} ${p.cognome} ${p.cognome} ${p.nome}`.toLowerCase().includes(pazSearch.toLowerCase()))
                : patients;
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
                        <div key={p.id} onClick={() => { F({ pazienteId: String(p.id) }); setPazSearch(''); }}
                          style={{ padding: '10px 14px', cursor: 'pointer', borderBottom: `1px solid ${C.brd}`, display: 'flex', justifyContent: 'space-between' }}
                          onMouseEnter={e => e.currentTarget.style.background = C.priL}
                          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                          <div><div style={{ fontWeight: 700, fontSize: 13 }}>{p.cognome} {p.nome}</div>{p.telefono && <div style={{ fontSize: 11, color: C.txl }}>{p.telefono}</div>}</div>
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
              {tipiList.map(t => (
                <button key={t.id} onClick={() => F({ tipo: t.nome, colore: t.colore })} style={{ padding: '5px 10px', borderRadius: 20, border: `1.5px solid ${form.tipo === t.nome ? t.colore : C.brd}`, background: form.tipo === t.nome ? t.colore + '18' : C.sur, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: t.colore }} />
                  <span style={{ fontSize: 11, fontWeight: form.tipo === t.nome ? 700 : 500, color: form.tipo === t.nome ? t.colore : C.txm }}>{t.nome}</span>
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
