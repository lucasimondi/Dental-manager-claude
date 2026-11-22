// PERSONAL-ESPLORA-WIN11 fase 3 — barra delle applicazioni e Start stile Windows 11.
// Sostituisce il dock (DOCK-UGUALE) senza cambiare destinazioni né viste salvate. Icone centrate:
// Start · Oggi · Agenda · Esplora file · Assistente · Personale; a destra ora, data e numero delle
// notifiche (i promemoria «Da fare», gli stessi delle notifiche sul telefono) → apre Da fare.
// Start sale dal basso: ricerca reale dell'archivio, «Aggiunte» (sezioni con pallino), «Consigliati»
// (file recenti del telefono, poi ultimi documenti), account ed Esci. Si chiude con un tocco fuori,
// con Indietro (Android / browser), con Esc o toccando di nuovo il logo.
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { archivioDb } from './lib/supabasePersonal.js';
import { documentiRecenti, documentiDaGestire } from './lib/archivio.js';
import { caricaDaGestire } from './lib/esplora.js';
import { contaDaFare } from './lib/daFare.js';
import { elencoRecenti, fileRecente } from './lib/recenti.js';
import { scaricaDocumento } from './lib/condividi.js';
import { VOCI_BARRA, voceAttiva, vociAperte, badgeBarra, vociStart, numeroNotifiche, oraData, nomeUtente, consigliati, etichettaNumero, accettaFile, APP_PER_FILE } from './lib/barra.js';
import { statoDrive, ascoltaStatoDrive, attesaDrive, testoStatoDrive } from './lib/statoDrive.js';
import { sectionDestination } from '../../shared/agenda/navigation.js';
import { IconaCartellaW11, IconaFileW11 } from './IconeW11.jsx';
import { IconaDock } from './IconeDock.jsx';
import {
  IconaOggi, IconaChat, IconaPerTe, IconaCerca, IconaDocumenti, IconaEuro, IconaPratiche, IconaPortafoglio, IconaNote,
  IconaLucchetto, IconaFoto, IconaImpostazioni, IconaEsci, IconaCalendario,
} from './Icone.jsx';
import gemmaPoliedron from '../../src/assets/icon-poliedra-gem.png';
import './barra.css';

const ICONE_START = {
  oggi: IconaOggi, agenda: IconaCalendario, documenti: IconaDocumenti, dafare: IconaPerTe, conti: IconaEuro, legal: IconaPratiche,
  pratiche: IconaPratiche, personali: IconaPortafoglio, diario: IconaNote, note: IconaNote, password: IconaLucchetto, foto: IconaFoto,
  concordato: IconaPratiche, studio: (p) => <IconaDock n="brief" s={p.size} />, impostazioni: IconaImpostazioni,
};
const Numero = ({ n, classe = '' }) => { const t = etichettaNumero(n); return t ? <span className={`pb-pallino ${classe}`} aria-hidden="true">{t}</span> : null; };

// Pallini della barra e di Start: stessi criteri di Esplora, Da fare e Documenti (nessun conteggio nuovo
// sul server). Calcolati dopo il primo disegno, così l'apertura dell'app non rallenta.
export function useConteggiBarra(versione) {
  const [conteggi, setConteggi] = useState({});
  useEffect(() => {
    let vivo = true;
    const t = setTimeout(() => {
      Promise.all([
        caricaDaGestire(archivioDb).then((m) => m.size).catch(() => 0),
        contaDaFare(archivioDb).catch(() => ({ aperte: 0, urgenti: 0 })),
        documentiDaGestire(archivioDb).then((l) => l.length).catch(() => 0),
        // file che lo script deve ancora sistemare su Drive (note '>cartella:…'): stato di sincronizzazione
        archivioDb.from('documenti').select('id', { count: 'exact', head: true }).like('drive_cartella', '>cartella:%').then((r) => r.count || 0, () => 0),
      ]).then(([esplora, dafare, documenti, inAttesa]) => { if (vivo) { setConteggi({ esplora, dafare: dafare.aperte, urgenti: dafare.urgenti, documenti }); attesaDrive(inAttesa); } });
    }, 1200);
    return () => { vivo = false; clearTimeout(t); };
  }, [versione]);
  return conteggi;
}

