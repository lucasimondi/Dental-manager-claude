import React, { useState, useEffect } from 'react';
import { Btn, Crd, Fld, Inp, Sel, Modal, Toast, Bdg, Ic, StatCard, SelettorePaziente, PageHeader, EmptyState } from './ui';
import { C, uid, fmt, fmtD, today } from '../lib/utils';
import { useFormPersistente } from '../lib/useFormPersistente';
import { normalizza } from '../lib/ricercaPazienti';
import { supabase } from '../lib/supabase.js';
import { planAssignmentForPatient } from '../lib/domain/incassiActions.js';

export default function Pagamenti({ patients, payments, setPayments, plans, autoOpenNew, onAutoOpenNewHandled, embedded = false }) {
  const [modal, setModal] = useState(false);
  const [form, setForm, clearFormDraft] = useFormPersistente('nuovo_pagamento_studio', { pazienteId: '', data: today(), importo: '', metodo: 'Contanti', nota: '', stato: 'pagato', pianoId: '' });
  const [pazSearch, setPazSearch] = useState('');
  const [toast, setToast] = useState('');
  const [ricerca, setRicerca] = useState('');
  const F = (f) => setForm((p) => ({ ...p, ...f }));

  // Collaborazioni esterne
  const [tabAttiva, setTabAttiva] = useState('studio'); // 'studio' | 'esterno'
  const [collaborazioni, setCollaborazioni] = useState([]);
  const [pagExt, setPagExt] = useState([]);
  const [modalExt, setModalExt] = useState(false);
  const [modalCollab, setModalCollab] = useState(false);
  const [formExt, setFormExt, clearFormExtDraft] = useFormPersistente('nuovo_pagamento_esterno', { collaborazione_id: '', collaborazione_nome: '', importo: '', data: today(), metodo: 'Bonifico', note: '' });
  const [nuovaCollab, setNuovaCollab] = useState('');
  const FE = (f) => setFormExt((p) => ({ ...p, ...f }));

  useEffect(() => { loadCollaborazioni(); loadPagExt(); }, []);

  // Arrivo da un'azione rapida della Home ("Pagamento"): apre subito il vero
  // modale "Registra pagamento studio" (stesso apri usato dal tasto "Studio +").
  useEffect(() => {
    if (autoOpenNew) {
      setForm({ pazienteId: '', data: today(), importo: '', metodo: 'Contanti', nota: '', stato: 'pagato', pianoId: '' });
      setPazSearch('');
      setModal(true);
      onAutoOpenNewHandled && onAutoOpenNewHandled();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoOpenNew]);

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
    if (!error) { setPagExt(prev => [nuovoPag, ...prev]); setModalExt(false); clearFormExtDraft(); setToast('Registrato ✓'); }
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

  // POL-FIN-003 §5 — generic payment, no prestazione context: auto-assign
  // when the patient has exactly one active plan, otherwise require an
  // explicit choice.
  const assignment = form.pazienteId ? planAssignmentForPatient(plans, form.pazienteId) : { mode: 'none' };
  const activePlansSel = assignment.mode === 'choose' ? assignment.options : [];

  const save = () => {
    if (!form.pazienteId || !form.importo) return;
    if (assignment.mode === 'choose' && !form.pianoId) return;
    const pianoId = assignment.mode === 'auto' ? assignment.pianoId : (assignment.mode === 'choose' ? Number(form.pianoId) : undefined);
    const { pianoId: _draftPianoId, ...rest } = form;
    setPayments((p) => [...p, { ...rest, id: uid(), pazienteId: Number(form.pazienteId), importo: Number(form.importo), ...(pianoId !== undefined ? { pianoId } : {}) }]);
    setModal(false);
    clearFormDraft();
    setToast('Registrato ✓');
  };
  const del = (id) => { if (confirm('Eliminare?')) setPayments((p) => p.filter((x) => x.id !== id)); };

  const total = payments.reduce((s, p) => s + Number(p.importo), 0);
  const mese = payments.filter((p) => p.data && p.data.startsWith(today().slice(0, 7))).reduce((s, p) => s + Number(p.importo), 0);
  const totalExt = pagExt.reduce((s, p) => s + Number(p.importo), 0);
  const meseExt = pagExt.filter(p => p.data && p.data.startsWith(today().slice(0, 7))).reduce((s, p) => s + Number(p.importo), 0);
  const selPazSaldo = form.pazienteId ? saldoPaz(form.pazienteId) : null;

  const q = normalizza(ricerca);
  const paymentsFiltrati = !q ? payments : payments.filter((p) => {
    const paz = patients.find((x) => x.id === p.pazienteId);
    return normalizza(`${paz?.nome || ''} ${paz?.cognome || ''} ${p.nota || ''}`).includes(q);
  });
  const pagExtFiltrati = !q ? pagExt : pagExt.filter((p) => normalizza(`${p.collaborazione_nome || ''} ${p.note || ''}`).includes(q));

  return (
    <div>
      {toast && <Toast msg={toast} onDone={() => setToast('')} />}

      {!embedded && <PageHeader icon="eur" title="Pagamenti" actions={
        tabAttiva === 'studio'
          ? <Btn ch="Studio" ic="plus" onClick={() => { setForm({ pazienteId: '', data: today(), importo: '', metodo: 'Contanti', nota: '', stato: 'pagato', pianoId: '' }); setPazSearch(''); setModal(true); }} />
          : <Btn ch="Esterno" ic="plus" onClick={() => { setFormExt({ collaborazione_id: '', collaborazione_nome: '', importo: '', data: today(), metodo: 'Bonifico', note: '' }); setModalExt(true); }} />
      } />}

      {/* TAB SWITCHER */}
      <div style={{ display: 'flex', background: C.bg, borderRadius: 10, border: `1px solid ${C.brd}`, marginBottom: 14, overflow: 'hidden' }}>
        {[['studio', 'home', 'Studio'], ['esterno', 'shake', 'Collaborazioni']].map(([id, ic, lbl]) => (
          <button key={id} onClick={() => setTabAttiva(id)} style={{ flex: 1, padding: '10px 0', border: 'none', background: tabAttiva === id ? C.pri : 'transparent', color: tabAttiva === id ? '#fff' : C.txm, fontWeight: 700, fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
            <Ic n={ic} s={13} c={tabAttiva === id ? '#fff' : C.txm} />{lbl}
          </button>
        ))}
      </div>

      {/* RICERCA */}
      <div style={{ position: 'relative', marginBottom: 14 }}>
        <div style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)' }}><Ic n="srch" s={15} c={C.txl} /></div>
        <Inp
          placeholder={tabAttiva === 'studio' ? 'Cerca per paziente o nota…' : 'Cerca per collaborazione o nota…'}
          value={ricerca}
          onChange={(e) => setRicerca(e.target.value)}
          style={{ paddingLeft: 36, paddingRight: ricerca ? 36 : 12 }}
        />
        {ricerca && (
          <button
            onClick={() => setRicerca('')}
            aria-label="Cancella ricerca"
            style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: C.brd, border: 'none', borderRadius: '50%', width: 20, height: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', padding: 0 }}
          ><Ic n="x" s={10} c={C.txm} /></button>
        )}
      </div>

      {/* ── TAB STUDIO ── */}
      {tabAttiva === 'studio' && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
            <StatCard icon="eur" color={C.suc} value={fmt(total)} label="Totale studio" />
            <StatCard icon="clk" color={C.pri} value={fmt(mese)} label="Questo mese" />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
            {[...paymentsFiltrati].reverse().map((pay) => {
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
            {paymentsFiltrati.length === 0 && <EmptyState icon="eur" title={ricerca ? 'Nessun pagamento trovato' : 'Nessun pagamento'} />}
          </div>
        </>
      )}

      {/* ── TAB COLLABORAZIONI ── */}
      {tabAttiva === 'esterno' && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
            <StatCard icon="eur" color={C.pur} value={fmt(totalExt)} label="Totale collaborazioni" />
            <StatCard icon="clk" color={C.pri} value={fmt(meseExt)} label="Questo mese" />
          </div>

          {/* Gestisci collaborazioni */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 10 }}>
            <button onClick={() => setModalCollab(true)} style={{ display: 'flex', alignItems: 'center', gap: 6, background: C.purL, border: 'none', borderRadius: 8, padding: '7px 12px', color: C.pur, fontWeight: 700, fontSize: 12, cursor: 'pointer' }}><Ic n="set" s={13} c={C.pur} />Gestisci collaborazioni</button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
            {pagExtFiltrati.map((pag) => (
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
            {pagExtFiltrati.length === 0 && <EmptyState icon="eur" title={ricerca ? 'Nessun pagamento trovato' : 'Nessun pagamento esterno'} />}
          </div>
        </>
      )}

      {/* MODAL STUDIO */}
      {modal && (
        <Modal title="Registra pagamento studio" icon="eur" onClose={() => setModal(false)}>
          <Fld label="Paziente">
            <SelettorePaziente
              patients={patients}
              value={form.pazienteId}
              onChange={(id) => F({ pazienteId: id, pianoId: '' })}
              search={pazSearch}
              onSearchChange={setPazSearch}
              autoFocus
            />
          </Fld>
          {activePlansSel.length > 1 && (
            <Fld label="Piano">
              <Sel value={form.pianoId} onChange={(e) => F({ pianoId: e.target.value })}>
                <option value="">Seleziona piano…</option>
                {activePlansSel.map((pl) => <option key={pl.id} value={pl.id}>{pl.titolo}</option>)}
              </Sel>
            </Fld>
          )}
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
            <Btn ch="Salva" onClick={save} dis={!form.pazienteId || !form.importo || (activePlansSel.length > 1 && !form.pianoId)} full />
          </div>
        </Modal>
      )}

      {/* MODAL ESTERNO */}
      {modalExt && (
        <Modal title="Registra incasso esterno" icon="brief" onClose={() => setModalExt(false)}>
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
              Nessuna collaborazione — aggiungila con il tasto "Collaborazioni esterne"
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
        <Modal title="Collaborazioni esterne" icon="set" onClose={() => setModalCollab(false)}>
          <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
            <Inp value={nuovaCollab} onChange={e => setNuovaCollab(e.target.value)} onKeyDown={e => e.key === 'Enter' && addCollab()} placeholder="es. Clinica San Carlo, Guardia medica..." style={{ flex: 1 }} />
            <Btn ch="Aggiungi" onClick={addCollab} dis={!nuovaCollab.trim()} />
          </div>
          {collaborazioni.length === 0 && <EmptyState icon="brief" title="Nessuna collaborazione ancora" />}
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
