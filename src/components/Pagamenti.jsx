import React, { useState, useEffect } from 'react';
import { Btn, Crd, Fld, Inp, Sel, Modal, Toast, Bdg, Ic, SelettorePaziente } from './ui';
import { C, uid, fmt, fmtD, today } from '../lib/utils';
import { supabase } from '../lib/supabase.js';

export default function Pagamenti({ patients, payments, setPayments, plans }) {
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState({ pazienteId: '', data: today(), importo: '', metodo: 'Contanti', nota: '', stato: 'pagato' });
  const [pazSearch, setPazSearch] = useState('');
  const [toast, setToast] = useState('');
  const F = (f) => setForm((p) => ({ ...p, ...f }));

  // Collaborazioni esterne
  const [tabAttiva, setTabAttiva] = useState('studio'); // 'studio' | 'esterno'
  const [collaborazioni, setCollaborazioni] = useState([]);
  const [pagExt, setPagExt] = useState([]);
  const [modalExt, setModalExt] = useState(false);
  const [modalCollab, setModalCollab] = useState(false);
  const [formExt, setFormExt] = useState({ collaborazione_id: '', collaborazione_nome: '', importo: '', data: today(), metodo: 'Bonifico', note: '' });
  const [nuovaCollab, setNuovaCollab] = useState('');
  const FE = (f) => setFormExt((p) => ({ ...p, ...f }));

  useEffect(() => { loadCollaborazioni(); loadPagExt(); }, []);

  const loadCollaborazioni = async () => {
    const { data } = await supabase.from('collaborazioni').select('*').order('nome');
    if (data) setCollaborazioni(data);
  };

  const loadPagExt = async () => {
    const { data } = await supabase.from('pagamenti_esterni').select('*').order('data', { ascending: false });
    if (data) setPagExt(data);
  };

  const addCollab = async () => {
    if (!nuovaCollab.trim()) return;
    const { data } = await supabase.from('collaborazioni').insert([{ id: Date.now(), nome: nuovaCollab.trim() }]).select();
    if (data) { setCollaborazioni(prev => [...prev, data[0]].sort((a,b) => a.nome.localeCompare(b.nome))); setNuovaCollab(''); }
  };

  const delCollab = async (id) => {
    if (!confirm('Eliminare questa collaborazione?')) return;
    await supabase.from('collaborazioni').delete().eq('id', id);
    setCollaborazioni(prev => prev.filter(c => c.id !== id));
  };

  const saveExt = async () => {
    if (!formExt.collaborazione_nome || !formExt.importo) return;
    const nuovoPag = { id: Date.now(), ...formExt, importo: Number(formExt.importo) };
    const { error } = await supabase.from('pagamenti_esterni').insert([nuovoPag]);
    if (!error) { setPagExt(prev => [nuovoPag, ...prev]); setModalExt(false); setToast('Registrato ✓'); }
  };

  const delExt = async (id) => {
    if (!confirm('Eliminare?')) return;
    await supabase.from('pagamenti_esterni').delete().eq('id', id);
    setPagExt(prev => prev.filter(x => x.id !== id));
  };

  // Studio
  const saldoPaz = (pazId) => {
    const patPlans = plans.filter((pl) => pl.pazienteId === Number(pazId));
    const dovuto = patPlans.reduce((s, pl) => {
      const sub = pl.voci.reduce((a, v) => a + Number(v.prezzo), 0);
      const sc = Number(pl.sconto) || 0;
      const scontato = pl.scontoTipo === 'pct' ? sub * (sc / 100) : Math.min(sc, sub);
      return s + Math.max(0, sub - scontato);
    }, 0);
    const pagato = payments.filter((p) => p.pazienteId === Number(pazId)).reduce((s, p) => s + Number(p.importo), 0);
    return { dovuto, pagato, residuo: Math.max(0, dovuto - pagato) };
  };

  const save = () => {
    if (!form.pazienteId || !form.importo) return;
    setPayments((p) => [...p, { ...form, id: uid(), pazienteId: Number(form.pazienteId), importo: Number(form.importo) }]);
    setModal(false);
    setToast('Registrato ✓');
  };
  const del = (id) => { if (confirm('Eliminare?')) setPayments((p) => p.filter((x) => x.id !== id)); };

  const total = payments.reduce((s, p) => s + Number(p.importo), 0);
  const mese = payments.filter((p) => p.data && p.data.startsWith(today().slice(0, 7))).reduce((s, p) => s + Number(p.importo), 0);
  const totalExt = pagExt.reduce((s, p) => s + Number(p.importo), 0);
  const meseExt = pagExt.filter(p => p.data && p.data.startsWith(today().slice(0, 7))).reduce((s, p) => s + Number(p.importo), 0);
  const selPazSaldo = form.pazienteId ? saldoPaz(form.pazienteId) : null;

  return (
    <div>
      {toast && <Toast msg={toast} onDone={() => setToast('')} />}

      {/* HEADER */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <div style={{ fontSize: 20, fontWeight: 800 }}>Pagamenti</div>
        <div style={{ display: 'flex', gap: 7 }}>
          {tabAttiva === 'studio'
            ? <Btn ch="+ Studio" ic="plus" onClick={() => { setForm({ pazienteId: '', data: today(), importo: '', metodo: 'Contanti', nota: '', stato: 'pagato' }); setPazSearch(''); setModal(true); }} />
            : <Btn ch="+ Esterno" ic="plus" onClick={() => { setFormExt({ collaborazione_id: '', collaborazione_nome: '', importo: '', data: today(), metodo: 'Bonifico', note: '' }); setModalExt(true); }} />
          }
        </div>
      </div>

      {/* TAB SWITCHER */}
      <div style={{ display: 'flex', background: C.bg, borderRadius: 10, border: `1px solid ${C.brd}`, marginBottom: 14, overflow: 'hidden' }}>
        {[['studio', '🦷 Studio'], ['esterno', '🤝 Collaborazioni']].map(([id, lbl]) => (
          <button key={id} onClick={() => setTabAttiva(id)} style={{ flex: 1, padding: '10px 0', border: 'none', background: tabAttiva === id ? C.pri : 'transparent', color: tabAttiva === id ? '#fff' : C.txm, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>{lbl}</button>
        ))}
      </div>

      {/* ── TAB STUDIO ── */}
      {tabAttiva === 'studio' && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
            <Crd style={{ display: 'flex', alignItems: 'center', gap: 11, padding: 12 }}>
              <div style={{ background: C.sucL, borderRadius: 10, padding: 9 }}><Ic n="eur" s={20} c={C.suc} /></div>
              <div><div style={{ fontSize: 17, fontWeight: 800 }}>{fmt(total)}</div><div style={{ fontSize: 11, color: C.txm, fontWeight: 600 }}>Totale studio</div></div>
            </Crd>
            <Crd style={{ display: 'flex', alignItems: 'center', gap: 11, padding: 12 }}>
              <div style={{ background: C.priL, borderRadius: 10, padding: 9 }}><Ic n="clk" s={20} c={C.pri} /></div>
              <div><div style={{ fontSize: 17, fontWeight: 800 }}>{fmt(mese)}</div><div style={{ fontSize: 11, color: C.txm, fontWeight: 600 }}>Questo mese</div></div>
            </Crd>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
            {[...payments].reverse().map((pay) => {
              const p = patients.find((x) => x.id === pay.pazienteId);
              const { residuo } = saldoPaz(pay.pazienteId);
              return (
                <Crd key={pay.id}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ background: C.sucL, borderRadius: 9, padding: 8, flexShrink: 0 }}><Ic n="eur" s={16} c={C.suc} /></div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 700, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p ? `${p.nome} ${p.cognome}` : '—'}</div>
                      <div style={{ fontSize: 11, color: C.txm }}>{fmtD(pay.data)}{pay.nota ? ' · ' + pay.nota : ''}</div>
                      <div style={{ marginTop: 3, display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                        <Bdg ch={pay.metodo} co={C.pri} />
                        <Bdg ch={pay.stato} co={pay.stato === 'pagato' ? C.suc : C.war} />
                        {residuo > 0 ? <Bdg ch={`residuo ${fmt(residuo)}`} co={C.dan} /> : <Bdg ch="saldato ✓" co={C.suc} />}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <div style={{ fontWeight: 800, color: C.suc, fontSize: 15 }}>{fmt(pay.importo)}</div>
                      <button onClick={() => del(pay.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', marginTop: 3, padding: 2 }}><Ic n="del" s={13} c={C.dan} /></button>
                    </div>
                  </div>
                </Crd>
              );
            })}
            {payments.length === 0 && <div style={{ textAlign: 'center', color: C.txl, padding: 40 }}>Nessun pagamento</div>}
          </div>
        </>
      )}

      {/* ── TAB COLLABORAZIONI ── */}
      {tabAttiva === 'esterno' && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
            <Crd style={{ display: 'flex', alignItems: 'center', gap: 11, padding: 12 }}>
              <div style={{ background: C.purL, borderRadius: 10, padding: 9 }}><Ic n="eur" s={20} c={C.pur} /></div>
              <div><div style={{ fontSize: 17, fontWeight: 800 }}>{fmt(totalExt)}</div><div style={{ fontSize: 11, color: C.txm, fontWeight: 600 }}>Totale collaborazioni</div></div>
            </Crd>
            <Crd style={{ display: 'flex', alignItems: 'center', gap: 11, padding: 12 }}>
              <div style={{ background: C.priL, borderRadius: 10, padding: 9 }}><Ic n="clk" s={20} c={C.pri} /></div>
              <div><div style={{ fontSize: 17, fontWeight: 800 }}>{fmt(meseExt)}</div><div style={{ fontSize: 11, color: C.txm, fontWeight: 600 }}>Questo mese</div></div>
            </Crd>
          </div>

          {/* Gestisci collaborazioni */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 10 }}>
            <button onClick={() => setModalCollab(true)} style={{ background: C.purL, border: 'none', borderRadius: 8, padding: '7px 12px', color: C.pur, fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>⚙️ Gestisci collaborazioni</button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
            {pagExt.map((pag) => (
              <Crd key={pag.id}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ background: C.purL, borderRadius: 9, padding: 8, flexShrink: 0 }}><Ic n="eur" s={16} c={C.pur} /></div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: 13 }}>{pag.collaborazione_nome}</div>
                    <div style={{ fontSize: 11, color: C.txm }}>{fmtD(pag.data)}{pag.note ? ' · ' + pag.note : ''}</div>
                    <Bdg ch={pag.metodo} co={C.pur} />
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{ fontWeight: 800, color: C.pur, fontSize: 15 }}>{fmt(pag.importo)}</div>
                    <button onClick={() => delExt(pag.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', marginTop: 3, padding: 2 }}><Ic n="del" s={13} c={C.dan} /></button>
                  </div>
                </div>
              </Crd>
            ))}
            {pagExt.length === 0 && <div style={{ textAlign: 'center', color: C.txl, padding: 40 }}>Nessun pagamento esterno</div>}
          </div>
        </>
      )}

      {/* MODAL STUDIO */}
      {modal && (
        <Modal title="Registra pagamento studio" onClose={() => setModal(false)}>
          <Fld label="Paziente">
            <SelettorePaziente
              patients={patients}
              value={form.pazienteId}
              onChange={(id) => F({ pazienteId: id })}
              search={pazSearch}
              onSearchChange={setPazSearch}
              autoFocus
            />
          </Fld>
          {selPazSaldo && (
            <div style={{ background: C.priD, borderRadius: 10, padding: 11, marginBottom: 11 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <div><div style={{ fontSize: 9, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase' }}>Dovuto</div><div style={{ fontSize: 14, fontWeight: 800, color: '#fff' }}>{fmt(selPazSaldo.dovuto)}</div></div>
                <div style={{ textAlign: 'center' }}><div style={{ fontSize: 9, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase' }}>Già pagato</div><div style={{ fontSize: 14, fontWeight: 800, color: '#86efac' }}>{fmt(selPazSaldo.pagato)}</div></div>
                <div style={{ textAlign: 'right' }}><div style={{ fontSize: 9, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase' }}>Residuo</div><div style={{ fontSize: 14, fontWeight: 800, color: selPazSaldo.residuo > 0 ? '#FCA5A5' : '#86efac' }}>{fmt(selPazSaldo.residuo)}</div></div>
              </div>
              {selPazSaldo.residuo > 0 && (
                <button onClick={() => F({ importo: selPazSaldo.residuo.toFixed(2) })} style={{ width: '100%', padding: '7px', background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 7, color: '#fff', fontWeight: 700, fontSize: 11, cursor: 'pointer' }}>
                  ↑ Usa importo residuo ({fmt(selPazSaldo.residuo)})
                </button>
              )}
            </div>
          )}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <Fld label="Data"><Inp type="date" value={form.data} onChange={(e) => F({ data: e.target.value })} /></Fld>
            <Fld label="Importo €"><Inp type="number" inputMode="decimal" value={form.importo} onChange={(e) => F({ importo: e.target.value })} /></Fld>
            <Fld label="Metodo">
              <Sel value={form.metodo} onChange={(e) => F({ metodo: e.target.value })}>
                {['Contanti', 'Carta', 'Bonifico', 'POS', 'Assegno'].map((m) => <option key={m}>{m}</option>)}
              </Sel>
            </Fld>
            <Fld label="Stato">
              <Sel value={form.stato} onChange={(e) => F({ stato: e.target.value })}>
                <option value="pagato">Pagato</option><option value="acconto">Acconto</option><option value="sospeso">Sospeso</option>
              </Sel>
            </Fld>
          </div>
          <Fld label="Nota"><Inp value={form.nota} onChange={(e) => F({ nota: e.target.value })} /></Fld>
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <Btn ch="Annulla" v="sec" onClick={() => setModal(false)} full />
            <Btn ch="Salva" onClick={save} full />
          </div>
        </Modal>
      )}

      {/* MODAL ESTERNO */}
      {modalExt && (
        <Modal title="💼 Registra incasso esterno" onClose={() => setModalExt(false)}>
          <Fld label="Collaborazione">
            <Sel value={formExt.collaborazione_id} onChange={(e) => {
              const c = collaborazioni.find(x => String(x.id) === e.target.value);
              FE({ collaborazione_id: e.target.value, collaborazione_nome: c?.nome || '' });
            }}>
              <option value="">Seleziona collaborazione…</option>
              {collaborazioni.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
            </Sel>
          </Fld>
          {collaborazioni.length === 0 && (
            <div style={{ background: C.purL, borderRadius: 8, padding: '8px 12px', marginBottom: 8, fontSize: 12, color: C.pur }}>
              Nessuna collaborazione — aggiungila con il tasto "⚙️ Gestisci collaborazioni"
            </div>
          )}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <Fld label="Data"><Inp type="date" value={formExt.data} onChange={(e) => FE({ data: e.target.value })} /></Fld>
            <Fld label="Importo €"><Inp type="number" inputMode="decimal" value={formExt.importo} onChange={(e) => FE({ importo: e.target.value })} /></Fld>
            <Fld label="Metodo">
              <Sel value={formExt.metodo} onChange={(e) => FE({ metodo: e.target.value })}>
                {['Bonifico', 'Contanti', 'Carta', 'Assegno'].map(m => <option key={m}>{m}</option>)}
              </Sel>
            </Fld>
          </div>
          <Fld label="Note"><Inp value={formExt.note} onChange={(e) => FE({ note: e.target.value })} placeholder="es. Guardia medica gen 2026" /></Fld>
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <Btn ch="Annulla" v="sec" onClick={() => setModalExt(false)} full />
            <Btn ch="Salva" onClick={saveExt} dis={!formExt.collaborazione_nome || !formExt.importo} full />
          </div>
        </Modal>
      )}

      {/* MODAL GESTISCI COLLABORAZIONI */}
      {modalCollab && (
        <Modal title="⚙️ Collaborazioni esterne" onClose={() => setModalCollab(false)}>
          <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
            <Inp value={nuovaCollab} onChange={e => setNuovaCollab(e.target.value)} onKeyDown={e => e.key === 'Enter' && addCollab()} placeholder="es. Clinica San Carlo, Guardia medica..." style={{ flex: 1 }} />
            <Btn ch="Aggiungi" onClick={addCollab} dis={!nuovaCollab.trim()} />
          </div>
          {collaborazioni.length === 0 && <div style={{ textAlign: 'center', color: C.txl, padding: 20 }}>Nessuna collaborazione ancora</div>}
          {collaborazioni.map(c => (
            <div key={c.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', borderBottom: `1px solid ${C.brd}` }}>
              <span style={{ fontWeight: 600, fontSize: 13 }}>{c.nome}</span>
              <button onClick={() => delCollab(c.id)} style={{ background: C.danL, border: 'none', borderRadius: 7, padding: '5px 8px', cursor: 'pointer' }}><Ic n="del" s={13} c={C.dan} /></button>
            </div>
          ))}
        </Modal>
      )}
    </div>
  );
}
