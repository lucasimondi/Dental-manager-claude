// DOCUMENTI-FIRMATI (PO 2026-11-17): "Quando tenti di salvare il file in archivio deve essere semplice il
// popup, con campo titolo, e varie altre classificazioni secondo le sezioni, facoltative, deve esserci
// possibilità di salvarlo in cartelle di drive eventualmente creandone di nuove che vanno sia in
// poliedron sia in drive" + "quando si firma un documento allegarlo direttamente ad una mail di risposta".
// Un foglio: titolo (proposto «… firmato», modificabile, con un suggerimento dal contenuto), dove salvarlo
// (Documenti firmati, una delle mie cartelle o una nuova, sempre anche su Drive; oppure l'archivio
// automatico), le altre classificazioni chiuse sotto «Altro (facoltativo)». Dopo: bozza Gmail con il file
// allegato, in risposta all'email dell'originale o nuova. Mai inviata: la invia Luca da Gmail.
import { useEffect, useMemo, useState } from 'react';
import { archivioDb } from '../lib/supabasePersonal.js';
import { caricaDocumento, suggerisciTitolo, bozzaConAllegato, daEmail } from '../lib/archivio.js';
import { caricaCartelleMie, creaCartella, elencoConPercorso } from '../lib/cartelleMie.js';
import { preparaFile } from '../lib/file.js';
import { tokenSessione } from '../ui.jsx';
import TipoETag, { ricordaTipoETag } from '../../../shared/documenti/TipoETag.jsx';
import { titoloIniziale, conFirmato } from './titoloFirmato.js';

const NUOVA = '__nuova__';
const AUTOMATICO = '__auto__';
const FIRMATI = 'firmati';
const STUDIO = '__studio__';

