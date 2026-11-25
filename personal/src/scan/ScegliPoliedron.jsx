import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { usePortale, useInFinestra } from '../lib/portale.js';
import { archivioDb } from '../lib/supabasePersonal.js';
import { caricaCartelleMie } from '../lib/cartelleMie.js';
import { RADICE, CLINICO, CAMPI_ESPLORA, sottocartelle, documentiCartellaEsplora } from '../lib/esplora.js';
import { cercaDocumenti } from '../lib/archivio.js';
import { preparaFile, comeFile } from '../lib/condividi.js';
import { tokenSessione, titoloDoc } from '../ui.jsx';
import { useIndietro } from '../lib/indietro.js';
import { IconaIndietro, IconaCartella, IconaFile, IconaCerca } from '../Icone.jsx';
// SCAN-POLIEDRON (PO 2026-11-24: «quando dobbiamo aggiungere documenti dobbiamo poter selezionare anche
// esplora risorse di Poliedron»; «da quelle finestre si deve poter tornare indietro»).
// Finestra a tutto schermo sopra lo Scan: Recenti, le mie cartelle (con sottocartelle), ricerca.
// ‹ (e il tasto Indietro del telefono) torna alla cartella sopra e poi chiude. Si scelgono più PDF o
// foto; i file si scaricano dal Drive dell'utente con la sessione esistente e restano sul telefono.
// I documenti clinici dei pazienti non compaiono, come in Esplora file.
export const usabile = (d) => /pdf|image\//i.test(d.mime_type || '') || /\.(pdf|jpe?g|png|webp|heic|heif)$/i.test(d.nome_file_originale || '');
const visibile = (d) => d && d.fascicolo !== CLINICO;
const RECENTI = 'recenti';

