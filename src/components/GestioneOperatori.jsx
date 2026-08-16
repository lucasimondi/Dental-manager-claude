import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase.js';
import { C, COLORI_DISPONIBILI } from '../lib/utils';
import { Crd, Fld, Inp, Sel, Modal, Toast, Btn, Ic } from './ui';

const FORM_VUOTO = { nome: '', ruolo_professionale: '', colore: COLORI_DISPONIBILI[0], user_id: '' };

/* ── OPERATORI ──
   A differenza di studio_users (account con login), un operatore è una
   risorsa in agenda che può anche non avere mai accesso al gestionale
   (es. un collaboratore junior) — per questo user_id è opzionale: se
   valorizzato, l'operatore coincide con un account esistente (titolare o
   studio_user) e potrà in futuro collegare il proprio Google Calendar. */
export default function GestioneOperatori({ studioId, currentUserId, titolareNome, features, isStudioAdmin }) {
  const [operatori, setOperatori] = useState([]);
  const [studioUsers, setStudioUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState('');
  const [modal, setModal] = useState(null); // null | 'new' | operatore.id
  const [form, setForm] = useState(FORM_VUOTO);
  const [saving, setSaving] = useState(false);

  useEffect(() => { if (features?.multi_operatore) load(); else setLoading(false); }, [features?.multi_operatore]);

  const load = async () => {
    setLoading(true);
    const [{ data: op }, { data: su }] = await Promise.all([
      supabase.from('operatori').select('*').eq('studio_id', studioId).order('created_at'),
      supabase.from('studio_users').select('id, nome, email, user_id').eq('studio_id', studioId),
    ]);
    setOperatori(op || []);
    setStudioUsers(su || []);
    setLoading(false);
  };

  // Account collegabili a un operatore: il titolare (non ha riga in studio_users,
  // trattato come admin implicito) + gli studio_users con account già attivo.
  const accountDisponibili = [
    ...(currentUserId ? [{ user_id: currentUserId, nome: titolareNome || 'Titolare' }] : []),
    ...studioUsers.filter((u) => u.user_id).map((u) => ({ user_id: u.user_id, nome: u.nome })),
  ];

  const apriNuovo = () => { setForm(FORM_VUOTO); setModal('new'); };
  const apriModifica = (o) => { setForm({ nome: o.nome, ruolo_professionale: o.ruolo_professionale || '', colore: o.colore, user_id: o.user_id || '' }); setModal(o.id); };

  const salva = async () => {
    if (!form.nome.trim()) return;
    setSaving(true);
    const payload = {
      studio_id: studioId,
      nome: form.nome.trim(),
      ruolo_professionale: form.ruolo_professionale.trim() || null,
      colore: form.colore,
      user_id: form.user_id || null,
    };
    const { error } = modal === 'new'
      ? await supabase.from('operatori').insert(payload)
      : await supabase.from('operatori').update(payload).eq('id', modal);
    setSaving(false);
    if (error) { setToast('Errore: ' + error.message); return; }
    setModal(null);
    setToast(modal === 'new' ? 'Operatore creato ✓' : 'Operatore aggiornato ✓');
    load();
  };

  const toggleAttivo = async (o) => {
    const { error } = await supabase.from('operatori').update({ attivo: !o.attivo }).eq('id', o.id);
    if (error) { setToast('Errore: ' + error.message); return; }
    setOperatori((prev) => prev.map((x) => (x.id === o.id ? { ...x, attivo: !x.attivo } : x)));
  };

  const elimina = async (o) => {
    if (!confirm(`Eliminare definitivamente "${o.nome}"? Gli appuntamenti già assegnati resteranno ma senza operatore collegato.`)) return;
    const { error } = await supabase.from('operatori').delete().eq('id', o.id);
    if (error) { setToast('Errore: ' + error.message); return; }
    setOperatori((prev) => prev.filter((x) => x.id !== o.id));
    setToast('Operatore eliminato ✓');
  };

  if (!features?.multi_operatore) {
    return (
      <Crd style={{ marginBottom: 11 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: C.pri, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>Operatori</div>
        <div style={{ background: C.bg, borderRadius: 12, padding: 18, textAlign: 'center' }}>
          <div style={{ fontSize: 22, marginBottom: 6 }}>🔒</div>
          <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 4 }}>Multi-agenda non attiva</div>
          <div style={{ fontSize: 12, color: C.txm }}>Gestisci più professionisti con agende separate e assegna gli appuntamenti a ciascuno. Contatta l'assistenza per attivarla.</div>
        </div>
      </Crd>
    );
  }

  return (
    <div style={{ marginBottom: 20 }}>
      {toast && <Toast msg={toast} onDone={() => setToast('')} />}

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div style={{ fontSize: 14, fontWeight: 800, color: C.txt }}>🩺 Operatori</div>
        {isStudioAdmin && (
          <button onClick={apriNuovo}
            style={{ background: C.pri, border: 'none', borderRadius: 9, padding: '8px 14px', color: '#fff', fontWeight: 700, fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
            <Ic n="plus" s={12} c="#fff" /> Nuovo operatore
          </button>
        )}
      </div>
      {!isStudioAdmin && (
        <div style={{ fontSize: 11.5, color: C.txm, background: C.bg, borderRadius: 8, padding: '8px 12px', marginBottom: 12 }}>
          Solo gli admin dello studio possono creare, modificare o eliminare operatori.
        </div>
      )}

      {loading && <div style={{ textAlign: 'center', color: C.txl, padding: 20 }}>⏳ Caricamento...</div>}

      {!loading && operatori.length === 0 && (
        <div style={{ textAlign: 'center', color: C.txl, padding: 30, fontSize: 12.5 }}>Nessun operatore creato — l'agenda resta unica finché non ne aggiungi almeno uno.</div>
      )}

      {operatori.map((o) => {
        const account = accountDisponibili.find((a) => a.user_id === o.user_id);
        return (
          <div key={o.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', background: o.attivo ? C.bg : C.sur, opacity: o.attivo ? 1 : 0.55, borderRadius: 10, marginBottom: 8, border: `1px solid ${C.brd}` }}>
            <div style={{ width: 36, height: 36, borderRadius: '50%', background: o.colore, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <span style={{ fontSize: 14, fontWeight: 800, color: '#fff' }}>{o.nome?.charAt(0)?.toUpperCase() || '?'}</span>
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 700, fontSize: 13, color: C.txt, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {o.nome} {!o.attivo && <span style={{ fontSize: 10, color: C.txl }}>(disattivato)</span>}
              </div>
              <div style={{ fontSize: 11, color: C.txl, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {o.ruolo_professionale || 'Nessun ruolo indicato'}{account ? ` · collegato a ${account.nome}` : ' · senza accesso all\'app'}
              </div>
            </div>
            {isStudioAdmin && (
              <div style={{ display: 'flex', gap: 5, flexShrink: 0 }}>
                <button onClick={() => apriModifica(o)} style={{ background: C.priL, border: 'none', borderRadius: 7, padding: '5px 7px', cursor: 'pointer' }} title="Modifica">
                  <Ic n="edit" s={12} c={C.pri} />
                </button>
                <button onClick={() => toggleAttivo(o)} style={{ background: o.attivo ? C.war + '18' : C.sucL, border: 'none', borderRadius: 7, padding: '5px 7px', cursor: 'pointer' }} title={o.attivo ? 'Disattiva' : 'Riattiva'}>
                  <Ic n={o.attivo ? 'x' : 'ok'} s={12} c={o.attivo ? C.war : C.suc} />
                </button>
                <button onClick={() => elimina(o)} style={{ background: C.danL, border: 'none', borderRadius: 7, padding: '5px 7px', cursor: 'pointer' }} title="Elimina">
                  <Ic n="del" s={12} c={C.dan} />
                </button>
              </div>
            )}
          </div>
        );
      })}

      {modal && (
        <Modal title={modal === 'new' ? '🩺 Nuovo operatore' : 'Modifica operatore'} onClose={() => setModal(null)}>
          <Fld label="Nome e cognome"><Inp value={form.nome} onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))} placeholder="es. Dott.ssa Anna Bianchi" autoFocus /></Fld>
          <Fld label="Ruolo professionale (opzionale)"><Inp value={form.ruolo_professionale} onChange={(e) => setForm((f) => ({ ...f, ruolo_professionale: e.target.value }))} placeholder="es. Igienista, Fisioterapista..." /></Fld>
          <Fld label="Colore in agenda">
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {COLORI_DISPONIBILI.map((c) => (
                <button key={c} onClick={() => setForm((f) => ({ ...f, colore: c }))}
                  style={{ width: 28, height: 28, borderRadius: '50%', background: c, border: form.colore === c ? `2.5px solid ${C.txt}` : '2.5px solid transparent', cursor: 'pointer' }} />
              ))}
            </div>
          </Fld>
          <Fld label="Account collegato (opzionale)">
            <Sel value={form.user_id} onChange={(e) => setForm((f) => ({ ...f, user_id: e.target.value }))}>
              <option value="">Nessuno — solo risorsa in agenda</option>
              {accountDisponibili.map((a) => <option key={a.user_id} value={a.user_id}>{a.nome}</option>)}
            </Sel>
            <div style={{ fontSize: 10.5, color: C.txl, marginTop: 4 }}>Serve solo se in futuro questo operatore vorrà collegare il proprio Google Calendar personale.</div>
          </Fld>
          <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
            <Btn ch="Annulla" v="sec" onClick={() => setModal(null)} full />
            <Btn ch={saving ? 'Salvataggio…' : 'Salva'} onClick={salva} dis={!form.nome.trim() || saving} full />
          </div>
        </Modal>
      )}
    </div>
  );
}
