// POL-VITA-003 — Poliedron Personal: app per telefono dell'archivio personale.
// Dock: Oggi · Documenti · (+ carica) · Pagamenti · Personali. Ogni dettaglio si apre come pagina
// sopra la sezione, con "Indietro" in alto e il dock sempre visibile; chiudendo si torna dov'eri.
// Nessun modello AI nell'app: ricerca e risposte vengono dal Core deterministico (coreArchivio.js).
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { archivioDb } from './lib/supabasePersonal.js';
import {
  cercaDocumenti, conteggiFascicoli, eliminaDocumento, pratiche as caricaPratiche, documentiDellaPratica, rispondi,
  segnaScadenza, cambiaStatoPratica, documentiDaGestire, documentiRecenti, documentoCompleto, impostaPortafoglio,
  caricaDocumento, eCaricato, nelPortafoglio, anteprimaFile, pagamenti as caricaPagamenti, eliminaScadenza,
  aggiornaDocumento, documentiSezione, documentiPersonali, aggiornaScadenza, chiediPoliedron, partiRisposta,
} from './lib/archivio.js';
import { VistaAgenda, PaginaEvento, PaginaAppuntamento, ElencoGiorno } from './Agenda.jsx';
import { sessioneStudio, esciStudio, appuntamentiTra, impegniTra, studioDb } from './lib/studio.js';
import { oggi as oggiAgenda } from './lib/agenda.js';
import { euro } from './lib/coreArchivio.js';
import { preparaFile } from './lib/file.js';
import { IMPOSTAZIONI_PREDEFINITE, leggiImpostazioni, salvaImpostazioni, categoriaDi, personaDi, slug } from './lib/impostazioni.js';
import {
  IconaOggi, IconaDocumenti, IconaPortafoglio, IconaPratiche, IconaPiu, IconaCerca, IconaChiudi, IconaIndietro, IconaFreccia,
  IconaApri, IconaEmail, IconaCalendario, IconaFotocamera, IconaFile, IconaStella, IconaCestino, IconaEsci, IconaEuro, IconaImpostazioni, IconaChat, IconaInvia,
} from './Icone.jsx';


/* ---------- utilità ---------- */
const COLORI = {
  identita: '#1F4E79', immobili: '#8B5E34', successione: '#5B4B8A', conti: '#2E7D5B', fiscale: '#B7791F',
  previdenza: '#3C7AA0', utenze: '#5E8C31', riscaldamento: '#C2410C', studio_fornitori: '#2F7F84', studio_fatture_emesse: '#1E8A66',
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
const titoloDoc = (d) => d?.titolo || d?.nome_file_originale || d?.email_oggetto || 'Documento';
const saluto = () => { const h = new Date().getHours(); return h < 13 ? 'Buongiorno' : h < 18 ? 'Buon pomeriggio' : 'Buonasera'; };
const VISTA_KEY = 'poliedron-personal-vista';
const leggiVista = () => { try { return localStorage.getItem(VISTA_KEY) || 'oggi'; } catch { return 'oggi'; } };
// Indirizzo dell'app: personal.poliedrasoft.it (dominio proprio) oppure /poliedron/personal/ sul
// sito dello studio. Il link per la password riporta alla stessa pagina da cui è partito.
const INDIRIZZO_APP = () => `${location.origin}${location.pathname}`;
const tokenSessione = async () => (await archivioDb.auth.getSession()).data.session?.access_token;

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
      const { error } = await archivioDb.auth.resetPasswordForEmail(email.trim(), { redirectTo: INDIRIZZO_APP() });
      setStato(error ? { errore: true, testo: `Invio non riuscito: ${error.message}` } : { testo: 'Ti ho mandato un\'email. Aprila, tocca il link e scegli la password nella pagina che si apre. Poi torna qui ed entra con email e password.' });
    }
    setInvio(false);
  };

  return (
    <main className="pp-accesso">
      <div className="pp-accesso-marchio"><IconaPortafoglio size={30} /></div>
      <h1>Personal</h1>
      <p className="pp-accesso-sotto">Il tuo archivio: documenti, pagamenti e pratiche.</p>
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
        <button type="submit" className="pp-bottone pp-bottone-largo">Salva password</button>
      </form>
      {stato && <p className="pp-messaggio pp-messaggio-errore">{stato}</p>}
    </main>
  );
}

/* ---------- elementi comuni ---------- */
const Vuoto = ({ children }) => <p className="pp-vuoto">{children}</p>;
const Sezione = ({ titolo, azione, children }) => (
  <section className="pp-sezione">
    {(titolo || azione) && <div className="pp-sezione-testa">{titolo && <h2>{titolo}</h2>}{azione}</div>}
    {children}
  </section>
);
const Gruppo = ({ children }) => <div className="pp-gruppo">{children}</div>;

function RigaDocumento({ doc, onApri }) {
  return (
    <button className="pp-riga" onClick={() => onApri(doc)}>
      <span className="pp-riga-icona" style={{ '--c': colore(doc.fascicolo) }}><IconaFile size={18} /></span>
      <span className="pp-riga-testo">
        <span className="pp-riga-titolo">{titoloDoc(doc)}</span>
        <span className="pp-riga-meta">{[dataBreve(doc.data_documento || doc.email_data), doc.persona, eCaricato(doc) ? 'caricato da te' : null].filter(Boolean).join(' · ')}</span>
      </span>
      {doc.importo != null && <span className="pp-riga-importo">{euro(doc.importo)}</span>}
      {doc.azione_richiesta && <span className={`pp-pallino pp-${doc.urgenza || 'media'}`} aria-label="Da gestire" />}
      <IconaFreccia size={16} />
    </button>
  );
}

function RigaPagamento({ s, onApri, onPagato }) {
  const scaduto = !s.completata && s.data < oggiIso();
  const giorno = new Date(`${s.data}T12:00:00`);
  return (
    <div className={`pp-scadenza${scaduto ? ' pp-scadenza-scaduta' : ''}${s.completata ? ' pp-scadenza-fatta' : ''}`}>
      <button className="pp-scadenza-corpo" onClick={() => onApri(s)}>
        <span className="pp-scadenza-data">
          <span className="pp-scadenza-giorno">{giorno.getDate()}</span>
          <span className="pp-scadenza-mese">{giorno.toLocaleDateString('it-IT', { month: 'short' })}</span>
        </span>
        <span className="pp-scadenza-testo">
          <span className="pp-riga-titolo">{s.descrizione}</span>
          <span className="pp-riga-meta">{[s.completata ? 'pagato' : quando(s.data), s.pratica?.titolo || s.documento?.titolo].filter(Boolean).join(' · ')}</span>
        </span>
      </button>
      <div className="pp-scadenza-destra">
        {s.importo != null && <span className="pp-riga-importo">{euro(s.importo)}</span>}
        {onPagato && !s.completata && <button className="pp-chip-azione" onClick={() => onPagato(s)} aria-label={`Segna pagato: ${s.descrizione}`}>Pagato</button>}
      </div>
    </div>
  );
}

function Chips({ voci, attiva, onScegli }) {
  return (
    <div className="pp-chips" role="tablist">
      {voci.map(([id, nome]) => (
        <button key={id} role="tab" aria-selected={attiva === id} className={`pp-chip${attiva === id ? ' attiva' : ''}`} onClick={() => onScegli(id)}>{nome}</button>
      ))}
    </div>
  );
}

function Segmenti({ voci, attiva, onScegli }) {
  return (
    <div className="pp-segmenti">
      {voci.map(([k, l]) => <button key={k} className={attiva === k ? 'attivo' : ''} onClick={() => onScegli(k)}>{l}</button>)}
    </div>
  );
}

function Conferma({ testo, etichetta = 'Elimina', onSi, onNo }) {
  return (
    <div className="pp-conferma" role="alertdialog">
      <span>{testo}</span>
      <button className="pp-bottone pp-bottone-rosso" onClick={onSi}>{etichetta}</button>
      <button className="pp-bottone pp-bottone-chiaro" onClick={onNo}>Annulla</button>
    </div>
  );
}

