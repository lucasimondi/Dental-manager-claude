// POL-VITA-004/007 — Agenda di Poliedron Personal: è l'agenda dello studio (stessi dati).
// Giorno e Settimana sono identici a Poliedra (AgendaGriglia.jsx); Mese con i pallini e l'elenco
// del giorno. Pagamenti e scadenze dell'archivio stanno sopra la griglia, mai sugli appuntamenti.
import { useEffect, useMemo, useState } from 'react';
import { archivioDb } from './lib/supabasePersonal.js';
import { pagamenti as caricaPagamenti } from './lib/archivio.js';
import { euro } from './lib/coreArchivio.js';
import {
  studioDb, sessioneStudio, entraStudio, appuntamentiTra, impegniTra, salvaImpegno, eliminaImpegno, tipiAppuntamento,
} from './lib/studio.js';
import {
  isoData, daIso, piuGiorni, oggi, minuti, ora, giorniSettimana, grigliaMese, stessoMese, elementiDelGiorno,
  conteggi, coloreEvento, nomeEtichetta, COLORE_SCADENZA,
} from './lib/agenda.js';
import { IconaIndietro, IconaFreccia, IconaCestino } from './Icone.jsx';
import { GrigliaPoliedra, ViewPicker } from './AgendaGriglia.jsx';

