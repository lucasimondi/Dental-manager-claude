// POL-VITA-006 — Conti: incassi e spese registrati da Luca, pagamenti da fare dall'archivio e
// bilancino del mese o dell'anno. I pagamenti segnati "pagato" diventano spese da soli.
import { useEffect, useMemo, useState } from 'react';
import { archivioDb } from '../../lib/supabasePersonal.js';
import { pagamenti as caricaPagamenti, RICORRENZE } from '../../lib/archivio.js';
import { euro } from '../../lib/coreArchivio.js';
import {
  movimentiTra, salvaMovimento, eliminaMovimento, nuovaScadenza, bilancio, perMese, periodo, spostaPeriodo,
  CATEGORIE_SPESA, CATEGORIE_INCASSO, importoNumero, CATEGORIE_PAGAMENTO, totaliPerCategoria, categoriaDaFascicolo,
  CATEGORIE_STUDIO, tabellaStudio, METODI_STUDIO, rigaIncassoStudio, lavoroDelPeriodo, movimentiLavoro,
} from '../../lib/conti.js';
import { sessioneStudio, cercaPazienti, collaborazioniStudio, registraIncassoStudio, datiLavoro } from '../../lib/studio.js';
import { Vuoto, Sezione, Gruppo, Segmenti, Conferma, RigaPagamento, oggiIso, dataBreve } from '../../ui.jsx';
import { IconaIndietro, IconaFreccia, IconaCestino, IconaPiu, IconaFile, IconaFotocamera } from '../../Icone.jsx';

const meseCorrente = () => oggiIso().slice(0, 7);
const nomePeriodo = (tipo, rif) => {
  if (tipo === 'anno') return rif.slice(0, 4);
  const [a, m] = rif.split('-').map(Number);
  const t = new Date(a, m - 1, 1).toLocaleDateString('it-IT', { month: 'long', year: 'numeric' });
  return t.charAt(0).toUpperCase() + t.slice(1);
};
const segno = (m) => (m.tipo === 'entrata' ? '+' : '−');

export function RigaMovimento({ m, onApri }) {
  return (
    <button className={`pp-riga pp-movimento ${m.tipo}`} onClick={() => onApri(m)}>
      <span className="pp-movimento-icona" aria-hidden="true">{m.tipo === 'entrata' ? '↓' : '↑'}</span>
      <span className="pp-riga-testo">
        <span className="pp-riga-titolo">{m.descrizione}</span>
        <span className="pp-riga-meta">{[dataBreve(m.data), m.categoria, m.scadenza_id ? 'da un pagamento' : null].filter(Boolean).join(' · ')}</span>
      </span>
      <span className="pp-riga-importo pp-movimento-importo">{segno(m)}{euro(m.importo)}</span>
    </button>
  );
}

function Periodo({ tipo, rif, onTipo, onRif }) {
  return (
    <>
      <button className="pp-invito" onClick={() => apri({ tipo: 'revisione' })}><span><strong>Da valutare con Poliedron</strong><br />Pagamenti da verificare, inviti e documenti importanti</span></button>
      <Segmenti voci={[['mese', 'Mese'], ['anno', 'Anno']]} attiva={tipo} onScegli={onTipo} />
      <div className="pp-agenda-testa">
        <button className="pp-icona-bottone" aria-label="Periodo precedente" onClick={() => onRif(spostaPeriodo(tipo, rif, -1))}><IconaIndietro size={20} /></button>
        <span className="pp-agenda-titolo">{nomePeriodo(tipo, rif)}</span>
        <button className="pp-icona-bottone" aria-label="Periodo successivo" onClick={() => onRif(spostaPeriodo(tipo, rif, 1))}><IconaFreccia size={20} /></button>
      </div>
    </>
  );
}

