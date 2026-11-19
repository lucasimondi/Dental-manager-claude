// CONCORDATO (PO 2026-11-20): sezione con due parti. «Beni»: l'elenco degli immobili dalla visura con quote,
// comproprietari, vincoli e valori, e il PDF da dare all'avvocato. «Divisione con Anna»: le proposte di divisione.
import { useEffect, useMemo, useRef, useState } from 'react';
import { archivioDb } from '../../lib/supabasePersonal.js';
import { caricaBeni, caricaFormalita, CERTEZZE, datiCatastali, etichettaNatura, euroIntero, formalitaDi, leggiEuro, NATURE, quota, riferimentoFormalita, salvaBene, statoGravami, tipoBene, valoreCatastale } from '../../lib/concordato.js';
import { creaPdfBeni, creaPdfBeniComuni } from '../../lib/concordatoPdf.js';
import { Atti } from './Atti.jsx';
import { Segmenti, Vuoto } from '../../ui.jsx';
import { ElencoProposte } from './Divisione.jsx';
import { apriPdf, condividiPdf, nomeFile } from './condividi.js';

const FONTI_VALORE = ['Perizia del CTU', 'Perizia di parte', 'Stima di agenzia', 'Stima mia', 'Prezzo di vendita richiesto'];

function perGruppo(beni) {
  const g = new Map();
  for (const b of beni) { const k = b.gruppo || b.comune; if (!g.has(k)) g.set(k, []); g.get(k).push(b); }
  return [...g.entries()];
}

export function Concordato({ ctx, iniziale = 'beni' }) {
  const [scheda, setScheda] = useState(['divisione', 'atti'].includes(iniziale) ? iniziale : 'beni');
  return <div className="pp-cc">
    <h2>Concordato</h2>
    <p>I tuoi immobili con le quote e la divisione con Anna. Inserisci i valori (perizie o stime): i conti si aggiornano subito.</p>
    <Segmenti voci={[['beni', 'Beni'], ['atti', 'Ipoteche e atti'], ['divisione', 'Divisione']]} attiva={scheda} onScegli={setScheda} />
    {scheda === 'beni' ? <Beni ctx={ctx} /> : scheda === 'atti' ? <Atti ctx={ctx} /> : <ElencoProposte ctx={ctx} />}
  </div>;
}

