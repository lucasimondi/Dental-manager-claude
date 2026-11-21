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
import { VOCI_BARRA, voceAttiva, vociAperte, badgeBarra, vociStart, numeroNotifiche, oraData, nomeUtente, consigliati, etichettaNumero } from './lib/barra.js';
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

function IconaVoce({ id }) {
  if (id === 'start') return <img className="pb-logo" src={gemmaPoliedron} alt="" draggable={false} />;
  if (id === 'drive-ok') return <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true"><path d="M6 15.5h8.5a3.2 3.2 0 0 0 .4-6.4A4.8 4.8 0 0 0 5.6 8 3.8 3.8 0 0 0 6 15.5Z" fill="none" stroke="currentColor" strokeWidth="1.3" /><path d="m8 11.5 1.6 1.6L12.5 10" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" /></svg>;
  if (id === 'drive-sync') return <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true" className="pb-gira"><path d="M15 8.5A5.2 5.2 0 0 0 5.3 7M5 11.5a5.2 5.2 0 0 0 9.7 1.5M5.3 4.5V7H8M14.7 15.5V13H12" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" /></svg>;
  if (id === 'drive-errore') return <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true"><path d="M6 15.5h8.5a3.2 3.2 0 0 0 .4-6.4A4.8 4.8 0 0 0 5.6 8 3.8 3.8 0 0 0 6 15.5Z" fill="none" stroke="currentColor" strokeWidth="1.3" /><path d="M10 9v2.6M10 13.3v.1" stroke="#C42B1C" strokeWidth="1.6" strokeLinecap="round" /></svg>;
  if (id === 'oggi') return <IconaOggi size={24} />;
  if (id === 'agenda') return <IconaDock n="cal" s={24} />;
  if (id === 'esplora') return <IconaCartellaW11 size={24} />;
  if (id === 'poliedron') return <IconaChat size={24} />;
  return <IconaPerTe size={24} />;
}

export function BarraApplicazioni({ vista, pagine, conteggi = {}, email, vai, apri, onEsci }) {
  const [start, setStart] = useState(false);
  const [adesso, setAdesso] = useState(() => new Date());
  useEffect(() => { const t = setInterval(() => setAdesso(new Date()), 20000); return () => clearInterval(t); }, []);
  const attiva = voceAttiva({ vista, pagine, start });
  const aperte = vociAperte({ vista, pagine, start });
  const drive = useSyncExternalStore(ascoltaStatoDrive, statoDrive);
  const { ora, data, breve } = oraData(adesso);
  const notifiche = numeroNotifiche(conteggi);

  // Indietro chiude Start: una voce nella cronologia finché Start è aperto.
  const chiudi = useCallback(() => {
    setStart(false);
    if (window.history.state?.pbStart) window.history.back();
  }, []);
  const apriStart = () => { window.history.pushState({ ...(window.history.state || {}), pbStart: true }, ''); setStart(true); };
  useEffect(() => {
    if (!start) return undefined;
    const indietro = () => setStart(false);
    const tasto = (e) => { if (e.key === 'Escape') chiudi(); };
    window.addEventListener('popstate', indietro);
    window.addEventListener('keydown', tasto);
    return () => { window.removeEventListener('popstate', indietro); window.removeEventListener('keydown', tasto); };
  }, [start, chiudi]);

  const tocca = (v) => {
    if (v.id === 'start') { if (start) chiudi(); else apriStart(); return; }
    if (start) chiudi();
    if (v.pagina) apri({ tipo: v.pagina }); else vai(v.vista);
  };
  const esegui = (azione) => {
    chiudi();
    if (azione.vai) vai(azione.vai);
    else if (azione.apri) apri(azione.apri);
    else if (azione.href) window.location.assign(sectionDestination(azione.href, azione.href));
  };

  return (
    <>
      {start && <Start conteggi={conteggi} email={email} onAzione={esegui} onChiudi={chiudi} apri={apri} onEsci={onEsci} />}
      <nav className="pb-barra" aria-label="Barra delle applicazioni">
        <span className="pb-lato" aria-hidden="true" />
        <div className="pb-icone">
          {VOCI_BARRA.map((v) => {
            const n = badgeBarra(v.id, conteggi);
            const etichetta = n ? `${v.nome}, ${n} ${v.id === 'oggi' ? 'urgenti' : 'da gestire'}` : v.nome;
            return (
              <button key={v.id} type="button" className={`pb-voce${attiva === v.id ? ' attiva' : ''}${aperte.has(v.id) ? ' aperta' : ''}`} onClick={() => tocca(v)}
                aria-label={etichetta} title={v.nome} aria-current={attiva === v.id && v.id !== 'start' ? 'page' : undefined}
                aria-expanded={v.id === 'start' ? start : undefined}>
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
          <button type="button" className="pb-area" onClick={() => { if (start) chiudi(); vai('dafare'); }}
            aria-label={`${ora}, ${data}. ${notifiche ? `${notifiche} notifiche` : 'Nessuna notifica'}: apri Da fare`}>
            <span className="pb-ora"><span>{ora}</span><span className="pb-data">{data}</span><span className="pb-data-breve">{breve}</span></span>
            {notifiche > 0 && <span className="pb-notifiche">{etichettaNumero(notifiche)}</span>}
          </button>
        </div>
      </nav>
    </>
  );
}

function Start({ conteggi, email, onAzione, onChiudi, apri, onEsci }) {
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
          <input ref={campo} value={testo} onChange={(e) => setTesto(e.target.value)} placeholder="Cerca nel tuo archivio" aria-label="Cerca nel tuo archivio" enterKeyHint="search" />
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
