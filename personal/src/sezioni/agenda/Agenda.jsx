import {scadenzaIdentita} from '../../lib/portafoglio.js';
import { agendaVisible } from '../../../../shared/agenda/visibility.js';
import { labelColor } from '../../../../shared/agenda/labelPalette.js';
import { readAgendaLocation, agendaDestination, agendaUnica } from '../../../../shared/agenda/navigation.js';
// POL-VITA-004/007 — Agenda di Poliedron Personal: è l'agenda dello studio (stessi dati).
// Tutte le viste usano i componenti originali condivisi in shared/agenda.
// POL-VITA-013: da Personal si creano, modificano ed eliminano anche gli appuntamenti dello studio.
import { useEffect, useMemo, useRef, useState } from 'react';
import { archivioDb } from '../../lib/supabasePersonal.js';
import { scadenzeAgenda as caricaPagamenti } from '../../lib/archivio.js';
import { euro } from '../../lib/coreArchivio.js';
import { studioDb, sessioneStudio, entraStudio, appuntamentiTra, impegniTra, tipiAppuntamento, impostazioniAgenda, salvaAppuntamento, eliminaAppuntamento, salvaImpegno, eliminaImpegno } from '../../lib/studio.js';
import { cercaDocumenti } from '../../lib/archivio.js';
import { creaFontiStudio, impegnoSpostato } from '../../../../shared/ricerca/fonti.js';
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
            <button key={`s${s.id}`} className="pp-riga" onClick={() => ctx.apri(scadenzaIdentita(s) && s.documento_id ? {tipo:'documento',id:s.documento_id} : { tipo: 'pagamento', s })}>
              <span className="pp-agenda-segno pp-agenda-scadenza" style={{ '--c': labelColor(COLORE_SCADENZA) }}>{scadenzaIdentita(s)?'↻':'€'}</span>
              <span className="pp-riga-testo"><span className="pp-riga-titolo">{s.descrizione}</span><span className="pp-riga-meta">{s.completata ? (scadenzaIdentita(s)?'Rinnovato':'pagato') : 'scadenza'}{!scadenzaIdentita(s)&&s.importo != null ? ` · ${euro(s.importo)}` : ''}</span></span>
              <IconaFreccia size={16} />
            </button>
          ))}
          {el.tuttoIlGiorno.map((e) => (
            <button key={e.id} className="pp-riga" onClick={() => ctx.apri({ tipo: 'evento', evento: e })}>
              <span className="pp-agenda-segno pp-evento" style={{ '--c': labelColor(coloreEvento(e, etichette)) }} />
              <span className="pp-riga-testo"><span className="pp-riga-titolo">{e.titolo}</span><span className="pp-riga-meta">tutto il giorno · {nomeEtichetta(e.tipo, etichette)}</span>{e.note && <span className="pp-riga-meta pp-evento-descrizione">{e.note}</span>}</span>
              <IconaFreccia size={16} />
            </button>
          ))}
          {el.aOrario.map((x) => (x.tipo === 'appuntamento' ? (
            <button key={x.id} className="pp-riga" onClick={() => ctx.apri({ tipo: 'appuntamento', a: x.dato })}>
              <span className="pp-agenda-segno pp-appuntamento" style={{ '--c': labelColor(x.dato.colore || coloriTipi[x.dato.tipo] || '#0c447c') }} />
              <span className="pp-riga-testo"><span className="pp-riga-titolo">{x.dato.paziente || x.dato.tipo || 'Appuntamento'}</span><span className="pp-riga-meta">{ora(x.inizio)}–{ora(x.fine)}{x.dato.tipo ? ` · ${x.dato.tipo}` : ''}</span></span>
              <IconaFreccia size={16} />
            </button>
          ) : (
            <button key={x.id} className="pp-riga" onClick={() => ctx.apri({ tipo: 'evento', evento: x.dato })}>
              <span className="pp-agenda-segno pp-evento" style={{ '--c': labelColor(coloreEvento(x.dato, etichette)) }} />
              <span className="pp-riga-testo"><span className="pp-riga-titolo">{x.dato.titolo}</span><span className="pp-riga-meta">{ora(x.inizio)}–{ora(x.fine)} · {nomeEtichetta(x.dato.tipo, etichette)}</span>{x.dato.note && <span className="pp-riga-meta pp-evento-descrizione">{x.dato.note}</span>}</span>
              <IconaFreccia size={16} />
            </button>
          )))}
        </div>
      )}
    </section>
  );
}

function VistaAgendaPersonal({ ctx }) {
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
  // PO 2026-11-08: un'agenda sola, di partenza "Tutto" (Studio e Personal insieme).
  const [mostraEsclusi, setMostraEsclusi] = useState(true);
  const dati = { ...tutti,
    appuntamenti: tutti.appuntamenti.filter(x => mostraEsclusi || agendaVisible(x, 'personal')),
    impegni: tutti.impegni.filter(x => mostraEsclusi || agendaVisible(x, 'personal')),
  };
  const fonteRicerca = useFonteRicerca({ ctx, etichette, coloriTipi, setGiorno, versione });
  return <GrigliaPoliedra fonteRicerca={fonteRicerca} hiddenCount={tutti.appuntamenti.filter(x => !agendaVisible(x, 'personal')).length + tutti.impegni.filter(x => !agendaVisible(x, 'personal')).length} mostraEsclusi={mostraEsclusi} setMostraEsclusi={mostraEsclusi || tutti.appuntamenti.some(x => !agendaVisible(x, 'personal')) || tutti.impegni.some(x => !agendaVisible(x, 'personal')) ? setMostraEsclusi : undefined} view={modo} setView={setModo} giorno={giorno} setGiorno={setGiorno} mese={mese} setMese={setMese} dati={dati} ctx={ctx} etichette={etichette} coloriTipi={coloriTipi} />;
}

