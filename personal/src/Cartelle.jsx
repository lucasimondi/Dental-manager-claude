// POL-VITA-014 — Cartelle in Documenti: una cartella per ente (es. "Kerdos"), in griglia o in elenco.
// Dentro: periodo, contatti, etichette, note, promemoria (vanno in Agenda, in Oggi e nel riepilogo
// delle 7), sintesi dell'AI, bozza di risposta (solo tra le bozze di Gmail) e i documenti, con
// selezione multipla per condividere, spostare, eliminare. La cartella si rinomina, si unisce a
// un'altra, si toglie (i documenti restano) o si elimina con i suoi documenti.
import { useEffect, useMemo, useState } from 'react';
import { archivioDb } from './lib/supabasePersonal.js';
import { cercaArchivio, eliminaDocumenti, cestinaSuDrive, segnaScadenza } from './lib/archivio.js';
import {
  caricaCartelle, cartella as caricaCartella, cartelleVisibili, periodoCartella, contattiCartella, promemoriaCartella, nuovoPromemoria,
  salvaCartella, rinominaCartella, sciogliCartella, analizzaCartella, bozzaRisposta, icsPromemoria, ETICHETTE_SUGGERITE, etichettePulite,
} from './lib/cartelle.js';
import { condividi } from './lib/condividi.js';
import { euro } from './lib/coreArchivio.js';
import { colore, dataBreve, quando, oggiIso, Vuoto, Sezione, Gruppo, ConfermaElimina, tokenSessione } from './ui.jsx';
import { ElencoSelezionabile, FoglioScelta } from './Documenti.jsx';
import { IconaCerca, IconaChiudi, IconaDocumenti, IconaFreccia, IconaCalendario, IconaChat, IconaEmail, IconaCestino, IconaStella } from './Icone.jsx';

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
  const [testo, setTesto] = useState('');
  const [etichetta, setEtichetta] = useState(null);
  const [modo, setModoStato] = useState(leggiModo);
  const setModo = (m) => { setModoStato(m); try { localStorage.setItem(MODO_KEY, m); } catch { /* facoltativo */ } };
  useEffect(() => { esegui(async () => setCartelle(await caricaCartelle(archivioDb))); }, [esegui, versione]);
  const visibili = useMemo(() => cartelleVisibili(cartelle, { testo, anchePocoUtili, etichetta }), [cartelle, testo, anchePocoUtili, etichetta]);
  const tutteEtichette = useMemo(() => [...new Set((cartelle || []).flatMap((c) => c.etichette || []))].sort(), [cartelle]);
  if (!cartelle) return <Vuoto>Carico le cartelle…</Vuoto>;
  const nomeFasc = (c) => fascicoli.find((f) => f.codice === c.fascicolo)?.nome || '';
  const apriCartella = (c) => apri({ tipo: 'cartella', ente: c.ente, titolo: c.ente });
  return (
    <>
      <div className="pp-cerca pp-cerca-piccola"><IconaCerca size={16} /><input value={testo} onChange={(e) => setTesto(e.target.value)} placeholder="Trova una cartella" aria-label="Trova una cartella" /></div>
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
            <button key={c.ente} className="pp-cartella pp-cartella-ente" style={{ '--c': colore(c.fascicolo) }} onClick={() => apriCartella(c)}>
              <span className="pp-cartella-icona"><IconaDocumenti size={20} /></span>
              <span className="pp-cartella-nome">{c.ente}</span>
              {(c.etichette || []).length > 0 && <span className="pp-cartella-etichette">{c.etichette.slice(0, 2).map((e) => <span key={e} className="pp-etichetta-mini">{e}</span>)}</span>}
              <span className="pp-cartella-numero">{c.n} {c.n === 1 ? 'documento' : 'documenti'}<br />{periodoCartella(c.dal, c.al)}{c.n_promemoria ? <em> · {c.n_promemoria} promemoria</em> : c.n_da_fare ? <em> · {c.n_da_fare} da fare</em> : null}</span>
            </button>
          ))}
        </div>
      ) : (
        <Gruppo>
          {visibili.map((c) => (
            <button key={c.ente} className="pp-riga" onClick={() => apriCartella(c)}>
              <span className="pp-ente-iniziale" style={{ '--c': colore(c.fascicolo) }}>{c.ente.slice(0, 1).toUpperCase()}</span>
              <span className="pp-riga-testo">
                <span className="pp-riga-titolo">{c.ente}</span>
                <span className="pp-riga-meta">{[nomeFasc(c), periodoCartella(c.dal, c.al), ...(c.etichette || [])].filter(Boolean).join(' · ')}</span>
              </span>
              {c.n_promemoria > 0 && <span className="pp-pallino pp-media" aria-label="Promemoria aperti" />}
              <span className="pp-conteggio">{c.n}</span>
              <IconaFreccia size={16} />
            </button>
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