function Beni({ ctx }) {
  const [beni, setBeni] = useState(null), [formalita, setFormalita] = useState([]), [pdf, setPdf] = useState(false);
  useEffect(() => { let vivo = true; ctx.esegui(async () => {
    const [b, f] = await Promise.all([caricaBeni(archivioDb), caricaFormalita(archivioDb)]);
    if (vivo) { setBeni(b); setFormalita(f); }
  }); return () => { vivo = false; }; }, [ctx.esegui, ctx.versione]);
  const gruppi = useMemo(() => perGruppo(beni || []), [beni]);
  if (!beni) return <Vuoto>Carico…</Vuoto>;
  if (!beni.length) return <Vuoto>Nessun bene inserito.</Vuoto>;
  const fab = beni.filter((b) => b.catasto === 'F').length, ter = beni.length - fab;
  const anna = beni.filter((b) => b.in_divisione).length, vinc = beni.filter((b) => statoGravami(b.id, formalita).n).length;
  const conValore = beni.filter((b) => b.valore != null);
  const parte = conValore.reduce((s, b) => s + Number(b.valore) * (quota(b.quota_luca) || 0), 0);
  const documento = (quale, azione) => { setPdf(quale); ctx.esegui(async () => {
    const blob = quale === 'anna' ? await creaPdfBeniComuni(beni, formalita) : await creaPdfBeni(beni, { formalita });
    const nome = nomeFile(quale === 'anna' ? 'beni-in-comune-luca-anna' : 'situazione-immobili-luca');
    if (azione === 'apri') apriPdf(blob); else if ((await condividiPdf(blob, nome)) === 'scaricato') ctx.mostra?.('PDF scaricato');
  }).finally(() => setPdf(false)); };
  return <>
    <section className="pp-cc-doc" aria-label="Situazione completa">
      <div className="pp-cc-doc-icona" aria-hidden="true">PDF</div>
      <div className="pp-cc-doc-testo"><strong>Situazione completa degli immobili</strong><span>{fab} fabbricati e {ter} terreni con intestatari, provenienza, ipoteche, pignoramenti e trascrizioni. Per l'avvocato e il gestore della crisi.</span></div>
      <div className="pp-cc-doc-azioni">
        <button type="button" className="pp-bottone" disabled={Boolean(pdf)} onClick={() => documento('completo', 'apri')}>{pdf === 'completo' ? 'Preparo…' : 'Apri PDF'}</button>
        <button type="button" className="pp-bottone pp-bottone-chiaro" disabled={Boolean(pdf)} onClick={() => documento('completo', 'condividi')}>Condividi</button>
      </div>
    </section>
    <section className="pp-cc-doc pp-cc-doc-anna" aria-label="Beni in comune con Anna">
      <div className="pp-cc-doc-icona" aria-hidden="true">PDF</div>
      <div className="pp-cc-doc-testo"><strong>Beni in comune con Anna</strong><span>Da condividere con tua sorella: i {anna} beni al 50%, le altre comproprietà di famiglia, i gravami che contano per la divisione, le regole e una tabella per i valori. Non parla dei tuoi altri debiti.</span></div>
      <div className="pp-cc-doc-azioni">
        <button type="button" className="pp-bottone" disabled={Boolean(pdf)} onClick={() => documento('anna', 'apri')}>{pdf === 'anna' ? 'Preparo…' : 'Apri PDF'}</button>
        <button type="button" className="pp-bottone pp-bottone-chiaro" disabled={Boolean(pdf)} onClick={() => documento('anna', 'condividi')}>Condividi</button>
      </div>
    </section>
    <div className="pp-cc-numeri">
      <div><strong>{beni.length}</strong><span>beni</span></div>
      <div><strong>{anna}</strong><span>in comune con Anna</span></div>
      <div className={vinc ? 'pp-cc-avviso' : ''}><strong>{vinc}</strong><span>con ipoteche o pignoramenti</span></div>
      <div><strong>{conValore.length ? euroIntero(parte) : '—'}</strong><span>{conValore.length ? `valore tua parte (${conValore.length}/${beni.length} stimati)` : 'valori da inserire'}</span></div>
    </div>
    {gruppi.map(([g, lista]) => <Gruppo key={g} nome={g} lista={lista} ctx={ctx} formalita={formalita} chiuso={lista.length > 8} />)}
    <p className="pp-riga-meta">Dati dalle visure catastali del 20/11/2026 (55 immobili, intestatari confermati) e dalle ispezioni ipotecarie. Tocca un bene per intestatari, provenienza, ipoteche e per inserire il valore.</p>
  </>;
}

function Gruppo({ nome, lista, ctx, formalita, chiuso }) {
  const [aperto, setAperto] = useState(!chiuso);
  const quote = [...new Set(lista.map((b) => b.quota_luca))].join(' · ');
  return <section className="pp-cc-gruppo">
    <button type="button" className="pp-cc-gruppo-testa" aria-expanded={aperto} onClick={() => setAperto(!aperto)}>
      <span><strong>{nome}</strong><small>{lista.length} {lista.length === 1 ? 'bene' : 'beni'} · tua quota {quote}</small></span>
      <span className="pp-cc-freccia" aria-hidden="true">{aperto ? '▾' : '▸'}</span>
    </button>
    {aperto && <ul className="pp-cc-lista">{lista.map((b) => <RigaBene key={b.id} b={b} g={statoGravami(b.id, formalita)} onApri={() => ctx.apri({ tipo: 'concordato-bene', bene: b, formalita })} />)}</ul>}
  </section>;
}

