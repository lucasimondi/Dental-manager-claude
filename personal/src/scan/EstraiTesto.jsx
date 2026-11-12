// SCAN-HUB (PO 2026-11-12) — «Estrai testo»: foto o PDF → testo modificabile da copiare,
// condividere o salvare come .txt. Riconoscimento sul telefono (Tesseract italiano, lo stesso di
// «Testo (OCR)»): il documento non lascia il dispositivo e nessun modello esterno lo legge.
import { useRef, useState } from 'react';
import { elaboraPagina } from '../lib/scansione.js';
import { tipoFile } from '../lib/pdfUnico.js';
import { validaFile } from '../pdf/filePdf.js';
import { scaricaDocumento } from '../lib/condividi.js';
import { daScannerNativo } from '../lib/nativo.js';
import { IconaFotocamera, IconaFoto, IconaFile, IconaCondividi } from '../Icone.jsx';

export const MAX_FOTO_TESTO = 10;

export function EstraiTesto({ ctx }) {
  const { mostra } = ctx;
  const [testo, setTesto] = useState('');
  const [nome, setNome] = useState('');
  const [lavoro, setLavoro] = useState(null);
  const [avviso, setAvviso] = useState('');
  const scatto = useRef(null), galleria = useRef(null), pdf = useRef(null);

  const leggi = async (files) => {
    const elenco = [...(files || [])];
    if (!elenco.length || lavoro) return;
    setLavoro('Preparo…'); setAvviso('');
    try {
      elenco.forEach(validaFile);
      const { testoDaImmagini, testoDaPdf } = await import('../pdf/ocr.js');
      const avanza = (m) => setLavoro(m);
      let parti = [];
      if (elenco.length === 1 && tipoFile(elenco[0]) === 'pdf') {
        const r = await testoDaPdf(elenco[0], { onAvanzamento: avanza });
        parti = r.parti;
        if (r.oltre) setAvviso('Letto solo fino alla pagina 30.');
      } else {
        const foto = elenco.filter((f) => tipoFile(f) === 'immagine');
        if (foto.length !== elenco.length) throw new Error('Scegli solo foto, oppure un PDF alla volta.');
        if (foto.length > MAX_FOTO_TESTO) throw new Error(`Al massimo ${MAX_FOTO_TESTO} foto alla volta.`);
        const immagini = [];
        for (const f of foto) { avanza('Raddrizzo la foto…'); immagini.push((await elaboraPagina(f, { modo: 'documento', angoli: daScannerNativo(f) ? null : 'auto' })).url); }
        parti = await testoDaImmagini(immagini, { onAvanzamento: avanza });
      }
      const unito = parti.map((p) => p.trim()).filter(Boolean).join('\n\n— — —\n\n');
      if (!unito) throw new Error('Nessun testo riconosciuto. Prova una foto più nitida, dritta e ben illuminata.');
      setTesto((t) => (t ? `${t}\n\n${unito}` : unito));
      if (!nome) setNome(elenco[0].name.replace(/\.[^.]+$/, '').slice(0, 60) || 'Testo');
    } catch (e) { mostra(e.message || 'Testo non letto.'); }
    finally { setLavoro(null); }
  };
  const fileTxt = () => new File([testo], `${(nome || 'Testo').replace(/[^\w\- ]+/g, '').trim() || 'Testo'}.txt`, { type: 'text/plain' });
  const copia = async () => {
    try { await navigator.clipboard.writeText(testo); mostra('Testo copiato.'); } catch { mostra('Copia non riuscita: seleziona il testo e copialo a mano.'); }
  };
  const condividiTesto = async () => {
    try {
      if (navigator.share) { await navigator.share({ title: nome || 'Testo', text: testo }); return; }
      await copia();
    } catch (e) { if (e?.name !== 'AbortError') mostra(e.message); }
  };

  return (
    <div className="scan-testo">
      <input ref={scatto} type="file" accept="image/*" capture="environment" hidden onChange={(e) => { leggi(e.target.files); e.target.value = ''; }} />
      <input ref={galleria} type="file" accept="image/*,.heic,.heif" multiple hidden onChange={(e) => { leggi(e.target.files); e.target.value = ''; }} />
      <input ref={pdf} type="file" accept="application/pdf" hidden onChange={(e) => { leggi(e.target.files); e.target.value = ''; }} />
      <fieldset className="scan-controls" disabled={!!lavoro}>
        <div className="pp-sorgenti-rapide">
          <button className="pp-bottone" onClick={() => scatto.current.click()}><IconaFotocamera size={20} /> Scatta</button>
          <button className="pp-bottone pp-bottone-chiaro" onClick={() => galleria.current.click()}><IconaFoto size={20} /> Foto</button>
          <button className="pp-bottone pp-bottone-chiaro" onClick={() => pdf.current.click()}><IconaFile size={20} /> PDF</button>
        </div>
      </fieldset>
      {!testo && !lavoro && <p className="pp-riga-meta pp-spiegazione">Fotografa un foglio o scegli un PDF: il testo viene letto sul telefono (italiano) e puoi correggerlo, copiarlo o condividerlo. La prima volta scarica il riconoscimento (circa 5 MB).</p>}
      {lavoro && <p className="pp-riga-meta" role="status"><span className="pp-rotella" /> {lavoro}</p>}
      {avviso && <p className="pp-riga-meta">{avviso}</p>}
      {testo && (
        <>
          <label className="pp-campo"><span>Testo riconosciuto (puoi correggerlo)</span>
            <textarea className="scan-testo-area" value={testo} onChange={(e) => setTesto(e.target.value)} rows={14} spellCheck />
          </label>
          <p className="pp-riga-meta">{testo.trim().split(/\s+/).filter(Boolean).length} parole · controlla nomi e numeri prima di usarlo.</p>
          <div className="scan-output-actions">
            <button className="pp-bottone" onClick={copia}>Copia il testo</button>
            <button className="pp-bottone pp-bottone-chiaro" onClick={condividiTesto}><IconaCondividi size={18} /> Condividi</button>
            <button className="pp-bottone pp-bottone-chiaro" onClick={() => { const f = fileTxt(); scaricaDocumento(f); ctx.ricorda?.([f]); }}>Salva come .txt</button>
            <button className="pp-testo-link" onClick={() => { setTesto(''); setNome(''); }}>Ricomincia</button>
          </div>
        </>
      )}
    </div>
  );
}
