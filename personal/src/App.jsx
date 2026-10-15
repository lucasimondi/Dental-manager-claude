// POL-VITA-003 — Poliedron Personal: app per telefono dell'archivio personale.
// Oggi · Documenti · (+ carica) · Portafoglio · Pratiche. Nessun modello AI nell'app:
// ricerca e risposte vengono dal Core deterministico (coreArchivio.js).
import { useCallback, useEffect, useRef, useState } from 'react';
import { archivioDb } from './lib/supabasePersonal.js';
import {
  cercaDocumenti, conteggiFascicoli, eliminaDocumento, pratiche as caricaPratiche, documentiDellaPratica, rispondi,
  scadenzeAperte, segnaScadenza, cambiaStatoPratica, documentiDaGestire, documentiRecenti, portafoglio as caricaPortafoglio,
  documentoCompleto, impostaPortafoglio, spostaFascicolo, caricaDocumento, eCaricato, nelPortafoglio,
} from './lib/archivio.js';
import { euro } from './lib/coreArchivio.js';
import { preparaFile } from './lib/file.js';
import {
  IconaOggi, IconaDocumenti, IconaPortafoglio, IconaPratiche, IconaPiu, IconaCerca, IconaChiudi, IconaIndietro, IconaFreccia,
  IconaApri, IconaEmail, IconaCalendario, IconaFotocamera, IconaFile, IconaStella, IconaCestino, IconaEsci,
} from './Icone.jsx';

/* ---------- utilità ---------- */
const COLORI = {
  identita: '#1F4E79', immobili: '#8B5E34', successione: '#5B4B8A', conti: '#2E7D5B', fiscale: '#B7791F',
  previdenza: '#3C7AA0', utenze: '#5E8C31', studio_fornitori: '#2F7F84', studio_fatture_emesse: '#1E8A66',
  legale: '#B42318', assicurazioni: '#8E5079', veicoli: '#4A5A6A', famiglia_scuola: '#C26A1A',
  sanitario_famiglia: '#A63D6B', clinico_pazienti: '#667085', servizi: '#5D6B82', acquisti: '#86704A', altro: '#8A94A3',
};
const colore = (f) => COLORI[f] || COLORI.altro;
const dataBreve = (d) => (d ? new Date(String(d).length === 10 ? `${d}T12:00:00` : d).toLocaleDateString('it-IT', { day: 'numeric', month: 'short', year: 'numeric' }) : '');
const oggiIso = () => new Date().toISOString().slice(0, 10);
const giorniA = (d) => Math.round((new Date(`${d}T12:00:00`) - new Date(`${oggiIso()}T12:00:00`)) / 86400000);
const quando = (d) => {
  const g = giorniA(d);
  if (g === 0) return 'oggi';
  if (g === 1) return 'domani';
  if (g === -1) return 'ieri';
  const n = Math.abs(g);
  const durata = n < 60 ? `${n} giorni` : n < 730 ? `${Math.round(n / 30.4)} mesi` : `${Math.round(n / 365.25)} anni`;
  return g < 0 ? `scaduta da ${durata}` : `tra ${durata}`;
};
const titoloDoc = (d) => d.titolo || d.nome_file_originale || d.email_oggetto || 'Documento';
const saluto = () => { const h = new Date().getHours(); return h < 13 ? 'Buongiorno' : h < 18 ? 'Buon pomeriggio' : 'Buonasera'; };
const VISTA_KEY = 'poliedron-personal-vista';
// Indirizzo pubblico dell'app: sotto /poliedron/ il service worker dello studio non interviene,
// nemmeno nelle copie vecchie rimaste in Safari (che su /personal/ mostrerebbero l'app dello studio).
const INDIRIZZO_APP = '/poliedron/personal/';
const leggiVista = () => { try { return localStorage.getItem(VISTA_KEY) || 'oggi'; } catch { return 'oggi'; } };

