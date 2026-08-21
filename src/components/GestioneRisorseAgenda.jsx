import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase.js';
import { C, COLORI_DISPONIBILI } from '../lib/utils';
import { Crd, Fld, Inp, Sel, Modal, Toast, Btn, Ic } from './ui';

/* ── OPERATORI / POLTRONE ──
   Le due dimensioni della multi-agenda condividono la stessa forma (nome,
   colore, attivo) e la stessa logica CRUD — questo componente serve
   entrambe, parametrizzato da "tipo", per non duplicare la stessa UI due
   volte. Solo gli operatori hanno un ruolo professionale e un possibile
   account collegato (una poltrona è una postazione fisica, non una
   persona: niente user_id/ruolo). */
const CONFIG = {
  operatori: {
    tabella: 'operatori', icona: 'user', titoloPlurale: 'Operatori', titoloSingolare: 'operatore',
    mostraRuolo: true, mostraAccount: true,
    placeholderNome: 'es. Dott.ssa Anna Bianchi',
    vuoto: "Nessun operatore creato — l'agenda resta unica finché non ne aggiungi almeno uno.",
  },
  poltrone: {
    tabella: 'poltrone', icona: 'chair', titoloPlurale: 'Poltrone', titoloSingolare: 'poltrona',
    mostraRuolo: false, mostraAccount: false,
    placeholderNome: 'es. Poltrona 1, Sala 2...',
    vuoto: 'Nessuna poltrona creata — se non ne aggiungi, l\'agenda non traccia le postazioni fisiche.',
  },
};

const formVuoto = () => ({ nome: '', ruolo_professionale: '', colore: COLORI_DISPONIBILI[0], user_id: '' });

