import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase.js';
import { Btn, Crd, Fld, Modal, Toast, Bdg, Ic, StatCard, SelettorePaziente, PageHeader, EmptyState, Sel } from './ui';
import { C, today, TODO_CATEGORIE } from '../lib/utils';
import { buildActivityText } from '../lib/appointmentQuickHub.js';

const CATEGORIE_FILTRO = [
  { id: 'tutte', label: 'Tutte', icona: null },
  ...Object.entries(TODO_CATEGORIE).map(([id, c]) => ({ id, label: c.label, icona: c.icona })),
];

/* ── SEZIONE ATTIVITÀ (POL-UI-034) ──
   Product Owner: "Attività e promemoria: dobbiamo mettere in modo che
   siano classificate con etichette visibili... e poi deve esserci una
   sezione attività in modo che sia tutto più chiaro". Stessa struttura di
   Richiami.jsx (filtro per categoria, tabbar Da fare/Fatte, card con
   badge colorato), ma sulla tabella `todos` — le stesse Attività già
   mostrate nel widget Home, qui filtrabili/gestibili in un posto solo. */
export default function Attivita({ patients, onOpenPaz }) {
  const [todoList, setTodoList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filtroCategoria, setFiltroCategoria] = useState('tutte');
  const [mostraFatte, setMostraFatte] = useState(false);
  const [modal, setModal] = useState(false);
  const [testo, setTesto] = useState('');
  const [pazienteId, setPazienteId] = useState('');
  const [pazSearch, setPazSearch] = useState('');
  const [categoria, setCategoria] = useState('GENERICO');
  const [toast, setToast] = useState('');

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase.from('todos').select('*').order('created_at', { ascending: false });
    if (!error && data) setTodoList(data);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const closeModal = () => { setModal(false); setTesto(''); setPazienteId(''); setPazSearch(''); setCategoria('GENERICO'); };

  const save = async () => {
    if (!testo.trim()) return;
    const patient = patients.find((p) => String(p.id) === String(pazienteId));
    const nuova = { id: Date.now(), testo: buildActivityText(testo, patient), fatto: false, data: today(), paziente_id: pazienteId || null, categoria };
    const { error } = await supabase.from('todos').insert([nuova]);
    if (!error) {
      setTodoList((prev) => [nuova, ...prev]);
      closeModal();
      setToast('Attività creata ✓');
    }
  };

  const toggleFatto = async (t) => {
    const { error } = await supabase.from('todos').update({ fatto: !t.fatto }).eq('id', t.id);
    if (!error) setTodoList((prev) => prev.map((x) => (x.id === t.id ? { ...x, fatto: !x.fatto } : x)));
  };

  const elimina = async (id) => {
    if (!confirm('Eliminare questa attività?')) return;
    const { error } = await supabase.from('todos').delete().eq('id', id);
    if (!error) setTodoList((prev) => prev.filter((x) => x.id !== id));
  };

  const attive = todoList.filter((t) => !t.fatto);
  const fatte = todoList.filter((t) => t.fatto);

  const filtrate = todoList
    .filter((t) => (filtroCategoria === 'tutte' || t.categoria === filtroCategoria))
    .filter((t) => (mostraFatte ? t.fatto : !t.fatto));

  return (
    <div>
      {toast && <Toast msg={toast} onDone={() => setToast('')} />}

      <PageHeader icon="clip" title="Attività" actions={
        <Btn ch="Attività" ic="plus" onClick={() => setModal(true)} />
      } />

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
        <StatCard icon="okc" color={C.dan} value={attive.length} label="Da fare" />
        <StatCard icon="ok" color={C.suc} value={fatte.length} label="Completate" />
      </div>

      <div className="pol-tabbar" style={{ marginBottom: 10, paddingBottom: 2 }}>
        {CATEGORIE_FILTRO.map((c) => (
          <button key={c.id} onClick={() => setFiltroCategoria(c.id)} className={`pol-tab${filtroCategoria === c.id ? ' is-active' : ''}`} style={{ display: 'flex', alignItems: 'center', gap: 5, background: filtroCategoria === c.id ? C.priL : C.sur, color: filtroCategoria === c.id ? C.pri : C.txm, border: `1.5px solid ${filtroCategoria === c.id ? C.pri : C.brd}` }}>
            {c.icona && <Ic n={c.icona} s={11} c={filtroCategoria === c.id ? C.pri : C.txm} />}{c.label}
          </button>
        ))}
      </div>

      <div style={{ display: 'flex', background: C.bg, borderRadius: 10, border: `1px solid ${C.brd}`, marginBottom: 14, overflow: 'hidden' }}>
        {[[false, `Da fare (${attive.length})`], [true, `Fatte (${fatte.length})`]].map(([v, lbl]) => (
          <button key={String(v)} onClick={() => setMostraFatte(v)} style={{ flex: 1, padding: '10px 0', border: 'none', background: mostraFatte === v ? C.pri : 'transparent', color: mostraFatte === v ? '#fff' : C.txm, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>{lbl}</button>
        ))}
      </div>

      {loading && <div style={{ fontSize: 12, color: C.txl, textAlign: 'center', padding: '14px 0' }}>Caricamento...</div>}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
        {!loading && filtrate.map((t) => {
          const cat = TODO_CATEGORIE[t.categoria] || TODO_CATEGORIE.GENERICO;
          const paz = t.paziente_id != null ? patients.find((p) => String(p.id) === String(t.paziente_id)) : null;
          return (
            <Crd key={t.id} style={{ borderLeft: `3px solid ${cat.colore}` }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  {paz ? (
                    <div onClick={() => onOpenPaz(paz, 'piani')} style={{ fontWeight: 700, fontSize: 13, color: C.pri, cursor: 'pointer' }}>{paz.nome} {paz.cognome} ›</div>
                  ) : null}
                  <div style={{ fontSize: 12, color: C.txt, marginTop: paz ? 2 : 0 }}>{t.testo}</div>
                  <div style={{ marginTop: 5, display: 'flex', gap: 5, flexWrap: 'wrap', alignItems: 'center' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Ic n={cat.icona} s={11} c={cat.colore} /><Bdg ch={cat.label} co={cat.colore} /></span>
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 5, flexShrink: 0 }}>
                  {!t.fatto
                    ? <button onClick={() => toggleFatto(t)} style={{ background: C.sucL, border: 'none', borderRadius: 7, padding: '5px 8px', cursor: 'pointer' }} title="Segna fatta"><Ic n="ok" s={13} c={C.suc} /></button>
                    : <button onClick={() => toggleFatto(t)} style={{ background: C.priL, border: 'none', borderRadius: 7, padding: '5px 8px', cursor: 'pointer' }} title="Riapri"><Ic n="clk" s={13} c={C.pri} /></button>}
                  <button onClick={() => elimina(t.id)} style={{ background: C.danL, border: 'none', borderRadius: 7, padding: '5px 8px', cursor: 'pointer' }} title="Elimina"><Ic n="del" s={13} c={C.dan} /></button>
                </div>
              </div>
            </Crd>
          );
        })}
        {!loading && filtrate.length === 0 && <EmptyState icon="clip" title={mostraFatte ? 'Nessuna attività completata' : 'Nessuna attività da gestire'} />}
      </div>

      {modal && (
        <Modal title="+ Nuova attività" icon="clip" onClose={closeModal}>
          <Fld label="Titolo">
            <textarea value={testo} onChange={(e) => setTesto(e.target.value)} autoFocus rows={4} placeholder="es. Ordinare materiale" style={{ width: '100%', padding: '11px 12px', border: `1.5px solid ${C.brd}`, borderRadius: 10, fontSize: 13, color: C.txt, background: C.sur, boxSizing: 'border-box', resize: 'vertical', fontFamily: 'inherit' }} />
          </Fld>
          <Fld label="Paziente (opzionale)">
            <SelettorePaziente patients={patients} value={pazienteId} onChange={(id) => setPazienteId(id || '')} search={pazSearch} onSearchChange={setPazSearch} placeholder="Nessun paziente" />
            {pazienteId && <button type="button" onClick={() => setPazienteId('')} style={{ marginTop: 5, padding: 0, border: 0, background: 'none', color: C.txm, fontSize: 11, cursor: 'pointer' }}>Rimuovi associazione</button>}
          </Fld>
          <Fld label="Categoria">
            <Sel value={categoria} onChange={(e) => setCategoria(e.target.value)}>
              {Object.entries(TODO_CATEGORIE).map(([id, c]) => <option key={id} value={id}>{c.label}</option>)}
            </Sel>
          </Fld>
          <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
            <Btn ch="Annulla" v="sec" onClick={closeModal} full />
            <Btn ch="Aggiungi" onClick={save} dis={!testo.trim()} full />
          </div>
        </Modal>
      )}
    </div>
  );
}
