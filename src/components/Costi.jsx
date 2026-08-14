import React, { useState, useEffect, useRef } from 'react';
import { Btn, Crd, Fld, Inp, Sel, Modal, Toast, Ic } from './ui';
import { C, fmt, fmtD, today } from '../lib/utils';
import { supabase } from '../lib/supabase.js';
import Spese from './Spese.jsx';

const CATEGORIE = ['Materiali', 'Attrezzature', 'Affitto', 'Personale', 'Utenze', 'Assicurazioni', 'Software', 'Formazione', 'Tasse', 'Altro'];
const FREQUENZE = ['Mensile', 'Bimestrale', 'Trimestrale', 'Semestrale', 'Annuale'];

const SUPABASE_URL = 'https://idklxdqebfceplrualgh.supabase.co';

async function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// ─────────────────────────────────────────────────────────────────
// Upload + lettura automatica documento (bolletta/fattura/busta paga/fattura macchinario)
// ─────────────────────────────────────────────────────────────────
function UploadDocumento({ onEstratto }) {
  const [loading, setLoading] = useState(false);
  const [errore, setErrore] = useState('');
  const inputRef = useRef(null);

  const handleFile = async (file) => {
    if (!file) return;
    setErrore('');
    setLoading(true);
    try {
      const base64 = await fileToBase64(file);
      const { data: { session } } = await supabase.auth.getSession();
      const resp = await fetch(`${SUPABASE_URL}/functions/v1/estrai-spesa-documento`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({ file_base64: base64, media_type: file.type }),
      });
      const data = await resp.json();
      if (!resp.ok || data.error) {
        setErrore(data.error || 'Non sono riuscito a leggere il documento — puoi comunque inserirlo a mano.');
        setLoading(false);
        return;
      }
      onEstratto(data.estratto, file);
    } catch (e) {
      setErrore('Errore di caricamento: ' + String(e));
    }
    setLoading(false);
  };

  return (
    <Crd style={{ marginBottom: 14, textAlign: 'center', padding: 18, border: `1.5px dashed ${C.brd}` }}>
      <input ref={inputRef} type="file" accept="image/*,.pdf" capture="environment" style={{ display: 'none' }}
        onChange={(e) => { handleFile(e.target.files[0]); e.target.value = ''; }} />
      {loading ? (
        <div style={{ color: C.txl, fontSize: 13 }}>⏳ Sto leggendo il documento...</div>
      ) : (
        <>
          <div style={{ fontSize: 28, marginBottom: 6 }}>📄</div>
          <div style={{ fontWeight: 700, fontSize: 13, color: C.txt, marginBottom: 3 }}>Carica bolletta, fattura o busta paga</div>
          <div style={{ fontSize: 11, color: C.txl, marginBottom: 10 }}>Foto o PDF — i dati vengono letti automaticamente</div>
          <Btn ch="Scatta foto o scegli file" ic="send" onClick={() => inputRef.current?.click()} />
        </>
      )}
      {errore && <div style={{ color: C.dan, fontSize: 11, marginTop: 8 }}>{errore}</div>}
    </Crd>
  );
}