/* ---------- accesso ---------- */
function Accesso() {
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
      const { error } = await archivioDb.auth.resetPasswordForEmail(email.trim(), { redirectTo: `${location.origin}${INDIRIZZO_APP}` });
      setStato(error ? { errore: true, testo: `Invio non riuscito: ${error.message}` } : { testo: 'Ti ho mandato un\'email. Aprila, tocca il link e scegli la password nella pagina che si apre. Poi torna qui ed entra con email e password.' });
    }
    setInvio(false);
  };

  return (
    <main className="pp-accesso">
      <div className="pp-accesso-marchio"><IconaPortafoglio size={30} /></div>
      <h1>Personal</h1>
      <p className="pp-accesso-sotto">Il tuo archivio: documenti, scadenze e pratiche.</p>
      <form onSubmit={entra} className="pp-modulo">
        <label className="pp-campo"><span>Email</span>
          <input type="email" required autoComplete="username" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="nome@esempio.it" />
        </label>
        {modo === 'entra' && (
          <label className="pp-campo"><span>Password</span>
            <input type="password" required autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
          </label>
        )}
        <button type="submit" className="pp-bottone" disabled={invio}>{invio ? 'Attendi…' : modo === 'entra' ? 'Entra' : 'Mandami il link'}</button>
      </form>
      <button className="pp-testo-link" onClick={() => { setModo(modo === 'entra' ? 'recupera' : 'entra'); setStato(null); }}>
        {modo === 'entra' ? 'Imposta o recupera la password' : 'Ho già la password, entra'}
      </button>
      {stato && <p className={stato.errore ? 'pp-messaggio pp-messaggio-errore' : 'pp-messaggio'}>{stato.testo}</p>}
    </main>
  );
}

function NuovaPassword({ onFatto }) {
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
      <div className="pp-accesso-marchio"><IconaPortafoglio size={30} /></div>
      <h1>Scegli la password</h1>
      <p className="pp-accesso-sotto">La userai per entrare nell'app dalla schermata Home. L'iPhone può ricordarla con Face ID.</p>
      <form onSubmit={salva} className="pp-modulo">
        <label className="pp-campo"><span>Nuova password (almeno 8 caratteri)</span>
          <input type="password" required minLength={8} autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </label>
        <button type="submit" className="pp-bottone">Salva password</button>
      </form>
      {stato && <p className="pp-messaggio pp-messaggio-errore">{stato}</p>}
    </main>
  );
}

/* ---------- elementi comuni ---------- */
function RigaDocumento({ doc, onApri }) {
  return (
    <button className="pp-riga" onClick={() => onApri(doc)}>
      <span className="pp-riga-icona" style={{ '--c': colore(doc.fascicolo) }}><IconaFile size={18} /></span>
      <span className="pp-riga-testo">
        <span className="pp-riga-titolo">{titoloDoc(doc)}</span>
        <span className="pp-riga-meta">{[dataBreve(doc.data_documento || doc.email_data), eCaricato(doc) ? 'caricato da te' : null].filter(Boolean).join(' · ')}</span>
      </span>
      {doc.importo != null && <span className="pp-riga-importo">{euro(doc.importo)}</span>}
      {doc.azione_richiesta && <span className={`pp-pallino pp-${doc.urgenza || 'media'}`} aria-label="Da gestire" />}
      <IconaFreccia size={16} />
    </button>
  );
}

function RigaScadenza({ s, onPagata, onApriDoc }) {
  const scaduta = s.data < oggiIso();
  return (
    <div className={`pp-scadenza${scaduta ? ' pp-scadenza-scaduta' : ''}`}>
      <button className="pp-scadenza-data" onClick={() => s.documento && onApriDoc(s.documento)}>
        <span className="pp-scadenza-giorno">{new Date(`${s.data}T12:00:00`).getDate()}</span>
        <span className="pp-scadenza-mese">{new Date(`${s.data}T12:00:00`).toLocaleDateString('it-IT', { month: 'short' })}</span>
      </button>
      <button className="pp-scadenza-testo" onClick={() => s.documento && onApriDoc(s.documento)}>
        <span className="pp-riga-titolo">{s.descrizione}</span>
        <span className="pp-riga-meta">{[quando(s.data), s.pratica?.titolo || s.documento?.titolo].filter(Boolean).join(' · ')}</span>
      </button>
      <div className="pp-scadenza-destra">
        {s.importo != null && <span className="pp-riga-importo">{euro(s.importo)}</span>}
        <button className="pp-chip-azione" onClick={() => onPagata(s)}>Fatta</button>
      </div>
    </div>
  );
}

const Vuoto = ({ children }) => <p className="pp-vuoto">{children}</p>;
const Sezione = ({ titolo, azione, children }) => (
  <section className="pp-sezione">
    <div className="pp-sezione-testa"><h2>{titolo}</h2>{azione}</div>
    {children}
  </section>
);

