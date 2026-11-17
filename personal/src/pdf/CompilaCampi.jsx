// COMPILA-CAMPI (PO 2026-11-17): i campi del modulo PDF compilati in automatico dove si può (dati
// ricordati sul telefono, carta d'identità in archivio, data di oggi); quelli che mancano li scrive Luca
// qui e vanno nel campo giusto. I dati ricordati restano solo su questo telefono.
import { useEffect, useState } from 'react';
import { archivioDb } from '../lib/supabasePersonal.js';
import { proposte, profiloDaIdentita, daRicordare } from './compila.js';

const CHIAVE_PROFILO = 'personal-pdf-profilo-v1';
const leggiProfilo = () => { try { return JSON.parse(localStorage.getItem(CHIAVE_PROFILO) || '{}') || {}; } catch { return {}; } };

// Campi di testo del modulo (fino a 30 pagine) con il valore attuale (anche quello già scritto a mano).
export async function leggiCampi(doc) {
  const campi = [];
  for (let n = 1; n <= Math.min(doc.numPages, 30); n++) {
    const annotazioni = await (await doc.getPage(n)).getAnnotations({ intent: 'display' });
    for (const a of annotazioni) {
      if (a.subtype !== 'Widget' || a.fieldType !== 'Tx') continue;
      const attuale = doc.annotationStorage.getValue(a.id, { value: a.fieldValue ?? '' }).value;
      campi.push({ id: a.id, nome: a.fieldName || '', descrizione: a.alternativeText || '', valore: typeof attuale === 'string' ? attuale : '', tipo: 'testo', solaLettura: !!a.readOnly, pagina: n });
    }
  }
  return campi;
}

// Dati della carta d'identità (o del codice fiscale) della prima persona delle impostazioni, se in archivio.
async function profiloArchivio(persona) {
  try {
    const { data } = await archivioDb.from('documenti').select('dati_estratti, persona, categoria')
      .eq('fascicolo', 'identita').in('categoria', ['carta_identita', 'codice_fiscale']).order('data_documento', { ascending: false }).limit(6);
    const miei = (data || []).filter((d) => !d.persona || d.persona === persona);
    return miei.reduce((p, d) => ({ ...profiloDaIdentita(d.dati_estratti), ...p }), {});
  } catch { return {}; }
}

export function CompilaCampi({ doc, persona, onApplica, onChiudi }) {
  const [righe, setRighe] = useState(null);
  const [ricorda, setRicorda] = useState(true);
  const [errore, setErrore] = useState('');
  useEffect(() => {
    let vivo = true;
    (async () => {
      try {
        const [campi, archivio] = await Promise.all([leggiCampi(doc), profiloArchivio(persona)]);
        if (vivo) setRighe(proposte(campi, { ...archivio, ...leggiProfilo() }));
      } catch (e) { if (vivo) setErrore(e.message || 'Campi non leggibili.'); }
    })();
    return () => { vivo = false; };
  }, [doc, persona]);
  const cambia = (id, valore) => setRighe((rr) => rr.map((r) => (r.id === id ? { ...r, valore, automatico: false } : r)));
  const applica = () => {
    if (ricorda) { try { localStorage.setItem(CHIAVE_PROFILO, JSON.stringify({ ...leggiProfilo(), ...daRicordare(righe) })); } catch { /* facoltativo */ } }
    onApplica(righe.filter((r) => String(r.valore || '').trim() || r.giaCompilato));
  };
  if (errore) return <section className="pdf-sheet" role="dialog" aria-label="Compila i campi"><h2>Compila i campi</h2><p role="alert">{errore}</p><button onClick={onChiudi}>Indietro</button></section>;
  if (!righe) return <section className="pdf-sheet" role="dialog" aria-label="Compila i campi"><h2>Compila i campi</h2><p role="status">Leggo i campi del modulo…</p></section>;
  if (!righe.length) return <section className="pdf-sheet" role="dialog" aria-label="Compila i campi"><h2>Compila i campi</h2>
    <p>Questo PDF non ha campi compilabili (è una scansione o un modulo “piatto”). Usa «Testo» per scrivere sopra la pagina.</p><button className="pdf-primary" onClick={onChiudi}>Ho capito</button></section>;
  const daFare = righe.filter((r) => !String(r.valore || '').trim());
  const fatte = righe.filter((r) => String(r.valore || '').trim());
  const riga = (r) => <label key={r.id} className="pdf-filename pdf-campo-modulo">
    <span>{r.etichetta}{r.automatico && <em className="pdf-auto">automatico</em>}</span>
    <input value={r.valore} onChange={(e) => cambia(r.id, e.target.value)} aria-label={r.etichetta} />
  </label>;
  return <form className="pdf-sheet pdf-salva" role="dialog" aria-label="Compila i campi" onSubmit={(e) => { e.preventDefault(); applica(); }}>
    <h2>Compila i campi</h2>
    <p>{fatte.length} di {righe.length} già pronti. {daFare.length ? 'Completa quelli che mancano: vanno nel campo giusto del modulo.' : 'Controlla e inserisci.'}</p>
    {daFare.length > 0 && <><h3 className="pdf-gruppo">Da completare · {daFare.length}</h3>{daFare.map(riga)}</>}
    {fatte.length > 0 && <><h3 className="pdf-gruppo">Pronti · {fatte.length}</h3>{fatte.map(riga)}</>}
    <label className="pdf-check"><input type="checkbox" checked={ricorda} onChange={(e) => setRicorda(e.target.checked)} /> Ricorda i miei dati su questo telefono (nome, codice fiscale, indirizzo…)</label>
    <button type="submit" className="pdf-primary">Inserisci nei campi</button>
    <button type="button" onClick={onChiudi}>Annulla</button>
  </form>;
}