// Riquadro del saldo: usato anche nella Home.
export function RiquadroSaldo({ b, titolo, onApri }) {
  const max = Math.max(b.entrate, b.uscite, 1);
  return (
    <button className="pp-saldo" onClick={onApri} disabled={!onApri}>
      <span className="pp-saldo-titolo">{titolo}</span>
      <span className={`pp-saldo-numero${b.saldo < 0 ? ' negativo' : ''}`}>{b.saldo < 0 ? '−' : ''}{euro(Math.abs(b.saldo))}</span>
      <span className="pp-saldo-righe">
        <span><i className="entrata" style={{ width: `${(b.entrate / max) * 100}%` }} /><b>Entrate</b><em>{euro(b.entrate)}</em></span>
        <span><i className="uscita" style={{ width: `${(b.uscite / max) * 100}%` }} /><b>Uscite</b><em>{euro(b.uscite)}</em></span>
      </span>
    </button>
  );
}

function Barre({ mesi }) {
  const max = Math.max(1, ...mesi.flatMap((m) => [m.entrate, m.uscite]));
  return (
    <div className="pp-barre" role="img" aria-label="Entrate e uscite per mese">
      {mesi.map((m) => (
        <div key={m.mese} className="pp-barre-mese" title={`${m.mese}: +${euro(m.entrate)} −${euro(m.uscite)}`}>
          <div className="pp-barre-coppia">
            <i className="entrata" style={{ height: `${(m.entrate / max) * 100}%` }} />
            <i className="uscita" style={{ height: `${(m.uscite / max) * 100}%` }} />
          </div>
          <span>{new Date(`${m.mese}-15`).toLocaleDateString('it-IT', { month: 'narrow' })}</span>
        </div>
      ))}
    </div>
  );
}

function Categorie({ voci, totale, tipo }) {
  if (!voci.length) return <Vuoto>Nessun movimento.</Vuoto>;
  return (
    <Gruppo>
      {voci.map((v) => (
        <div key={v.categoria} className="pp-categoria">
          <span className="pp-categoria-testa"><span>{v.categoria}</span><strong>{euro(v.totale)}</strong></span>
          <span className="pp-categoria-barra"><i className={tipo} style={{ width: `${totale ? (v.totale / totale) * 100 : 0}%` }} /></span>
        </div>
      ))}
    </Gruppo>
  );
}

