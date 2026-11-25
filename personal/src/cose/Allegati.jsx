// APP-AUTO-CASA-SALUTE (PO 2026-11-25: "aggiungere anche inserimenti Scan o file di assicurazione e del libretto"):
// i documenti di una scheda. Si sceglie cos'è (Assicurazione, Libretto…), poi Scan (pagine raddrizzate, in Personal),
// Fotografa o Allega un file: il documento va nell'archivio (Drive) e resta collegato alla scheda. Si collegano anche
// documenti già archiviati trovati per targa, polizza, telaio, POD. Si scollegano, non si cancellano.
import { useEffect, useRef, useState } from 'react';
import { archivioDb } from '../lib/supabasePersonal.js';
import { caricaDocumento } from '../lib/archivio.js';
import { preparaFile } from '../lib/file.js';
import { allegatiDi, collega, dataBreve, FASCICOLO_ALLEGATI, suggeriti, TIPI_ALLEGATO, tipoAllegato } from '../lib/mieCose.js';
import { tokenSessione } from '../ui.jsx';

const dataDoc = (d) => { const x = String(d.data_documento || d.email_data || d.creato_il || '').slice(0, 10); return x ? dataBreve(x) : ''; };

export function Allegati({ s, a, ctx, aParte, modifica }) {
  const tipi = TIPI_ALLEGATO[a.id] || ['Altro'];
  const [tipo, setTipo] = useState(tipi[0]);
  const [docs, setDocs] = useState(null), [proposti, setProposti] = useState([]), [invio, setInvio] = useState('');
  const [giro, setGiro] = useState(0);
  const file = useRef(null), foto = useRef(null);
  const chiavi = (s.campi || []).filter((c) => /targa|polizza|telaio|pod|pdr/i.test(c.etichetta)).map((c) => c.valore).join('|');

  useEffect(() => {
    let vivo = true;
    allegatiDi(archivioDb, s.id).then(async (d) => {
      if (!vivo) return; setDocs(d);
      const p = await suggeriti(archivioDb, s, d).catch(() => []); if (vivo) setProposti(p);
    }).catch(() => { if (vivo) setDocs([]); });
    return () => { vivo = false; };
  }, [s.id, chiavi, giro, ctx.versione]); // eslint-disable-line react-hooks/exhaustive-deps

  const apri = (d) => (ctx.apri && !aParte ? ctx.apri({ tipo: 'documento', id: d.id }) : d.drive_url && window.open(d.drive_url, '_blank', 'noopener'));
  const carica = async (f) => {
    if (!f) return;
    setInvio('Salvo su Drive…');
    try {
      const pronto = await preparaFile(f);
      const r = await caricaDocumento({ token: await tokenSessione(), ...pronto, descrizione: `${tipo} ${s.nome}`, fascicolo: FASCICOLO_ALLEGATI[a.id], nonAnalizzare: false });
      await collega(archivioDb, { id: r.id }, s.id, tipo);
      ctx.mostra?.(r.duplicato ? 'Era già in archivio: collegato alla scheda' : `${tipo} salvato e collegato`);
      setGiro((n) => n + 1);
    } catch (e) { ctx.mostra?.(e.message || 'Caricamento non riuscito'); }
    finally { setInvio(''); }
  };
  const lega = (d, dentro, t = tipo) => ctx.esegui(async () => { await collega(archivioDb, d, s.id, t, dentro); ctx.mostra?.(dentro ? 'Collegato alla scheda' : 'Scollegato (resta nell’archivio)'); setGiro((n) => n + 1); });
  const scan = () => ctx.apri({ tipo: 'scansione', opzioni: { descrizione: `${tipo} ${s.nome}`, fascicolo: FASCICOLO_ALLEGATI[a.id], cosa: { id: s.id, tipo }, fotocamera: true } });

  return <section className="pp-md-gruppo pp-ac-allegati" aria-label="Documenti">
    <h4>Documenti{docs?.length ? <span> · {docs.length}</span> : null}</h4>
    {docs === null ? <p className="pp-md-mancano">Carico…</p> : docs.map((d) => <div key={d.id} className="pp-ac-doc">
      <button type="button" className="pp-ac-doc-apri" onClick={() => apri(d)}>
        <span className={`pp-ac-doc-icona${/pdf/.test(d.mime_type || '') ? ' pdf' : ''}`} aria-hidden="true">{/pdf/.test(d.mime_type || '') ? 'PDF' : /image/.test(d.mime_type || '') ? 'IMG' : 'DOC'}</span>
        <span className="pp-ac-doc-testo"><strong>{d.titolo || 'Documento'}</strong><span>{[tipoAllegato(d, a.id), dataDoc(d)].filter(Boolean).join(' · ')}</span></span>
      </button>
      {modifica && <button type="button" className="pp-md-x" aria-label={`Scollega ${d.titolo}`} onClick={() => lega(d, false)}>Scollega</button>}
    </div>)}
    {docs?.length === 0 && <p className="pp-md-mancano">Nessun documento: aggiungi {a.id === 'auto' ? 'polizza e libretto' : a.id === 'casa' ? 'atto, visura o bollette' : 'referti e tessera'}.</p>}

    <div className="pp-ac-tipi" role="radiogroup" aria-label="Che documento è">
      {tipi.map((t) => <button key={t} type="button" role="radio" aria-checked={t === tipo} className={t === tipo ? 'scelto' : ''} onClick={() => setTipo(t)}>{t}</button>)}
    </div>
    <div className="pp-ac-carica">
      {ctx.apri && !aParte && <button type="button" className="pp-bottone" disabled={Boolean(invio)} onClick={scan}>Scan</button>}
      <button type="button" className={`pp-bottone${ctx.apri && !aParte ? ' pp-bottone-chiaro' : ''}`} disabled={Boolean(invio)} onClick={() => foto.current?.click()}>Fotografa</button>
      <button type="button" className="pp-bottone pp-bottone-chiaro" disabled={Boolean(invio)} onClick={() => file.current?.click()}>Allega file</button>
      <input ref={foto} type="file" accept="image/*" capture="environment" hidden aria-label="Fotografa il documento" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; carica(f); }} />
      <input ref={file} type="file" accept="application/pdf,image/*,.doc,.docx,.heic,.heif" hidden aria-label="Allega un file" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; carica(f); }} />
    </div>
    {invio && <p className="pp-md-mancano" role="status">{invio}</p>}

    {proposti.length > 0 && <div className="pp-ac-proposti">
      <span className="pp-ac-proposti-titolo">Già in archivio: collega come «{tipo}»</span>
      {proposti.map((d) => <div key={d.id} className="pp-ac-doc">
        <button type="button" className="pp-ac-doc-apri" onClick={() => apri(d)}>
          <span className="pp-ac-doc-testo"><strong>{d.titolo || 'Documento'}</strong><span>{dataDoc(d)}</span></span>
        </button>
        <button type="button" className="pp-md-copia" onClick={() => lega(d, true)}>Collega</button>
      </div>)}
    </div>}
  </section>;
}
