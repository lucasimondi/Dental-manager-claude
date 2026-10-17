import { readAgendaLocation } from '../../shared/agenda/navigation.js';
// POL-VITA-004/007 — Agenda di Poliedron Personal: è l'agenda dello studio (stessi dati).
// Tutte le viste usano i componenti originali condivisi in shared/agenda.
// Appuntamenti clinici in sola lettura; eventi e scadenze conservano le azioni personali.
import { useEffect, useMemo, useRef, useState } from 'react';
import { archivioDb } from './lib/supabasePersonal.js';
import { pagamenti as caricaPagamenti } from './lib/archivio.js';
import { euro } from './lib/coreArchivio.js';
import {
  studioDb, sessioneStudio, entraStudio, appuntamentiTra, impegniTra, salvaImpegno, salvaImpegni, eliminaImpegno, tipiAppuntamento, impostazioniAgenda,
} from './lib/studio.js';
import {
  daIso, oggi, minuti, ora, giorniSettimana, grigliaMese, elementiDelGiorno, generaDateRipetizione, piuGiorni,
  coloreEvento, nomeEtichetta, COLORE_SCADENZA, nuovoIdRipetizione,
} from './lib/agenda.js';
import { IconaFreccia, IconaCestino } from './Icone.jsx';
import { GrigliaPoliedra } from './AgendaGriglia.jsx';

const nomeGiorno = (s, forma = 'long') => daIso(s).toLocaleDateString('it-IT', { weekday: forma, day: 'numeric', month: 'long' });


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
  const [dati, setDati] = useState(null);
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
  }, [da, a, versione, esegui]);
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
    if (modo === 'settimana') { const g = giorniSettimana(giorno); return [g[0], g[6]]; }
    return [giorno, giorno];
  }, [modo, giorno, mese]);

  if (collegata === undefined) return null;
  if (!collegata) return <AccessoStudio onEntrato={() => setCollegata(true)} />;
  return (
    <ContenutoAgenda {...{ ctx, modo, setModo, giorno, setGiorno, mese, setMese, da, a, etichette, coloriTipi, versione, esegui }} />
  );
}

function ContenutoAgenda({ ctx, modo, setModo, giorno, setGiorno, mese, setMese, da, a, etichette, coloriTipi, versione, esegui }) {
  const dati = useDatiAgenda(da, a, versione, esegui);
  return !dati ? <p className="pp-vuoto">Carico l'agenda…</p>
    : <GrigliaPoliedra view={modo} setView={setModo} giorno={giorno} setGiorno={setGiorno} mese={mese} setMese={setMese} dati={dati} ctx={ctx} etichette={etichette} coloriTipi={coloriTipi} />;
}


