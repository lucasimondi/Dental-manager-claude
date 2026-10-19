import { areaArchivio, avvisoCartella } from '../../lib/revisioneArchivio.js';
import { scadenzeRevisione } from '../../lib/archivio.js';
import { ScorriElimina } from '../../ScorriElimina.jsx';
// POL-VITA-016 — Cartelle in Documenti: una cartella per ente (es. "Kerdos"), in griglia o in elenco.
// Dentro: periodo, contatti, etichette, note, promemoria (vanno in Agenda, in Oggi e nel riepilogo
// delle 7), sintesi dell'AI, bozza di risposta (solo tra le bozze di Gmail) e i documenti, con
// selezione multipla per condividere, spostare, eliminare. La cartella si rinomina, si unisce a
// un'altra, si toglie (i documenti restano) o si elimina con i suoi documenti.
import { useEffect, useMemo, useState } from 'react';
import { archivioDb } from '../../lib/supabasePersonal.js';
import { cercaArchivio, eliminaDocumenti, cestinaSuDrive, segnaScadenza } from '../../lib/archivio.js';
import {
  caricaCartelle, cartella as caricaCartella, cartelleVisibili, periodoCartella, contattiCartella, promemoriaCartella, nuovoPromemoria,
  salvaCartella, rinominaCartella, sciogliCartella, analizzaCartella, bozzaRisposta, icsPromemoria, ETICHETTE_SUGGERITE, etichettePulite,
  STATI, COLORI_STATO, GIORNI_ATTESA, inAttesaDaTroppo, giorniDa, suggerimentiCartelle, nomeProposto, ignoraSuggerimento, unisciCartelle, suggerisciConAI,
} from '../../lib/cartelle.js';
import { condividi } from '../../lib/condividi.js';
import { euro } from '../../lib/coreArchivio.js';
import { colore, dataBreve, quando, oggiIso, Vuoto, Sezione, Gruppo, ConfermaElimina, tokenSessione } from '../../ui.jsx';
import { ElencoSelezionabile, FoglioScelta } from './Selezione.jsx';
import { IconaCerca, IconaChiudi, IconaDocumenti, IconaFreccia, IconaCalendario, IconaChat, IconaEmail, IconaCestino, IconaStella } from '../../Icone.jsx';

const MODO_KEY = 'poliedron-personal-cartelle';
const leggiModo = () => { try { return localStorage.getItem(MODO_KEY) || 'griglia'; } catch { return 'griglia'; } };

export function leggiSintesi(testo) {
  if (!testo) return null;
  try { const o = JSON.parse(testo); return o && typeof o === 'object' ? o : { sintesi: String(testo) }; } catch { return { sintesi: String(testo) }; }
}