export function VistaConti({ ctx }) {
  const { esegui, apri, pagato, versione, sotto } = ctx;
  const [scheda, setScheda] = useState(['dapagare', 'bilancio'].includes(sotto) ? sotto : 'movimenti');
  const [tipo, setTipo] = useState('mese');
  const [rif, setRif] = useState(meseCorrente);
  const [movimenti, setMovimenti] = useState(null);
  const [anno, setAnno] = useState(null);
  const [scadenze, setScadenze] = useState(null);
  const [filtro, setFiltro] = useState('aperti');
  const [lavoro, setLavoro] = useState(undefined); // dati dello studio; null = agenda non collegata

  useEffect(() => {
    // I promemoria delle cartelle senza importo non sono pagamenti (POL-VITA-016): restano in Agenda e Oggi.
    if (scheda === 'dapagare') { esegui(async () => setScadenze((await caricaPagamenti(archivioDb)).filter((s) => !(s.cartella && s.importo == null)))); return; }
    const { da, a } = periodo(tipo, rif);
    const y = periodo('anno', rif);
    esegui(async () => {
      setMovimenti(await movimentiTra(archivioDb, da, a));
      if (scheda === 'bilancio') setAnno(await movimentiTra(archivioDb, y.da, y.a));
    });
    // Lavoro dallo studio (POL-VITA-022): letto dallo studio, mai copiato. Senza agenda collegata non c'è.
    (async () => {
      if (!(await sessioneStudio().catch(() => null))) { setLavoro(null); return; }
      setLavoro(await datiLavoro(scheda === 'bilancio' ? y.da : da, scheda === 'bilancio' ? y.a : a));
    })().catch(() => setLavoro(null));
  }, [scheda, tipo, rif, esegui, versione]);

  const { da, a } = periodo(tipo, rif);
  const lav = useMemo(() => (lavoro ? lavoroDelPeriodo(lavoro, da, a) : null), [lavoro, da, a]);
  const b = useMemo(() => bilancio([...(movimenti || []), ...movimentiLavoro(lavoro, da, a)]), [movimenti, lavoro, da, a]);
  const annoConLavoro = useMemo(() => {
    if (!anno) return null;
    const y = periodo('anno', rif);
    return [...anno, ...movimentiLavoro(lavoro, y.da, y.a)];
  }, [anno, lavoro, rif]);
  const apriM = (m) => apri({ tipo: 'movimento', m });

  return (
    <>
      <Segmenti voci={[['movimenti', 'Movimenti'], ['dapagare', 'Da pagare'], ['bilancio', 'Bilancio']]} attiva={scheda} onScegli={setScheda} />
      {scheda !== 'dapagare' && <Periodo tipo={tipo} rif={rif} onTipo={setTipo} onRif={setRif} />}

      {scheda === 'movimenti' && movimenti && (
        <>
          <RiquadroSaldo b={b} titolo={`Saldo · ${nomePeriodo(tipo, rif)}`} onApri={() => setScheda('bilancio')} />
          <LavoroStudio l={lav} caricato={lavoro !== undefined} />
          <div className="pp-azioni pp-azioni-due">
            <button className="pp-bottone pp-bottone-verde" onClick={() => apri({ tipo: 'movimento', m: { tipo: 'entrata' } })}><IconaPiu size={18} /> Incasso</button>
            <button className="pp-bottone pp-bottone-rosso" onClick={() => apri({ tipo: 'movimento', m: { tipo: 'uscita' } })}><IconaPiu size={18} /> Spesa</button>
          </div>
          {movimenti.length
            ? Object.entries(movimenti.reduce((g, m) => { (g[m.data] ||= []).push(m); return g; }, {})).map(([giorno, xs]) => (
              <Sezione key={giorno} titolo={dataBreve(giorno)}>
                <Gruppo>{xs.map((m) => <RigaMovimento key={m.id} m={m} onApri={apriM} />)}</Gruppo>
              </Sezione>
            ))
            : <Vuoto>Nessun movimento in questo periodo. Registra un incasso o una spesa, oppure segna "Pagato" un pagamento: diventa una spesa da solo.</Vuoto>}
        </>
      )}

      {scheda === 'bilancio' && movimenti && (
        <>
          <RiquadroSaldo b={b} titolo={`Bilancio · ${nomePeriodo(tipo, rif)}`} />
          <LavoroStudio l={lav} caricato={lavoro !== undefined} />
          {anno && (
            <Sezione titolo={`Mese per mese · ${rif.slice(0, 4)}`}>
              <div className="pp-pannello"><Barre mesi={perMese(annoConLavoro || anno, rif.slice(0, 4))} />
                <p className="pp-legenda pp-riga-meta"><i className="entrata" /> Entrate <i className="uscita" /> Uscite</p></div>
            </Sezione>
          )}
          <Sezione titolo="Dove vanno i soldi"><Categorie voci={b.speseCategoria} totale={b.uscite} tipo="uscita" /></Sezione>
          <Sezione titolo="Da dove arrivano"><Categorie voci={b.incassiCategoria} totale={b.entrate} tipo="entrata" /></Sezione>
        </>
      )}

      {scheda === 'dapagare' && scadenze && <DaPagare tutti={scadenze} filtro={filtro} setFiltro={setFiltro} apri={apri} pagato={pagato} />}
    </>
  );
}

// Lavoro dallo studio: incassi dei pazienti + collaborazioni − spese dello studio = netto, che entra nel saldo.
function LavoroStudio({ l, caricato }) {
  if (!caricato) return null;
  if (!l) return <p className="pp-riga-meta pp-spiegazione">Collega l'agenda dello studio (scheda Agenda) per vedere qui il lavoro netto dello studio.</p>;
  return (
    <Sezione titolo="Lavoro dallo studio" azione={<span className="pp-riga-meta">si registra nello studio</span>}>
      <Gruppo>
        <div className="pp-voce"><span>Incassi dai pazienti</span><strong>{euro(l.pazienti)}</strong></div>
        {l.perCollaborazione.map((c) => <div key={c.nome} className="pp-voce"><span>{c.nome}</span><strong>{euro(c.totale)}</strong></div>)}
        <div className="pp-voce"><span>Spese dello studio</span><strong className="pp-rosso">−{euro(l.spese)}</strong></div>
        <div className="pp-voce"><span><strong>Netto</strong></span><strong className={l.netto >= 0 ? 'pp-verde' : 'pp-rosso'}>{euro(l.netto)}</strong></div>
      </Gruppo>
    </Sezione>
  );
}

