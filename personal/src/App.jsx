import { Pagina } from './Pagina.jsx';
import { readAgendaLocation } from '../../shared/agenda/navigation.js';
// POL-VITA-003/006 — Poliedron Personal: app per telefono dell'archivio personale.
// Dock: Oggi · Documenti · Agenda · Conti · Personali. Ogni dettaglio si apre come pagina sopra la
// sezione, con "Indietro" in alto, il tasto di chiusura in basso a portata di pollice e il dock
// sempre visibile; chiudendo si torna dov'eri. Il + apre tutte le aggiunte.
// POL-VITA-017 — qui c'è solo la cornice; le sezioni sono in sezioni/ (vedi sezioni/index.js).
import { useCallback, useEffect, useRef, useState } from 'react';
import { archivioDb } from './lib/supabasePersonal.js';
import { conteggiFascicoli } from './lib/archivio.js';
import { segnaPagato, annullaPagato } from './lib/automatismi.js';
import { impostaToken } from './lib/miniature.js';
import { CHAT_VUOTA } from './lib/chat.js';
import { IMPOSTAZIONI_PREDEFINITE, leggiImpostazioni, salvaImpostazioni } from './lib/impostazioni.js';
import { saluto, VISTA_KEY, leggiVista, tokenSessione } from './ui.jsx';
import { differito } from './Differito.jsx';
const FoglioAggiungi = differito(() => import('./Aggiungi.jsx'), 'FoglioAggiungi');
import { Accesso, NuovaPassword } from './Accesso.jsx';
import { DOCK, sezione, pagina, titoloPagina, eModulo } from './sezioni/index.js';
import { IconaPiu, IconaImpostazioni, IconaChat } from './Icone.jsx';

impostaToken(tokenSessione);

const vistaIniziale = () => { if (readAgendaLocation().requested) return 'agenda'; const v = leggiVista() === 'pagamenti' ? 'conti' : leggiVista(); return sezione(v) ? v : 'oggi'; };

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
  // Avviso in basso; con `azione` ({ etichetta, fai }) resta di più e ha il tasto (es. Annulla).
  const timerToast = useRef(null);
  const mostra = useCallback((t, azione = null) => {
    clearTimeout(timerToast.current);
    setToast({ testo: t, azione });
    timerToast.current = setTimeout(() => setToast(null), azione ? 7000 : 2600);
  }, []);
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
    const nuova = {
      scansiona: { tipo: 'scansione' },
      personale: { tipo: 'carica', opzioni: { fascicolo: 'identita', portafoglio: true } },
      fotovideo: { tipo: 'carica', opzioni: { fascicolo: 'foto_video', descrizione: 'Foto o video personale' } },
      spesa: { tipo: 'movimento', m: { tipo: 'uscita' } },
      incasso: { tipo: 'movimento', m: { tipo: 'entrata' } },
      pagamento: { tipo: 'scadenza' },
      evento: { tipo: 'evento' },
      appuntamento: { tipo: 'evento', cosa: 'appuntamento' },
    }[id];
    if (nuova) apri(nuova);
  }, [apri]); // eslint-disable-line react-hooks/exhaustive-deps
  const fileScelto = (e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) apri({ tipo: 'carica', file: f }); };

  // Dal documento: la chat di Poliedron riparte su quel documento (la conversazione resta).
  const apriChat = useCallback((documento = null) => {
    if (documento) setChat((c) => ({ ...c, documento }));
    vai('poliedron');
  }, [vai]);

  const ctx = {
    esegui, aggiorna, mostra, versione, impostazioni, salvaImp, fascicoli, apri, vai, aggiungi, sotto, apriChat, chat, setChat,
    // Pagato da un elenco: spesa e prossimo fisso si creano da soli, Annulla li toglie (POL-VITA-021).
    pagato: (s) => esegui(async () => {
      const r = await segnaPagato(archivioDb, s);
      aggiorna();
      mostra(r.messaggio, { etichetta: 'Annulla', fai: async () => { const m = await annullaPagato(archivioDb, r.annulla); aggiorna(); return m; } });
    }),
  };

  useEffect(() => {
    document.body.classList.toggle('pp-con-pagina', pagine.length > 0);
  }, [pagine.length]);

  const attuale = sezione(vista);
  const { Vista, AzioniTestata } = attuale;
  const sopra = pagine.length > 0;
  const classeScheda = (id) => `${vista === id && !sopra ? ' attiva' : ''}${vista === id && sopra ? ' sotto' : ''}`;

  return (
    <div className="pp-app">
      <input ref={ingressi.fotocamera} type="file" accept="image/*" capture="environment" hidden onChange={fileScelto} />
      <input ref={ingressi.libreria} type="file" accept="image/*" hidden onChange={fileScelto} />
      <input ref={ingressi.file} type="file" hidden onChange={fileScelto} />
      <header className={`pp-testata${attuale.classeTestata && !sopra ? ` ${attuale.classeTestata}` : ''}`}>
        {!attuale.senzaTitolo && <h1>{vista === 'oggi' ? saluto() : attuale.nome}</h1>}
        {!sopra && !foglio && <span className="pp-testata-azioni">
          {AzioniTestata && <AzioniTestata ctx={ctx} />}
          <button className="pp-icona-bottone" onClick={() => apri({ tipo: 'impostazioni' })} aria-label="Impostazioni"><IconaImpostazioni size={20} /></button>
        </span>}
      </header>
      {occupato > 0 && <div className="pp-barra-caricamento" aria-hidden="true" />}
      {errore && !sopra && <p className="pp-messaggio pp-messaggio-errore" role="alert">{errore}</p>}
      <main className={`pp-contenuto${attuale.classeContenuto ? ` ${attuale.classeContenuto}` : ''}`} key={`${vista}-${sotto || ''}`}>
        <Vista ctx={ctx} />
      </main>
      {pagine.map((p, i) => (
        <Pagina key={p.chiave} titolo={titoloPagina(p)} visibile={i === pagine.length - 1} onIndietro={indietro} senzaChiudi={eModulo(p.tipo)}>
          {i === pagine.length - 1 && errore && <p className="pp-messaggio pp-messaggio-errore" role="alert">{errore}</p>}
          {pagina(p.tipo)?.render(p, { ctx, chiudi: indietro, sostituisci, email }) ?? null}
        </Pagina>
      ))}
      <nav className="pp-schede" aria-label="Sezioni">
        {DOCK.map(({ id, nome, Icona }) => (
          <button key={id} className={`pp-scheda${classeScheda(id)}`} onClick={() => vai(id)} aria-current={vista === id ? 'page' : undefined}>
            <Icona size={22} /><span>{nome}</span>
          </button>
        ))}
        <button className={`pp-scheda pp-scheda-poliedron${classeScheda('poliedron')}`} onClick={() => vai('poliedron')} aria-label="Apri Poliedron" aria-current={vista === 'poliedron' ? 'page' : undefined}><IconaChat size={23} /><span>Poliedron</span></button>
      </nav>
      {!sopra && !attuale.senzaPiu && <button className="pp-fab" onClick={() => setFoglio(true)} aria-label="Aggiungi"><IconaPiu size={26} /></button>}
      {foglio && <FoglioAggiungi onScegli={aggiungi} onChiudi={() => setFoglio(false)} />}
      {toast && (
        <div className={`pp-toast${toast.azione ? ' pp-toast-azione' : ''}`} role="status">
          <span>{toast.testo}</span>
          {toast.azione && <button onClick={() => { const { fai } = toast.azione; setToast(null); esegui(async () => mostra(await fai())); }}>{toast.azione.etichetta}</button>}
        </div>
      )}
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
