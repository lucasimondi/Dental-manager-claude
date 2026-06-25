import React, { useState } from 'react';
import { Btn, Crd, Fld, Inp, Sel, Txt, Modal, Toast, Ic, PhStr, SearchSel } from './ui';
import { C, uid, fmtD, today } from '../lib/utils';

export default function WhatsApp({ patients, appointments, templates, setTemplates }) {
  const [tab, setTab] = useState('remind');
  const [selPaz, setSelPaz] = useState('');
  const [customMsg, setCustomMsg] = useState('');
  const [selTpl, setSelTpl] = useState('');
  const [tplModal, setTplModal] = useState(null);
  const [tplForm, setTplForm] = useState({ nome: '', testo: '' });
  const [toast, setToast] = useState('');
  const t = today();
  const upcoming = [...appointments].filter((a) => a.data >= t).sort((a, b) => a.data.localeCompare(b.data) || a.ora.localeCompare(b.ora)).slice(0, 15);

  const fillTpl = (id, paz, app) => {
    const tp = templates.find((x) => x.id === Number(id));
    if (!tp) return;
    setCustomMsg(
      tp.testo
        .replace(/{nome}/g, paz ? `${paz.nome} ${paz.cognome}` : '')
        .replace(/{data}/g, app ? fmtD(app.data) : '')
        .replace(/{ora}/g, app ? app.ora : '')
        .replace(/{tipo}/g, app ? app.tipo : '')
        .replace(/{totale}/g, '')
        .replace(/{voci}/g, '')
    );
    setSelTpl(id);
  };

  const sendRemind = (a) => {
    const p = patients.find((x) => x.id === a.pazienteId);
    if (!p?.telefono) return;
    const tp = templates.find((x) => x.id === 1) || { testo: 'Gentile {nome},\nappuntamento il {data} alle {ora} ({tipo}).\nGrazie!' };
    const msg = tp.testo.replace(/{nome}/g, `${p.nome} ${p.cognome}`).replace(/{data}/g, fmtD(a.data)).replace(/{ora}/g, a.ora).replace(/{tipo}/g, a.tipo).replace(/{totale}/g, '').replace(/{voci}/g, '');
    window.open(`https://wa.me/39${p.telefono.replace(/\D/g, '')}?text=${encodeURIComponent(msg)}`, '_blank');
  };

  const sendCustom = () => {
    const p = patients.find((x) => x.id === Number(selPaz));
    if (!p?.telefono || !customMsg) return;
    window.open(`https://wa.me/39${p.telefono.replace(/\D/g, '')}?text=${encodeURIComponent(customMsg)}`, '_blank');
  };

  const saveTpl = () => {
    if (!tplForm.nome || !tplForm.testo) return;
    if (tplForm.id) setTemplates((p) => p.map((x) => (x.id === tplForm.id ? tplForm : x)));
    else setTemplates((p) => [...p, { ...tplForm, id: uid() }]);
    setTplModal(null);
    setToast('Template salvato ✓');
  };
  const delTpl = (id) => {
    if (confirm('Eliminare?')) {
      setTemplates((p) => p.filter((x) => x.id !== id));
      setTplModal(null);
    }
  };

  return (
    <div>
      {toast && <Toast msg={toast} onDone={() => setToast('')} />}
      <div style={{ marginBottom: 12 }}><div style={{ fontSize: 20, fontWeight: 800 }}>WhatsApp Business</div></div>
      <div style={{ background: 'linear-gradient(135deg,#25D366,#128C7E)', borderRadius: 12, padding: 13, marginBottom: 13, display: 'flex', alignItems: 'center', gap: 11 }}>
        <Ic n="wa" s={28} c="#fff" />
        <div><div style={{ color: '#fff', fontWeight: 800, fontSize: 14 }}>WhatsApp Business</div><div style={{ color: 'rgba(255,255,255,0.8)', fontSize: 11 }}>I messaggi si aprono nell'app</div></div>
      </div>
      <div style={{ display: 'flex', background: C.sur, borderRadius: 9, border: `1px solid ${C.brd}`, marginBottom: 13, overflow: 'hidden' }}>
        {[{ id: 'remind', l: '📅 Reminder' }, { id: 'msg', l: '✏️ Messaggio' }, { id: 'tpl', l: '📋 Template' }].map((tb) => (
          <button key={tb.id} onClick={() => setTab(tb.id)} style={{ flex: 1, padding: '10px 4px', background: tab === tb.id ? C.pri : 'transparent', border: 'none', color: tab === tb.id ? '#fff' : C.txm, fontWeight: 700, fontSize: 11, cursor: 'pointer' }}>{tb.l}</button>
        ))}
      </div>

      {tab === 'remind' && (
        <Crd>
          <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 4 }}>Prossimi appuntamenti</div>
          <div style={{ fontSize: 11, color: C.txl, marginBottom: 11 }}>Tocca "Invia" per mandare il reminder</div>
          {upcoming.length === 0 && <div style={{ color: C.txl, fontSize: 12, textAlign: 'center', padding: '14px 0' }}>Nessun appuntamento</div>}
          {upcoming.map((a) => {
            const p = patients.find((x) => x.id === a.pazienteId);
            return (
              <div key={a.id} style={{ padding: '9px 0', borderBottom: `1px solid ${C.brd}` }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                  <div style={{ background: C.priL, borderRadius: 7, padding: '4px 6px', textAlign: 'center', minWidth: 38, flexShrink: 0 }}>
                    <div style={{ fontSize: 9, color: C.pri, fontWeight: 700 }}>{a.data.slice(8)}/{a.data.slice(5, 7)}</div>
                    <div style={{ fontSize: 11, color: C.priD, fontWeight: 800 }}>{a.ora}</div>
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p ? `${p.nome} ${p.cognome}` : '—'}</div>
                    <div style={{ fontSize: 11, color: C.txm }}>{a.tipo}</div>
                  </div>
                  <button onClick={() => sendRemind(a)} style={{ background: '#25D366', border: 'none', borderRadius: 8, padding: '7px 11px', color: '#fff', fontWeight: 700, fontSize: 11, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}><Ic n="send" s={11} c="#fff" />Invia</button>
                </div>
                {p?.telefono && <PhStr tel={p.telefono} />}
              </div>
            );
          })}
        </Crd>
      )}

      {tab === 'msg' && (
        <Crd>
          <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 11 }}>Messaggio personalizzato</div>
          <Fld label="Paziente">
            <SearchSel
              value={selPaz}
              onChange={(v) => setSelPaz(v)}
              placeholder="Cerca paziente…"
              options={patients.map(p => ({ value: String(p.id), label: `${p.nome} ${p.cognome}`, sub: p.telefono || '' }))}
            />
          </Fld>
          {selPaz && <div style={{ marginBottom: 11 }}><PhStr tel={patients.find((x) => x.id === Number(selPaz))?.telefono} /></div>}
          <Fld label="Template">
            <Sel value={selTpl} onChange={(e) => fillTpl(e.target.value, patients.find((x) => x.id === Number(selPaz)), null)}>
              <option value="">Scegli template…</option>
              {templates.map((t) => <option key={t.id} value={t.id}>{t.nome}</option>)}
            </Sel>
          </Fld>
          <Fld label="Messaggio"><Txt value={customMsg} onChange={(e) => setCustomMsg(e.target.value)} rows={6} placeholder="Scrivi o scegli un template…" /></Fld>
          <Btn ch="Apri in WhatsApp" v="wa" ic="wa" onClick={sendCustom} dis={!selPaz || !customMsg} full />
        </Crd>
      )}

      {tab === 'tpl' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 11 }}>
            <Btn ch="Nuovo template" ic="plus" onClick={() => { setTplForm({ nome: '', testo: '' }); setTplModal('new'); }} />
          </div>
          {templates.map((tpl) => (
            <Crd key={tpl.id} style={{ marginBottom: 9 }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 13 }}>{tpl.nome}</div>
                  <div style={{ fontSize: 11, color: C.txm, marginTop: 3, lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{tpl.testo.slice(0, 70)}{tpl.testo.length > 70 ? '…' : ''}</div>
                </div>
                <div style={{ display: 'flex', gap: 5, flexShrink: 0 }}>
                  <button onClick={() => { setTplForm({ ...tpl }); setTplModal('edit'); }} style={{ background: C.priL, border: 'none', borderRadius: 7, padding: 7, cursor: 'pointer' }}><Ic n="edit" s={13} c={C.pri} /></button>
                  <button onClick={() => delTpl(tpl.id)} style={{ background: C.danL, border: 'none', borderRadius: 7, padding: 7, cursor: 'pointer' }}><Ic n="del" s={13} c={C.dan} /></button>
                </div>
              </div>
            </Crd>
          ))}
        </div>
      )}

      {tplModal && (
        <Modal title={tplModal === 'edit' ? 'Modifica template' : 'Nuovo template'} onClose={() => setTplModal(null)} wide>
          <Fld label="Nome"><Inp value={tplForm.nome} onChange={(e) => setTplForm((f) => ({ ...f, nome: e.target.value }))} placeholder="es. Reminder appuntamento" /></Fld>
          <Fld label="Testo"><Txt value={tplForm.testo} onChange={(e) => setTplForm((f) => ({ ...f, testo: e.target.value }))} rows={8} /></Fld>
          <div style={{ background: C.priL, borderRadius: 8, padding: 9, marginBottom: 11 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: C.pri, marginBottom: 5 }}>Variabili:</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
              {['{nome}', '{data}', '{ora}', '{tipo}', '{totale}', '{voci}'].map((v) => (
                <button key={v} onClick={() => setTplForm((f) => ({ ...f, testo: f.testo + v }))} style={{ background: C.pri, color: '#fff', border: 'none', borderRadius: 5, padding: '3px 9px', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>{v}</button>
              ))}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 7 }}>
            {tplModal === 'edit' && <Btn ch="Elimina" v="dan" sz="sm" onClick={() => delTpl(tplForm.id)} />}
            <Btn ch="Annulla" v="sec" onClick={() => setTplModal(null)} full />
            <Btn ch="Salva" onClick={saveTpl} full />
          </div>
        </Modal>
      )}
    </div>
  );
}
