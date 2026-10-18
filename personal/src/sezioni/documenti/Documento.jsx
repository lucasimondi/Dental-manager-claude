// Documenti — scheda di un documento: anteprima del file, azioni, catalogo, pagamenti collegati.
import { useCallback, useEffect, useRef, useState } from 'react';
import { archivioDb } from '../../lib/supabasePersonal.js';
import { eliminaDocumento, documentoCompleto, impostaPortafoglio, eCaricato, nelPortafoglio, aggiornaDocumento, cestinaSuDrive } from '../../lib/archivio.js';
import { euro } from '../../lib/coreArchivio.js';
import { preparaFile } from '../../lib/condividi.js';
import { colore, dataBreve, titoloDoc, tokenSessione, Vuoto, Sezione, Gruppo, RigaPagamento, ConfermaElimina, BottoneCondividi } from '../../ui.jsx';
import { IconaPratiche, IconaFreccia, IconaApri, IconaEmail, IconaStella, IconaCestino, IconaChat } from '../../Icone.jsx';

/* ---------- anteprima del file ---------- */
const tipoAnteprima = (doc) => {
  const nome = `${doc?.nome_file_originale || ''}`.toLowerCase();
  const mime = `${doc?.mime_type || ''}`.toLowerCase();
  if (mime === 'application/pdf' || nome.endsWith('.pdf')) return 'pdf';
  if (/^image\/(jpeg|pjpeg|png|gif|webp)$/.test(mime) || /\.(jpe?g|png|gif|webp)$/.test(nome)) return 'immagine';
  return null;
};

async function disegnaPdf(base64, contenitore) {
  const [pdfjs, worker] = await Promise.all([
    import('pdfjs-dist/legacy/build/pdf.js'),
    import('pdfjs-dist/legacy/build/pdf.worker.min.js?url'),
  ]);
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
  const byte = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
  const pdf = await pdfjs.getDocument({ data: byte }).promise;
  const larghezza = contenitore.clientWidth || 340;
  const scalaSchermo = Math.min(window.devicePixelRatio || 1, 2);
  contenitore.innerHTML = '';
  for (let n = 1; n <= Math.min(pdf.numPages, 8); n += 1) {
    const pagina = await pdf.getPage(n);
    const base = pagina.getViewport({ scale: 1 });
    const vista = pagina.getViewport({ scale: (larghezza / base.width) * scalaSchermo });
    const canvas = document.createElement('canvas');
    canvas.width = vista.width; canvas.height = vista.height;
    canvas.style.width = '100%';
    contenitore.appendChild(canvas);
    await pagina.render({ canvasContext: canvas.getContext('2d'), viewport: vista }).promise;
  }
  return pdf.numPages;
}

