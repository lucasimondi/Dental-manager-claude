import React, { useState, useRef, useEffect } from 'react';
import { Btn, Crd, Fld, Inp, Sel, Txt, Modal, Toast, Bdg, Ic, PhStr } from './ui';
import WaAction, { apriWaDiretto } from './ui/WaAction.jsx';
import { C, uid, fmtD, today, DEF_APP_TYPES, DEF_AGENDA_SETTINGS } from '../lib/utils';
import { useIsMobile } from '../lib/useIsMobile';

const WD_SHORT = ['Dom', 'Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab'];
const MESI = ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno', 'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'];
const toISO = (d) => d.toISOString().slice(0, 10);
const TIPO_IMPEGNO = [
  { id: 'personale', label: 'Personale', colore: '#64748b' },
  { id: 'ferie', label: 'Ferie', colore: '#f59e0b' },
  { id: 'chiamata', label: 'Chiamata', colore: '#8b5cf6' },
  { id: 'altro', label: 'Altro', colore: '#6b7280' },
];
const startOfWeek = (d) => {
  const dt = new Date(d + 'T12:00');
  const day = dt.getDay();
  dt.setDate(dt.getDate() + (day === 0 ? -6 : 1 - day));
  return dt;
};

function GridView({ days, slots, slotH, slotMin, oraInizio, appointments, setAppointments, patients, getColore, appPosition, apriNuovo, apriEdit, apriWA, selDay, setSelDay, setView, today: t, features, impegni, apriEditImpegno }) {
  const containerRef = useRef(null); // unico scroll container
  const resizeRef = useRef(null);
  const [now, setNow] = useState(new Date());
  const [resizing, setResizing] = useState(null); // { id, startY, startDurata }

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    // Scroll iniziale: vicino all'ora corrente se è dentro l'intervallo visibile, altrimenti in cima
    const headerH = 44;
    const target = showNowLine ? Math.max(0, nowTop - slotH * 2) + headerH : headerH;
    if (containerRef.current) containerRef.current.scrollTop = target;
  }, [slotH, slotMin, oraInizio]);

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



  const nowMin = now.getHours() * 60 + now.getMinutes() - oraInizio * 60;
  const nowTop = (nowMin / slotMin) * slotH;
  const showNowLine = nowMin >= 0 && nowMin <= slots.length * slotMin;

  return (
    <div style={{ display: 'flex', flex: 1, overflow: 'hidden', border: `1px solid ${C.brd}`, borderRadius: 12, background: C.sur, minHeight: 0, boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

        {/* UNICO contenitore scrollabile: header + griglia insieme, cosi' le colonne hanno sempre esattamente la stessa larghezza */}
        <div ref={containerRef} style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', WebkitOverflowScrolling: 'touch', position: 'relative' }}>
          <div style={{ display: 'flex', flexDirection: 'column', minHeight: slots.length * slotH + 44 }}>

            {/* Header: angolo vuoto + giorni — sticky in cima, dentro lo stesso contenitore scrollabile della griglia */}
            <div style={{ display: 'flex', borderBottom: `1.5px solid ${C.brd}`, height: 44, flexShrink: 0, background: C.bg, position: 'sticky', top: 0, zIndex: 4 }}>
              <div style={{ width: 46, flexShrink: 0, borderRight: `1.5px solid ${C.brd}` }} />
              {days.map((d, di) => {
                const ds = toISO(d);
                const isToday = ds === t;
                const isSelected = ds === selDay;
                const isWeekend = d.getDay() === 0 || d.getDay() === 6;
                return (
                  <div key={di} onClick={() => { setSelDay(ds); if (days.length > 1) setView('giorno'); }} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2, cursor: 'pointer', background: isSelected && days.length > 1 ? C.priL : isWeekend ? C.bg : 'transparent', borderLeft: di > 0 ? `1.5px solid ${C.brd}` : 'none' }}>
                    <div style={{ fontSize: 9, fontWeight: 700, color: isToday ? C.pri : isWeekend ? C.txl : C.txm, textTransform: 'uppercase', letterSpacing: '0.03em' }}>{WD_SHORT[d.getDay()]}</div>
                    <div style={{ fontSize: 15, fontWeight: 900, color: isToday ? '#fff' : isSelected ? C.pri : C.txt, background: isToday ? C.pri : 'transparent', borderRadius: '50%', width: 25, height: 25, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{d.getDate()}</div>
                  </div>
                );
              })}
            </div>

            {/* Riga impegni personali: stile "tutto il giorno" di Google Calendar, spanna piu' giorni.
                overflow:hidden sulla riga e sulla cella evita che l'etichetta di un impegno di un solo
                giorno "sconfini" visivamente sulla colonna accanto quando lo spazio e' stretto (mobile). */}
            {impegni && impegni.length > 0 && (
              <div style={{ display: 'flex', borderBottom: `1.5px solid ${C.brd}`, flexShrink: 0, background: C.bg, overflow: 'hidden' }}>
                <div style={{ width: 46, flexShrink: 0, borderRight: `1.5px solid ${C.brd}` }} />
                {days.map((d, di) => {
                  const ds = toISO(d);
                  const dayImp = impegni.filter((imp) => ds >= imp.dataInizio && ds <= imp.dataFine);
                  return (
                    <div key={di} style={{ flex: 1, minWidth: 0, overflow: 'hidden', borderLeft: di > 0 ? `1.5px solid ${C.brd}` : 'none', padding: dayImp.length ? '3px 2px' : 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
                      {dayImp.map((imp) => {
                        const co = imp.colore || TIPO_IMPEGNO.find((x) => x.id === imp.tipo)?.colore || C.pri;
                        const isSingleDay = imp.dataInizio === imp.dataFine;
                        const isStart = ds === imp.dataInizio;
                        const isEnd = ds === imp.dataFine;
                        const etichetta = imp.tuttoIlGiorno ? imp.titolo : `${(imp.oraInizio || '').slice(0, 5)} ${imp.titolo}`;
                        return (
                          <div key={imp.id} onClick={() => apriEditImpegno(imp)} title={imp.titolo} style={{
                            background: co, color: '#fff', fontSize: 9, fontWeight: 700, padding: '2px 6px', lineHeight: '13px',
                            borderRadius: isSingleDay ? 5 : isStart ? '5px 0 0 5px' : isEnd ? '0 5px 5px 0' : 0,
                            marginLeft: isSingleDay ? 0 : isStart ? 0 : -2,
                            marginRight: isSingleDay ? 0 : isEnd ? 0 : -2,
                            cursor: 'pointer', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', minWidth: 0,
                          }}>
                            {isStart ? etichetta : '\u00A0'}
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            )}

            <div style={{ display: 'flex', flex: 1 }}>

            {/* Colonna ore — sticky */}
            <div style={{ width: 46, flexShrink: 0, borderRight: `1.5px solid ${C.brd}`, background: C.bg, position: 'sticky', left: 0, zIndex: 3 }}>
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
              <div key={di} style={{ flex: 1, position: 'relative', borderLeft: di > 0 ? `1.5px solid ${C.brd}` : 'none', background: isWeekend ? C.bg : isToday ? C.priL : C.sur }}>
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
                  if (top < 0 || top >= slots.length * slotH) return null;
                  const p = patients.find(x => x.id === a.pazienteId);
                  const co = getColore(a);
                  const isBeingResized = resizing?.id === a.id;
                  return (
                    <div key={a.id} style={{ position: 'absolute', top, left: 2, right: 2, height, background: co, borderRadius: 5, overflow: 'hidden', zIndex: isBeingResized ? 10 : 2, borderLeft: `3px solid ${co}DD`, boxShadow: isBeingResized ? '0 4px 12px rgba(0,0,0,0.3)' : '0 1px 3px rgba(0,0,0,0.15)', userSelect: 'none' }}>
                      {/* Contenuto appuntamento */}
                      <div onClick={e => { if (!isBeingResized) { e.stopPropagation(); apriEdit(a); } }} style={{ padding: '2px 5px', cursor: 'pointer', paddingBottom: height > 26 ? 9 : 2 }}>
                        <div style={{ fontSize: 10, lineHeight: '11px', fontWeight: 800, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.ora} {p ? `${p.cognome}` : '—'}</div>
                        {height > 32 && <div style={{ fontSize: 9, lineHeight: '10px', color: 'rgba(255,255,255,0.9)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.tipo}</div>}
                        {height > 48 && <div style={{ fontSize: 9, lineHeight: '10px', color: 'rgba(255,255,255,0.7)' }}>{a.durata} min</div>}
                      </div>
                      {/* WA button */}
                      <WaAction tel={p?.telefono} features={features} variant="chip" onClick={() => apriWA(a)} style={{ position: 'absolute', top: 2, right: 2, zIndex: 3 }} />
                      {/* RESIZE HANDLE - nascosta sugli appuntamenti troppo brevi per contenerla senza sovrapporsi al testo */}
                      {height > 26 && <div
                        onMouseDown={e => { e.stopPropagation(); e.preventDefault(); setResizing({ id: a.id, startY: e.clientY, startDurata: Number(a.durata) }); }}
                        onTouchStart={e => { e.stopPropagation(); setResizing({ id: a.id, startY: e.touches[0].clientY, startDurata: Number(a.durata) }); }}
                        style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 8, cursor: 'ns-resize', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.15)', borderBottomLeftRadius: 5, borderBottomRightRadius: 5 }}>
                        <div style={{ width: 16, height: 2, background: 'rgba(255,255,255,0.6)', borderRadius: 1 }} />
                      </div>}
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
    </div>
  );
}

export default function Agenda({ patients, appointments, setAppointments, appTypes, initPazienteId, onClearInitPaz, templates, features, impegni, setImpegni, si, setStudioInfo }) {
  const tipiList = appTypes?.length ? appTypes : DEF_APP_TYPES;

  // Setup Agenda: le impostazioni sono condivise a livello di studio (studioInfo.agenda_settings),
  // così tutti i collaboratori vedono la stessa configurazione. localStorage resta solo come
  // valore iniziale offline-first prima che arrivi lo studioInfo dal server.
  const agSet = { ...DEF_AGENDA_SETTINGS, ...(si?.agenda_settings || {}) };
  const [oraInizio, setOraInizio] = useState(() => { try { return si?.agenda_settings?.oraInizio ?? Number(localStorage.getItem('ag_oraInizio') || DEF_AGENDA_SETTINGS.oraInizio); } catch { return DEF_AGENDA_SETTINGS.oraInizio; } });
  const [oraFine, setOraFine] = useState(() => { try { return si?.agenda_settings?.oraFine ?? Number(localStorage.getItem('ag_oraFine') || DEF_AGENDA_SETTINGS.oraFine); } catch { return DEF_AGENDA_SETTINGS.oraFine; } });
  const [slotMin, setSlotMin] = useState(() => { try { return si?.agenda_settings?.slotMin ?? Number(localStorage.getItem('ag_slotMin') || DEF_AGENDA_SETTINGS.slotMin); } catch { return DEF_AGENDA_SETTINGS.slotMin; } });
  const [zoom, setZoom] = useState(() => { try { return si?.agenda_settings?.zoom ?? (Number(localStorage.getItem('ag_zoom')) || DEF_AGENDA_SETTINGS.zoom); } catch { return DEF_AGENDA_SETTINGS.zoom; } });
  const [hiddenWeekdays, setHiddenWeekdays] = useState(() => si?.agenda_settings?.hiddenWeekdays || DEF_AGENDA_SETTINGS.hiddenWeekdays);
  const [tmpI, setTmpI] = useState(8);
  const [tmpF, setTmpF] = useState(20);
  const [tmpS, setTmpS] = useState(30);
  const [tmpZ, setTmpZ] = useState(1);
  const [tmpHidden, setTmpHidden] = useState([]);
  const [view, setView] = useState('settimana');
  const [selDay, setSelDay] = useState(today());
  const [modal, setModal] = useState(false);
  const [pazSearch, setPazSearch] = useState('');
  const [toast, setToast] = useState('');
  const [editApp, setEditApp] = useState(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [vd, setVd] = useState(new Date());
  const wheelRef = useRef(0);
  const touchXRef = useRef(null);
  const [form, setForm] = useState({ pazienteId: '', data: today(), ora: '09:00', durata: 30, tipo: tipiList[0]?.nome || 'Visita', colore: tipiList[0]?.colore || C.pri, note: '', stato: 'confermato', ripeti: 'nessuna', ripetiFino: '' });
  const [waModal, setWaModal] = useState(null);
  const [waMsg, setWaMsg] = useState('');
  const [waTplId, setWaTplId] = useState('');
  const [impModal, setImpModal] = useState(false);
  const [editImp, setEditImp] = useState(null);
  const [impForm, setImpForm] = useState({ titolo: '', tipo: 'personale', colore: '', dataInizio: today(), dataFine: today(), tuttoIlGiorno: true, oraInizio: '09:00', oraFine: '10:00', note: '' });
  const IF = (f) => setImpForm((p) => ({ ...p, ...f }));

  const F = (f) => setForm(p => ({ ...p, ...f }));

  useEffect(() => {
    if (initPazienteId) {
      setForm(f => ({ ...f, pazienteId: String(initPazienteId) }));
      setModal(true);
      if (onClearInitPaz) onClearInitPaz();
    }
  }, [initPazienteId]);

  const isMobile = useIsMobile();
  // availH reattivo: ricalcolato a ogni resize/orientazione, non solo al primo render.
  // Sottrae header app + header agenda + tab switcher + dock (84px mobile / 60px desktop),
  // così la griglia è sempre tarata sullo spazio reale disponibile, non su un valore fisso.
  const [availH, setAvailH] = useState(() => (typeof window !== 'undefined' ? Math.max(360, window.innerHeight - 210) : 480));
  useEffect(() => {
    const dockH = isMobile ? 84 : 60;
    const chrome = 126 + dockH; // header studio + header agenda + tab switcher, misurati empiricamente
    const recalc = () => setAvailH(Math.max(360, window.innerHeight - chrome));
    recalc();
    window.addEventListener('resize', recalc);
    window.addEventListener('orientationchange', recalc);
    return () => { window.removeEventListener('resize', recalc); window.removeEventListener('orientationchange', recalc); };
  }, [isMobile]);
  // slotH calcolato per far stare l'intervallo scelto (oraInizio-oraFine) nello schermo, poi scalato dal fattore zoom
  const oreVisibili = Math.max(1, oraFine - oraInizio);
  const slotH = Math.max(8, Math.round((availH / (oreVisibili * 60 / slotMin)) * zoom));
  // Griglia limitata all'intervallo oraInizio - oraFine scelto nelle impostazioni
  const slots = [];
  for (let h = oraInizio; h < oraFine; h++) {
    for (let m = 0; m < 60; m += slotMin) {
      slots.push(`${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`);
    }
  }

  const getColore = (a) => a.colore || tipiList.find(t => t.nome === a.tipo)?.colore || C.pri;

  const appPosition = (a) => {
    const [ah, am] = a.ora.split(':').map(Number);
    const min = ah * 60 + am - oraInizio * 60; // relativo all'inizio dell'intervallo visibile
    const top = (min / slotMin) * slotH;
    const height = Math.max((Number(a.durata) / slotMin) * slotH - 2, slotH * 0.6);
    return { top, height };
  };

  const weekStart = startOfWeek(selDay);
  const weekDaysAll = Array.from({ length: 7 }, (_, i) => { const d = new Date(weekStart); d.setDate(d.getDate() + i); return d; });
  // Non nasconde MAI tutti i 7 giorni: se per errore lo studio ha nascosto tutta la settimana, mostra comunque tutto.
  const weekDaysVisibili = weekDaysAll.filter(d => !hiddenWeekdays.includes(d.getDay()));
  const weekDays = weekDaysVisibili.length > 0 ? weekDaysVisibili : weekDaysAll;
  const t = today();

  const apriNuovo = (data, ora) => {
    setPazSearch('');
    setEditApp(null);
    setForm({ pazienteId: '', data: data || selDay, ora: ora || '09:00', durata: 30, tipo: tipiList[0]?.nome || 'Visita', colore: tipiList[0]?.colore || C.pri, note: '', stato: 'confermato', ripeti: 'nessuna', ripetiFino: '' });
    setModal(true);
  };

  const apriEdit = (a) => {
    setEditApp(a);
    setPazSearch('');
    setForm({ pazienteId: String(a.pazienteId), data: a.data, ora: a.ora, durata: a.durata, tipo: a.tipo, colore: a.colore || C.pri, note: a.note || '', stato: a.stato || 'confermato', ripeti: 'nessuna', ripetiFino: '' });
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

  // Genera le date delle occorrenze ripetute (inclusa la prima), fino a ripetiFino incluso.
  // Limite di sicurezza a 104 occorrenze (~2 anni di settimanale) per evitare loop pericolosi
  // in caso di date immesse male.
  const generaDateRipetizione = (dataBase, tipo, dataFine) => {
    if (tipo === 'nessuna' || !dataFine || dataFine < dataBase) return [dataBase];
    const step = tipo === 'giornaliera' ? 1 : tipo === 'settimanale' ? 7 : null; // 'mensile' gestita a parte
    const out = [dataBase];
    let cur = new Date(dataBase + 'T12:00');
    let guard = 0;
    while (guard++ < 104) {
      if (tipo === 'mensile') cur = new Date(cur.getFullYear(), cur.getMonth() + 1, cur.getDate(), 12);
      else cur = new Date(cur.getTime() + step * 86400000);
      const ds = toISO(cur);
      if (ds > dataFine) break;
      out.push(ds);
    }
    return out;
  };

  const save = () => {
    if (!form.pazienteId) return;
    if (editApp) {
      const { ripeti, ripetiFino, ...rest } = form;
      setAppointments(p => p.map(a => a.id === editApp.id ? { ...a, ...rest, pazienteId: Number(form.pazienteId), durata: Number(form.durata) } : a));
      setToast('Aggiornato ✓');
    } else {
      const { ripeti, ripetiFino, ...rest } = form;
      const date = generaDateRipetizione(form.data, ripeti, ripetiFino);
      const nuovi = date.map((d) => ({ ...rest, data: d, id: uid() + Math.floor(Math.random() * 1000), pazienteId: Number(form.pazienteId), durata: Number(form.durata) }));
      setAppointments(p => [...p, ...nuovi]);
      setToast(nuovi.length > 1 ? `${nuovi.length} appuntamenti creati ✓` : 'Salvato ✓');
    }
    setModal(false);
  };

  const del = (id) => { if (confirm('Eliminare?')) setAppointments(p => p.filter(a => a.id !== id)); };

  const apriNuovoImpegno = (data) => {
    setEditImp(null);
    setImpForm({ titolo: '', tipo: 'personale', colore: '', dataInizio: data || selDay, dataFine: data || selDay, tuttoIlGiorno: true, oraInizio: '09:00', oraFine: '10:00', note: '' });
    setImpModal(true);
  };

  const apriEditImpegno = (imp) => {
    setEditImp(imp);
    setImpForm({
      titolo: imp.titolo, tipo: imp.tipo, colore: imp.colore || '', dataInizio: imp.dataInizio, dataFine: imp.dataFine,
      tuttoIlGiorno: imp.tuttoIlGiorno !== false, oraInizio: imp.oraInizio || '09:00', oraFine: imp.oraFine || '10:00', note: imp.note || '',
    });
    setImpModal(true);
  };

  const saveImpegno = () => {
    if (!impForm.titolo.trim() || impForm.dataFine < impForm.dataInizio) return;
    const payload = { ...impForm, oraInizio: impForm.tuttoIlGiorno ? null : impForm.oraInizio, oraFine: impForm.tuttoIlGiorno ? null : impForm.oraFine };
    if (editImp) {
      setImpegni(p => p.map(i => i.id === editImp.id ? { ...i, ...payload } : i));
      setToast('Aggiornato ✓');
    } else {
      setImpegni(p => [...p, { ...payload, id: uid() }]);
      setToast('Salvato ✓');
    }
    setImpModal(false);
  };

  const delImpegno = () => {
    if (!editImp) return;
    if (!confirm('Eliminare questo impegno?')) return;
    setImpegni(p => p.filter(i => i.id !== editImp.id));
    setImpModal(false);
  };

  const saveSettings = () => {
    if (tmpI >= tmpF) return;
    setOraInizio(tmpI); setOraFine(tmpF); setSlotMin(tmpS); setZoom(tmpZ); setHiddenWeekdays(tmpHidden);
    localStorage.setItem('ag_oraInizio', tmpI);
    localStorage.setItem('ag_oraFine', tmpF);
    localStorage.setItem('ag_slotMin', tmpS);
    localStorage.setItem('ag_zoom', tmpZ);
    if (setStudioInfo) {
      setStudioInfo((prev) => ({ ...prev, agenda_settings: { oraInizio: tmpI, oraFine: tmpF, slotMin: tmpS, zoom: tmpZ, hiddenWeekdays: tmpHidden } }));
      setToast('Impostazioni salvate per tutto lo studio ✓');
    }
    setSettingsOpen(false);
  };

  const navGiorno = (n) => { const d = new Date(selDay + 'T12:00'); d.setDate(d.getDate() + n); setSelDay(toISO(d)); };
  const navSettimana = (n) => { const d = new Date(selDay + 'T12:00'); d.setDate(d.getDate() + n * 7); setSelDay(toISO(d)); };
  const navMese = (n) => setVd(v => new Date(v.getFullYear(), v.getMonth() + n, 1));

  const gridProps = { slots, slotH, slotMin, oraInizio, appointments, setAppointments, patients, getColore, appPosition, apriNuovo, apriEdit, apriWA, selDay, setSelDay, setView, today: t, impegni, apriEditImpegno };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 130px)' }}>
      {toast && <Toast msg={toast} onDone={() => setToast('')} />}

      {/* HEADER */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, flexShrink: 0 }}>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 6 }}>
          {view === 'giorno' && <>
            <button onClick={() => navGiorno(-1)} style={{ background: C.bg, border: 'none', borderRadius: 7, width: 30, height: 30, cursor: 'pointer', fontSize: 16, color: C.txm }}>‹</button>
            <span style={{ fontWeight: 700, fontSize: 13, minWidth: 120 }}>{fmtD(selDay)}</span>
            <button onClick={() => navGiorno(1)} style={{ background: C.bg, border: 'none', borderRadius: 7, width: 30, height: 30, cursor: 'pointer', fontSize: 16, color: C.txm }}>›</button>
            {selDay !== t && <button onClick={() => setSelDay(t)} style={{ background: C.priL, border: 'none', borderRadius: 7, padding: '4px 8px', color: C.pri, fontWeight: 700, fontSize: 10, cursor: 'pointer' }}>Oggi</button>}
          </>}
          {view === 'settimana' && <>
            <button onClick={() => navSettimana(-1)} style={{ background: C.bg, border: 'none', borderRadius: 7, width: 30, height: 30, cursor: 'pointer', fontSize: 16, color: C.txm }}>‹</button>
            <span style={{ fontWeight: 700, fontSize: 12 }}>{weekDays[0].getDate()} {MESI[weekDays[0].getMonth()].slice(0,3)} – {weekDays[weekDays.length - 1].getDate()} {MESI[weekDays[weekDays.length - 1].getMonth()].slice(0,3)}</span>
            <button onClick={() => navSettimana(1)} style={{ background: C.bg, border: 'none', borderRadius: 7, width: 30, height: 30, cursor: 'pointer', fontSize: 16, color: C.txm }}>›</button>
            <button onClick={() => setSelDay(t)} style={{ background: C.priL, border: 'none', borderRadius: 7, padding: '4px 8px', color: C.pri, fontWeight: 700, fontSize: 10, cursor: 'pointer' }}>Oggi</button>
          </>}
          {view === 'mese' && <>
            <button onClick={() => navMese(-1)} style={{ background: C.bg, border: 'none', borderRadius: 7, width: 30, height: 30, cursor: 'pointer', fontSize: 16, color: C.txm }}>‹</button>
            <span style={{ fontWeight: 700, fontSize: 12 }}>{MESI[vd.getMonth()]} {vd.getFullYear()}</span>
            <button onClick={() => navMese(1)} style={{ background: C.bg, border: 'none', borderRadius: 7, width: 30, height: 30, cursor: 'pointer', fontSize: 16, color: C.txm }}>›</button>
            <button onClick={() => setVd(new Date())} style={{ background: C.priL, border: 'none', borderRadius: 7, padding: '4px 8px', color: C.pri, fontWeight: 700, fontSize: 10, cursor: 'pointer' }}>Oggi</button>
          </>}
        </div>
        <button onClick={() => { setTmpI(oraInizio); setTmpF(oraFine); setTmpS(slotMin); setTmpZ(zoom); setTmpHidden(hiddenWeekdays); setSettingsOpen(true); }} style={{ background: C.bg, border: `1px solid ${C.brd}`, borderRadius: 8, padding: '6px 8px', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
          <Ic n="set" s={15} c={C.txm} />
        </button>
        <Btn ch="+ Impegno" v="sec" onClick={() => apriNuovoImpegno()} />
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
            <Crd
              onWheel={e => {
                const now = Date.now();
                if (now - (wheelRef.current || 0) < 350) return; // throttle: uno scatto di mese per volta
                if (Math.abs(e.deltaY) < 15) return;
                wheelRef.current = now;
                navMese(e.deltaY > 0 ? 1 : -1);
              }}
              onTouchStart={e => { touchXRef.current = e.touches[0].clientX; }}
              onTouchEnd={e => {
                if (touchXRef.current == null) return;
                const dx = e.changedTouches[0].clientX - touchXRef.current;
                if (Math.abs(dx) > 50) navMese(dx < 0 ? 1 : -1);
                touchXRef.current = null;
              }}
              style={{ marginBottom: 10 }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                <button onClick={() => navMese(-1)} style={{ background: C.bg, border: 'none', borderRadius: 7, width: 32, height: 32, cursor: 'pointer', fontSize: 17, color: C.txm }}>‹</button>
                <span style={{ fontWeight: 700 }}>{MESI[mese]} {K}</span>
                <button onClick={() => navMese(1)} style={{ background: C.bg, border: 'none', borderRadius: 7, width: 32, height: 32, cursor: 'pointer', fontSize: 17, color: C.txm }}>›</button>
              </div>
              <div style={{ textAlign: 'center', fontSize: 10, color: C.txl, marginBottom: 6 }}>Scorri con la rotellina o trascina per cambiare mese</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 2, marginBottom: 4 }}>
                {['L','M','M','G','V','S','D'].map((d, i) => <div key={i} style={{ textAlign: 'center', fontSize: 10, fontWeight: 700, color: C.txm, padding: '2px 0' }}>{d}</div>)}
                {celle.map((g, i) => {
                  if (!g) return <div key={i} />;
                  const ds = `${K}-${String(mese+1).padStart(2,'0')}-${String(g).padStart(2,'0')}`;
                  const cnt = appointments.filter(a => a.data === ds).length;
                  const dayImp = (impegni || []).filter(imp => ds >= imp.dataInizio && ds <= imp.dataFine);
                  const isSel = ds === selDay, isTod = ds === t;
                  return (
                    <div key={i} onClick={() => { setSelDay(ds); setView('giorno'); }} style={{ textAlign: 'center', padding: '5px 2px', borderRadius: 7, cursor: 'pointer', background: isSel ? C.pri : isTod ? C.priL : 'transparent', color: isSel ? '#fff' : isTod ? C.pri : C.txt, fontWeight: isSel || isTod ? 700 : 400, fontSize: 12, position: 'relative', minHeight: 28 }}>
                      {dayImp.length > 0 && (
                        <div style={{ display: 'flex', gap: 1, position: 'absolute', top: 2, left: 3, right: 3, height: 3 }}>
                          {dayImp.slice(0, 3).map((imp) => (
                            <div key={imp.id} style={{ flex: 1, height: 3, borderRadius: 2, background: imp.colore || TIPO_IMPEGNO.find(x => x.id === imp.tipo)?.colore || C.pri }} />
                          ))}
                        </div>
                      )}
                      {g}
                      {cnt > 0 && <div style={{ display: 'flex', gap: 1, justifyContent: 'center', position: 'absolute', bottom: 1, left: '50%', transform: 'translateX(-50%)' }}>
                        {Array.from({ length: Math.min(cnt, 3) }, (_, j) => <div key={j} style={{ width: 4, height: 4, borderRadius: '50%', background: isSel ? '#fff' : C.pri }} />)}
                      </div>}
                    </div>
                  );
                })}
              </div>
            </Crd>
            {(impegni || []).filter(imp => selDay >= imp.dataInizio && selDay <= imp.dataFine).map(imp => {
              const co = imp.colore || TIPO_IMPEGNO.find(x => x.id === imp.tipo)?.colore || C.pri;
              return (
                <Crd key={imp.id} style={{ marginBottom: 8, borderLeft: `4px solid ${co}`, cursor: 'pointer' }} onClick={() => apriEditImpegno(imp)}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ background: co + '20', borderRadius: 7, padding: '4px 9px', textAlign: 'center', flexShrink: 0 }}>
                      <div style={{ fontSize: 10, fontWeight: 900, color: co, textTransform: 'uppercase' }}>{TIPO_IMPEGNO.find(x => x.id === imp.tipo)?.label || imp.tipo}</div>
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 700 }}>{imp.titolo}</div>
                      <div style={{ fontSize: 11, color: C.txm }}>{imp.tuttoIlGiorno ? 'Tutto il giorno' : `${(imp.oraInizio || '').slice(0,5)} – ${(imp.oraFine || '').slice(0,5)}`}{imp.dataInizio !== imp.dataFine ? ` · ${fmtD(imp.dataInizio)} – ${fmtD(imp.dataFine)}` : ''}</div>
                    </div>
                  </div>
                </Crd>
              );
            })}
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
          <div style={{ fontSize: 12, color: C.txm, marginBottom: 14 }}>Il Setup Agenda vale per tutto lo studio: chiunque acceda vedrà la stessa configurazione.</div>
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
          <Fld label="Zoom griglia">
            <Sel value={tmpZ} onChange={e => setTmpZ(Number(e.target.value))}>
              <option value={0.6}>Compatto — vedo più ore insieme</option>
              <option value={0.8}>Ridotto</option>
              <option value={1}>Normale (consigliato)</option>
              <option value={1.3}>Grande</option>
              <option value={1.6}>Molto grande — più leggibile</option>
            </Sel>
          </Fld>
          {tmpI >= tmpF && <div style={{ background: C.danL, borderRadius: 8, padding: '8px 12px', marginBottom: 8, fontSize: 12, color: C.dan, fontWeight: 700 }}>⚠️ L'ora di inizio deve essere prima dell'ora di fine</div>}
          <div style={{ background: C.bg, borderRadius: 9, padding: '9px 12px', marginBottom: 14 }}>
            <div style={{ fontSize: 11, color: C.txm, fontWeight: 700 }}>{String(tmpI).padStart(2,'0')}:00 — {String(tmpF).padStart(2,'0')}:00 · slot da {tmpS} min · {Math.ceil((tmpF - tmpI) * 60 / tmpS)} slot totali</div>
          </div>
          <Fld label="Giorni visibili in vista Settimana">
            <div style={{ display: 'flex', gap: 4 }}>
              {WD_SHORT.map((lbl, wd) => {
                const isHidden = tmpHidden.includes(wd);
                return (
                  <button key={wd} onClick={() => setTmpHidden(h => isHidden ? h.filter(x => x !== wd) : [...h, wd])} style={{ flex: 1, padding: '8px 0', borderRadius: 8, border: `1.5px solid ${isHidden ? C.brd : C.pri}`, background: isHidden ? C.bg : C.priL, color: isHidden ? C.txl : C.pri, fontWeight: 700, fontSize: 10.5, cursor: 'pointer' }}>{lbl}</button>
                );
              })}
            </div>
            <div style={{ fontSize: 10.5, color: C.txl, marginTop: 5 }}>Tocca un giorno per nasconderlo dalla vista Settimana (es. domenica se lo studio è chiuso)</div>
          </Fld>
          <div style={{ fontSize: 11, color: C.txl, marginTop: 4, marginBottom: 4 }}>Salvando, queste impostazioni valgono per tutto lo studio, non solo per questo dispositivo.</div>
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
          {!editApp && (
            <Fld label="Ripeti">
              <Sel value={form.ripeti} onChange={e => F({ ripeti: e.target.value, ripetiFino: e.target.value === 'nessuna' ? '' : form.ripetiFino })}>
                <option value="nessuna">Non si ripete</option>
                <option value="giornaliera">Ogni giorno</option>
                <option value="settimanale">Ogni settimana</option>
                <option value="mensile">Ogni mese</option>
              </Sel>
              {form.ripeti !== 'nessuna' && (
                <div style={{ marginTop: 8 }}>
                  <Fld label="Ripeti fino al">
                    <Inp type="date" value={form.ripetiFino} min={form.data} onChange={e => F({ ripetiFino: e.target.value })} />
                  </Fld>
                  {form.ripetiFino && (
                    <div style={{ fontSize: 11, color: C.txm, marginTop: -4 }}>
                      Verranno creati {generaDateRipetizione(form.data, form.ripeti, form.ripetiFino).length} appuntamenti
                    </div>
                  )}
                </div>
              )}
            </Fld>
          )}
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            {editApp && <Btn ch="Elimina" v="dan" onClick={() => { del(editApp.id); setModal(false); }} />}
            <Btn ch="Annulla" v="sec" onClick={() => setModal(false)} full />
            <Btn ch={editApp ? 'Aggiorna' : 'Salva'} onClick={save} dis={!form.pazienteId || (!editApp && form.ripeti !== 'nessuna' && !form.ripetiFino)} full />
          </div>
        </Modal>
      )}

      {/* MODAL IMPEGNO PERSONALE */}
      {impModal && (
        <Modal title={editImp ? '✏️ Modifica impegno' : '🗓️ Nuovo impegno personale'} onClose={() => setImpModal(false)}>
          <Fld label="Titolo"><Inp value={impForm.titolo} onChange={e => IF({ titolo: e.target.value })} placeholder="Es. Ferie, Chiamata commercialista…" autoFocus /></Fld>
          <Fld label="Tipo">
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {TIPO_IMPEGNO.map(tp => (
                <button key={tp.id} onClick={() => IF({ tipo: tp.id, colore: '' })} style={{ padding: '5px 10px', borderRadius: 20, border: `1.5px solid ${impForm.tipo === tp.id ? tp.colore : C.brd}`, background: impForm.tipo === tp.id ? tp.colore + '18' : C.sur, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: tp.colore }} />
                  <span style={{ fontSize: 11, fontWeight: impForm.tipo === tp.id ? 700 : 500, color: impForm.tipo === tp.id ? tp.colore : C.txm }}>{tp.label}</span>
                </button>
              ))}
            </div>
          </Fld>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <Fld label="Dal"><Inp type="date" value={impForm.dataInizio} onChange={e => IF({ dataInizio: e.target.value, dataFine: e.target.value > impForm.dataFine ? e.target.value : impForm.dataFine })} /></Fld>
            <Fld label="Al"><Inp type="date" value={impForm.dataFine} onChange={e => IF({ dataFine: e.target.value })} /></Fld>
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, cursor: 'pointer' }}>
            <input type="checkbox" checked={impForm.tuttoIlGiorno} onChange={e => IF({ tuttoIlGiorno: e.target.checked })} />
            <span style={{ fontSize: 12, fontWeight: 600, color: C.txm }}>Tutto il giorno</span>
          </label>
          {!impForm.tuttoIlGiorno && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <Fld label="Dalle"><Inp type="time" value={impForm.oraInizio} onChange={e => IF({ oraInizio: e.target.value })} /></Fld>
              <Fld label="Alle"><Inp type="time" value={impForm.oraFine} onChange={e => IF({ oraFine: e.target.value })} /></Fld>
            </div>
          )}
          <Fld label="Note (opzionale)"><Txt value={impForm.note} onChange={e => IF({ note: e.target.value })} /></Fld>
          {impForm.dataFine < impForm.dataInizio && <div style={{ background: C.danL, borderRadius: 8, padding: '8px 12px', marginBottom: 8, fontSize: 12, color: C.dan, fontWeight: 700 }}>⚠️ La data di fine deve essere uguale o successiva alla data di inizio</div>}
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            {editImp && <Btn ch="Elimina" v="dan" onClick={delImpegno} />}
            <Btn ch="Annulla" v="sec" onClick={() => setImpModal(false)} full />
            <Btn ch={editImp ? 'Aggiorna' : 'Salva'} onClick={saveImpegno} dis={!impForm.titolo.trim() || impForm.dataFine < impForm.dataInizio} full />
          </div>
        </Modal>
      )}
    </div>
  );
}
