import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase.js';
import { Btn, Crd, Fld, Inp, Sel, Modal, Ic, Toast } from './ui';
import { C, fmtD, VERTICALI_DISPONIBILI, FEATURE_TOGGLES, PIANI_FEATURES_DEFAULT, computeFeatures, ASSISTENTE_AI_LIVELLI } from '../lib/utils';

const PIANI = [
  { id: 'base', label: 'Base' },
  { id: 'pro', label: 'Pro' },
  { id: 'premium', label: 'Premium' },
];

export default function MasterDashboard({ onClose }) {
  const [studi, setStudi] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [selStudio, setSelStudio] = useState(null); // studio aperto nel pannello dettaglio
  const [utenti, setUtenti] = useState([]);
  const [utentiLoading, setUtentiLoading] = useState(false);
  const [form, setForm] = useState({ piano: 'base', vertical: 'dentistico', vertical_altro: '', attivo: true, featureOverrides: {}, aiTrialEndsAt: null });
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState('');

  const load = async () => {
    setLoading(true);
    setErr('');
    const { data, error } = await supabase.rpc('admin_list_studios');
    if (error) setErr(error.message || 'Errore nel caricamento');
    else setStudi(data || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const apriStudio = async (s) => {
    setSelStudio(s);
    setForm({ piano: s.piano || 'base', vertical: s.vertical || 'dentistico', vertical_altro: s.vertical_altro || '', attivo: s.attivo, featureOverrides: { ...(s.feature_overrides || {}) }, aiTrialEndsAt: s.ai_trial_ends_at || null });
    setUtentiLoading(true);
    const { data, error } = await supabase.rpc('admin_list_studio_users', { p_studio_id: s.id });
    setUtenti(error ? [] : (data || []));
    setUtentiLoading(false);
  };

  const salva = async () => {
    if (!selStudio) return;
    setSaving(true);
    const { error } = await supabase.rpc('admin_update_studio', {
      p_studio_id: selStudio.id,
      p_piano: form.piano,
      p_vertical: form.vertical,
      p_vertical_altro: form.vertical === 'altro' ? form.vertical_altro : null,
      p_attivo: form.attivo,
      p_feature_overrides: form.featureOverrides,
      p_clear_ai_trial: !form.aiTrialEndsAt,
    });
    setSaving(false);
    if (error) { setToast('Errore: ' + error.message); return; }
    setToast('Salvato ✓');
    setSelStudio(null);
    load();
  };

  const attivaProvaAssistente = async () => {
    const scadenza = new Date(Date.now() + 15 * 86400000).toISOString();
    setSaving(true);
    const { error } = await supabase.rpc('admin_update_studio', {
      p_studio_id: selStudio.id,
      p_feature_overrides: { ...form.featureOverrides, assistente_ai: 'premium' },
      p_ai_trial_ends_at: scadenza,
    });
    setSaving(false);
    if (error) { setToast('Errore: ' + error.message); return; }
    setForm((f) => ({ ...f, featureOverrides: { ...f.featureOverrides, assistente_ai: 'premium' }, aiTrialEndsAt: scadenza }));
    setToast('Prova 15gg attivata ✓');
  };

  // Tri-stato per ogni toggle: undefined = usa il default del piano, true/false = override esplicito
  const setToggle = (id, value) => {
    setForm((f) => {
      const next = { ...f.featureOverrides };
      if (value === undefined) delete next[id];
      else next[id] = value;
      return { ...f, featureOverrides: next };
    });
  };

  const toggleAttivo = async (s) => {
    const nuovoStato = !s.attivo;
    if (!confirm(nuovoStato ? `Riattivare "${s.nome}"?` : `Sospendere "${s.nome}"? Non potrà più accedere all'app.`)) return;
    const { error } = await supabase.rpc('admin_update_studio', { p_studio_id: s.id, p_attivo: nuovoStato });
    if (error) { setToast('Errore: ' + error.message); return; }
    setToast(nuovoStato ? 'Studio riattivato ✓' : 'Studio sospeso ✓');
    load();
  };

  const totPazienti = studi.reduce((a, s) => a + Number(s.n_pazienti || 0), 0);
  const totAttivi = studi.filter((s) => s.attivo).length;

  return (
    <div style={{ position: 'fixed', inset: 0, background: C.bg, zIndex: 900, display: 'flex', flexDirection: 'column' }}>
      {toast && <Toast msg={toast} onDone={() => setToast('')} />}

      <div style={{ background: C.priD, padding: '12px 14px', paddingTop: 'max(12px,env(safe-area-inset-top))', display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
        <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.12)', border: 'none', borderRadius: 8, padding: 8, cursor: 'pointer', display: 'flex' }}>
          <Ic n="back" s={18} c="#fff" />
        </button>
        <div style={{ flex: 1 }}>
          <div style={{ color: '#fff', fontWeight: 800, fontSize: 15 }}>🛠️ Dashboard Master</div>
          <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: 11 }}>{studi.length} studi · {totAttivi} attivi · {totPazienti} pazienti totali</div>
        </div>
        <button onClick={load} style={{ background: 'rgba(255,255,255,0.12)', border: 'none', borderRadius: 8, padding: 8, cursor: 'pointer', display: 'flex', fontSize: 16 }}>
          🔄
        </button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: 14 }}>
        {loading && <div style={{ textAlign: 'center', color: C.txl, padding: 40 }}>⏳ Caricamento...</div>}
        {err && <div style={{ background: C.danL, color: C.dan, padding: 12, borderRadius: 10, marginBottom: 12, fontSize: 13, fontWeight: 600 }}>{err}</div>}

        {!loading && !err && studi.map((s) => {
          const vLabel = s.vertical === 'altro' && s.vertical_altro ? s.vertical_altro : (VERTICALI_DISPONIBILI.find((v) => v.id === s.vertical) || {}).label || s.vertical;
          return (
            <Crd key={s.id} style={{ marginBottom: 10, opacity: s.attivo ? 1 : 0.6 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
                <div onClick={() => apriStudio(s)} style={{ flex: 1, cursor: 'pointer' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontWeight: 800, fontSize: 15 }}>{s.nome}</span>
                    {!s.attivo && <span style={{ background: C.danL, color: C.dan, fontSize: 10, fontWeight: 800, padding: '2px 7px', borderRadius: 20 }}>SOSPESO</span>}
                    <span style={{ background: C.priL, color: C.pri, fontSize: 10, fontWeight: 800, padding: '2px 7px', borderRadius: 20, textTransform: 'uppercase' }}>{s.piano}</span>
                  </div>
                  <div style={{ fontSize: 12, color: C.txm, marginTop: 3 }}>{s.email}</div>
                  <div style={{ fontSize: 11, color: C.txl, marginTop: 2 }}>{vLabel} · {s.n_pazienti} pazienti · {s.n_utenti} utenti · dal {fmtD(s.created_at?.slice(0, 10))}</div>
                </div>
                <button onClick={() => toggleAttivo(s)} style={{ background: s.attivo ? C.danL : C.sucL, color: s.attivo ? C.dan : C.suc, border: 'none', borderRadius: 8, padding: '6px 10px', fontWeight: 700, fontSize: 11, cursor: 'pointer', flexShrink: 0 }}>
                  {s.attivo ? 'Sospendi' : 'Riattiva'}
                </button>
              </div>
            </Crd>
          );
        })}
      </div>

      {selStudio && (
        <Modal title={selStudio.nome} onClose={() => setSelStudio(null)} wide>
          <Fld label="Piano abbonamento">
            <Sel value={form.piano} onChange={(e) => setForm((f) => ({ ...f, piano: e.target.value }))}>
              {PIANI.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
            </Sel>
          </Fld>
          <Fld label="Tipo professionista">
            <Sel value={form.vertical} onChange={(e) => setForm((f) => ({ ...f, vertical: e.target.value }))}>
              {VERTICALI_DISPONIBILI.map((v) => <option key={v.id} value={v.id}>{v.label}</option>)}
            </Sel>
          </Fld>
          {form.vertical === 'altro' && (
            <Fld label="Specifica professione">
              <Inp value={form.vertical_altro} onChange={(e) => setForm((f) => ({ ...f, vertical_altro: e.target.value }))} placeholder="es. Osteopata" />
            </Fld>
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: C.bg, borderRadius: 10, padding: 12, marginBottom: 14 }}>
            <div style={{ flex: 1, fontSize: 13, fontWeight: 700 }}>Stato account</div>
            <button onClick={() => setForm((f) => ({ ...f, attivo: !f.attivo }))} style={{ background: form.attivo ? C.sucL : C.danL, color: form.attivo ? C.suc : C.dan, border: 'none', borderRadius: 8, padding: '7px 14px', fontWeight: 800, fontSize: 12, cursor: 'pointer' }}>
              {form.attivo ? '✓ Attivo' : '✕ Sospeso'}
            </button>
          </div>

          <div style={{ fontSize: 11, fontWeight: 800, color: C.txm, textTransform: 'uppercase', marginBottom: 8 }}>Funzionalità (override manuale)</div>
          <div style={{ fontSize: 10, color: C.txl, marginBottom: 10 }}>Di default seguono il piano "{form.piano}". Puoi forzare singolarmente attiva/disattiva per questo studio.</div>
          {FEATURE_TOGGLES.map((ft) => {
            const pianoDefault = !!(PIANI_FEATURES_DEFAULT[form.piano] || PIANI_FEATURES_DEFAULT.base)[ft.id];
            const override = form.featureOverrides[ft.id]; // undefined | true | false
            const effettivo = override === undefined ? pianoDefault : override;
            return (
              <div key={ft.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 0', borderBottom: `1px solid ${C.brd}` }}>
                <div style={{ flex: 1, fontSize: 12, fontWeight: 600 }}>
                  {ft.label}
                  {override === undefined && <span style={{ color: C.txl, fontWeight: 400 }}> · default piano ({pianoDefault ? 'attivo' : 'disattivo'})</span>}
                </div>
                <div style={{ display: 'flex', gap: 4 }}>
                  <button onClick={() => setToggle(ft.id, undefined)} title="Usa il default del piano" style={{ background: override === undefined ? C.priL : 'transparent', color: override === undefined ? C.pri : C.txl, border: `1px solid ${C.brd}`, borderRadius: 6, padding: '4px 8px', fontSize: 10, fontWeight: 700, cursor: 'pointer' }}>Default</button>
                  <button onClick={() => setToggle(ft.id, true)} style={{ background: override === true ? C.sucL : 'transparent', color: override === true ? C.suc : C.txl, border: `1px solid ${C.brd}`, borderRadius: 6, padding: '4px 8px', fontSize: 10, fontWeight: 700, cursor: 'pointer' }}>ON</button>
                  <button onClick={() => setToggle(ft.id, false)} style={{ background: override === false ? C.danL : 'transparent', color: override === false ? C.dan : C.txl, border: `1px solid ${C.brd}`, borderRadius: 6, padding: '4px 8px', fontSize: 10, fontWeight: 700, cursor: 'pointer' }}>OFF</button>
                </div>
              </div>
            );
          })}

          <div style={{ fontSize: 11, fontWeight: 800, color: C.txm, textTransform: 'uppercase', marginTop: 16, marginBottom: 8 }}>Assistente AI</div>
          {(() => {
            const pianoDefault = (PIANI_FEATURES_DEFAULT[form.piano] || PIANI_FEATURES_DEFAULT.base).assistente_ai;
            const override = form.featureOverrides.assistente_ai; // undefined | 'off' | 'base' | 'pro' | 'premium'
            const effettivo = override === undefined ? pianoDefault : override;
            const trialAttivo = form.aiTrialEndsAt && new Date(form.aiTrialEndsAt) > new Date();
            return (
              <>
                <div style={{ fontSize: 10, color: C.txl, marginBottom: 8 }}>
                  Di default segue il piano "{form.piano}" ({ASSISTENTE_AI_LIVELLI.find((l) => l.id === pianoDefault)?.label}). Puoi forzare un livello specifico per questo studio.
                </div>
                <Fld label="Livello per questo studio">
                  <Sel value={override === undefined ? '__default__' : override} onChange={(e) => setToggle('assistente_ai', e.target.value === '__default__' ? undefined : e.target.value)}>
                    <option value="__default__">Usa il default del piano ({ASSISTENTE_AI_LIVELLI.find((l) => l.id === pianoDefault)?.label})</option>
                    {ASSISTENTE_AI_LIVELLI.map((l) => <option key={l.id} value={l.id}>{l.label}</option>)}
                  </Sel>
                </Fld>
                <div style={{ fontSize: 11, color: C.txm, marginBottom: 10 }}>
                  Livello effettivo attuale: <b>{ASSISTENTE_AI_LIVELLI.find((l) => l.id === effettivo)?.label || effettivo}</b>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: C.bg, borderRadius: 10, padding: 12, marginBottom: 14 }}>
                  <div style={{ flex: 1, fontSize: 12 }}>
                    {trialAttivo
                      ? <>Prova Premium attiva fino al <b>{fmtD(form.aiTrialEndsAt?.slice(0, 10))}</b></>
                      : (form.aiTrialEndsAt ? <>Prova scaduta il {fmtD(form.aiTrialEndsAt?.slice(0, 10))}</> : 'Nessuna prova attiva')}
                  </div>
                  <button onClick={attivaProvaAssistente} style={{ background: C.priL, color: C.pri, border: 'none', borderRadius: 8, padding: '6px 10px', fontWeight: 700, fontSize: 11, cursor: 'pointer' }}>
                    {trialAttivo ? 'Rinnova 15gg' : 'Attiva prova 15gg'}
                  </button>
                  {form.aiTrialEndsAt && (
                    <button onClick={() => setForm((f) => ({ ...f, aiTrialEndsAt: null }))} style={{ background: 'transparent', color: C.txl, border: `1px solid ${C.brd}`, borderRadius: 8, padding: '6px 10px', fontWeight: 700, fontSize: 11, cursor: 'pointer' }}>
                      Rimuovi scadenza
                    </button>
                  )}
                </div>
              </>
            );
          })()}

          <div style={{ fontSize: 11, fontWeight: 800, color: C.txm, textTransform: 'uppercase', marginTop: 16, marginBottom: 8 }}>Utenti dello studio</div>

          {utentiLoading && <div style={{ color: C.txl, fontSize: 12, marginBottom: 10 }}>Caricamento...</div>}
          {!utentiLoading && utenti.length === 0 && <div style={{ color: C.txl, fontSize: 12, marginBottom: 10 }}>Nessun utente registrato oltre al titolare</div>}
          {!utentiLoading && utenti.map((u) => (
            <div key={u.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', borderBottom: `1px solid ${C.brd}`, fontSize: 12 }}>
              <span>{u.nome || u.email} <span style={{ color: C.txl }}>· {u.ruolo}</span></span>
              <span style={{ color: u.stato === 'attivo' ? C.suc : C.txl, fontWeight: 700 }}>{u.stato}</span>
            </div>
          ))}

          <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
            <Btn ch="Annulla" v="sec" onClick={() => setSelStudio(null)} full />
            <Btn ch={saving ? 'Salvataggio...' : 'Salva modifiche'} onClick={salva} full />
          </div>
        </Modal>
      )}
    </div>
  );
}
