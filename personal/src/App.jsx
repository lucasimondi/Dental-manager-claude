import { Pagina } from './Pagina.jsx';
import { readAgendaLocation } from '../../shared/agenda/navigation.js';
// POL-VITA-003/006 — Poliedron Personal: app per telefono dell'archivio personale.
// Dock: Oggi · Documenti · Agenda · Conti · Personali. Ogni dettaglio si apre come pagina sopra la
// sezione, con "Indietro" in alto, il tasto di chiusura in basso a portata di pollice e il dock
// sempre visibile; chiudendo si torna dov'eri. Il + apre tutte le aggiunte.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { archivioDb } from './lib/supabasePersonal.js';
import {
  cercaDocumenti, conteggiFascicoli, eliminaDocumento, pratiche as caricaPratiche, documentiDellaPratica, rispondi,
  segnaScadenza, cambiaStatoPratica, documentiDaGestire, documentiRecenti, documentoCompleto, impostaPortafoglio,
  caricaDocumento, eCaricato, nelPortafoglio, anteprimaFile, pagamenti as caricaPagamenti, eliminaScadenza, prossimoPagamentoFisso, pagamentoDaDocumento, RICORRENZE,
  aggiornaDocumento, documentiSezione, documentiPersonali, aggiornaScadenza, chiediPoliedron, partiRisposta, praticaCompleta, cestinaSuDrive,
} from './lib/archivio.js';
import { spesaDaScadenza, annullaSpesaDaScadenza, movimentiTra, bilancio, periodo, CATEGORIE_PAGAMENTO } from './lib/conti.js';
import { impostaToken } from './lib/miniature.js';
import { VistaAgenda, PaginaEvento, PaginaAppuntamento, ElencoGiorno } from './Agenda.jsx';
import { VistaConti, PaginaMovimento, PaginaNuovaScadenza, RiquadroSaldo } from './Conti.jsx';
import { FoglioAggiungi, PaginaScansione } from './Aggiungi.jsx';
import { sessioneStudio, esciStudio, appuntamentiTra, impegniTra, studioDb } from './lib/studio.js';
import { oggi as oggiAgenda } from './lib/agenda.js';
import { euro } from './lib/coreArchivio.js';
import { preparaFile as preparaCaricamento } from './lib/file.js';
import { ACCETTA_ALLEGATI, CHAT_VUOTA, dimensioneFile, domandaDa, esitoAllegato, puoInviare, storiaChat } from './lib/chat.js';
import { preparaFile } from './lib/condividi.js';
import { IMPOSTAZIONI_PREDEFINITE, leggiImpostazioni, salvaImpostazioni, categoriaDi, personaDi, slug } from './lib/impostazioni.js';
import {
  colore, dataBreve, oggiIso, quando, titoloDoc, saluto, VISTA_KEY, leggiVista, INDIRIZZO_APP, tokenSessione,
  Vuoto, Sezione, Gruppo, RigaDocumento, SchedaDocumento, RigaPagamento, Chips, Segmenti, Conferma, ConfermaElimina, ElencoPratiche, BottoneCondividi,
} from './ui.jsx';
import { VistaDocumenti, PaginaRicerca } from './Documenti.jsx';
import { Miniatura } from './Miniatura.jsx';
import {
  IconaOggi, IconaDocumenti, IconaPortafoglio, IconaPratiche, IconaPiu, IconaCerca, IconaChiudi, IconaIndietro, IconaFreccia,
  IconaApri, IconaEmail, IconaCalendario, IconaFotocamera, IconaFile, IconaStella, IconaCestino, IconaEsci, IconaEuro, IconaImpostazioni, IconaChat, IconaInvia,
  IconaScansiona, IconaGraffetta,
} from './Icone.jsx';

impostaToken(tokenSessione);

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

/* ---------- pagina sopra la sezione ----------
 * Corpo che scorre da solo (anche su iPhone), Indietro in alto, tasto di chiusura rotondo in
 * basso a destra (a portata di pollice) e chiusura scorrendo dal bordo sinistro. Dock visibile. */

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
        const file = await preparaFile(doc.drive_file_id, await tokenSessione());
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

