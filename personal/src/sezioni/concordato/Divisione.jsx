// CONCORDATO › Divisione con Anna (PO 2026-11-20: "inserire i valori di perizia […] cose a me cose ad Anna,
// conguagli […] come fosse un excel ma su app e facile, fammi delle proposte"). Proposte pronte (A equa,
// B più soldi per il concordato, C conguaglio leggero, libera), poi bene per bene: valore e a chi va.
// I conti (lotti, conguaglio, soldi per il concordato) si rifanno a ogni modifica e si salvano da soli.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { archivioDb } from '../../lib/supabasePersonal.js';
import {
  assegnazioniProposta, beniDivisibili, calcolaDivisione, caricaBeni, caricaScenari, datiCatastali, DESTINI, eAbitazione,
  eliminaScenario, euroIntero, fraseConguaglio, leggiEuro, PROPOSTE, salvaBene, salvaScenario, tipoBene,
} from '../../lib/concordato.js';
import { creaPdfDivisione } from '../../lib/concordatoPdf.js';
import { Conferma, Vuoto } from '../../ui.jsx';
import { apriPdf, condividiPdf, nomeFile } from './condividi.js';

export function ElencoProposte({ ctx }) {
  const [beni, setBeni] = useState(null), [scenari, setScenari] = useState(null), [nuova, setNuova] = useState(false);
  useEffect(() => { let vivo = true; ctx.esegui(async () => {
    const [b, s] = await Promise.all([caricaBeni(archivioDb), caricaScenari(archivioDb)]);
    if (vivo) { setBeni(b); setScenari(s); setNuova(!s.length); }
  }); return () => { vivo = false; }; }, [ctx.esegui, ctx.versione]);
  if (!beni || !scenari) return <Vuoto>Carico…</Vuoto>;
  const div = beniDivisibili(beni);
  return <>
    <p className="pp-cc-spiega">Ognuno deve ricevere il valore della sua metà. Chi prende di più paga la differenza all'altro: è il <strong>conguaglio</strong>. Se Anna prende più beni, i soldi che ti dà vanno ai creditori del concordato e ti aiutano a tenere la casa.</p>
    {scenari.map((s) => { const c = calcolaDivisione(beni, s); return (
      <button key={s.id} type="button" className="pp-cc-proposta" onClick={() => ctx.apri({ tipo: 'divisione-proposta', id: s.id })}>
        <strong>{s.nome}</strong>
        <span className={c.conguaglio < 0 ? 'pp-rosso' : ''}>{c.completo ? fraseConguaglio(c.conguaglio) : `${fraseConguaglio(c.conguaglio)} (parziale)`}</span>
        <small>A te {euroIntero(c.lottoLuca)} · ad Anna {euroIntero(c.lottoAnna)}{c.vendita ? ` · si vende ${euroIntero(c.vendita)}` : ''}
          {!c.completo && ` · ${[c.mancanti.length && `${c.mancanti.length} senza valore`, c.daDecidere.length && `${c.daDecidere.length} da assegnare`].filter(Boolean).join(', ')}`}</small>
      </button>); })}
    {nuova ? <NuovaProposta beni={beni} ctx={ctx} onAnnulla={scenari.length ? () => setNuova(false) : null} />
      : <button type="button" className="pp-bottone pp-bottone-largo" onClick={() => setNuova(true)}>Nuova proposta</button>}
    <p className="pp-riga-meta">Nella divisione ci sono {div.length} beni in comune con Anna (1/2 ciascuno). Per aggiungerne o toglierne uno: Beni › tocca il bene › «In divisione con Anna».</p>
  </>;
}

