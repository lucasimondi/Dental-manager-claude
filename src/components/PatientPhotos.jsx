import React, { useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase.js';
import { Btn, Crd } from './ui';
import { C } from '../lib/utils';

const withTimeout = (operation, ms = 12000) => Promise.race([
  operation,
  new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), ms)),
]);

export default function PatientPhotos({ patientId, client = supabase }) {
  const inputRef = useRef(null);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true); setError('');
      try {
        const listed = await withTimeout(client.storage.from('patient-files').list(`${patientId}/`, { sortBy: { column: 'created_at', order: 'desc' } }));
        if (listed.error) throw listed.error;
        const next = [];
        for (const file of (listed.data || []).filter((entry) => entry.name !== '.emptyFolderPlaceholder')) {
          const signed = await withTimeout(client.storage.from('patient-files').createSignedUrl(`${patientId}/${file.name}`, 300));
          if (!signed.error && signed.data?.signedUrl) next.push({ name: file.name, url: signed.data.signedUrl, label: file.name.split('_LABEL_')[1]?.replace(/\.[^.]+$/, '') || file.name });
        }
        if (active) setItems(next);
      } catch {
        if (active) { setItems([]); setError('Impossibile caricare i file protetti. Riprova.'); }
      } finally {
        if (active) setLoading(false);
      }
    };
    load();
    return () => { active = false; };
  }, [client, patientId, reload]);

  const upload = async (files) => {
    setLoading(true); setError('');
    try {
      for (const file of files) {
        const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
        const result = await withTimeout(client.storage.from('patient-files').upload(`${patientId}/${Date.now()}_LABEL_${safeName}`, file, { upsert: false }));
        if (result.error) throw result.error;
      }
      setReload((value) => value + 1);
    } catch { setError('Caricamento non riuscito. Riprova.'); setLoading(false); }
  };

  const remove = async (name) => {
    if (!window.confirm('Eliminare questo file?')) return;
    try {
      const result = await withTimeout(client.storage.from('patient-files').remove([`${patientId}/${name}`]));
      if (result.error) throw result.error;
      setReload((value) => value + 1);
    } catch { setError('Eliminazione non riuscita. Riprova.'); }
  };

  return <div>
    <input ref={inputRef} type="file" accept="image/*,.pdf" multiple hidden onChange={(event) => { upload(Array.from(event.target.files || [])); event.target.value = ''; }} />
    <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}><Btn ch="Carica foto o PDF" onClick={() => inputRef.current?.click()} /></div>
    {loading && <div role="status" style={{ padding: 20, textAlign: 'center', color: C.txm }}>Caricamento foto…</div>}
    {!loading && error && <div role="alert" style={{ padding: 12, color: C.dan }}>{error}</div>}
    {!loading && !error && items.length === 0 && <Crd><div style={{ color: C.txm, textAlign: 'center' }}>Nessuna foto o documento caricato.</div></Crd>}
    {!loading && items.length > 0 && <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(130px,1fr))', gap: 10 }}>
      {items.map((item) => <Crd key={item.name} style={{ padding: 8, overflow: 'hidden' }}>
        <a href={item.url} target="_blank" rel="noreferrer" style={{ color: C.txt, textDecoration: 'none' }}>
          {/\.(jpg|jpeg|png|gif|webp)$/i.test(item.name) ? <img src={item.url} alt={item.label} loading="lazy" style={{ width: '100%', height: 110, objectFit: 'cover', borderRadius: 7 }} /> : <div style={{ height: 110, display: 'grid', placeItems: 'center', background: C.bg, borderRadius: 7, fontWeight: 800, color: C.dan }}>PDF</div>}
          <div style={{ marginTop: 6, fontSize: 11, overflowWrap: 'anywhere' }}>{item.label}</div>
        </a>
        <button onClick={() => remove(item.name)} style={{ marginTop: 7, width: '100%', border: 0, borderRadius: 7, padding: 6, background: C.danL, color: C.dan, cursor: 'pointer' }}>Elimina</button>
      </Crd>)}
    </div>}
  </div>;
}
