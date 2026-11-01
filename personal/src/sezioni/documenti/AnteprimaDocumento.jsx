import {useEffect,useRef,useState} from 'react';
import {preparaFile} from '../../lib/condividi.js';
import {tokenSessione,titoloDoc} from '../../ui.jsx';

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

