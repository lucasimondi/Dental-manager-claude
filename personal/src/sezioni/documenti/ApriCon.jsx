// APRI-CON (PO 2026-11-17): "quando si clicca su un documento da anteprima devono esserci i tasti apri in
// gestore PDF (quello di poliedron) e poi apri in drive o altri (da scegliere)".
// Tre scelte: Gestore PDF di Poliedron (o tutto schermo per le immagini), Drive, e «Apri con…» che passa il
// file al telefono: compare l'elenco delle app (Adobe, Drive, Files…); dove non c'è, il file si scarica.
import { useState } from 'react';
import { preparaFile, comeFile, condividi, scaricaDocumento } from '../../lib/condividi.js';
import { titoloDoc, tokenSessione } from '../../ui.jsx';
import { IconaApri, IconaFile } from '../../Icone.jsx';

export function ApriCon({ doc, pdf, onApri, mostra }) {
  const [stato, setStato] = useState('');
  const conAltre = async () => {
    setStato('Preparo il file…');
    try {
      const file = comeFile(await preparaFile(doc.drive_file_id, await tokenSessione()));
      const r = await condividi({ titolo: titoloDoc(doc), file });
      if (r !== 'file' && r !== 'annullato') { scaricaDocumento(file); mostra?.('File scaricato: aprilo dai download con l’app che preferisci'); }
    } catch (e) { mostra?.(`Non riuscito: ${e.message}`); }
    setStato('');
  };
  return (
    <div className="pp-apri-con" role="group" aria-label="Apri il documento">
      <button type="button" className="pp-bottone pp-apri-principale" onClick={onApri}><IconaFile size={18} /> {pdf ? 'Apri nel Gestore PDF' : 'Apri a tutto schermo'}</button>
      <div className="pp-apri-altri">
        {doc.drive_url && <a className="pp-bottone pp-bottone-chiaro" href={doc.drive_url} target="_blank" rel="noreferrer"><IconaApri size={18} /> Apri in Drive</a>}
        <button type="button" className="pp-bottone pp-bottone-chiaro" disabled={!!stato} onClick={conAltre}>{stato || 'Apri con altre app…'}</button>
      </div>
    </div>
  );
}
