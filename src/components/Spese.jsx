import React, { useState, useEffect } from 'react';
import { Btn, Crd, Fld, Inp, Sel, Modal, Toast, Ic } from './ui';
import { C, fmt, fmtD, today } from '../lib/utils';
import { supabase } from '../lib/supabase.js';

const CATEGORIE = ['Materiali', 'Attrezzature', 'Affitto', 'Personale', 'Utenze', 'Assicurazioni', 'Software', 'Formazione', 'Tasse', 'Altro'];
const FREQUENZE = ['Mensile', 'Bimestrale', 'Trimestrale', 'Semestrale', 'Annuale'];
const MESI = ['Gen','Feb','Mar','Apr','Mag','Giu','Lug','Ago','Set','Ott','Nov','Dic'];

export default function Spese({ refreshKey } = {}) {
  const [spese, setSpese] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [toast, setToast] = useState('');
  const [filtroCategoria, setFiltroCategoria] = useState('');
  const [form, setForm] = useState({
    titolo: '', importo: '', data: today(), categoria: 'Altro',
    note: '', ricorrente: false, frequenza: 'Mensile', tipo_costo: 'variabile',
    haTermine: false, n_rate: '', data_fine: '',
  });
  const F = (f) => setForm(p => ({ ...p, ...f }));

  useEffect(() => { loadSpese(); }, [refreshKey]);

  const loadSpese = async () => {
    setLoading(true);
    const { data } = await supabase.from('spese').select('*').order('data', { ascending: false });
    if (data) setSpese(data);
    setLoading(false);
  };

  const openNuova = () => {
    setEditItem(null);
    setForm({ titolo: '', importo: '', data: today(), categoria: 'Altro', note: '', ricorrente: false, frequenza: 'Mensile', tipo_costo: 'variabile', haTermine: false, n_rate: '', data_fine: '' });
    setModal(true);
  };

  const openEdit = (s) => {
    setEditItem(s);
    setForm({
      titolo: s.titolo, importo: String(s.importo), data: s.data, categoria: s.categoria || 'Altro',
      note: s.note || '', ricorrente: s.ricorrente || false, frequenza: s.frequenza || 'Mensile', tipo_costo: s.tipo_costo || 'variabile',
      haTermine: !!s.data_fine, n_rate: s.n_rate != null ? String(s.n_rate) : '', data_fine: s.data_fine || '',
    });
    setModal(true);
  };

  // Calcola la data di fine a partire dal numero di rate e dalla frequenza, se n_rate è impostato
  // (l'utente può comunque sovrascrivere manualmente data_fine dopo).
  const calcolaDataFineDaRate = (dataInizio, frequenza, nRate) => {
    if (!dataInizio || !nRate || Number(nRate) <= 0) return '';
    const mesiPerRata = { Mensile: 1, Bimestrale: 2, Trimestrale: 3, Semestrale: 6, Annuale: 12 }[frequenza] || 1;
    const d = new Date(dataInizio + 'T12:00');
    d.setMonth(d.getMonth() + mesiPerRata * (Number(nRate) - 1));
    return d.toISOString().slice(0, 10);
  };

  const save = async () => {
    if (!form.titolo || !form.importo) return;
    const record = {
      titolo: form.titolo,
      importo: Number(form.importo),
      data: form.data,
      categoria: form.categoria,
      note: form.note || '',
      ricorrente: form.ricorrente,
      frequenza: form.frequenza,
      tipo_costo: form.tipo_costo,
      data_fine: form.ricorrente && form.haTermine ? (form.data_fine || calcolaDataFineDaRate(form.data, form.frequenza, form.n_rate) || null) : null,
      n_rate: form.ricorrente && form.haTermine && form.n_rate ? Number(form.n_rate) : null,
    };
    if (editItem) {
      const { error } = await supabase.from('spese').update(record).eq('id', editItem.id);
      if (error) { alert('Errore aggiornamento: ' + error.message); return; }
      await loadSpese();
      setToast('Aggiornata ✓');
    } else {
      const nuova = { ...record, id: Date.now() };
      const { error } = await supabase.from('spese').insert([nuova]);
      if (error) { alert('Errore inserimento: ' + error.message); return; }
      await loadSpese();
      setToast('Aggiunta ✓');
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
    const speseNormali = spese.filter(s => !s.ricorrente && s.data && s.data.startsWith(anno)).reduce((sum, s) => sum + Number(s.importo), 0);
    const speseRicorrenti = spese.filter(s => s.ricorrente).reduce((sum, s) => {
      const moltiplicatore = { Mensile: 12, Bimestrale: 6, Trimestrale: 4, Semestrale: 2, Annuale: 1 }[s.frequenza] || 12;
      return sum + Number(s.importo) * moltiplicatore;
    }, 0);
    return speseNormali + speseRicorrenti;
  };

  const totaleAnno = calcolaAnnuale();
  const totaleMese = spese.filter(s => s.data && s.data.startsWith(today().slice(0, 7))).reduce((s, x) => s + Number(x.importo), 0);
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
        <Btn ch="Nuova spesa" ic="plus" onClick={openNuova} />
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
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                    <div style={{ fontWeight: 700, fontSize: 13 }}>{s.titolo}</div>
                    {s.tipo_costo === 'fisso' && <span style={{ fontSize: 9, fontWeight: 800, color: C.pri, background: C.priL, borderRadius: 5, padding: '1px 5px' }}>FISSO</span>}
                    {s.data_fine && <span style={{ fontSize: 9, fontWeight: 800, color: C.war, background: '#fff', borderRadius: 5, padding: '1px 5px' }}>FINO A {fmtD(s.data_fine)}</span>}
                  </div>
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
            <Sel value={form.categoria} onChange={e => {
              const cat = e.target.value;
              const categorieFisse = ['Affitto', 'Personale', 'Utenze', 'Assicurazioni', 'Software'];
              F({ categoria: cat, tipo_costo: categorieFisse.includes(cat) ? 'fisso' : 'variabile' });
            }}>
              {CATEGORIE.map(c => <option key={c}>{c}</option>)}
            </Sel>
          </Fld>

          <Fld label="Tipo di costo (per il Controllo di Gestione)">
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="button" onClick={() => F({ tipo_costo: 'fisso' })} style={{
                flex: 1, padding: '9px 0', borderRadius: 9, border: `1.5px solid ${form.tipo_costo === 'fisso' ? C.pri : C.brd}`,
                background: form.tipo_costo === 'fisso' ? C.priL : '#fff', color: form.tipo_costo === 'fisso' ? C.pri : C.txm,
                fontWeight: 700, fontSize: 12, cursor: 'pointer',
              }}>Fisso</button>
              <button type="button" onClick={() => F({ tipo_costo: 'variabile' })} style={{
                flex: 1, padding: '9px 0', borderRadius: 9, border: `1.5px solid ${form.tipo_costo === 'variabile' ? C.pri : C.brd}`,
                background: form.tipo_costo === 'variabile' ? C.priL : '#fff', color: form.tipo_costo === 'variabile' ? C.pri : C.txm,
                fontWeight: 700, fontSize: 12, cursor: 'pointer',
              }}>Variabile</button>
            </div>
            <div style={{ fontSize: 10, color: C.txl, marginTop: 4, lineHeight: 1.5 }}>
              <b>Fisso</b>: lo paghi comunque, indipendentemente da quanti pazienti curi (affitto, personale, utenze, assicurazioni, software, rate di macchinari). <b>Variabile</b>: dipende da quanto lavori (materiali, laboratorio esterno, provvigioni). Distinguerli bene serve a calcolare correttamente margine ed EBITDA in Controllo di Gestione.
            </div>
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
              <>
                <Fld label="Frequenza">
                  <Sel value={form.frequenza} onChange={e => F({ frequenza: e.target.value })}>
                    {FREQUENZE.map(f => <option key={f}>{f}</option>)}
                  </Sel>
                </Fld>

                <div style={{ display: 'flex', gap: 6, marginBottom: form.haTermine ? 10 : 0 }}>
                  <button type="button" onClick={() => F({ haTermine: false, n_rate: '', data_fine: '' })} style={{
                    flex: 1, padding: '8px 0', borderRadius: 8, border: `1.5px solid ${!form.haTermine ? C.war : C.brd}`,
                    background: !form.haTermine ? '#fff' : 'transparent', color: !form.haTermine ? C.war : C.txm,
                    fontWeight: 700, fontSize: 12, cursor: 'pointer',
                  }}>Senza fine</button>
                  <button type="button" onClick={() => F({ haTermine: true })} style={{
                    flex: 1, padding: '8px 0', borderRadius: 8, border: `1.5px solid ${form.haTermine ? C.war : C.brd}`,
                    background: form.haTermine ? '#fff' : 'transparent', color: form.haTermine ? C.war : C.txm,
                    fontWeight: 700, fontSize: 12, cursor: 'pointer',
                  }}>A termine (rate)</button>
                </div>

                {form.haTermine && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <Fld label="Numero di rate">
                      <Inp type="number" inputMode="numeric" value={form.n_rate}
                        onChange={e => F({ n_rate: e.target.value, data_fine: calcolaDataFineDaRate(form.data, form.frequenza, e.target.value) })}
                        placeholder="es. 12" />
                    </Fld>
                    <Fld label="Data fine (calcolata, modificabile)">
                      <Inp type="date" value={form.data_fine} onChange={e => F({ data_fine: e.target.value })} />
                    </Fld>
                    {form.data_fine && (
                      <div style={{ fontSize: 11, color: C.txl }}>Ultima rata proiettata: {fmtD(form.data_fine)}</div>
                    )}
                  </div>
                )}
              </>
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
