// MIA-SALUTE (PO 2026-11-10) — foto di un documento: ritaglia, ruota, migliora la leggibilità e
// converti in PDF. Il risultato si invia (Mail / WhatsApp) o si archivia come copia: l'originale
// resta com'è, su Drive e in archivio.
import { useEffect, useState } from 'react';
import { archivioDb } from '../../lib/supabasePersonal.js';
import { documentoCompleto } from '../../lib/archivio.js';
import { preparaFile, comeFile, inviaCon } from '../../lib/condividi.js';
import { elaboraPagina, creaPdf } from '../../lib/scansione.js';
import { nomePdf } from '../../lib/pdfUnico.js';
import { eMiaSalute, io } from '../../lib/salute.js';
import { Segmenti, Vuoto, titoloDoc, tokenSessione } from '../../ui.jsx';
import { Ritaglio } from '../../Ritaglio.jsx';
import { IconaRuota, IconaTaglia, IconaEmail, IconaChat } from '../../Icone.jsx';

const daDataUrl = async (url, nome) => new File([await (await fetch(url)).blob()], nome, { type: 'image/jpeg' });

export function PaginaModificaImmagine({ id, pdf: inPdf = true, ctx, sostituisci }) {
  const { esegui, mostra, impostazioni } = ctx;
  const [doc, setDoc] = useState(null);
  const [file, setFile] = useState(null);
  const [errore, setErrore] = useState('');
  const [rotazione, setRotazione] = useState(0);
  const [modo, setModo] = useState('originale');
  const [ritaglio, setRitaglio] = useState(null);
  const [taglia, setTaglia] = useState(null);
  const [formato, setFormato] = useState(inPdf ? 'pdf' : 'immagine');
  const [risultato, setRisultato] = useState(null); // { url, file }

  useEffect(() => { esegui(async () => setDoc(await documentoCompleto(archivioDb, id))); }, [esegui, id]);
  useEffect(() => {
    if (!doc?.drive_file_id) return undefined;
    let vivo = true;
    (async () => { try { const f = comeFile(await preparaFile(doc.drive_file_id, await tokenSessione())); if (vivo) setFile(f); } catch (e) { if (vivo) setErrore(e.message); } })();
    return () => { vivo = false; };
  }, [doc?.drive_file_id]);
  // Ogni modifica rifà l'anteprima e il file pronto da inviare (iOS vuole il file prima del tocco).
  useEffect(() => {
    if (!file) return undefined;
    let vivo = true;
    setRisultato(null);
    (async () => {
      const pagina = await elaboraPagina(file, { modo, rotazione, ritaglio });
      const titolo = titoloDoc(doc);
      const pronto = formato === 'pdf' ? await creaPdf([pagina], titolo) : await daDataUrl(pagina.url, nomePdf(titolo).replace(/\.pdf$/, '.jpg'));
      if (vivo) setRisultato({ url: pagina.url, file: pronto });
    })().catch((e) => vivo && setErrore(`Immagine non leggibile: ${e.message}`));
    return () => { vivo = false; };
  }, [file, modo, rotazione, ritaglio, formato]); // eslint-disable-line react-hooks/exhaustive-deps

  if (errore) return <Vuoto>{errore}</Vuoto>;
  if (!doc || !file) return <Vuoto>Apro la foto…</Vuoto>;
  const apriRitaglio = async () => { const r = await elaboraPagina(file, { modo: 'originale', rotazione }); setTaglia(r.url); };
  const invia = async (canale) => {
    try { const r = await inviaCon(canale, { titolo: titoloDoc(doc), files: [risultato.file] }); if (r === 'non_disponibile') mostra('Invio non disponibile qui: archivia la copia e inviala da Drive'); } catch (e) { mostra(e.message); }
  };
  const archivia = () => sostituisci({ tipo: 'carica', file: risultato.file, opzioni: {
    soloArchiviazione: true, nonAnalizzare: true, descrizione: `${titoloDoc(doc)} (${formato === 'pdf' ? 'PDF' : 'ritagliata'})`,
    fascicolo: doc.fascicolo || '', persona: doc.persona || '', salute: eMiaSalute(doc, io(impostazioni)),
  } });
  return (
    <>
      {risultato ? <img className="pp-modifica-anteprima" src={risultato.url} alt="Anteprima" /> : <p className="pp-riga-meta"><span className="pp-rotella" /> Preparo l'anteprima…</p>}
      <div className="pp-modifica-strumenti">
        <button className="pp-bottone pp-bottone-chiaro" onClick={apriRitaglio}><IconaTaglia size={18} /> Ritaglia</button>
        <button className="pp-bottone pp-bottone-chiaro" onClick={() => { setRotazione((r) => (r + 90) % 360); setRitaglio(null); }}><IconaRuota size={18} /> Ruota</button>
      </div>
      <Segmenti voci={[['originale', 'Originale'], ['colore', 'Più nitida'], ['documento', 'Bianco e nero']]} attiva={modo} onScegli={setModo} />
      <Segmenti voci={[['pdf', 'PDF'], ['immagine', 'Foto JPG']]} attiva={formato} onScegli={setFormato} />
      <div className="pp-invio-salute">
        <button disabled={!risultato} onClick={() => invia('mail')}><IconaEmail size={18} /> Mail</button>
        <button className="pp-whatsapp" disabled={!risultato} onClick={() => invia('whatsapp')}><IconaChat size={18} /> WhatsApp</button>
      </div>
      <button className="pp-bottone pp-bottone-largo" disabled={!risultato} onClick={archivia}>Salva la copia {formato === 'pdf' ? 'in PDF ' : ''}nell'archivio</button>
      <p className="pp-riga-meta">L'originale non cambia: la copia si aggiunge accanto{eMiaSalute(doc, io(impostazioni)) ? ', anche in La mia salute' : ''}.</p>
      {taglia && <Ritaglio src={taglia} iniziale={ritaglio} onFatto={(r) => { setTaglia(null); setRitaglio(r); }} onAnnulla={() => setTaglia(null)} />}
    </>
  );
}
