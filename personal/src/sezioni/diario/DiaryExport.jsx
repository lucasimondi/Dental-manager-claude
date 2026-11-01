import { useEffect, useRef, useState } from 'react';
import { exportPageIndexes } from '../../lib/diarioExport.js';

export function DiaryExport({ pages, current, onClose, onBusy }) {
  const [scope, setScope] = useState('current'), [format, setFormat] = useState('pdf'), [selected, setSelected] = useState([current]), [cover, setCover] = useState(false);
  const [busy, setBusy] = useState(false), [progress, setProgress] = useState(''), [error, setError] = useState(''), [ready, setReady] = useState(null);
  const cancel = useRef(false), alive = useRef(true), first = useRef(null), file = useRef(null);
  useEffect(() => { alive.current = true; first.current?.focus({ preventScroll: true }); return () => { alive.current = false; cancel.current = true; }; }, []);
  useEffect(() => () => { if (ready?.url) { const url = ready.url; setTimeout(() => URL.revokeObjectURL(url), 30000); } }, [ready]);
  useEffect(() => { setReady(null); setError(''); }, [scope, format, selected, cover, current, pages]);
  function close() { cancel.current = true; onBusy(false); onClose(); }
  async function prepare() {
    cancel.current = false; setError(''); setReady(null); setProgress(''); setBusy(true); onBusy(true);
    try {
      const indexes = exportPageIndexes(pages.length, scope, current, selected);
      const { createDiaryExport } = await import('../../lib/diarioExport.js');
      const result = await createDiaryExport(pages, indexes, format, { cover: scope !== 'current' && cover, cancelled: () => cancel.current, onProgress: (message) => { if (alive.current) setProgress(message); } });
      if (!alive.current || cancel.current) return;
      file.current = new File([result.blob], result.name, { type: result.blob.type });
      setReady({ ...result, url: URL.createObjectURL(result.blob) });
    } catch (e) { if (alive.current) setError(e.message || 'Esportazione non riuscita.'); }
    finally { if (alive.current) { setBusy(false); onBusy(false); } }
  }
  async function share() {
    try { await navigator.share({ files: [file.current], title: 'amor fati' }); }
    catch (e) { if (e.name !== 'AbortError') setError('Condivisione non riuscita. Usa Scarica per salvare il file.'); }
  }
  return <div className="af-panel af-export" role="dialog" aria-label="Esporta il diario" onKeyDown={(e) => { if (e.key === 'Escape') close(); }}>
    <div className="af-panel-heading"><div><small>UNA COPIA DA CUSTODIRE</small><h2>Porta con te i tuoi ricordi</h2></div><button onClick={close} aria-label={busy ? 'Annulla esportazione' : 'Chiudi esportazione'}>×</button></div>
    <p className="af-panel-intro">Testi, fotografie e citazioni, con l’aspetto del tuo diario.</p>
    <fieldset disabled={busy}><legend>Cosa vuoi esportare?</legend><div className="af-export-scopes">
      {[['current', `Pagina ${current + 1}`], ['all', 'Tutto il diario'], ['selected', 'Pagine scelte']].map(([value, label]) => <label key={value}><input type="radio" name="diary-scope" value={value} checked={scope === value} onChange={() => { setScope(value); setCover(value === 'all'); }} />{label}</label>)}
    </div>
    {scope === 'selected' && <div className="af-export-grid">{pages.map((p, i) => <label key={p.id}><input type="checkbox" checked={selected.includes(i)} onChange={(e) => setSelected((list) => e.target.checked ? [...list, i] : list.filter((n) => n !== i))} />Pagina {i + 1}</label>)}</div>}
    <label className="af-export-format">Formato<select ref={first} value={format} onChange={(e) => setFormat(e.target.value)}><option value="pdf">PDF · un documento completo</option><option value="jpeg">JPEG · immagini delle pagine</option></select></label>
    {scope !== 'current' && <label className="af-export-cover"><input type="checkbox" checked={cover} onChange={(e) => setCover(e.target.checked)} />Includi la copertina</label>}
    </fieldset>
    <p className="af-export-note">{format === 'jpeg' ? 'Le pagine lunghe proseguono su più fogli. Più immagini vengono raccolte in un unico ZIP, con un JPEG per foglio.' : 'I testi lunghi proseguono su altri fogli, senza tagli.'}</p>
    {error && <p className="af-panel-error" role="alert">{error}</p>}
    {busy ? <p role="status">{progress || 'Preparo il diario…'}</p> : ready ? <div className="af-export-ready"><p role="status">Pronto · {ready.sheets} {ready.sheets === 1 ? 'foglio' : 'fogli'}</p><a className="af-primary" href={ready.url} download={ready.name} type={ready.blob.type}>Scarica {ready.blob.type === 'application/zip' ? 'ZIP con JPEG' : format.toUpperCase()}</a>{navigator.canShare?.({ files: [file.current] }) && <button onClick={share}>Condividi</button>}<button onClick={prepare}>Prepara di nuovo</button></div> : <button className="af-primary" onClick={prepare}>Prepara {format === 'pdf' ? 'PDF' : 'JPEG'}</button>}
  </div>;
}
