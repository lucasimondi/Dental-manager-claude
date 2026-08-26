import React, { useState } from 'react';
import { supabase } from '../lib/supabase.js';
import { Btn, Crd, Modal } from './ui';
import { C } from '../lib/utils';

const withTimeout = (operation, ms = 15000) => Promise.race([operation, new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), ms))]);

export default function PatientPrivacy({ patient, setPatients, onPatientDeleted, client = supabase }) {
  const [action, setAction] = useState(null);
  const [includeInvoices, setIncludeInvoices] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const identity = async () => {
    const result = await withTimeout(client.auth.getSession());
    const session = result.data?.session;
    if (!session?.user?.id || !session.user.app_metadata?.studio_id) throw new Error('session');
    return { userId: session.user.id, studioId: session.user.app_metadata.studio_id };
  };
  const exportData = async () => {
    setLoading(true); setError('');
    try {
      const { userId, studioId } = await identity();
      const result = await withTimeout(client.rpc('gdpr_esporta_paziente', { p_paziente_id: patient.id, p_studio_id: studioId, p_eseguita_da: userId }));
      if (result.error || !result.data?.ok) throw result.error || new Error('export');
      const url = URL.createObjectURL(new Blob([JSON.stringify(result.data.dati, null, 2)], { type: 'application/json' }));
      const anchor = document.createElement('a'); anchor.href = url; anchor.download = `dati_${patient.cognome}_${patient.nome}.json`.toLowerCase().replace(/\s+/g, '_'); anchor.click();
      setTimeout(() => URL.revokeObjectURL(url), 5000); setAction(null);
    } catch { setError('Export non riuscito. Verifica autorizzazioni e riprova.'); } finally { setLoading(false); }
  };
  const deleteData = async () => {
    setLoading(true); setError('');
    try {
      const { userId, studioId } = await identity();
      const result = await withTimeout(client.rpc('gdpr_cancella_paziente', { p_paziente_id: patient.id, p_studio_id: studioId, p_eseguita_da: userId, p_cancella_anche_fatture: includeInvoices }));
      if (result.error || !result.data?.ok) throw result.error || new Error('delete');
      setPatients?.((current) => current.filter((item) => item.id !== patient.id));
      onPatientDeleted?.();
    } catch { setError('Cancellazione non riuscita. Verifica autorizzazioni e riprova.'); } finally { setLoading(false); }
  };
  return <div>
    <Crd style={{ marginBottom: 12 }}><strong>Esporta dati paziente</strong><div style={{ margin: '6px 0 10px', fontSize: 12, color: C.txm }}>Scarica il pacchetto JSON prodotto dalla RPC GDPR autenticata.</div><Btn ch="Esporta dati" v="sec" onClick={() => { setError(''); setAction('export'); }} /></Crd>
    <Crd style={{ borderColor: C.dan }}><strong style={{ color: C.dan }}>Cancellazione GDPR</strong><div style={{ margin: '6px 0 10px', fontSize: 12, color: C.txm }}>Operazione irreversibile, disponibile solo agli amministratori autorizzati.</div><Btn ch="Avvia cancellazione" v="dan" onClick={() => { setError(''); setAction('delete'); }} /></Crd>
    {action && <Modal title={action === 'export' ? 'Conferma export GDPR' : 'Conferma cancellazione GDPR'} onClose={() => !loading && setAction(null)}>
      <div style={{ fontSize: 13, color: C.txm, marginBottom: 12 }}>{action === 'export' ? `Esportare tutti i dati disponibili di ${patient.nome} ${patient.cognome}?` : `Cancellare definitivamente i dati di ${patient.nome} ${patient.cognome}?`}</div>
      {action === 'delete' && <label style={{ display: 'flex', gap: 8, marginBottom: 12 }}><input type="checkbox" checked={includeInvoices} onChange={(event) => setIncludeInvoices(event.target.checked)} /> Cancella anche le fatture, ove consentito</label>}
      {error && <div role="alert" style={{ color: C.dan, marginBottom: 10 }}>{error}</div>}
      <div style={{ display: 'flex', gap: 8 }}><Btn ch="Annulla" v="sec" dis={loading} onClick={() => setAction(null)} full /><Btn ch={loading ? 'Operazione in corso…' : action === 'export' ? 'Conferma export' : 'Conferma cancellazione'} v={action === 'delete' ? 'dan' : 'pri'} dis={loading} onClick={action === 'export' ? exportData : deleteData} full /></div>
    </Modal>}
  </div>;
}
