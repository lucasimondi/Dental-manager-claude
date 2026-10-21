import { useEffect, useRef, useState } from 'react';
import { azioneFascicolo, esportaFascicolo, interrogaFascicolo, nomeSicuro } from '../../lib/fascicolo.js';
import { partiRisposta } from '../../lib/archivio.js';
import { tokenSessione } from '../../ui.jsx';

export function AzioniFascicolo({ documenti, nome = 'Documenti selezionati', ctx }) {
  const [lavoro, setLavoro] = useState(''), [zip, setZip] = useState(null);
  const [domanda, setDomanda] = useState(''), [esito, setEsito] = useState(null), [drive, setDrive] = useState(null);
  const [errore, setErrore] = useState('');
  const lock = useRef(false), generazione = useRef(0);
  const chiave = documenti.map((d) => `${d.id}:${d.ente}:${d.drive_file_id}`).join('|');
  useEffect(() => {
    generazione.current += 1; setZip(null); setEsito(null); setDrive(null); setErrore(''); setLavoro(''); lock.current = false;
    return () => { generazione.current += 1; };
  }, [chiave]);
  const opera = async (fn) => {
    if (lock.current) return;
    lock.current = true; setErrore('');
    const g = generazione.current;
    const annullato = () => g !== generazione.current;
    try { await fn((s) => { if (!annullato()) setLavoro(s); }, annullato); }
    catch (e) { if (!annullato()) setErrore(e.message); }
    finally { if (!annullato()) { setLavoro(''); lock.current = false; } }
  };
  const prepara = () => opera(async (progresso, annullato) => {
    setZip(null); progresso('Preparo i file…');
    const token = await tokenSessione();
    const r = await esportaFascicolo(documenti, (_id, d) => azioneFascicolo(token, 'fascicolo_file', { id: d.id }), progresso, annullato);
    if (!annullato()) setZip({ ...r, file: new File([r.blob], `${nomeSicuro(nome)}.zip`, { type: 'application/zip' }) });
  });
  const analizza = (testo) => opera(async (progresso, annullato) => {
    setEsito(null); progresso('Avvio lettura degli originali…');
    const token = await tokenSessione();
    const r = await interrogaFascicolo(documenti, testo, (azione, campi) => azioneFascicolo(token, azione, campi), progresso, annullato);
    if (!annullato()) setEsito(r);
  });
  const organizza = () => opera(async (progresso, annullato) => {
    setDrive(null);
    const token = await tokenSessione(), errori = [], link = new Set();
    let fatti = 0;
    for (const d of documenti) {
      if (annullato()) return;
      progresso(`Organizzo su Drive ${fatti + errori.length + 1}/${documenti.length}`);
      try { const r = await azioneFascicolo(token, 'fascicolo_drive', { id: d.id }); if (/^https:\/\/drive\.google\.com\//.test(r.link || '')) link.add(r.link); fatti += 1; }
      catch (e) { errori.push({ titolo: d.titolo, motivo: e.message }); }
    }
    if (!annullato()) setDrive({ fatti, errori, link: [...link] });
  });
  const scarica = () => {
    const url = URL.createObjectURL(zip.file), a = document.createElement('a');
    a.href = url; a.download = zip.file.name; a.click(); setTimeout(() => URL.revokeObjectURL(url), 60000);
  };
  const condividi = async () => {
    try {
      if (!navigator.canShare?.({ files: [zip.file] })) { setErrore('Questo dispositivo non condivide ZIP: usa Scarica ZIP e allega il file dall’app destinataria.'); return; }
      await navigator.share({ title: nome, files: [zip.file] });
    } catch (e) { if (e.name !== 'AbortError') setErrore(e.message); }
  };
  if (!documenti.length) return null;
  return <section className="pp-pannello pp-fascicolo-strumenti" aria-label={`Azioni su ${nome}`}>
    <strong>{nome} · {documenti.length} documenti</strong>
    <div className="pp-azioni">
      <button className="pp-bottone pp-bottone-chiaro" disabled={!!lavoro} onClick={prepara}>Prepara download completo</button>
      <button className="pp-bottone pp-bottone-chiaro" disabled={!!lavoro} onClick={() => analizza('Sintetizza i documenti: fatti principali, cronologia, punti aperti, contraddizioni e informazioni mancanti. Cita le fonti.')}>Sintetizza con AI</button>
      <button className="pp-bottone pp-bottone-chiaro" disabled={!!lavoro} onClick={organizza}>Organizza anche su Drive</button>
    </div>
    <form onSubmit={(e) => { e.preventDefault(); if (domanda.trim()) analizza(domanda.trim()); }}>
      <label className="pp-campo"><span>Chiedi a questi documenti</span><textarea rows={2} maxLength={2000} value={domanda} onChange={(e) => setDomanda(e.target.value)} placeholder="Es. Quali esami sono richiesti e in quali documenti?" /></label>
      <button className="pp-bottone" disabled={!!lavoro || !domanda.trim()}>Chiedi all’AI</button>
    </form>
    {lavoro && <p role="status"><span className="pp-rotella" /> {lavoro} <button className="pp-testo-link" onClick={() => { generazione.current += 1; lock.current = false; setLavoro(''); }}>Interrompi</button></p>}
    {errore && <p role="alert" className="pp-rosso">{errore}</p>}
    {zip && <div role="status">
      <p>{zip.inclusi}/{documenti.length} originali inclusi{zip.mancanti.length ? ' · Archivio parziale: vedi i file mancanti.' : ''}</p>
      {zip.inclusi > 0 && <div className="pp-azioni"><button className="pp-bottone" onClick={scarica}>Scarica ZIP</button><button className="pp-bottone pp-bottone-chiaro" onClick={condividi}>Condividi ZIP</button></div>}
      <p className="pp-riga-meta">Per ChatGPT: scarica o condividi il file; se l’app non accetta ZIP, estrailo e allega gli originali. L’elenco completo è in CONTENUTO.json.</p>
      {zip.mancanti.length > 0 && <details><summary>File non inclusi ({zip.mancanti.length})</summary><ul>{zip.mancanti.map((d) => <li key={d.id}>{d.titolo}: {d.motivo}</li>)}</ul></details>}
    </div>}
    {drive && <div role="status"><p>{drive.fatti}/{documenti.length} documenti organizzati su Drive.</p>{drive.link.map((link, i) => <p key={link}><a href={link} target="_blank" rel="noreferrer">Apri cartella su Drive{drive.link.length > 1 ? ` ${i + 1}` : ''}</a></p>)}{drive.errori.length > 0 && <details><summary>Da sistemare ({drive.errori.length})</summary><ul>{drive.errori.map((e, i) => <li key={i}>{e.titolo}: {e.motivo}</li>)}</ul></details>}</div>}
    {esito && <div className="pp-fascicolo-risposta">
      <p role="status">{esito.letti.length}/{documenti.length} originali analizzati · {esito.letti.filter((d) => d.parziale).length} letture parziali · {esito.esclusi.length} non analizzati</p>
      <div className="pp-testo-lungo">{partiRisposta(esito.risposta).map((p, i) => p.doc ? <button key={i} className="pp-testo-link" onClick={() => ctx.apri({ tipo: 'documento', id: p.doc })}>{p.titolo}</button> : <span key={i}>{p.testo}</span>)}</div>
      <details><summary>Fonti e copertura</summary><ul>{esito.letti.map((d) => <li key={d.id}><button className="pp-testo-link" onClick={() => ctx.apri({ tipo: 'documento', id: d.id })}>{d.titolo}</button>{d.parziale ? ' — lettura parziale (limiti di conversione)' : ' — originale inviato al modello'}</li>)}{esito.esclusi.map((d) => <li key={d.id}>{d.titolo}: {d.motivo}</li>)}</ul></details>
    </div>}
  </section>;
}
