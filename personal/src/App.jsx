import { useCallback, useEffect, useState } from 'react';
import { archivioDb } from './lib/supabasePersonal.js';
import { cercaDocumenti, conteggiFascicoli, eliminaDocumento, pratiche as caricaPratiche, documentiDellaPratica, rispondi, scadenzeAperte, segnaScadenza, cambiaStatoPratica } from './lib/archivio.js';
import { euro } from './lib/coreArchivio.js';

const data = (d) => (d ? new Date(String(d).length === 10 ? `${d}T00:00:00` : d).toLocaleDateString('it-IT') : '');
const oggi = () => new Date().toISOString().slice(0, 10);
const ESEMPI = ['Quanto devo a Edison?', 'Scadenze di questo mese', 'Cosa devo fare?', 'Bollette', 'Le mie pratiche'];

function Accesso() {
  const [email, setEmail] = useState('');
  const [stato, setStato] = useState(null);
  const invia = async (e) => {
    e.preventDefault();
    setStato('invio');
    const { error } = await archivioDb.auth.signInWithOtp({ email: email.trim(), options: { emailRedirectTo: window.location.origin } });
    setStato(error ? `Errore: ${error.message}` : 'Controlla la posta: ti ho mandato il link per entrare.');
  };
  return (
    <main className="pp-accesso">
      <h1>Poliedron Personal</h1>
      <p>Il tuo archivio personale. Accesso riservato.</p>
      <form onSubmit={invia}>
        <input type="email" required autoComplete="email" placeholder="La tua email" value={email} onChange={(e) => setEmail(e.target.value)} />
        <button type="submit" disabled={stato === 'invio'}>Mandami il link</button>
      </form>
      {stato && stato !== 'invio' && <p className="pp-nota">{stato}</p>}
    </main>
  );
}

function Documento({ doc, onEliminato }) {
  const [conferma, setConferma] = useState(false);
  const [errore, setErrore] = useState(null);
  const elimina = async () => {
    try {
      const r = await eliminaDocumento(archivioDb, doc.id);
      onEliminato?.(doc, r?.drive_file_ids || []);
    } catch (e) { setErrore(e.message); }
  };
  return (
    <article className="pp-card">
      <header>
        <strong>{doc.titolo || doc.nome_file_originale || doc.email_oggetto || 'Documento'}</strong>
        {doc.importo != null && <span className="pp-importo">{euro(doc.importo)}</span>}
      </header>
      <div className="pp-meta">
        {[doc.fascicolo, data(doc.data_documento || doc.email_data), doc.email_mittente].filter(Boolean).join(' · ')}
      </div>
      {doc.fascicolo === 'clinico_pazienti' && <div className="pp-avviso">Documento di un paziente: va spostato nella scheda paziente dello studio.</div>}
      {doc.riassunto && <p>{doc.riassunto}</p>}
      {doc.azione_richiesta && <p className={`pp-azione pp-${doc.urgenza || 'media'}`}>Da fare: {doc.azione_descrizione || 'azione richiesta'}</p>}
      <footer>
        {doc.drive_url && <a href={doc.drive_url} target="_blank" rel="noreferrer">Apri originale</a>}
        {!conferma && <button className="pp-link-rosso" onClick={() => setConferma(true)}>Elimina</button>}
        {conferma && (
          <span className="pp-conferma">Eliminare per sempre dall'archivio?
            <button className="pp-rosso" onClick={elimina}>Sì, elimina</button>
            <button onClick={() => setConferma(false)}>Annulla</button>
          </span>
        )}
      </footer>
      {errore && <p className="pp-errore">{errore}</p>}
    </article>
  );
}

function Scadenze({ scadenze, onCambia }) {
  if (!scadenze.length) return <p className="pp-vuoto">Nessuna scadenza aperta.</p>;
  return (
    <ul className="pp-lista">
      {scadenze.map((s) => (
        <li key={s.id} className={s.data < oggi() ? 'pp-scaduta' : ''}>
          <div>
            <strong>{data(s.data)}</strong> · {s.descrizione}
            <div className="pp-meta">{[s.pratica?.titolo, s.documento?.titolo].filter(Boolean).join(' · ')}</div>
          </div>
          <div className="pp-destra">
            {s.importo != null && <span className="pp-importo">{euro(s.importo)}</span>}
            {s.documento?.drive_url && <a href={s.documento.drive_url} target="_blank" rel="noreferrer">PDF</a>}
            <button onClick={() => onCambia(s)}>Pagata</button>
          </div>
        </li>
      ))}
    </ul>
  );
}