/* ---------- pagina sopra la sezione: Indietro in alto, dock visibile ---------- */
function Pagina({ titolo, onIndietro, visibile, children, azione }) {
  const corpo = useRef(null);
  return (
    <div className="pp-pagina" hidden={!visibile} aria-hidden={!visibile} ref={corpo}>
      <div className="pp-pagina-barra">
        <button className="pp-indietro" onClick={onIndietro}><IconaIndietro size={20} /><span>Indietro</span></button>
        <span className="pp-pagina-titolo">{titolo}</span>
        <span className="pp-pagina-azione">{azione}</span>
      </div>
      <div className="pp-pagina-corpo">{children}</div>
    </div>
  );
}

/* ---------- anteprima del file ---------- */
const tipoAnteprima = (doc) => {
  const nome = `${doc?.nome_file_originale || ''}`.toLowerCase();
  const mime = `${doc?.mime_type || ''}`.toLowerCase();
  if (mime === 'application/pdf' || nome.endsWith('.pdf')) return 'pdf';
  if (/^image\/(jpeg|pjpeg|png|gif|webp)$/.test(mime) || /\.(jpe?g|png|gif|webp)$/.test(nome)) return 'immagine';
  return null;
};

async function disegnaPdf(base64, contenitore) {
  const [pdfjs, worker] = await Promise.all([
    import('pdfjs-dist/legacy/build/pdf.js'),
    import('pdfjs-dist/legacy/build/pdf.worker.min.js?url'),
  ]);
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
  const byte = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
  const pdf = await pdfjs.getDocument({ data: byte }).promise;
  const larghezza = contenitore.clientWidth || 340;
  const scalaSchermo = Math.min(window.devicePixelRatio || 1, 2);
  contenitore.innerHTML = '';
  for (let n = 1; n <= Math.min(pdf.numPages, 8); n += 1) {
    const pagina = await pdf.getPage(n);
    const base = pagina.getViewport({ scale: 1 });
    const vista = pagina.getViewport({ scale: (larghezza / base.width) * scalaSchermo });
    const canvas = document.createElement('canvas');
    canvas.width = vista.width; canvas.height = vista.height;
    canvas.style.width = '100%';
    contenitore.appendChild(canvas);
    await pagina.render({ canvasContext: canvas.getContext('2d'), viewport: vista }).promise;
  }
  return pdf.numPages;
}