/* ---------- elenco delle cartelle ---------- */
export function VistaCartelle({ ctx, anchePocoUtili = false }) {
  const { esegui, apri, versione, fascicoli } = ctx;
  const [cartelle, setCartelle] = useState(null);
  const [area, setArea] = useState(null);
  const [avvisi, setAvvisi] = useState({});
  const [testo, setTesto] = useState('');
  const [etichetta, setEtichetta] = useState(null);
  const [stato, setStato] = useState('attive');
  const [suggeriti, setSuggeriti] = useState(0);
  const [modo, setModoStato] = useState(leggiModo);
  const setModo = (m) => { setModoStato(m); try { localStorage.setItem(MODO_KEY, m); } catch { /* facoltativo */ } };
  useEffect(() => { esegui(async () => {
    const [cs, ss] = await Promise.all([caricaCartelle(archivioDb), scadenzeRevisione(archivioDb, false)]);
    setCartelle(cs);
    setAvvisi(Object.fromEntries(cs.map((c) => [c.ente, avvisoCartella(ss.filter((s) => s.cartella === c.ente || s.documento?.ente === c.ente))])));
  }); }, [esegui, versione]);
  useEffect(() => { suggerimentiCartelle(archivioDb).then((r) => setSuggeriti(r.length)).catch(() => setSuggeriti(0)); }, [versione]);
  const visibili = useMemo(() => cartelleVisibili(cartelle, { testo, anchePocoUtili, etichetta, stato }).filter((c) => !area || area === 'tutte' || areaArchivio(c.fascicolo) === area), [cartelle, testo, anchePocoUtili, etichetta, stato, area]);
  const ferme = useMemo(() => inAttesaDaTroppo(cartelle), [cartelle]);
  const tutteEtichette = useMemo(() => [...new Set((cartelle || []).flatMap((c) => c.etichette || []))].sort(), [cartelle]);
  if (!cartelle) return <Vuoto>Carico le cartelle…</Vuoto>;
  const nomeFasc = (c) => fascicoli.find((f) => f.codice === c.fascicolo)?.nome || '';
  const apriCartella = (c) => apri({ tipo: 'cartella', ente: c.ente, titolo: c.ente });
  const badge = (c) => avvisi[c.ente]?.n > 0 ? <span className="pp-pallino" style={{ background: avvisi[c.ente].colore }} role="status" aria-label={`${avvisi[c.ente].n} scadenze da controllare`} /> : c.n_da_fare > 0 ? <span className="pp-pallino" style={{ background: '#d97706' }} aria-label={`${c.n_da_fare} documenti da valutare`} /> : null;
  const aree = [...new Set(cartelle.map((c) => areaArchivio(c.fascicolo)))];
  if (!area && !testo && !etichetta) return <>
    <p className="pp-frase">Sei aree per ritrovare tutto. Enti e pratiche restano raggruppati al loro interno.</p>
    <div className="pp-griglia">{aree.map((nome) => {
      const cs = cartelle.filter((c) => areaArchivio(c.fascicolo) === nome);
      const n = cs.reduce((t, c) => t + (avvisi[c.ente]?.n || 0), 0);
      return <button key={nome} className="pp-cartella" onClick={() => setArea(nome)}><span className="pp-cartella-icona"><IconaDocumenti size={20} /></span><strong>{nome}</strong><span>{cs.length} cartelle · {cs.reduce((t, c) => t + c.n, 0)} documenti</span>{n > 0 && <span className="pp-rosso">● {n} scadenze da controllare</span>}</button>;
    })}</div>
    <button className="pp-chip-azione" onClick={() => setArea('tutte')}>Tutte le cartelle</button>
    <button className="pp-chip-azione" onClick={() => apri({ tipo: 'suggerimenti-cartelle' })}>Unisci cartelle dello stesso ente</button>
  </>;
  return (
    <>
      <button className="pp-chip-azione" onClick={() => setArea(null)}>‹ Aree dell’archivio</button>
      <div className="pp-cerca pp-cerca-piccola"><IconaCerca size={16} /><input value={testo} onChange={(e) => setTesto(e.target.value)} placeholder="Trova una cartella" aria-label="Trova una cartella" /></div>
      {ferme.length > 0 && (
        <button className="pp-avviso-attesa" onClick={() => setStato('in_attesa')}>
          <span className="pp-pallino pp-media" aria-hidden="true" />
          <span className="pp-riga-testo"><span className="pp-riga-titolo">{ferme.length === 1 ? `${ferme[0].ente} è in attesa` : `${ferme.length} cartelle in attesa`} da più di {GIORNI_ATTESA} giorni</span>
            <span className="pp-riga-meta">{ferme.slice(0, 3).map((c) => `${c.ente} (${giorniDa(c.stato_dal)} gg)`).join(' · ')}</span></span>
          <IconaFreccia size={16} />
        </button>
      )}
      {suggeriti > 0 && (
        <Gruppo>
          <button className="pp-riga pp-riga-sola" onClick={() => apri({ tipo: 'suggerimenti-cartelle', titolo: 'Cartelle da unire' })}>
            <span className="pp-riga-testo"><span className="pp-riga-titolo">{suggeriti} {suggeriti === 1 ? 'proposta' : 'proposte'} di cartelle da unire</span><span className="pp-riga-meta">Stesso mittente o stessa pratica: guardale e decidi tu</span></span>
            <IconaFreccia size={16} />
          </button>
        </Gruppo>
      )}
      <div className="pp-filtri">
        {[['attive', 'Attive'], ['aperta', 'Aperte'], ['in_attesa', 'In attesa'], ['chiusa', 'Chiuse']].map(([id, nome]) => (
          <button key={id} className={`pp-filtro${stato === id ? ' attivo' : ''}`} onClick={() => setStato(id)}>{nome}</button>
        ))}
      </div>
      {tutteEtichette.length > 0 && (
        <div className="pp-filtri">
          {tutteEtichette.map((e) => (
            <button key={e} className={`pp-filtro${etichetta === e ? ' attivo' : ''}`} onClick={() => setEtichetta(etichetta === e ? null : e)}>{e}{etichetta === e && <IconaChiudi size={12} />}</button>
          ))}
        </div>
      )}
      <div className="pp-elenco-testa">
        <span className="pp-frase">{visibili.length} cartelle</span>
        <span className="pp-commuta" role="group" aria-label="Vista">
          <button className={modo === 'griglia' ? 'attivo' : ''} onClick={() => setModo('griglia')} aria-label="Cartelle a icone">▦</button>
          <button className={modo === 'righe' ? 'attivo' : ''} onClick={() => setModo('righe')} aria-label="Cartelle in elenco">☰</button>
        </span>
      </div>
      {!visibili.length && <Vuoto>Nessuna cartella{testo ? ' con questo nome' : ''}. Le cartelle nascono dall'ente dei documenti (chi li manda o li riguarda).</Vuoto>}
      {modo === 'griglia' ? (
        <div className="pp-griglia">
          {visibili.map((c) => (
            <ScorriElimina key={c.ente} cartella={c} ctx={ctx}><button className="pp-cartella pp-cartella-ente" style={{ '--c': colore(c.fascicolo) }} onClick={() => apriCartella(c)}>
              <span className="pp-cartella-icona"><IconaDocumenti size={20} /></span>
              <span className="pp-cartella-nome">{c.ente} {badge(c)}</span>
              {c.stato && <span className="pp-badge-stato" style={{ '--c': COLORI_STATO[c.stato] }}>{STATI[c.stato]}</span>}
              {(c.etichette || []).length > 0 && <span className="pp-cartella-etichette">{c.etichette.slice(0, 2).map((e) => <span key={e} className="pp-etichetta-mini">{e}</span>)}</span>}
              <span className="pp-cartella-numero">{c.n} {c.n === 1 ? 'documento' : 'documenti'}<br />{periodoCartella(c.dal, c.al)}{c.n_promemoria ? <em> · {c.n_promemoria} promemoria</em> : c.n_da_fare ? <em> · {c.n_da_fare} da fare</em> : null}</span>
            </button></ScorriElimina>
          ))}
        </div>
      ) : (
        <Gruppo>
          {visibili.map((c) => (
            <ScorriElimina key={c.ente} cartella={c} ctx={ctx}><button className="pp-riga" onClick={() => apriCartella(c)}>
              <span className="pp-ente-iniziale" style={{ '--c': colore(c.fascicolo) }}>{c.ente.slice(0, 1).toUpperCase()}</span>
              <span className="pp-riga-testo">
                <span className="pp-riga-titolo">{c.ente} {badge(c)}</span>
                <span className="pp-riga-meta">{[STATI[c.stato], nomeFasc(c), periodoCartella(c.dal, c.al), ...(c.etichette || [])].filter(Boolean).join(' · ')}</span>
              </span>
              {c.n_promemoria > 0 && <span className="pp-pallino pp-media" aria-label="Promemoria aperti" />}
              <span className="pp-conteggio">{c.n}</span>
              <IconaFreccia size={16} />
            </button></ScorriElimina>
          ))}
        </Gruppo>
      )}
      <Gruppo>
        <button className="pp-riga pp-riga-sola" onClick={() => apri({ tipo: 'senza-cartella', titolo: 'Senza cartella' })}>
          <span className="pp-riga-testo"><span className="pp-riga-titolo">Documenti senza cartella</span><span className="pp-riga-meta">Senza ente: aprili per metterli in una cartella</span></span>
          <IconaFreccia size={16} />
        </button>
      </Gruppo>
    </>
  );
}

/* ---------- dentro una cartella ---------- */
export function PaginaCartella({ ente: enteIniziale, ctx, chiudi, sostituisci }) {
  const { esegui, aggiorna, mostra, versione, fascicoli, apri } = ctx;
  const [ente, setEnte] = useState(enteIniziale);
  const [info, setInfo] = useState(null);
  const [documenti, setDocumenti] = useState(null);
  const [promemoria, setPromemoria] = useState([]);
  const [pannello, setPannello] = useState(null); // promemoria | modifica | elimina | bozza | etichetta
  const [rinfresca, setRinfresca] = useState(0);
  const [lavoro, setLavoro] = useState(null); // testo mentre l'AI lavora
  const [bozza, setBozza] = useState(null);
  const [ultimoPromemoria, setUltimoPromemoria] = useState(null);

  useEffect(() => {
    esegui(async () => {
      const [c, docs] = await Promise.all([caricaCartella(archivioDb, ente), cercaArchivio(archivioDb, { ente, anchePocoUtili: true, limite: 400 })]);
      setInfo(c);
      setDocumenti(docs);
      setPromemoria(await promemoriaCartella(archivioDb, ente, docs.map((d) => d.id)));
    });
  }, [ente, esegui, versione, rinfresca]);

  const contatti = useMemo(() => contattiCartella(documenti), [documenti]);
  const sintesi = leggiSintesi(info?.sintesi);
  const ricarica = () => { setRinfresca((n) => n + 1); aggiorna(); };
  const aperti = promemoria.filter((s) => !s.completata);

  if (!documenti) return <Vuoto>Carico…</Vuoto>;
  if (!documenti.length) return <Vuoto>Questa cartella è vuota.</Vuoto>;

  const etichette = info?.etichette || [];
  const salvaEtichette = (nuove) => esegui(async () => { await salvaCartella(archivioDb, ente, { etichette: nuove }); setPannello(null); ricarica(); });
  const sceltaEtichetta = (id) => {
    if (id === '__nuova') {
      const nome = window.prompt('Nuova etichetta (es. "Da pagare")', '');
      if (nome && nome.trim()) salvaEtichette(etichettePulite([...etichette, nome]));
      return;
    }
    salvaEtichette(etichette.includes(id) ? etichette.filter((e) => e !== id) : [...etichette, id]);
  };

  const analizza = () => esegui(async () => {
    setLavoro('Poliedron sta leggendo la cartella…');
    try { await analizzaCartella({ token: await tokenSessione(), ente }); mostra('Sintesi pronta'); ricarica(); } finally { setLavoro(null); }
  });

  return (
    <>
      <section className="pp-pannello pp-cartella-testa" style={{ '--c': colore(info?.fascicolo || documenti[0]?.fascicolo) }}>
        <div className="pp-cartella-testa-riga">
          <span className="pp-cartella-icona"><IconaDocumenti size={22} /></span>
          <div>
            <h2 className="pp-cartella-titolo">{ente}</h2>
            <p className="pp-riga-meta">
              {[`${documenti.length} ${documenti.length === 1 ? 'documento' : 'documenti'}`, periodoCartella(info?.dal, info?.al),
                fascicoli.find((f) => f.codice === info?.fascicolo)?.nome, info?.totale != null && Number(info.totale) ? `totale ${euro(info.totale)}` : null].filter(Boolean).join(' · ')}
            </p>
          </div>
        </div>
        <div className="pp-cartella-etichette pp-cartella-etichette-grandi">
          {etichette.map((e) => <button key={e} className="pp-etichetta-mini" onClick={() => sceltaEtichetta(e)} aria-label={`Togli l'etichetta ${e}`}>{e} ×</button>)}
          <button className="pp-etichetta-mini pp-etichetta-aggiungi" onClick={() => setPannello('etichetta')}>＋ Etichetta</button>
        </div>
        <div className="pp-stato-cartella" role="group" aria-label="Stato della cartella">
          {Object.entries(STATI).map(([id, nome]) => (
            <button key={id} className={info?.stato === id ? 'attivo' : ''} style={{ '--c': COLORI_STATO[id] }} aria-pressed={info?.stato === id}
              onClick={() => esegui(async () => { await salvaCartella(archivioDb, ente, { stato: info?.stato === id ? null : id }); ricarica(); mostra(info?.stato === id ? 'Stato tolto' : `Cartella: ${nome.toLowerCase()}`); })}>
              {nome}
            </button>
          ))}
        </div>
        {info?.stato && info?.stato_dal && <p className="pp-riga-meta">{STATI[info.stato]} dal {dataBreve(info.stato_dal)}{info.stato === 'in_attesa' ? ` · da ${giorniDa(info.stato_dal)} giorni` : ''}</p>}
        {info?.note && <p className="pp-cartella-note">{info.note}</p>}
        <div className="pp-cartella-azioni">
          <button onClick={analizza} disabled={!!lavoro}><IconaChat size={18} /><span>Sintesi AI</span></button>
          <button onClick={() => setPannello(pannello === 'bozza' ? null : 'bozza')}><IconaEmail size={18} /><span>Rispondi</span></button>
          <button onClick={() => setPannello(pannello === 'promemoria' ? null : 'promemoria')}><IconaCalendario size={18} /><span>Promemoria</span></button>
          <button onClick={() => setPannello(pannello === 'modifica' ? null : 'modifica')}><IconaStella size={18} /><span>Modifica</span></button>
          <button className="pp-rosso" onClick={() => setPannello(pannello === 'elimina' ? null : 'elimina')}><IconaCestino size={18} /><span>Elimina</span></button>
        </div>
        {lavoro && <p className="pp-riga-meta"><span className="pp-rotella" /> {lavoro}</p>}
      </section>

      {pannello === 'promemoria' && (
        <FormPromemoria ente={ente} ctx={ctx} onFatto={(s) => { setPannello(null); setUltimoPromemoria(s); ricarica(); mostra('Promemoria aggiunto: lo trovi in Agenda e in Oggi'); }} onAnnulla={() => setPannello(null)} />
      )}
      {ultimoPromemoria && <AggiungiCalendario s={ultimoPromemoria} ente={ente} mostra={mostra} onChiudi={() => setUltimoPromemoria(null)} />}
      {pannello === 'modifica' && (
        <FormModifica ente={ente} note={info?.note || ''} ctx={ctx} onAnnulla={() => setPannello(null)}
          onFatto={(nuovo) => { setPannello(null); if (nuovo !== ente) { setEnte(nuovo); sostituisci?.({ tipo: 'cartella', ente: nuovo, titolo: nuovo }); } ricarica(); }} />
      )}
      {pannello === 'elimina' && (
        <PannelloElimina ente={ente} documenti={documenti} ctx={ctx} onAnnulla={() => setPannello(null)} onFatto={() => { aggiorna(); chiudi?.(); }} />
      )}
      {pannello === 'bozza' && (
        <FormBozza ente={ente} ctx={ctx} onFatto={(b) => { setBozza(b); setPannello(null); }} onAnnulla={() => setPannello(null)} />
      )}
      {pannello === 'etichetta' && (
        <FoglioScelta titolo="Etichette della cartella"
          voci={[...new Set([...ETICHETTE_SUGGERITE, ...etichette])].map((e) => ({ id: e, nome: e, attivo: etichette.includes(e) })).concat([{ id: '__nuova', nome: 'Nuova etichetta…' }])}
          onScegli={sceltaEtichetta} onChiudi={() => setPannello(null)} />
      )}

      {bozza && (
        <Sezione titolo="Bozza di risposta" azione={<button className="pp-testo-link" onClick={() => setBozza(null)}>Chiudi</button>}>
          <div className="pp-pannello">
            <p className="pp-riga-meta">A: {bozza.a} · {bozza.oggetto}</p>
            <p className="pp-testo-lungo">{bozza.testo}</p>
            <p className="pp-riga-meta">È tra le bozze di Gmail: rileggila e inviala tu da lì. Non è partito nulla.</p>
            <a className="pp-bottone" href={bozza.link} target="_blank" rel="noreferrer">Apri le bozze di Gmail</a>
          </div>
        </Sezione>
      )}

      {sintesi && (
        <Sezione titolo="Sintesi" azione={<span className="pp-riga-meta">{info?.sintesi_il ? `aggiornata ${dataBreve(info.sintesi_il)}` : ''}</span>}>
          <div className="pp-pannello pp-sintesi">
            {sintesi.sintesi && <p>{sintesi.sintesi}</p>}
            {sintesi.punti?.length > 0 && <ul>{sintesi.punti.map((p) => <li key={p}>{p}</li>)}</ul>}
            {sintesi.da_fare?.length > 0 && <><strong>Da fare</strong><ul>{sintesi.da_fare.map((p) => <li key={p}>{p}</li>)}</ul></>}
            {sintesi.promemoria?.length > 0 && (
              <div className="pp-sintesi-promemoria">
                <strong>Date trovate</strong>
                {sintesi.promemoria.map((p) => (
                  <button key={p.data + p.descrizione} className="pp-chip-azione" onClick={() => esegui(async () => { const s = await nuovoPromemoria(archivioDb, ente, p); setUltimoPromemoria(s); ricarica(); mostra('Promemoria aggiunto'); })}>
                    ＋ {dataBreve(p.data)}: {p.descrizione}
                  </button>
                ))}
              </div>
            )}
          </div>
        </Sezione>
      )}

      {aperti.length > 0 && (
        <Sezione titolo="Promemoria">
          <Gruppo>
            {aperti.map((s) => (
              <div key={s.id} className="pp-riga">
                <span className="pp-riga-testo"><span className="pp-riga-titolo">{s.descrizione}</span><span className="pp-riga-meta">{dataBreve(s.data)} · {quando(s.data)}{s.importo != null ? ` · ${euro(s.importo)}` : ''}</span></span>
                <button className="pp-chip-azione" onClick={() => esegui(async () => { await segnaScadenza(archivioDb, s.id, true); ricarica(); mostra('Fatto'); })}>Fatto</button>
              </div>
            ))}
          </Gruppo>
        </Sezione>
      )}

      {contatti.length > 0 && (
        <Sezione titolo={`Contatti (${contatti.length})`}>
          <Gruppo>
            {contatti.slice(0, 8).map((c) => (
              <a key={c.email || c.nome} className="pp-riga" href={c.email ? `mailto:${c.email}` : undefined}>
                <span className="pp-ente-iniziale" style={{ '--c': '#64748b' }}>{c.nome.slice(0, 1).toUpperCase()}</span>
                <span className="pp-riga-testo"><span className="pp-riga-titolo">{c.nome}</span><span className="pp-riga-meta">{[c.email !== c.nome ? c.email : null, `${c.n} ${c.n === 1 ? 'documento' : 'documenti'}`, c.ultimo ? `ultimo ${dataBreve(c.ultimo)}` : null].filter(Boolean).join(' · ')}</span></span>
              </a>
            ))}
          </Gruppo>
        </Sezione>
      )}

      <Sezione titolo="Documenti">
        <ElencoSelezionabile elenco={documenti} ctx={{ ...ctx, apri }} onCambiato={ricarica} intestazione={`${documenti.length} documenti, dal più recente`} />
      </Sezione>
    </>
  );
}

function FormPromemoria({ ente, ctx, onFatto, onAnnulla }) {
  const [data, setData] = useState('');
  const [descrizione, setDescrizione] = useState('');
  const [importo, setImporto] = useState('');
  return (
    <div className="pp-pannello pp-form-cartella">
      <strong>Nuovo promemoria</strong>
      <p className="pp-riga-meta">Lo trovi in Agenda nel giorno scelto, nella pagina Oggi e nel riepilogo via email delle 7.</p>
      <label className="pp-campo">Data<input type="date" value={data} min={oggiIso()} onChange={(e) => setData(e.target.value)} /></label>
      <label className="pp-campo">Cosa<input value={descrizione} onChange={(e) => setDescrizione(e.target.value)} placeholder={`es. Rispondere a ${ente}`} /></label>
      <label className="pp-campo">Importo (facoltativo)<input inputMode="decimal" value={importo} onChange={(e) => setImporto(e.target.value)} placeholder="es. 120,00" /></label>
      <div className="pp-form-azioni">
        <button className="pp-bottone" disabled={!data} onClick={() => ctx.esegui(async () => onFatto(await nuovoPromemoria(archivioDb, ente, { data, descrizione, importo })))}>Salva</button>
        <button className="pp-bottone pp-bottone-chiaro" onClick={onAnnulla}>Annulla</button>
      </div>
    </div>
  );
}

// Dopo un promemoria: proposta di metterlo anche nel Calendario del telefono (file .ics).
function AggiungiCalendario({ s, ente, mostra, onChiudi }) {
  const file = useMemo(() => new File([icsPromemoria({ data: s.data, descrizione: s.descrizione, cartella: ente })], 'promemoria.ics', { type: 'text/calendar' }), [s, ente]);
  const apri = async () => {
    try {
      const r = await condividi({ titolo: s.descrizione, file });
      if (r === 'non_disponibile' || r === 'link') {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(file); a.download = 'promemoria.ics'; a.click();
      }
      onChiudi();
    } catch (e) { mostra(e.message); }
  };
  return (
    <div className="pp-pannello pp-form-cartella">
      <span>Vuoi anche un avviso nel Calendario del telefono?</span>
      <div className="pp-form-azioni">
        <button className="pp-bottone" onClick={apri}>Aggiungi al Calendario</button>
        <button className="pp-bottone pp-bottone-chiaro" onClick={onChiudi}>No, grazie</button>
      </div>
    </div>
  );
}

function FormModifica({ ente, note: noteIniziali, ctx, onFatto, onAnnulla }) {
  const [nome, setNome] = useState(ente);
  const [note, setNote] = useState(noteIniziali);
  const salva = () => ctx.esegui(async () => {
    const nuovo = nome.trim() || ente;
    if (nuovo !== ente) await rinominaCartella(archivioDb, ente, nuovo);
    await salvaCartella(archivioDb, nuovo, { note });
    ctx.mostra(nuovo !== ente ? `Cartella rinominata: ${nuovo}` : 'Salvato');
    onFatto(nuovo);
  });
  return (
    <div className="pp-pannello pp-form-cartella">
      <strong>Modifica cartella</strong>
      <label className="pp-campo">Nome<input value={nome} onChange={(e) => setNome(e.target.value)} /></label>
      <p className="pp-riga-meta">Se scegli il nome di un'altra cartella, le due si uniscono.</p>
      <label className="pp-campo">Note<textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder="es. Contratto in scadenza a giugno, referente Marco" /></label>
      <div className="pp-form-azioni">
        <button className="pp-bottone" onClick={salva}>Salva</button>
        <button className="pp-bottone pp-bottone-chiaro" onClick={onAnnulla}>Annulla</button>
      </div>
    </div>
  );
}

function PannelloElimina({ ente, documenti, ctx, onAnnulla, onFatto }) {
  const [conDocumenti, setConDocumenti] = useState(false);
  const [avanzamento, setAvanzamento] = useState(null);
  const togli = () => ctx.esegui(async () => { await sciogliCartella(archivioDb, ente); ctx.mostra('Cartella tolta: i documenti sono in "Senza cartella"'); onFatto(); });
  const elimina = (ancheDrive) => ctx.esegui(async () => {
    setAvanzamento({ fatti: 0, totale: documenti.length });
    let suDrive = null;
    try {
      // Prima Drive (lo script controlla che i file siano in archivio), poi l'archivio.
      if (ancheDrive) suDrive = await cestinaSuDrive({ token: await tokenSessione(), ids: documenti.map((d) => d.drive_file_id) });
      await eliminaDocumenti(archivioDb, documenti.map((d) => d.id), (fatti, totale) => setAvanzamento({ fatti, totale }));
    } finally { setAvanzamento(null); }
    ctx.mostra(`Cartella eliminata: ${documenti.length} documenti${suDrive ? `, ${suDrive.cestinati.length} file nel Cestino di Drive` : ''}`);
    onFatto();
  });
  if (avanzamento) return <div className="pp-pannello"><span className="pp-rotella" /> Elimino {avanzamento.fatti}/{avanzamento.totale}…</div>;
  if (conDocumenti) return <ConfermaElimina n={documenti.length} onNo={() => setConDocumenti(false)} onSi={elimina} />;
  return (
    <div className="pp-pannello pp-form-cartella">
      <strong>Eliminare la cartella "{ente}"?</strong>
      <button className="pp-bottone pp-bottone-chiaro" onClick={togli}>Togli solo la cartella<br /><small>i {documenti.length} documenti restano in archivio</small></button>
      <button className="pp-bottone pp-bottone-rosso" onClick={() => setConDocumenti(true)}>Elimina cartella e documenti…</button>
      <button className="pp-testo-link" onClick={onAnnulla}>Annulla</button>
    </div>
  );
}

function FormBozza({ ente, ctx, onFatto, onAnnulla }) {
  const [istruzioni, setIstruzioni] = useState('');
  const [attesa, setAttesa] = useState(false);
  const prepara = () => ctx.esegui(async () => {
    setAttesa(true);
    try { onFatto(await bozzaRisposta({ token: await tokenSessione(), ente, istruzioni })); } finally { setAttesa(false); }
  });
  return (
    <div className="pp-pannello pp-form-cartella">
      <strong>Risposta all'ultima email di {ente}</strong>
      <p className="pp-riga-meta">Poliedron scrive una bozza e la mette tra le bozze di Gmail. Non invia nulla: la rileggi e la mandi tu.</p>
      <label className="pp-campo">Cosa vuoi dire (facoltativo)<textarea rows={3} value={istruzioni} onChange={(e) => setIstruzioni(e.target.value)} placeholder="es. chiedi una rateizzazione in 3 mesi" /></label>
      <div className="pp-form-azioni">
        <button className="pp-bottone" disabled={attesa} onClick={prepara}>{attesa ? 'Scrivo…' : 'Prepara la bozza'}</button>
        <button className="pp-bottone pp-bottone-chiaro" onClick={onAnnulla}>Annulla</button>
      </div>
    </div>
  );
}

/* ---------- cartelle da unire (POL-VITA-018) ---------- */
// Proposte dal database (stesso dominio del mittente) e, a richiesta, dall'AI. Nulla cambia finché Luca
// non sceglie le cartelle, il nome e tocca "Unisci"; "Non unire" scarta la proposta per sempre.
export function PaginaSuggerimenti({ ctx }) {
  const { esegui, mostra, aggiorna } = ctx;
  const [proposte, setProposte] = useState(null);
  const [ai, setAi] = useState(null);
  const [attesaAi, setAttesaAi] = useState(false);
  const [rinfresca, setRinfresca] = useState(0);
  useEffect(() => { esegui(async () => setProposte(await suggerimentiCartelle(archivioDb))); }, [esegui, rinfresca]);
  const chiediAi = () => esegui(async () => {
    setAttesaAi(true);
    try { setAi((await suggerisciConAI({ token: await tokenSessione() })).map((g) => ({ chiave: `ai:${g.nome}`, nome: g.nome, enti: g.enti, motivo: g.motivo }))); } finally { setAttesaAi(false); }
  });
  const fatto = (msg, chiave) => { mostra(msg); aggiorna(); setAi((xs) => xs && xs.filter((g) => g.chiave !== chiave)); setRinfresca((n) => n + 1); };
  if (!proposte) return <Vuoto>Carico le proposte…</Vuoto>;
  return (
    <>
      <p className="pp-riga-meta">Cartelle che sembrano la stessa cosa (stesso mittente o stessa pratica). Scegli quali unire e con che nome: i documenti, i promemoria e le etichette vanno nella cartella unita.</p>
      <Gruppo>
        <button className="pp-riga pp-riga-sola" onClick={chiediAi} disabled={attesaAi}>
          <IconaChat size={18} />
          <span className="pp-riga-testo"><span className="pp-riga-titolo">{attesaAi ? 'Poliedron sta guardando le cartelle…' : 'Chiedi a Poliedron di proporne altre'}</span><span className="pp-riga-meta">Legge i nomi delle cartelle e gli oggetti delle email (mai i documenti dei pazienti)</span></span>
        </button>
      </Gruppo>
      {ai && (
        <Sezione titolo={`Proposte dell'AI (${ai.length})`}>
          {!ai.length && <Vuoto>Nessuna proposta in più.</Vuoto>}
          {ai.map((g) => <Proposta key={g.chiave} proposta={g} ctx={ctx} onFatto={(m) => fatto(m, g.chiave)} onIgnora={() => setAi((xs) => xs.filter((x) => x.chiave !== g.chiave))} />)}
        </Sezione>
      )}
      <Sezione titolo={`Stesso mittente (${proposte.length})`}>
        {!proposte.length && <Vuoto>Nessuna proposta: le cartelle sono già in ordine.</Vuoto>}
        {proposte.map((p) => (
          <Proposta key={p.chiave} proposta={{ ...p, nome: nomeProposto(p), motivo: `Tutte da @${p.dominio} · ${p.n} documenti` }} ctx={ctx}
            onFatto={(m) => fatto(m, p.chiave)}
            onIgnora={() => esegui(async () => { await ignoraSuggerimento(archivioDb, p.chiave); setRinfresca((n) => n + 1); mostra('Proposta scartata'); })} />
        ))}
      </Sezione>
    </>
  );
}

function Proposta({ proposta, ctx, onFatto, onIgnora }) {
  const [scelti, setScelti] = useState(() => new Set(proposta.enti));
  const [nome, setNome] = useState(proposta.nome);
  const cambia = (e) => setScelti((s) => { const n = new Set(s); if (n.has(e)) n.delete(e); else n.add(e); return n; });
  const unisci = () => ctx.esegui(async () => {
    const enti = proposta.enti.filter((e) => scelti.has(e));
    await unisciCartelle(archivioDb, enti, nome);
    onFatto(`${enti.length} cartelle unite in "${nome.trim()}"`);
  });
  return (
    <div className="pp-pannello pp-suggerimento">
      <span className="pp-riga-meta">{proposta.motivo}</span>
      {proposta.enti.map((e) => (
        <label key={e}><input type="checkbox" checked={scelti.has(e)} onChange={() => cambia(e)} /> {e}</label>
      ))}
      <input type="text" value={nome} onChange={(e) => setNome(e.target.value)} aria-label="Nome della cartella unita" />
      <div className="pp-form-azioni">
        <button className="pp-bottone" disabled={scelti.size < 2 || !nome.trim()} onClick={unisci}>Unisci {scelti.size}</button>
        <button className="pp-bottone pp-bottone-chiaro" onClick={onIgnora}>Non unire</button>
      </div>
    </div>
  );
}
