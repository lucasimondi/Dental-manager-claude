import React, { useState, useEffect } from 'react';
import { Btn, Crd, Fld, Inp, Sel, Modal, Toast, Ic } from './ui';
import { C, fmt, fmtD, today } from '../lib/utils';
import { supabase } from '../lib/supabase.js';

const CATEGORIE = ['Materiali', 'Attrezzature', 'Affitto', 'Personale', 'Utenze', 'Assicurazioni', 'Software', 'Formazione', 'Tasse', 'Altro'];
const FREQUENZE = ['Mensile', 'Bimestrale', 'Trimestrale', 'Semestrale', 'Annuale'];
const MESI = ['Gen','Feb','Mar','Apr','Mag','Giu','Lug','Ago','Set','Ott','Nov','Dic'];

export default function Spese() {
  const [spese, setSpese] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [toast, setToast] = useState('');
  const [filtroCategoria, setFiltroCategoria] = useState('');
  const [form, setForm] = useState({
    titolo: '', importo: '', data: today(), categoria: 'Altro',
    note: '', ricorrente: false, frequenza: 'Mensile',
  });
  const F = (f) => setForm(p => ({ ...p, ...f }));

  useEffect(() => { loadSpese(); }, []);

  const loadSpese = async () => {
    setLoading(true);
    const { data } = await supabase.from('spese').select('*').order('data', { ascending: false });
    if (data) setSpese(data);
    setLoading(false);
  };

  const openNuova = () => {
    setEditItem(null);
    setForm({ titolo: '', importo: '', data: today(), categoria: 'Altro', note: '', ricorrente: false, frequenza: 'Mensile' });
    setModal(true);
  };

  const openEdit = (s) => {
    setEditItem(s);
    setForm({ titolo: s.titolo, importo: String(s.importo), data: s.data, categoria: s.categoria || 'Altro', note: s.note || '', ricorrente: s.ricorrente || false, frequenza: s.frequenza || 'Mensile' });
    setModal(true);
  };

  const save = async () => {
    if (!form.titolo || !form.importo) return;
    const record = { ...form, importo: Number(form.importo) };
    if (editItem) {
      const { error } = await supabase.from('spese').update(record).eq('id', editItem.id);
      if (!error) { setSpese(prev => prev.map(s => s.id === editItem.id ? { ...s, ...record } : s)); setToast('Aggiornata ✓'); }
    } else {
      const nuova = { ...record, id: Date.now() };
      const { error } = await supabase.from('spese').insert([nuova]);
      if (!error) { setSpese(prev => [nuova, ...prev]); setToast('Aggiunta ✓'); }
    }
    setModal(false);
  };

  const del = async (id) => {
    if (!confirm('Eliminare questa spesa?')) return;
    await supabase.from('spese').delete().eq('id', id);
    setSpese(prev => prev.filter(s => s.id !== id));
  };

  // Calcola spese ricorrenti proiettate all'anno corrente
  const anno = today().slice(0, 4);
  const calcolaAnnuale = () => {
    const speseNormali = spese.filter(s => !s.ricorrente && s.data.startsWith(anno)).reduce((sum, s) => sum + Number(s.importo), 0);
    const speseRicorrenti = spese.filter(s => s.ricorrente).reduce((sum, s) => {
      const moltiplicatore = { Mensile: 12, Bimestrale: 6, Trimestrale: 4, Semestrale: 2, Annuale: 1 }[s.frequenza] || 12;
      return sum + Number(s.importo) * moltiplicatore;
    }, 0);
    return speseNormali + speseRicorrenti;
  };

  const totaleAnno = calcolaAnnuale();
  const totaleMese = spese.filter(s => s.data.startsWith(today().slice(0, 7))).reduce((s, x) => s + Number(x.importo), 0);
  const totaleAll = spese.filter(s => !s.ricorrente).reduce((s, x) => s + Number(x.importo), 0);

  const speseFiltrate = filtroCategoria ? spese.filter(s => s.categoria === filtroCategoria) : spese;

  // Raggruppamento per categoria
  const perCategoria = CATEGORIE.map(cat => ({
    cat,
    tot: spese.filter(s => s.categoria === cat && !s.ricorrente).reduce((s, x) => s + Number(x.importo), 0),
    n: spese.filter(s => s.categoria === cat).length,
  })).filter(x => x.n > 0);

  return (
    <div>
      {toast && <Toast msg={toast} onDone={() => setToast('')} />}

      {/* HEADER */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <div style={{ fontSize: 20, fontWeight: 800 }}>Spese</div>
        <Btn ch="+ Nuova spesa" ic="plus" onClick={openNuova} />
      </div>

      {/* KPI CARDS */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 14 }}>
        <Crd style={{ padding: 12 }}>
          <div style={{ fontSize: 10, fontWeight: 800, color: C.dan, textTransform: 'uppercase' }}>Questo mese</div>
          <div style={{ fontSize: 20, fontWeight: 900, color: C.dan, marginTop: 2 }}>{fmt(totaleMese)}</div>
        </Crd>
        <Crd style={{ padding: 12 }}>
          <div style={{ fontSize: 10, fontWeight: 800, color: C.war, textTransform: 'uppercase' }}>Totale registrate</div>
          <div style={{ fontSize: 20, fontWeight: 900, color: C.war, marginTop: 2 }}>{fmt(totaleAll)}</div>
        </Crd>
        <Crd style={{ padding: 12, gridColumn: '1 / -1', background: '#FFF5F5', border: `1px solid ${C.dan}30` }}>
          <div style={{ fontSize: 10, fontWeight: 800, color: C.dan, textTransform: 'uppercase' }}>Proiezione annuale {anno} (incluse ricorrenti)</div>
          <div style={{ fontSize: 22, fontWeight: 900, color: C.dan, marginTop: 2 }}>{fmt(totaleAnno)}</div>
          <div style={{ fontSize: 11, color: C.txl, marginTop: 2 }}>
            {spese.filter(s => s.ricorrente).length > 0 && `Include ${spese.filter(s => s.ricorrente).length} spese ricorrenti proiettate`}
          </div>
        </Crd>
      </div>

      {/* SPESE RICORRENTI */}
      {spese.filter(s => s.ricorrente).length > 0 && (
        <Crd style={{ marginBottom: 14, background: '#FEF3E2', border: `1px solid ${C.war}30` }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: C.war, textTransform: 'uppercase', marginBottom: 8 }}>🔄 Spese fisse/ricorrenti</div>
          {spese.filter(s => s.ricorrente).map(s => {
            const moltiplicatore = { Mensile: 12, Bimestrale: 6, Trimestrale: 4, Semestrale: 2, Annuale: 1 }[s.frequenza] || 12;
            return (
              <div key={s.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0', borderBottom: `1px solid ${C.brd}` }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: 13 }}>{s.titolo}</div>
                  <div style={{ fontSize: 11, color: C.txm }}>{s.frequenza} · {fmt(s.importo)} × {moltiplicatore} = <strong>{fmt(Number(s.importo) * moltiplicatore)}/anno</strong></div>
                </div>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <button onClick={() => openEdit(s)} style={{ background: C.priL, border: 'none', borderRadius: 7, padding: '5px 8px', cursor: 'pointer' }}><Ic n="edit" s={13} c={C.pri} /></button>
                  <button onClick={() => del(s.id)} style={{ background: C.danL, border: 'none', borderRadius: 7, padding: '5px 8px', cursor: 'pointer' }}><Ic n="del" s={13} c={C.dan} /></button>
                </div>
              </div>
            );
          })}
        </Crd>
      )}

      {/* FILTRO CATEGORIA */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 10, overflowX: 'auto', WebkitOverflowScrolling: 'touch', paddingBottom: 4 }}>
        <button onClick={() => setFiltroCategoria('')} style={{ padding: '5px 12px', borderRadius: 20, border: `1.5px solid ${!filtroCategoria ? C.pri : C.brd}`, background: !filtroCategoria ? C.pri : '#fff', color: !filtroCategoria ? '#fff' : C.txm, fontWeight: 700, fontSize: 11, cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0 }}>Tutte</button>
        {perCategoria.map(({ cat }) => (
          <button key={cat} onClick={() => setFiltroCategoria(cat)} style={{ padding: '5px 12px', borderRadius: 20, border: `1.5px solid ${filtroCategoria === cat ? C.pri : C.brd}`, background: filtroCategoria === cat ? C.pri : '#fff', color: filtroCategoria === cat ? '#fff' : C.txm, fontWeight: 700, fontSize: 11, cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0 }}>{cat}</button>
        ))}
      </div>

      {/* LISTA SPESE */}
      {loading && <div style={{ textAlign: 'center', color: C.txl, padding: 30 }}>⏳ Caricamento...</div>}
      {!loading && speseFiltrate.filter(s => !s.ricorrente).length === 0 && (
        <div style={{ textAlign: 'center', color: C.txl, padding: 30 }}>Nessuna spesa registrata</div>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {speseFiltrate.filter(s => !s.ricorrente).map(s => (
          <Crd key={s.id} style={{ borderLeft: `3px solid ${C.dan}` }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 13 }}>{s.titolo}</div>
                <div style={{ fontSize: 11, color: C.txm }}>{fmtD(s.data)} · {s.categoria}</div>
                {s.note && <div style={{ fontSize: 11, color: C.txl, marginTop: 2 }}>{s.note}</div>}
              </div>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexShrink: 0 }}>
                <span style={{ fontWeight: 800, color: C.dan, fontSize: 15 }}>{fmt(s.importo)}</span>
                <button onClick={() => openEdit(s)} style={{ background: C.priL, border: 'none', borderRadius: 7, padding: '5px 8px', cursor: 'pointer' }}><Ic n="edit" s={13} c={C.pri} /></button>
                <button onClick={() => del(s.id)} style={{ background: C.danL, border: 'none', borderRadius: 7, padding: '5px 8px', cursor: 'pointer' }}><Ic n="del" s={13} c={C.dan} /></button>
              </div>
            </div>
          </Crd>
        ))}
      </div>

      {/* MODAL NUOVA/MODIFICA SPESA */}
      {modal && (
        <Modal title={editItem ? 'Modifica spesa' : '+ Nuova spesa'} onClose={() => setModal(false)}>
          <Fld label="Titolo spesa">
            <Inp value={form.titolo} onChange={e => F({ titolo: e.target.value })} placeholder="es. Materiale composito, Affitto studio..." autoFocus />
          </Fld>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <Fld label="Importo €">
              <Inp type="number" inputMode="decimal" value={form.importo} onChange={e => F({ importo: e.target.value })} placeholder="0.00" />
            </Fld>
            <Fld label="Data">
              <Inp type="date" value={form.data} onChange={e => F({ data: e.target.value })} />
            </Fld>
          </div>
          <Fld label="Categoria">
            <Sel value={form.categoria} onChange={e => F({ categoria: e.target.value })}>
              {CATEGORIE.map(c => <option key={c}>{c}</option>)}
            </Sel>
          </Fld>

          {/* Toggle ricorrente */}
          <div style={{ background: form.ricorrente ? '#FEF3E2' : C.bg, borderRadius: 10, padding: 12, marginBottom: 10, border: `1px solid ${form.ricorrente ? C.war : C.brd}` }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: form.ricorrente ? 10 : 0 }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: form.ricorrente ? C.war : C.txt }}>🔄 Spesa ricorrente/fissa</span>
              <button onClick={() => F({ ricorrente: !form.ricorrente })} style={{ width: 44, height: 24, borderRadius: 12, background: form.ricorrente ? C.war : C.brd, border: 'none', cursor: 'pointer', position: 'relative' }}>
                <div style={{ width: 18, height: 18, borderRadius: '50%', background: '#fff', position: 'absolute', top: 3, left: form.ricorrente ? 23 : 3, transition: 'left 0.2s' }} />
              </button>
            </div>
            {form.ricorrente && (
              <Fld label="Frequenza">
                <Sel value={form.frequenza} onChange={e => F({ frequenza: e.target.value })}>
                  {FREQUENZE.map(f => <option key={f}>{f}</option>)}
                </Sel>
              </Fld>
            )}
          </div>

          <Fld label="Note (opzionale)">
            <Inp value={form.note} onChange={e => F({ note: e.target.value })} placeholder="es. Fattura n.123, fornitore X..." />
          </Fld>

          {form.importo && form.ricorrente && (
            <div style={{ background: C.danL, borderRadius: 9, padding: '8px 12px', marginBottom: 10 }}>
              <div style={{ fontSize: 12, color: C.dan, fontWeight: 700 }}>
                Proiezione annuale: {fmt(Number(form.importo) * ({ Mensile: 12, Bimestrale: 6, Trimestrale: 4, Semestrale: 2, Annuale: 1 }[form.frequenza] || 12))}
              </div>
            </div>
          )}

          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <Btn ch="Annulla" v="sec" onClick={() => setModal(false)} full />
            <Btn ch={editItem ? 'Aggiorna' : 'Salva'} onClick={save} dis={!form.titolo || !form.importo} full />
          </div>
        </Modal>
      )}
    </div>
  );
}