function RigaBene({ b, g, onApri }) {
  const q = quota(b.quota_luca);
  return <li><button type="button" className="pp-cc-bene" onClick={onApri}>
    <span className="pp-cc-bene-testo">
      <strong>{b.nome || tipoBene(b)}</strong>
      <small>{tipoBene(b)} · {datiCatastali(b)}{b.consistenza ? ` · ${b.consistenza}` : ''}</small>
      <span className="pp-cc-etichette">
        {b.in_divisione && <span className="pp-cc-etichetta pp-cc-anna">Con Anna</span>}
        {g.pignorato && <span className="pp-cc-etichetta pp-cc-pignorato">Pignorato</span>}
        {g.ipoteca && <span className={`pp-cc-etichetta pp-cc-vincolo${g.ipoteca === 'certo' ? '' : ' pp-cc-incerto'}`}>{g.ipoteca === 'certo' ? 'Ipoteca' : 'Ipoteca?'}</span>}
        <span className="pp-cc-valore">{b.valore != null ? `${euroIntero(b.valore)} · tua parte ${euroIntero(Number(b.valore) * (q || 0))}` : 'Valore da stimare'}</span>
      </span>
    </span>
    <span className="pp-cc-quota">{b.quota_luca}</span>
  </button></li>;
}

export function ModuloBene({ bene, formalita = [], ctx, chiudi }) {
  const [campi, setCampi] = useState({
    nome: bene.nome || '', valore: bene.valore == null ? '' : Number(bene.valore).toLocaleString('it-IT'), valore_fonte: bene.valore_fonte || '',
    quota_luca: bene.quota_luca || '', quota_anna: bene.quota_anna || '', altri_comproprietari: bene.altri_comproprietari || '',
    in_divisione: Boolean(bene.in_divisione), vincoli: bene.vincoli || '', note: bene.note || '',
  });
  const [busy, setBusy] = useState(false); const lock = useRef(false);
  const campo = (k) => ({ value: campi[k], onChange: (e) => setCampi({ ...campi, [k]: e.target.value }) });
  const v = leggiEuro(campi.valore); const qL = quota(campi.quota_luca); const cat = valoreCatastale(bene);
  const salva = (e) => { e.preventDefault(); if (lock.current) return;
    if (Number.isNaN(v)) { ctx.mostra?.('Valore non valido: scrivi per esempio 250.000'); return; }
    lock.current = true; setBusy(true);
    ctx.esegui(async () => {
      await salvaBene(archivioDb, bene.id, { ...campi, valore: v, quota_anna: campi.in_divisione ? campi.quota_anna : (campi.quota_anna || null) });
      ctx.aggiorna(); chiudi(); ctx.mostra?.('Bene aggiornato');
    }).finally(() => { lock.current = false; setBusy(false); });
  };
  return <form className="pp-cc-modulo" onSubmit={salva}>
    <dl className="pp-cc-dati">
      <dt>Tipo</dt><dd>{tipoBene(bene)}{bene.consistenza ? ` · ${bene.consistenza}` : ''}</dd>
      <dt>Catasto</dt><dd>{bene.comune} · {datiCatastali(bene)}{bene.categoria ? ` · ${bene.categoria}` : ''}{bene.classe ? ` cl. ${bene.classe}` : ''}</dd>
      {bene.indirizzo && <><dt>Indirizzo</dt><dd>{bene.indirizzo}{bene.piano ? `, piano ${bene.piano}` : ''}</dd></>}
      <dt>{bene.catasto === 'T' ? 'Redditi' : 'Rendita'}</dt><dd>{bene.catasto === 'T' ? `RD ${bene.reddito_dominicale ?? '—'} € · RA ${bene.reddito_agrario ?? '—'} €` : bene.rendita != null ? `${Number(bene.rendita).toLocaleString('it-IT', { minimumFractionDigits: 2 })} €` : '—'}</dd>
      <dt>Titolo</dt><dd>{bene.titolo}</dd>
      {bene.superficie && <><dt>Superficie</dt><dd>{bene.superficie}</dd></>}
      {bene.provenienza && <><dt>Provenienza</dt><dd>{bene.provenienza}</dd></>}
    </dl>
    {(bene.intestatari || []).length > 0 && <section className="pp-cc-blocco"><h3>Intestatari (visura catastale)</h3>
      <ul className="pp-cc-intestatari">{bene.intestatari.map((i) => <li key={i.nome} className={i.nome === 'Simondi Luca' ? 'pp-cc-io' : ''}><span>{i.nome}</span><strong>{i.quota}</strong>{i.diritto && i.diritto !== 'Proprietà' && <small>{i.diritto}</small>}</li>)}</ul>
    </section>}
    <ElencoFormalita lista={formalitaDi(bene.id, formalita)} />
    <label className="pp-campo"><span>Nome</span><input maxLength={200} {...campo('nome')} /></label>
    <label className="pp-campo"><span>Valore di mercato dell'intero bene (€)</span><input inputMode="decimal" placeholder="es. 250.000" {...campo('valore')} /></label>
    <p className="pp-riga-meta">{v != null && !Number.isNaN(v) && qL ? `La tua parte (${campi.quota_luca}): ${euroIntero(v * qL)}. ` : ''}{cat ? `Valore catastale di riferimento (fiscale, non di mercato): ${euroIntero(cat)}.` : ''}</p>
    <label className="pp-campo"><span>Da dove viene il valore</span>
      <select className="pp-select" {...campo('valore_fonte')}><option value="">—</option>{FONTI_VALORE.map((f) => <option key={f}>{f}</option>)}</select>
    </label>
    <div className="pp-cc-due">
      <label className="pp-campo"><span>Tua quota</span><input required placeholder="1/2" {...campo('quota_luca')} /></label>
      <label className="pp-campo"><span>Quota di Anna</span><input placeholder="1/2" {...campo('quota_anna')} /></label>
    </div>
    <label className="pp-interruttore"><span>In divisione con Anna</span><input type="checkbox" checked={campi.in_divisione} onChange={(e) => setCampi({ ...campi, in_divisione: e.target.checked, quota_anna: e.target.checked && !campi.quota_anna ? '1/2' : campi.quota_anna })} /></label>
    <label className="pp-campo"><span>Altri comproprietari</span><input maxLength={300} {...campo('altri_comproprietari')} /></label>
    <label className="pp-campo"><span>Pignoramenti, ipoteche, vincoli</span><textarea rows={3} {...campo('vincoli')} /></label>
    <label className="pp-campo"><span>Note</span><textarea rows={3} {...campo('note')} /></label>
    <button className="pp-bottone pp-bottone-largo" disabled={busy}>{busy ? 'Salvo…' : 'Salva'}</button>
  </form>;
}

export function ElencoFormalita({ lista }) {
  if (!lista.length) return null;
  return <section className="pp-cc-blocco"><h3>Ipoteche, pignoramenti e trascrizioni</h3>
    <ul className="pp-cc-formalita">{lista.map((f) => <li key={f.id} className={`pp-cc-f-${NATURE[f.natura]?.[1] || 'grigio'}`}>
      <strong>{etichettaNatura(f.natura)}{f.verso === 'contro' ? '' : ' (a favore)'}</strong>
      <span>{riferimentoFormalita(f)} · {f.pubblico_ufficiale}{f.creditore ? ` · ${f.creditore}` : ''}{f.procedura ? ` · ${f.procedura}` : ''}</span>
      {f.certezza && f.certezza !== 'certo' && <em>Collegamento a questo bene: {CERTEZZE[f.certezza]}</em>}
    </li>)}</ul>
  </section>;
}
