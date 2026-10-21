import { agendaVisible } from '../../../../shared/agenda/visibility.js';
import { readAgendaLocation } from '../../../../shared/agenda/navigation.js';
// POL-VITA-004/007 — Agenda di Poliedron Personal: è l'agenda dello studio (stessi dati).
// Tutte le viste usano i componenti originali condivisi in shared/agenda.
// POL-VITA-013: da Personal si creano, modificano ed eliminano anche gli appuntamenti dello studio.
import { useEffect, useMemo, useRef, useState } from 'react';
import { archivioDb } from '../../lib/supabasePersonal.js';
import { pagamenti as caricaPagamenti } from '../../lib/archivio.js';
import { euro } from '../../lib/coreArchivio.js';
import { studioDb, sessioneStudio, entraStudio, appuntamentiTra, impegniTra, tipiAppuntamento, impostazioniAgenda } from '../../lib/studio.js';
import { daIso, oggi, ora, giorniSettimana, grigliaMese, elementiDelGiorno, coloreEvento, nomeEtichetta, COLORE_SCADENZA } from '../../lib/agenda.js';
import { IconaFreccia } from '../../Icone.jsx';
import { GrigliaPoliedra } from './AgendaGriglia.jsx';

export const nomeGiorno = (s, forma = 'long') => daIso(s).toLocaleDateString('it-IT', { weekday: forma, day: 'numeric', month: 'long' });


function AccessoStudio({ onEntrato }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [stato, setStato] = useState(null);
  const entra = async (e) => {
    e.preventDefault();
    setStato({ invio: true });
    try { await entraStudio(email, password); onEntrato(); } catch (err) { setStato({ errore: err.message }); }
  };
  return (
    <div className="pp-studio-accesso">
      <h2>Collega l'agenda dello studio</h2>
      <p className="pp-riga-meta">Entra una volta con l'account di Poliedra: l'agenda resterà collegata finché non esci. Vedrai gli appuntamenti dello studio e potrai aggiungere i tuoi eventi, che compaiono anche nell'agenda dello studio.</p>
      <form className="pp-modulo" onSubmit={entra}>
        <label className="pp-campo"><span>Email dello studio</span><input type="email" required autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} /></label>
        <label className="pp-campo"><span>Password dello studio</span><input type="password" required autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} /></label>
        <button className="pp-bottone pp-bottone-largo" disabled={stato?.invio}>{stato?.invio ? 'Attendi…' : 'Collega'}</button>
      </form>
      {stato?.errore && <p className="pp-messaggio pp-messaggio-errore">{stato.errore}</p>}
    </div>
  );
}

