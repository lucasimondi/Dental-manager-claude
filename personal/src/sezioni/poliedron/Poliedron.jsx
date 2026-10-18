// Poliedron — la tua assistente personale a pagina intera: AI sull'archivio e sull'agenda o sola
// ricerca, allegati con la graffetta, promemoria e pagamenti proposti da aggiungere con un tasto.
import { useEffect, useRef, useState } from 'react';
import { archivioDb } from '../../lib/supabasePersonal.js';
import { rispondi, caricaDocumento, chiediPoliedronCompleto, partiRisposta, pagamenti as caricaPagamenti, RICORRENZE, eliminaScadenza } from '../../lib/archivio.js';
import { nuovaScadenza, CATEGORIE_PAGAMENTO } from '../../lib/conti.js';
import { sessioneStudio, appuntamentiTra, impegniTra, salvaImpegno, eliminaImpegno } from '../../lib/studio.js';
import { oggi as oggiAgenda, piuGiorni } from '../../lib/agenda.js';
import {
  SUGGERIMENTI_ASSISTENTE, benvenuto, agendaPerAssistente, giornataRichiesta, giorniTraDate, promemoriaIniziale, aggiungiPromemoria, annullaPromemoria,
} from '../../lib/assistente.js';
import { ElencoGiorno } from '../agenda/index.jsx';
import { titoloProposta, elementiScelti, eseguiProposta, esitoProposta } from '../../lib/pulizia.js';
import { euro } from '../../lib/coreArchivio.js';
import { preparaFile as preparaCaricamento } from '../../lib/file.js';
import { ACCETTA_ALLEGATI, dimensioneFile, domandaDa, esitoAllegato, puoInviare, storiaChat } from '../../lib/chat.js';
import { tokenSessione, Sezione, Gruppo, RigaDocumento, RigaPagamento, Segmenti, ElencoPratiche } from '../../ui.jsx';
import { IconaChiudi, IconaFile, IconaInvia, IconaGraffetta, IconaCalendario, IconaEuro } from '../../Icone.jsx';

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

