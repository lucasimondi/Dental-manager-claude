import { useEffect, useState } from 'react';
import { GestorePdf } from './GestorePdf.jsx';
import { preparaFile, comeFile } from '../lib/condividi.js';
import { tokenSessione } from '../ui.jsx';
export function PaginaPdf({ file, files, doc, ctx, chiudi, onInfo, sostituisci, strumento, onSave }) {
  const [loaded, setLoaded] = useState(file), [error, setError] = useState('');
  useEffect(() => {
    if (!doc) return undefined;
    let active = true;
    (async () => { try { const f = comeFile(await preparaFile(doc.drive_file_id, await tokenSessione())); if (active) setLoaded(f); } catch(e) { if(active) setError(e.message); } })();
    return () => { active = false; };
  }, [doc?.drive_file_id]);
  if (doc && !loaded) return <div role="status"><p>{error || 'Apro il PDF…'}</p><button onClick={chiudi}>Chiudi</button>{error && doc.drive_url && <a href={doc.drive_url} target="_blank" rel="noreferrer">Apri originale</a>}</div>;
  return <GestorePdf onEsporta={ctx?.ricorda ? (f) => ctx.ricorda([f]) : undefined} strumento={strumento} file={loaded} files={files} title={doc?.titolo} onClose={chiudi} onSave={onSave ? f => { onSave(f); chiudi(); } : undefined} onInfo={onInfo} onArchive={f => {
    const next = { tipo: 'carica', file: f, opzioni: { soloArchiviazione: true, nonAnalizzare: true, destinazione: true, descrizione: f.name.replace(/\.pdf$/i, ''), fascicolo: doc?.fascicolo || '' } };
    if (sostituisci) sostituisci(next); else { onInfo?.(); ctx.apri(next); }
  }} />;
}