function useDatiAgenda(da, a, versione, esegui) {
  // Disegna subito la struttura dell'agenda; appuntamenti e impostazioni autorevoli la aggiornano appena arrivano.
  const [dati, setDati] = useState(() => ({ appuntamenti: [], impegni: [], settings: {}, scadenze: [] }));
  const [revisione, setRevisione] = useState(0);
  useEffect(() => {
    const refresh = () => setRevisione(x => x + 1);
    const channel = studioDb.channel('personal-agenda-shared')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'appointments' }, refresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'impegni_personali' }, refresh)
      .subscribe();
    window.addEventListener('focus', refresh);
    const visible = () => { if (document.visibilityState === 'visible') refresh(); };
    document.addEventListener('visibilitychange', visible);
    return () => { studioDb.removeChannel(channel); window.removeEventListener('focus', refresh); document.removeEventListener('visibilitychange', visible); };
  }, []);
  const impostazioniCache = useRef(null);
  const pagamentiCache = useRef({ versione: null, dati: null, promise: null });
  const versioneCorrente = useRef(versione);
  versioneCorrente.current = versione;

  useEffect(() => {
    let vivo = true;
    esegui(async () => {
      const impostazioniPromise = impostazioniCache.current || (impostazioniCache.current = impostazioniAgenda().catch((errore) => {
        impostazioniCache.current = null;
        throw errore;
      }));
      const [appuntamenti, impegni, settings] = await Promise.all([
        appuntamentiTra(da, a),
        impegniTra(da, a),
        impostazioniPromise,
      ]);
      if (!vivo) return;

      const cache = pagamentiCache.current;
      const pagamentiPronti = cache.versione === versione && Array.isArray(cache.dati);
      setDati({
        appuntamenti,
        impegni,
        settings,
        scadenze: pagamentiPronti ? cache.dati.filter((s) => s.data >= da && s.data <= a) : [],
      });
      if (pagamentiPronti) return;

      const promise = cache.versione === versione && cache.promise
        ? cache.promise
        : caricaPagamenti(archivioDb);
      pagamentiCache.current = { versione, dati: null, promise };
      promise.then((tutti) => {
        if (versioneCorrente.current === versione) pagamentiCache.current = { versione, dati: tutti, promise: null };
        if (vivo) setDati((corrente) => corrente ? {
          ...corrente,
          scadenze: tutti.filter((s) => s.data >= da && s.data <= a),
        } : corrente);
      }).catch(() => {
        // La griglia resta utilizzabile anche se il caricamento dei pagamenti è lento o fallisce.
        if (versioneCorrente.current === versione) pagamentiCache.current = { versione: null, dati: null, promise: null };
      });
    });
    return () => { vivo = false; };
  }, [da, a, versione, esegui, revisione]);
  return dati;
}

export function ElencoGiorno({ giorno, dati, ctx, etichette, coloriTipi, intestazione = true }) {
  const el = elementiDelGiorno(giorno, dati);
  const vuoto = !el.aOrario.length && !el.tuttoIlGiorno.length && !el.scadenze.length;
  return (
    <section className="pp-agenda-elenco">
      {intestazione && <h3 className={giorno === oggi() ? 'oggi' : ''}>{nomeGiorno(giorno)}</h3>}
      {vuoto ? <p className="pp-vuoto">Niente in programma.</p> : (
        <div className="pp-gruppo">
          {el.scadenze.map((s) => (
            <button key={`s${s.id}`} className="pp-riga" onClick={() => ctx.apri({ tipo: 'pagamento', s })}>
              <span className="pp-agenda-segno pp-agenda-scadenza" style={{ '--c': COLORE_SCADENZA }}>€</span>
              <span className="pp-riga-testo"><span className="pp-riga-titolo">{s.descrizione}</span><span className="pp-riga-meta">{s.completata ? 'pagato' : 'scadenza'}{s.importo != null ? ` · ${euro(s.importo)}` : ''}</span></span>
              <IconaFreccia size={16} />
            </button>
          ))}
          {el.tuttoIlGiorno.map((e) => (
            <button key={e.id} className="pp-riga" onClick={() => ctx.apri({ tipo: 'evento', evento: e })}>
              <span className="pp-agenda-segno pp-evento" style={{ '--c': coloreEvento(e, etichette) }} />
              <span className="pp-riga-testo"><span className="pp-riga-titolo">{e.titolo}</span><span className="pp-riga-meta">tutto il giorno · {nomeEtichetta(e.tipo, etichette)}</span>{e.note && <span className="pp-riga-meta pp-evento-descrizione">{e.note}</span>}</span>
              <IconaFreccia size={16} />
            </button>
          ))}
          {el.aOrario.map((x) => (x.tipo === 'appuntamento' ? (
            <button key={x.id} className="pp-riga" onClick={() => ctx.apri({ tipo: 'appuntamento', a: x.dato })}>
              <span className="pp-agenda-segno pp-appuntamento" style={{ '--c': x.dato.colore || coloriTipi[x.dato.tipo] || '#0c447c' }} />
              <span className="pp-riga-testo"><span className="pp-riga-titolo">{x.dato.paziente || x.dato.tipo || 'Appuntamento'}</span><span className="pp-riga-meta">{ora(x.inizio)}–{ora(x.fine)}{x.dato.tipo ? ` · ${x.dato.tipo}` : ''}</span></span>
              <IconaFreccia size={16} />
            </button>
          ) : (
            <button key={x.id} className="pp-riga" onClick={() => ctx.apri({ tipo: 'evento', evento: x.dato })}>
              <span className="pp-agenda-segno pp-evento" style={{ '--c': coloreEvento(x.dato, etichette) }} />
              <span className="pp-riga-testo"><span className="pp-riga-titolo">{x.dato.titolo}</span><span className="pp-riga-meta">{ora(x.inizio)}–{ora(x.fine)} · {nomeEtichetta(x.dato.tipo, etichette)}</span>{x.dato.note && <span className="pp-riga-meta pp-evento-descrizione">{x.dato.note}</span>}</span>
              <IconaFreccia size={16} />
            </button>
          )))}
        </div>
      )}
    </section>
  );
}

