import { useEffect, useState } from 'react';
import { archivioDb } from './lib/supabasePersonal.js';
import { elencoAttivita, nuovaAttivita, cambiaStatoAttivita } from './lib/attivitaDb.js';

export default function AttivitaEsterne() {
  const [items, setItems] = useState([]);
  const [titolo, setTitolo] = useState('');
  const [errore, setErrore] = useState('');
  const [occupato, setOccupato] = useState(false);
  const carica = async () => {
    try { setItems(await elencoAttivita(archivioDb)); setErrore(''); }
    catch (e) { setErrore(e.message); }
  };
  useEffect(() => { carica(); }, []);
  async function aggiungi(e) {
    e.preventDefault();
    setOccupato(true);
    try { await nuovaAttivita(archivioDb, titolo); setTitolo(''); await carica(); }
    catch (e) { setErrore(e.message); }
    finally { setOccupato(false); }
  }
  async function avanza(a, stato) {
    const prova = stato === 'completata' ? window.prompt('Riferimento verificabile del risultato:') : null;
    if (stato === 'completata' && !prova?.trim()) return;
    setOccupato(true);
    try { await cambiaStatoAttivita(archivioDb, a, stato, prova); await carica(); }
    catch (e) { setErrore(e.message); }
    finally { setOccupato(false); }
  }
  return <section className="pp-attivita">
    <h2>Attività esterne</h2>
    <p className="pp-riga-meta">Registro sincronizzato con Personal. Work e browser non vengono avviati automaticamente.</p>
    <form className="pp-modulo" onSubmit={aggiungi}>
      <label className="pp-campo"><span>Nuova attività</span><input value={titolo} onChange={e => setTitolo(e.target.value)} required maxLength={240} placeholder="Es. Recuperare un documento" /></label>
      <button className="pp-bottone" type="submit" disabled={occupato}>Aggiungi</button>
    </form>
    {errore && <p role="alert" className="pp-messaggio pp-messaggio-errore">{errore}</p>}
    <button type="button" onClick={carica} disabled={occupato}>Aggiorna elenco</button>
    {items.map(a => <article key={a.id} className="pp-sezione">
      <strong>{a.titolo}</strong> — {a.stato.replaceAll('_', ' ')}
      {a.prova && <p className="pp-riga-meta">Prova: {a.prova}</p>}
      {a.stato === 'in_attesa' && <button disabled={occupato} onClick={() => avanza(a, 'in_corso')}>Segna avvio</button>}
      {a.stato === 'in_corso' && <button disabled={occupato} onClick={() => avanza(a, 'completata')}>Segna completata</button>}
      {a.stato === 'errore' && <button disabled={occupato} onClick={() => avanza(a, 'in_attesa')}>Riprova</button>}
    </article>)}
  </section>;
}
