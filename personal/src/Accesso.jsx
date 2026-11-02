import { CambioAspetto } from './Aspetto.jsx';
// Accesso a Personal: email e password, recupero password via link, scelta della nuova password.
import { useState } from 'react';
import { archivioDb } from './lib/supabasePersonal.js';
import { INDIRIZZO_APP } from './ui.jsx';

/* ---------- accesso ---------- */
export function Accesso() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [modo, setModo] = useState('entra');
  const [stato, setStato] = useState(null);
  const [invio, setInvio] = useState(false);

  const entra = async (e) => {
    e.preventDefault();
    setInvio(true); setStato(null);
    if (modo === 'entra') {
      const { error } = await archivioDb.auth.signInWithPassword({ email: email.trim(), password });
      if (error) setStato({ errore: true, testo: /confirm/i.test(error.message) ? 'Email non ancora confermata.' : 'Email o password non corretti. Se non hai ancora una password, tocca "Imposta o recupera la password".' });
    } else {
      const { error } = await archivioDb.auth.resetPasswordForEmail(email.trim(), { redirectTo: INDIRIZZO_APP() });
      setStato(error ? { errore: true, testo: `Invio non riuscito: ${error.message}` } : { testo: 'Ti ho mandato un\'email. Aprila, tocca il link e scegli la password nella pagina che si apre. Poi torna qui ed entra con email e password.' });
    }
    setInvio(false);
  };

  return (
    <main className="pp-accesso">
      <CambioAspetto />
      <div className="pp-accesso-marchio"><img src="/poliedron-v2-192.png" alt="" width="56" height="56" /></div>
      <p className="pp-accesso-eyebrow">IL TUO SPAZIO PERSONALE</p>
      <h1>Poliedron</h1>
      <p className="pp-accesso-sotto">Documenti, impegni e pensieri. Tutto, in un unico posto.</p>
      <form onSubmit={entra} className="pp-modulo">
        <label className="pp-campo"><span>Email</span>
          <input type="email" required autoComplete="username" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="nome@esempio.it" />
        </label>
        {modo === 'entra' && (
          <label className="pp-campo"><span>Password</span>
            <input type="password" required autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
          </label>
        )}
        <button type="submit" className="pp-bottone pp-bottone-largo" disabled={invio}>{invio ? 'Attendi…' : modo === 'entra' ? 'Entra' : 'Mandami il link'}</button>
      </form>
      <button className="pp-testo-link" onClick={() => { setModo(modo === 'entra' ? 'recupera' : 'entra'); setStato(null); }}>
        {modo === 'entra' ? 'Imposta o recupera la password' : 'Ho già la password, entra'}
      </button>
      {stato && <p className={stato.errore ? 'pp-messaggio pp-messaggio-errore' : 'pp-messaggio'}>{stato.testo}</p>}
    </main>
  );
}

export function NuovaPassword({ onFatto }) {
  const [password, setPassword] = useState('');
  const [stato, setStato] = useState(null);
  const salva = async (e) => {
    e.preventDefault();
    const { error } = await archivioDb.auth.updateUser({ password });
    if (error) setStato(`Errore: ${error.message}`);
    else onFatto();
  };
  return (
    <main className="pp-accesso">
      <CambioAspetto />
      <div className="pp-accesso-marchio"><img src="/poliedron-v2-192.png" alt="" width="56" height="56" /></div>
      <h1>Scegli la password</h1>
      <p className="pp-accesso-sotto">La userai per entrare nell'app dalla schermata Home. L'iPhone può ricordarla con Face ID.</p>
      <form onSubmit={salva} className="pp-modulo">
        <label className="pp-campo"><span>Nuova password (almeno 8 caratteri)</span>
          <input type="password" required minLength={8} autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </label>
        <button type="submit" className="pp-bottone pp-bottone-largo">Salva password</button>
      </form>
      {stato && <p className="pp-messaggio pp-messaggio-errore">{stato}</p>}
    </main>
  );
}
