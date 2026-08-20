import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase.js';
import { C } from '../lib/utils';
import { Crd, Fld, Inp, Sel, Modal, Toast, Btn, Ic } from './ui';

const CAPABILITIES = Object.freeze([
  ['home.front_desk', 'Front desk'],
  ['clinical.general', 'Clinico'],
  ['clinical.physiotherapist', 'Fisioterapista'],
  ['clinical.personal_trainer', 'Personal trainer'],
  ['clinical.massage_therapist', 'Massaggiatore'],
]);

export default function GestioneUtenti({ studioId, currentUserId, features, isStudioAdmin }) {
  const [utenti, setUtenti] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState('');
  const [invitaModal, setInvitaModal] = useState(false);
  const [form, setForm] = useState({ email: '', nome: '', ruolo: 'utente' });
  const [sending, setSending] = useState(false);
  const [capabilityRows, setCapabilityRows] = useState([]);

  useEffect(() => { loadUtenti(); }, []);

  const loadUtenti = async () => {
    setLoading(true);
    if (!studioId) { setUtenti([]); setCapabilityRows([]); setLoading(false); return; }
    const [{ data }, { data: assignments }] = await Promise.all([
      supabase.from('studio_users').select('*').eq('studio_id', studioId).order('created_at'),
      supabase.from('studio_user_capabilities').select('studio_id,user_id,capability').eq('studio_id', studioId),
    ]);
    if (data) setUtenti(data);
    if (assignments) setCapabilityRows(assignments);
    setLoading(false);
  };

  const maxUtenti = features?.max_utenti ?? null; // include il titolare nel conteggio
  const limiteRaggiunto = maxUtenti != null && (utenti.length + 1) >= maxUtenti;

  const invita = async () => {
    if (!form.email || !form.nome) return;
    if (limiteRaggiunto) { setToast(`Limite di ${maxUtenti} utenti del tuo piano raggiunto. Passa a un piano superiore per aggiungerne altri.`); return; }
    setSending(true);
    try {
      // 1. Crea record in studio_users
      const { error } = await supabase.from('studio_users').insert([{
        studio_id: studioId,
        email: form.email,
        nome: form.nome,
        ruolo: form.ruolo,
        stato: 'invitato',
      }]);
      if (error) throw error;

      // 2. Invia magic link via Supabase
      await supabase.auth.admin?.inviteUserByEmail?.(form.email) ||
        await supabase.auth.signInWithOtp({ email: form.email });

      setToast(`Invito inviato a ${form.email} ✓`);
      setInvitaModal(false);
      setForm({ email: '', nome: '', ruolo: 'utente' });
      loadUtenti();
    } catch (e) {
      setToast('Errore: ' + e.message);
    }
    setSending(false);
  };

  const cambiaRuolo = async (id, ruolo) => {
    const { error } = await supabase.from('studio_users').update({ ruolo }).eq('id', id);
    if (error) { setToast('Errore: ' + error.message); return; }
    setUtenti(prev => prev.map(u => u.id === id ? { ...u, ruolo } : u));
    setToast('Ruolo aggiornato ✓');
  };

  const toggleCapability = async (userId, capability, enabled) => {
    if (!isStudioAdmin || !studioId || !userId) return;
    const query = enabled
      ? supabase.from('studio_user_capabilities').delete().eq('studio_id',studioId).eq('user_id',userId).eq('capability',capability)
      : supabase.from('studio_user_capabilities').insert({ studio_id:studioId,user_id:userId,capability });
    const { error } = await query;
    if (error) { setToast('Capability non aggiornata: ' + error.message); return; }
    await loadUtenti();
    setToast('Capability aggiornata ✓');
  };

  const rimuovi = async (id, email) => {
    if (!confirm(`Rimuovere ${email} dallo studio?`)) return;
    const { error } = await supabase.from('studio_users').delete().eq('id', id);
    if (error) { setToast('Errore: ' + error.message); return; }
    setUtenti(prev => prev.filter(u => u.id !== id));
    setToast('Utente rimosso ✓');
  };

  const RUOLI = { admin: { label: 'Admin', color: C.pri }, utente: { label: 'Utente', color: C.suc } };
  const STATI = { attivo: { label: 'Attivo', color: C.suc }, invitato: { label: 'Invitato', color: C.war } };

  return (
    <div style={{ marginBottom: 20 }}>
      {toast && <Toast msg={toast} onDone={() => setToast('')} />}

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div style={{ fontSize: 14, fontWeight: 800, color: C.txt }}>👥 Utenti studio</div>
        {isStudioAdmin && (
          <button onClick={() => { if (limiteRaggiunto) { setToast(`Limite di ${maxUtenti} utenti raggiunto per il tuo piano.`); return; } setForm({ email: '', nome: '', ruolo: 'utente' }); setInvitaModal(true); }}
            style={{ background: limiteRaggiunto ? C.bg : C.pri, border: 'none', borderRadius: 9, padding: '8px 14px', color: limiteRaggiunto ? C.txl : '#fff', fontWeight: 700, fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
            {limiteRaggiunto ? '🔒 Limite raggiunto' : <><Ic n="plus" s={12} c="#fff" /> Invita utente</>}
          </button>
        )}
      </div>
      {!isStudioAdmin && (
        <div style={{ fontSize: 11.5, color: C.txm, background: C.bg, borderRadius: 8, padding: '8px 12px', marginBottom: 12 }}>
          Solo gli admin dello studio possono invitare, cambiare ruolo o rimuovere utenti.
        </div>
      )}
      {maxUtenti != null && (
        <div style={{ fontSize: 11, color: limiteRaggiunto ? C.dan : C.txl, marginBottom: 12, marginTop: -8 }}>
          {utenti.length + 1}/{maxUtenti} utenti usati (incluso il titolare) nel piano attuale
        </div>
      )}

      {loading && <div style={{ textAlign: 'center', color: C.txl, padding: 20 }}>⏳ Caricamento...</div>}

      {utenti.map(u => {
        const isMe = u.user_id === currentUserId;
        const ruolo = RUOLI[u.ruolo] || RUOLI.utente;
        const stato = STATI[u.stato] || STATI.invitato;
        const userCapabilities = new Set(capabilityRows.filter((row) => row.user_id === u.user_id).map((row) => row.capability));
        return (
          <div key={u.id} style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap:'wrap', padding: '12px 14px', background: isMe ? C.priL : C.bg, borderRadius: 10, marginBottom: 8, border: `1px solid ${isMe ? C.pri + '30' : C.brd}` }}>
            <div style={{ width: 36, height: 36, borderRadius: '50%', background: ruolo.color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <span style={{ fontSize: 14, fontWeight: 800, color: '#fff' }}>{u.nome?.charAt(0)?.toUpperCase() || '?'}</span>
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 700, fontSize: 13, color: C.txt, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {u.nome} {isMe && <span style={{ fontSize: 10, color: C.pri }}>(tu)</span>}
              </div>
              <div style={{ fontSize: 11, color: C.txl, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.email}</div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4, flexShrink: 0 }}>
              <span style={{ fontSize: 10, fontWeight: 700, color: ruolo.color, background: ruolo.color + '18', borderRadius: 5, padding: '2px 7px' }}>{ruolo.label}</span>
              <span style={{ fontSize: 10, fontWeight: 600, color: stato.color }}>{stato.label}</span>
            </div>
            {!isMe && isStudioAdmin && (
              <div style={{ display: 'flex', gap: 5, flexShrink: 0 }}>
                <select value={u.ruolo} onChange={e => cambiaRuolo(u.id, e.target.value)}
                  style={{ fontSize: 11, padding: '4px 6px', borderRadius: 7, border: `1px solid ${C.brd}`, background: C.sur, cursor: 'pointer' }}>
                  <option value="utente">Utente</option>
                  <option value="admin">Admin</option>
                </select>
                <button onClick={() => rimuovi(u.id, u.email)}
                  style={{ background: C.danL, border: 'none', borderRadius: 7, padding: '5px 7px', cursor: 'pointer' }}>
                  <Ic n="del" s={12} c={C.dan} />
                </button>
              </div>
            )}
            {isStudioAdmin && u.user_id && <div style={{ flexBasis:'100%',display:'flex',gap:5,flexWrap:'wrap',paddingTop:8,borderTop:`1px solid ${C.brd}` }}>
              {CAPABILITIES.map(([capability,label]) => {
                const enabled=userCapabilities.has(capability);
                return <button key={capability} type="button" aria-pressed={enabled} onClick={()=>toggleCapability(u.user_id,capability,enabled)}
                  style={{border:`1px solid ${enabled?C.pri:C.brd}`,borderRadius:7,padding:'5px 8px',background:enabled?C.priL:C.sur,color:enabled?C.pri:C.txm,fontSize:10,fontWeight:700,cursor:'pointer'}}>{enabled?'✓ ':''}{label}</button>;
              })}
              <div style={{flexBasis:'100%',fontSize:10,color:C.txl}}>Le capability sono additive ed esplicite. Admin non implica accesso clinico.</div>
            </div>}
          </div>
        );
      })}

      {/* MODAL INVITA */}
      {invitaModal && (
        <Modal title="✉️ Invita utente" onClose={() => setInvitaModal(false)}>
          <div style={{ fontSize: 12, color: C.txm, marginBottom: 14, lineHeight: 1.5 }}>
            L'utente riceverà un'email con il link per accedere allo studio.
          </div>
          <Fld label="Nome e cognome"><Inp value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} placeholder="es. Mario Rossi" /></Fld>
          <Fld label="Email"><Inp type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="email@esempio.it" /></Fld>
          <Fld label="Ruolo">
            <Sel value={form.ruolo} onChange={e => setForm(f => ({ ...f, ruolo: e.target.value }))}>
              <option value="utente">Utente — accesso completo</option>
              <option value="admin">Admin — accesso completo + gestione utenti</option>
            </Sel>
          </Fld>
          <div style={{ background: C.priL, borderRadius: 8, padding: '9px 12px', marginBottom: 10 }}>
            <div style={{ fontSize: 11, color: C.pri, fontWeight: 600 }}>📧 Verrà inviata un'email con il link di accesso a {form.email || 'questo indirizzo'}</div>
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
            <Btn ch="Annulla" v="sec" onClick={() => setInvitaModal(false)} full />
            <Btn ch={sending ? 'Invio...' : 'Invia invito'} onClick={invita} dis={!form.email || !form.nome || sending} full />
          </div>
        </Modal>
      )}
    </div>
  );
}
