// SCAN-HUB (PO 2026-11-12: «Questo è un software di scansione e gestione PDF che va bene, riesci a
// crearlo così? Modificando Scan?») — la Home di Scan: scanner in evidenza, strumenti a griglia,
// «Da album» / «Da file», i Recenti di questo telefono e il tasto fotocamera sempre in basso.
// Ogni strumento apre una pagina sopra la Home; chiudendola si torna qui.
import { useEffect, useRef, useState } from 'react';
import { elencoDocumenti } from '../lib/libreria.js';
import { RigaDocumento, condividiDocumenti } from './Documenti.jsx';
import {
  IconaScansiona, IconaFile, IconaTessera, IconaTesto, IconaFoto, IconaDocumenti,
  IconaPortafoglio, IconaGraffetta, IconaTraduci,
} from '../Icone.jsx';

export const STRUMENTI_SCAN = [
  ['testo', 'Estrai testo', IconaTesto],
  ['tessera', "Carta d'identità", IconaTessera],
  ['firma', 'Firma PDF', IconaFile],
  ['unisci', 'Unisci in un PDF', IconaGraffetta],
  ['comprimi', 'Comprimi PDF', IconaFile],
  ['traduci', 'Traduci', IconaTraduci],
  ['archivio', 'Archivio', IconaDocumenti],
  ['personali', 'Documenti personali', IconaPortafoglio],
];

// SCAN-ORGANIZZA: tutti gli strumenti, per la scheda «Strumenti» della barra in basso.
export const TUTTI_STRUMENTI = [
  ['scanner', 'Scanner', IconaScansiona], ['tessera', "Carta d'identità", IconaTessera], ['testo', 'Estrai testo', IconaTesto],
  ['traduci', 'Traduci', IconaTraduci], ['pdf', 'PDF e firma', IconaFile], ['firma', 'Firma PDF', IconaFile],
  ['parola', 'PDF in Word', IconaFile], ['unisci', 'Unisci in un PDF', IconaGraffetta], ['comprimi', 'Comprimi PDF', IconaFile],
  ['pagine', 'Pagine PDF', IconaFile], ['archivio', 'Archivio', IconaDocumenti], ['personali', 'Documenti personali', IconaPortafoglio],
];
export function GrigliaStrumenti({ onStrumento, completa = false }) {
  return (
    <div className="scan-griglia" role="group" aria-label="Strumenti">
      {(completa ? TUTTI_STRUMENTI : STRUMENTI_SCAN).map(([id, nome, Icona]) => (
        <button key={id} className={`scan-strumento scan-strumento-${id}`} onClick={() => onStrumento(id)}>
          <span className="scan-strumento-icona"><Icona size={24} /></span><span>{nome}</span>
        </button>
      ))}
    </div>
  );
}

export function ScanHome({ ctx, versioneRecenti, onStrumento, onFiles, onDocumenti }) {
  const { mostra } = ctx;
  const [recenti, setRecenti] = useState(null);
  const album = useRef(null), daFile = useRef(null);
  // SCAN-LIBRERIA: i Recenti sono gli ultimi documenti della libreria «I miei documenti».
  useEffect(() => { elencoDocumenti().then((d) => setRecenti(d.slice(0, 5))).catch(() => setRecenti([])); }, [versioneRecenti]);
  const prova = (fn) => async () => { try { await fn(); } catch (e) { mostra(e.message || String(e)); } };

  return (
    <div className="scan-home">
      <input ref={album} type="file" accept="image/*,.heic,.heif" multiple hidden onChange={(e) => { onFiles([...e.target.files]); e.target.value = ''; }} />
      <input ref={daFile} type="file" accept="application/pdf,image/*,.heic,.heif" multiple hidden onChange={(e) => { onFiles([...e.target.files]); e.target.value = ''; }} />

      <div className="scan-hero">
        <button className="scan-hero-grande" onClick={() => onStrumento('scanner')}>
          <strong>Scanner</strong><span>Fogli, ricevute, referti → PDF</span>
          <span className="scan-hero-icona" aria-hidden="true"><IconaScansiona size={46} /></span>
        </button>
        <button className="scan-hero-piccolo scan-hero-pdf" onClick={() => onStrumento('pdf')}>
          <strong>PDF e firma</strong><span>apri, compila, firma</span>
        </button>
        <button className="scan-hero-piccolo scan-hero-tessera" onClick={() => onStrumento('tessera')}>
          <strong>Carta d'identità</strong><span>fronte e retro su A4</span>
        </button>
      </div>

      <GrigliaStrumenti onStrumento={onStrumento} />

      <div className="scan-sorgenti">
        <button onClick={() => album.current.click()}><IconaFoto size={20} /> Da album</button>
        <button onClick={() => daFile.current.click()}><IconaFile size={20} /> Da file</button>
      </div>

      <section className="scan-recenti" aria-label="Recenti">
        <div className="scan-recenti-testa"><h2>Recenti</h2>{recenti?.length > 0 && <button className="pp-testo-link" onClick={onDocumenti}>Tutti i documenti ›</button>}</div>
        {recenti && !recenti.length && (
          <div className="scan-recenti-vuoto">
            <strong>Inizia la tua prima scansione</strong>
            <p>I PDF che crei, condividi o scarichi da Scan restano in «I miei documenti», solo su questo telefono.</p>
          </div>
        )}
        {(recenti || []).map((d) => (
          <RigaDocumento key={d.id} d={d} onApri={() => ctx.apri({ tipo: 'scheda', id: d.id })} onCondividi={prova(() => condividiDocumenti(ctx, [d]))} />
        ))}
      </section>

    </div>
  );
}