export function PaginaEvento({ evento: iniziale = {}, ctx, chiudi }) {
  const { esegui, aggiorna, mostra, impostazioni } = ctx;
  const etichette = impostazioni.etichette;
  const [ev, setEv] = useState(() => ({
    titolo: '',
    tipo: etichette[0]?.id || 'personale',
    colore: '',
    data_inizio: oggi(),
    data_fine: iniziale.data_fine || iniziale.data_inizio || oggi(),
    tutto_il_giorno: false,
    ora_inizio: '09:00',
    ora_fine: '10:00',
    note: '',
    ripeti: 'nessuna',
    ripeti_fino: iniziale.data_inizio || oggi(),
    ...iniziale,
    data_fine: iniziale.data_fine || iniziale.data_inizio || oggi(),
    ora_inizio: (iniziale.ora_inizio || '09:00').slice(0, 5),
    ora_fine: (iniziale.ora_fine || iniziale.ora_inizio || '10:00').slice(0, 5),
    ripeti: 'nessuna',
    ripeti_fino: iniziale.data_inizio || oggi(),
  }));
  const [conferma, setConferma] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const cambia = (k, v) => setEv((x) => ({ ...x, [k]: v }));
  const etichetta = etichette.find((e) => e.id === ev.tipo || e.nome === ev.tipo);
  const colore = ev.colore || etichetta?.colore || '#64748b';
  const dataFineEvento = ev.data_fine && ev.data_fine >= ev.data_inizio ? ev.data_fine : ev.data_inizio;
  const dataFineRipetizione = ev.ripeti_fino || ev.data_inizio;
  const valido = !!ev.titolo.trim()
    && !!ev.data_inizio
    && dataFineEvento >= ev.data_inizio
    && (ev.tutto_il_giorno || minuti(ev.ora_fine) > minuti(ev.ora_inizio))
    && (ev.id || ev.ripeti === 'nessuna' || dataFineRipetizione >= ev.data_inizio);

  const salva = async () => {
    if (salvando || !valido) return;
    setSalvando(true);
    try {
      await esegui(async () => {
        const payload = {
          ...ev,
          data_fine: dataFineEvento,
          colore: ev.colore || etichetta?.colore || null,
        };
        if (!ev.id && ev.ripeti && ev.ripeti !== 'nessuna') {
          const date = generaDateRipetizione(ev.data_inizio, dataFineRipetizione, ev.ripeti);
          if (!date.length) throw new Error('Controlla la data finale della ripetizione.');
          const durataGiorni = Math.max(0, Math.round((daIso(dataFineEvento).getTime() - daIso(ev.data_inizio).getTime()) / 86400000));
          const recurrenceId = date.length > 1 ? nuovoIdRipetizione() : null;
          const occorrenze = date.map((data) => ({
            ...payload,
            data_inizio: data,
            data_fine: piuGiorni(data, durataGiorni),
            recurrence_id: recurrenceId,
          }));
          await salvaImpegni(occorrenze);
          aggiorna();
          mostra(date.length > 1 ? 'Creati ' + date.length + ' impegni ricorrenti' : "Evento aggiunto all'agenda");
        } else {
          await salvaImpegno(payload);
          aggiorna();
          mostra(ev.id ? 'Evento aggiornato' : "Evento aggiunto all'agenda");
        }
        chiudi();
      });
    } finally {
      setSalvando(false);
    }
  };

  return (
    <>
      <div className="pp-evento-anteprima" style={{ '--c': colore }}>
        <strong>{ev.titolo || 'Nuovo evento'}</strong>
        <span>{nomeEtichetta(ev.tipo, etichette)}{ev.tutto_il_giorno ? ' · tutto il giorno' : ' · ' + ev.ora_inizio + '–' + ev.ora_fine}</span>
      </div>
      <label className="pp-campo"><span>Titolo</span><input value={ev.titolo} onChange={(e) => cambia('titolo', e.target.value)} placeholder="Es. Calcetto, cena, dentista Giulia" /></label>
      <div className="pp-due">
        <label className="pp-campo"><span>Giorno</span><input type="date" value={ev.data_inizio} onChange={(e) => setEv((x) => {
          const inizio = e.target.value;
          return {
            ...x,
            data_inizio: inizio,
            data_fine: x.data_fine && x.data_fine >= inizio ? x.data_fine : inizio,
            ripeti_fino: x.ripeti_fino && x.ripeti_fino >= inizio ? x.ripeti_fino : inizio,
          };
        })} /></label>
        <label className="pp-campo"><span>Fino al</span><input type="date" value={ev.data_fine || ev.data_inizio} min={ev.data_inizio} onChange={(e) => cambia('data_fine', e.target.value)} /></label>
      </div>
      <label className="pp-interruttore"><input type="checkbox" checked={ev.tutto_il_giorno} onChange={(e) => cambia('tutto_il_giorno', e.target.checked)} /><span>Tutto il giorno</span></label>
      {!ev.tutto_il_giorno && (
        <div className="pp-due">
          <label className="pp-campo"><span>Dalle</span><input type="time" step="300" value={ev.ora_inizio} onChange={(e) => {
            const nuovaInizio = e.target.value;
            const durata = minuti(ev.ora_fine) - minuti(ev.ora_inizio);
            setEv((x) => ({ ...x, ora_inizio: nuovaInizio, ora_fine: ora(Math.min(minuti(nuovaInizio) + Math.max(durata, 15), 23 * 60 + 59)) }));
          }} /></label>
          <label className="pp-campo"><span>Alle</span><input type="time" step="300" value={ev.ora_fine} onChange={(e) => cambia('ora_fine', e.target.value)} /></label>
        </div>
      )}
      {!ev.id && (
        <div className="pp-evento-ripetizione">
          <label className="pp-campo"><span>Ripeti</span>
            <select value={ev.ripeti || 'nessuna'} onChange={(e) => setEv((x) => ({
              ...x,
              ripeti: e.target.value,
              ripeti_fino: e.target.value === 'nessuna' ? '' : (
                x.ripeti === 'nessuna' || !x.ripeti_fino || x.ripeti_fino <= x.data_inizio
                  ? piuGiorni(x.data_inizio, ({ giornaliera: 7, settimanale: 28, quindicinale: 56, mensile: 180 })[e.target.value] || 28)
                  : x.ripeti_fino
              ),
            }))}>
              <option value="nessuna">Non si ripete</option>
              <option value="giornaliera">Ogni giorno</option>
              <option value="settimanale">Ogni settimana</option>
              <option value="quindicinale">Ogni 2 settimane</option>
              <option value="mensile">Ogni mese</option>
            </select>
          </label>
          {ev.ripeti !== 'nessuna' && (
            <label className="pp-campo"><span>Ripeti fino al</span>
              <input type="date" value={ev.ripeti_fino || ev.data_inizio} min={ev.data_inizio} onChange={(e) => cambia('ripeti_fino', e.target.value)} />
            </label>
          )}
        </div>
      )}
      <div className="pp-campo"><span>Etichetta</span>
        <div className="pp-etichette">
          {etichette.map((e) => (
            <button key={e.id} type="button" className={'pp-etichetta-scelta' + ((ev.tipo === e.id || ev.tipo === e.nome) ? ' attiva' : '')} style={{ '--c': e.colore }} onClick={() => setEv((x) => ({ ...x, tipo: e.id, etichetta: e.id, colore: '' }))}>{e.nome}</button>
          ))}
        </div>
      </div>
      <label className="pp-campo"><span>Colore di questo evento</span>
        <input type="color" className="pp-colore" value={colore} onChange={(e) => cambia('colore', e.target.value)} />
      </label>
      <label className="pp-campo"><span>Descrizione / note</span>
        <textarea rows={3} value={ev.note || ''} onChange={(e) => cambia('note', e.target.value)} placeholder="Aggiungi dettagli, luogo o persone coinvolte…" />
      </label>
      <button className="pp-bottone pp-bottone-largo" disabled={!valido || salvando} onClick={salva}>{salvando ? 'Salvataggio…' : ev.id ? 'Salva modifiche' : ev.ripeti !== 'nessuna' ? 'Crea impegni' : "Aggiungi all'agenda"}</button>
      <p className="pp-riga-meta">Compare anche nell'agenda dello studio, con il contorno tratteggiato dei tuoi impegni.</p>
      {ev.id && (
        <div className="pp-elimina">
          {!conferma
            ? <button className="pp-testo-link pp-rosso" onClick={() => setConferma(true)}><IconaCestino size={16} /> Elimina evento</button>
            : (
              <div className="pp-conferma"><span>Eliminare l'evento? Sparisce anche dall'agenda dello studio.</span>
                <button className="pp-bottone pp-bottone-rosso" onClick={() => esegui(async () => { await eliminaImpegno(ev.id); aggiorna(); mostra('Evento eliminato'); chiudi(); })}>Elimina</button>
                <button className="pp-bottone pp-bottone-chiaro" onClick={() => setConferma(false)}>Annulla</button>
              </div>
            )}
        </div>
      )}
    </>
  );
}

export function PaginaAppuntamento({ a }) {
  const fine = minuti(a.ora) + (Number(a.durata) || 30);
  return (
    <>
      <div className="pp-dettaglio-testa" style={{ '--c': a.colore || '#0c447c' }}>
        <span className="pp-etichetta">Appuntamento dello studio</span>
        <h2>{a.paziente || a.tipo || 'Appuntamento'}</h2>
        <p className="pp-riga-meta">{nomeGiorno(a.data)} · {a.ora?.slice(0, 5)}–{ora(fine)}</p>
      </div>
      <dl className="pp-dati">
        {a.tipo && <div><dt>Tipo</dt><dd>{a.tipo}</dd></div>}
        <div><dt>Durata</dt><dd>{Number(a.durata) || 30} minuti</dd></div>
        {a.stato && <div><dt>Stato</dt><dd>{a.stato}</dd></div>}
        {a.note && <div><dt>Note</dt><dd>{a.note}</dd></div>}
      </dl>
      <p className="pp-riga-meta pp-origine">Gli appuntamenti dei pazienti si spostano dall'agenda dello studio, dove ci sono poltrone, operatori e promemoria.</p>
    </>
  );
}