function Anteprima({ doc }) {
  const tipo = tipoAnteprima(doc);
  const [stato, setStato] = useState({ fase: 'carico' });
  const pagine = useRef(null);
  useEffect(() => {
    if (!tipo || !doc.drive_file_id) return undefined;
    let vivo = true;
    (async () => {
      try {
        const file = await anteprimaFile({ token: await tokenSessione(), driveFileId: doc.drive_file_id });
        if (!vivo) return;
        if (tipo === 'immagine') { setStato({ fase: 'immagine', src: `data:${file.mime};base64,${file.dati}` }); return; }
        setStato({ fase: 'pdf' });
        const n = await disegnaPdf(file.dati, pagine.current);
        if (vivo) setStato({ fase: 'pdf', pagine: n });
      } catch (e) {
        if (vivo) setStato({ fase: 'errore', testo: e.message });
      }
    })();
    return () => { vivo = false; };
  }, [tipo, doc.drive_file_id]);
  if (!tipo || !doc.drive_file_id) return null;
  return (
    <div className="pp-anteprima">
      {stato.fase === 'carico' && <div className="pp-anteprima-attesa"><span className="pp-rotella" />Carico l'anteprima…</div>}
      {stato.fase === 'errore' && <div className="pp-anteprima-attesa">{stato.testo} Usa "Apri il file".</div>}
      {stato.fase === 'immagine' && <img src={stato.src} alt={titoloDoc(doc)} />}
      <div ref={pagine} className="pp-anteprima-pdf" hidden={stato.fase !== 'pdf'} />
      {stato.fase === 'pdf' && stato.pagine > 8 && <p className="pp-riga-meta">Anteprima delle prime 8 pagine su {stato.pagine}. Apri il file per vederlo tutto.</p>}
    </div>
  );
}

/* ---------- Oggi ---------- */
function VistaOggi({ ctx }) {
  const [dati, setDati] = useState(null);
  const { esegui, apri, vai, pagato, versione } = ctx;
  useEffect(() => {
    esegui(async () => {
      const [tutte, daGestire, recenti, fascicoli] = await Promise.all([
        caricaPagamenti(archivioDb), documentiDaGestire(archivioDb), documentiRecenti(archivioDb, 8), conteggiFascicoli(archivioDb),
      ]);
      const limite = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
      const aperte = tutte.filter((s) => !s.completata);
      // Agenda di oggi, se l'agenda dello studio è collegata (altrimenti la sezione non compare).
      let agenda = null;
      if (await sessioneStudio().catch(() => null)) {
        const g = oggiAgenda();
        const [appuntamenti, impegni] = await Promise.all([appuntamentiTra(g, g), impegniTra(g, g)]).catch(() => [null, null]);
        if (appuntamenti) agenda = { appuntamenti, impegni, scadenze: tutte.filter((s) => s.data === g) };
      }
      setDati({ prossime: aperte.filter((s) => s.data <= limite), aperte, daGestire, recenti, agenda, totale: fascicoli.reduce((t, f) => t + Number(f.n || 0), 0) });
    });
  }, [esegui, versione]);
  if (!dati) return null;
  const scaduti = dati.aperte.filter((s) => s.data < oggiIso()).length;
  const agendaOggi = dati.agenda;
  const daPagare = dati.aperte.reduce((t, s) => t + Number(s.importo || 0), 0);
  return (
    <>
      <div className="pp-riassunto">
        <button className="pp-tessera pp-tessera-forte" onClick={() => vai('pagamenti')}>
          <span className="pp-tessera-numero">{dati.prossime.length}</span>
          <span>pagamenti entro 30 giorni{scaduti ? `, ${scaduti} ${scaduti === 1 ? 'scaduto' : 'scaduti'}` : ''}</span>
        </button>
        <button className="pp-tessera" onClick={() => vai('pagamenti')}>
          <span className="pp-tessera-numero">{euro(daPagare)}</span><span>da pagare in totale</span>
        </button>
        <button className="pp-tessera" onClick={() => apri({ tipo: 'elenco', titolo: 'Da gestire', carica: () => documentiDaGestire(archivioDb) })}>
          <span className="pp-tessera-numero">{dati.daGestire.length}</span><span>documenti da gestire</span>
        </button>
        <button className="pp-tessera" onClick={() => vai('documenti')}>
          <span className="pp-tessera-numero">{dati.totale}</span><span>documenti in archivio</span>
        </button>
      </div>
      {agendaOggi && (
        <Sezione titolo="Oggi in agenda" azione={<button className="pp-testo-link" onClick={() => vai('agenda')}>Agenda</button>}>
          <ElencoGiorno giorno={oggiAgenda()} dati={agendaOggi} ctx={ctx} etichette={ctx.impostazioni.etichette} coloriTipi={{}} intestazione={false} />
        </Sezione>
      )}
      <Sezione titolo="Prossimi pagamenti" azione={<button className="pp-testo-link" onClick={() => vai('pagamenti')}>Tutti</button>}>
        {dati.prossime.length
          ? <Gruppo>{dati.prossime.slice(0, 6).map((s) => <RigaPagamento key={s.id} s={s} onApri={(x) => apri({ tipo: 'pagamento', s: x })} onPagato={pagato} />)}</Gruppo>
          : <Vuoto>Nessun pagamento nei prossimi 30 giorni.</Vuoto>}
      </Sezione>
      <Sezione titolo="Da gestire">
        {dati.daGestire.length
          ? <Gruppo>{dati.daGestire.slice(0, 5).map((d) => <RigaDocumento key={d.id} doc={d} onApri={(x) => apri({ tipo: 'documento', id: x.id })} />)}</Gruppo>
          : <Vuoto>Niente da gestire.</Vuoto>}
      </Sezione>
      <Sezione titolo="Ultimi arrivati">
        {dati.recenti.length
          ? <Gruppo>{dati.recenti.map((d) => <RigaDocumento key={d.id} doc={d} onApri={(x) => apri({ tipo: 'documento', id: x.id })} />)}</Gruppo>
          : <Vuoto>L'archivio si sta riempiendo: lo script importa la posta ogni 10 minuti.</Vuoto>}
      </Sezione>
    </>
  );
}

/* ---------- Documenti ---------- */
function Risultato({ risposta, ctx }) {
  const { apri, pagato } = ctx;
  const apriDoc = (d) => apri({ tipo: 'documento', id: d.id });
  if (risposta.tipo === 'vuoto') return null;
  if (risposta.tipo === 'debito' || risposta.tipo === 'scadenze') {
    const elenco = risposta.tipo === 'debito' ? risposta.aperte : risposta.scadenze;
    const totale = elenco.reduce((t, s) => t + Number(s.importo || 0), 0);
    return (
      <>
        <p className="pp-frase">{risposta.frase || `${elenco.length} pagamenti aperti, ${euro(totale)}${risposta.scadute ? `, di cui ${risposta.scadute} già scaduti` : ''}.`}</p>
        {elenco.length > 0 && <Gruppo>{elenco.map((s) => <RigaPagamento key={s.id} s={s} onApri={(x) => apri({ tipo: 'pagamento', s: x })} onPagato={pagato} />)}</Gruppo>}
        {risposta.documenti?.length > 0 && <Sezione titolo="Documenti"><Gruppo>{risposta.documenti.slice(0, 30).map((d) => <RigaDocumento key={d.id} doc={d} onApri={apriDoc} />)}</Gruppo></Sezione>}
      </>
    );
  }
  if (risposta.tipo === 'pratiche') return <ElencoPratiche elenco={risposta.pratiche} onApri={(p) => apri({ tipo: 'pratica', p })} />;
  return (
    <>
      <p className="pp-frase">{risposta.documenti.length ? `${risposta.documenti.length} documenti${risposta.titolo ? ` · ${risposta.titolo}` : ''}` : 'Nessun documento trovato.'}</p>
      {risposta.documenti.length > 0 && <Gruppo>{risposta.documenti.map((d) => <RigaDocumento key={d.id} doc={d} onApri={apriDoc} />)}</Gruppo>}
    </>
  );
}

function ElencoPratiche({ elenco, onApri }) {
  if (!elenco.length) return <Vuoto>Nessuna pratica.</Vuoto>;
  return (
    <Gruppo>
      {elenco.map((p) => (
        <button key={p.id} className="pp-riga" onClick={() => onApri(p)}>
          <span className="pp-riga-icona" style={{ '--c': colore(p.fascicolo) }}><IconaPratiche size={18} /></span>
          <span className="pp-riga-testo">
            <span className="pp-riga-titolo">{p.titolo}</span>
            <span className="pp-riga-meta">{[`${p.n_documenti} documenti`, p.prossima_scadenza && `scade ${dataBreve(p.prossima_scadenza)}`, p.stato !== 'aperta' && p.stato].filter(Boolean).join(' · ')}</span>
          </span>
          {p.urgenza === 'alta' && <span className="pp-pallino pp-alta" aria-label="Urgente" />}
          <IconaFreccia size={16} />
        </button>
      ))}
    </Gruppo>
  );
}

function VistaDocumenti({ ctx }) {
  const { esegui, apri, versione, impostazioni, fascicoli } = ctx;
  const [sezione, setSezione] = useState('tutti');
  const [domanda, setDomanda] = useState('');
  const [risposta, setRisposta] = useState(null);
  const [elenco, setElenco] = useState(null);
  const [filtroPratiche, setFiltroPratiche] = useState('aperte');

  const sezioni = impostazioni.sezioni;
  const voci = [['tutti', 'Tutti'], ['pratiche', 'Pratiche'], ...sezioni.map((s) => [s.id, s.nome])];
  const attiva = voci.some(([id]) => id === sezione) ? sezione : 'tutti';

  useEffect(() => {
    setElenco(null);
    if (attiva === 'tutti') return;
    esegui(async () => {
      if (attiva === 'pratiche') setElenco(await caricaPratiche(archivioDb));
      else setElenco(await documentiSezione(archivioDb, sezioni.find((s) => s.id === attiva)));
    });
  }, [attiva, esegui, versione, sezioni]);

  const cerca = (testo) => {
    if (!testo.trim()) { setRisposta(null); return; }
    esegui(async () => setRisposta(await rispondi(archivioDb, testo)));
  };
  const apriFascicolo = (f) => apri({ tipo: 'elenco', titolo: f.nome, colore: colore(f.codice), carica: () => cercaDocumenti(archivioDb, '', f.codice, 300) });

  return (
    <>
      <form className="pp-cerca" onSubmit={(e) => { e.preventDefault(); cerca(domanda); e.target.querySelector('input')?.blur(); }}>
        <IconaCerca size={18} />
        <input type="search" value={domanda} onChange={(e) => { setDomanda(e.target.value); if (!e.target.value) setRisposta(null); }} placeholder="Cerca o chiedi: “quanto devo a Edison?”" enterKeyHint="search" aria-label="Cerca nell'archivio" />
        {domanda && <button type="button" className="pp-cerca-pulisci" aria-label="Cancella ricerca" onClick={() => { setDomanda(''); setRisposta(null); }}><IconaChiudi size={16} /></button>}
      </form>
      {risposta ? <Risultato risposta={risposta} ctx={ctx} /> : (
        <>
          <Chips voci={voci} attiva={attiva} onScegli={setSezione} />
          {attiva === 'tutti' && (
            <div className="pp-griglia">
              {fascicoli.filter((f) => f.n > 0).map((f) => (
                <button key={f.codice} className="pp-cartella" style={{ '--c': colore(f.codice) }} onClick={() => apriFascicolo(f)}>
                  <span className="pp-cartella-icona"><IconaDocumenti size={20} /></span>
                  <span className="pp-cartella-nome">{f.nome}</span>
                  <span className="pp-cartella-numero">{f.n}{f.n_azioni ? <em> · {f.n_azioni} da fare</em> : null}</span>
                </button>
              ))}
            </div>
          )}
          {attiva === 'pratiche' && elenco && (
            <>
              <Segmenti voci={[['aperte', 'Aperte'], ['risolte', 'Risolte'], ['tutte', 'Tutte']]} attiva={filtroPratiche} onScegli={setFiltroPratiche} />
              <ElencoPratiche
                elenco={elenco.filter((p) => (filtroPratiche === 'aperte' ? ['aperta', 'in_corso'].includes(p.stato) : filtroPratiche === 'risolte' ? p.stato === 'risolta' : true))}
                onApri={(p) => apri({ tipo: 'pratica', p })}
              />
            </>
          )}
          {attiva !== 'tutti' && attiva !== 'pratiche' && elenco && (
            elenco.length
              ? <><p className="pp-frase">{elenco.length} documenti</p><Gruppo>{elenco.map((d) => <RigaDocumento key={d.id} doc={d} onApri={(x) => apri({ tipo: 'documento', id: x.id })} />)}</Gruppo></>
              : <Vuoto>Ancora nessun documento in questa sezione. Puoi cambiarne le regole in Impostazioni.</Vuoto>
          )}
        </>
      )}
    </>
  );
}

/* ---------- Pagamenti ---------- */
function VistaPagamenti({ ctx }) {
  const { esegui, apri, pagato, versione } = ctx;
  const [tutti, setTutti] = useState(null);
  const [filtro, setFiltro] = useState('aperti');
  useEffect(() => { esegui(async () => setTutti(await caricaPagamenti(archivioDb))); }, [esegui, versione]);
  if (!tutti) return null;
  const aperti = tutti.filter((s) => !s.completata);
  const oggi = oggiIso();
  const tra30 = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
  const totale = aperti.reduce((t, s) => t + Number(s.importo || 0), 0);
  const scaduti = aperti.filter((s) => s.data < oggi);
  const apriP = (s) => apri({ tipo: 'pagamento', s });
  const gruppo = (titolo, elenco) => {
    if (!elenco.length) return null;
    const somma = elenco.reduce((t, s) => t + Number(s.importo || 0), 0);
    return (
    <Sezione key={titolo} titolo={titolo} azione={somma > 0 ? <span className="pp-riga-meta">{euro(somma)}</span> : null}>
      <Gruppo>{elenco.map((s) => <RigaPagamento key={s.id} s={s} onApri={apriP} onPagato={pagato} />)}</Gruppo>
    </Sezione>
    );
  };
  return (
    <>
      <div className="pp-riassunto">
        <div className="pp-tessera pp-tessera-forte"><span className="pp-tessera-numero">{euro(totale)}</span><span>da pagare</span></div>
        <div className="pp-tessera"><span className="pp-tessera-numero">{scaduti.length}</span><span>{scaduti.length === 1 ? 'pagamento scaduto' : 'pagamenti scaduti'}</span></div>
      </div>
      <Segmenti voci={[['aperti', 'Da pagare'], ['pagati', 'Pagati'], ['tutti', 'Tutti']]} attiva={filtro} onScegli={setFiltro} />
      {filtro === 'aperti' && (aperti.length ? [
        gruppo('Scaduti', scaduti),
        gruppo('Prossimi 30 giorni', aperti.filter((s) => s.data >= oggi && s.data <= tra30)),
        gruppo('Più avanti', aperti.filter((s) => s.data > tra30)),
      ] : <Vuoto>Nessun pagamento da fare.</Vuoto>)}
      {filtro === 'pagati' && (tutti.some((s) => s.completata)
        ? <Gruppo>{[...tutti].filter((s) => s.completata).reverse().map((s) => <RigaPagamento key={s.id} s={s} onApri={apriP} />)}</Gruppo>
        : <Vuoto>Nessun pagamento segnato come pagato.</Vuoto>)}
      {filtro === 'tutti' && (tutti.length
        ? <Gruppo>{[...tutti].reverse().map((s) => <RigaPagamento key={s.id} s={s} onApri={apriP} onPagato={pagato} />)}</Gruppo>
        : <Vuoto>Nessun pagamento in archivio.</Vuoto>)}
    </>
  );
}

/* ---------- Personali (carta d'identità, codice fiscale, ... per persona) ---------- */
function CartaDocumento({ doc, onApri, etichetta }) {
  return (
    <button className="pp-carta" style={{ '--c': colore(doc.fascicolo === 'identita' ? 'identita' : doc.fascicolo) }} onClick={() => onApri(doc)}>
      <span className="pp-carta-tipo">{etichetta || doc.tipo_documento || doc.fascicolo}</span>
      <span className="pp-carta-titolo">{titoloDoc(doc)}</span>
      <span className="pp-carta-piede">{[doc.persona, dataBreve(doc.data_documento || doc.email_data)].filter(Boolean).join(' · ')}</span>
    </button>
  );
}

function VistaPersonali({ ctx }) {
  const { esegui, apri, versione, impostazioni } = ctx;
  const { persone, categorie } = impostazioni;
  const [docs, setDocs] = useState(null);
  const [scheda, setScheda] = useState('tutti');
  useEffect(() => { esegui(async () => setDocs(await documentiPersonali(archivioDb))); }, [esegui, versione]);
  const arricchiti = useMemo(() => (docs || []).map((d) => ({ ...d, _cat: categoriaDi(d, categorie), _persona: personaDi(d, persone) })), [docs, categorie, persone]);
  if (!docs) return null;
  const attiva = scheda === 'tutti' || categorie.some((c) => c.id === scheda) ? scheda : 'tutti';
  const nomeCat = (id) => categorie.find((c) => c.id === id)?.nome;
  const apriDoc = (d) => apri({ tipo: 'documento', id: d.id });
  const aggiungi = (persona, categoria) => apri({ tipo: 'carica', opzioni: { persona, categoria, fascicolo: 'identita', portafoglio: true } });

  const perPersona = (persona, elenco) => (
    <Sezione key={persona || 'nessuno'} titolo={persona || 'Senza persona'}>
      <div className="pp-carte">
        {elenco.map((d) => <CartaDocumento key={d.id} doc={d} etichetta={nomeCat(d._cat)} onApri={apriDoc} />)}
        {persona && attiva !== 'tutti' && !elenco.length && (
          <button className="pp-carta pp-carta-nuova" onClick={() => aggiungi(persona, attiva)}><IconaPiu size={24} /><span>Aggiungi {nomeCat(attiva)}</span></button>
        )}
        {persona && attiva === 'tutti' && (
          <button className="pp-carta pp-carta-nuova pp-carta-bassa" onClick={() => aggiungi(persona, null)}><IconaPiu size={22} /><span>Aggiungi un documento</span></button>
        )}
      </div>
    </Sezione>
  );

  const filtrati = attiva === 'tutti' ? arricchiti : arricchiti.filter((d) => d._cat === attiva);
  const senzaPersona = filtrati.filter((d) => !d._persona || !persone.includes(d._persona));
  return (
    <>
      <Chips voci={[['tutti', 'Tutti'], ...categorie.map((c) => [c.id, c.nome])]} attiva={attiva} onScegli={setScheda} />
      {persone.map((p) => perPersona(p, filtrati.filter((d) => d._persona === p)))}
      {senzaPersona.length > 0 && perPersona(null, senzaPersona)}
      <p className="pp-riga-meta pp-nota-fondo">Persone e tipi di documento si cambiano in Impostazioni (icona in alto a destra).</p>
    </>
  );
}

/* ---------- pagine ---------- */
function PaginaDocumento({ id, ctx, chiudi }) {
  const { esegui, aggiorna, mostra, apri, pagato, impostazioni, fascicoli } = ctx;
  const [doc, setDoc] = useState(null);
  const [conferma, setConferma] = useState(false);
  const carica = useCallback(() => esegui(async () => setDoc(await documentoCompleto(archivioDb, id))), [esegui, id]);
  useEffect(() => { carica(); }, [carica]);
  if (!doc) return <Vuoto>Carico…</Vuoto>;

  const dati = Object.entries(doc.dati_estratti || {}).filter(([, v]) => v !== null && v !== '' && typeof v !== 'object');
  const portafoglio = nelPortafoglio(doc);
  const cambia = (fn, messaggio) => esegui(async () => { await fn(); await carica(); aggiorna(); if (messaggio) mostra(messaggio); });
  const persone = [...new Set([...impostazioni.persone, ...(doc.persona ? [doc.persona] : [])])];
  const categorie = impostazioni.categorie.some((c) => c.id === doc.categoria) || !doc.categoria ? impostazioni.categorie : [...impostazioni.categorie, { id: doc.categoria, nome: doc.categoria }];

  return (
    <>
      <Anteprima doc={doc} />
      <div className="pp-dettaglio-testa" style={{ '--c': colore(doc.fascicolo) }}>
        <span className="pp-etichetta">{doc.tipo_documento || fascicoli.find((f) => f.codice === doc.fascicolo)?.nome || doc.fascicolo}</span>
        <h2>{titoloDoc(doc)}</h2>
        <p className="pp-riga-meta">{[dataBreve(doc.data_documento || doc.email_data), doc.importo != null ? euro(doc.importo) : null, doc.persona].filter(Boolean).join(' · ')}</p>
      </div>
      <div className="pp-azioni">
        {doc.drive_url && <a className="pp-bottone" href={doc.drive_url} target="_blank" rel="noreferrer"><IconaApri size={18} /> Apri il file</a>}
        {!eCaricato(doc) && doc.gmail_message_id && <a className="pp-bottone pp-bottone-chiaro" href={`https://mail.google.com/mail/u/0/#all/${doc.gmail_message_id}`} target="_blank" rel="noreferrer"><IconaEmail size={18} /> Email</a>}
        <button className={`pp-bottone pp-bottone-chiaro${portafoglio ? ' pp-attivo' : ''}`} onClick={() => cambia(() => impostaPortafoglio(archivioDb, doc, !portafoglio), portafoglio ? 'Tolto dai Personali' : 'Aggiunto ai Personali')}>
          <IconaStella size={18} piena={portafoglio} /> {portafoglio ? 'Nei Personali' : 'Tieni a portata di mano'}
        </button>
      </div>
      {doc.fascicolo !== 'clinico_pazienti' && (
        <button className="pp-chiedi-doc" onClick={() => apri({ tipo: 'chat', documentoId: doc.id, titoloDoc: titoloDoc(doc) })}>
          <IconaChat size={18} /> Chiedi a Poliedron su questo documento
        </button>
      )}
      {doc.fascicolo === 'clinico_pazienti' && <p className="pp-avviso">Documento di un paziente: archiviato senza leggerne il contenuto.</p>}
      {doc.azione_richiesta && <p className={`pp-avviso pp-avviso-${doc.urgenza || 'media'}`}><strong>Da fare:</strong> {doc.azione_descrizione || 'azione richiesta'}</p>}
      {doc.riassunto && <p className="pp-paragrafo">{doc.riassunto}</p>}
      {doc.scadenze?.length > 0 && (
        <Sezione titolo="Pagamenti e scadenze">
          <Gruppo>{doc.scadenze.map((s) => <RigaPagamento key={s.id} s={{ ...s, documento: { id: doc.id, titolo: doc.titolo } }} onApri={(x) => apri({ tipo: 'pagamento', s: x })} onPagato={async (x) => { await pagato(x); carica(); }} />)}</Gruppo>
        </Sezione>
      )}
      {doc.pratica && (
        <Sezione titolo="Pratica">
          <Gruppo>
            <button className="pp-riga" onClick={() => apri({ tipo: 'pratica', p: { ...doc.pratica, fascicolo: doc.fascicolo } })}>
              <span className="pp-riga-icona" style={{ '--c': colore(doc.fascicolo) }}><IconaPratiche size={18} /></span>
              <span className="pp-riga-testo"><span className="pp-riga-titolo">{doc.pratica.titolo}</span><span className="pp-riga-meta">{doc.pratica.stato}</span></span>
              <IconaFreccia size={16} />
            </button>
          </Gruppo>
        </Sezione>
      )}
      <Sezione titolo="Documento personale">
        <div className="pp-campi">
          <label className="pp-campo-riga"><span>Persona</span>
            <select className="pp-select" value={doc.persona || ''} onChange={(e) => cambia(() => aggiornaDocumento(archivioDb, doc.id, { persona: e.target.value }), 'Salvato')}>
              <option value="">Nessuna</option>
              {persone.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </label>
          <label className="pp-campo-riga"><span>Tipo</span>
            <select className="pp-select" value={doc.categoria || ''} onChange={(e) => cambia(() => aggiornaDocumento(archivioDb, doc.id, { categoria: e.target.value }), 'Salvato')}>
              <option value="">Nessuno</option>
              {categorie.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
            </select>
          </label>
          <label className="pp-campo-riga"><span>Fascicolo</span>
            <select className="pp-select" value={doc.fascicolo} onChange={(e) => cambia(() => aggiornaDocumento(archivioDb, doc.id, { fascicolo: e.target.value }), 'Spostato')}>
              {fascicoli.map((f) => <option key={f.codice} value={f.codice}>{f.nome}</option>)}
            </select>
          </label>
        </div>
      </Sezione>
      {dati.length > 0 && (
        <Sezione titolo="Dati">
          <dl className="pp-dati">{dati.map(([k, v]) => <div key={k}><dt>{k.replace(/_/g, ' ')}</dt><dd>{String(v)}</dd></div>)}</dl>
        </Sezione>
      )}
      <p className="pp-riga-meta pp-origine">{eCaricato(doc) ? `Caricato da te il ${dataBreve(doc.creato_il)}` : `Da: ${doc.email_mittente || '—'} · ${doc.email_oggetto || ''}`}</p>
      <div className="pp-elimina">
        {!conferma
          ? <button className="pp-testo-link pp-rosso" onClick={() => setConferma(true)}><IconaCestino size={16} /> Elimina dall'archivio</button>
          : <Conferma testo="Eliminare per sempre dall'archivio? Il file su Drive resta." onNo={() => setConferma(false)}
            onSi={() => esegui(async () => { await eliminaDocumento(archivioDb, doc.id); aggiorna(); mostra('Eliminato dall\'archivio'); chiudi(); })} />}
      </div>
    </>
  );
}

function PaginaPagamento({ s: iniziale, ctx, chiudi }) {
  const { esegui, aggiorna, mostra, apri } = ctx;
  const [s, setS] = useState(iniziale);
  const [conferma, setConferma] = useState(false);
  const [modifica, setModifica] = useState(null);
  const scaduto = !s.completata && s.data < oggiIso();
  const salvaModifica = () => esegui(async () => {
    const r = await aggiornaScadenza(archivioDb, s.id, modifica);
    setS({ ...s, ...r }); setModifica(null); aggiorna(); mostra('Pagamento aggiornato');
  });
  const cambiaStato = (completata) => esegui(async () => {
    await segnaScadenza(archivioDb, s.id, completata);
    setS({ ...s, completata }); aggiorna(); mostra(completata ? 'Segnato come pagato' : 'Segnato da pagare');
  });
  return (
    <>
      <div className="pp-dettaglio-testa" style={{ '--c': s.completata ? '#067647' : scaduto ? '#B42318' : '#0c447c' }}>
        <span className="pp-etichetta">{s.completata ? 'Pagato' : scaduto ? 'Scaduto' : 'Da pagare'}</span>
        <h2>{s.descrizione}</h2>
        {s.importo != null && <p className="pp-importo-grande">{euro(s.importo)}</p>}
        <p className="pp-riga-meta"><IconaCalendario size={14} /> {dataBreve(s.data)}{!s.completata ? ` · ${quando(s.data)}` : ''}</p>
      </div>
      <div className="pp-azioni">
        {s.completata
          ? <button className="pp-bottone pp-bottone-chiaro" onClick={() => cambiaStato(false)}>Segna da pagare</button>
          : <button className="pp-bottone pp-bottone-verde" onClick={() => cambiaStato(true)}>Segna come pagato</button>}
        {!modifica && <button className="pp-bottone pp-bottone-chiaro" onClick={() => setModifica({ descrizione: s.descrizione, data: s.data, importo: s.importo ?? '' })}>Modifica</button>}
      </div>
      {modifica && (
        <div className="pp-modifica">
          <label className="pp-campo"><span>Descrizione</span><input value={modifica.descrizione} onChange={(e) => setModifica({ ...modifica, descrizione: e.target.value })} /></label>
          <div className="pp-due">
            <label className="pp-campo"><span>Data</span><input type="date" value={modifica.data} onChange={(e) => setModifica({ ...modifica, data: e.target.value })} /></label>
            <label className="pp-campo"><span>Importo (€)</span><input inputMode="decimal" value={modifica.importo} onChange={(e) => setModifica({ ...modifica, importo: e.target.value })} placeholder="nessuno" /></label>
          </div>
          <div className="pp-azioni">
            <button className="pp-bottone" onClick={salvaModifica} disabled={!modifica.descrizione.trim() || !modifica.data}>Salva</button>
            <button className="pp-bottone pp-bottone-chiaro" onClick={() => setModifica(null)}>Annulla</button>
          </div>
        </div>
      )}
      <Sezione titolo="Da dove viene">
        {s.documento || s.documento_id ? (
          <Gruppo>
            <button className="pp-riga" onClick={() => apri({ tipo: 'documento', id: s.documento?.id || s.documento_id })}>
              <span className="pp-riga-icona" style={{ '--c': colore(s.documento?.fascicolo) }}><IconaFile size={18} /></span>
              <span className="pp-riga-testo"><span className="pp-riga-titolo">{s.documento?.titolo || 'Documento di origine'}</span><span className="pp-riga-meta">Apri il documento</span></span>
              <IconaFreccia size={16} />
            </button>
          </Gruppo>
        ) : <Vuoto>Nessun documento collegato.</Vuoto>}
        {s.pratica && (
          <Gruppo>
            <button className="pp-riga" onClick={() => apri({ tipo: 'pratica', p: s.pratica })}>
              <span className="pp-riga-icona" style={{ '--c': colore(s.documento?.fascicolo) }}><IconaPratiche size={18} /></span>
              <span className="pp-riga-testo"><span className="pp-riga-titolo">{s.pratica.titolo}</span><span className="pp-riga-meta">Pratica</span></span>
              <IconaFreccia size={16} />
            </button>
          </Gruppo>
        )}
      </Sezione>
      <div className="pp-elimina">
        {!conferma
          ? <button className="pp-testo-link pp-rosso" onClick={() => setConferma(true)}><IconaCestino size={16} /> Elimina questo pagamento</button>
          : <Conferma testo="Eliminare questo pagamento? Il documento da cui deriva resta in archivio." onNo={() => setConferma(false)}
            onSi={() => esegui(async () => { await eliminaScadenza(archivioDb, s.id); aggiorna(); mostra('Pagamento eliminato'); chiudi(); })} />}
      </div>
    </>
  );
}

function PaginaPratica({ p, ctx }) {
  const { esegui, apri, aggiorna } = ctx;
  const [documenti, setDocumenti] = useState(null);
  const [stato, setStato] = useState(p.stato);
  useEffect(() => { esegui(async () => setDocumenti(await documentiDellaPratica(archivioDb, p.id))); }, [esegui, p.id]);
  return (
    <>
      <div className="pp-dettaglio-testa" style={{ '--c': colore(p.fascicolo) }}>
        <span className="pp-etichetta">{stato}</span>
        <h2>{p.titolo}</h2>
        {p.note && <p className="pp-riga-meta">{p.note}</p>}
      </div>
      {stato !== 'risolta' && (
        <div className="pp-azioni">
          <button className="pp-bottone" onClick={() => esegui(async () => { await cambiaStatoPratica(archivioDb, p.id, 'risolta'); setStato('risolta'); aggiorna(); })}>Segna risolta</button>
        </div>
      )}
      <Sezione titolo={documenti ? `${documenti.length} documenti` : 'Documenti'}>
        {documenti && <Gruppo>{documenti.map((d) => <RigaDocumento key={d.id} doc={d} onApri={(x) => apri({ tipo: 'documento', id: x.id })} />)}</Gruppo>}
      </Sezione>
    </>
  );
}

function PaginaElenco({ carica, colore: c, ctx }) {
  const { esegui, apri, versione } = ctx;
  const [elenco, setElenco] = useState(null);
  useEffect(() => { esegui(async () => setElenco(await carica())); }, [esegui, carica, versione]);
  if (!elenco) return null;
  return elenco.length
    ? <><p className="pp-frase" style={{ '--c': c }}>{elenco.length} documenti</p><Gruppo>{elenco.map((d) => <RigaDocumento key={d.id} doc={d} onApri={(x) => apri({ tipo: 'documento', id: x.id })} />)}</Gruppo></>
    : <Vuoto>Nessun documento.</Vuoto>;
}

function PaginaCarica({ opzioni, ctx, sostituisci }) {
  const { aggiorna, mostra, impostazioni, fascicoli } = ctx;
  const [file, setFile] = useState(null);
  const [anteprima, setAnteprima] = useState(null);
  const [descrizione, setDescrizione] = useState('');
  const [fascicolo, setFascicolo] = useState(opzioni.fascicolo || '');
  const [persona, setPersona] = useState(opzioni.persona || '');
  const [categoria, setCategoria] = useState(opzioni.categoria || '');
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
      const r = await caricaDocumento({ token: await tokenSessione(), ...pronto, descrizione, fascicolo, portafoglio: tieni, nonAnalizzare, persona, categoria });
      aggiorna();
      mostra(r.duplicato ? 'Era già in archivio' : `Archiviato: ${r.titolo}`);
      if (r.id) sostituisci({ tipo: 'documento', id: r.id });
    } catch (e) {
      setStato({ errore: true, testo: e.message });
    }
  };

  return (
    <>
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
        <input value={descrizione} onChange={(e) => setDescrizione(e.target.value)} placeholder="Es. Carta d'identità, fronte e retro" />
      </label>
      <div className="pp-due">
        <label className="pp-campo"><span>Persona</span>
          <select className="pp-select" value={persona} onChange={(e) => setPersona(e.target.value)}>
            <option value="">Nessuna</option>
            {impostazioni.persone.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </label>
        <label className="pp-campo"><span>Tipo</span>
          <select className="pp-select" value={categoria} onChange={(e) => setCategoria(e.target.value)}>
            <option value="">Nessuno</option>
            {impostazioni.categorie.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
          </select>
        </label>
      </div>
      <label className="pp-campo"><span>Fascicolo</span>
        <select className="pp-select" value={fascicolo} onChange={(e) => setFascicolo(e.target.value)}>
          <option value="">Scegli in automatico</option>
          {fascicoli.map((f) => <option key={f.codice} value={f.codice}>{f.nome}</option>)}
        </select>
      </label>
      <label className="pp-interruttore"><input type="checkbox" checked={tieni} onChange={(e) => setTieni(e.target.checked)} /><span>Tieni a portata di mano (Personali)</span></label>
      <label className="pp-interruttore"><input type="checkbox" checked={nonAnalizzare} onChange={(e) => setNonAnalizzare(e.target.checked)} /><span>Non leggere il contenuto (solo archiviazione)</span></label>
      <p className="pp-riga-meta">Il file va nel tuo Google Drive, cartella "Archivio personale/Caricati". I documenti dei pazienti non vengono mai letti.</p>
      <button className="pp-bottone pp-bottone-largo" disabled={!file || stato?.invio} onClick={invia}>{stato?.invio ? stato.testo : 'Archivia'}</button>
      {stato?.errore && <p className="pp-messaggio pp-messaggio-errore">{stato.testo}</p>}
    </>
  );
}

function ListaModificabile({ voci, onTogli, onAggiungi, segnaposto }) {
  const [nuovo, setNuovo] = useState('');
  return (
    <Gruppo>
      {voci.map((v) => (
        <div key={v.id} className="pp-voce">
          <span>{v.nome}</span>
          <button className="pp-icona-bottone pp-piccolo" aria-label={`Togli ${v.nome}`} onClick={() => onTogli(v.id)}><IconaChiudi size={16} /></button>
        </div>
      ))}
      <form className="pp-voce pp-voce-nuova" onSubmit={(e) => { e.preventDefault(); if (nuovo.trim()) { onAggiungi(nuovo.trim()); setNuovo(''); } }}>
        <input value={nuovo} onChange={(e) => setNuovo(e.target.value)} placeholder={segnaposto} />
        <button type="submit" className="pp-chip-azione" disabled={!nuovo.trim()}>Aggiungi</button>
      </form>
    </Gruppo>
  );
}

function PaginaImpostazioni({ ctx, email }) {
  const { impostazioni, salvaImp, apri } = ctx;
  const { persone, categorie, sezioni, etichette } = impostazioni;
  return (
    <>
      <Sezione titolo="Persone">
        <p className="pp-riga-meta pp-spiegazione">A chi appartengono i documenti personali (carta d'identità, codice fiscale, …).</p>
        <ListaModificabile
          voci={persone.map((p) => ({ id: p, nome: p }))}
          onTogli={(p) => salvaImp({ ...impostazioni, persone: persone.filter((x) => x !== p) })}
          onAggiungi={(p) => salvaImp({ ...impostazioni, persone: [...persone, p] })}
          segnaposto="Nome e cognome"
        />
      </Sezione>
      <Sezione titolo="Documenti personali">
        <p className="pp-riga-meta pp-spiegazione">Le schede della sezione Personali.</p>
        <ListaModificabile
          voci={categorie}
          onTogli={(id) => salvaImp({ ...impostazioni, categorie: categorie.filter((c) => c.id !== id) })}
          onAggiungi={(nome) => salvaImp({ ...impostazioni, categorie: [...categorie, { id: slug(nome), nome, parole: [nome.toLowerCase()] }] })}
          segnaposto="Es. Tessera elettorale"
        />
      </Sezione>
      <Sezione titolo="Sezioni dei documenti">
        <p className="pp-riga-meta pp-spiegazione">Le schede in Documenti, accanto a Tutti e Pratiche. Ogni sezione raccoglie fascicoli e parole chiave.</p>
        <Gruppo>
          {sezioni.map((s) => (
            <button key={s.id} className="pp-riga" onClick={() => apri({ tipo: 'sezione', id: s.id })}>
              <span className="pp-riga-testo"><span className="pp-riga-titolo">{s.nome}</span><span className="pp-riga-meta">{[...s.fascicoli, ...s.parole].join(', ') || 'nessuna regola'}</span></span>
              <IconaFreccia size={16} />
            </button>
          ))}
          <button className="pp-riga pp-riga-aggiungi" onClick={() => apri({ tipo: 'sezione', id: null })}><IconaPiu size={18} /><span>Nuova sezione</span></button>
        </Gruppo>
      </Sezione>
      <Sezione titolo="Etichette dell'agenda">
        <p className="pp-riga-meta pp-spiegazione">Per i tuoi eventi. Il colore compare anche nell'agenda dello studio.</p>
        <Gruppo>
          {etichette.map((e) => (
            <div key={e.id} className="pp-voce">
              <span><span className="pp-punto" style={{ '--c': e.colore }} />{e.nome}</span>
              <span className="pp-voce-azioni">
                <input type="color" className="pp-colore pp-colore-piccolo" value={e.colore} aria-label={`Colore di ${e.nome}`}
                  onChange={(ev) => salvaImp({ ...impostazioni, etichette: etichette.map((x) => (x.id === e.id ? { ...x, colore: ev.target.value } : x)) })} />
                <button className="pp-icona-bottone pp-piccolo" aria-label={`Togli ${e.nome}`} disabled={etichette.length < 2}
                  onClick={() => salvaImp({ ...impostazioni, etichette: etichette.filter((x) => x.id !== e.id) })}><IconaChiudi size={16} /></button>
              </span>
            </div>
          ))}
          <NuovaEtichetta onAggiungi={(nome, colore) => salvaImp({ ...impostazioni, etichette: [...etichette, { id: slug(nome), nome, colore }] })} />
        </Gruppo>
      </Sezione>
      <Sezione titolo="Agenda dello studio">
        <StatoStudio />
      </Sezione>
      <Sezione titolo="Account">
        <Gruppo>
          <div className="pp-voce"><span>{email}</span></div>
          <button className="pp-riga pp-rosso" onClick={() => archivioDb.auth.signOut()}><IconaEsci size={18} /><span>Esci</span></button>
        </Gruppo>
      </Sezione>
    </>
  );
}

function NuovaEtichetta({ onAggiungi }) {
  const [nome, setNome] = useState('');
  const [colore, setColore] = useState('#7c3aed');
  return (
    <form className="pp-voce pp-voce-nuova" onSubmit={(e) => { e.preventDefault(); if (nome.trim()) { onAggiungi(nome.trim(), colore); setNome(''); } }}>
      <input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Nuova etichetta" />
      <input type="color" className="pp-colore pp-colore-piccolo" value={colore} onChange={(e) => setColore(e.target.value)} aria-label="Colore" />
      <button type="submit" className="pp-chip-azione" disabled={!nome.trim()}>Aggiungi</button>
    </form>
  );
}

function StatoStudio() {
  const [sessione, setSessione] = useState(undefined);
  useEffect(() => {
    sessioneStudio().then(setSessione);
    const { data } = studioDb.auth.onAuthStateChange((_e, s) => setSessione(s));
    return () => data.subscription.unsubscribe();
  }, []);
  if (sessione === undefined) return null;
  return (
    <Gruppo>
      <div className="pp-voce"><span>{sessione ? `Collegata come ${sessione.user?.email}` : 'Non collegata: apri Agenda per collegarla.'}</span></div>
      {sessione && <button className="pp-riga pp-rosso" onClick={() => esciStudio()}><IconaEsci size={18} /><span>Scollega l'agenda dello studio</span></button>}
    </Gruppo>
  );
}

function PaginaSezione({ id, ctx, chiudi }) {
  const { impostazioni, salvaImp, fascicoli } = ctx;
  const esistente = impostazioni.sezioni.find((s) => s.id === id);
  const [nome, setNome] = useState(esistente?.nome || '');
  const [scelti, setScelti] = useState(esistente?.fascicoli || []);
  const [parole, setParole] = useState((esistente?.parole || []).join(', '));
  const [conferma, setConferma] = useState(false);
  const salva = async () => {
    const sezione = { id: esistente?.id || slug(nome), nome: nome.trim(), fascicoli: scelti, parole: parole.split(',').map((p) => p.trim()).filter(Boolean) };
    const altre = impostazioni.sezioni.filter((s) => s.id !== esistente?.id);
    await salvaImp({ ...impostazioni, sezioni: esistente ? impostazioni.sezioni.map((s) => (s.id === esistente.id ? sezione : s)) : [...altre, sezione] });
    chiudi();
  };
  return (
    <>
      <label className="pp-campo"><span>Nome della sezione</span><input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Es. Casa al mare" /></label>
      <Sezione titolo="Fascicoli inclusi">
        <Gruppo>
          {fascicoli.map((f) => (
            <label key={f.codice} className="pp-voce pp-spunta">
              <span><span className="pp-punto" style={{ '--c': colore(f.codice) }} />{f.nome}</span>
              <input type="checkbox" checked={scelti.includes(f.codice)} onChange={(e) => setScelti(e.target.checked ? [...scelti, f.codice] : scelti.filter((x) => x !== f.codice))} />
            </label>
          ))}
        </Gruppo>
      </Sezione>
      <label className="pp-campo"><span>Parole chiave (separate da virgole)</span>
        <input value={parole} onChange={(e) => setParole(e.target.value)} placeholder="Es. pellet, legna, stufa" />
      </label>
      <p className="pp-riga-meta">Un documento entra nella sezione se è in uno dei fascicoli scelti, oppure se il titolo o il riassunto contiene una delle parole.</p>
      <button className="pp-bottone pp-bottone-largo" disabled={!nome.trim() || (!scelti.length && !parole.trim())} onClick={salva}>Salva sezione</button>
      {esistente && (
        <div className="pp-elimina">
          {!conferma
            ? <button className="pp-testo-link pp-rosso" onClick={() => setConferma(true)}><IconaCestino size={16} /> Togli la sezione</button>
            : <Conferma testo="Togliere la sezione? I documenti restano in archivio." etichetta="Togli"
              onNo={() => setConferma(false)} onSi={async () => { await salvaImp({ ...impostazioni, sezioni: impostazioni.sezioni.filter((s) => s.id !== esistente.id) }); chiudi(); }} />}
        </div>
      )}
    </>
  );
}

const SUGGERIMENTI_CHAT = ['Quanto devo pagare questo mese?', 'Quali bollette Edison ho pagato quest\'anno?', 'Dov\'è la carta d\'identità di Giulia?', 'Che pratiche ho aperte?'];

function PaginaChat({ documentoId, titoloDoc: titolo, ctx }) {
  const { apri } = ctx;
  const [modo, setModo] = useState('ai');
  const [messaggi, setMessaggi] = useState([]);
  const [testo, setTesto] = useState('');
  const [attesa, setAttesa] = useState(false);
  const fondo = useRef(null);
  useEffect(() => { fondo.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }); }, [messaggi, attesa]);

  const invia = async (domanda) => {
    const q = domanda.trim();
    if (!q || attesa) return;
    setTesto('');
    const storia = messaggi.filter((m) => m.testo).map((m) => ({ ruolo: m.ruolo, testo: m.testo }));
    setMessaggi((m) => [...m, { ruolo: 'utente', testo: q }]);
    setAttesa(true);
    let nuovo;
    if (modo === 'ai') {
      try {
        nuovo = { ruolo: 'assistente', testo: await chiediPoliedron({ token: await tokenSessione(), domanda: q, documentoId, storia }), fonte: 'ai' };
      } catch (e) {
        nuovo = { ruolo: 'assistente', risposta: await rispondi(archivioDb, q).catch(() => null), fonte: 'core', nota: `${e.message} Ti rispondo con la ricerca di Poliedron.` };
      }
    } else {
      nuovo = { ruolo: 'assistente', risposta: await rispondi(archivioDb, q).catch(() => null), fonte: 'core' };
    }
    setMessaggi((m) => [...m, nuovo]);
    setAttesa(false);
  };

  return (
    <div className="pp-chat">
      <Segmenti voci={[['ai', 'Poliedron AI'], ['core', 'Solo ricerca']]} attiva={modo} onScegli={setModo} />
      {titolo && <p className="pp-chat-contesto"><IconaFile size={14} /> Sul documento: <strong>{titolo}</strong></p>}
      {!messaggi.length && (
        <div className="pp-chat-vuota">
          <p>{modo === 'ai' ? 'Chiedimi qualsiasi cosa sull\'archivio: documenti, pagamenti, pratiche, persone. Rispondo solo con quello che trovo.' : 'Ricerca senza AI: fornitori, bollette, scadenze, "quanto devo a…", pratiche.'}</p>
          <div className="pp-suggerimenti">
            {(titolo ? ['Riassumimi questo documento', 'Cosa devo fare?', 'Ci sono scadenze?'] : SUGGERIMENTI_CHAT).map((x) => <button key={x} className="pp-chip" onClick={() => invia(x)}>{x}</button>)}
          </div>
        </div>
      )}
      {messaggi.map((m, i) => (
        <div key={i} className={`pp-messaggio-chat ${m.ruolo}`}>
          {m.ruolo === 'utente' ? m.testo : (
            <>
              {m.nota && <p className="pp-riga-meta">{m.nota}</p>}
              {m.testo && <div className="pp-chat-testo">{partiRisposta(m.testo).map((p, j) => (p.doc
                ? <button key={j} className="pp-chat-link" onClick={() => apri({ tipo: 'documento', id: p.doc })}><IconaFile size={14} />{p.titolo}</button>
                : <span key={j}>{p.testo}</span>))}</div>}
              {m.risposta && <Risultato risposta={m.risposta} ctx={ctx} />}
              {!m.testo && !m.risposta && <p>Nessun risultato.</p>}
              <span className="pp-chat-fonte">{m.fonte === 'ai' ? 'Poliedron AI' : 'Poliedron · ricerca'}</span>
            </>
          )}
        </div>
      ))}
      {attesa && <div className="pp-messaggio-chat assistente"><span className="pp-rotella" /> {modo === 'ai' ? 'Cerco nell\'archivio…' : 'Cerco…'}</div>}
      <div ref={fondo} />
      <form className="pp-chat-barra" onSubmit={(e) => { e.preventDefault(); invia(testo); }}>
        <input value={testo} onChange={(e) => setTesto(e.target.value)} placeholder="Scrivi a Poliedron…" enterKeyHint="send" aria-label="Domanda a Poliedron" />
        <button type="submit" className="pp-chat-invia" disabled={!testo.trim() || attesa} aria-label="Invia"><IconaInvia size={20} /></button>
      </form>
    </div>
  );
}

const TITOLI_PAGINE = { chat: 'Poliedron', evento: 'Evento', appuntamento: 'Appuntamento', documento: 'Documento', pagamento: 'Pagamento', pratica: 'Pratica', carica: 'Carica un documento', impostazioni: 'Impostazioni', sezione: 'Sezione' };

/* ---------- app ---------- */
const VISTE = [
  ['oggi', 'Oggi', IconaOggi],
  ['documenti', 'Documenti', IconaDocumenti],
  ['agenda', 'Agenda', IconaCalendario],
  ['pagamenti', 'Pagamenti', IconaEuro],
  ['personali', 'Personali', IconaPortafoglio],
];
const TITOLI = { documenti: 'Documenti', agenda: 'Agenda', pagamenti: 'Pagamenti', personali: 'Personali' };

function Archivio({ email }) {
  const [vista, setVistaStato] = useState(() => (VISTE.some(([k]) => k === leggiVista()) ? leggiVista() : 'oggi'));
  const [pagine, setPagine] = useState([]);
  const [errore, setErrore] = useState(null);
  const [toast, setToast] = useState(null);
  const [occupato, setOccupato] = useState(0);
  const [versione, setVersione] = useState(0);
  const [fascicoli, setFascicoli] = useState([]);
  const [impostazioni, setImpostazioni] = useState(() => JSON.parse(JSON.stringify(IMPOSTAZIONI_PREDEFINITE)));
  const contatore = useRef(0);

  const esegui = useCallback(async (fn) => {
    setErrore(null); setOccupato((n) => n + 1);
    try { await fn(); } catch (e) { setErrore(e.message || String(e)); } finally { setOccupato((n) => n - 1); }
  }, []);
  const aggiorna = useCallback(() => setVersione((v) => v + 1), []);
  const mostra = useCallback((t) => { setToast(t); setTimeout(() => setToast(null), 2600); }, []);
  useEffect(() => { conteggiFascicoli(archivioDb).then(setFascicoli).catch(() => {}); }, [versione]);
  useEffect(() => { leggiImpostazioni(archivioDb).then(setImpostazioni).catch(() => {}); }, []);

  const salvaImp = useCallback(async (nuove) => {
    setImpostazioni(nuove);
    try { setImpostazioni(await salvaImpostazioni(archivioDb, nuove)); } catch (e) { setErrore(`Impostazioni non salvate: ${e.message}`); }
  }, []);
  const vai = useCallback((v) => {
    setPagine([]); setVistaStato(v); setErrore(null);
    try { localStorage.setItem(VISTA_KEY, v); } catch { /* facoltativo */ }
    window.scrollTo(0, 0);
  }, []);
  const apri = useCallback((p) => { contatore.current += 1; setErrore(null); setPagine((st) => [...st, { ...p, chiave: contatore.current }]); }, []);
  const indietro = useCallback(() => { setErrore(null); setPagine((st) => st.slice(0, -1)); }, []);
  const sostituisci = useCallback((p) => { contatore.current += 1; setPagine((st) => [...st.slice(0, -1), { ...p, chiave: contatore.current }]); }, []);

  const ctx = {
    esegui, aggiorna, mostra, versione, impostazioni, salvaImp, fascicoli, apri, vai,
    pagato: (s) => esegui(async () => { await segnaScadenza(archivioDb, s.id, true); aggiorna(); mostra('Segnato come pagato'); }),
  };

  useEffect(() => {
    document.body.classList.toggle('pp-con-pagina', pagine.length > 0);
  }, [pagine.length]);

  const contenutoPagina = (p) => {
    switch (p.tipo) {
      case 'documento': return <PaginaDocumento id={p.id} ctx={ctx} chiudi={indietro} />;
      case 'pagamento': return <PaginaPagamento s={p.s} ctx={ctx} chiudi={indietro} />;
      case 'pratica': return <PaginaPratica p={p.p} ctx={ctx} />;
      case 'elenco': return <PaginaElenco carica={p.carica} colore={p.colore} ctx={ctx} />;
      case 'carica': return <PaginaCarica opzioni={p.opzioni || {}} ctx={ctx} sostituisci={sostituisci} />;
      case 'impostazioni': return <PaginaImpostazioni ctx={ctx} email={email} />;
      case 'sezione': return <PaginaSezione id={p.id} ctx={ctx} chiudi={indietro} />;
      case 'evento': return <PaginaEvento evento={p.evento} ctx={ctx} chiudi={indietro} />;
      case 'appuntamento': return <PaginaAppuntamento a={p.a} />;
      case 'chat': return <PaginaChat documentoId={p.documentoId} titoloDoc={p.titoloDoc} ctx={ctx} />;
      default: return null;
    }
  };

  return (
    <div className="pp-app">
      <header className="pp-testata">
        <h1>{vista === 'oggi' ? saluto() : TITOLI[vista]}</h1>
        <span className="pp-testata-azioni">
          <button className="pp-poliedron" onClick={() => apri({ tipo: 'chat' })} aria-label="Chiedi a Poliedron"><IconaChat size={18} /><span>Poliedron</span></button>
          <button className="pp-icona-bottone" onClick={() => apri({ tipo: 'impostazioni' })} aria-label="Impostazioni"><IconaImpostazioni size={20} /></button>
        </span>
      </header>
      {occupato > 0 && <div className="pp-barra-caricamento" aria-hidden="true" />}
      {errore && !pagine.length && <p className="pp-messaggio pp-messaggio-errore" role="alert">{errore}</p>}
      <main className="pp-contenuto">
        {vista === 'oggi' && <VistaOggi ctx={ctx} />}
        {vista === 'documenti' && <VistaDocumenti ctx={ctx} />}
        {vista === 'agenda' && <VistaAgenda ctx={ctx} />}
        {vista === 'pagamenti' && <VistaPagamenti ctx={ctx} />}
        {vista === 'personali' && <VistaPersonali ctx={ctx} />}
      </main>
      {pagine.map((p, i) => (
        <Pagina key={p.chiave} titolo={p.titolo || TITOLI_PAGINE[p.tipo]} visibile={i === pagine.length - 1} onIndietro={indietro}>
          {i === pagine.length - 1 && errore && <p className="pp-messaggio pp-messaggio-errore" role="alert">{errore}</p>}
          {contenutoPagina(p)}
        </Pagina>
      ))}
      <nav className="pp-schede" aria-label="Sezioni">
        {VISTE.map(([k, l, Icona]) => (
          <button key={k} className={`pp-scheda${vista === k && !pagine.length ? ' attiva' : ''}${vista === k && pagine.length ? ' sotto' : ''}`} onClick={() => vai(k)} aria-current={vista === k ? 'page' : undefined}>
            <Icona size={22} /><span>{l}</span>
          </button>
        ))}
      </nav>
      {!pagine.length && (
        <button className="pp-fab" onClick={() => apri(vista === 'agenda' ? { tipo: 'evento' } : { tipo: 'carica' })}
          aria-label={vista === 'agenda' ? 'Nuovo evento' : 'Carica un documento'}><IconaPiu size={26} /></button>
      )}
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
  return sessione ? <Archivio email={sessione.user?.email} /> : <Accesso />;
}