export default function GestioneRisorseAgenda({ tipo, studioId, currentUserId, titolareNome, features, isStudioAdmin, vertical }) {
  const isDentistico = !vertical || vertical === 'dentistico';
  const cfgBase = CONFIG[tipo] || CONFIG.operatori;
  // "Poltrone" è terminologia odontoiatrica: per gli altri vertical la stessa
  // risorsa (postazione fisica) prende un nome generico, senza toccare la
  // tabella né la logica CRUD sottostante (tutto invariato, solo le label).
  const cfg = (tipo === 'poltrone' && !isDentistico)
    ? { ...cfgBase, icona: 'chair', titoloPlurale: 'Postazioni', titoloSingolare: 'postazione', placeholderNome: 'es. Sala 1, Box 2...', vuoto: 'Nessuna postazione creata — se non ne aggiungi, l\'agenda non traccia le postazioni fisiche.' }
    : cfgBase;
  const [risorse, setRisorse] = useState([]);
  const [studioUsers, setStudioUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState('');
  const [modal, setModal] = useState(null); // null | 'new' | id
  const [form, setForm] = useState(formVuoto());
  const [saving, setSaving] = useState(false);

  useEffect(() => { if (features?.multi_operatore) load(); else setLoading(false); }, [features?.multi_operatore, tipo]);

  const load = async () => {
    setLoading(true);
    const queries = [supabase.from(cfg.tabella).select('*').eq('studio_id', studioId).order('created_at')];
    if (cfg.mostraAccount) queries.push(supabase.from('studio_users').select('id, nome, email, user_id').eq('studio_id', studioId));
    const results = await Promise.all(queries);
    setRisorse(results[0].data || []);
    if (cfg.mostraAccount) setStudioUsers(results[1].data || []);
    setLoading(false);
  };

  // Account collegabili (solo operatori): il titolare (non ha riga in studio_users,
  // trattato come admin implicito) + gli studio_users con account già attivo.
  const accountDisponibili = cfg.mostraAccount ? [
    ...(currentUserId ? [{ user_id: currentUserId, nome: titolareNome || 'Titolare' }] : []),
    ...studioUsers.filter((u) => u.user_id).map((u) => ({ user_id: u.user_id, nome: u.nome })),
  ] : [];

  const apriNuovo = () => { setForm(formVuoto()); setModal('new'); };
  const apriModifica = (r) => { setForm({ nome: r.nome, ruolo_professionale: r.ruolo_professionale || '', colore: r.colore, user_id: r.user_id || '' }); setModal(r.id); };

  const salva = async () => {
    if (!form.nome.trim()) return;
    setSaving(true);
    const payload = { studio_id: studioId, nome: form.nome.trim(), colore: form.colore };
    if (cfg.mostraRuolo) payload.ruolo_professionale = form.ruolo_professionale.trim() || null;
    if (cfg.mostraAccount) payload.user_id = form.user_id || null;
    const { error } = modal === 'new'
      ? await supabase.from(cfg.tabella).insert(payload)
      : await supabase.from(cfg.tabella).update(payload).eq('id', modal);
    setSaving(false);
    if (error) { setToast('Errore: ' + error.message); return; }
    setModal(null);
    setToast(modal === 'new' ? `${cfg.titoloSingolare.charAt(0).toUpperCase() + cfg.titoloSingolare.slice(1)} creata/o ✓` : 'Aggiornata/o ✓');
    load();
  };

  const toggleAttivo = async (r) => {
    const { error } = await supabase.from(cfg.tabella).update({ attivo: !r.attivo }).eq('id', r.id);
    if (error) { setToast('Errore: ' + error.message); return; }
    setRisorse((prev) => prev.map((x) => (x.id === r.id ? { ...x, attivo: !x.attivo } : x)));
  };

  const elimina = async (r) => {
    if (!confirm(`Eliminare definitivamente "${r.nome}"? Gli appuntamenti già assegnati resteranno ma senza ${cfg.titoloSingolare} collegata/o.`)) return;
    const { error } = await supabase.from(cfg.tabella).delete().eq('id', r.id);
    if (error) { setToast('Errore: ' + error.message); return; }
    setRisorse((prev) => prev.filter((x) => x.id !== r.id));
    setToast(`${cfg.titoloSingolare.charAt(0).toUpperCase() + cfg.titoloSingolare.slice(1)} eliminata/o ✓`);
  };

  if (!features?.multi_operatore) {
    return (
      <Crd style={{ marginBottom: 11 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: C.pri, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>{cfg.titoloPlurale}</div>
        <div style={{ background: C.bg, borderRadius: 12, padding: 18, textAlign: 'center' }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 6 }}><Ic n="lock" s={22} c={C.txl} /></div>
          <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 4 }}>Multi-agenda non attiva</div>
          <div style={{ fontSize: 12, color: C.txm }}>Gestisci più professionisti e poltrone con agende separate e assegna gli appuntamenti a ciascuno.</div>
        </div>
      </Crd>
    );
  }

  return (
    <div style={{ marginBottom: 20 }}>
      {toast && <Toast msg={toast} onDone={() => setToast('')} />}

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 14, fontWeight: 800, color: C.txt }}><Ic n={cfg.icona} s={14} c={C.pri} />{cfg.titoloPlurale}</div>
        {isStudioAdmin && (
          <button onClick={apriNuovo}
            style={{ background: C.pri, border: 'none', borderRadius: 9, padding: '8px 14px', color: '#fff', fontWeight: 700, fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
            <Ic n="plus" s={12} c="#fff" /> Nuova/o {cfg.titoloSingolare}
          </button>
        )}
      </div>
      {!isStudioAdmin && (
        <div style={{ fontSize: 11.5, color: C.txm, background: C.bg, borderRadius: 8, padding: '8px 12px', marginBottom: 12 }}>
          Solo gli admin dello studio possono creare, modificare o eliminare {cfg.titoloPlurale.toLowerCase()}.
        </div>
      )}

      {loading && <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, color: C.txl, padding: 20 }}><Ic n="clk" s={13} c={C.txl} />Caricamento…</div>}

      {!loading && risorse.length === 0 && (
        <div style={{ textAlign: 'center', color: C.txl, padding: 30, fontSize: 12.5 }}>{cfg.vuoto}</div>
      )}

      {risorse.map((r) => {
        const account = cfg.mostraAccount ? accountDisponibili.find((a) => a.user_id === r.user_id) : null;
        return (
          <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', background: r.attivo ? C.bg : C.sur, opacity: r.attivo ? 1 : 0.55, borderRadius: 10, marginBottom: 8, border: `1px solid ${C.brd}` }}>
            <div style={{ width: 36, height: 36, borderRadius: '50%', background: r.colore, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <span style={{ fontSize: 14, fontWeight: 800, color: '#fff' }}>{r.nome?.charAt(0)?.toUpperCase() || '?'}</span>
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 700, fontSize: 13, color: C.txt, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {r.nome} {!r.attivo && <span style={{ fontSize: 10, color: C.txl }}>(disattivata/o)</span>}
              </div>
              {(cfg.mostraRuolo || cfg.mostraAccount) && (
                <div style={{ fontSize: 11, color: C.txl, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {cfg.mostraRuolo ? (r.ruolo_professionale || 'Nessun ruolo indicato') : null}
                  {cfg.mostraAccount ? (account ? ` · collegato a ${account.nome}` : ' · senza accesso all\'app') : null}
                </div>
              )}
            </div>
            {isStudioAdmin && (
              <div style={{ display: 'flex', gap: 5, flexShrink: 0 }}>
                <button onClick={() => apriModifica(r)} style={{ background: C.priL, border: 'none', borderRadius: 7, padding: '5px 7px', cursor: 'pointer' }} title="Modifica">
                  <Ic n="edit" s={12} c={C.pri} />
                </button>
                <button onClick={() => toggleAttivo(r)} style={{ background: r.attivo ? C.war + '18' : C.sucL, border: 'none', borderRadius: 7, padding: '5px 7px', cursor: 'pointer' }} title={r.attivo ? 'Disattiva' : 'Riattiva'}>
                  <Ic n={r.attivo ? 'x' : 'ok'} s={12} c={r.attivo ? C.war : C.suc} />
                </button>
                <button onClick={() => elimina(r)} style={{ background: C.danL, border: 'none', borderRadius: 7, padding: '5px 7px', cursor: 'pointer' }} title="Elimina">
                  <Ic n="del" s={12} c={C.dan} />
                </button>
              </div>
            )}
          </div>
        );
      })}

      {modal && (
        <Modal title={modal === 'new' ? `Nuova/o ${cfg.titoloSingolare}` : `Modifica ${cfg.titoloSingolare}`} icon={cfg.icona} onClose={() => setModal(null)}>
          <Fld label="Nome"><Inp value={form.nome} onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))} placeholder={cfg.placeholderNome} autoFocus /></Fld>
          {cfg.mostraRuolo && (
            <Fld label="Ruolo professionale (opzionale)"><Inp value={form.ruolo_professionale} onChange={(e) => setForm((f) => ({ ...f, ruolo_professionale: e.target.value }))} placeholder="es. Igienista, Fisioterapista..." /></Fld>
          )}
          <Fld label="Colore in agenda">
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {COLORI_DISPONIBILI.map((c) => (
                <button key={c} onClick={() => setForm((f) => ({ ...f, colore: c }))}
                  style={{ width: 28, height: 28, borderRadius: '50%', background: c, border: form.colore === c ? `2.5px solid ${C.txt}` : '2.5px solid transparent', cursor: 'pointer' }} />
              ))}
            </div>
          </Fld>
          {cfg.mostraAccount && (
            <Fld label="Account collegato (opzionale)">
              <Sel value={form.user_id} onChange={(e) => setForm((f) => ({ ...f, user_id: e.target.value }))}>
                <option value="">Nessuno — solo risorsa in agenda</option>
                {accountDisponibili.map((a) => <option key={a.user_id} value={a.user_id}>{a.nome}</option>)}
              </Sel>
              <div style={{ fontSize: 10.5, color: C.txl, marginTop: 4 }}>Serve solo se in futuro questo operatore vorrà collegare il proprio Google Calendar personale.</div>
            </Fld>
          )}
          <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
            <Btn ch="Annulla" v="sec" onClick={() => setModal(null)} full />
            <Btn ch={saving ? 'Salvataggio…' : 'Salva'} onClick={salva} dis={!form.nome.trim() || saving} full />
          </div>
        </Modal>
      )}
    </div>
  );
}
