import React, { useState } from 'react';
import { Btn, Crd, Fld, Inp, Sel, Txt, Modal, Toast, Bdg, Ic, PhStr } from './ui';
import { C, uid, fmtD, today, DEF_APP_TYPES } from '../lib/utils';

const WD = ['D', 'L', 'M', 'M', 'G', 'V', 'S'];
const WD_FULL = ['Domenica', 'Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato'];
const MESI = ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno', 'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'];

const toISO = (d) => d.toISOString().slice(0, 10);
const startOfWeek = (d) => {
  const dt = new Date(d);
  const day = dt.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  dt.setDate(dt.getDate() + diff);
  return dt;
};

export default function Agenda({ patients, appointments, setAppointments, appTypes }) {
  const [modal, setModal] = useState(false);
  const [selDay, setSelDay] = useState(today());
  const [view, setView] = useState('mese');
  const tipiList = appTypes && appTypes.length ? appTypes : DEF_APP_TYPES;
  const [form, setForm] = useState({ pazienteId: '', data: today(), ora: '09:00', durata: 30, tipo: tipiList[0]?.nome || 'Visita di controllo', colore: tipiList[0]?.colore || C.pri, note: '', stato: 'confermato' });
  const [toast, setToast] = useState('');
  const F = (f) => setForm((p) => ({ ...p, ...f }));
  const [vd, setVd] = useState(new Date());

  const getColore = (a) => a.colore || tipiList.find((t) => t.nome === a.tipo)?.colore || C.pri;

  const save = () => {
    if (!form.pazienteId) return;
    setAppointments((p) => [...p, { ...form, id: uid(), pazienteId: Number(form.pazienteId), durata: Number(form.durata) }]);
    setModal(false);
    setToast('Salvato ✓');
  };
  const del = (id) => { if (confirm('Eliminare?')) setAppointments((p) => p.filter((a) => a.id !== id)); };
  const sendWA = (a) => {
    const p = patients.find((x) => x.id === a.pazienteId);
    if (!p) return;
    const msg = encodeURIComponent(`Gentile ${p.nome},\nricordiamo il suo appuntamento:\n📅 ${fmtD(a.data)} alle ${a.ora}\n🦷 ${a.tipo}\nPer variazioni contattarci entro 24h. Grazie!`);
    window.open(`https://wa.me/39${p.telefono.replace(/\D/g, '')}?text=${msg}`, '_blank');
  };
  const apriNuovo = (data) => { setForm({ pazienteId: '', data: data || selDay, ora: '09:00', durata: 30, tipo: tipiList[0]?.nome || 'Visita di controllo', colore: tipiList[0]?.colore || C.pri, note: '', stato: 'confermato' }); setModal(true); };
  const selTipo = (nome) => { const t = tipiList.find((x) => x.nome === nome); F({ tipo: nome, colore: t ? t.colore : C.pri }); };

  const AppCard = ({ a }) => {
    const p = patients.find((x) => x.id === a.pazienteId);
    const co = getColore(a);
    return (
      <Crd style={{ borderLeft: `4px solid ${co}`, marginBottom: 9 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 9 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 800, fontSize: 15 }}>{a.ora} <span style={{ color: C.txl, fontWeight: 400, fontSize: 12 }}>{a.durata}min</span></div>
            <div style={{ fontWeight: 700, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p ? `${p.nome} ${p.cognome}` : '—'}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 2 }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: co, flexShrink: 0 }} />
              <span style={{ fontSize: 12, color: C.txm }}>{a.tipo}</span>
            </div>
            {a.note && <div style={{ fontSize: 11, color: C.txl, marginTop: 1 }}>{a.note}</div>}
            {p?.telefono && <PhStr tel={p.telefono} />}
            <div style={{ marginTop: 5 }}><Bdg ch={a.stato} co={a.stato === 'confermato' ? C.suc : C.war} /></div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5, flexShrink: 0 }}>
            <button onClick={() => sendWA(a)} style={{ background: '#25D366', border: 'none', borderRadius: 7, padding: 7, cursor: 'pointer', display: 'flex' }}><Ic n="wa" s={16} c="#fff" /></button>
            <button onClick={() => del(a.id)} style={{ background: C.danL, border: 'none', borderRadius: 7, padding: 7, cursor: 'pointer', display: 'flex' }}><Ic n="del" s={15} c={C.dan} /></button>
          </div>
        </div>
      </Crd>
    );
  };

  const ViewSwitch = () => (
    <div style={{ display: 'flex', background: C.sur, borderRadius: 9, border: `1px solid ${C.brd}`, marginBottom: 11, overflow: 'hidden' }}>
      {[['giorno', 'Giorno'], ['settimana', 'Settimana'], ['mese', 'Mese']].map(([id, l]) => (
        <button key={id} onClick={() => setView(id)} style={{ flex: 1, padding: '9px 4px', background: view === id ? C.pri : 'transparent', border: 'none', color: view === id ? '#fff' : C.txm, fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>{l}</button>
      ))}
    </div>
  );

  const ViewGiorno = () => {
    const dt = new Date(selDay + 'T12:00');
    const dayApps = appointments.filter((a) => a.data === selDay).sort((a, b) => a.ora.localeCompare(b.ora));
    const goDay = (n) => { const d = new Date(selDay + 'T12:00'); d.setDate(d.getDate() + n); setSelDay(toISO(d)); };
    return (
      <div>
        <Crd style={{ marginBottom: 11, padding: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <button onClick={() => goDay(-1)} style={{ background: C.bg, border: 'none', borderRadius: 7, width: 32, height: 32, cursor: 'pointer', fontSize: 17 }}>‹</button>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontWeight: 800, fontSize: 14 }}>{WD_FULL[dt.getDay()]}</div>
              <div style={{ fontSize: 12, color: C.txm }}>{dt.getDate()} {MESI[dt.getMonth()]} {dt.getFullYear()}</div>
            </div>
            <button onClick={() => goDay(1)} style={{ background: C.bg, border: 'none', borderRadius: 7, width: 32, height: 32, cursor: 'pointer', fontSize: 17 }}>›</button>
          </div>
          {selDay !== today() && <div style={{ textAlign: 'center', marginTop: 8 }}><button onClick={() => setSelDay(today())} style={{ background: C.priL, border: 'none', borderRadius: 7, padding: '5px 12px', color: C.pri, fontWeight: 700, fontSize: 11, cursor: 'pointer' }}>Vai a oggi</button></div>}
        </Crd>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 9 }}>
          <span style={{ fontWeight: 700, fontSize: 12, color: C.txm }}>{dayApps.length} appuntament{dayApps.length === 1 ? 'o' : 'i'}</span>
          <button onClick={() => apriNuovo(selDay)} style={{ background: C.priL, border: 'none', borderRadius: 7, padding: '5px 10px', color: C.pri, fontWeight: 700, fontSize: 11, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}><Ic n="plus" s={11} c={C.pri} />Aggiungi</button>
        </div>
        {dayApps.length === 0 && <div style={{ textAlign: 'center', color: C.txl, padding: '30px 0' }}>Nessun appuntamento</div>}
        {dayApps.map((a) => <AppCard key={a.id} a={a} />)}
      </div>
    );
  };

  const ViewSettimana = () => {
    const base = startOfWeek(new Date(selDay + 'T12:00'));
    const giorni = Array.from({ length: 7 }, (_, i) => { const d = new Date(base); d.setDate(d.getDate() + i); return d; });
    const goWeek = (n) => { const d = new Date(selDay + 'T12:00'); d.setDate(d.getDate() + n * 7); setSelDay(toISO(d)); };
    const t = today();
    const COL_W = 124;
    return (
      <div>
        <Crd style={{ marginBottom: 11, padding: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <button onClick={() => goWeek(-1)} style={{ background: C.bg, border: 'none', borderRadius: 7, width: 32, height: 32, cursor: 'pointer', fontSize: 17 }}>‹</button>
            <div style={{ fontWeight: 800, fontSize: 13 }}>{giorni[0].getDate()} {MESI[giorni[0].getMonth()].slice(0, 3)} – {giorni[6].getDate()} {MESI[giorni[6].getMonth()].slice(0, 3)} {giorni[6].getFullYear()}</div>
            <button onClick={() => goWeek(1)} style={{ background: C.bg, border: 'none', borderRadius: 7, width: 32, height: 32, cursor: 'pointer', fontSize: 17 }}>›</button>
          </div>
        </Crd>
        <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch', marginLeft: -13, marginRight: -13, paddingLeft: 13, paddingRight: 13 }}>
          <div style={{ display: 'flex', gap: 7, minWidth: COL_W * 7 + 6 * 7 }}>
            {giorni.map((d, i) => {
              const dayS = toISO(d);
              const apps = appointments.filter((a) => a.data === dayS).sort((a, b) => a.ora.localeCompare(b.ora));
              const isT = dayS === t;
              return (
                <div key={i} style={{ width: COL_W, flexShrink: 0, display: 'flex', flexDirection: 'column' }}>
                  <div onClick={() => { setSelDay(dayS); setView('giorno'); }} style={{ cursor: 'pointer', textAlign: 'center', padding: '8px 4px', borderRadius: 9, background: isT ? C.pri : C.sur, border: `1px solid ${isT ? C.pri : C.brd}`, marginBottom: 7, position: 'sticky', top: 0 }}>
                    <div style={{ fontSize: 9, fontWeight: 700, color: isT ? 'rgba(255,255,255,0.8)' : C.txm, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{WD_FULL[d.getDay()].slice(0, 3)}</div>
                    <div style={{ fontSize: 17, fontWeight: 800, color: isT ? '#fff' : C.txt, lineHeight: 1.3 }}>{d.getDate()}</div>
                    {apps.length > 0 && <div style={{ fontSize: 9, fontWeight: 700, color: isT ? '#fff' : C.pri, marginTop: 1 }}>{apps.length} app.</div>}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 5, flex: 1 }}>
                    {apps.length === 0 && <div style={{ textAlign: 'center', color: C.txl, fontSize: 10, padding: '10px 0' }}>—</div>}
                    {apps.map((a) => {
                      const p = patients.find((x) => x.id === a.pazienteId);
                      const co = getColore(a);
                      return (
                        <div key={a.id} onClick={() => { setSelDay(dayS); setView('giorno'); }} style={{ background: C.sur, borderRadius: 7, padding: '6px 7px', border: `1px solid ${C.brd}`, borderLeft: `3px solid ${co}`, cursor: 'pointer' }}>
                          <div style={{ fontSize: 11, fontWeight: 800, color: C.priD }}>{a.ora}</div>
                          <div style={{ fontSize: 11, fontWeight: 600, color: C.txt, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p ? `${p.nome} ${p.cognome}` : '—'}</div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                            <div style={{ width: 6, height: 6, borderRadius: '50%', background: co, flexShrink: 0 }} />
                            <span style={{ fontSize: 9, color: C.txl, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.tipo}</span>
                          </div>
                        </div>
                      );
                    })}
                    <button onClick={() => apriNuovo(dayS)} style={{ background: 'transparent', border: `1.5px dashed ${C.brd}`, borderRadius: 7, padding: '6px 0', color: C.txl, fontSize: 10, fontWeight: 700, cursor: 'pointer', marginTop: 2 }}>+ Aggiungi</button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  };

  const ViewMese = () => {
    const yr = vd.getFullYear(), mo = vd.getMonth();
    const fd = new Date(yr, mo, 1).getDay();
    const dim = new Date(yr, mo + 1, 0).getDate();
    const cells = Array(fd).fill(null).concat(Array.from({ length: dim }, (_, i) => i + 1));
    const ds = (d) => `${yr}-${String(mo + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const dayApps = appointments.filter((a) => a.data === selDay).sort((a, b) => a.ora.localeCompare(b.ora));
    return (
      <div>
        <Crd style={{ marginBottom: 11 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <button onClick={() => setVd((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1))} style={{ background: C.bg, border: 'none', borderRadius: 7, width: 32, height: 32, cursor: 'pointer', fontSize: 17, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>‹</button>
            <span style={{ fontWeight: 700, fontSize: 13 }}>{MESI[mo]} {yr}</span>
            <button onClick={() => setVd((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1))} style={{ background: C.bg, border: 'none', borderRadius: 7, width: 32, height: 32, cursor: 'pointer', fontSize: 17, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>›</button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 2 }}>
            {WD.map((d, i) => <div key={i} style={{ textAlign: 'center', fontSize: 10, fontWeight: 700, color: C.txm, padding: '2px 0' }}>{d}</div>)}
            {cells.map((d, i) => {
              if (!d) return <div key={i} />;
              const dayS = ds(d);
              const dApps = appointments.filter((a) => a.data === dayS);
              const isSel = dayS === selDay, isT = dayS === today();
              const coloriGiorno = [...new Set(dApps.map((a) => getColore(a)))].slice(0, 3);
              return (
                <div key={i} onClick={() => setSelDay(dayS)} style={{ textAlign: 'center', padding: '6px 2px', borderRadius: 7, cursor: 'pointer', background: isSel ? C.pri : isT ? C.priL : 'transparent', color: isSel ? '#fff' : isT ? C.pri : C.txt, fontWeight: isSel || isT ? 700 : 400, fontSize: 12, position: 'relative' }}>
                  {d}
                  {coloriGiorno.length > 0 && (
                    <div style={{ display: 'flex', gap: 2, justifyContent: 'center', position: 'absolute', bottom: 2, left: '50%', transform: 'translateX(-50%)' }}>
                      {coloriGiorno.map((co, ci) => <div key={ci} style={{ width: 4, height: 4, borderRadius: '50%', background: isSel ? '#fff' : co }} />)}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </Crd>
        <div style={{ fontWeight: 700, fontSize: 12, marginBottom: 9, color: C.txm }}>{fmtD(selDay)} · {dayApps.length} appuntament{dayApps.length === 1 ? 'o' : 'i'}</div>
        {dayApps.length === 0 && <div style={{ textAlign: 'center', color: C.txl, padding: '20px 0' }}>Nessun appuntamento</div>}
        {dayApps.map((a) => <AppCard key={a.id} a={a} />)}
      </div>
    );
  };

  return (
    <div>
      {toast && <Toast msg={toast} onDone={() => setToast('')} />}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <div style={{ fontSize: 20, fontWeight: 800 }}>Agenda</div>
        <Btn ch="Nuovo" ic="plus" onClick={() => apriNuovo()} />
      </div>
      <ViewSwitch />
      {view === 'giorno' && <ViewGiorno />}
      {view === 'settimana' && <ViewSettimana />}
      {view === 'mese' && <ViewMese />}
      {modal && (
        <Modal title="Nuovo appuntamento" onClose={() => setModal(false)}>
          <Fld label="Paziente">
            <Sel value={form.pazienteId} onChange={(e) => F({ pazienteId: e.target.value })}>
              <option value="">Seleziona…</option>
              {patients.map((p) => <option key={p.id} value={p.id}>{p.nome} {p.cognome}</option>)}
            </Sel>
          </Fld>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <Fld label="Data"><Inp type="date" value={form.data} onChange={(e) => F({ data: e.target.value })} /></Fld>
            <Fld label="Ora"><Inp type="time" value={form.ora} onChange={(e) => F({ ora: e.target.value })} /></Fld>
            <Fld label="Durata">
              <Sel value={form.durata} onChange={(e) => F({ durata: e.target.value })}>
                {[15, 30, 45, 60, 90, 120].map((d) => <option key={d} value={d}>{d} min</option>)}
              </Sel>
            </Fld>
            <Fld label="Stato">
              <Sel value={form.stato} onChange={(e) => F({ stato: e.target.value })}>
                <option value="confermato">Confermato</option><option value="da confermare">Da confermare</option><option value="annullato">Annullato</option>
              </Sel>
            </Fld>
          </div>
          <Fld label="Tipo visita (colore)">
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {tipiList.map((t) => {
                const sel = form.tipo === t.nome;
                return (
                  <button key={t.id} onClick={() => selTipo(t.nome)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 11px', borderRadius: 20, border: `1.5px solid ${sel ? t.colore : C.brd}`, background: sel ? t.colore + '18' : C.sur, cursor: 'pointer' }}>
                    <div style={{ width: 9, height: 9, borderRadius: '50%', background: t.colore, flexShrink: 0 }} />
                    <span style={{ fontSize: 12, fontWeight: sel ? 700 : 500, color: sel ? t.colore : C.txm }}>{t.nome}</span>
                  </button>
                );
              })}
            </div>
          </Fld>
          <Fld label="Descrizione (opzionale)"><Inp value={form.tipo} onChange={(e) => F({ tipo: e.target.value })} placeholder="Personalizza il testo del tipo visita" /></Fld>
          <Fld label="Note"><Txt value={form.note} onChange={(e) => F({ note: e.target.value })} /></Fld>
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <Btn ch="Annulla" v="sec" onClick={() => setModal(false)} full />
            <Btn ch="Salva" onClick={save} full />
          </div>
        </Modal>
      )}
    </div>
  );
}