/* ---------- Proposte di pulizia in massa: Luca sceglie e conferma ---------- */
function Proposta({ proposta, ctx, onFatto }) {
  const { apri, aggiorna } = ctx;
  const [esclusi, setEsclusi] = useState(() => new Set());
  const [aperta, setAperta] = useState(false);
  const [ancheDrive, setAncheDrive] = useState(true);
  const [ancheEmail, setAncheEmail] = useState(true);
  const [stato, setStato] = useState(null);
  const scelti = elementiScelti(proposta, esclusi);
  const clinici = scelti.filter((e) => e.fascicolo === 'clinico_pazienti').length;
  const commuta = (id) => setEsclusi((x) => { const n = new Set(x); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const conferma = async () => {
    setStato({ lavoro: true, testo: 'Sto eseguendo…' });
    try {
      const r = await eseguiProposta({ proposta, elementi: scelti, db: archivioDb, token: await tokenSessione(), ancheDrive, ancheEmail,
        avanzamento: (fatti, totale) => setStato({ lavoro: true, testo: `${fatti} di ${totale}…` }) });
      aggiorna();
      onFatto(esitoProposta(proposta, r));
    } catch (e) { setStato({ errore: e.message }); }
  };
  if (proposta.fatto) return <div className="pp-proposta pp-proposta-fatta"><strong>Fatto.</strong> {proposta.fatto}</div>;
  return (
    <div className="pp-proposta">
      <strong>{titoloProposta(proposta, scelti.length)}</strong>
      {proposta.descrizione && <span className="pp-riga-meta">{proposta.descrizione}</span>}
      {!proposta.completa && <span className="pp-riga-meta">Sono i primi {proposta.n}: dopo la conferma chiedi di nuovo per i successivi.</span>}
      {clinici > 0 && <span className="pp-riga-meta pp-rosso">Comprende {clinici} documenti dei pazienti.</span>}
      <button className="pp-testo-link" onClick={() => setAperta((x) => !x)}>{aperta ? 'Nascondi elenco' : `Vedi elenco e togli quelli da tenere (${proposta.elementi.length})`}</button>
      {aperta && (
        <ul className="pp-proposta-elenco">
          {proposta.elementi.map((e) => (
            <li key={e.id}>
              <label><input type="checkbox" checked={!esclusi.has(e.id)} onChange={() => commuta(e.id)} /> <span>{e.titolo}</span></label>
              {proposta.tipo !== 'risolvi_pratiche' && <button className="pp-chat-togli" onClick={() => apri({ tipo: 'documento', id: e.id })} aria-label="Apri"><IconaFile size={14} /></button>}
            </li>
          ))}
        </ul>
      )}
      {proposta.tipo === 'elimina' && (
        <>
          <label className="pp-conferma-drive"><input type="checkbox" checked={ancheDrive} onChange={(e) => setAncheDrive(e.target.checked)} /><span>Anche i file su Google Drive <small>(Cestino di Drive, 30 giorni)</small></span></label>
          <label className="pp-conferma-drive"><input type="checkbox" checked={ancheEmail} onChange={(e) => setAncheEmail(e.target.checked)} /><span>Anche le email da cui arrivano <small>(Cestino di Gmail, 30 giorni; tenute se hanno altri allegati utili)</small></span></label>
        </>
      )}
      {stato?.errore && <p className="pp-messaggio pp-messaggio-errore">{stato.errore}</p>}
      <button className={`pp-bottone ${proposta.tipo === 'elimina' ? 'pp-bottone-rosso' : 'pp-bottone-verde'}`} disabled={!scelti.length || stato?.lavoro} onClick={conferma}>
        {stato?.lavoro ? stato.testo : `Conferma: ${titoloProposta(proposta, scelti.length).toLowerCase()}`}
      </button>
    </div>
  );
}

/* ---------- Promemoria proposto da Poliedron: Luca lo corregge e lo aggiunge ---------- */
function PropostaPromemoria({ proposta, ctx, onFatto }) {
  const { aggiorna } = ctx;
  const [m, setM] = useState(() => promemoriaIniziale(proposta));
  const [stato, setStato] = useState(null);
  const cambia = (campo) => (e) => setM((x) => ({ ...x, [campo]: e.target.value }));
  const togli = async () => {
    setStato({ lavoro: true });
    try {
      const msg = await annullaPromemoria(proposta.annulla, { eliminaScadenza: (id) => eliminaScadenza(archivioDb, id), eliminaImpegno });
      aggiorna(); setStato(null); onFatto(msg, null);
    } catch (e) { setStato({ errore: e.message }); }
  };
  if (proposta.fatto) {
    return (
      <div className="pp-proposta pp-proposta-fatta pp-promemoria-fatto">
        <span><strong>Fatto.</strong> {proposta.fatto}</span>
        {proposta.annulla && <button className="pp-testo-link" disabled={stato?.lavoro} onClick={togli}>Annulla</button>}
        {stato?.errore && <p className="pp-messaggio pp-messaggio-errore">{stato.errore}</p>}
      </div>
    );
  }
  const pagamento = m.cosa === 'pagamento';
  const aggiungi = async () => {
    setStato({ lavoro: true });
    try {
      const esito = await aggiungiPromemoria(m, {
        nuovaScadenza: (s) => nuovaScadenza(archivioDb, s),
        salvaImpegno: async (e) => {
          if (!(await sessioneStudio().catch(() => null))) throw new Error('Per gli impegni collega prima l\'agenda (scheda Agenda).');
          return salvaImpegno(e);
        },
      });
      aggiorna(); setStato(null);
      onFatto(esito.messaggio, esito.annulla);
    } catch (e) { setStato({ errore: e.message }); }
  };
  return (
    <div className="pp-proposta pp-promemoria">
      <strong>{pagamento ? <><IconaEuro size={16} /> Pagamento da fare</> : <><IconaCalendario size={16} /> Promemoria in agenda</>}</strong>
      <label className="pp-campo"><span>{pagamento ? 'Cosa pagare' : 'Cosa'}</span><input value={m.titolo} onChange={cambia('titolo')} /></label>
      <div className="pp-due">
        <label className="pp-campo"><span>Data</span><input type="date" value={m.data} onChange={cambia('data')} /></label>
        {pagamento
          ? <label className="pp-campo"><span>Importo (€)</span><input inputMode="decimal" value={m.importo} onChange={cambia('importo')} placeholder="facoltativo" /></label>
          : <label className="pp-campo"><span>Ora</span><input type="time" value={m.ora} onChange={cambia('ora')} /></label>}
      </div>
      {pagamento && (
        <div className="pp-due">
          <label className="pp-campo"><span>Tipo</span>
            <select className="pp-select" value={m.categoria} onChange={cambia('categoria')}>
              <option value="">—</option>
              {[...new Set([...CATEGORIE_PAGAMENTO, ...(m.categoria ? [m.categoria] : [])])].map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </label>
          <label className="pp-campo"><span>Si ripete</span>
            <select className="pp-select" value={m.ricorrenza} onChange={cambia('ricorrenza')}>
              {RICORRENZE.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </select>
          </label>
        </div>
      )}
      {!pagamento && !m.ora && <span className="pp-riga-meta">Senza ora: tutto il giorno.</span>}
      {stato?.errore && <p className="pp-messaggio pp-messaggio-errore">{stato.errore}</p>}
      <button className="pp-bottone pp-bottone-verde" disabled={stato?.lavoro || !m.titolo.trim() || !m.data} onClick={aggiungi}>
        {stato?.lavoro ? 'Aggiungo…' : pagamento ? 'Aggiungi a Da pagare' : 'Aggiungi in agenda'}
      </button>
    </div>
  );
}

/* ---------- La giornata: agenda e pagamenti, risposti dall'app (anche senza AI) ---------- */
async function caricaGiornata({ da, a }) {
  const [scadenze, collegata] = await Promise.all([caricaPagamenti(archivioDb).catch(() => []), sessioneStudio().catch(() => null)]);
  const nelPeriodo = scadenze.filter((s) => s.data >= da && s.data <= a && !s.completata);
  if (!collegata) return { appuntamenti: [], impegni: [], scadenze: nelPeriodo, collegata: false };
  const [appuntamenti, impegni] = await Promise.all([appuntamentiTra(da, a).catch(() => []), impegniTra(da, a).catch(() => [])]);
  return { appuntamenti, impegni, scadenze: nelPeriodo, collegata: true };
}

function fraseGiornata(g) {
  const { dati } = g;
  const app = dati.appuntamenti.filter((x) => x.stato !== 'annullato').length;
  const parti = [];
  if (app) parti.push(`${app} ${app === 1 ? 'appuntamento' : 'appuntamenti'} in studio`);
  if (dati.impegni.length) parti.push(`${dati.impegni.length} ${dati.impegni.length === 1 ? 'impegno tuo' : 'impegni tuoi'}`);
  if (dati.scadenze.length) parti.push(`${dati.scadenze.length} ${dati.scadenze.length === 1 ? 'pagamento' : 'pagamenti'} in scadenza`);
  const quando = g.titolo === 'Oggi' ? 'Oggi hai' : g.titolo === 'Domani' ? 'Domani hai' : g.titolo === 'Dopodomani' ? 'Dopodomani hai' : 'Nei prossimi 7 giorni hai';
  return parti.length ? `${quando} ${parti.join(', ')}.` : `${quando.replace(' hai', '')} niente in programma.`;
}

function Giornata({ giornata, ctx }) {
  const giorni = giorniTraDate(giornata.da, giornata.a);
  return (
    <>
      <p className="pp-frase">{fraseGiornata(giornata)}</p>
      {!giornata.dati.collegata && <p className="pp-riga-meta">L'agenda dello studio non è collegata: la colleghi dalla scheda Agenda.</p>}
      {giorni.map((g) => <ElencoGiorno key={g} giorno={g} dati={giornata.dati} ctx={ctx} etichette={ctx.impostazioni.etichette} coloriTipi={{}} intestazione={giorni.length > 1} />)}
    </>
  );
}

// Agenda dei prossimi 7 giorni per l'AI: senza nomi dei pazienti (agendaPerAssistente).
async function agendaPerAI() {
  if (!(await sessioneStudio().catch(() => null))) return null;
  const da = oggiAgenda();
  const a = piuGiorni(da, 6);
  const [appuntamenti, impegni] = await Promise.all([appuntamentiTra(da, a), impegniTra(da, a)]);
  return agendaPerAssistente({ da, impegni, appuntamenti });
}

// Poliedron come scheda a pagina intera (PO 2026-10-17): la conversazione resta passando da una
// scheda all'altra; la graffetta allega una foto, un PDF o un file, che viene archiviato e letto.
export function VistaPoliedron({ ctx }) {
  const { apri, aggiorna, chat, setChat } = ctx;
  const { modo, messaggi, documento } = chat;
  const [testo, setTesto] = useState('');
  const [file, setFile] = useState(null);
  const [attesa, setAttesa] = useState(null);
  const lista = useRef(null);
  const selettore = useRef(null);
  // Tastiera aperta (si sta scrivendo): il dock flottante sparisce e la barra scende in fondo.
  const [scrivendo, setScrivendo] = useState(false);
  const chiusura = useRef(null);
  useEffect(() => {
    document.body.classList.toggle('pp-tastiera', scrivendo);
    return () => document.body.classList.remove('pp-tastiera');
  }, [scrivendo]);
  useEffect(() => () => clearTimeout(chiusura.current), []);
  const inizioScrittura = () => { clearTimeout(chiusura.current); setScrivendo(true); };
  const fineScrittura = () => { clearTimeout(chiusura.current); chiusura.current = setTimeout(() => setScrivendo(false), 120); };
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
    // Domande sulla giornata ("cosa ho domani?"): risponde l'app con l'agenda vera, subito.
    const richiesta = !allegato && giornataRichiesta(q, oggiAgenda());
    if (richiesta) {
      setAttesa('Guardo l\'agenda…');
      try {
        aggiungi({ ruolo: 'assistente', giornata: { ...richiesta, dati: await caricaGiornata(richiesta) }, fonte: 'agenda' });
      } catch (e) {
        aggiungi({ ruolo: 'assistente', fonte: 'agenda', nota: `Agenda non disponibile: ${e.message}` });
      }
      setAttesa(null);
      return;
    }
    if (modo === 'ai') {
      setAttesa('Ci penso…');
      try {
        const agenda = await agendaPerAI().catch(() => null);
        const r = await chiediPoliedronCompleto({ token: await tokenSessione(), domanda, documentoId, storia, agenda });
        nuovo = { ruolo: 'assistente', testo: r.risposta, proposte: r.proposte, fonte: 'ai' };
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
  const etichettaFonte = (m) => (m.fonte === 'ai' ? 'Poliedron AI' : m.fonte === 'archivio' ? 'Poliedron · archivio' : m.fonte === 'agenda' ? 'Poliedron · agenda' : 'Poliedron · ricerca');

  return (
    <div className="pp-chat">
      <div className="pp-chat-modo"><Segmenti voci={[['ai', 'Poliedron AI'], ['core', 'Solo ricerca']]} attiva={modo} onScegli={(m) => setChat((c) => ({ ...c, modo: m }))} /></div>
      <div className="pp-chat-lista" ref={lista}>
        {!messaggi.length && (
          <div className="pp-chat-vuota">
            <p>{modo === 'ai' ? benvenuto() : 'Ricerca senza AI: la tua giornata ("cosa ho domani?"), fornitori, bollette, scadenze, "quanto devo a…", pratiche.'}</p>
            <div className="pp-suggerimenti">
              {(documento ? ['Riassumimi questo documento', 'Cosa devo fare?', 'Ci sono scadenze?'] : SUGGERIMENTI_ASSISTENTE).map((x) => <button key={x} className="pp-chip" onClick={() => invia(x)}>{x}</button>)}
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
                {m.giornata && <Giornata giornata={m.giornata} ctx={ctx} />}
                {(m.proposte || []).map((p, j) => {
                  const fatto = (esito, annulla = null) => setChat((c) => ({ ...c, messaggi: c.messaggi.map((x, k) => (k === i ? { ...x, proposte: x.proposte.map((y, h) => (h === j ? { ...y, fatto: esito, annulla } : y)) } : x)) }));
                  return p.tipo === 'promemoria'
                    ? <PropostaPromemoria key={j} proposta={p} ctx={ctx} onFatto={fatto} />
                    : <Proposta key={j} proposta={p} ctx={ctx} onFatto={fatto} />;
                })}
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
          <input value={testo} onChange={(e) => setTesto(e.target.value)} onFocus={inizioScrittura} onBlur={fineScrittura}
            placeholder={file ? 'Domanda (facoltativa)…' : 'Scrivi alla tua assistente…'} enterKeyHint="send" aria-label="Domanda a Poliedron" />
          {/* Il tocco su Invia non chiude la tastiera: si continua a scrivere come in Messaggi. */}
          <button type="submit" className="pp-chat-invia" disabled={!puoInviare({ testo, file, attesa })} aria-label="Invia" onPointerDown={(e) => scrivendo && e.preventDefault()}><IconaInvia size={20} /></button>
        </form>
      </div>
    </div>
  );
}