function NuovaProposta({ beni, ctx, onAnnulla }) {
  const case_ = beniDivisibili(beni).filter(eAbitazione);
  const [casaLuca, setCasaLuca] = useState(''), [casaAnna, setCasaAnna] = useState(''), [busy, setBusy] = useState(false);
  const crea = (p) => { if (busy) return; setBusy(true); ctx.esegui(async () => {
    const assegnazioni = assegnazioniProposta(p.id, beni, { casaLuca, casaAnna });
    const s = await salvaScenario(archivioDb, { nome: p.nome, descrizione: p.descrizione, assegnazioni, voci: [] });
    ctx.aggiorna(); ctx.apri({ tipo: 'divisione-proposta', id: s.id });
  }).finally(() => setBusy(false)); };
  const pronte = casaLuca && casaAnna && casaLuca !== casaAnna;
  const nome = (b) => `${b.nome || tipoBene(b)} (${b.consistenza || b.categoria})`;
  return <section className="pp-cc-nuova" aria-label="Nuova proposta">
    <h3>Nuova proposta</h3>
    <p>Prima dimmi quale casa è la tua e quale quella di Anna: le proposte pronte partono da qui.</p>
    <label className="pp-campo"><span>La tua casa (dove vivi)</span>
      <select className="pp-select" value={casaLuca} onChange={(e) => setCasaLuca(e.target.value)}><option value="">Scegli…</option>{case_.map((b) => <option key={b.id} value={b.id} disabled={b.id === casaAnna}>{nome(b)}</option>)}</select>
    </label>
    <label className="pp-campo"><span>La casa di Anna</span>
      <select className="pp-select" value={casaAnna} onChange={(e) => setCasaAnna(e.target.value)}><option value="">Scegli…</option>{case_.map((b) => <option key={b.id} value={b.id} disabled={b.id === casaLuca}>{nome(b)}</option>)}</select>
    </label>
    <div className="pp-cc-modelli">
      {PROPOSTE.map((p) => <button key={p.id} type="button" className="pp-cc-modello" disabled={busy || (p.id !== 'vuota' && !pronte)} onClick={() => crea(p)}>
        <strong>{p.nome}</strong><span>{p.descrizione}</span>
      </button>)}
    </div>
    {!pronte && <p className="pp-riga-meta">Le proposte A, B e C si attivano quando hai scelto le due case.</p>}
    {onAnnulla && <button type="button" className="pp-testo-link" onClick={onAnnulla}>Annulla</button>}
  </section>;
}

const testoEuro = (n) => (n == null ? '' : Number(n).toLocaleString('it-IT', { maximumFractionDigits: 2 }));