function DaPagare({ tutti, filtro, setFiltro, apri, pagato }) {
  const [categoriaAperta, setCategoriaAperta] = useState(null);
  const aperti = tutti.filter((s) => !s.completata);
  const oggi = oggiIso();
  const tra30 = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
  const totale = aperti.reduce((t, s) => t + Number(s.importo || 0), 0);
  const scaduti = aperti.filter((s) => s.data < oggi);
  const fissi = aperti.filter((s) => s.ricorrenza);
  const perCategoria = totaliPerCategoria(aperti).filter((c) => c.totale > 0);
  const apriP = (s) => apri({ tipo: 'pagamento', s });
  const gruppo = (titolo, elenco) => {
    if (!elenco.length) return null;
    const somma = elenco.reduce((t, s) => t + Number(s.importo || 0), 0);
    return (
      <Sezione key={titolo} titolo={titolo} azione={somma > 0 ? <span className="pp-riga-meta">{euro(somma)}</span> : null}>
        <Gruppo>{elenco.map((s) => <RigaPagamento key={s.id} s={s} onApri={apriP} onPagato={pagato} />)}</Gruppo>
      </Sezione>
    );
  };
  return (
    <>
      <div className="pp-riassunto">
        <div className="pp-tessera pp-tessera-forte"><span className="pp-tessera-numero">{euro(totale)}</span><span>da pagare</span></div>
        <div className="pp-tessera"><span className="pp-tessera-numero">{scaduti.length}</span><span>{scaduti.length === 1 ? 'pagamento scaduto' : 'pagamenti scaduti'}</span></div>
      </div>
      <div className="pp-azioni pp-azioni-due">
        <button className="pp-bottone" onClick={() => apri({ tipo: 'carica', opzioni: { pagamento: true, descrizione: 'Bolletta / pagamento da fare' } })}><IconaFotocamera size={18} /> Carica bolletta</button>
        <button className="pp-bottone pp-bottone-chiaro" onClick={() => apri({ tipo: 'scadenza' })}><IconaPiu size={18} /> Inserisci a mano</button>
      </div>
      <p className="pp-riga-meta pp-spiegazione">Fotografa o scegli il PDF di una bolletta, polizza o avviso: leggo importo e scadenza e lo metto qui. Per i pagamenti fissi (bollo, assicurazione, pulizie…) imposta "Si ripete": dopo ogni pagamento si ripropone da solo.</p>
      {perCategoria.length > 0 && (
        <Sezione titolo="Per tipo">
          <p className="pp-riga-meta">Totali per categoria: tocca per vedere i singoli pagamenti e la loro origine.</p>
          <Gruppo>{perCategoria.map((c) => <div key={c.categoria}>
            <button className="pp-riga" aria-expanded={categoriaAperta === c.categoria} onClick={() => setCategoriaAperta(categoriaAperta === c.categoria ? null : c.categoria)}>
              <span className="pp-riga-testo"><strong>{c.categoria}</strong><span className="pp-riga-meta">{aperti.filter((s) => (s.categoria || categoriaDaFascicolo(s.documento?.fascicolo)) === c.categoria).length} pagamenti · Vedi dettaglio</span></span>
              <strong>{euro(c.totale)}</strong><IconaFreccia size={16} />
            </button>
            {categoriaAperta === c.categoria && aperti.filter((s) => (s.categoria || categoriaDaFascicolo(s.documento?.fascicolo)) === c.categoria).map((s) => <RigaPagamento key={s.id} s={s} onApri={apriP} />)}
          </div>)}</Gruppo>
        </Sezione>
      )}
      <Segmenti voci={[['aperti', 'Da pagare'], ['pagati', 'Pagati'], ['tutti', 'Tutti']]} attiva={filtro} onScegli={setFiltro} />
      {filtro === 'aperti' && (aperti.length ? [
        gruppo('Scaduti', scaduti),
        gruppo('Prossimi 30 giorni', aperti.filter((s) => s.data >= oggi && s.data <= tra30)),
        gruppo('Più avanti', aperti.filter((s) => s.data > tra30)),
        fissi.length ? <p key="fissi" className="pp-riga-meta pp-nota-fondo">{fissi.length} {fissi.length === 1 ? 'pagamento fisso impostato' : 'pagamenti fissi impostati'}.</p> : null,
      ] : <Vuoto>Nessun pagamento da fare. Carica una bolletta o inserisci un pagamento: le vecchie scadenze dei documenti degli anni passati restano nei loro documenti.</Vuoto>)}
      {filtro === 'pagati' && (tutti.some((s) => s.completata)
        ? <Gruppo>{[...tutti].filter((s) => s.completata).reverse().map((s) => <RigaPagamento key={s.id} s={s} onApri={apriP} />)}</Gruppo>
        : <Vuoto>Nessun pagamento segnato come pagato.</Vuoto>)}
      {filtro === 'tutti' && (tutti.length
        ? <Gruppo>{[...tutti].reverse().map((s) => <RigaPagamento key={s.id} s={s} onApri={apriP} onPagato={pagato} />)}</Gruppo>
        : <Vuoto>Nessun pagamento.</Vuoto>)}
    </>
  );
}