/* ---------- Oggi ---------- */
function VistaOggi({ ctx }) {
  const [dati, setDati] = useState(null);
  const { esegui, apriDoc, pagata, versione } = ctx;
  useEffect(() => {
    esegui(async () => {
      const [scadenze, daGestire, recenti, fascicoli] = await Promise.all([
        scadenzeAperte(archivioDb, 30), documentiDaGestire(archivioDb), documentiRecenti(archivioDb, 8), conteggiFascicoli(archivioDb),
      ]);
      setDati({ scadenze, daGestire, recenti, totale: fascicoli.reduce((t, f) => t + Number(f.n || 0), 0) });
    });
  }, [esegui, versione]);
  if (!dati) return null;
  const scadute = dati.scadenze.filter((s) => s.data < oggiIso()).length;
  const daPagare = dati.scadenze.reduce((t, s) => t + Number(s.importo || 0), 0);
  return (
    <>
      <div className="pp-riassunto">
        <div className="pp-tessera"><span className="pp-tessera-numero">{dati.scadenze.length}</span><span>scadenze entro 30 giorni{scadute ? `, ${scadute} già ${scadute === 1 ? 'scaduta' : 'scadute'}` : ''}</span></div>
        <div className="pp-tessera"><span className="pp-tessera-numero">{euro(daPagare)}</span><span>da pagare</span></div>
        <div className="pp-tessera"><span className="pp-tessera-numero">{dati.daGestire.length}</span><span>documenti da gestire</span></div>
        <div className="pp-tessera"><span className="pp-tessera-numero">{dati.totale}</span><span>documenti in archivio</span></div>
      </div>
      <Sezione titolo="Scadenze">
        {dati.scadenze.length
          ? <div className="pp-gruppo">{dati.scadenze.slice(0, 8).map((s) => <RigaScadenza key={s.id} s={s} onPagata={pagata} onApriDoc={apriDoc} />)}</div>
          : <Vuoto>Nessuna scadenza nei prossimi 30 giorni.</Vuoto>}
      </Sezione>
      <Sezione titolo="Da gestire">
        {dati.daGestire.length
          ? <div className="pp-gruppo">{dati.daGestire.slice(0, 6).map((d) => <RigaDocumento key={d.id} doc={d} onApri={apriDoc} />)}</div>
          : <Vuoto>Niente da gestire.</Vuoto>}
      </Sezione>
      <Sezione titolo="Ultimi arrivati">
        {dati.recenti.length
          ? <div className="pp-gruppo">{dati.recenti.map((d) => <RigaDocumento key={d.id} doc={d} onApri={apriDoc} />)}</div>
          : <Vuoto>L'archivio si sta riempiendo: lo script importa la posta ogni 10 minuti.</Vuoto>}
      </Sezione>
    </>
  );
}

/* ---------- Documenti ---------- */
function Risultato({ risposta, ctx }) {
  const { apriDoc, pagata, apriPratica } = ctx;
  if (risposta.tipo === 'vuoto') return null;
  if (risposta.tipo === 'debito' || risposta.tipo === 'scadenze') {
    const elenco = risposta.tipo === 'debito' ? risposta.aperte : risposta.scadenze;
    const totale = elenco.reduce((t, s) => t + Number(s.importo || 0), 0);
    return (
      <>
        <p className="pp-frase">{risposta.frase || `${elenco.length} scadenze aperte, ${euro(totale)}${risposta.scadute ? `, di cui ${risposta.scadute} già scadute` : ''}.`}</p>
        {elenco.length > 0 && <div className="pp-gruppo">{elenco.map((s) => <RigaScadenza key={s.id} s={s} onPagata={pagata} onApriDoc={apriDoc} />)}</div>}
        {risposta.documenti?.length > 0 && <Sezione titolo="Documenti"><div className="pp-gruppo">{risposta.documenti.slice(0, 30).map((d) => <RigaDocumento key={d.id} doc={d} onApri={apriDoc} />)}</div></Sezione>}
      </>
    );
  }
  if (risposta.tipo === 'pratiche') return <ElencoPratiche elenco={risposta.pratiche} onApri={apriPratica} />;
  return (
    <>
      <p className="pp-frase">{risposta.documenti.length ? `${risposta.documenti.length} documenti${risposta.titolo ? ` · ${risposta.titolo}` : ''}` : 'Nessun documento trovato.'}</p>
      {risposta.documenti.length > 0 && <div className="pp-gruppo">{risposta.documenti.map((d) => <RigaDocumento key={d.id} doc={d} onApri={apriDoc} />)}</div>}
    </>
  );
}

function VistaDocumenti({ ctx }) {
  const { esegui, versione } = ctx;
  const [fascicoli, setFascicoli] = useState([]);
  const [domanda, setDomanda] = useState('');
  const [risposta, setRisposta] = useState(null);
  const [aperto, setAperto] = useState(null);
  useEffect(() => { esegui(async () => setFascicoli(await conteggiFascicoli(archivioDb))); }, [esegui, versione]);

  const cerca = (testo) => {
    if (!testo.trim()) { setRisposta(null); return; }
    esegui(async () => { setAperto(null); setRisposta(await rispondi(archivioDb, testo)); });
  };
  const apriFascicolo = (f) => esegui(async () => {
    setAperto(f); setRisposta({ tipo: 'documenti', titolo: f.nome, documenti: await cercaDocumenti(archivioDb, '', f.codice, 200) });
  });

  return (
    <>
      <form className="pp-cerca" onSubmit={(e) => { e.preventDefault(); cerca(domanda); }}>
        <IconaCerca size={18} />
        <input type="search" value={domanda} onChange={(e) => { setDomanda(e.target.value); if (!e.target.value) setRisposta(null); }} placeholder="Cerca o chiedi: “quanto devo a Edison?”" enterKeyHint="search" aria-label="Cerca nell'archivio" />
      </form>
      {risposta ? (
        <>
          <button className="pp-indietro" onClick={() => { setRisposta(null); setAperto(null); setDomanda(''); }}><IconaIndietro size={16} /> Fascicoli</button>
          {aperto && <h2 className="pp-titolo-fascicolo" style={{ '--c': colore(aperto.codice) }}>{aperto.nome}</h2>}
          <Risultato risposta={risposta} ctx={ctx} />
        </>
      ) : (
        <>
          <div className="pp-suggerimenti">
            {['Scadenze di questo mese', 'Cosa devo fare?', 'Bollette', 'Le mie pratiche'].map((e) => (
              <button key={e} className="pp-chip" onClick={() => { setDomanda(e); cerca(e); }}>{e}</button>
            ))}
          </div>
          <div className="pp-griglia">
            {fascicoli.filter((f) => f.n > 0).map((f) => (
              <button key={f.codice} className="pp-cartella" style={{ '--c': colore(f.codice) }} onClick={() => apriFascicolo(f)}>
                <span className="pp-cartella-icona"><IconaDocumenti size={20} /></span>
                <span className="pp-cartella-nome">{f.nome}</span>
                <span className="pp-cartella-numero">{f.n}{f.n_azioni ? <em> · {f.n_azioni} da fare</em> : null}</span>
              </button>
            ))}
          </div>
          {!fascicoli.some((f) => f.n > 0) && <Vuoto>Ancora nessun documento.</Vuoto>}
        </>
      )}
    </>
  );
}

/* ---------- Portafoglio ---------- */
function VistaPortafoglio({ ctx }) {
  const { esegui, apriDoc, apriCarica, versione } = ctx;
  const [elenco, setElenco] = useState(null);
  useEffect(() => { esegui(async () => setElenco(await caricaPortafoglio(archivioDb))); }, [esegui, versione]);
  if (!elenco) return null;
  return (
    <>
      <p className="pp-intro">Documenti sempre a portata di mano: carta d'identità, patente, tessera sanitaria, codice fiscale, polizze.</p>
      <div className="pp-carte">
        {elenco.map((d) => (
          <button key={d.id} className="pp-carta" style={{ '--c': colore(d.fascicolo) }} onClick={() => apriDoc(d)}>
            <span className="pp-carta-tipo">{d.tipo_documento || d.fascicolo}</span>
            <span className="pp-carta-titolo">{titoloDoc(d)}</span>
            <span className="pp-carta-piede">{dataBreve(d.data_documento || d.email_data)}</span>
          </button>
        ))}
        <button className="pp-carta pp-carta-nuova" onClick={() => apriCarica({ portafoglio: true, fascicolo: 'identita' })}>
          <IconaPiu size={26} />
          <span>Aggiungi un documento</span>
        </button>
      </div>
    </>
  );
}

/* ---------- Pratiche ---------- */
function ElencoPratiche({ elenco, onApri }) {
  if (!elenco.length) return <Vuoto>Nessuna pratica.</Vuoto>;
  return (
    <div className="pp-gruppo">
      {elenco.map((p) => (
        <button key={p.id} className="pp-riga" onClick={() => onApri(p)}>
          <span className="pp-riga-icona" style={{ '--c': colore(p.fascicolo) }}><IconaPratiche size={18} /></span>
          <span className="pp-riga-testo">
            <span className="pp-riga-titolo">{p.titolo}</span>
            <span className="pp-riga-meta">{[`${p.n_documenti} documenti`, p.prossima_scadenza && `scade ${dataBreve(p.prossima_scadenza)}`].filter(Boolean).join(' · ')}</span>
          </span>
          {p.urgenza === 'alta' && <span className="pp-pallino pp-alta" aria-label="Urgente" />}
          <IconaFreccia size={16} />
        </button>
      ))}
    </div>
  );
}

function VistaPratiche({ ctx }) {
  const { esegui, apriPratica, versione } = ctx;
  const [filtro, setFiltro] = useState('aperte');
  const [elenco, setElenco] = useState([]);
  useEffect(() => { esegui(async () => setElenco(await caricaPratiche(archivioDb))); }, [esegui, versione]);
  const visibili = elenco.filter((p) => (filtro === 'aperte' ? ['aperta', 'in_corso'].includes(p.stato) : filtro === 'risolte' ? p.stato === 'risolta' : true));
  return (
    <>
      <div className="pp-segmenti">
        {[['aperte', 'Aperte'], ['risolte', 'Risolte'], ['tutte', 'Tutte']].map(([k, l]) => (
          <button key={k} className={filtro === k ? 'attivo' : ''} onClick={() => setFiltro(k)}>{l}</button>
        ))}
      </div>
      <ElencoPratiche elenco={visibili} onApri={apriPratica} />
    </>
  );
}

/* ---------- fogli (dettaglio, pratica, caricamento) ---------- */
function Foglio({ titolo, onChiudi, children }) {
  useEffect(() => {
    const esc = (e) => e.key === 'Escape' && onChiudi();
    document.addEventListener('keydown', esc);
    document.body.classList.add('pp-bloccato');
    return () => { document.removeEventListener('keydown', esc); document.body.classList.remove('pp-bloccato'); };
  }, [onChiudi]);
  return (
    <div className="pp-velo" onClick={onChiudi}>
      <div className="pp-foglio" role="dialog" aria-modal="true" aria-label={titolo} onClick={(e) => e.stopPropagation()}>
        <div className="pp-foglio-maniglia" />
        <div className="pp-foglio-testa">
          <span>{titolo}</span>
          <button className="pp-icona-bottone" onClick={onChiudi} aria-label="Chiudi"><IconaChiudi size={20} /></button>
        </div>
        <div className="pp-foglio-corpo">{children}</div>
      </div>
    </div>
  );
}

function DettaglioDocumento({ id, fascicoli, ctx, onChiudi }) {
  const { esegui, pagata, aggiorna, mostra } = ctx;
  const [doc, setDoc] = useState(null);
  const [conferma, setConferma] = useState(false);
  const carica = useCallback(() => esegui(async () => setDoc(await documentoCompleto(archivioDb, id))), [esegui, id]);
  useEffect(() => { carica(); }, [carica]);
  if (!doc) return <Foglio titolo="Documento" onChiudi={onChiudi}><p className="pp-vuoto">Carico…</p></Foglio>;

  const dati = Object.entries(doc.dati_estratti || {}).filter(([, v]) => v !== null && v !== '' && typeof v !== 'object');
  const portafoglio = nelPortafoglio(doc);
  const cambia = (fn, messaggio) => esegui(async () => { await fn(); await carica(); aggiorna(); if (messaggio) mostra(messaggio); });

  return (
    <Foglio titolo={fascicoli.find((f) => f.codice === doc.fascicolo)?.nome || 'Documento'} onChiudi={onChiudi}>
      <div className="pp-dettaglio-testa" style={{ '--c': colore(doc.fascicolo) }}>
        <span className="pp-etichetta">{doc.tipo_documento || doc.fascicolo}</span>
        <h2>{titoloDoc(doc)}</h2>
        <p className="pp-riga-meta">{[dataBreve(doc.data_documento || doc.email_data), doc.importo != null ? euro(doc.importo) : null].filter(Boolean).join(' · ')}</p>
      </div>
      <div className="pp-azioni">
        {doc.drive_url && <a className="pp-bottone" href={doc.drive_url} target="_blank" rel="noreferrer"><IconaApri size={18} /> Apri il file</a>}
        {!eCaricato(doc) && doc.gmail_message_id && <a className="pp-bottone pp-bottone-chiaro" href={`https://mail.google.com/mail/u/0/#all/${doc.gmail_message_id}`} target="_blank" rel="noreferrer"><IconaEmail size={18} /> Email</a>}
        <button className={`pp-bottone pp-bottone-chiaro${portafoglio ? ' pp-attivo' : ''}`} onClick={() => cambia(() => impostaPortafoglio(archivioDb, doc, !portafoglio), portafoglio ? 'Tolto dal portafoglio' : 'Aggiunto al portafoglio')}>
          <IconaStella size={18} piena={portafoglio} /> {portafoglio ? 'Nel portafoglio' : 'Portafoglio'}
        </button>
      </div>
      {doc.fascicolo === 'clinico_pazienti' && <p className="pp-avviso">Documento di un paziente: archiviato senza leggerne il contenuto.</p>}
      {doc.azione_richiesta && <p className={`pp-avviso pp-avviso-${doc.urgenza || 'media'}`}><strong>Da fare:</strong> {doc.azione_descrizione || 'azione richiesta'}</p>}
      {doc.riassunto && <p className="pp-paragrafo">{doc.riassunto}</p>}
      {doc.scadenze?.length > 0 && (
        <Sezione titolo="Scadenze">
          <div className="pp-gruppo">
            {doc.scadenze.map((s) => (
              <div key={s.id} className={`pp-scadenza${!s.completata && s.data < oggiIso() ? ' pp-scadenza-scaduta' : ''}`}>
                <span className="pp-scadenza-icona"><IconaCalendario size={18} /></span>
                <span className="pp-scadenza-testo"><span className="pp-riga-titolo">{s.descrizione}</span><span className="pp-riga-meta">{dataBreve(s.data)}{s.completata ? ' · fatta' : ` · ${quando(s.data)}`}</span></span>
                <div className="pp-scadenza-destra">
                  {s.importo != null && <span className="pp-riga-importo">{euro(s.importo)}</span>}
                  {!s.completata && <button className="pp-chip-azione" onClick={async () => { await pagata(s); carica(); }}>Fatta</button>}
                </div>
              </div>
            ))}
          </div>
        </Sezione>
      )}
      {doc.pratica && <Sezione titolo="Pratica"><div className="pp-gruppo"><button className="pp-riga" onClick={() => ctx.apriPratica(doc.pratica)}><span className="pp-riga-icona" style={{ '--c': colore(doc.fascicolo) }}><IconaPratiche size={18} /></span><span className="pp-riga-testo"><span className="pp-riga-titolo">{doc.pratica.titolo}</span><span className="pp-riga-meta">{doc.pratica.stato}</span></span><IconaFreccia size={16} /></button></div></Sezione>}
      {dati.length > 0 && (
        <Sezione titolo="Dati">
          <dl className="pp-dati">{dati.map(([k, v]) => <div key={k}><dt>{k.replace(/_/g, ' ')}</dt><dd>{String(v)}</dd></div>)}</dl>
        </Sezione>
      )}
      <Sezione titolo="Fascicolo">
        <select className="pp-select" value={doc.fascicolo} onChange={(e) => cambia(() => spostaFascicolo(archivioDb, doc.id, e.target.value), 'Spostato')}>
          {fascicoli.map((f) => <option key={f.codice} value={f.codice}>{f.nome}</option>)}
        </select>
      </Sezione>
      <p className="pp-riga-meta pp-origine">{eCaricato(doc) ? `Caricato da te il ${dataBreve(doc.creato_il)}` : `Da: ${doc.email_mittente || '—'} · ${doc.email_oggetto || ''}`}</p>
      <div className="pp-elimina">
        {!conferma
          ? <button className="pp-testo-link pp-rosso" onClick={() => setConferma(true)}><IconaCestino size={16} /> Elimina dall'archivio</button>
          : (
            <div className="pp-conferma">
              <span>Eliminare per sempre dall'archivio? Il file su Drive resta.</span>
              <button className="pp-bottone pp-bottone-rosso" onClick={() => esegui(async () => { await eliminaDocumento(archivioDb, doc.id); aggiorna(); mostra('Eliminato dall\'archivio'); onChiudi(); })}>Elimina</button>
              <button className="pp-bottone pp-bottone-chiaro" onClick={() => setConferma(false)}>Annulla</button>
            </div>
          )}
      </div>
    </Foglio>
  );
}

function DettaglioPratica({ pratica, ctx, onChiudi }) {
  const { esegui, apriDoc, aggiorna } = ctx;
  const [documenti, setDocumenti] = useState([]);
  const [stato, setStato] = useState(pratica.stato);
  useEffect(() => { esegui(async () => setDocumenti(await documentiDellaPratica(archivioDb, pratica.id))); }, [esegui, pratica.id]);
  return (
    <Foglio titolo="Pratica" onChiudi={onChiudi}>
      <div className="pp-dettaglio-testa" style={{ '--c': colore(pratica.fascicolo) }}>
        <span className="pp-etichetta">{stato}</span>
        <h2>{pratica.titolo}</h2>
        {pratica.note && <p className="pp-riga-meta">{pratica.note}</p>}
      </div>
      {stato !== 'risolta' && (
        <div className="pp-azioni">
          <button className="pp-bottone" onClick={() => esegui(async () => { await cambiaStatoPratica(archivioDb, pratica.id, 'risolta'); setStato('risolta'); aggiorna(); })}>Segna risolta</button>
        </div>
      )}
      <Sezione titolo={`${documenti.length} documenti`}>
        <div className="pp-gruppo">{documenti.map((d) => <RigaDocumento key={d.id} doc={d} onApri={apriDoc} />)}</div>
      </Sezione>
    </Foglio>
  );
}

function Carica({ opzioni, fascicoli, ctx, onChiudi }) {
  const { aggiorna, mostra, apriDoc } = ctx;
  const [file, setFile] = useState(null);
  const [anteprima, setAnteprima] = useState(null);
  const [descrizione, setDescrizione] = useState('');
  const [fascicolo, setFascicolo] = useState(opzioni.fascicolo || '');
  const [tieni, setTieni] = useState(!!opzioni.portafoglio);
  const [nonAnalizzare, setNonAnalizzare] = useState(false);
  const [stato, setStato] = useState(null);
  const fotocamera = useRef(null);
  const archivio = useRef(null);

  useEffect(() => () => anteprima && URL.revokeObjectURL(anteprima), [anteprima]);
  const scegli = (f) => {
    if (!f) return;
    setFile(f); setStato(null);
    setAnteprima(f.type.startsWith('image/') ? URL.createObjectURL(f) : null);
  };
  const invia = async () => {
    setStato({ invio: true, testo: 'Preparo il file…' });
    try {
      const pronto = await preparaFile(file);
      setStato({ invio: true, testo: nonAnalizzare ? 'Salvo su Drive…' : 'Salvo su Drive e leggo il documento…' });
      const { data } = await archivioDb.auth.getSession();
      const r = await caricaDocumento({ token: data.session?.access_token, ...pronto, descrizione, fascicolo, portafoglio: tieni, nonAnalizzare });
      aggiorna();
      mostra(r.duplicato ? 'Era già in archivio' : `Archiviato: ${r.titolo}`);
      onChiudi();
      if (r.id) apriDoc({ id: r.id });
    } catch (e) {
      setStato({ errore: true, testo: e.message });
    }
  };

  return (
    <Foglio titolo="Carica un documento" onChiudi={onChiudi}>
      <input ref={fotocamera} type="file" accept="image/*" capture="environment" hidden onChange={(e) => scegli(e.target.files[0])} />
      <input ref={archivio} type="file" accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx" hidden onChange={(e) => scegli(e.target.files[0])} />
      {!file ? (
        <div className="pp-sorgenti">
          <button className="pp-sorgente" onClick={() => fotocamera.current.click()}><IconaFotocamera size={28} /><span>Scatta una foto</span></button>
          <button className="pp-sorgente" onClick={() => archivio.current.click()}><IconaFile size={28} /><span>Scegli foto o PDF</span></button>
        </div>
      ) : (
        <div className="pp-scelto">
          {anteprima ? <img src={anteprima} alt="" /> : <span className="pp-scelto-icona"><IconaFile size={28} /></span>}
          <div><strong>{file.name}</strong><span className="pp-riga-meta">{(file.size / 1048576).toFixed(1)} MB</span></div>
          <button className="pp-testo-link" onClick={() => { setFile(null); setAnteprima(null); }}>Cambia</button>
        </div>
      )}
      <label className="pp-campo"><span>Cos'è (facoltativo)</span>
        <input value={descrizione} onChange={(e) => setDescrizione(e.target.value)} placeholder="Es. Carta d'identità Luca, fronte e retro" />
      </label>
      <label className="pp-campo"><span>Fascicolo</span>
        <select className="pp-select" value={fascicolo} onChange={(e) => setFascicolo(e.target.value)}>
          <option value="">Scegli in automatico</option>
          {fascicoli.map((f) => <option key={f.codice} value={f.codice}>{f.nome}</option>)}
        </select>
      </label>
      <label className="pp-interruttore"><input type="checkbox" checked={tieni} onChange={(e) => setTieni(e.target.checked)} /><span>Tienilo nel Portafoglio</span></label>
      <label className="pp-interruttore"><input type="checkbox" checked={nonAnalizzare} onChange={(e) => setNonAnalizzare(e.target.checked)} /><span>Non leggere il contenuto (solo archiviazione)</span></label>
      <p className="pp-riga-meta">Il file va nel tuo Google Drive, cartella "Archivio personale/Caricati". I documenti dei pazienti non vengono mai letti.</p>
      <button className="pp-bottone pp-bottone-largo" disabled={!file || stato?.invio} onClick={invia}>{stato?.invio ? stato.testo : 'Archivia'}</button>
      {stato?.errore && <p className="pp-messaggio pp-messaggio-errore">{stato.testo}</p>}
    </Foglio>
  );
}

/* ---------- app ---------- */
const VISTE = [
  ['oggi', 'Oggi', IconaOggi],
  ['documenti', 'Documenti', IconaDocumenti],
  ['carica', 'Carica', IconaPiu],
  ['portafoglio', 'Portafoglio', IconaPortafoglio],
  ['pratiche', 'Pratiche', IconaPratiche],
];
const TITOLI = { oggi: saluto(), documenti: 'Documenti', portafoglio: 'Portafoglio', pratiche: 'Pratiche' };

function Archivio() {
  const [vista, setVistaStato] = useState(leggiVista);
  const [errore, setErrore] = useState(null);
  const [toast, setToast] = useState(null);
  const [occupato, setOccupato] = useState(0);
  const [versione, setVersione] = useState(0);
  const [fascicoli, setFascicoli] = useState([]);
  const [docAperto, setDocAperto] = useState(null);
  const [praticaAperta, setPraticaAperta] = useState(null);
  const [carica, setCarica] = useState(null);

  const setVista = (v) => { setVistaStato(v); try { localStorage.setItem(VISTA_KEY, v); } catch { /* facoltativo */ } window.scrollTo(0, 0); };
  const esegui = useCallback(async (fn) => {
    setErrore(null); setOccupato((n) => n + 1);
    try { await fn(); } catch (e) { setErrore(e.message || String(e)); } finally { setOccupato((n) => n - 1); }
  }, []);
  const aggiorna = useCallback(() => setVersione((v) => v + 1), []);
  const mostra = useCallback((t) => { setToast(t); setTimeout(() => setToast(null), 2600); }, []);
  useEffect(() => { conteggiFascicoli(archivioDb).then(setFascicoli).catch(() => {}); }, [versione]);

  const ctx = {
    esegui, aggiorna, mostra, versione,
    apriDoc: (d) => { setPraticaAperta(null); setDocAperto(d.id); },
    apriPratica: (p) => { setDocAperto(null); setPraticaAperta(p); },
    apriCarica: (o = {}) => setCarica(o),
    pagata: (s) => esegui(async () => { await segnaScadenza(archivioDb, s.id, true); aggiorna(); mostra('Scadenza segnata come fatta'); }),
  };

  return (
    <div className="pp-app">
      <header className="pp-testata">
        <h1>{TITOLI[vista]}</h1>
        <button className="pp-icona-bottone" onClick={() => archivioDb.auth.signOut()} aria-label="Esci"><IconaEsci size={20} /></button>
      </header>
      {occupato > 0 && <div className="pp-barra-caricamento" aria-hidden="true" />}
      {errore && <p className="pp-messaggio pp-messaggio-errore" role="alert">{errore}</p>}
      <main className="pp-contenuto">
        {vista === 'oggi' && <VistaOggi ctx={ctx} />}
        {vista === 'documenti' && <VistaDocumenti ctx={ctx} />}
        {vista === 'portafoglio' && <VistaPortafoglio ctx={ctx} />}
        {vista === 'pratiche' && <VistaPratiche ctx={ctx} />}
      </main>
      <nav className="pp-schede" aria-label="Sezioni">
        {VISTE.map(([k, l, Icona]) => (k === 'carica'
          ? <button key={k} className="pp-scheda-carica" onClick={() => setCarica({})} aria-label="Carica un documento"><Icona size={26} /></button>
          : (
            <button key={k} className={`pp-scheda${vista === k ? ' attiva' : ''}`} onClick={() => setVista(k)} aria-current={vista === k ? 'page' : undefined}>
              <Icona size={22} /><span>{l}</span>
            </button>
          )))}
      </nav>
      {docAperto && <DettaglioDocumento key={docAperto} id={docAperto} fascicoli={fascicoli} ctx={ctx} onChiudi={() => setDocAperto(null)} />}
      {praticaAperta && <DettaglioPratica pratica={praticaAperta} ctx={ctx} onChiudi={() => setPraticaAperta(null)} />}
      {carica && <Carica opzioni={carica} fascicoli={fascicoli} ctx={ctx} onChiudi={() => setCarica(null)} />}
      {toast && <div className="pp-toast" role="status">{toast}</div>}
    </div>
  );
}

export default function App() {
  const [sessione, setSessione] = useState(undefined);
  const [recupero, setRecupero] = useState(false);
  useEffect(() => {
    archivioDb.auth.getSession().then(({ data: d }) => setSessione(d.session));
    const { data: sub } = archivioDb.auth.onAuthStateChange((evento, s) => {
      if (evento === 'PASSWORD_RECOVERY') setRecupero(true);
      setSessione(s);
    });
    return () => sub.subscription.unsubscribe();
  }, []);
  if (sessione === undefined) return null;
  if (recupero && sessione) return <NuovaPassword onFatto={() => setRecupero(false)} />;
  return sessione ? <Archivio /> : <Accesso />;
}