export function Anteprima({ doc }) {
  const tipo = tipoAnteprima(doc);
  const [stato, setStato] = useState({ fase: 'carico' });
  const pagine = useRef(null);
  useEffect(() => {
    if (!tipo || !doc.drive_file_id) return undefined;
    let vivo = true;
    (async () => {
      try {
        const file = await preparaFile(doc.drive_file_id, await tokenSessione());
        if (!vivo) return;
        if (tipo === 'immagine') { setStato({ fase: 'immagine', src: `data:${file.mime};base64,${file.dati}` }); return; }
        setStato({ fase: 'pdf' });
        const n = await disegnaPdf(file.dati, pagine.current);
        if (vivo) setStato({ fase: 'pdf', pagine: n });
      } catch (e) {
        if (vivo) setStato({ fase: 'errore', testo: e.message });
      }
    })();
    return () => { vivo = false; };
  }, [tipo, doc.drive_file_id]);
  if (!tipo || !doc.drive_file_id) return null;
  return (
    <div className="pp-anteprima">
      {stato.fase === 'carico' && <div className="pp-anteprima-attesa"><span className="pp-rotella" />Carico l'anteprima…</div>}
      {stato.fase === 'errore' && <div className="pp-anteprima-attesa">{stato.testo} Usa "Apri il file".</div>}
      {stato.fase === 'immagine' && <img src={stato.src} alt={titoloDoc(doc)} />}
      <div ref={pagine} className="pp-anteprima-pdf" hidden={stato.fase !== 'pdf'} />
      {stato.fase === 'pdf' && stato.pagine > 8 && <p className="pp-riga-meta">Anteprima delle prime 8 pagine su {stato.pagine}. Apri il file per vederlo tutto.</p>}
    </div>
  );
}

/* ---------- pagine ---------- */
export function PaginaDocumento({ id, ctx, chiudi }) {
  const { esegui, aggiorna, mostra, apri, pagato, impostazioni, fascicoli } = ctx;
  const [doc, setDoc] = useState(null);
  const [conferma, setConferma] = useState(false);
  const carica = useCallback(() => esegui(async () => setDoc(await documentoCompleto(archivioDb, id))), [esegui, id]);
  useEffect(() => { carica(); }, [carica]);
  if (!doc) return <Vuoto>Carico…</Vuoto>;

  const dati = Object.entries(doc.dati_estratti || {}).filter(([, v]) => v !== null && v !== '' && typeof v !== 'object');
  const portafoglio = nelPortafoglio(doc);
  const cambia = (fn, messaggio) => esegui(async () => { await fn(); await carica(); aggiorna(); if (messaggio) mostra(messaggio); });
  const persone = [...new Set([...impostazioni.persone, ...(doc.persona ? [doc.persona] : [])])];
  const categorie = impostazioni.categorie.some((c) => c.id === doc.categoria) || !doc.categoria ? impostazioni.categorie : [...impostazioni.categorie, { id: doc.categoria, nome: doc.categoria }];

  return (
    <>
      <Anteprima doc={doc} />
      <div className="pp-dettaglio-testa" style={{ '--c': colore(doc.fascicolo) }}>
        <span className="pp-etichetta">{doc.tipo_documento || fascicoli.find((f) => f.codice === doc.fascicolo)?.nome || doc.fascicolo}</span>
        <h2>{titoloDoc(doc)}</h2>
        <p className="pp-riga-meta">{[dataBreve(doc.data_documento || doc.email_data), doc.importo != null ? euro(doc.importo) : null, doc.persona].filter(Boolean).join(' · ')}</p>
      </div>
      <div className="pp-azioni">
        {doc.drive_url && <a className="pp-bottone" href={doc.drive_url} target="_blank" rel="noreferrer"><IconaApri size={18} /> Apri il file</a>}
        {(doc.drive_file_id || doc.drive_url) && <BottoneCondividi doc={doc} mostra={mostra} />}
        {!eCaricato(doc) && doc.gmail_message_id && <a className="pp-bottone pp-bottone-chiaro" href={`https://mail.google.com/mail/u/0/#all/${doc.gmail_message_id}`} target="_blank" rel="noreferrer"><IconaEmail size={18} /> Email</a>}
        <button className={`pp-bottone pp-bottone-chiaro${portafoglio ? ' pp-attivo' : ''}`} onClick={() => cambia(() => impostaPortafoglio(archivioDb, doc, !portafoglio), portafoglio ? 'Tolto dai Personali' : 'Aggiunto ai Personali')}>
          <IconaStella size={18} piena={portafoglio} /> {portafoglio ? 'Nei Personali' : 'Tieni a portata di mano'}
        </button>
      </div>
      {doc.fascicolo !== 'clinico_pazienti' && (
        <button className="pp-chiedi-doc" onClick={() => ctx.apriChat({ id: doc.id, titolo: titoloDoc(doc) })}>
          <IconaChat size={18} /> Chiedi a Poliedron su questo documento
        </button>
      )}
      {doc.fascicolo === 'clinico_pazienti' && <p className="pp-avviso">Documento di un paziente: archiviato senza leggerne il contenuto.</p>}
      {doc.azione_richiesta && <p className={`pp-avviso pp-avviso-${doc.urgenza || 'media'}`}><strong>Da fare:</strong> {doc.azione_descrizione || 'azione richiesta'}</p>}
      {doc.riassunto && <p className="pp-paragrafo">{doc.riassunto}</p>}
      {doc.scadenze?.length > 0 && (
        <Sezione titolo="Pagamenti e scadenze">
          <Gruppo>{doc.scadenze.map((s) => <RigaPagamento key={s.id} s={{ ...s, documento: { id: doc.id, titolo: doc.titolo } }} onApri={(x) => apri({ tipo: 'pagamento', s: x })} onPagato={async (x) => { await pagato(x); carica(); }} />)}</Gruppo>
        </Sezione>
      )}
      {doc.pratica && (
        <Sezione titolo="Pratica">
          <Gruppo>
            <button className="pp-riga" onClick={() => apri({ tipo: 'pratica', p: { ...doc.pratica, fascicolo: doc.fascicolo } })}>
              <span className="pp-riga-icona" style={{ '--c': colore(doc.fascicolo) }}><IconaPratiche size={18} /></span>
              <span className="pp-riga-testo"><span className="pp-riga-titolo">{doc.pratica.titolo}</span><span className="pp-riga-meta">{doc.pratica.stato}</span></span>
              <IconaFreccia size={16} />
            </button>
          </Gruppo>
        </Sezione>
      )}
      <Sezione titolo="Catalogo">
        <div className="pp-campi">
          <label className="pp-campo-riga"><span>Titolo</span>
            <input className="pp-campo-testo" defaultValue={doc.titolo || ''} onBlur={(e) => e.target.value.trim() && e.target.value.trim() !== doc.titolo && cambia(() => aggiornaDocumento(archivioDb, doc.id, { titolo: e.target.value }), 'Titolo salvato')} />
          </label>
          <label className="pp-campo-riga"><span>Ente</span>
            <input className="pp-campo-testo" defaultValue={doc.ente || ''} placeholder="Es. Enel Energia" onBlur={(e) => e.target.value.trim() !== (doc.ente || '') && cambia(() => aggiornaDocumento(archivioDb, doc.id, { ente: e.target.value }), 'Ente salvato')} />
          </label>
          <label className="pp-campo-riga"><span>Importanza</span>
            <select className="pp-select" value={doc.rilevanza || 'normale'} onChange={(e) => cambia(() => aggiornaDocumento(archivioDb, doc.id, { rilevanza: e.target.value }), 'Salvato')}>
              <option value="alta">Importante</option>
              <option value="normale">Normale</option>
              <option value="bassa">Poco utile (nascosto)</option>
            </select>
          </label>
          <label className="pp-campo-riga"><span>Persona</span>
            <select className="pp-select" value={doc.persona || ''} onChange={(e) => cambia(() => aggiornaDocumento(archivioDb, doc.id, { persona: e.target.value }), 'Salvato')}>
              <option value="">Nessuna</option>
              {persone.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </label>
          <label className="pp-campo-riga"><span>Doc. personale</span>
            <select className="pp-select" value={doc.categoria || ''} onChange={(e) => cambia(() => aggiornaDocumento(archivioDb, doc.id, { categoria: e.target.value }), 'Salvato')}>
              <option value="">Nessuno</option>
              {categorie.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
            </select>
          </label>
          <label className="pp-campo-riga"><span>Fascicolo</span>
            <select className="pp-select" value={doc.fascicolo} onChange={(e) => cambia(() => aggiornaDocumento(archivioDb, doc.id, { fascicolo: e.target.value }), 'Spostato')}>
              {fascicoli.map((f) => <option key={f.codice} value={f.codice}>{f.nome}</option>)}
            </select>
          </label>
        </div>
      </Sezione>
      {dati.length > 0 && (
        <Sezione titolo="Dati">
          <dl className="pp-dati">{dati.map(([k, v]) => <div key={k}><dt>{k.replace(/_/g, ' ')}</dt><dd>{String(v)}</dd></div>)}</dl>
        </Sezione>
      )}
      <p className="pp-riga-meta pp-origine">{eCaricato(doc) ? `Caricato da te il ${dataBreve(doc.creato_il)}` : `Da: ${doc.email_mittente || '—'} · ${doc.email_oggetto || ''}`}</p>
      <div className="pp-elimina">
        {!conferma
          ? <button className="pp-testo-link pp-rosso" onClick={() => setConferma(true)}><IconaCestino size={16} /> Elimina dall'archivio</button>
          : <ConfermaElimina n={1} onNo={() => setConferma(false)}
            onSi={(ancheDrive) => esegui(async () => {
              const r = ancheDrive ? await cestinaSuDrive({ token: await tokenSessione(), ids: [doc.drive_file_id] }) : null;
              await eliminaDocumento(archivioDb, doc.id); aggiorna();
              mostra(r?.cestinati.length ? 'Eliminato; il file è nel Cestino di Drive' : 'Eliminato dall\'archivio'); chiudi();
            })} />}
      </div>
    </>
  );
}