export function VistaAgenda({ ctx }) {
  const { esegui, versione, impostazioni } = ctx;
  const etichette = impostazioni.etichette;
  const [collegata, setCollegata] = useState(undefined);
  const [modo, setModo] = useState(() => readAgendaLocation().view || 'settimana');
  const [giorno, setGiorno] = useState(() => readAgendaLocation().day || oggi());
  const [mese, setMese] = useState(() => readAgendaLocation().month || readAgendaLocation().day || oggi());
  const [coloriTipi, setColoriTipi] = useState({});

  useEffect(() => {
    sessioneStudio().then((s) => setCollegata(!!s));
    const { data } = studioDb.auth.onAuthStateChange((_e, s) => setCollegata(!!s));
    return () => data.subscription.unsubscribe();
  }, []);
  useEffect(() => { if (collegata) tipiAppuntamento().then((t) => setColoriTipi(Object.fromEntries(t.map((x) => [x.nome, x.colore])))).catch(() => {}); }, [collegata]);

  const [da, a] = useMemo(() => {
    if (modo === 'mese') { const g = grigliaMese(mese); return [giorno < g[0] ? giorno : g[0], giorno > g[41] ? giorno : g[41]]; }
    if (modo === 'settimana' || modo === 'settimana_lavoro') { const g = giorniSettimana(giorno); return [g[0], g[6]]; }
    return [giorno, giorno];
  }, [modo, giorno, mese]);

  if (collegata === undefined) return null;
  if (!collegata) return <AccessoStudio onEntrato={() => setCollegata(true)} />;
  return (
    <ContenutoAgenda {...{ ctx, modo, setModo, giorno, setGiorno, mese, setMese, da, a, etichette, coloriTipi, versione, esegui }} />
  );
}

function ContenutoAgenda({ ctx, modo, setModo, giorno, setGiorno, mese, setMese, da, a, etichette, coloriTipi, versione, esegui }) {
  const tutti = useDatiAgenda(da, a, versione, esegui);
  const [mostraEsclusi, setMostraEsclusi] = useState(false);
  const dati = { ...tutti,
    appuntamenti: tutti.appuntamenti.filter(x => mostraEsclusi || agendaVisible(x, 'personal')),
    impegni: tutti.impegni.filter(x => mostraEsclusi || agendaVisible(x, 'personal')),
  };
  return <GrigliaPoliedra hiddenCount={tutti.appuntamenti.filter(x => !agendaVisible(x, 'personal')).length + tutti.impegni.filter(x => !agendaVisible(x, 'personal')).length} mostraEsclusi={mostraEsclusi} setMostraEsclusi={mostraEsclusi || tutti.appuntamenti.some(x => !agendaVisible(x, 'personal')) || tutti.impegni.some(x => !agendaVisible(x, 'personal')) ? setMostraEsclusi : undefined} view={modo} setView={setModo} giorno={giorno} setGiorno={setGiorno} mese={mese} setMese={setMese} dati={dati} ctx={ctx} etichette={etichette} coloriTipi={coloriTipi} />;
}


