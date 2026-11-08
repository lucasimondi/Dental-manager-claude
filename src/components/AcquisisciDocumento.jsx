import React, { useMemo, useRef, useState } from 'react';
import { Modal, Fld, Inp, Btn } from './ui';
import { cercaPazienti } from '../lib/ricercaPazienti';
import { acquisisciDocumento, TIPI_DOCUMENTO, titoloDaFile, validaFile } from '../lib/documentiStudio.js';

// DOCUMENTI-STUDIO (PO 2026-11-08): acquisire un documento anche in Studio, con la fotocamera
// o da file, e legarlo se serve a un paziente. Il file resta nel bucket privato dello studio.
export default function AcquisisciDocumento({ db, studioId, patients = [], onClose, onSaved }) {
  const [file, setFile] = useState(null);
  const [titolo, setTitolo] = useState('');
  const [tipo, setTipo] = useState('documento');
  const [cerca, setCerca] = useState('');
  const [paziente, setPaziente] = useState(null);
  const [errore, setErrore] = useState('');
  const [salvando, setSalvando] = useState(false);
  const foto = useRef(null), scegli = useRef(null);
  const trovati = useMemo(() => (cerca.trim().length > 1 && !paziente ? cercaPazienti(patients, cerca).slice(0, 5) : []), [cerca, patients, paziente]);
  const prendi = (f) => {
    setErrore('');
    if (!f) return;
    try { validaFile(f); setFile(f); setTitolo((t) => t || titoloDaFile(f.name)); } catch (e) { setErrore(e.message); }
  };
  const salva = async () => {
    setSalvando(true); setErrore('');
    try { const doc = await acquisisciDocumento(db, { studioId, file, titolo, tipo, pazienteId: paziente?.id }); onSaved?.(doc); onClose(); }
    catch (e) { setErrore(e.message); } finally { setSalvando(false); }
  };
  return <Modal title="Acquisisci documento" icon="file" onClose={onClose}>
    <div className="acquisisci-doc">
      <input ref={foto} type="file" accept="image/*" capture="environment" hidden onChange={(e) => prendi(e.target.files?.[0])} />
      <input ref={scegli} type="file" accept="image/*,application/pdf" hidden onChange={(e) => prendi(e.target.files?.[0])} />
      <div className="acquisisci-sorgenti">
        <button type="button" onClick={() => foto.current?.click()}>Scatta una foto</button>
        <button type="button" onClick={() => scegli.current?.click()}>Scegli file o PDF</button>
      </div>
      {file && <p className="acquisisci-file" aria-live="polite">{file.name} · {(file.size / 1024 / 1024).toFixed(1)} MB</p>}
      <Fld label="Titolo"><Inp aria-label="Titolo del documento" value={titolo} maxLength={200} onChange={(e) => setTitolo(e.target.value)} placeholder="Es. Referto panoramica" /></Fld>
      <Fld label="Tipo">
        <div className="appointment-type-tags" role="radiogroup" aria-label="Tipo di documento">
          {TIPI_DOCUMENTO.map((t) => <button key={t.id} type="button" role="radio" aria-checked={tipo === t.id} className={`appointment-label${tipo === t.id ? ' attiva' : ''}`} style={{ '--c': 'var(--brand-primary, #0B7A5C)', '--c-on': '#fff' }} onClick={() => setTipo(t.id)}>{t.nome}</button>)}
        </div>
      </Fld>
      <Fld label="Paziente (facoltativo)">
        {paziente
          ? <div className="acquisisci-paziente"><b>{paziente.nome} {paziente.cognome}</b><button type="button" onClick={() => { setPaziente(null); setCerca(''); }}>Cambia</button></div>
          : <><Inp aria-label="Cerca paziente" value={cerca} onChange={(e) => setCerca(e.target.value)} placeholder="Cerca per nome o cognome…" />
            {trovati.map((p) => <button key={p.id} type="button" className="acquisisci-trovato" onClick={() => setPaziente(p)}>{p.nome} {p.cognome}</button>)}</>}
      </Fld>
      {errore && <p className="acquisisci-errore" role="alert">{errore}</p>}
      <div className="acquisisci-azioni"><Btn v="sec" ch="Annulla" onClick={onClose} /><Btn ch={salvando ? 'Salvataggio…' : 'Salva documento'} onClick={salva} dis={!file || salvando} /></div>
    </div>
  </Modal>;
}