const nomeGiorno = (s, forma = 'long') => daIso(s).toLocaleDateString('it-IT', { weekday: forma, day: 'numeric', month: 'long' });
const meseAnno = (s) => { const t = daIso(s).toLocaleDateString('it-IT', { month: 'long', year: 'numeric' }); return t.charAt(0).toUpperCase() + t.slice(1); };

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
  useEffect(() => {
    let vivo = true;
    esegui(async () => {
      const [appuntamenti, impegni, tutti] = await Promise.all([appuntamentiTra(da, a), impegniTra(da, a), caricaPagamenti(archivioDb)]);
      if (vivo) setDati({ appuntamenti, impegni, scadenze: tutti.filter((s) => s.data >= da && s.data <= a) });
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
              <span className="pp-riga-testo"><span className="pp-riga-titolo">{e.titolo}</span><span className="pp-riga-meta">tutto il giorno · {nomeEtichetta(e.tipo, etichette)}</span></span>
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
              <span className="pp-riga-testo"><span className="pp-riga-titolo">{x.dato.titolo}</span><span className="pp-riga-meta">{ora(x.inizio)}–{ora(x.fine)} · {nomeEtichetta(x.dato.tipo, etichette)}</span></span>
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
  const [modo, setModo] = useState('giorno');
  const [giorno, setGiorno] = useState(oggi());
  const [coloriTipi, setColoriTipi] = useState({});

  useEffect(() => {
    sessioneStudio().then((s) => setCollegata(!!s));
    const { data } = studioDb.auth.onAuthStateChange((_e, s) => setCollegata(!!s));
    return () => data.subscription.unsubscribe();
  }, []);
  useEffect(() => { if (collegata) tipiAppuntamento().then((t) => setColoriTipi(Object.fromEntries(t.map((x) => [x.nome, x.colore])))).catch(() => {}); }, [collegata]);

  const [da, a] = useMemo(() => {
    if (modo === 'mese') { const g = grigliaMese(giorno); return [g[0], g[41]]; }
    if (modo === 'settimana') { const g = giorniSettimana(giorno); return [g[0], g[6]]; }
    return [giorno, giorno];
  }, [modo, giorno]);

  if (collegata === undefined) return null;
  if (!collegata) return <AccessoStudio onEntrato={() => setCollegata(true)} />;
  return (
    <ContenutoAgenda {...{ ctx, modo, setModo, giorno, setGiorno, da, a, etichette, coloriTipi, versione, esegui }} />
  );
}

function ContenutoAgenda({ ctx, modo, setModo, giorno, setGiorno, da, a, etichette, coloriTipi, versione, esegui }) {
  const dati = useDatiAgenda(da, a, versione, esegui);
  const passo = modo === 'mese' ? null : modo === 'settimana' ? 7 : 1;
  const sposta = (verso) => {
    if (passo) { setGiorno(piuGiorni(giorno, verso * passo)); return; }
    const d = daIso(giorno);
    setGiorno(isoData(new Date(d.getFullYear(), d.getMonth() + verso, 1, 12)));
  };
  const titolo = modo === 'mese' ? meseAnno(giorno) : modo === 'settimana' ? `${daIso(da).getDate()} – ${nomeGiorno(a, undefined).replace(/^\w+ /, '')}` : nomeGiorno(giorno);
  const griglia = modo === 'mese' ? grigliaMese(giorno) : [];
  const numeri = useMemo(() => (dati && modo === 'mese' ? conteggi(griglia, dati) : {}), [dati, modo, griglia.join()]);

  if (modo !== 'mese') {
    return !dati ? <p className="pp-vuoto">Carico l'agenda…</p>
      : <GrigliaPoliedra view={modo} setView={setModo} giorno={giorno} setGiorno={setGiorno} dati={dati} ctx={ctx} etichette={etichette} coloriTipi={coloriTipi} />;
  }
  return (
    <>
      <div className="ag-barra">
        <span className="ag-barra-sinistra">
          <button className="pp-icona-bottone pp-piccolo" onClick={() => sposta(-1)} aria-label="Mese precedente"><IconaIndietro size={16} /></button>
          <button className="ag-mese" onClick={() => setGiorno(oggi())}>{titolo}</button>
          <button className="pp-icona-bottone pp-piccolo" onClick={() => sposta(1)} aria-label="Mese successivo"><IconaFreccia size={16} /></button>
        </span>
        <ViewPicker view={modo} setView={setModo} />
      </div>
      {!dati ? <p className="pp-vuoto">Carico l'agenda…</p> : (
        <>
          <div className="pp-mese">
            {['L', 'M', 'M', 'G', 'V', 'S', 'D'].map((x, i) => <span key={i} className="pp-mese-intestazione">{x}</span>)}
            {griglia.map((g) => {
              const n = numeri[g] || {};
              return (
                <button key={g} className={`pp-mese-giorno${stessoMese(g, giorno) ? '' : ' fuori'}${g === giorno ? ' scelto' : ''}${g === oggi() ? ' oggi' : ''}`} onClick={() => setGiorno(g)}>
                  <span>{daIso(g).getDate()}</span>
                  <span className="pp-mese-punti">
                    {n.appuntamenti > 0 && <i className="app" />}
                    {n.eventi > 0 && <i className="ev" />}
                    {n.scadenze > 0 && <i className="sc" />}
                  </span>
                </button>
              );
            })}
          </div>
          <p className="pp-riga-meta pp-legenda"><i className="app" /> studio <i className="ev" /> tuoi eventi <i className="sc" /> pagamenti</p>
          <ElencoGiorno giorno={giorno} dati={dati} ctx={ctx} etichette={etichette} coloriTipi={coloriTipi} />
        </>
      )}
    </>
  );
}

export function PaginaEvento({ evento: iniziale = {}, ctx, chiudi }) {
  const { esegui, aggiorna, mostra, impostazioni } = ctx;
  const etichette = impostazioni.etichette;
  const [ev, setEv] = useState(() => ({
    titolo: '', tipo: etichette[0]?.id || 'personale', colore: '', data_inizio: oggi(), tutto_il_giorno: false,
    ora_inizio: '09:00', ora_fine: '10:00', note: '', ...iniziale,
    ora_inizio: (iniziale.ora_inizio || '09:00').slice(0, 5), ora_fine: (iniziale.ora_fine || iniziale.ora_inizio || '10:00').slice(0, 5),
  }));
  const [conferma, setConferma] = useState(false);
  const cambia = (k, v) => setEv((x) => ({ ...x, [k]: v }));
  const etichetta = etichette.find((e) => e.id === ev.tipo || e.nome === ev.tipo);
  const colore = ev.colore || etichetta?.colore || '#64748b';
  const valido = ev.titolo.trim() && ev.data_inizio && (ev.tutto_il_giorno || minuti(ev.ora_fine) > minuti(ev.ora_inizio));
  const salva = () => esegui(async () => {
    await salvaImpegno({ ...ev, data_fine: ev.data_fine && ev.data_fine >= ev.data_inizio ? ev.data_fine : ev.data_inizio, colore: ev.colore || etichetta?.colore || null });
    aggiorna(); mostra(ev.id ? 'Evento aggiornato' : 'Evento aggiunto all\'agenda'); chiudi();
  });
  return (
    <>
      <div className="pp-evento-anteprima" style={{ '--c': colore }}><strong>{ev.titolo || 'Nuovo evento'}</strong><span>{nomeEtichetta(ev.tipo, etichette)}</span></div>
      <label className="pp-campo"><span>Titolo</span><input value={ev.titolo} onChange={(e) => cambia('titolo', e.target.value)} placeholder="Es. Calcetto, cena, dentista Giulia" /></label>
      <div className="pp-due">
        <label className="pp-campo"><span>Giorno</span><input type="date" value={ev.data_inizio} onChange={(e) => cambia('data_inizio', e.target.value)} /></label>
        <label className="pp-campo"><span>Fino al</span><input type="date" value={ev.data_fine || ev.data_inizio} min={ev.data_inizio} onChange={(e) => cambia('data_fine', e.target.value)} /></label>
      </div>
      <label className="pp-interruttore"><input type="checkbox" checked={ev.tutto_il_giorno} onChange={(e) => cambia('tutto_il_giorno', e.target.checked)} /><span>Tutto il giorno</span></label>
      {!ev.tutto_il_giorno && (
        <div className="pp-due">
          <label className="pp-campo"><span>Dalle</span><input type="time" step="300" value={ev.ora_inizio} onChange={(e) => { const d = minuti(ev.ora_fine) - minuti(ev.ora_inizio); setEv((x) => ({ ...x, ora_inizio: e.target.value, ora_fine: ora(Math.min(minuti(e.target.value) + Math.max(d, 15), 23 * 60 + 59)) })); }} /></label>
          <label className="pp-campo"><span>Alle</span><input type="time" step="300" value={ev.ora_fine} onChange={(e) => cambia('ora_fine', e.target.value)} /></label>
        </div>
      )}
      <div className="pp-campo"><span>Etichetta</span>
        <div className="pp-etichette">
          {etichette.map((e) => (
            <button key={e.id} type="button" className={`pp-etichetta-scelta${(ev.tipo === e.id || ev.tipo === e.nome) ? ' attiva' : ''}`} style={{ '--c': e.colore }} onClick={() => setEv((x) => ({ ...x, tipo: e.id, etichetta: e.id, colore: '' }))}>{e.nome}</button>
          ))}
        </div>
      </div>
      <label className="pp-campo"><span>Colore di questo evento</span>
        <input type="color" className="pp-colore" value={colore} onChange={(e) => cambia('colore', e.target.value)} />
      </label>
      <label className="pp-campo"><span>Note</span><input value={ev.note || ''} onChange={(e) => cambia('note', e.target.value)} placeholder="Dove, con chi…" /></label>
      <button className="pp-bottone pp-bottone-largo" disabled={!valido} onClick={salva}>{ev.id ? 'Salva modifiche' : 'Aggiungi all\'agenda'}</button>
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