/* ---------- Oggi: cruscotto ---------- */
const dataLunga = () => { const t = new Date().toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' }); return t.charAt(0).toUpperCase() + t.slice(1); };

function VistaOggi({ ctx }) {
  const [dati, setDati] = useState(null);
  const { esegui, apri, vai, pagato, versione, aggiungi } = ctx;
  useEffect(() => {
    esegui(async () => {
      const mese = periodo('mese', oggiIso().slice(0, 7));
      const [tutte, daGestire, recenti, fascicoli, elencoPratiche, movimenti] = await Promise.all([
        caricaPagamenti(archivioDb), documentiDaGestire(archivioDb), documentiRecenti(archivioDb, 10), conteggiFascicoli(archivioDb),
        caricaPratiche(archivioDb), movimentiTra(archivioDb, mese.da, mese.a).catch(() => []),
      ]);
      const limite = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
      const aperte = tutte.filter((s) => !s.completata);
      // Agenda di oggi, se l'agenda dello studio è collegata.
      let agenda = null;
      const collegata = !!(await sessioneStudio().catch(() => null));
      if (collegata) {
        const g = oggiAgenda();
        const [appuntamenti, impegni] = await Promise.all([appuntamentiTra(g, g), impegniTra(g, g)]).catch(() => [null, null]);
        if (appuntamenti) agenda = { appuntamenti, impegni, scadenze: tutte.filter((s) => s.data === g) };
      }
      setDati({
        prossime: aperte.filter((s) => s.data <= limite), aperte, daGestire, recenti, agenda, collegata,
        pratiche: elencoPratiche.filter((p) => ['aperta', 'in_corso'].includes(p.stato)),
        totale: fascicoli.reduce((t, f) => t + Number(f.n || 0), 0), saldo: bilancio(movimenti),
      });
    });
  }, [esegui, versione]);
  if (!dati) return <p className="pp-data-oggi">{dataLunga()}</p>;
  const scaduti = dati.aperte.filter((s) => s.data < oggiIso());
  const entro30 = dati.prossime.reduce((t, s) => t + Number(s.importo || 0), 0);
  const urgenti = [...dati.pratiche].sort((x, y) => (x.urgenza === 'alta' ? -1 : 0) - (y.urgenza === 'alta' ? -1 : 0)
    || String(x.prossima_scadenza || '9999').localeCompare(String(y.prossima_scadenza || '9999')));
  const apriDoc = (d) => apri({ tipo: 'documento', id: d.id });
  return (
    <>
      <p className="pp-data-oggi">{dataLunga()}</p>
      <RiquadroSaldo b={dati.saldo} titolo={`Saldo di ${new Date().toLocaleDateString('it-IT', { month: 'long' })}`} onApri={() => vai('conti')} />
      <div className="pp-rapide">
        {[['scansiona', 'Scansiona', IconaScansiona], ['spesa', 'Spesa', IconaEuro], ['incasso', 'Incasso', IconaEuro], ['fotocamera', 'Foto', IconaFotocamera]].map(([id, nome, Icona]) => (
          <button key={id} className={`pp-rapida pp-av-${id}`} onClick={() => aggiungi(id)}><span><Icona size={22} /></span>{nome}</button>
        ))}
      </div>
      <div className="pp-riassunto pp-riassunto-quattro">
        <button className={`pp-tessera${scaduti.length ? ' pp-tessera-allarme' : ''}`} onClick={() => vai('conti', 'dapagare')}>
          <span className="pp-tessera-numero">{scaduti.length}</span><span>{scaduti.length === 1 ? 'pagamento scaduto' : 'pagamenti scaduti'}</span>
        </button>
        <button className="pp-tessera" onClick={() => vai('conti', 'dapagare')}>
          <span className="pp-tessera-numero">{euro(entro30)}</span><span>da pagare entro 30 giorni</span>
        </button>
        <button className="pp-tessera" onClick={() => apri({ tipo: 'elenco', titolo: 'Da gestire', carica: () => documentiDaGestire(archivioDb) })}>
          <span className="pp-tessera-numero">{dati.daGestire.length}</span><span>documenti da gestire</span>
        </button>
        <button className="pp-tessera" onClick={() => vai('documenti', 'pratiche')}>
          <span className="pp-tessera-numero">{dati.pratiche.length}</span><span>pratiche aperte</span>
        </button>
      </div>
      {dati.agenda ? (
        <Sezione titolo="Oggi in agenda" azione={<button className="pp-testo-link" onClick={() => vai('agenda')}>Agenda</button>}>
          <ElencoGiorno giorno={oggiAgenda()} dati={dati.agenda} ctx={ctx} etichette={ctx.impostazioni.etichette} coloriTipi={{}} intestazione={false} />
        </Sezione>
      ) : !dati.collegata && (
        <button className="pp-invito" onClick={() => vai('agenda')}><IconaCalendario size={20} /><span><strong>Collega l'agenda dello studio</strong><br />Appuntamenti ed eventi qui, ogni mattina.</span><IconaFreccia size={16} /></button>
      )}
      <Sezione titolo="Prossimi pagamenti" azione={<button className="pp-testo-link" onClick={() => vai('conti', 'dapagare')}>Tutti</button>}>
        {dati.prossime.length
          ? <Gruppo>{dati.prossime.slice(0, 5).map((s) => <RigaPagamento key={s.id} s={s} onApri={(x) => apri({ tipo: 'pagamento', s: x })} onPagato={pagato} />)}</Gruppo>
          : <Vuoto>Nessun pagamento nei prossimi 30 giorni.</Vuoto>}
      </Sezione>
      <Sezione titolo="Ultimi documenti" azione={<button className="pp-testo-link" onClick={() => vai('documenti')}>Tutti</button>}>
        {dati.recenti.length
          ? <div className="pp-carosello">{dati.recenti.map((d) => <SchedaDocumento key={d.id} doc={d} onApri={apriDoc} />)}</div>
          : <Vuoto>L'archivio si sta riempiendo: lo script importa la posta ogni 10 minuti.</Vuoto>}
      </Sezione>
      {dati.daGestire.length > 0 && (
        <Sezione titolo="Da gestire" azione={dati.daGestire.length > 4 ? <button className="pp-testo-link" onClick={() => apri({ tipo: 'elenco', titolo: 'Da gestire', carica: () => documentiDaGestire(archivioDb) })}>Tutti</button> : null}>
          <Gruppo>{dati.daGestire.slice(0, 4).map((d) => <RigaDocumento key={d.id} doc={d} onApri={apriDoc} />)}</Gruppo>
        </Sezione>
      )}
      {urgenti.length > 0 && (
        <Sezione titolo="Pratiche in corso" azione={<button className="pp-testo-link" onClick={() => vai('documenti', 'pratiche')}>Tutte</button>}>
          <ElencoPratiche elenco={urgenti.slice(0, 4)} onApri={(p) => apri({ tipo: 'pratica', p })} />
        </Sezione>
      )}
      <p className="pp-riga-meta pp-nota-fondo">{dati.totale} documenti in archivio.</p>
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

/* ---------- Personali (carta d'identità, codice fiscale, ... per persona) ---------- */
function CartaDocumento({ doc, onApri, etichetta, mostra }) {
  return (
    <button className="pp-carta pp-carta-con-anteprima" style={{ '--c': colore(doc.fascicolo === 'identita' ? 'identita' : doc.fascicolo) }} onClick={() => onApri(doc)}>
      <Miniatura doc={doc} colore={colore(doc.fascicolo === 'identita' ? 'identita' : doc.fascicolo)} grande />
      <span className="pp-carta-testo">
        <span className="pp-carta-tipo">{etichetta || doc.tipo_documento || doc.fascicolo}</span>
        <span className="pp-carta-titolo">{titoloDoc(doc)}</span>
        <span className="pp-carta-piede">{[doc._persona || doc.persona, dataBreve(doc.data_documento || doc.email_data)].filter(Boolean).join(' · ')}</span>
      </span>
      <BottoneCondividi doc={doc} piccolo mostra={mostra} />
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
    <Sezione key={persona} titolo={persona}>
      <div className="pp-carte">
        {elenco.map((d) => <CartaDocumento key={d.id} doc={d} etichetta={nomeCat(d._cat)} onApri={apriDoc} mostra={ctx.mostra} />)}
        {persona && attiva !== 'tutti' && !elenco.length && (
          <button className="pp-carta pp-carta-nuova" onClick={() => aggiungi(persona, attiva)}><IconaPiu size={24} /><span>Aggiungi {nomeCat(attiva)}</span></button>
        )}
        {persona && attiva === 'tutti' && (
          <button className="pp-carta pp-carta-nuova pp-carta-bassa" onClick={() => aggiungi(persona, null)}><IconaPiu size={22} /><span>Aggiungi un documento</span></button>
        )}
      </div>
    </Sezione>
  );

  // POL-VITA-008: qui solo i documenti delle persone elencate in Impostazioni; gli altri restano in
  // Documenti, catalogati per categoria ed ente.
  const delleMie = arricchiti.filter((d) => d._persona && persone.includes(d._persona));
  const filtrati = attiva === 'tutti' ? delleMie : delleMie.filter((d) => d._cat === attiva);
  const altri = arricchiti.length - delleMie.length;
  return (
    <>
      <Chips voci={[['tutti', 'Tutti'], ...categorie.map((c) => [c.id, c.nome])]} attiva={attiva} onScegli={setScheda} />
      {persone.map((p) => perPersona(p, filtrati.filter((d) => d._persona === p)))}
      {altri > 0 && (
        <button className="pp-riga pp-riga-sola pp-altri-personali" onClick={() => apri({ tipo: 'elenco', titolo: 'Documenti d\'identità di altri', carica: async () => arricchiti.filter((d) => !(d._persona && persone.includes(d._persona))) })}>
          <span className="pp-riga-testo"><span className="pp-riga-titolo">{altri} documenti di altre persone</span><span className="pp-riga-meta">Restano in Documenti. Se uno è vostro, aprilo e scegli la persona.</span></span>
          <IconaFreccia size={16} />
        </button>
      )}
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
        {(doc.drive_file_id || doc.drive_url) && <BottoneCondividi doc={doc} mostra={mostra} />}
        {!eCaricato(doc) && doc.gmail_message_id && <a className="pp-bottone pp-bottone-chiaro" href={`https://mail.google.com/mail/u/0/#all/${doc.gmail_message_id}`} target="_blank" rel="noreferrer"><IconaEmail size={18} /> Email</a>}
        <button className={`pp-bottone pp-bottone-chiaro${portafoglio ? ' pp-attivo' : ''}`} onClick={() => cambia(() => impostaPortafoglio(archivioDb, doc, !portafoglio), portafoglio ? 'Tolto dai Personali' : 'Aggiunto ai Personali')}>
          <IconaStella size={18} piena={portafoglio} /> {portafoglio ? 'Nei Personali' : 'Tieni a portata di mano'}
        </button>
      </div>
      {doc.fascicolo !== 'clinico_pazienti' && (
        <button className="pp-chiedi-doc" onClick={() => ctx.apriChat({ id: doc.id, titolo: titoloDoc(doc) })}>
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
      <Sezione titolo="Catalogo">
        <div className="pp-campi">
          <label className="pp-campo-riga"><span>Titolo</span>
            <input className="pp-campo-testo" defaultValue={doc.titolo || ''} onBlur={(e) => e.target.value.trim() && e.target.value.trim() !== doc.titolo && cambia(() => aggiornaDocumento(archivioDb, doc.id, { titolo: e.target.value }), 'Titolo salvato')} />
          </label>
          <label className="pp-campo-riga"><span>Ente</span>
            <input className="pp-campo-testo" defaultValue={doc.ente || ''} placeholder="Es. Enel Energia" onBlur={(e) => e.target.value.trim() !== (doc.ente || '') && cambia(() => aggiornaDocumento(archivioDb, doc.id, { ente: e.target.value }), 'Ente salvato')} />
          </label>
          <label className="pp-campo-riga"><span>Importanza</span>
            <select className="pp-select" value={doc.rilevanza || 'normale'} onChange={(e) => cambia(() => aggiornaDocumento(archivioDb, doc.id, { rilevanza: e.target.value }), 'Salvato')}>
              <option value="alta">Importante</option>
              <option value="normale">Normale</option>
              <option value="bassa">Poco utile (nascosto)</option>
            </select>
          </label>
          <label className="pp-campo-riga"><span>Persona</span>
            <select className="pp-select" value={doc.persona || ''} onChange={(e) => cambia(() => aggiornaDocumento(archivioDb, doc.id, { persona: e.target.value }), 'Salvato')}>
              <option value="">Nessuna</option>
              {persone.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </label>
          <label className="pp-campo-riga"><span>Doc. personale</span>
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
          : <ConfermaElimina n={1} onNo={() => setConferma(false)}
            onSi={(ancheDrive) => esegui(async () => {
              const r = ancheDrive ? await cestinaSuDrive({ token: await tokenSessione(), ids: [doc.drive_file_id] }) : null;
              await eliminaDocumento(archivioDb, doc.id); aggiorna();
              mostra(r?.cestinati.length ? 'Eliminato; il file è nel Cestino di Drive' : 'Eliminato dall\'archivio'); chiudi();
            })} />}
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
    // Pagato → spesa nei Conti; di nuovo da pagare → la spesa automatica si toglie.
    const spesa = completata ? await spesaDaScadenza(archivioDb, s).catch(() => null) : (await annullaSpesaDaScadenza(archivioDb, s.id).catch(() => null), null);
    const prossimo = completata && s.ricorrenza ? await prossimoPagamentoFisso(archivioDb, s).catch(() => null) : null;
    setS({ ...s, completata }); aggiorna();
    mostra([completata ? (spesa ? 'Pagato e registrato tra le spese' : 'Segnato come pagato') : 'Segnato da pagare', prossimo ? `prossimo il ${dataBreve(prossimo.data)}` : null].filter(Boolean).join(' · '));
  });
  return (
    <>
      <div className="pp-dettaglio-testa" style={{ '--c': s.completata ? '#067647' : scaduto ? '#B42318' : '#0c447c' }}>
        <span className="pp-etichetta">{s.completata ? 'Pagato' : scaduto ? 'Scaduto' : 'Da pagare'}</span>
        <h2>{s.descrizione}</h2>
        {s.importo != null && <p className="pp-importo-grande">{euro(s.importo)}</p>}
        <p className="pp-riga-meta"><IconaCalendario size={14} /> {dataBreve(s.data)}{!s.completata ? ` · ${quando(s.data)}` : ''}</p>
        {(s.categoria || s.ricorrenza) && <p className="pp-riga-meta">{[s.categoria, RICORRENZE.find(([k]) => k === s.ricorrenza)?.[1]].filter(Boolean).join(' · ')}</p>}
      </div>
      <div className="pp-azioni">
        {s.completata
          ? <button className="pp-bottone pp-bottone-chiaro" onClick={() => cambiaStato(false)}>Segna da pagare</button>
          : <button className="pp-bottone pp-bottone-verde" onClick={() => cambiaStato(true)}>Segna come pagato</button>}
        {!modifica && <button className="pp-bottone pp-bottone-chiaro" onClick={() => setModifica({ descrizione: s.descrizione, data: s.data, importo: s.importo ?? '', categoria: s.categoria || '', ricorrenza: s.ricorrenza || '' })}>Modifica</button>}
      </div>
      {modifica && (
        <div className="pp-modifica">
          <label className="pp-campo"><span>Descrizione</span><input value={modifica.descrizione} onChange={(e) => setModifica({ ...modifica, descrizione: e.target.value })} /></label>
          <div className="pp-due">
            <label className="pp-campo"><span>Data</span><input type="date" value={modifica.data} onChange={(e) => setModifica({ ...modifica, data: e.target.value })} /></label>
            <label className="pp-campo"><span>Importo (€)</span><input inputMode="decimal" value={modifica.importo} onChange={(e) => setModifica({ ...modifica, importo: e.target.value })} placeholder="nessuno" /></label>
          </div>
          <div className="pp-due">
            <label className="pp-campo"><span>Tipo</span>
              <select className="pp-select" value={modifica.categoria} onChange={(e) => setModifica({ ...modifica, categoria: e.target.value })}>
                <option value="">—</option>
                {[...new Set([...CATEGORIE_PAGAMENTO, ...(modifica.categoria ? [modifica.categoria] : [])])].map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </label>
            <label className="pp-campo"><span>Si ripete</span>
              <select className="pp-select" value={modifica.ricorrenza} onChange={(e) => setModifica({ ...modifica, ricorrenza: e.target.value })}>
                {RICORRENZE.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
              </select>
            </label>
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
        ) : (
          <button className="pp-riga pp-riga-aggiungi pp-riga-sola" onClick={() => apri({ tipo: 'carica', opzioni: { pagamentoId: s.id, descrizione: s.descrizione } })}>
            <IconaPiu size={18} /><span>Allega la foto o il PDF (bolletta, polizza, ricevuta…)</span>
          </button>
        )}
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

const STATI_PRATICA = { aperta: 'Aperta', in_corso: 'In corso', risolta: 'Risolta', archiviata: 'Archiviata' };

function PaginaPratica({ p: base, ctx }) {
  const { esegui, apri, aggiorna, pagato, mostra, fascicoli } = ctx;
  const [p, setP] = useState(base);
  const [documenti, setDocumenti] = useState(null);
  const carica = useCallback(() => esegui(async () => {
    const [completa, docs] = await Promise.all([praticaCompleta(archivioDb, base.id), documentiDellaPratica(archivioDb, base.id)]);
    setP((x) => ({ ...x, ...completa })); setDocumenti(docs);
  }), [esegui, base.id]);
  useEffect(() => { carica(); }, [carica]);
  const cambiaStato = (stato) => esegui(async () => { await cambiaStatoPratica(archivioDb, p.id, stato); setP({ ...p, stato }); aggiorna(); mostra(`Pratica ${STATI_PRATICA[stato].toLowerCase()}`); });

  const scadenze = p.scadenze || [];
  const aperte = scadenze.filter((s) => !s.completata);
  const daPagare = aperte.reduce((t, s) => t + Number(s.importo || 0), 0);
  const totaleDoc = (documenti || []).reduce((t, d) => t + Number(d.importo || 0), 0);
  const c = colore(p.fascicolo);
  // Documenti in ordine di tempo, raggruppati per anno.
  const perAnno = (documenti || []).reduce((g, d) => { const a = String(d.data_documento || d.email_data || '').slice(0, 4) || '—'; (g[a] ||= []).push(d); return g; }, {});

  return (
    <>
      <div className="pp-pratica-testa" style={{ '--c': c }}>
        <span className="pp-pratica-fascicolo">{fascicoli.find((f) => f.codice === p.fascicolo)?.nome || p.fascicolo || 'Pratica'}</span>
        <h2>{p.titolo}</h2>
        <span className="pp-pratica-stati">
          <span className={`pp-stato pp-stato-${p.stato}`}>{STATI_PRATICA[p.stato] || p.stato}</span>
          {p.urgenza === 'alta' && <span className="pp-stato pp-stato-urgente">Urgente</span>}
        </span>
        {p.note && <p className="pp-pratica-note">{p.note}</p>}
      </div>
      <div className="pp-numeri">
        <div><strong>{documenti ? documenti.length : '…'}</strong><span>documenti</span></div>
        <div><strong>{aperte.length ? euro(daPagare) : '—'}</strong><span>da pagare</span></div>
        <div><strong>{p.prossima_scadenza ? dataBreve(p.prossima_scadenza).replace(/ \d{4}$/, '') : '—'}</strong><span>prossima scadenza</span></div>
      </div>
      <div className="pp-azioni">
        {['aperta', 'in_corso'].includes(p.stato)
          ? <button className="pp-bottone pp-bottone-verde" onClick={() => cambiaStato('risolta')}>Segna risolta</button>
          : <button className="pp-bottone pp-bottone-chiaro" onClick={() => cambiaStato('aperta')}>Riapri</button>}
        {p.stato === 'aperta' && <button className="pp-bottone pp-bottone-chiaro" onClick={() => cambiaStato('in_corso')}>In corso</button>}
      </div>
      {scadenze.length > 0 && (
        <Sezione titolo="Pagamenti e scadenze">
          <Gruppo>{scadenze.map((s) => <RigaPagamento key={s.id} s={s} onApri={(x) => apri({ tipo: 'pagamento', s: x })} onPagato={async (x) => { await pagato(x); carica(); }} />)}</Gruppo>
        </Sezione>
      )}
      <Sezione titolo="Documenti" azione={totaleDoc > 0 ? <span className="pp-riga-meta">{euro(totaleDoc)} in totale</span> : null}>
        {!documenti ? <Vuoto>Carico…</Vuoto> : !documenti.length ? <Vuoto>Nessun documento.</Vuoto> : (
          <div className="pp-cronologia">
            {Object.entries(perAnno).map(([anno, docs]) => (
              <div key={anno}>
                <h3 className="pp-cronologia-anno">{anno}</h3>
                {docs.map((d) => (
                  <button key={d.id} className="pp-cronologia-voce" onClick={() => apri({ tipo: 'documento', id: d.id })}>
                    <Miniatura doc={d} colore={c} />
                    <span className="pp-riga-testo">
                      <span className="pp-riga-titolo">{titoloDoc(d)}</span>
                      <span className="pp-riga-meta">{[dataBreve(d.data_documento || d.email_data), d.tipo_documento].filter(Boolean).join(' · ')}</span>
                      {d.riassunto && <span className="pp-cronologia-riassunto">{d.riassunto}</span>}
                    </span>
                    {d.importo != null && <span className="pp-riga-importo">{euro(d.importo)}</span>}
                  </button>
                ))}
              </div>
            ))}
          </div>
        )}
      </Sezione>
    </>
  );
}

function PaginaCarica({ opzioni, file: fileIniziale, ctx, sostituisci }) {
  const { aggiorna, mostra, impostazioni, fascicoli } = ctx;
  const [file, setFile] = useState(fileIniziale || null);
  const [anteprima, setAnteprima] = useState(() => (fileIniziale?.type?.startsWith('image/') ? URL.createObjectURL(fileIniziale) : null));
  const [descrizione, setDescrizione] = useState(opzioni.descrizione || '');
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
      const pronto = await preparaCaricamento(file);
      setStato({ invio: true, testo: nonAnalizzare ? 'Salvo su Drive…' : 'Salvo su Drive e leggo il documento…' });
      const r = await caricaDocumento({ token: await tokenSessione(), ...pronto, descrizione, fascicolo, portafoglio: tieni, nonAnalizzare, persona, categoria });
      aggiorna();
      // Da Conti: il documento diventa (o si collega a) un pagamento da fare.
      if (r.id && (opzioni.pagamento || opzioni.pagamentoId)) {
        const [primo] = await pagamentoDaDocumento(archivioDb, r.id, { categoria: opzioni.categoriaPagamento || null, pagamentoId: opzioni.pagamentoId || null });
        aggiorna();
        mostra(opzioni.pagamentoId ? 'Documento allegato al pagamento' : 'Letto: controlla importo e scadenza');
        if (primo) { sostituisci({ tipo: 'pagamento', s: primo }); return; }
      }
      mostra(r.duplicato ? 'Era già in archivio' : `Archiviato: ${r.titolo}`);
      if (r.id) sostituisci({ tipo: 'documento', id: r.id });
    } catch (e) {
      setStato({ errore: true, testo: e.message });
    }
  };

  return (
    <>
      <input ref={fotocamera} type="file" accept="image/*" capture="environment" hidden onChange={(e) => scegli(e.target.files[0])} />
      <input ref={archivio} type="file" accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx,.odt,.ods,.txt,.rtf,.heic,.heif" hidden onChange={(e) => scegli(e.target.files[0])} />
      {!file ? (
        <div className="pp-sorgenti">
          <button className="pp-sorgente" onClick={() => sostituisci({ tipo: 'scansione', opzioni })}><IconaScansiona size={28} /><span>Scansiona</span></button>
          <button className="pp-sorgente" onClick={() => fotocamera.current.click()}><IconaFotocamera size={28} /><span>Scatta una foto</span></button>
          <button className="pp-sorgente pp-sorgente-larga" onClick={() => archivio.current.click()}><IconaFile size={28} /><span>Foto, PDF o file da iCloud, Drive e altre app</span></button>
        </div>
      ) : (
        <div className="pp-scelto">
          {anteprima ? <img src={anteprima} alt="" /> : <span className="pp-scelto-icona"><IconaFile size={28} /></span>}
          <div><strong>{file.name}</strong><span className="pp-riga-meta">{file.size < 1048576 ? `${Math.max(1, Math.round(file.size / 1024))} KB` : `${(file.size / 1048576).toFixed(1)} MB`}</span></div>
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
      <Sezione titolo="Categorie delle spese">
        <ListaModificabile
          voci={impostazioni.categorieSpesa.map((c) => ({ id: c, nome: c }))}
          onTogli={(c) => salvaImp({ ...impostazioni, categorieSpesa: impostazioni.categorieSpesa.filter((x) => x !== c) })}
          onAggiungi={(c) => salvaImp({ ...impostazioni, categorieSpesa: [...impostazioni.categorieSpesa, c] })}
          segnaposto="Es. Animali"
        />
      </Sezione>
      <Sezione titolo="Categorie degli incassi">
        <ListaModificabile
          voci={impostazioni.categorieIncasso.map((c) => ({ id: c, nome: c }))}
          onTogli={(c) => salvaImp({ ...impostazioni, categorieIncasso: impostazioni.categorieIncasso.filter((x) => x !== c) })}
          onAggiungi={(c) => salvaImp({ ...impostazioni, categorieIncasso: [...impostazioni.categorieIncasso, c] })}
          segnaposto="Es. Vendite"
        />
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

// Poliedron come scheda a pagina intera (PO 2026-10-17): la conversazione resta passando da una
// scheda all'altra; la graffetta allega una foto, un PDF o un file, che viene archiviato e letto.
function VistaPoliedron({ ctx, chat, setChat }) {
  const { apri, aggiorna } = ctx;
  const { modo, messaggi, documento } = chat;
  const [testo, setTesto] = useState('');
  const [file, setFile] = useState(null);
  const [attesa, setAttesa] = useState(null);
  const lista = useRef(null);
  const selettore = useRef(null);
  useEffect(() => { const el = lista.current; if (el) el.scrollTop = el.scrollHeight; }, [messaggi.length, attesa]);
  const aggiungi = (m) => setChat((c) => ({ ...c, messaggi: [...c.messaggi, m] }));

  const invia = async (scritto) => {
    const allegato = file;
    if (!puoInviare({ testo: scritto, file: allegato, attesa })) return;
    const q = scritto.trim();
    setTesto(''); setFile(null);
    const storia = storiaChat(messaggi);
    aggiungi({ ruolo: 'utente', testo: q, allegato: allegato ? { nome: allegato.name, dimensione: dimensioneFile(allegato.size) } : null });
    let documentoId = documento?.id || null;
    if (allegato) {
      setAttesa('Archivio il file e lo leggo…');
      try {
        const r = await caricaDocumento({ token: await tokenSessione(), ...(await preparaCaricamento(allegato)) });
        aggiorna();
        const esito = esitoAllegato(r, allegato.name);
        documentoId = esito.documento?.id || documentoId;
        setChat((c) => ({ ...c, documento: esito.documento || c.documento, messaggi: [...c.messaggi, esito.messaggio] }));
      } catch (e) {
        aggiungi({ ruolo: 'assistente', fonte: 'archivio', nota: `File non archiviato: ${e.message}` });
        setAttesa(null);
        return;
      }
    }
    const domanda = domandaDa(q, Boolean(allegato));
    let nuovo = null;
    if (modo === 'ai') {
      setAttesa('Cerco nell\'archivio…');
      try {
        nuovo = { ruolo: 'assistente', testo: await chiediPoliedron({ token: await tokenSessione(), domanda, documentoId, storia }), fonte: 'ai' };
      } catch (e) {
        nuovo = q
          ? { ruolo: 'assistente', risposta: await rispondi(archivioDb, q).catch(() => null), fonte: 'core', nota: `${e.message} Ti rispondo con la ricerca di Poliedron.` }
          : { ruolo: 'assistente', fonte: 'core', nota: e.message };
      }
    } else if (q) {
      setAttesa('Cerco…');
      nuovo = { ruolo: 'assistente', risposta: await rispondi(archivioDb, q).catch(() => null), fonte: 'core' };
    }
    if (nuovo) aggiungi(nuovo);
    setAttesa(null);
  };

  const scegliFile = (e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) setFile(f); };
  const etichettaFonte = (m) => (m.fonte === 'ai' ? 'Poliedron AI' : m.fonte === 'archivio' ? 'Poliedron · archivio' : 'Poliedron · ricerca');

  return (
    <div className="pp-chat">
      <div className="pp-chat-modo"><Segmenti voci={[['ai', 'Poliedron AI'], ['core', 'Solo ricerca']]} attiva={modo} onScegli={(m) => setChat((c) => ({ ...c, modo: m }))} /></div>
      <div className="pp-chat-lista" ref={lista}>
        {!messaggi.length && (
          <div className="pp-chat-vuota">
            <p>{modo === 'ai' ? 'Chiedimi qualsiasi cosa sull\'archivio: documenti, pagamenti, pratiche, persone. Con la graffetta mi mandi una foto o un PDF: lo archivio e ti dico cos\'è.' : 'Ricerca senza AI: fornitori, bollette, scadenze, "quanto devo a…", pratiche.'}</p>
            <div className="pp-suggerimenti">
              {(documento ? ['Riassumimi questo documento', 'Cosa devo fare?', 'Ci sono scadenze?'] : SUGGERIMENTI_CHAT).map((x) => <button key={x} className="pp-chip" onClick={() => invia(x)}>{x}</button>)}
            </div>
          </div>
        )}
        {messaggi.map((m, i) => (
          <div key={i} className={`pp-messaggio-chat ${m.ruolo}`}>
            {m.ruolo === 'utente' ? (
              <>
                {m.allegato && <span className="pp-chat-allegato"><IconaGraffetta size={15} /> {m.allegato.nome} · {m.allegato.dimensione}</span>}
                {m.testo}
              </>
            ) : (
              <>
                {m.nota && <p className="pp-riga-meta">{m.nota}</p>}
                {m.archiviato && <p className="pp-chat-testo">{m.duplicato ? 'Era già in archivio: ' : 'Archiviato: '}
                  <button className="pp-chat-link" onClick={() => apri({ tipo: 'documento', id: m.archiviato.id })}><IconaFile size={14} />{m.archiviato.titolo}</button></p>}
                {m.testo && <div className="pp-chat-testo">{partiRisposta(m.testo).map((p, j) => (p.doc
                  ? <button key={j} className="pp-chat-link" onClick={() => apri({ tipo: 'documento', id: p.doc })}><IconaFile size={14} />{p.titolo}</button>
                  : <span key={j}>{p.testo}</span>))}</div>}
                {m.risposta && <Risultato risposta={m.risposta} ctx={ctx} />}
                {m.fonte === 'core' && !m.risposta && !m.nota && <p>Nessun risultato.</p>}
                <span className="pp-chat-fonte">{etichettaFonte(m)}</span>
              </>
            )}
          </div>
        ))}
        {attesa && <div className="pp-messaggio-chat assistente"><span className="pp-rotella" /> {attesa}</div>}
      </div>
      <div className="pp-chat-composer">
        {(documento || file) && (
          <div className="pp-chat-contesti">
            {documento && <span className="pp-chat-contesto">
              <button onClick={() => apri({ tipo: 'documento', id: documento.id })}><IconaFile size={14} /> Sul documento: <strong>{documento.titolo}</strong></button>
              <button className="pp-chat-togli" onClick={() => setChat((c) => ({ ...c, documento: null }))} aria-label="Non parlare più di questo documento"><IconaChiudi size={14} /></button>
            </span>}
            {file && <span className="pp-chat-contesto pp-chat-file">
              <span><IconaGraffetta size={14} /> <strong>{file.name}</strong> · {dimensioneFile(file.size)}</span>
              <button className="pp-chat-togli" onClick={() => setFile(null)} aria-label="Togli l'allegato"><IconaChiudi size={14} /></button>
            </span>}
          </div>
        )}
        <form className="pp-chat-barra" onSubmit={(e) => { e.preventDefault(); invia(testo); }}>
          <input ref={selettore} type="file" accept={ACCETTA_ALLEGATI} hidden onChange={scegliFile} />
          <button type="button" className="pp-chat-allega" onClick={() => selettore.current?.click()} disabled={Boolean(attesa)} aria-label="Allega una foto, un PDF o un file"><IconaGraffetta size={21} /></button>
          <input value={testo} onChange={(e) => setTesto(e.target.value)} placeholder={file ? 'Domanda (facoltativa)…' : 'Scrivi a Poliedron…'} enterKeyHint="send" aria-label="Domanda a Poliedron" />
          <button type="submit" className="pp-chat-invia" disabled={!puoInviare({ testo, file, attesa })} aria-label="Invia"><IconaInvia size={20} /></button>
        </form>
      </div>
    </div>
  );
}

const TITOLI_PAGINE = {
  evento: 'Evento', appuntamento: 'Appuntamento', documento: 'Documento', pagamento: 'Pagamento', pratica: 'Pratica',
  carica: 'Archivia un documento', impostazioni: 'Impostazioni', sezione: 'Sezione', scansione: 'Scansiona', scadenza: 'Pagamento da fare',
};
const titoloPagina = (p) => p.titolo || (p.tipo === 'movimento' ? (p.m?.id ? 'Movimento' : p.m?.tipo === 'entrata' ? 'Nuovo incasso' : 'Nuova spesa') : TITOLI_PAGINE[p.tipo]);
// Pagine con un modulo o con la propria barra in basso: niente tasto di chiusura in basso.
const PAGINE_MODULO = new Set(['carica', 'scansione', 'movimento', 'scadenza', 'evento', 'sezione', 'impostazioni']);

/* ---------- app ---------- */
const VISTE = [
  ['oggi', 'Oggi', IconaOggi],
  ['documenti', 'Documenti', IconaDocumenti],
  ['agenda', 'Agenda', IconaCalendario],
  ['conti', 'Conti', IconaEuro],
  ['personali', 'Personali', IconaPortafoglio],
];
const TITOLI = { documenti: 'Documenti', agenda: 'Agenda', conti: 'Conti', personali: 'Personali', poliedron: 'Poliedron' };
const vistaIniziale = () => { if (readAgendaLocation().requested) return 'agenda'; const v = leggiVista() === 'pagamenti' ? 'conti' : leggiVista(); return VISTE.some(([k]) => k === v) || v === 'poliedron' ? v : 'oggi'; };

function Archivio({ email }) {
  const [vista, setVistaStato] = useState(vistaIniziale);
  const [sotto, setSotto] = useState(null);
  const [pagine, setPagine] = useState([]);
  const [errore, setErrore] = useState(null);
  const [toast, setToast] = useState(null);
  const [occupato, setOccupato] = useState(0);
  const [versione, setVersione] = useState(0);
  const [fascicoli, setFascicoli] = useState([]);
  const [foglio, setFoglio] = useState(false);
  const [chat, setChat] = useState(CHAT_VUOTA);
  const [impostazioni, setImpostazioni] = useState(() => JSON.parse(JSON.stringify(IMPOSTAZIONI_PREDEFINITE)));
  const contatore = useRef(0);
  const ingressi = { fotocamera: useRef(null), libreria: useRef(null), file: useRef(null) };

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
  const vai = useCallback((v, sottoVista = null) => {
    setPagine([]); setVistaStato(v); setSotto(sottoVista); setErrore(null);
    try { localStorage.setItem(VISTA_KEY, v); } catch { /* facoltativo */ }
    window.scrollTo(0, 0);
  }, []);
  const apri = useCallback((p) => { contatore.current += 1; setErrore(null); setFoglio(false); setPagine((st) => [...st, { ...p, chiave: contatore.current }]); }, []);
  const indietro = useCallback(() => { setErrore(null); setPagine((st) => st.slice(0, -1)); }, []);
  const sostituisci = useCallback((p) => { contatore.current += 1; setPagine((st) => [...st.slice(0, -1), { ...p, chiave: contatore.current }]); }, []);

  // Tasto + e azioni rapide della Home. Foto e file: il selettore si apre subito (gesto dell'utente).
  const aggiungi = useCallback((id) => {
    setFoglio(false);
    if (ingressi[id]) { ingressi[id].current?.click(); return; }
    const pagina = {
      scansiona: { tipo: 'scansione' },
      personale: { tipo: 'carica', opzioni: { fascicolo: 'identita', portafoglio: true } },
      spesa: { tipo: 'movimento', m: { tipo: 'uscita' } },
      incasso: { tipo: 'movimento', m: { tipo: 'entrata' } },
      pagamento: { tipo: 'scadenza' },
      evento: { tipo: 'evento' },
      appuntamento: { tipo: 'evento', cosa: 'appuntamento' },
    }[id];
    if (pagina) apri(pagina);
  }, [apri]); // eslint-disable-line react-hooks/exhaustive-deps
  const fileScelto = (e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) apri({ tipo: 'carica', file: f }); };

  // Dal documento: la chat di Poliedron riparte su quel documento (la conversazione resta).
  const apriChat = useCallback((documento = null) => {
    if (documento) setChat((c) => ({ ...c, documento }));
    vai('poliedron');
  }, [vai]);

  const ctx = {
    esegui, aggiorna, mostra, versione, impostazioni, salvaImp, fascicoli, apri, vai, aggiungi, sotto, apriChat,
    pagato: (s) => esegui(async () => {
      await segnaScadenza(archivioDb, s.id, true);
      const spesa = await spesaDaScadenza(archivioDb, s).catch(() => null);
      const prossimo = s.ricorrenza ? await prossimoPagamentoFisso(archivioDb, s).catch(() => null) : null;
      aggiorna();
      mostra([spesa ? 'Pagato e registrato tra le spese' : 'Segnato come pagato', prossimo ? `prossimo il ${new Date(`${prossimo.data}T12:00:00`).toLocaleDateString('it-IT', { day: 'numeric', month: 'short' })}` : null].filter(Boolean).join(' · '));
    }),
  };

  useEffect(() => {
    document.body.classList.toggle('pp-con-pagina', pagine.length > 0);
  }, [pagine.length]);

  const contenutoPagina = (p) => {
    switch (p.tipo) {
      case 'documento': return <PaginaDocumento id={p.id} ctx={ctx} chiudi={indietro} />;
      case 'pagamento': return <PaginaPagamento s={p.s} ctx={ctx} chiudi={indietro} />;
      case 'pratica': return <PaginaPratica p={p.p} ctx={ctx} />;
      case 'elenco': return <PaginaRicerca carica={p.carica} ctx={ctx} />;
      case 'ricerca': return <PaginaRicerca filtri={p.filtri} sezione={p.sezione} ctx={ctx} />;
      case 'carica': return <PaginaCarica opzioni={p.opzioni || {}} file={p.file} ctx={ctx} sostituisci={sostituisci} />;
      case 'scansione': return <PaginaScansione ctx={ctx} sostituisci={sostituisci} />;
      case 'movimento': return <PaginaMovimento m={p.m || {}} ctx={ctx} chiudi={indietro} />;
      case 'scadenza': return <PaginaNuovaScadenza ctx={ctx} chiudi={indietro} />;
      case 'impostazioni': return <PaginaImpostazioni ctx={ctx} email={email} />;
      case 'sezione': return <PaginaSezione id={p.id} ctx={ctx} chiudi={indietro} />;
      case 'evento': return <PaginaEvento evento={p.evento} cosa={p.cosa} ctx={ctx} chiudi={indietro} />;
      case 'appuntamento': return <PaginaAppuntamento a={p.a} ctx={ctx} chiudi={indietro} />;
      default: return null;
    }
  };

  return (
    <div className="pp-app">
      <input ref={ingressi.fotocamera} type="file" accept="image/*" capture="environment" hidden onChange={fileScelto} />
      <input ref={ingressi.libreria} type="file" accept="image/*" hidden onChange={fileScelto} />
      <input ref={ingressi.file} type="file" hidden onChange={fileScelto} />
      <header className={`pp-testata${vista === 'agenda' && !pagine.length ? ' pp-testata-agenda' : ''}`}>
        {vista !== 'agenda' && <h1>{vista === 'oggi' ? saluto() : TITOLI[vista]}</h1>}
        {!pagine.length && !foglio && <span className="pp-testata-azioni">
          {vista === 'poliedron' && chat.messaggi.length > 0 && <button className="pp-testo-link pp-nuova-chat" onClick={() => setChat((c) => ({ ...CHAT_VUOTA, modo: c.modo }))}>Nuova chat</button>}
          <button className="pp-icona-bottone" onClick={() => apri({ tipo: 'impostazioni' })} aria-label="Impostazioni"><IconaImpostazioni size={20} /></button>
        </span>}
      </header>
      {occupato > 0 && <div className="pp-barra-caricamento" aria-hidden="true" />}
      {errore && !pagine.length && <p className="pp-messaggio pp-messaggio-errore" role="alert">{errore}</p>}
      <main className={`pp-contenuto${vista === 'agenda' ? ' pp-contenuto-agenda' : ''}${vista === 'poliedron' ? ' pp-contenuto-chat' : ''}`} key={`${vista}-${sotto || ''}`}>
        {vista === 'oggi' && <VistaOggi ctx={ctx} />}
        {vista === 'documenti' && <VistaDocumenti ctx={ctx} />}
        {vista === 'agenda' && <VistaAgenda ctx={ctx} />}
        {vista === 'conti' && <VistaConti ctx={ctx} />}
        {vista === 'personali' && <VistaPersonali ctx={ctx} />}
        {vista === 'poliedron' && <VistaPoliedron ctx={ctx} chat={chat} setChat={setChat} />}
      </main>
      {pagine.map((p, i) => (
        <Pagina key={p.chiave} titolo={titoloPagina(p)} visibile={i === pagine.length - 1} onIndietro={indietro} senzaChiudi={PAGINE_MODULO.has(p.tipo)}>
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
        <button className={`pp-scheda pp-scheda-poliedron${vista === 'poliedron' && !pagine.length ? ' attiva' : ''}${vista === 'poliedron' && pagine.length ? ' sotto' : ''}`} onClick={() => vai('poliedron')} aria-label="Apri Poliedron" aria-current={vista === 'poliedron' ? 'page' : undefined}><IconaChat size={23} /><span>Poliedron</span></button>
      </nav>
      {!pagine.length && vista !== 'poliedron' && <button className="pp-fab" onClick={() => setFoglio(true)} aria-label="Aggiungi"><IconaPiu size={26} /></button>}
      {foglio && <FoglioAggiungi onScegli={aggiungi} onChiudi={() => setFoglio(false)} />}
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
