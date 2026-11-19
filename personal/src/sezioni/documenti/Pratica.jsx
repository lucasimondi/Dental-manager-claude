// Documenti — una pratica «Pratica <nome>»: schede Riepilogo, Documenti, Scadenze, Passi (proposta B),
// Consulenti ed Email (PRATICHE-CONSULENTI, 2026-11-19).
import { useCallback, useEffect, useRef, useState } from 'react';
import { archivioDb } from '../../lib/supabasePersonal.js';
import { documentiDellaPratica, cambiaStatoPratica, praticaCompleta } from '../../lib/archivio.js';
import { collegaLegal, scadenzaLegal, passiPratica, schedaPratica } from '../../lib/legal.js';
import { caricaConsulenti, emailPratica } from '../../lib/consulenti.js';
import { ConsulentiPratica, EmailPratica } from './PraticaContatti.jsx';
import { cercaArchivio, segnaScadenza, scadenzeDeiDocumenti } from '../../lib/archivio.js';
import { euro } from '../../lib/coreArchivio.js';
import { colore, dataBreve, titoloDoc, Vuoto, Sezione, Gruppo, RigaPagamento } from '../../ui.jsx';
import { SchedaPratica } from '../legal/index.jsx';
import { ElencoSelezionabile } from './Selezione.jsx';
import { nomePratica } from '../../lib/praticheCartelle.js';

const STATI_PRATICA = { aperta: 'Aperta', in_corso: 'In corso', risolta: 'Risolta', archiviata: 'Archiviata' };

