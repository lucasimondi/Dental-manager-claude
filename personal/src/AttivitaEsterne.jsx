import { useState } from 'react';
import { creaAttivita, registraEvento } from './lib/attivitaEsterne.js';

export default function AttivitaEsterne() {
  const [items, setItems] = useState([]);
  const [titolo, setTitolo] = useState('');
  const [errore, setErrore] = useState('');
  function aggiungi(e) {
    e.preventDefault();
    try {
      setItems(v => [creaAttivita({ id: crypto.randomUUID(), titolo }), ...v]);
      setTitolo('');
      setErrore('');
    } catch (e) { setErrore(e.message); }
  }
  function avanza(a, stato, prova) {
    try {
      const descrizione = stato === 'completata' ? 'Risultato registrato manualmente' : 'Stato aggiornato manualmente';
      setItems(v => v.map(x => x.id === a.id ? registraEvento(x, { stato, descrizione, prova }) : x));
      setErrore('');
    } catch (e) { setErrore(e.message); }
  }
  return <section className="pp-attivita">
    <h2>Attività esterne</h2>
    <p>Registro temporaneo sul dispositivo. Work non viene avviato automaticamente e gli aggiornamenti non sono ancora sincronizzati.</p>
    <form onSubmit={aggiungi}>
      <label>Nuova attività <input value={titolo} onChange={e => setTitolo(e.target.value)} required /></label>
      <button type="submit">Aggiungi</button>
    </form>
    {errore && <p role="alert">{errore}</p>}
    {items.map(a => <article key={a.id}>
      <strong>{a.titolo}</strong> — {a.stato.replaceAll('_', ' ')}
      {a.stato === 'in_attesa' && <button type="button" onClick={() => avanza(a, 'in_corso')}>Segna avvio</button>}
      {a.stato === 'in_corso' && <button type="button" onClick={() => {
        const prova = window.prompt('Inserisci il riferimento verificabile del risultato');
        if (prova?.trim()) avanza(a, 'completata', prova.trim());
      }}>Segna completata</button>}
    </article>)}
  </section>;
}