// PR #337: un file trascinato da Esplora su un'icona della barra si apre con quell'app
// (Assistente = chat sul documento, Agenda = nuovo impegno con il link; Esplora apre l'anteprima da sé).
export function useApriCon(apri, apriChat) {
  useEffect(() => {
    const apriCon = (e) => {
      const { app, documento, link } = e.detail || {};
      if (!documento) return;
      if (app === 'poliedron') apriChat(documento);
      else if (app === 'agenda') apri({ tipo: 'evento', evento: { titolo: documento.titolo || 'Documento', note: link ? `Documento: ${link}` : '' } });
    };
    window.addEventListener('poliedra:apri-con', apriCon);
    return () => window.removeEventListener('poliedra:apri-con', apriCon);
  }, [apri, apriChat]);
}

function IconaVoce({ id }) {
  if (id === 'start') return <img className="pb-logo" src={gemmaPoliedron} alt="" draggable={false} />;
  if (id === 'drive-ok') return <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true"><path d="M6 15.5h8.5a3.2 3.2 0 0 0 .4-6.4A4.8 4.8 0 0 0 5.6 8 3.8 3.8 0 0 0 6 15.5Z" fill="none" stroke="currentColor" strokeWidth="1.3" /><path d="m8 11.5 1.6 1.6L12.5 10" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" /></svg>;
  if (id === 'drive-sync') return <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true" className="pb-gira"><path d="M15 8.5A5.2 5.2 0 0 0 5.3 7M5 11.5a5.2 5.2 0 0 0 9.7 1.5M5.3 4.5V7H8M14.7 15.5V13H12" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" /></svg>;
  if (id === 'drive-errore') return <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true"><path d="M6 15.5h8.5a3.2 3.2 0 0 0 .4-6.4A4.8 4.8 0 0 0 5.6 8 3.8 3.8 0 0 0 6 15.5Z" fill="none" stroke="currentColor" strokeWidth="1.3" /><path d="M10 9v2.6M10 13.3v.1" stroke="#C42B1C" strokeWidth="1.6" strokeLinecap="round" /></svg>;
  if (id === 'cerca') return <IconaCerca size={24} />;
  if (id === 'campanella') return <svg viewBox="0 0 20 20" width="20" height="20" aria-hidden="true"><path d="M10 3a4.5 4.5 0 0 0-4.5 4.5v3L4 13.5h12l-1.5-3v-3A4.5 4.5 0 0 0 10 3ZM8.2 15.5a1.9 1.9 0 0 0 3.6 0" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" strokeLinecap="round" /></svg>;
  if (id === 'oggi') return <IconaOggi size={24} />;
  if (id === 'agenda') return <IconaDock n="cal" s={24} />;
  if (id === 'esplora') return <IconaCartellaW11 size={24} />;
  if (id === 'poliedron') return <IconaChat size={24} />;
  return <IconaPerTe size={24} />;
}