export function PaginaPratica({ p: base, ctx }) {
  const { esegui, apri, aggiorna, pagato, mostra, fascicoli } = ctx;
  const [p, setP] = useState(base);
  const [documenti, setDocumenti] = useState(null);
  const [candidati, setCandidati] = useState(null), [busy, setBusy] = useState(false);
  const [termine, setTermine] = useState({ data: '', descrizione: '' });
  const [vista, setVista] = useState('documenti'), [passi, setPassi] = useState([]);
  // PRATICHE-CONSULENTI: chi segue la pratica (con i contatti) e le email della pratica.
  const [consulenti, setConsulenti] = useState(null), [email, setEmail] = useState(null), [parti, setParti] = useState([]);
  const aggiornaPassi = useCallback((d) => setPassi(d.passi), []);
  const legal = p.fascicolo === 'legale';
  const lock = useRef(false);
  const operazione = (fn) => { if (lock.current) return; lock.current = true; setBusy(true); return esegui(fn).finally(() => { lock.current = false; setBusy(false); }); };
  const carica = useCallback(() => esegui(async () => {
    const [completa, docs, ps] = await Promise.all([praticaCompleta(archivioDb, base.id), documentiDellaPratica(archivioDb, base.id), passiPratica(archivioDb, base.id).catch(() => [])]);
    if (completa.fascicolo === 'legale' && docs.length) {
      const collegate = await scadenzeDeiDocumenti(archivioDb, docs.map((d) => d.id));
      completa.scadenze = [...new Map([...(completa.scadenze || []), ...collegate].map((s) => [s.id, s])).values()].sort((a, b) => String(a.data).localeCompare(String(b.data)));
    }
    setP((x) => ({ ...x, ...completa })); setDocumenti(docs); setPassi(ps);
  }), [esegui, base.id]);
  const caricaContatti = useCallback(async () => {
    const [cs, em, sc] = await Promise.all([
      caricaConsulenti(archivioDb, base.id).catch(() => []),
      emailPratica(archivioDb, base.id).catch(() => []),
      schedaPratica(archivioDb, base.id).catch(() => null),
    ]);
    setConsulenti(cs); setEmail(em); setParti(sc?.parti || []);
  }, [base.id]);
  useEffect(() => { carica(); }, [carica]);
  useEffect(() => { caricaContatti(); }, [caricaContatti]);
  const cambiaStato = (stato) => esegui(async () => { await cambiaStatoPratica(archivioDb, p.id, stato); setP({ ...p, stato }); aggiorna(); mostra(`Pratica ${STATI_PRATICA[stato].toLowerCase()}`); });

  const scadenze = p.scadenze || [];
  const aperte = scadenze.filter((s) => !s.completata);
  const daPagare = aperte.reduce((t, s) => t + Number(s.importo || 0), 0);
  const totaleDoc = (documenti || []).reduce((t, d) => t + Number(d.importo || 0), 0);
  const c = colore(p.fascicolo);

  const passiAperti = passi.filter((x) => x.stato !== 'gestito').length;
  // PRATICHE-CARTELLE (proposta B): dentro la pratica quattro schede; si apre su «Documenti».
  const SCHEDE = [
    ['riepilogo', 'Riepilogo', null],
    ['documenti', 'Documenti', documenti ? documenti.length : '…'],
    ['scadenze', 'Scadenze', aperte.length],
    ['passi', 'Passi', passiAperti],
    ['consulenti', 'Consulenti', consulenti ? consulenti.length : '…'],
    ['email', 'Email', email ? email.length : '…'],
  ];

  return (
    <>
      <div className="pp-pratica-testa" style={{ '--c': c }}>
        <span className="pp-pratica-fascicolo">{fascicoli.find((f) => f.codice === p.fascicolo)?.nome || p.fascicolo || 'Pratica'}</span>
        <h2>{nomePratica(p)}</h2>
        <span className="pp-pratica-stati">
          <span className={`pp-stato pp-stato-${p.stato}`}>{STATI_PRATICA[p.stato] || p.stato}</span>
          {p.urgenza === 'alta' && <span className="pp-stato pp-stato-urgente">Urgente</span>}
          {p.prossima_scadenza && <span className="pp-stato">scade {dataBreve(p.prossima_scadenza)}</span>}
        </span>
      </div>
      <div className="pp-schede-pratica" role="tablist" aria-label="Contenuto della pratica">
        {SCHEDE.map(([id, nome, n]) => (
          <button key={id} type="button" role="tab" aria-selected={vista === id} onClick={() => setVista(id)}>{nome}{n != null && <span>{n}</span>}</button>
        ))}
      </div>

      {vista === 'riepilogo' && <>
        <div className="pp-numeri">
          <div><strong>{documenti ? documenti.length : '…'}</strong><span>documenti</span></div>
          <div><strong>{legal ? aperte.length : aperte.length ? euro(daPagare) : '—'}</strong><span>{legal ? 'termini da verificare' : 'da pagare'}</span></div>
          <div><strong>{passiAperti}</strong><span>passi da fare</span></div>
        </div>
        <div className="pp-azioni">
          <button className="pp-bottone pp-bottone-chiaro" onClick={() => apri({ tipo: 'legal-modifica', p })}>Modifica / aggiorna a mano</button>
          {['aperta', 'in_corso'].includes(p.stato)
            ? <button className="pp-bottone pp-bottone-verde" onClick={() => cambiaStato('risolta')}>Segna risolta</button>
            : <button className="pp-bottone pp-bottone-chiaro" onClick={() => cambiaStato('aperta')}>Riapri</button>}
          {p.stato === 'aperta' && <button className="pp-bottone pp-bottone-chiaro" onClick={() => cambiaStato('in_corso')}>In corso</button>}
        </div>
        {p.note && <details className="pp-pannello"><summary>Note della pratica</summary><p className="pp-pratica-note" style={{ whiteSpace: 'pre-wrap' }}>{p.note}</p></details>}
        {/* LEGAL-SCHEDE: in sintesi, parti, filo temporale, punti salienti, da attenzionare, documenti mancanti. */}
        <SchedaPratica p={p} ctx={ctx} parte="scheda" />
      </>}

      {vista === 'documenti' && <>
        {/* DOCUMENTI-AZIONI: «•••» su ogni documento (apri, scarica, invia, sposta) e la selezione di uno, più o
            tutti, da scaricare o inviare insieme (file o ZIP). */}
        <Sezione titolo="Documenti" azione={!legal && totaleDoc > 0 ? <span className="pp-riga-meta">{euro(totaleDoc)} in totale</span> : null}>
          {!documenti ? <Vuoto>Carico…</Vuoto> : !documenti.length ? <Vuoto>Nessun documento.</Vuoto> : (
            <ElencoSelezionabile elenco={documenti} ctx={ctx} onCambiato={carica} titoloInvio={nomePratica(p)}
              intestazione={`${documenti.length} ${documenti.length === 1 ? 'documento' : 'documenti'}, dal più recente`} />
          )}
        </Sezione>
        <button className="pp-bottone pp-bottone-chiaro" disabled={busy} onClick={() => operazione(async () => setCandidati((await cercaArchivio(archivioDb, { fascicolo: p.fascicolo || 'legale', limite: 300 })).filter((d) => !d.pratica_id)))}>Collega un documento dell'archivio</button>
        {candidati && <Sezione titolo="Scegli il documento da collegare (ultimi 300)">
          {!candidati.length && <Vuoto>Nessun documento senza pratica.</Vuoto>}
          {candidati.map((d) => <button className="pp-riga" disabled={busy} key={d.id} onClick={() => operazione(async () => { await collegaLegal(archivioDb, d.id, p.id); setCandidati((xs) => xs.filter((x) => x.id !== d.id)); await carica(); aggiorna(); mostra('Documento collegato'); })}>{titoloDoc(d)}</button>)}
        </Sezione>}
      </>}

      {vista === 'scadenze' && <>
        {!scadenze.length && <Sezione titolo="Scadenze"><Vuoto>Nessuna scadenza registrata.</Vuoto></Sezione>}
        {legal && scadenze.length > 0 && <Sezione titolo="Termini e scadenze"><Gruppo>{scadenze.map((s) => <div className="pp-riga" key={s.id}>
          <span className="pp-riga-testo"><strong>{s.descrizione}</strong><span className="pp-riga-meta">{dataBreve(s.data)} · {s.completata ? 'Completata' : s.storica ? 'Storica, da verificare' : 'Da gestire'}</span></span>
          {!s.completata && !s.storica && <button className="pp-chip-azione" disabled={busy} onClick={() => operazione(async () => { await segnaScadenza(archivioDb, s.id); await carica(); aggiorna(); })}>Fatta</button>}
        </div>)}</Gruppo></Sezione>}
        {!legal && scadenze.length > 0 && (
          <Sezione titolo="Pagamenti e scadenze">
            <Gruppo>{scadenze.map((s) => <RigaPagamento key={s.id} s={s} onApri={(x) => apri({ tipo: 'pagamento', s: x })} onPagato={async (x) => { await pagato(x); carica(); }} />)}</Gruppo>
          </Sezione>
        )}
        <Sezione titolo="Aggiungi una scadenza">
          <form onSubmit={(e) => { e.preventDefault(); operazione(async () => { await scadenzaLegal(archivioDb, p.id, termine.data, termine.descrizione); setTermine({ data: '', descrizione: '' }); await carica(); aggiorna(); mostra('Scadenza salvata'); }); }}>
            <label className="pp-campo"><span>Data</span><input required type="date" value={termine.data} onChange={(e) => setTermine({ ...termine, data: e.target.value })} /></label>
            <label className="pp-campo"><span>Cosa scade</span><input required value={termine.descrizione} onChange={(e) => setTermine({ ...termine, descrizione: e.target.value })} /></label>
            <button className="pp-bottone" disabled={busy}>Aggiungi scadenza</button>
          </form>
        </Sezione>
      </>}

      {/* Passi da fare: gli stessi di «Da fare», spuntati qui o là. */}
      {vista === 'passi' && <SchedaPratica p={p} ctx={ctx} parte="passi" onDati={aggiornaPassi} />}

      {vista === 'consulenti' && <ConsulentiPratica p={p} consulenti={consulenti} parti={parti} ctx={ctx} onCambiato={caricaContatti} />}
      {vista === 'email' && <EmailPratica email={email} consulenti={consulenti} ctx={ctx} />}
    </>
  );
}