function Pratiche({ elenco, onApri }) {
  if (!elenco.length) return <p className="pp-vuoto">Nessuna pratica.</p>;
  return (
    <ul className="pp-lista">
      {elenco.map((p) => (
        <li key={p.id} onClick={() => onApri(p)} className="pp-cliccabile">
          <div>
            <strong>{p.titolo}</strong>
            <div className="pp-meta">{[p.fascicolo, `${p.n_documenti} documenti`, p.prossima_scadenza && `scade ${data(p.prossima_scadenza)}`].filter(Boolean).join(' · ')}</div>
          </div>
          <span className={`pp-stato pp-${p.urgenza}`}>{p.stato}</span>
        </li>
      ))}
    </ul>
  );
}

function Risposta({ risposta, onAggiorna, onApriPratica, onEliminato }) {
  if (!risposta || risposta.tipo === 'vuoto') return null;
  if (risposta.tipo === 'debito') {
    return (
      <section>
        <p className="pp-frase">{risposta.frase}</p>
        <Scadenze scadenze={risposta.aperte} onCambia={onAggiorna} />
        {risposta.documenti.slice(0, 20).map((d) => <Documento key={d.id} doc={d} onEliminato={onEliminato} />)}
      </section>
    );
  }
  if (risposta.tipo === 'scadenze') {
    const totale = risposta.scadenze.reduce((t, s) => t + Number(s.importo || 0), 0);
    return (
      <section>
        <p className="pp-frase">{risposta.scadenze.length} scadenze aperte, {euro(totale)}{risposta.scadute ? `, di cui ${risposta.scadute} già scadute` : ''}.</p>
        <Scadenze scadenze={risposta.scadenze} onCambia={onAggiorna} />
      </section>
    );
  }
  if (risposta.tipo === 'pratiche') return <Pratiche elenco={risposta.pratiche} onApri={onApriPratica} />;
  return (
    <section>
      <p className="pp-frase">{risposta.documenti.length ? `${risposta.documenti.length} documenti${risposta.titolo ? ` — ${risposta.titolo}` : ''}.` : 'Nessun documento trovato.'}</p>
      {risposta.documenti.map((d) => <Documento key={d.id} doc={d} onEliminato={onEliminato} />)}
    </section>
  );
}