export function PropostaDivisione({ id, ctx, chiudi }) {
  const [beni, setBeni] = useState(null), [s, setS] = useState(null), [elimina, setElimina] = useState(false), [pdf, setPdf] = useState(false);
  const timer = useRef(null), ultimo = useRef(null), ctxRef = useRef(ctx);
  ctxRef.current = ctx;
  useEffect(() => { let vivo = true; ctx.esegui(async () => {
    const [b, sc] = await Promise.all([caricaBeni(archivioDb), caricaScenari(archivioDb)]);
    if (vivo) { setBeni(b); setS(sc.find((x) => x.id === id) || null); }
  }); return () => { vivo = false; }; }, [ctx.esegui, id]);
  // Salvataggio automatico: mezzo secondo dopo l'ultima modifica (e subito quando si esce).
  const salvaOra = useCallback(() => { clearTimeout(timer.current); const da = ultimo.current; if (!da) return; ultimo.current = null;
    ctxRef.current.esegui(async () => { await salvaScenario(archivioDb, da); ctxRef.current.aggiorna(); }); }, []);
  useEffect(() => () => { if (ultimo.current) salvaOra(); }, [salvaOra]);
  const cambia = (nuovo) => { setS(nuovo); ultimo.current = nuovo; clearTimeout(timer.current); timer.current = setTimeout(salvaOra, 600); };
  const c = useMemo(() => (beni && s ? calcolaDivisione(beni, s) : null), [beni, s]);
  if (!beni || s === null) return beni ? <Vuoto>Proposta non trovata.</Vuoto> : <Vuoto>Carico…</Vuoto>;

  const assegna = (beneId, dove) => cambia({ ...s, assegnazioni: { ...s.assegnazioni, [beneId]: dove } });
  const salvaValore = (b, testo) => {
    const v = leggiEuro(testo);
    if (Number.isNaN(v)) { ctx.mostra?.('Valore non valido: scrivi per esempio 250.000'); return; }
    if ((v ?? null) === (b.valore == null ? null : Number(b.valore))) return;
    setBeni((lista) => lista.map((x) => (x.id === b.id ? { ...x, valore: v } : x)));
    ctx.esegui(async () => { await salvaBene(archivioDb, b.id, { valore: v }); ctx.aggiorna(); });
  };
  const voci = s.voci || [];
  const cambiaVoce = (i, campo, valore) => cambia({ ...s, voci: voci.map((v, j) => (j === i ? { ...v, [campo]: valore } : v)) });
  const documento = (azione) => { setPdf(true); ctx.esegui(async () => {
    const blob = await creaPdfDivisione(beni, s);
    if (azione === 'apri') apriPdf(blob); else if ((await condividiPdf(blob, nomeFile('divisione'))) === 'scaricato') ctx.mostra?.('PDF scaricato');
  }).finally(() => setPdf(false)); };
  const duplica = () => ctx.esegui(async () => { salvaOra(); const n = await salvaScenario(archivioDb, { ...s, id: undefined, nome: `${s.nome} (copia)`.slice(0, 120) }); ctx.aggiorna(); chiudi(); ctx.apri({ tipo: 'divisione-proposta', id: n.id }); });
  const cancella = () => ctx.esegui(async () => { ultimo.current = null; clearTimeout(timer.current); await eliminaScenario(archivioDb, s.id); ctx.aggiorna(); chiudi(); ctx.mostra?.('Proposta eliminata'); });

  return <div className="pp-cc-div">
    <label className="pp-campo"><span>Nome della proposta</span><input maxLength={120} value={s.nome} onChange={(e) => cambia({ ...s, nome: e.target.value })} /></label>
    {s.descrizione && <p className="pp-riga-meta">{s.descrizione}</p>}

    <section className="pp-cc-conti" aria-live="polite" aria-label="Risultato">
      <div className="pp-cc-lotti">
        <div><span>A te</span><strong>{euroIntero(c.lottoLuca)}</strong></div>
        <div><span>Ad Anna</span><strong>{euroIntero(c.lottoAnna)}</strong></div>
        <div><span>Si vende</span><strong>{euroIntero(c.vendita)}</strong></div>
      </div>
      <p className={`pp-cc-conguaglio${c.conguaglio < 0 ? ' pp-cc-negativo' : ''}`}>{fraseConguaglio(c.conguaglio)}</p>
      <p className="pp-cc-per-concordato">Per il concordato entrano <strong>{euroIntero(c.entrateLuca)}</strong>{c.venditaLuca ? ` (conguaglio + tua metà delle vendite ${euroIntero(c.venditaLuca)})` : ''}.</p>
      {!c.completo && <p className="pp-cc-mancano">{[c.daDecidere.length && `${c.daDecidere.length} beni da assegnare`, c.mancanti.length && `${c.mancanti.length} beni senza valore: non entrano nel conto`].filter(Boolean).join(' · ')}</p>}
    </section>

    <h3 className="pp-cc-titoletto">Bene per bene</h3>
    <ul className="pp-cc-righe">
      {c.righe.map((r) => <RigaDivisione key={r.bene.id} r={r} onAssegna={(d) => assegna(r.bene.id, d)} onValore={(t) => salvaValore(r.bene, t)} />)}
    </ul>

    <h3 className="pp-cc-titoletto">Altre voci del conguaglio</h3>
    <p className="pp-riga-meta">Mutuo che una dei due si accolla, spese tecniche, acconti già versati… Ogni voce sposta il conguaglio a favore di chi scegli.</p>
    {voci.map((v, i) => <div key={v.id || i} className="pp-cc-voce">
      <input aria-label="Descrizione" placeholder="es. Mutuo Azzoaglio accollato da Anna" value={v.descrizione} onChange={(e) => cambiaVoce(i, 'descrizione', e.target.value)} />
      <input aria-label="Importo" inputMode="decimal" placeholder="€" defaultValue={testoEuro(v.importo)} onBlur={(e) => { const n = leggiEuro(e.target.value); if (Number.isNaN(n)) { ctx.mostra?.('Importo non valido'); return; } cambiaVoce(i, 'importo', n || 0); }} />
      <select className="pp-select" aria-label="A favore di" value={v.a_favore} onChange={(e) => cambiaVoce(i, 'a_favore', e.target.value)}><option value="luca">a favore tuo</option><option value="anna">a favore di Anna</option></select>
      <button type="button" className="pp-cc-togli" aria-label="Togli voce" onClick={() => cambia({ ...s, voci: voci.filter((_, j) => j !== i) })}>×</button>
    </div>)}
    <button type="button" className="pp-bottone pp-bottone-chiaro" onClick={() => cambia({ ...s, voci: [...voci, { id: `v${Date.now().toString(36)}`, descrizione: '', importo: 0, a_favore: 'luca' }] })}>Aggiungi voce</button>

    <label className="pp-campo"><span>Note</span><textarea rows={4} value={s.note || ''} onChange={(e) => cambia({ ...s, note: e.target.value })} placeholder="Accordi con Anna, cosa chiedere all'avvocato…" /></label>

    <div className="pp-cc-azioni">
      <button type="button" className="pp-bottone" disabled={pdf} onClick={() => documento('apri')}>{pdf ? 'Preparo…' : 'PDF della proposta'}</button>
      <button type="button" className="pp-bottone pp-bottone-chiaro" disabled={pdf} onClick={() => documento('condividi')}>Condividi PDF</button>
      <button type="button" className="pp-bottone pp-bottone-chiaro" onClick={duplica}>Duplica</button>
      <button type="button" className="pp-testo-link pp-rosso" onClick={() => setElimina(true)}>Elimina proposta</button>
    </div>
    {elimina && <Conferma testo={`Eliminare «${s.nome}»? I valori dei beni restano.`} onSi={cancella} onNo={() => setElimina(false)} />}
    <p className="pp-riga-meta">Proposta di lavoro, non è un accordo: va decisa con l'avvocato e con Anna, a valori di perizia. Le modifiche si salvano da sole.</p>
  </div>;
}