export function ScegliPoliedron({ onScegli, onChiudi, max = 20 }) {
  const [percorso, setPercorso] = useState([{ id: null, nome: 'Poliedron' }]);
  const [cartelle, setCartelle] = useState([]);
  const [elenco, setElenco] = useState(null), [errore, setErrore] = useState('');
  const [scelti, setScelti] = useState(new Map()), [testo, setTesto] = useState(''), [cerco, setCerco] = useState(''), [scarico, setScarico] = useState('');
  const qui = percorso[percorso.length - 1];
  const portale = usePortale();
  const su = () => { if (cerco) { setCerco(''); setTesto(''); return true; } if (percorso.length > 1) { setPercorso((p) => p.slice(0, -1)); return true; } onChiudi(); return false; };
  useIndietro(true, su);
  useEffect(() => { caricaCartelleMie(archivioDb, { ancheArchiviate: false }).then(setCartelle).catch((e) => setErrore(e.message)); }, []);
  useEffect(() => {
    let vivo = true; setElenco(null); setErrore('');
    (async () => {
      if (cerco) return (await cercaDocumenti(archivioDb, cerco, null, 60)).filter(visibile);
      if (qui.id === RECENTI) return archivioDb.from('documenti').select(CAMPI_ESPLORA).neq('fascicolo', CLINICO).order('creato_il', { ascending: false }).limit(60).then(({ data, error }) => { if (error) throw new Error(error.message); return data; });
      if (qui.id) return (await documentiCartellaEsplora(archivioDb, qui.id)).filter(visibile);
      return [];
    })().then((r) => vivo && setElenco(r)).catch((e) => vivo && setErrore(e.message || 'Archivio non raggiungibile.'));
    return () => { vivo = false; };
  }, [qui.id, cerco]);
  const sotto = cerco ? [] : qui.id === null ? sottocartelle(cartelle, RADICE) : qui.id === RECENTI ? [] : sottocartelle(cartelle, qui.id);
  const scegli = (d) => setScelti((m) => { const n = new Map(m); if (n.has(d.id)) n.delete(d.id); else if (n.size < max) n.set(d.id, d); return n; });
  const conferma = async () => {
    setErrore('');
    try {
      const token = await tokenSessione(), files = [];
      let i = 0;
      for (const d of scelti.values()) { i += 1; setScarico(`Scarico ${i} di ${scelti.size}…`); files.push(comeFile(await preparaFile(d.drive_file_id, token))); }
      onScegli(files);
    } catch (e) { setErrore(e.message || 'File non scaricato.'); } finally { setScarico(''); }
  };
  const titolo = cerco ? `Cerca «${cerco}»` : qui.nome;
  return createPortal(<div className="scan-finestra" role="dialog" aria-modal="true" aria-label="Scegli da Poliedron">
    <header className="scan-finestra-testa">
      <button className="scan-vetro-tondo" aria-label={percorso.length > 1 || cerco ? 'Indietro' : 'Chiudi'} onClick={su}><IconaIndietro size={22} /></button>
      <div><small>{percorso.length > 1 ? percorso.slice(0, -1).map((p) => p.nome).join(' › ') : 'Esplora risorse'}</small><strong>{titolo}</strong></div>
      <button className="scan-finestra-annulla" onClick={onChiudi}>Annulla</button>
    </header>
    <form className="scan-finestra-cerca" role="search" onSubmit={(e) => { e.preventDefault(); setCerco(testo.trim()); }}>
      <IconaCerca size={18} /><input type="search" aria-label="Cerca nell'archivio" placeholder="Cerca nell'archivio…" value={testo} onChange={(e) => setTesto(e.target.value)} />
    </form>
    <div className="scan-finestra-corpo">
      {!cerco && qui.id === null && <button className="scan-voce scan-voce-cartella" onClick={() => setPercorso((p) => [...p, { id: RECENTI, nome: 'Recenti' }])}><span className="scan-voce-icona recenti"><IconaFile size={22} /></span><span><strong>Recenti</strong><small>Gli ultimi documenti archiviati</small></span><span aria-hidden="true">›</span></button>}
      {!cerco && qui.id === null && <button className="scan-voce scan-voce-cartella" onClick={() => setPercorso((p) => [...p, { id: RADICE, nome: 'Scrivania' }])}><span className="scan-voce-icona"><IconaCartella size={22} /></span><span><strong>Scrivania</strong><small>Personale</small></span><span aria-hidden="true">›</span></button>}
      {sotto.map((c) => <button key={c.id} className="scan-voce scan-voce-cartella" onClick={() => setPercorso((p) => [...p, { id: c.id, nome: c.nome }])}><span className="scan-voce-icona"><IconaCartella size={22} /></span><span><strong>{c.nome}</strong></span><span aria-hidden="true">›</span></button>)}
      {(qui.id !== null || cerco) && elenco === null && !errore && <p className="scan-finestra-nota"><span className="pp-rotella" /> Carico…</p>}
      {elenco?.length === 0 && (qui.id !== null || cerco) && !sotto.length && <p className="scan-finestra-nota">Nessun documento qui.</p>}
      {elenco?.map((d) => {
        const ok = usabile(d) && d.drive_file_id, on = scelti.has(d.id);
        return <button key={d.id} className={`scan-voce${on ? ' scelta' : ''}`} disabled={!ok} aria-pressed={on} onClick={() => scegli(d)}>
          <span className={`scan-voce-tipo${/pdf/i.test(d.mime_type || d.nome_file_originale || '') ? ' pdf' : ''}`} aria-hidden="true">{/pdf/i.test(d.mime_type || d.nome_file_originale || '') ? 'PDF' : /image/i.test(d.mime_type || '') ? 'IMG' : 'DOC'}</span>
          <span><strong>{titoloDoc(d)}</strong><small>{ok ? new Date(d.data_documento || d.creato_il).toLocaleDateString('it-IT') : 'Non unibile in un PDF'}</small></span>
          <span className="scan-voce-spunta" aria-hidden="true">{on ? '✓' : ''}</span>
        </button>;
      })}
      {errore && <p className="pp-messaggio pp-messaggio-errore" role="alert">{errore}</p>}
    </div>
    <footer className="scan-finestra-piede">
      <span>{scarico || (scelti.size ? `${scelti.size} ${scelti.size === 1 ? 'documento scelto' : 'documenti scelti'}` : 'Tocca i PDF o le foto da aggiungere')}</span>
      <button className="scan-vetro-primario" disabled={!scelti.size || !!scarico} onClick={conferma}>Aggiungi</button>
    </footer>
  </div>, portale || document.body);
}