function Archivio({ email }) {
  const [vista, setVista] = useState('chiedi');
  const [domanda, setDomanda] = useState('');
  const [risposta, setRisposta] = useState(null);
  const [lista, setLista] = useState([]);
  const [pratica, setPratica] = useState(null);
  const [errore, setErrore] = useState(null);
  const [avviso, setAvviso] = useState(null);
  const [caricamento, setCaricamento] = useState(false);

  const esegui = useCallback(async (fn) => {
    setErrore(null); setCaricamento(true);
    try { await fn(); } catch (e) { setErrore(e.message); } finally { setCaricamento(false); }
  }, []);

  const chiedi = (testo) => esegui(async () => { setVista('chiedi'); setPratica(null); setRisposta(await rispondi(archivioDb, testo)); });
  const apriPratica = (p) => esegui(async () => { setPratica({ ...p, documenti: await documentiDellaPratica(archivioDb, p.id) }); setVista('pratica'); });

  useEffect(() => {
    if (vista === 'scadenze') esegui(async () => setLista(await scadenzeAperte(archivioDb)));
    if (vista === 'pratiche') esegui(async () => setLista(await caricaPratiche(archivioDb)));
    if (vista === 'fascicoli') esegui(async () => setLista(await conteggiFascicoli(archivioDb)));
  }, [vista, esegui]);

  const pagata = (s) => esegui(async () => {
    await segnaScadenza(archivioDb, s.id, true);
    setLista((l) => l.filter((x) => x.id !== s.id));
    setRisposta((r) => (r?.aperte ? { ...r, aperte: r.aperte.filter((x) => x.id !== s.id) } : r?.scadenze ? { ...r, scadenze: r.scadenze.filter((x) => x.id !== s.id) } : r));
  });

  const eliminato = (doc, driveIds) => {
    setRisposta((r) => (r?.documenti ? { ...r, documenti: r.documenti.filter((d) => d.id !== doc.id) } : r));
    setPratica((p) => (p ? { ...p, documenti: p.documenti.filter((d) => d.id !== doc.id) } : p));
    setAvviso(driveIds.length
      ? { testo: 'Eliminato dall\'archivio. Il file originale è ancora su Google Drive:', links: driveIds.map((id) => `https://drive.google.com/file/d/${id}/view`) }
      : { testo: 'Eliminato dall\'archivio.', links: [] });
  };

  return (
    <div className="pp-app">
      <header className="pp-top">
        <h1>Poliedron Personal</h1>
        <button className="pp-esci" onClick={() => archivioDb.auth.signOut()} title={email}>Esci</button>
      </header>
      <form className="pp-chiedi" onSubmit={(e) => { e.preventDefault(); chiedi(domanda); }}>
        <input value={domanda} onChange={(e) => setDomanda(e.target.value)} placeholder="Cerca o chiedi: “Quanto devo a Edison?”" aria-label="Cerca nell'archivio" />
        <button type="submit">Vai</button>
      </form>
      <nav className="pp-tab">
        {[['chiedi', 'Chiedi'], ['scadenze', 'Scadenze'], ['pratiche', 'Pratiche'], ['fascicoli', 'Fascicoli']].map(([k, l]) => (
          <button key={k} className={vista === k ? 'attivo' : ''} onClick={() => { setPratica(null); setVista(k); }}>{l}</button>
        ))}
      </nav>
      {avviso && (
        <div className="pp-avviso" role="status">
          {avviso.testo} {avviso.links.map((u) => <a key={u} href={u} target="_blank" rel="noreferrer">apri su Drive per cancellarlo</a>)}
          <button onClick={() => setAvviso(null)}>Chiudi</button>
        </div>
      )}
      {errore && <p className="pp-errore">{errore}</p>}
      {caricamento && <p className="pp-caricamento">Cerco…</p>}
      <main>
        {vista === 'chiedi' && (risposta
          ? <Risposta risposta={risposta} onAggiorna={pagata} onApriPratica={apriPratica} onEliminato={eliminato} />
          : <div className="pp-esempi">{ESEMPI.map((e) => <button key={e} onClick={() => { setDomanda(e); chiedi(e); }}>{e}</button>)}</div>)}
        {vista === 'scadenze' && <Scadenze scadenze={lista} onCambia={pagata} />}
        {vista === 'pratiche' && <Pratiche elenco={lista} onApri={apriPratica} />}
        {vista === 'fascicoli' && (
          <ul className="pp-lista">
            {lista.map((f) => (
              <li key={f.codice} className="pp-cliccabile" onClick={() => esegui(async () => { setVista('chiedi'); setRisposta({ tipo: 'documenti', titolo: f.nome, documenti: await cercaDocumenti(archivioDb, '', f.codice) }); })}>
                <strong>{f.nome}</strong>
                <span className="pp-meta">{f.n} documenti{f.n_azioni ? ` · ${f.n_azioni} da gestire` : ''}</span>
              </li>
            ))}
          </ul>
        )}
        {vista === 'pratica' && pratica && (
          <section>
            <h2>{pratica.titolo}</h2>
            <p className="pp-meta">{pratica.stato} · {pratica.n_documenti} documenti{pratica.note ? ` · ${pratica.note}` : ''}</p>
            {pratica.stato !== 'risolta' && (
              <button onClick={() => esegui(async () => { await cambiaStatoPratica(archivioDb, pratica.id, 'risolta'); setPratica({ ...pratica, stato: 'risolta' }); })}>Segna risolta</button>
            )}
            {pratica.documenti.map((d) => <Documento key={d.id} doc={d} onEliminato={eliminato} />)}
          </section>
        )}
      </main>
    </div>
  );
}

export default function App() {
  const [sessione, setSessione] = useState(undefined);
  useEffect(() => {
    archivioDb.auth.getSession().then(({ data: d }) => setSessione(d.session));
    const { data: sub } = archivioDb.auth.onAuthStateChange((_e, s) => setSessione(s));
    return () => sub.subscription.unsubscribe();
  }, []);
  if (sessione === undefined) return null;
  return sessione ? <Archivio email={sessione.user?.email} /> : <Accesso />;
}