function RigaDivisione({ r, onAssegna, onValore }) {
  const b = r.bene;
  return <li className={`pp-cc-riga pp-cc-dove-${r.dove || 'nessuno'}`}>
    <div className="pp-cc-riga-testa">
      <strong>{b.nome || tipoBene(b)}</strong>
      <small>{tipoBene(b)} · {datiCatastali(b)}{b.consistenza ? ` · ${b.consistenza}` : ''}</small>
      {b.vincoli && <small className="pp-cc-vincolo-testo">{/pignor/i.test(b.vincoli) ? 'Pignorato' : 'Vincoli'}: {b.vincoli}</small>}
    </div>
    <label className="pp-cc-valore-campo"><span>Valore intero</span>
      <input inputMode="decimal" placeholder="da stimare" defaultValue={testoEuro(b.valore)} key={b.valore ?? 'vuoto'} onBlur={(e) => onValore(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }} />
      <em>{r.valore == null ? 'metà —' : `metà ${euroIntero(r.parteLuca)}`}</em>
    </label>
    <div className="pp-cc-destini" role="radiogroup" aria-label={`A chi va: ${b.nome || ''}`}>
      {DESTINI.map(([k, l]) => <button key={k} type="button" role="radio" aria-checked={r.dove === k} className={r.dove === k ? `attivo pp-cc-d-${k}` : ''} onClick={() => onAssegna(k)}>{l}</button>)}
    </div>
  </li>;
}