// RICERCA-AGENDA (PO 2026-11-08): la barra cerca e agisce sul posto, come in Studio. Gli elementi
// arrivano da un orizzonte più ampio della settimana mostrata (due mesi indietro, sei avanti).
function useFonteRicerca({ ctx, etichette, coloriTipi, setGiorno, versione }) {
  const [orizzonte, setOrizzonte] = useState({ appuntamenti: [], impegni: [] });
  const [studioId, setStudioId] = useState(null);
  const [giro, setGiro] = useState(0);
  useEffect(() => { sessioneStudio().then((s) => setStudioId(s?.user?.app_metadata?.studio_id || null)).catch(() => {}); }, []);
  useEffect(() => {
    let vivo = true;
    const da = new Date(); da.setDate(da.getDate() - 60);
    const a = new Date(); a.setDate(a.getDate() + 180);
    const iso = (d) => d.toLocaleDateString('sv-SE');
    Promise.all([appuntamentiTra(iso(da), iso(a)), impegniTra(iso(da), iso(a))])
      .then(([appuntamenti, impegni]) => { if (vivo) setOrizzonte({ appuntamenti, impegni }); }).catch(() => {});
    return () => { vivo = false; };
  }, [versione, giro]);
  const fonti = useMemo(() => (studioId ? creaFontiStudio({
    db: studioDb, studioId,
    apriNota: () => ctx.vai('note'), apriPassword: (q) => ctx.vai('password', q || null),
    cercaDocumenti: (q) => cercaDocumenti(archivioDb, q, null, 6).then((ds) => (ds || []).filter((d) => d.fascicolo !== 'clinico_pazienti')
      .map((d) => ({ id: d.id, titolo: d.titolo || 'Documento', sottotitolo: d.ente || '', apri: () => ctx.apri({ tipo: 'documento', id: d.id }) }))),
  }) : null), [studioId]);
  const fatto = async (lavoro) => { await lavoro(); ctx.aggiorna(); setGiro((x) => x + 1); };
  return {
    oggi: oggi(),
    elementi: [
      ...orizzonte.appuntamenti.map((a) => ({ id: a.id, tipo: 'appuntamento', titolo: a.paziente || a.cognome || a.tipo || 'Appuntamento', sottotitolo: a.tipo, data: a.data, ora: String(a.ora || '').slice(0, 5), colore: labelColor(a.colore || coloriTipi[a.tipo] || '#185FA5'), dato: a })),
      ...orizzonte.impegni.map((e) => ({ id: e.id, tipo: 'impegno', titolo: e.titolo || 'Impegno', sottotitolo: e.tutto_il_giorno ? 'tutto il giorno' : nomeEtichetta(e.tipo, etichette), data: e.data_inizio, ora: e.tutto_il_giorno ? null : String(e.ora_inizio || '').slice(0, 5) || null, colore: coloreEvento(e, etichette), dato: e })),
    ],
    apri: (e) => { setGiorno(e.data); ctx.apri(e.tipo === 'impegno' ? { tipo: 'evento', evento: e.dato } : { tipo: 'appuntamento', a: e.dato }); },
    nuovoAppuntamento: ({ data, ora: o, soggetto } = {}) => ctx.apri({ tipo: 'evento', cosa: 'appuntamento', evento: { data_inizio: data || oggi(), ora_inizio: o || '09:00', cerca: soggetto || '' } }),
    nuovoImpegno: ({ data, ora: o, titolo } = {}) => ctx.apri({ tipo: 'evento', evento: { titolo: titolo || '', data_inizio: data || oggi(), ...(o ? { ora_inizio: o, ora_fine: `${String(Math.min(23, Number(o.slice(0, 2)) + 1)).padStart(2, '0')}:${o.slice(3, 5)}` } : { tutto_il_giorno: !!data }) } }),
    sposta: (e, verso) => fatto(() => (e.tipo === 'appuntamento' ? salvaAppuntamento({ ...e.dato, data: verso.data, ora: verso.ora || e.dato.ora }) : salvaImpegno(impegnoSpostato(e.dato, verso)))).then(() => setGiorno(verso.data)),
    cancella: (e) => fatto(() => (e.tipo === 'appuntamento' ? eliminaAppuntamento(e.id) : eliminaImpegno(e.id))),
    ...(fonti ? { cercaAltro: fonti.cercaAltro, nuovaNota: fonti.nuovaNota } : {}),
    apriNote: () => ctx.vai('note'), apriPassword: (q) => ctx.vai('password', q || null), apriDocumenti: () => ctx.vai('documenti'),
    acquisisci: () => ctx.apri({ tipo: 'carica', opzioni: {} }),
    chiediPoliedron: (domanda) => { ctx.setChat((c) => ({ ...c, bozza: domanda })); ctx.vai('poliedron'); },
  };
}

// AGENDA-UNICA (PO 2026-11-08): sul telefono c'è una sola agenda, quella di Studio (con «Tutto»,
// gli impegni personali e le scadenze dell'archivio). Personal ci porta lì, nello stesso indirizzo.
export function VistaAgenda({ ctx }) {
  const [unica] = useState(() => agendaUnica());
  useEffect(() => {
    if (!unica) return;
    const l = readAgendaLocation();
    globalThis.location.replace(agendaDestination('studio', l.day || oggi(), l.view || 'settimana', globalThis.location));
  }, [unica]);
  if (unica) return <p className="pp-riga-meta" role="status">Apro l'agenda…</p>;
  return <VistaAgendaPersonal ctx={ctx} />;
}

