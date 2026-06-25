import React, { useState } from 'react';
import { Btn, Crd, Fld, Inp, Sel, Modal, Toast, Bdg, Ic } from './ui';
import { C, uid, fmt, fmtD, today } from '../lib/utils';

export default function Pagamenti({ patients, payments, setPayments, plans }) {
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState({ pazienteId: '', data: today(), importo: '', metodo: 'Contanti', nota: '', stato: 'pagato' });
  const [toast, setToast] = useState('');
  const F = (f) => setForm((p) => ({ ...p, ...f }));

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
  const selPazSaldo = form.pazienteId ? saldoPaz(form.pazienteId) : null;

  return (
    <div>
      {toast && <Toast msg={toast} onDone={() => setToast('')} />}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <div style={{ fontSize: 20, fontWeight: 800 }}>Pagamenti</div>
        <Btn ch="Nuovo" ic="plus" onClick={() => { setForm({ pazienteId: '', data: today(), importo: '', metodo: 'Contanti', nota: '', stato: 'pagato' }); setModal(true); }} />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
        <Crd style={{ display: 'flex', alignItems: 'center', gap: 11, padding: 12 }}>
          <div style={{ background: C.sucL, borderRadius: 10, padding: 9 }}><Ic n="eur" s={20} c={C.suc} /></div>
          <div><div style={{ fontSize: 17, fontWeight: 800 }}>{fmt(total)}</div><div style={{ fontSize: 11, color: C.txm, fontWeight: 600 }}>Totale incassato</div></div>
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
      {modal && (
        <Modal title="Registra pagamento" onClose={() => setModal(false)}>
          <Fld label="Paziente">
            <Sel
              value={form.pazienteId}
              onChange={(v) => F({ pazienteId: v })}
              placeholder="Cerca paziente…"
              options={patients.map(p => ({ value: String(p.id), label: `${p.nome} ${p.cognome}`, sub: p.telefono || '' }))}
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
    </div>
  );
}



