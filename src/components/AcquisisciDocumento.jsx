import React, { useMemo, useRef, useState } from 'react';
import { Modal, Fld, Inp, Btn } from './ui';
import { cercaPazienti } from '../lib/ricercaPazienti';
import { acquisisciDocumento, titoloDaFile, validaFile, ACCETTA_FILE } from '../lib/documentiStudio.js';
import TipoETag, { ricordaTipoETag } from '../../shared/documenti/TipoETag.jsx';
import { archiviaInPersonale, sessioneArchivioPersonale } from '../lib/archiviaPersonale.js';

// DOCUMENTI-STUDIO (PO 2026-11-08): acquisire un documento anche in Studio, con la fotocamera
// o da file, e legarlo se serve a un paziente. Il file resta nel bucket privato dello studio.
export default function AcquisisciDocumento({ db, studioId, patients = [], onClose, onSaved, conDestinazione = false }) {
  const [file, setFile] = useState(null);
  // ACQUISISCI-UNICO (PO 2026-11-10): dal tasto unico si sceglie dove archiviare: Studio (paziente) o Personale.
  const [dove, setDove] = useState('studio');
  const [personaleCollegato, setPersonaleCollegato] = useState(null);
  const scegliDove = (d) => { setDove(d); setErrore(''); if (d === 'personale' && personaleCollegato == null) sessioneArchivioPersonale().then((s) => setPersonaleCollegato(!!s)); };
  const [titolo, setTitolo] = useState('');
  const [tipo, setTipo] = useState('documento');
  const [tag, setTag] = useState([]);
  const [cerca, setCerca] = useState('');
  const [paziente, setPaziente] = useState(null);
  const [errore, setErrore] = useState('');
  const [salvando, setSalvando] = useState(false);
  const foto = useRef(null), scegli = useRef(null), galleria = useRef(null);
  const trovati = useMemo(() => (cerca.trim().length > 1 && !paziente ? cercaPazienti(patients, cerca).slice(0, 5) : []), [cerca, patients, paziente]);
  const prendi = (f) => {
    setErrore('');
    if (!f) return;
    try { validaFile(f); setFile(f); setTitolo((t) => t || titoloDaFile(f.name)); } catch (e) { setErrore(e.message); }
  };
  const salva = async () => {
    setSalvando(true); setErrore('');
    try {
      if (dove === 'personale') { const r = await archiviaInPersonale(file, titolo, tag, tipo); ricordaTipoETag(tipo, tag); onSaved?.({ personale: true, ...r }); onClose(); return; }
      const doc = await acquisisciDocumento(db, { studioId, file, titolo, tipo, tag, pazienteId: paziente?.id }); ricordaTipoETag(tipo, tag); onSaved?.(doc); onClose();
    }
    catch (e) { setErrore(e.message); } finally { setSalvando(false); }
  };
  return <Modal title="Acquisisci documento" icon="file" onClose={onClose}>
    <div className="acquisisci-doc">
      <input ref={foto} type="file" accept="image/*" capture="environment" hidden onChange={(e) => prendi(e.target.files?.[0])} />
      <input ref={galleria} type="file" accept="image/*,.heic,.heif" hidden onChange={(e) => prendi(e.target.files?.[0])} />
      <input ref={scegli} type="file" accept={ACCETTA_FILE} hidden onChange={(e) => prendi(e.target.files?.[0])} />
      <div className="acquisisci-sorgenti acquisisci-sorgenti-tre">
        <button type="button" onClick={() => foto.current?.click()}>Scatta</button>
        <button type="button" onClick={() => galleria.current?.click()}>Foto</button>
        <button type="button" onClick={() => scegli.current?.click()}>PDF, Word, Excel…</button>
      </div>
      {conDestinazione && <Fld label="Dove archiviare">
        <div className="appointment-type-tags acquisisci-dove" role="radiogroup" aria-label="Dove archiviare">
          {[['studio', 'Studio · paziente'], ['personale', 'Personale']].map(([id, nome]) => <button key={id} type="button" role="radio" aria-checked={dove === id} className={`appointment-label${dove === id ? ' attiva' : ''}`} style={{ '--c': 'var(--brand-primary, #0B7A5C)', '--c-on': '#fff' }} onClick={() => scegliDove(id)}>{nome}</button>)}
        </div>
      </Fld>}
      {file && <p className="acquisisci-file" aria-live="polite">{file.name} · {(file.size / 1024 / 1024).toFixed(1)} MB</p>}
      <Fld label="Titolo"><Inp aria-label="Titolo del documento" value={titolo} maxLength={200} onChange={(e) => setTitolo(e.target.value)} placeholder="Es. Referto panoramica" /></Fld>
      {dove === 'personale' ? <p className="acquisisci-nota">{personaleCollegato === false ? 'Archivio personale non collegato: apri Personal una volta su questo telefono.' : 'Va nel tuo archivio personale (Drive, «Archivio personale/Caricati»): lo trovi in Documenti → Personali sotto il tipo scelto.'}</p> : null}
      {dove === 'personale' ? <TipoETag tipo={tipo} onTipo={setTipo} tag={tag} onTag={setTag} /> : <>
      <TipoETag tipo={tipo} onTipo={setTipo} tag={tag} onTag={setTag} />
      <Fld label="Paziente (facoltativo)">
        {paziente
          ? <div className="acquisisci-paziente"><b>{paziente.nome} {paziente.cognome}</b><button type="button" onClick={() => { setPaziente(null); setCerca(''); }}>Cambia</button></div>
          : <><Inp aria-label="Cerca paziente" value={cerca} onChange={(e) => setCerca(e.target.value)} placeholder="Cerca per nome o cognome…" />
            {trovati.map((p) => <button key={p.id} type="button" className="acquisisci-trovato" onClick={() => setPaziente(p)}>{p.nome} {p.cognome}</button>)}</>}
      </Fld>
      </>}
      {errore && <p className="acquisisci-errore" role="alert">{errore}</p>}
      <div className="acquisisci-azioni"><Btn v="sec" ch="Annulla" onClick={onClose} /><Btn ch={salvando ? 'Salvataggio…' : dove === 'personale' ? 'Archivia nel personale' : 'Salva documento'} onClick={salva} dis={!file || salvando || (dove === 'personale' && personaleCollegato === false)} /></div>
    </div>
  </Modal>;
}