// ─────────────────────────────────────────────────────────────────
// Costo orario dello studio
// ─────────────────────────────────────────────────────────────────
function CostoOrarioCard({ studioId, refreshKey }) {
  const [dati, setDati] = useState(null);
  const [editConfig, setEditConfig] = useState(false);
  const [config, setConfig] = useState({ giorni_settimana: 5, ore_al_giorno: 8, num_postazioni: 1 });
  const [saving, setSaving] = useState(false);

  const load = async () => {
    const { data, error } = await supabase.rpc('get_costo_orario', { p_studio_id: studioId });
    if (!error && data) {
      setDati(data);
      setConfig(data.config_orario);
    }
  };

  useEffect(() => { if (studioId) load(); }, [studioId, refreshKey]);

  const salvaConfig = async () => {
    setSaving(true);
    await supabase.from('studio_info').update({ config_orario: config }).eq('studio_id', studioId);
    setSaving(false);
    setEditConfig(false);
    load();
  };

  if (!dati) return null;

  return (
    <Crd style={{ marginBottom: 14, background: `linear-gradient(135deg, ${C.pri}, ${C.priD || C.pri})`, border: 'none' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.75)', textTransform: 'uppercase' }}>Costo orario dello studio</div>
          <div style={{ fontSize: 30, fontWeight: 900, color: '#fff', marginTop: 2 }}>{fmt(dati.costo_orario)}<span style={{ fontSize: 14, fontWeight: 700 }}>/ora</span></div>
        </div>
        <button onClick={() => setEditConfig(true)} style={{ background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: 8, padding: '6px 10px', color: '#fff', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>⚙️ Ore</button>
      </div>
      <div style={{ display: 'flex', gap: 14, marginTop: 12, fontSize: 11, color: 'rgba(255,255,255,0.85)' }}>
        <div>Costi struttura: <b>{fmt(dati.costi_fissi_spese_mensili)}</b>/mese</div>
        <div>Personale: <b>{fmt(dati.costi_personale_mensili)}</b>/mese</div>
        <div>Macchinari: <b>{fmt(dati.costi_macchinari_mensili)}</b>/mese</div>
      </div>
      <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.65)', marginTop: 4 }}>
        Totale {fmt(dati.totale_mensile)}/mese ÷ {dati.ore_lavorabili_mensili} ore lavorabili/mese
      </div>

      {editConfig && (
        <Modal title="Ore lavorabili dello studio" onClose={() => setEditConfig(false)}>
          <div style={{ fontSize: 11, color: C.txl, marginBottom: 12 }}>
            Usate per calcolare il costo orario: giorni di apertura a settimana × ore al giorno × numero di poltrone/riuniti in uso contemporaneo.
          </div>
          <Fld label="Giorni di apertura a settimana">
            <Inp type="number" min="1" max="7" value={config.giorni_settimana} onChange={(e) => setConfig((c) => ({ ...c, giorni_settimana: Number(e.target.value) }))} />
          </Fld>
          <Fld label="Ore di apertura al giorno">
            <Inp type="number" min="1" value={config.ore_al_giorno} onChange={(e) => setConfig((c) => ({ ...c, ore_al_giorno: Number(e.target.value) }))} />
          </Fld>
          <Fld label="Numero poltrone/riuniti">
            <Inp type="number" min="1" value={config.num_postazioni} onChange={(e) => setConfig((c) => ({ ...c, num_postazioni: Number(e.target.value) }))} />
          </Fld>
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <Btn ch="Annulla" v="sec" onClick={() => setEditConfig(false)} full />
            <Btn ch={saving ? 'Salvataggio...' : 'Salva'} onClick={salvaConfig} dis={saving} full />
          </div>
        </Modal>
      )}
    </Crd>
  );
}

// ─────────────────────────────────────────────────────────────────
// Conferma dopo lettura AI: instrada verso Spese / Personale / Macchinari
// ─────────────────────────────────────────────────────────────────
function ConfermaEstrazione({ estratto, file, onClose, onSalvato, studioId }) {
  const suggerito = estratto.tipo_documento === 'busta_paga' ? 'personale'
    : estratto.tipo_documento === 'fattura_macchinario' ? 'macchinario'
    : 'spesa';
  const [destinazione, setDestinazione] = useState(suggerito);
  const [saving, setSaving] = useState(false);

  const [formSpesa, setFormSpesa] = useState({
    titolo: estratto.titolo || '', importo: estratto.importo || '', data: estratto.data || today(),
    categoria: estratto.categoria || 'Altro', tipo_costo: estratto.tipo_costo || 'variabile', ricorrente: !!estratto.ricorrente, frequenza: 'Mensile',
  });
  const [formPersonale, setFormPersonale] = useState({
    nome: '', ruolo: '', tipo_contratto: 'dipendente', costo_mensile: estratto.importo || '',
  });
  const [formMacchinario, setFormMacchinario] = useState({
    nome: estratto.titolo || estratto.fornitore || '', costo_acquisto: estratto.importo || '', data_acquisto: estratto.data || today(), anni_ammortamento: 5,
  });

  const uploadDocumento = async (prefix) => {
    if (!file) return null;
    const path = `${studioId}/${prefix}-${Date.now()}-${file.name}`;
    const { error } = await supabase.storage.from('spese-documenti').upload(path, file);
    return error ? null : path;
  };

  const salva = async () => {
    setSaving(true);
    if (destinazione === 'spesa') {
      const documento_path = await uploadDocumento('spesa');
      const { error } = await supabase.from('spese').insert([{
        id: Date.now(), titolo: formSpesa.titolo, importo: Number(formSpesa.importo), data: formSpesa.data,
        categoria: formSpesa.categoria, tipo_costo: formSpesa.tipo_costo, ricorrente: formSpesa.ricorrente,
        frequenza: formSpesa.frequenza, documento_path,
      }]);
      if (error) { alert('Errore: ' + error.message); setSaving(false); return; }
    } else if (destinazione === 'personale') {
      if (!formPersonale.nome) { alert('Inserisci il nome della persona'); setSaving(false); return; }
      const documento_path = await uploadDocumento('personale');
      const { error } = await supabase.from('personale').insert([{
        studio_id: studioId, nome: formPersonale.nome, ruolo: formPersonale.ruolo,
        tipo_contratto: formPersonale.tipo_contratto, costo_mensile: Number(formPersonale.costo_mensile), documento_path,
      }]);
      if (error) { alert('Errore: ' + error.message); setSaving(false); return; }
    } else {
      const documento_path = await uploadDocumento('macchinario');
      const { error } = await supabase.from('macchinari').insert([{
        studio_id: studioId, nome: formMacchinario.nome, costo_acquisto: Number(formMacchinario.costo_acquisto),
        data_acquisto: formMacchinario.data_acquisto, anni_ammortamento: Number(formMacchinario.anni_ammortamento), documento_path,
      }]);
      if (error) { alert('Errore: ' + error.message); setSaving(false); return; }
    }
    setSaving(false);
    onSalvato();
  };

  return (
    <Modal title="Documento letto — conferma" onClose={onClose}>
      <div style={{ background: C.priL, borderRadius: 10, padding: 10, marginBottom: 12, fontSize: 11, color: C.pri }}>
        Ho riconosciuto: <b>{estratto.tipo_documento?.replace('_', ' ')}</b>
        {estratto.fornitore ? ` da ${estratto.fornitore}` : ''} — confidenza {estratto.confidenza || 'media'}. Controlla e correggi se serve.
      </div>

      <Fld label="Dove lo salvo?">
        <div style={{ display: 'flex', gap: 6 }}>
          {[
            { id: 'spesa', label: 'Spesa' },
            { id: 'personale', label: 'Personale' },
            { id: 'macchinario', label: 'Macchinario' },
          ].map((d) => (
            <button key={d.id} onClick={() => setDestinazione(d.id)} style={{
              flex: 1, padding: '8px 0', borderRadius: 9, border: `1.5px solid ${destinazione === d.id ? C.pri : C.brd}`,
              background: destinazione === d.id ? C.priL : '#fff', color: destinazione === d.id ? C.pri : C.txm,
              fontWeight: 700, fontSize: 12, cursor: 'pointer',
            }}>{d.label}</button>
          ))}
        </div>
      </Fld>

      {destinazione === 'spesa' && (
        <>
          <Fld label="Titolo"><Inp value={formSpesa.titolo} onChange={(e) => setFormSpesa((f) => ({ ...f, titolo: e.target.value }))} /></Fld>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <Fld label="Importo €"><Inp type="number" value={formSpesa.importo} onChange={(e) => setFormSpesa((f) => ({ ...f, importo: e.target.value }))} /></Fld>
            <Fld label="Data"><Inp type="date" value={formSpesa.data} onChange={(e) => setFormSpesa((f) => ({ ...f, data: e.target.value }))} /></Fld>
          </div>
          <Fld label="Categoria">
            <Sel value={formSpesa.categoria} onChange={(e) => setFormSpesa((f) => ({ ...f, categoria: e.target.value }))}>
              {CATEGORIE.map((c) => <option key={c}>{c}</option>)}
            </Sel>
          </Fld>
          <Fld label="Tipo di costo">
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => setFormSpesa((f) => ({ ...f, tipo_costo: 'fisso' }))} style={{ flex: 1, padding: '8px 0', borderRadius: 9, border: `1.5px solid ${formSpesa.tipo_costo === 'fisso' ? C.pri : C.brd}`, background: formSpesa.tipo_costo === 'fisso' ? C.priL : '#fff', color: formSpesa.tipo_costo === 'fisso' ? C.pri : C.txm, fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>Fisso</button>
              <button onClick={() => setFormSpesa((f) => ({ ...f, tipo_costo: 'variabile' }))} style={{ flex: 1, padding: '8px 0', borderRadius: 9, border: `1.5px solid ${formSpesa.tipo_costo === 'variabile' ? C.pri : C.brd}`, background: formSpesa.tipo_costo === 'variabile' ? C.priL : '#fff', color: formSpesa.tipo_costo === 'variabile' ? C.pri : C.txm, fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>Variabile</button>
            </div>
          </Fld>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <input type="checkbox" checked={formSpesa.ricorrente} onChange={(e) => setFormSpesa((f) => ({ ...f, ricorrente: e.target.checked }))} />
            <span style={{ fontSize: 12, color: C.txt }}>Ricorrente</span>
            {formSpesa.ricorrente && (
              <Sel value={formSpesa.frequenza} onChange={(e) => setFormSpesa((f) => ({ ...f, frequenza: e.target.value }))} style={{ marginLeft: 'auto', width: 140 }}>
                {FREQUENZE.map((f) => <option key={f}>{f}</option>)}
              </Sel>
            )}
          </div>
        </>
      )}

      {destinazione === 'personale' && (
        <>
          <Fld label="Nome della persona"><Inp value={formPersonale.nome} onChange={(e) => setFormPersonale((f) => ({ ...f, nome: e.target.value }))} placeholder="Obbligatorio — il documento non lo indica sempre in modo affidabile" autoFocus /></Fld>
          <Fld label="Ruolo"><Inp value={formPersonale.ruolo} onChange={(e) => setFormPersonale((f) => ({ ...f, ruolo: e.target.value }))} placeholder="es. Assistente, Igienista..." /></Fld>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <Fld label="Tipo">
              <Sel value={formPersonale.tipo_contratto} onChange={(e) => setFormPersonale((f) => ({ ...f, tipo_contratto: e.target.value }))}>
                <option value="dipendente">Dipendente</option>
                <option value="collaboratore">Collaboratore</option>
              </Sel>
            </Fld>
            <Fld label="Costo mensile €"><Inp type="number" value={formPersonale.costo_mensile} onChange={(e) => setFormPersonale((f) => ({ ...f, costo_mensile: e.target.value }))} /></Fld>
          </div>
        </>
      )}

      {destinazione === 'macchinario' && (
        <>
          <Fld label="Nome macchinario"><Inp value={formMacchinario.nome} onChange={(e) => setFormMacchinario((f) => ({ ...f, nome: e.target.value }))} /></Fld>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <Fld label="Costo acquisto €"><Inp type="number" value={formMacchinario.costo_acquisto} onChange={(e) => setFormMacchinario((f) => ({ ...f, costo_acquisto: e.target.value }))} /></Fld>
            <Fld label="Data acquisto"><Inp type="date" value={formMacchinario.data_acquisto} onChange={(e) => setFormMacchinario((f) => ({ ...f, data_acquisto: e.target.value }))} /></Fld>
          </div>
          <Fld label="Anni di ammortamento"><Inp type="number" value={formMacchinario.anni_ammortamento} onChange={(e) => setFormMacchinario((f) => ({ ...f, anni_ammortamento: e.target.value }))} /></Fld>
        </>
      )}

      <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
        <Btn ch="Annulla" v="sec" onClick={onClose} full />
        <Btn ch={saving ? 'Salvataggio...' : 'Conferma e salva'} onClick={salva} dis={saving} full />
      </div>
    </Modal>
  );
}

// ─────────────────────────────────────────────────────────────────
// Vista Personale
// ─────────────────────────────────────────────────────────────────
function VistaPersonale({ studioId, refreshKey, onChanged }) {
  const [lista, setLista] = useState([]);
  const [modal, setModal] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [form, setForm] = useState({ nome: '', ruolo: '', tipo_contratto: 'dipendente', costo_mensile: '', ore_settimanali: '', attivo: true });

  const load = async () => {
    const { data } = await supabase.from('personale').select('*').order('created_at', { ascending: false });
    setLista(data || []);
  };
  useEffect(() => { load(); }, [refreshKey]);

  const apriNuovo = () => { setEditItem(null); setForm({ nome: '', ruolo: '', tipo_contratto: 'dipendente', costo_mensile: '', ore_settimanali: '', attivo: true }); setModal(true); };
  const apriEdit = (p) => { setEditItem(p); setForm({ nome: p.nome, ruolo: p.ruolo || '', tipo_contratto: p.tipo_contratto, costo_mensile: String(p.costo_mensile), ore_settimanali: p.ore_settimanali ? String(p.ore_settimanali) : '', attivo: p.attivo }); setModal(true); };

  const salva = async () => {
    if (!form.nome || !form.costo_mensile) return;
    const record = { studio_id: studioId, nome: form.nome, ruolo: form.ruolo, tipo_contratto: form.tipo_contratto, costo_mensile: Number(form.costo_mensile), ore_settimanali: form.ore_settimanali ? Number(form.ore_settimanali) : null, attivo: form.attivo };
    if (editItem) await supabase.from('personale').update(record).eq('id', editItem.id);
    else await supabase.from('personale').insert([record]);
    setModal(false);
    load();
    onChanged();
  };

  const elimina = async (id) => {
    if (!confirm('Rimuovere questa persona dai costi?')) return;
    await supabase.from('personale').delete().eq('id', id);
    load();
    onChanged();
  };

  const totaleMensile = lista.filter((p) => p.attivo).reduce((s, p) => s + Number(p.costo_mensile), 0);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: C.txm }}>Totale mensile: <span style={{ color: C.txt }}>{fmt(totaleMensile)}</span></div>
        <Btn ch="+ Persona" sz="sm" onClick={apriNuovo} />
      </div>
      {lista.length === 0 && <div style={{ textAlign: 'center', color: C.txl, padding: 20, fontSize: 12 }}>Nessun dipendente/collaboratore registrato</div>}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {lista.map((p) => (
          <Crd key={p.id} style={{ opacity: p.attivo ? 1 : 0.5 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 13 }}>{p.nome} {!p.attivo && <span style={{ fontSize: 10, color: C.txl }}>(non attivo)</span>}</div>
                <div style={{ fontSize: 11, color: C.txm }}>{p.ruolo || (p.tipo_contratto === 'dipendente' ? 'Dipendente' : 'Collaboratore')}</div>
              </div>
              <span style={{ fontWeight: 800, color: C.txt, fontSize: 14 }}>{fmt(p.costo_mensile)}/mese</span>
              <button onClick={() => apriEdit(p)} style={{ background: C.priL, border: 'none', borderRadius: 7, padding: '5px 8px', cursor: 'pointer' }}><Ic n="edit" s={13} c={C.pri} /></button>
              <button onClick={() => elimina(p.id)} style={{ background: C.danL, border: 'none', borderRadius: 7, padding: '5px 8px', cursor: 'pointer' }}><Ic n="del" s={13} c={C.dan} /></button>
            </div>
          </Crd>
        ))}
      </div>

      {modal && (
        <Modal title={editItem ? 'Modifica' : '+ Persona'} onClose={() => setModal(false)}>
          <Fld label="Nome"><Inp value={form.nome} onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))} autoFocus /></Fld>
          <Fld label="Ruolo"><Inp value={form.ruolo} onChange={(e) => setForm((f) => ({ ...f, ruolo: e.target.value }))} placeholder="es. Assistente, Igienista..." /></Fld>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <Fld label="Tipo">
              <Sel value={form.tipo_contratto} onChange={(e) => setForm((f) => ({ ...f, tipo_contratto: e.target.value }))}>
                <option value="dipendente">Dipendente</option>
                <option value="collaboratore">Collaboratore</option>
              </Sel>
            </Fld>
            <Fld label="Costo mensile €"><Inp type="number" value={form.costo_mensile} onChange={(e) => setForm((f) => ({ ...f, costo_mensile: e.target.value }))} /></Fld>
          </div>
          <Fld label="Ore settimanali (opzionale)"><Inp type="number" value={form.ore_settimanali} onChange={(e) => setForm((f) => ({ ...f, ore_settimanali: e.target.value }))} /></Fld>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <input type="checkbox" checked={form.attivo} onChange={(e) => setForm((f) => ({ ...f, attivo: e.target.checked }))} />
            <span style={{ fontSize: 12, color: C.txt }}>Attivo (conta nei costi correnti)</span>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <Btn ch="Annulla" v="sec" onClick={() => setModal(false)} full />
            <Btn ch={editItem ? 'Aggiorna' : 'Salva'} onClick={salva} dis={!form.nome || !form.costo_mensile} full />
          </div>
        </Modal>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// Vista Macchinari
// ─────────────────────────────────────────────────────────────────
function VistaMacchinari({ studioId, refreshKey, onChanged }) {
  const [lista, setLista] = useState([]);
  const [modal, setModal] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [form, setForm] = useState({ nome: '', costo_acquisto: '', data_acquisto: today(), anni_ammortamento: '5', attivo: true });

  const load = async () => {
    const { data } = await supabase.from('macchinari').select('*').order('created_at', { ascending: false });
    setLista(data || []);
  };
  useEffect(() => { load(); }, [refreshKey]);

  const apriNuovo = () => { setEditItem(null); setForm({ nome: '', costo_acquisto: '', data_acquisto: today(), anni_ammortamento: '5', attivo: true }); setModal(true); };
  const apriEdit = (m) => { setEditItem(m); setForm({ nome: m.nome, costo_acquisto: String(m.costo_acquisto), data_acquisto: m.data_acquisto, anni_ammortamento: String(m.anni_ammortamento), attivo: m.attivo }); setModal(true); };

  const salva = async () => {
    if (!form.nome || !form.costo_acquisto) return;
    const record = { studio_id: studioId, nome: form.nome, costo_acquisto: Number(form.costo_acquisto), data_acquisto: form.data_acquisto, anni_ammortamento: Number(form.anni_ammortamento), attivo: form.attivo };
    if (editItem) await supabase.from('macchinari').update(record).eq('id', editItem.id);
    else await supabase.from('macchinari').insert([record]);
    setModal(false);
    load();
    onChanged();
  };

  const elimina = async (id) => {
    if (!confirm('Rimuovere questo macchinario?')) return;
    await supabase.from('macchinari').delete().eq('id', id);
    load();
    onChanged();
  };

  const quotaMensile = (m) => Number(m.costo_acquisto) / (Math.max(Number(m.anni_ammortamento), 1) * 12);
  const totaleMensile = lista.filter((m) => m.attivo).reduce((s, m) => s + quotaMensile(m), 0);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: C.txm }}>Ammortamento mensile: <span style={{ color: C.txt }}>{fmt(totaleMensile)}</span></div>
        <Btn ch="+ Macchinario" sz="sm" onClick={apriNuovo} />
      </div>
      {lista.length === 0 && <div style={{ textAlign: 'center', color: C.txl, padding: 20, fontSize: 12 }}>Nessun macchinario registrato</div>}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {lista.map((m) => (
          <Crd key={m.id} style={{ opacity: m.attivo ? 1 : 0.5 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 13 }}>{m.nome}</div>
                <div style={{ fontSize: 11, color: C.txm }}>{fmt(m.costo_acquisto)} · {fmtD(m.data_acquisto)} · ammortamento {m.anni_ammortamento} anni</div>
              </div>
              <span style={{ fontWeight: 800, color: C.txt, fontSize: 13 }}>{fmt(quotaMensile(m))}/mese</span>
              <button onClick={() => apriEdit(m)} style={{ background: C.priL, border: 'none', borderRadius: 7, padding: '5px 8px', cursor: 'pointer' }}><Ic n="edit" s={13} c={C.pri} /></button>
              <button onClick={() => elimina(m.id)} style={{ background: C.danL, border: 'none', borderRadius: 7, padding: '5px 8px', cursor: 'pointer' }}><Ic n="del" s={13} c={C.dan} /></button>
            </div>
          </Crd>
        ))}
      </div>

      {modal && (
        <Modal title={editItem ? 'Modifica' : '+ Macchinario'} onClose={() => setModal(false)}>
          <Fld label="Nome"><Inp value={form.nome} onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))} placeholder="es. Riunito odontoiatrico" autoFocus /></Fld>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <Fld label="Costo acquisto €"><Inp type="number" value={form.costo_acquisto} onChange={(e) => setForm((f) => ({ ...f, costo_acquisto: e.target.value }))} /></Fld>
            <Fld label="Data acquisto"><Inp type="date" value={form.data_acquisto} onChange={(e) => setForm((f) => ({ ...f, data_acquisto: e.target.value }))} /></Fld>
          </div>
          <Fld label="Anni di ammortamento"><Inp type="number" value={form.anni_ammortamento} onChange={(e) => setForm((f) => ({ ...f, anni_ammortamento: e.target.value }))} /></Fld>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <input type="checkbox" checked={form.attivo} onChange={(e) => setForm((f) => ({ ...f, attivo: e.target.checked }))} />
            <span style={{ fontSize: 12, color: C.txt }}>In uso (conta nei costi correnti)</span>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <Btn ch="Annulla" v="sec" onClick={() => setModal(false)} full />
            <Btn ch={editItem ? 'Aggiorna' : 'Salva'} onClick={salva} dis={!form.nome || !form.costo_acquisto} full />
          </div>
        </Modal>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// Componente principale
// ─────────────────────────────────────────────────────────────────
export default function Costi({ studioId }) {
  const [sub, setSub] = useState('spese');
  const [refreshKey, setRefreshKey] = useState(0);
  const [estrattoPendente, setEstrattoPendente] = useState(null); // { estratto, file }
  const [toast, setToast] = useState('');

  const bump = () => setRefreshKey((k) => k + 1);

  const SUB_TABS = [
    { id: 'spese', label: 'Spese' },
    { id: 'personale', label: 'Personale' },
    { id: 'macchinari', label: 'Macchinari' },
  ];

  return (
    <div>
      {toast && <Toast msg={toast} onDone={() => setToast('')} />}

      <CostoOrarioCard studioId={studioId} refreshKey={refreshKey} />

      <UploadDocumento onEstratto={(estratto, file) => setEstrattoPendente({ estratto, file })} />

      <div style={{ display: 'flex', gap: 4, background: C.bg, borderRadius: 10, padding: 4, marginBottom: 12 }}>
        {SUB_TABS.map((t) => (
          <button key={t.id} onClick={() => setSub(t.id)} style={{
            flex: 1, border: 'none', borderRadius: 7, padding: '7px 8px', fontSize: 12, fontWeight: 700, cursor: 'pointer',
            background: sub === t.id ? C.sur : 'transparent', color: sub === t.id ? C.pri : C.txl,
            boxShadow: sub === t.id ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
          }}>{t.label}</button>
        ))}
      </div>

      {sub === 'spese' && <Spese refreshKey={refreshKey} />}
      {sub === 'personale' && <VistaPersonale studioId={studioId} refreshKey={refreshKey} onChanged={bump} />}
      {sub === 'macchinari' && <VistaMacchinari studioId={studioId} refreshKey={refreshKey} onChanged={bump} />}

      {estrattoPendente && (
        <ConfermaEstrazione
          estratto={estrattoPendente.estratto}
          file={estrattoPendente.file}
          studioId={studioId}
          onClose={() => setEstrattoPendente(null)}
          onSalvato={() => { setEstrattoPendente(null); bump(); setToast('Salvato ✓'); }}
        />
      )}
    </div>
  );
}
