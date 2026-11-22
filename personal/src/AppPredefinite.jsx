// PR #337 §4 — Impostazioni › Personale › App predefinite: per ogni estensione si sceglie con cosa
// aprire i file in Esplora (doppio clic / tocco). «Automatica» = regola di Poliedra. Salvate in
// impostazioni_app (chiave esplora_app_predefinite), uguali su tutti i dispositivi.
import { useEffect, useState } from 'react';
import { archivioDb } from './lib/supabasePersonal.js';
import { APP_APERTURA, ESTENSIONI_COMUNI, nomeApp, appAutomatica, cambiaApp, caricaAppPredefinite, salvaAppPredefinite } from './lib/apertura.js';

const ESEMPIO = { pdf: 'application/pdf', jpg: 'image/jpeg', png: 'image/png', heic: 'image/heic', mp4: 'video/mp4', mp3: 'audio/mpeg', docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation', eml: 'message/rfc822' };

export function SceltaAppPredefinite({ solo = null, onFatto = null }) {
  const [mappa, setMappa] = useState(null);
  const [errore, setErrore] = useState(null);
  const [nuova, setNuova] = useState('');
  useEffect(() => { caricaAppPredefinite(archivioDb).then(setMappa).catch((e) => { setMappa({}); setErrore(e.message); }); }, []);
  if (!mappa) return <p className="pp-riga-meta"><span className="pp-rotella" /> Carico…</p>;
  const scegli = async (ext, app) => {
    const prima = mappa;
    const dopo = cambiaApp(mappa, ext, app);
    setMappa(dopo); setErrore(null);
    try { await salvaAppPredefinite(archivioDb, dopo); onFatto?.(dopo, ext); } catch (e) { setMappa(prima); setErrore(`Non salvato: ${e.message}`); }
  };
  const estensioni = solo ? [solo] : [...new Set([...ESTENSIONI_COMUNI, ...Object.keys(mappa)])];
  return (
    <div className="pp-app-predefinite">
      {errore && <p className="pp-messaggio pp-messaggio-errore" role="alert">{errore}</p>}
      <ul className="pp-gruppo" role="list">
        {estensioni.map((ext) => {
          const auto = nomeApp(appAutomatica({ nome_file_originale: `x.${ext}`, mime_type: ESEMPIO[ext] || '', drive_file_id: 'x' }));
          return (
            <li key={ext} className="pp-riga pp-riga-app">
              <span className="pp-riga-testo"><span className="pp-riga-titolo">.{ext}</span><span className="pp-riga-meta">{mappa[ext] ? nomeApp(mappa[ext]) : `Automatica (${auto})`}</span></span>
              <select value={mappa[ext] || ''} onChange={(e) => scegli(ext, e.target.value)} aria-label={`Apri i file .${ext} con`}>
                <option value="">Automatica</option>
                {APP_APERTURA.map(([k, n]) => <option key={k} value={k}>{n}</option>)}
              </select>
            </li>
          );
        })}
      </ul>
      {!solo && (
        <form className="pp-app-nuova" onSubmit={(e) => { e.preventDefault(); const x = nuova.trim().replace(/^\./, '').toLowerCase(); if (/^[a-z0-9]{1,6}$/.test(x)) { setNuova(''); scegli(x, 'anteprima'); } }}>
          <input value={nuova} onChange={(e) => setNuova(e.target.value)} placeholder="Altra estensione, es. odt" aria-label="Altra estensione" />
          <button type="submit" className="pp-bottone">Aggiungi</button>
        </form>
      )}
    </div>
  );
}
