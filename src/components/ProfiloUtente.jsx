import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase.js';
import { C } from '../lib/utils';
import { Crd, Fld, Inp, Btn, Toast } from './ui';

export default function ProfiloUtente({ onNomeChange }) {
  const [form, setForm] = useState({ nome: '', cognome: '', telefono: '', ruolo_testo: '' });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState('');

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        const m = user.user_metadata || {};
        setForm({
          nome: m.nome || '',
          cognome: m.cognome || '',
          telefono: m.telefono || '',
          ruolo_testo: m.ruolo_testo || '',
        });
      }
      setLoading(false);
    });
  }, []);

  const salva = async () => {
    setSaving(true);
    const { error } = await supabase.auth.updateUser({ data: form });
    if (!error) {
      setToast('Profilo salvato ✓');
      if (onNomeChange) onNomeChange(`${form.nome} ${form.cognome}`.trim());
    } else {
      setToast('Errore: ' + error.message);
    }
    setSaving(false);
  };

  if (loading) return null;

  return (
    <Crd style={{ marginBottom: 16 }}>
      {toast && <Toast msg={toast} onDone={() => setToast('')} />}
      <div style={{ fontSize: 14, fontWeight: 800, color: C.txt, marginBottom: 14 }}>👤 Profilo utente</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <Fld label="Nome"><Inp value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} placeholder="es. Luca" /></Fld>
        <Fld label="Cognome"><Inp value={form.cognome} onChange={e => setForm(f => ({ ...f, cognome: e.target.value }))} placeholder="es. Simondi" /></Fld>
      </div>
      <Fld label="Telefono"><Inp value={form.telefono} onChange={e => setForm(f => ({ ...f, telefono: e.target.value }))} placeholder="es. 320 5505397" /></Fld>
      <Fld label="Ruolo / qualifica"><Inp value={form.ruolo_testo} onChange={e => setForm(f => ({ ...f, ruolo_testo: e.target.value }))} placeholder="es. Medico Odontoiatra" /></Fld>
      <Btn ch={saving ? 'Salvataggio...' : 'Salva profilo'} onClick={salva} dis={saving} full />
    </Crd>
  );
}