export function BarraApplicazioni({ vista, pagine, conteggi = {}, email, vai, apri, onEsci, onCentro, centroAperto = false }) {
  const [start, setStart] = useState(false); // false | 'start' | 'cerca'
  const [adesso, setAdesso] = useState(() => new Date());
  useEffect(() => { const t = setInterval(() => setAdesso(new Date()), 20000); return () => clearInterval(t); }, []);
  const attiva = voceAttiva({ vista, pagine, start });
  const aperte = vociAperte({ vista, pagine, start });
  const drive = useSyncExternalStore(ascoltaStatoDrive, statoDrive);
  const { ora, data } = oraData(adesso);
  const notifiche = numeroNotifiche(conteggi);

  // Indietro chiude Start: una voce nella cronologia finché Start è aperto.
  const chiudi = useCallback(() => {
    setStart(false);
    if (window.history.state?.pbStart) window.history.back();
  }, []);
  const apriStart = (modo = 'start') => {
    if (!window.history.state?.pbStart) window.history.pushState({ ...(window.history.state || {}), pbStart: true }, '');
    setStart(modo);
  };
  useEffect(() => {
    if (!start) return undefined;
    const indietro = () => setStart(false);
    const tasto = (e) => { if (e.key === 'Escape') chiudi(); };
    window.addEventListener('popstate', indietro);
    window.addEventListener('keydown', tasto);
    return () => { window.removeEventListener('popstate', indietro); window.removeEventListener('keydown', tasto); };
  }, [start, chiudi]);

  const tocca = (v) => {
    if (v.id === 'start' || v.id === 'cerca') { if (start === v.id) chiudi(); else apriStart(v.id); return; }
    if (start) chiudi();
    if (v.pagina) apri({ tipo: v.pagina }); else vai(v.vista);
  };
  const apriCentro = () => { if (start) chiudi(); if (onCentro) onCentro(); else vai('dafare'); };
  const esegui = (azione) => {
    chiudi();
    if (azione.vai) vai(azione.vai);
    else if (azione.apri) apri(azione.apri);
    else if (azione.href) window.location.assign(sectionDestination(azione.href, azione.href));
  };

  return (
    <>
      {start && <Start modo={start} conteggi={conteggi} email={email} onAzione={esegui} onChiudi={chiudi} apri={apri} onEsci={onEsci} />}
      <nav className="pb-barra" aria-label="Barra delle applicazioni">
        <span className="pb-lato" aria-hidden="true" />
        <div className="pb-icone">
          {VOCI_BARRA.map((v) => {
            const n = badgeBarra(v.id, conteggi);
            const etichetta = n ? `${v.nome}, ${n} ${v.id === 'oggi' ? 'urgenti' : 'da gestire'}` : v.nome;
            return (
              <button key={v.id} type="button" className={`pb-voce${attiva === v.id ? ' attiva' : ''}${aperte.has(v.id) ? ' aperta' : ''}`} onClick={() => tocca(v)}
                aria-label={etichetta} title={accettaFile(v.id) ? `${v.nome} · trascina qui un file: ${APP_PER_FILE[v.id].toLowerCase()}` : v.nome}
                aria-current={attiva === v.id && v.id !== 'start' && v.id !== 'cerca' ? 'page' : undefined}
                aria-expanded={v.id === 'start' || v.id === 'cerca' ? start === v.id : undefined}
                data-bersaglio={accettaFile(v.id) ? `app:${v.id}` : undefined}>
                <IconaVoce id={v.id} />
                <Numero n={n} />
              </button>
            );
          })}
        </div>
        <div className="pb-sistema">
          <span className={`pb-drive pb-drive-${drive.stato}`} role="status" title={testoStatoDrive(drive)} aria-label={testoStatoDrive(drive)}>
            <IconaVoce id={`drive-${drive.stato === 'ok' ? 'ok' : drive.stato === 'errore' ? 'errore' : 'sync'}`} />
          </span>
          {/* Clic su ora e data (o sulla campanella su mobile) → Centro notifiche. */}
          <button type="button" className={`pb-area${centroAperto ? ' attiva' : ''}`} onClick={apriCentro} aria-expanded={centroAperto} aria-haspopup="dialog"
            aria-label={`${ora}, ${data}. ${notifiche ? `${notifiche} notifiche` : 'Nessuna notifica'}: apri il Centro notifiche`}>
            <span className="pb-ora"><span>{ora}</span><span className="pb-data">{data}</span></span>
            <span className="pb-campanella"><IconaVoce id="campanella" /><Numero n={notifiche} /></span>
            {notifiche > 0 && <span className="pb-notifiche">{etichettaNumero(notifiche)}</span>}
          </button>
        </div>
      </nav>
    </>
  );
}