/* ---------- incasso o spesa: nuovo o modifica ---------- */
// POL-VITA-022: un incasso "Studio" (paziente) o "Collaborazione" si registra SOLO nello studio, come
// nel gestionale; Personal lo rilegge da lì nel lavoro netto (una sola fonte, niente doppioni).
export function PaginaMovimento({ m: iniziale, ctx, chiudi }) {
  const { esegui, aggiorna, mostra, apri, impostazioni } = ctx;
  const [m, setM] = useState(() => ({ data: oggiIso(), importo: '', descrizione: '', categoria: '', note: '', ...iniziale, importo: iniziale.importo ?? '' }));
  const [conferma, setConferma] = useState(false);
  const entrata = m.tipo === 'entrata';
  const tabella = entrata && !m.id ? tabellaStudio(m.categoria) : null;
  const categorie = entrata ? [...new Set([...(m.id ? [] : Object.keys(CATEGORIE_STUDIO)), ...(impostazioni.categorieIncasso || CATEGORIE_INCASSO)])] : (impostazioni.categorieSpesa || CATEGORIE_SPESA);
  const valido = importoNumero(m.importo) > 0 && /^\d{4}-\d{2}-\d{2}$/.test(m.data)
    && (tabella !== 'payments' || m.paziente_id) && (tabella !== 'pagamenti_esterni' || m.collaborazione_id);
  const salva = () => esegui(async () => {
    if (tabella) {
      await registraIncassoStudio(rigaIncassoStudio(m));
      aggiorna(); mostra('Registrato nello studio: lo trovi in "Lavoro dallo studio"'); chiudi();
      return;
    }
    await salvaMovimento(archivioDb, m);
    aggiorna(); mostra(m.id ? 'Movimento aggiornato' : entrata ? 'Incasso registrato' : 'Spesa registrata'); chiudi();
  });
  return (
    <>
      <Segmenti voci={[['uscita', 'Spesa'], ['entrata', 'Incasso']]} attiva={m.tipo || 'uscita'} onScegli={(t) => setM({ ...m, tipo: t, categoria: '' })} />
      <label className="pp-campo pp-campo-importo"><span>Importo (€)</span>
        <input inputMode="decimal" autoFocus={!m.id} value={m.importo} onChange={(e) => setM({ ...m, importo: e.target.value })} placeholder="0,00" />
      </label>
      <div className="pp-due">
        <label className="pp-campo"><span>Data</span><input type="date" value={m.data} onChange={(e) => setM({ ...m, data: e.target.value })} /></label>
        <label className="pp-campo"><span>Categoria</span>
          <select className="pp-select" value={m.categoria || ''} onChange={(e) => setM({ ...m, categoria: e.target.value })}>
            <option value="">—</option>
            {[...new Set([...categorie, ...(m.categoria ? [m.categoria] : [])])].map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </label>
      </div>
      {tabella && <IncassoStudio m={m} setM={setM} tabella={tabella} />}
      {tabella && <p className="pp-riga-meta">Si registra nello studio (come dal gestionale): lì si modifica o si elimina, e qui lo vedi nel lavoro netto.</p>}
      {!tabella && (
        <label className="pp-campo"><span>Descrizione</span>
          <input value={m.descrizione} onChange={(e) => setM({ ...m, descrizione: e.target.value })} placeholder={entrata ? 'Es. Direzione sanitaria, rimborso' : 'Es. Spesa al supermercato'} />
        </label>
      )}
      <label className="pp-campo"><span>Note</span><input value={m.note || ''} onChange={(e) => setM({ ...m, note: e.target.value })} placeholder="facoltative" /></label>
      {m.documento?.id && (
        <Sezione titolo="Documento collegato">
          <Gruppo>
            <button className="pp-riga" onClick={() => apri({ tipo: 'documento', id: m.documento.id })}>
              <span className="pp-riga-icona" style={{ '--c': '#0c447c' }}><IconaFile size={18} /></span>
              <span className="pp-riga-testo"><span className="pp-riga-titolo">{m.documento.titolo}</span><span className="pp-riga-meta">Apri il documento</span></span>
              <IconaFreccia size={16} />
            </button>
          </Gruppo>
        </Sezione>
      )}
      <button className={`pp-bottone pp-bottone-largo ${entrata ? 'pp-bottone-verde' : ''}`} disabled={!valido} onClick={salva}>{m.id ? 'Salva' : tabella ? 'Registra nello studio' : entrata ? 'Registra incasso' : 'Registra spesa'}</button>
      {m.id && (
        <div className="pp-elimina">
          {!conferma
            ? <button className="pp-testo-link pp-rosso" onClick={() => setConferma(true)}><IconaCestino size={16} /> Elimina il movimento</button>
            : <Conferma testo="Eliminare questo movimento?" onNo={() => setConferma(false)}
              onSi={() => esegui(async () => { await eliminaMovimento(archivioDb, m.id); aggiorna(); mostra('Movimento eliminato'); chiudi(); })} />}
        </div>
      )}
    </>
  );
}

// Paziente (Studio) o collaborazione (Collaborazione) e metodo, come nel gestionale dello studio.
function IncassoStudio({ m, setM, tabella }) {
  const [collegata, setCollegata] = useState(null);
  const [cerca, setCerca] = useState('');
  const [trovati, setTrovati] = useState([]);
  const [collab, setCollab] = useState(null);
  useEffect(() => { sessioneStudio().then((x) => setCollegata(!!x)).catch(() => setCollegata(false)); }, []);
  useEffect(() => {
    if (collegata && tabella === 'pagamenti_esterni' && !collab) collaborazioniStudio().then(setCollab).catch(() => setCollab([]));
  }, [collegata, tabella, collab]);
  useEffect(() => {
    if (tabella !== 'payments' || m.paziente_id || cerca.trim().length < 2) { setTrovati([]); return undefined; }
    const t = setTimeout(() => cercaPazienti(cerca).then(setTrovati).catch(() => setTrovati([])), 250);
    return () => clearTimeout(t);
  }, [cerca, m.paziente_id, tabella]);
  if (collegata === null) return null;
  if (!collegata) return <p className="pp-riga-meta pp-rosso">Per registrarlo anche nello studio collega prima l'agenda (scheda Agenda).</p>;
  const metodo = m.metodo || (tabella === 'payments' ? 'Contanti' : 'Bonifico');
  return (
    <>
      {tabella === 'payments' && (m.paziente_id ? (
        <div className="pp-campo"><span>Paziente dello studio</span>
          <div className="pp-voce pp-paziente-scelto"><strong>{m.paziente}</strong>
            <button type="button" className="pp-testo-link" onClick={() => { setM((x) => ({ ...x, paziente_id: null, paziente: '' })); setCerca(''); }}>Cambia</button>
          </div>
        </div>
      ) : (
        <>
          <label className="pp-campo"><span>Paziente dello studio</span>
            <input value={cerca} onChange={(e) => setCerca(e.target.value)} placeholder="Cerca per nome o cognome" />
          </label>
          {trovati.length > 0 && (
            <div className="pp-gruppo pp-trovati">
              {trovati.map((p) => {
                const nome = [p.nome, p.cognome].filter(Boolean).join(' ');
                return <button key={p.id} type="button" className="pp-riga" onClick={() => setM((x) => ({ ...x, paziente_id: p.id, paziente: nome }))}><span className="pp-riga-testo"><span className="pp-riga-titolo">{nome}</span></span></button>;
              })}
            </div>
          )}
          {cerca.trim().length >= 2 && !trovati.length && <p className="pp-riga-meta">Nessun paziente trovato. I nuovi pazienti si creano nello studio.</p>}
        </>
      ))}
      {tabella === 'pagamenti_esterni' && (
        <label className="pp-campo"><span>Collaborazione</span>
          <select className="pp-select" value={m.collaborazione_id || ''} onChange={(e) => {
            const c = (collab || []).find((x) => String(x.id) === e.target.value);
            setM((x) => ({ ...x, collaborazione_id: c?.id || null, collaborazione_nome: c?.nome || '' }));
          }}>
            <option value="">Scegli…</option>
            {(collab || []).map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
          </select>
        </label>
      )}
      {tabella === 'pagamenti_esterni' && collab && !collab.length && <p className="pp-riga-meta">Nessuna collaborazione: aggiungila nello studio (Pagamenti › Collaborazioni esterne).</p>}
      <label className="pp-campo"><span>Metodo</span>
        <select className="pp-select" value={metodo} onChange={(e) => setM((x) => ({ ...x, metodo: e.target.value }))}>
          {METODI_STUDIO.map((x) => <option key={x}>{x}</option>)}
        </select>
      </label>
    </>
  );
}

/* ---------- pagamento da fare inserito a mano ---------- */
export function PaginaNuovaScadenza({ ctx, chiudi }) {
  const { esegui, aggiorna, mostra, apri } = ctx;
  const [s, setS] = useState({ data: oggiIso(), descrizione: '', importo: '', categoria: '', ricorrenza: '' });
  const salva = (allega) => esegui(async () => {
    const r = await nuovaScadenza(archivioDb, s);
    aggiorna(); mostra('Pagamento aggiunto'); chiudi();
    if (allega) apri({ tipo: 'carica', opzioni: { pagamentoId: r.id, descrizione: s.descrizione } });
  });
  const valido = s.descrizione.trim() && s.data;
  return (
    <>
      <label className="pp-campo"><span>Cosa devi pagare</span><input autoFocus value={s.descrizione} onChange={(e) => setS({ ...s, descrizione: e.target.value })} placeholder="Es. Bolletta luce, rata assicurazione auto" /></label>
      <div className="pp-due">
        <label className="pp-campo"><span>Entro il</span><input type="date" value={s.data} onChange={(e) => setS({ ...s, data: e.target.value })} /></label>
        <label className="pp-campo"><span>Importo (€)</span><input inputMode="decimal" value={s.importo} onChange={(e) => setS({ ...s, importo: e.target.value })} placeholder="facoltativo" /></label>
      </div>
      <div className="pp-due">
        <label className="pp-campo"><span>Tipo</span>
          <select className="pp-select" value={s.categoria} onChange={(e) => setS({ ...s, categoria: e.target.value })}>
            <option value="">—</option>
            {CATEGORIE_PAGAMENTO.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </label>
        <label className="pp-campo"><span>Si ripete</span>
          <select className="pp-select" value={s.ricorrenza} onChange={(e) => setS({ ...s, ricorrenza: e.target.value })}>
            {RICORRENZE.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </select>
        </label>
      </div>
      <p className="pp-riga-meta">Compare in Da pagare, in Agenda e nella Home. Quando lo segni pagato diventa una spesa{s.ricorrenza ? ' e si ripropone alla scadenza successiva' : ''}.</p>
      <button className="pp-bottone pp-bottone-largo" disabled={!valido} onClick={() => salva(false)}>Aggiungi</button>
      <button className="pp-bottone pp-bottone-chiaro pp-bottone-largo" disabled={!valido} onClick={() => salva(true)}><IconaFotocamera size={18} /> Aggiungi e allega foto o PDF</button>
    </>
  );
}
