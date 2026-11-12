// SCAN-ORGANIZZA (PO 2026-11-12) — strumento rapido «PDF in Word»: scegli un PDF (o una foto), diventa
// un .docx modificabile (testo dal PDF o dall'OCR sul telefono), salvato in «I miei documenti».
import { useRef, useState } from 'react';
import { validaFile } from '../pdf/filePdf.js';
import { condividi, scaricaDocumento } from '../lib/condividi.js';
import { IconaFile, IconaFoto } from '../Icone.jsx';

export function PdfInWord({ ctx }) {
  const [lavoro, setLavoro] = useState(null);
  const [fatto, setFatto] = useState(null);
  const scelta = useRef(null), foto = useRef(null);
  const converti = async (file) => {
    if (!file || lavoro) return;
    setLavoro('Leggo il documento…'); setFatto(null);
    try {
      validaFile(file);
      const { wordDa } = await import('./esporta.js');
      const files = await wordDa(file, { onAvanzamento: setLavoro });
      ctx.ricorda?.(files);
      setFatto(files[0]);
    } catch (e) { ctx.mostra(e.message); } finally { setLavoro(null); }
  };
  return (
    <div className="scan-testo">
      <input ref={scelta} type="file" accept="application/pdf" hidden onChange={(e) => { converti(e.target.files[0]); e.target.value = ''; }} />
      <input ref={foto} type="file" accept="image/*,.heic,.heif" hidden onChange={(e) => { converti(e.target.files[0]); e.target.value = ''; }} />
      <div className="pp-sorgenti-rapide">
        <button className="pp-bottone" disabled={!!lavoro} onClick={() => scelta.current.click()}><IconaFile size={20} /> Scegli un PDF</button>
        <button className="pp-bottone pp-bottone-chiaro" disabled={!!lavoro} onClick={() => foto.current.click()}><IconaFoto size={20} /> Da una foto</button>
      </div>
      <p className="pp-riga-meta pp-spiegazione">Il testo diventa un documento Word modificabile. Impaginazione e immagini non vengono copiate: controlla nomi e numeri.</p>
      {lavoro && <p className="pp-riga-meta" role="status"><span className="pp-rotella" /> {lavoro}</p>}
      {fatto && (
        <div className="scan-output-actions">
          <p className="pp-riga-meta">Creato «{fatto.name}», salvato in I miei documenti.</p>
          <button className="pp-bottone" onClick={async () => { const r = await condividi({ titolo: fatto.name, file: fatto }).catch(() => 'non_disponibile'); if (r === 'non_disponibile' || r === 'link') scaricaDocumento(fatto); }}>Condividi</button>
          <button className="pp-bottone pp-bottone-chiaro" onClick={() => scaricaDocumento(fatto)}>Salva sul telefono</button>
        </div>
      )}
    </div>
  );
}