function Start({ modo = 'start', conteggi, email, onAzione, onChiudi, apri, onEsci }) {
  const [testo, setTesto] = useState('');
  const [suggeriti, setSuggeriti] = useState(null);
  const [conferma, setConferma] = useState(false);
  const campo = useRef(null);
  useEffect(() => {
    let vivo = true;
    Promise.all([elencoRecenti().catch(() => []), documentiRecenti(archivioDb, 6).catch(() => [])])
      .then(([r, d]) => { if (vivo) setSuggeriti(consigliati(r, d)); });
    return () => { vivo = false; };
  }, []);
  const cerca = (e) => {
    e.preventDefault();
    onChiudi();
    apri({ tipo: 'ricerca', titolo: 'Cerca nel tuo archivio', testo: testo.trim() });
  };
  const apriSuggerito = async (s) => {
    onChiudi();
    if (s.tipo === 'documento') { apri({ tipo: 'documento', id: s.id }); return; }
    try {
      const file = await fileRecente(s.id);
      if (file.type === 'application/pdf' || /\.pdf$/i.test(file.name)) apri({ tipo: 'pdf', file }); else scaricaDocumento(file);
    } catch { /* il file non c'è più sul telefono */ }
  };
  const tipo = (s) => (/pdf/i.test(s.mime || '') || /\.pdf$/i.test(s.nome) ? 'pdf' : /^image\//.test(s.mime || '') ? 'immagine' : /word|sheet|excel|presentation/i.test(s.mime || '') ? 'office' : 'altro');
  return (
    <div className="pb-velo" onClick={onChiudi}>
      <section className="pb-start" role="dialog" aria-label="Start" onClick={(e) => e.stopPropagation()}>
        <form className="pb-cerca" onSubmit={cerca} role="search">
          <IconaCerca size={18} />
          <input ref={campo} autoFocus={modo === 'cerca'} value={testo} onChange={(e) => setTesto(e.target.value)} placeholder="Cerca nel tuo archivio" aria-label="Cerca nel tuo archivio" enterKeyHint="search" />
        </form>
        <div className="pb-start-corpo">
          <h2>Aggiunte</h2>
          <div className="pb-aggiunte">
            {vociStart(conteggi).map((v) => {
              const Icona = ICONE_START[v.id];
              return (
                <button key={v.id} type="button" className="pb-app" onClick={() => onAzione(v.azione)} aria-label={v.n ? `${v.nome}, ${v.n}` : v.nome}>
                  <span className="pb-app-icona">{v.id === 'esplora' ? <IconaCartellaW11 size={32} /> : <Icona size={26} />}<Numero n={v.n} /></span>
                  <span className="pb-app-nome">{v.nome}</span>
                </button>
              );
            })}
          </div>
          <h2>Consigliati</h2>
          <div className="pb-consigliati">
            {suggeriti === null && <p className="pb-nota">Carico…</p>}
            {suggeriti?.length === 0 && <p className="pb-nota">Niente di recente.</p>}
            {suggeriti?.map((s) => (
              <button key={s.chiave} type="button" className="pb-consigliato" onClick={() => apriSuggerito(s)}>
                <IconaFileW11 tipo={tipo(s)} size={30} />
                <span><strong>{s.nome}</strong><small>{s.tipo === 'recente' ? 'Su questo telefono' : 'Nell’archivio'}{s.quando ? ` · ${new Date(s.quando).toLocaleDateString('it-IT', { day: 'numeric', month: 'short' })}` : ''}</small></span>
              </button>
            ))}
          </div>
        </div>
        <footer className="pb-start-piede">
          <span className="pb-utente"><span className="pb-avatar" aria-hidden="true">{nomeUtente(email).charAt(0)}</span>{nomeUtente(email)}</span>
          <button type="button" className={`pb-esci${conferma ? ' conferma' : ''}`} onClick={() => (conferma ? onEsci() : setConferma(true))}>
            <IconaEsci size={18} /><span>{conferma ? 'Tocca di nuovo per uscire' : 'Esci'}</span>
          </button>
        </footer>
      </section>
    </div>
  );
}
