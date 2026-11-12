// SCAN-HUB (PO 2026-11-12: «Questo è un software di scansione e gestione PDF che va bene, riesci a
// crearlo così? Modificando Scan?») — la Home di Scan: scanner in evidenza, strumenti a griglia,
// «Da album» / «Da file», i Recenti di questo telefono e il tasto fotocamera sempre in basso.
// Ogni strumento apre una pagina sopra la Home; chiudendola si torna qui.
import { useCallback, useEffect, useRef, useState } from 'react';
import { elencoRecenti, fileRecente, formatoPeso, gruppoData, svuotaRecenti, togliRecenti } from '../lib/recenti.js';
import { condividi, scaricaDocumento } from '../lib/condividi.js';
import {
  IconaScansiona, IconaFile, IconaTessera, IconaTesto, IconaFotocamera, IconaFoto, IconaDocumenti,
  IconaPortafoglio, IconaCondividi, IconaCestino, IconaGraffetta,
} from '../Icone.jsx';

export const STRUMENTI_SCAN = [
  ['testo', 'Estrai testo', IconaTesto],
  ['tessera', "Carta d'identità", IconaTessera],
  ['firma', 'Firma PDF', IconaFile],
  ['unisci', 'Unisci in un PDF', IconaGraffetta],
  ['comprimi', 'Comprimi PDF', IconaFile],
  ['pagine', 'Pagine PDF', IconaFile],
  ['archivio', 'Archivio', IconaDocumenti],
  ['personali', 'Documenti personali', IconaPortafoglio],
];

export function ScanHome({ ctx, versioneRecenti, onStrumento, onFiles, coperta = false }) {
  const { mostra } = ctx;
  const [recenti, setRecenti] = useState(null);
  const [menu, setMenu] = useState(null); // id del file con le azioni aperte
  const [svuota, setSvuota] = useState(false);
  const album = useRef(null), daFile = useRef(null), camera = useRef(null);

  const carica = useCallback(() => { elencoRecenti().then(setRecenti).catch(() => setRecenti([])); }, []);
  useEffect(carica, [carica, versioneRecenti]);

  const apriRecente = async (r) => {
    try {
      const file = await fileRecente(r.id);
      if (/pdf$/i.test(r.tipo) || /\.pdf$/i.test(r.nome)) ctx.apri({ tipo: 'pdf', file });
      else scaricaDocumento(file);
    } catch (e) { mostra(e.message); carica(); }
  };
  const condividiRecente = async (r) => {
    try {
      const file = await fileRecente(r.id);
      const esito = await condividi({ titolo: r.nome.replace(/\.[^.]+$/, ''), file });
      if (esito === 'non_disponibile' || esito === 'link') { scaricaDocumento(file); mostra('Condivisione file non disponibile: file scaricato.'); }
    } catch (e) { mostra(e.message); }
  };
  const gruppi = [];
  for (const r of recenti || []) {
    const g = gruppoData(r.data);
    if (gruppi.at(-1)?.[0] !== g) gruppi.push([g, []]);
    gruppi.at(-1)[1].push(r);
  }

  return (
    <div className="scan-home">
      <input ref={camera} type="file" accept="image/*" capture="environment" hidden onChange={(e) => { onFiles([...e.target.files]); e.target.value = ''; }} />
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

      <div className="scan-griglia" role="group" aria-label="Strumenti">
        {STRUMENTI_SCAN.map(([id, nome, Icona]) => (
          <button key={id} className={`scan-strumento scan-strumento-${id}`} onClick={() => onStrumento(id)}>
            <span className="scan-strumento-icona"><Icona size={24} /></span><span>{nome}</span>
          </button>
        ))}
      </div>

      <div className="scan-sorgenti">
        <button onClick={() => album.current.click()}><IconaFoto size={20} /> Da album</button>
        <button onClick={() => daFile.current.click()}><IconaFile size={20} /> Da file</button>
      </div>

      <section className="scan-recenti" aria-label="Recenti">
        <div className="scan-recenti-testa"><h2>Recenti</h2>{recenti?.length > 0 && <button className="pp-testo-link" onClick={() => setSvuota(true)}>Svuota</button>}</div>
        {recenti && !recenti.length && (
          <div className="scan-recenti-vuoto">
            <strong>Inizia la tua prima scansione</strong>
            <p>I PDF che crei, condividi o scarichi da Scan restano qui, solo su questo telefono, per riaprirli o rimandarli.</p>
          </div>
        )}
        {svuota && (
          <div className="scan-conferma" role="alertdialog" aria-label="Svuota recenti">
            <p>Togliere tutti i file dall'elenco Recenti di questo telefono? L'archivio e i file già condivisi o scaricati non cambiano.</p>
            <div><button className="pp-bottone pp-bottone-chiaro" onClick={() => setSvuota(false)}>Annulla</button>
              <button className="pp-bottone" onClick={async () => { setSvuota(false); try { await svuotaRecenti(); } catch (e) { mostra(e.message); } carica(); }}>Svuota</button></div>
          </div>
        )}
        {gruppi.map(([g, righe]) => (
          <div key={g} className="scan-recenti-gruppo">
            <h3>{g}</h3>
            {righe.map((r) => (
              <div key={r.id} className="scan-recente">
                <button className="scan-recente-apri" onClick={() => apriRecente(r)}>
                  <span className={`scan-recente-tipo${/pdf$/i.test(r.tipo) ? ' pdf' : ''}`} aria-hidden="true">{/pdf$/i.test(r.tipo) ? 'PDF' : 'TXT'}</span>
                  <span className="scan-recente-testo"><strong>{r.nome.replace(/\.[^.]+$/, '')}</strong>
                    <small>{new Date(r.data).toLocaleString('it-IT', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })} · {formatoPeso(r.dimensione)}</small></span>
                </button>
                <button className="scan-recente-azione" aria-label={`Condividi ${r.nome}`} onClick={() => condividiRecente(r)}><IconaCondividi size={20} /></button>
                <button className="scan-recente-azione" aria-label={`Altre azioni per ${r.nome}`} aria-expanded={menu === r.id} onClick={() => setMenu(menu === r.id ? null : r.id)}>⋮</button>
                {menu === r.id && (
                  <div className="scan-recente-menu">
                    <button onClick={async () => { setMenu(null); try { scaricaDocumento(await fileRecente(r.id)); } catch (e) { mostra(e.message); } }}>Scarica</button>
                    {/pdf$/i.test(r.tipo) && <button onClick={async () => { setMenu(null); try { ctx.apri({ tipo: 'carica', file: await fileRecente(r.id), opzioni: { descrizione: r.nome.replace(/\.pdf$/i, ''), scelto: true, soloArchiviazione: true, nonAnalizzare: true, destinazione: true } }); } catch (e) { mostra(e.message); } }}>Archivia</button>}
                    <button onClick={async () => { setMenu(null); try { await togliRecenti([r.id]); } catch (e) { mostra(e.message); } carica(); }}><IconaCestino size={16} /> Togli dai recenti</button>
                  </div>
                )}
              </div>
            ))}
          </div>
        ))}
      </section>

      {!coperta && <button className="scan-fab" aria-label="Scatta e scansiona" onClick={() => camera.current.click()}><IconaFotocamera size={28} /></button>}
    </div>
  );
}
