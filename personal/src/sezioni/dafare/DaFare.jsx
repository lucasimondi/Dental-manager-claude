import { useCallback, useEffect, useState } from 'react';
import { archivioDb } from '../../lib/supabasePersonal.js';
import { caricaDaFare, cambiaStato, raggruppa, passi, puoRispondere, bozzaPerPromemoria } from '../../lib/daFare.js';
import { dataBreve, quando, Vuoto, Sezione, tokenSessione } from '../../ui.jsx';

// DA-FARE (2026-11-16): ogni promemoria è breve (titolo) e spiegato (spiegazione), con quattro tasti:
// Gestita, Rimuovi (non cancella: lo segna rimosso), Dimmi cosa fare (i passi), Rispondi all'email
// (bozza in Gmail con il testo già pronto o scritto da Luca; non parte nulla).
const euro = (n) => (n == null ? '' : Number(n).toLocaleString('it-IT', { style: 'currency', currency: 'EUR' }));

export function VistaDaFare({ ctx }) {
  const { esegui, mostra } = ctx;
  const [voci, setVoci] = useState(null);
  const carica = useCallback(() => esegui(async () => setVoci(await caricaDaFare(archivioDb))), [esegui]);
  useEffect(() => { carica(); }, [carica]);
  const togli = (id) => setVoci((v) => v.filter((p) => p.id !== id));
  if (!voci) return <Vuoto>Carico…</Vuoto>;
  if (!voci.length) return <Vuoto>Niente da fare: tutto gestito.</Vuoto>;
  return (
    <div className="pp-dafare">
      <p className="pp-riga-meta">{voci.length} cose da gestire, lette dalle tue email e dai tuoi documenti.</p>
      {raggruppa(voci).map((g) => (
        <Sezione key={g.id} titolo={`${g.nome} · ${g.voci.length}`}>
          {g.voci.map((p) => (
            <Promemoria key={p.id} p={p} ctx={ctx}
              onStato={(stato) => esegui(async () => { await cambiaStato(archivioDb, p.id, stato); togli(p.id); mostra(stato === 'gestito' ? 'Segnata come gestita' : 'Rimossa dai promemoria'); })} />
          ))}
        </Sezione>
      ))}
    </div>
  );
}

function Promemoria({ p, ctx, onStato }) {
  const [aperto, setAperto] = useState(null); // 'passi' | 'rispondi' | null
  const [confermaRimuovi, setConfermaRimuovi] = useState(false);
  const meta = [p.ente, p.scadenza ? `entro ${dataBreve(p.scadenza)} · ${quando(p.scadenza)}` : null, p.importo != null ? euro(p.importo) : null].filter(Boolean).join(' · ');
  return (
    <div className={`pp-pannello pp-promemoria pp-priorita-${p.priorita}`}>
      <strong className="pp-promemoria-titolo">{p.titolo}</strong>
      {meta && <p className="pp-riga-meta">{meta}</p>}
      {p.spiegazione && <p className="pp-testo-lungo">{p.spiegazione}</p>}
      <div className="pp-form-azioni pp-promemoria-azioni">
        <button className="pp-bottone" onClick={() => onStato('gestito')}>✓ Gestita</button>
        <button className="pp-bottone pp-bottone-chiaro" onClick={() => setAperto(aperto === 'passi' ? null : 'passi')}>Dimmi cosa fare</button>
        {puoRispondere(p) && <button className="pp-bottone pp-bottone-chiaro" onClick={() => setAperto(aperto === 'rispondi' ? null : 'rispondi')}>Rispondi all'email</button>}
        {!confermaRimuovi
          ? <button className="pp-bottone pp-bottone-chiaro" onClick={() => setConfermaRimuovi(true)}>Rimuovi</button>
          : <><button className="pp-bottone pp-bottone-pericolo" onClick={() => onStato('rimosso')}>Sì, rimuovi</button><button className="pp-testo-link" onClick={() => setConfermaRimuovi(false)}>Annulla</button></>}
      </div>
      {aperto === 'passi' && <Passi p={p} />}
      {aperto === 'rispondi' && <Rispondi p={p} ctx={ctx} onChiudi={() => setAperto(null)} />}
    </div>
  );
}

function Passi({ p }) {
  const elenco = passi(p.cosa_fare);
  return (
    <div className="pp-promemoria-passi">
      {elenco.length ? <ol>{elenco.map((x, i) => <li key={i}>{x}</li>)}</ol> : <p className="pp-riga-meta">Nessun passo scritto: {p.spiegazione || p.titolo}</p>}
      <div className="pp-form-azioni">
        {p.documento?.drive_url && <a className="pp-bottone pp-bottone-chiaro" href={p.documento.drive_url} target="_blank" rel="noreferrer">{p.email ? 'Apri l\'email' : 'Apri il documento'}</a>}
        {p.documento?.gmail_message_id && p.email && !String(p.documento.drive_url || '').includes('mail.google.com') && (
          <a className="pp-bottone pp-bottone-chiaro" href={`https://mail.google.com/mail/u/0/#all/${p.documento.gmail_message_id}`} target="_blank" rel="noreferrer">Apri l'email</a>
        )}
      </div>
    </div>
  );
}

function Rispondi({ p, ctx, onChiudi }) {
  const [testo, setTesto] = useState(p.bozza_risposta || '');
  const [istruzioni, setIstruzioni] = useState('');
  const [attesa, setAttesa] = useState(false);
  const [fatta, setFatta] = useState(null);
  const crea = (conAi) => ctx.esegui(async () => {
    setAttesa(true);
    try {
      setFatta(await bozzaPerPromemoria({ token: await tokenSessione(), documento: p.documento_id, ente: p.ente, testo: conAi ? '' : testo, istruzioni: conAi ? istruzioni : '' }));
    } finally { setAttesa(false); }
  });
  if (fatta) return (
    <div className="pp-promemoria-passi">
      <p className="pp-riga-meta">A: {fatta.a} · {fatta.oggetto}</p>
      <p className="pp-testo-lungo">{fatta.testo}</p>
      <p className="pp-riga-meta">È tra le bozze di Gmail: rileggila e inviala tu da lì. Non è partito nulla.</p>
      <div className="pp-form-azioni"><a className="pp-bottone" href={fatta.link} target="_blank" rel="noreferrer">Apri le bozze di Gmail</a><button className="pp-testo-link" onClick={onChiudi}>Chiudi</button></div>
    </div>
  );
  return (
    <div className="pp-promemoria-passi">
      <label className="pp-campo">Testo della risposta (puoi modificarlo)
        <textarea rows={7} value={testo} onChange={(e) => setTesto(e.target.value)} placeholder="Scrivi la risposta, oppure chiedi a Poliedron di prepararla qui sotto" />
      </label>
      <div className="pp-form-azioni">
        <button className="pp-bottone" disabled={attesa || !testo.trim()} onClick={() => crea(false)}>{attesa ? 'Preparo…' : 'Metti tra le bozze di Gmail'}</button>
      </div>
      <label className="pp-campo">Oppure: cosa vuoi dire (Poliedron scrive la bozza)
        <input value={istruzioni} onChange={(e) => setIstruzioni(e.target.value)} placeholder="es. chiedi una rateizzazione in 3 mesi" />
      </label>
      <div className="pp-form-azioni">
        <button className="pp-bottone pp-bottone-chiaro" disabled={attesa} onClick={() => crea(true)}>Scrivila tu</button>
        <button className="pp-testo-link" onClick={onChiudi}>Annulla</button>
      </div>
      <p className="pp-riga-meta">Non invia nulla: la bozza finisce in Gmail e la mandi tu.</p>
    </div>
  );
}