export function SalvaArchivio({ file, origine = null, firmato = false, testoPdf, ctx, onChiudi, onSalvato, onApri, onStudio }) {
  const { impostazioni = { persone: [], categorie: [] }, fascicoli = [], aggiorna, mostra } = ctx || {};
  const [titolo, setTitolo] = useState(() => titoloIniziale({ origine, nomeFile: file?.name, firmato }));
  const [suggerito, setSuggerito] = useState(null);
  const [cartelle, setCartelle] = useState([]);
  const [dove, setDove] = useState(firmato ? FIRMATI : AUTOMATICO);
  const [nuova, setNuova] = useState({ nome: '', padre: '' });
  const [altro, setAltro] = useState(false);
  const [fascicolo, setFascicolo] = useState(origine?.fascicolo && origine.fascicolo !== 'clinico_pazienti' ? origine.fascicolo : '');
  const [persona, setPersona] = useState(origine?.persona || '');
  const [categoria, setCategoria] = useState(origine?.categoria || '');
  const [tag, setTag] = useState([]);
  const [leggi, setLeggi] = useState(false);
  const [stato, setStato] = useState(null);
  const [salvato, setSalvato] = useState(null);
  const [email, setEmail] = useState(null);
  const clinico = origine?.fascicolo === 'clinico_pazienti';

  useEffect(() => {
    let vivo = true;
    caricaCartelleMie(archivioDb, { ancheArchiviate: false }).then((c) => { if (vivo) setCartelle(c || []); }).catch(() => {});
    return () => { vivo = false; };
  }, []);
  // Titolo dal contenuto: le prime righe del PDF allo script (mai a un modello per i pazienti).
  useEffect(() => {
    if (clinico || !testoPdf) return undefined;
    let vivo = true;
    (async () => {
      const testo = await testoPdf().catch(() => '');
      const t = await suggerisciTitolo({ token: await tokenSessione(), testo, nome: file?.name, titolo });
      if (vivo && t) setSuggerito(conFirmato(t, firmato));
    })();
    return () => { vivo = false; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const mie = useMemo(() => elencoConPercorso(cartelle.filter((c) => c.speciale !== FIRMATI)), [cartelle]);
  const nomeDove = dove === FIRMATI ? 'Documenti firmati' : dove === AUTOMATICO ? 'Archivio (cartella automatica)' : dove === NUOVA ? nuova.nome.trim() : (mie.find((c) => c.id === dove)?.nome || 'cartella');

  const salva = async () => {
    const t = titolo.trim();
    if (!t) { setStato({ errore: 'Scrivi un titolo.' }); return; }
    if (dove === STUDIO) { onStudio?.(); return; }   // documento di un paziente: la pagina dello studio
    if (dove === NUOVA && !nuova.nome.trim()) { setStato({ errore: 'Scrivi il nome della nuova cartella.' }); return; }
    setStato({ invio: 'Preparo il file…' });
    try {
      let cartella = null;
      if (dove === NUOVA) {
        setStato({ invio: 'Creo la cartella…' });
        cartella = (await creaCartella(archivioDb, { nome: nuova.nome, padre_id: nuova.padre || null })).id;
      } else if (dove !== FIRMATI && dove !== AUTOMATICO) cartella = dove;
      const pronto = await preparaFile(file);
      setStato({ invio: dove === AUTOMATICO ? 'Salvo su Drive…' : `Salvo in «${nomeDove}» su Drive…` });
      const r = await caricaDocumento({ token: await tokenSessione(), ...pronto, descrizione: t, titolo: t, fascicolo, persona, categoria,
        nonAnalizzare: !leggi, firmati: dove === FIRMATI, cartella });
      if (r.id && tag.length) {
        const { data: d } = await archivioDb.from('documenti').select('tag').eq('id', r.id).maybeSingle();
        await archivioDb.from('documenti').update({ tag: [...new Set([...(d?.tag || []), ...tag])] }).eq('id', r.id);
        ricordaTipoETag(null, tag);
      }
      aggiorna?.();
      setSalvato({ id: r.id, titolo: r.duplicato ? r.titolo : t, duplicato: !!r.duplicato, dove: nomeDove });
      setStato(null);
      onSalvato?.(r);
      mostra?.(r.duplicato ? 'Era già in archivio' : `Salvato in ${nomeDove}`);
    } catch (e) { setStato({ errore: e.message || 'Salvataggio non riuscito.' }); }
  };

  const preparaBozza = async () => {
    setEmail((m) => ({ ...m, invio: true, errore: '' }));
    try {
      const r = await bozzaConAllegato({ token: await tokenSessione(), documento: salvato.id, origine: email.risposta ? origine.id : null, testo: email.testo, a: email.a, oggetto: email.oggetto });
      setEmail((m) => ({ ...m, invio: false, fatta: r }));
    } catch (e) { setEmail((m) => ({ ...m, invio: false, errore: e.message })); }
  };
  const testoBase = `Buongiorno,\n\nin allegato ${firmato ? 'il documento firmato' : 'il documento'}${salvato ? ` «${salvato.titolo}»` : ''}.\n\nCordiali saluti\nLuca Simondi`;

  if (salvato) {
    return <section className="pdf-sheet pdf-salva" role="dialog" aria-label="Documento salvato">
      <h2>{salvato.duplicato ? 'Era già in archivio' : 'Salvato'}</h2>
      <p><strong>{salvato.titolo}</strong><br />{salvato.duplicato ? `Aggiunto anche a «${salvato.dove}».` : `In «${salvato.dove}», in Poliedron e su Drive.`}</p>
      {!email && <>
        {daEmail(origine) && <button className="pdf-primary" onClick={() => setEmail({ risposta: true, testo: testoBase })}>Rispondi all’email con il file allegato</button>}
        <button className={daEmail(origine) ? '' : 'pdf-primary'} onClick={() => setEmail({ risposta: false, testo: testoBase, a: '', oggetto: salvato.titolo })}>Nuova email con il file allegato</button>
        {onApri && salvato.id && <button onClick={() => onApri(salvato.id)}>Apri il documento</button>}
        <button onClick={onChiudi}>Fine</button>
      </>}
      {email && !email.fatta && <>
        <p>{email.risposta ? `Risposta a: ${origine?.email_mittente || 'mittente dell’email originale'}` : 'Email nuova'} · il file è allegato. Si crea solo una bozza in Gmail: la invii tu.</p>
        {!email.risposta && <label className="pdf-filename">A (facoltativo)<input type="email" value={email.a} onChange={(e) => setEmail({ ...email, a: e.target.value })} placeholder="nome@esempio.it" /></label>}
        {!email.risposta && <label className="pdf-filename">Oggetto<input value={email.oggetto} onChange={(e) => setEmail({ ...email, oggetto: e.target.value })} /></label>}
        <label className="pdf-filename">Testo<textarea rows={6} value={email.testo} onChange={(e) => setEmail({ ...email, testo: e.target.value })} /></label>
        <button className="pdf-primary" disabled={email.invio} onClick={preparaBozza}>{email.invio ? 'Preparo la bozza…' : 'Prepara la bozza in Gmail'}</button>
        <button disabled={email.invio} onClick={() => setEmail(null)}>Indietro</button>
        {email.errore && <p role="alert">{email.errore}</p>}
      </>}
      {email?.fatta && <>
        <p>Bozza pronta in Gmail{email.fatta.a ? ` per ${email.fatta.a}` : ''}, con il file allegato. Non è stata inviata.</p>
        <a className="pdf-link-bottone pdf-primary" href={email.fatta.link} target="_blank" rel="noreferrer">Apri la bozza in Gmail</a>
        <button onClick={onChiudi}>Fine</button>
      </>}
    </section>;
  }

  return <form className="pdf-sheet pdf-salva" role="dialog" aria-label="Salva nell'archivio" onSubmit={(e) => { e.preventDefault(); void salva(); }}>
    <h2>{firmato ? 'Salva il documento firmato' : 'Salva nell’archivio'}</h2>
    <label className="pdf-filename">Titolo<input value={titolo} onChange={(e) => setTitolo(e.target.value)} autoFocus required maxLength={120} /></label>
    {suggerito && suggerito !== titolo && <button type="button" className="pdf-suggerito" onClick={() => setTitolo(suggerito)}>Suggerito dal contenuto: <strong>{suggerito}</strong></button>}
    <label className="pdf-filename">Dove salvarlo
      <select value={dove} onChange={(e) => setDove(e.target.value)}>
        <option value={FIRMATI}>Documenti firmati</option>
        {mie.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
        <option value={NUOVA}>+ Nuova cartella…</option>
        <option value={AUTOMATICO}>Archivio (cartella automatica)</option>
        {onStudio && <option value={STUDIO}>Studio · paziente…</option>}
      </select>
    </label>
    {dove === NUOVA && <div className="pdf-nuova-cartella">
      <label className="pdf-filename">Nome della cartella<input value={nuova.nome} onChange={(e) => setNuova({ ...nuova, nome: e.target.value })} placeholder="Es. Contratti casa" maxLength={80} /></label>
      {mie.length > 0 && <label className="pdf-filename">Dentro (facoltativo)<select value={nuova.padre} onChange={(e) => setNuova({ ...nuova, padre: e.target.value })}><option value="">Archivio personale</option>{mie.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}</select></label>}
    </div>}
    {dove !== STUDIO && <><p className="pdf-nota">{dove === AUTOMATICO ? 'Lo metto io nella cartella della categoria, su Drive in «Archivio personale».' : 'La cartella c’è sia in Poliedron sia su Drive («Archivio personale»), con lo stesso nome. Il file prende esattamente questo titolo.'}</p>
    <button type="button" className="pdf-altro" aria-expanded={altro} onClick={() => setAltro(!altro)}>{altro ? '▾' : '▸'} Altro (facoltativo): categoria, persona, tipo, tag</button>
    {altro && dove !== STUDIO && <div className="pdf-altro-campi">
      <label className="pdf-filename">Categoria<select value={fascicolo} onChange={(e) => setFascicolo(e.target.value)}><option value="">Scegli in automatico</option>{fascicoli.map((f) => <option key={f.codice} value={f.codice}>{f.nome}</option>)}</select></label>
      <div className="pdf-due">
        <label className="pdf-filename">Persona<select value={persona} onChange={(e) => setPersona(e.target.value)}><option value="">Nessuna</option>{impostazioni.persone.map((p) => <option key={p} value={p}>{p}</option>)}</select></label>
        <label className="pdf-filename">Tipo<select value={categoria} onChange={(e) => setCategoria(e.target.value)}><option value="">Nessuno</option>{impostazioni.categorie.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}</select></label>
      </div>
      <TipoETag tag={tag} onTag={setTag} />
      <label className="pdf-check"><input type="checkbox" checked={leggi} disabled={clinico} onChange={(e) => setLeggi(e.target.checked)} /> Leggi il contenuto e completa la scheda (riassunto, importi, scadenze)</label>
    </div>}</>}
    <button type="submit" className="pdf-primary" disabled={!!stato?.invio}>{stato?.invio || (dove === STUDIO ? 'Continua nello studio' : `Salva in «${nomeDove || 'cartella'}»`)}</button>
    <button type="button" disabled={!!stato?.invio} onClick={onChiudi}>Annulla</button>
    {stato?.errore && <p role="alert">{stato.errore}</p>}
  </form>;
}
