// SCAN-TRADUCI (PO 2026-11-12, passo 4) — traduzione di foto, PDF o testo con Google ML Kit sul
// telefono (app Poliedra Scan): il testo non va a nessun server; la prima volta per ogni lingua
// Google scarica il modello (~30 MB). Nel browser la traduzione non c'è (nessun servizio esterno).
import { useEffect, useRef, useState } from 'react';
import { inAppAndroid, traduciNativo, daScannerNativo } from '../lib/nativo.js';
import { tipoFile } from '../lib/pdfUnico.js';
import { elaboraPagina } from '../lib/scansione.js';
import { validaFile } from '../pdf/filePdf.js';
import { LINGUE, leggiImpostazione, salvaImpostazione, nomeLingua } from './impostazioniScan.js';
import { IconaFotocamera, IconaFoto, IconaFile, IconaCondividi } from '../Icone.jsx';

export function Traduci({ ctx, testoIniziale = '', fileIniziale = null }) {
  const { mostra } = ctx;
  const app = inAppAndroid();
  const [testo, setTesto] = useState(testoIniziale);
  const [tradotto, setTradotto] = useState('');
  const [da, setDa] = useState('auto');
  const [a, setA] = useState(() => leggiImpostazione('scan-lingua'));
  const [rilevata, setRilevata] = useState(null);
  const [lavoro, setLavoro] = useState(null);
  const avviato = useRef(false);
  const scatto = useRef(null), galleria = useRef(null), pdf = useRef(null);

  const leggi = async (files) => {
    const elenco = [...(files || [])];
    if (!elenco.length || lavoro) return;
    setLavoro('Leggo il testo…');
    try {
      elenco.forEach(validaFile);
      const { testoDaImmagini, testoDaPdf } = await import('../pdf/ocr.js');
      let parti;
      if (tipoFile(elenco[0]) === 'pdf') parti = (await testoDaPdf(elenco[0], { onAvanzamento: setLavoro })).parti;
      else {
        const immagini = [];
        for (const f of elenco) immagini.push((await elaboraPagina(f, { modo: 'documento', angoli: daScannerNativo(f) ? null : 'auto' })).url);
        parti = await testoDaImmagini(immagini, { onAvanzamento: setLavoro });
      }
      const t = parti.map((p) => p.trim()).filter(Boolean).join('\n\n');
      if (!t) throw new Error('Nessun testo riconosciuto.');
      setTesto(t); setTradotto('');
    } catch (e) { mostra(e.message); } finally { setLavoro(null); }
  };
  useEffect(() => { if (fileIniziale && !avviato.current) { avviato.current = true; leggi([fileIniziale]); } }, [fileIniziale]); // eslint-disable-line react-hooks/exhaustive-deps

  const traduci = async () => {
    setLavoro(`Traduco in ${nomeLingua(a)}… (la prima volta scarica la lingua)`);
    try { const r = await traduciNativo(testo, { da, a }); setTradotto(r.testo); setRilevata(r.da); }
    catch (e) { mostra(e.message); } finally { setLavoro(null); }
  };
  const scegliA = (v) => { setA(v); salvaImpostazione('scan-lingua', v); setTradotto(''); };
  const nomeFile = () => `Traduzione ${nomeLingua(a)} ${new Date().toLocaleDateString('it-IT').replace(/\//g, '-')}`;
  const salvaTxt = () => { const f = new File([tradotto], `${nomeFile()}.txt`, { type: 'text/plain' }); ctx.ricorda?.([f]); mostra(`Salvato «${f.name}» in I miei documenti.`); };
  const salvaWord = async () => {
    try { const { wordDa } = await import('./esporta.js'); const [f] = await wordDa(new File([tradotto], `${nomeFile()}.txt`, { type: 'text/plain' })); ctx.ricorda?.([f]); mostra(`Salvato «${f.name}» in I miei documenti.`); }
    catch (e) { mostra(e.message); }
  };
  const condividiTesto = async () => {
    try { if (navigator.share) await navigator.share({ title: nomeFile(), text: tradotto }); else { await navigator.clipboard.writeText(tradotto); mostra('Copiato.'); } }
    catch (e) { if (e?.name !== 'AbortError') mostra(e.message); }
  };

  return (
    <div className="scan-testo scan-traduci">
      <input ref={scatto} type="file" accept="image/*" capture="environment" hidden onChange={(e) => { leggi(e.target.files); e.target.value = ''; }} />
      <input ref={galleria} type="file" accept="image/*,.heic,.heif" multiple hidden onChange={(e) => { leggi(e.target.files); e.target.value = ''; }} />
      <input ref={pdf} type="file" accept="application/pdf" hidden onChange={(e) => { leggi(e.target.files); e.target.value = ''; }} />
      {!app && <p className="pp-messaggio">La traduzione funziona nell'app <strong>Poliedra Scan</strong> per Android: avviene sul telefono con Google ML Kit, il testo non va a nessun server.</p>}
      <fieldset className="scan-controls" disabled={!!lavoro}>
        <div className="pp-sorgenti-rapide">
          <button className="pp-bottone" onClick={() => scatto.current.click()}><IconaFotocamera size={20} /> Scatta</button>
          <button className="pp-bottone pp-bottone-chiaro" onClick={() => galleria.current.click()}><IconaFoto size={20} /> Foto</button>
          <button className="pp-bottone pp-bottone-chiaro" onClick={() => pdf.current.click()}><IconaFile size={20} /> PDF</button>
        </div>
        <div className="scan-lingue">
          <label><span>Da</span><select aria-label="Lingua del testo" value={da} onChange={(e) => { setDa(e.target.value); setTradotto(''); }}>
            <option value="auto">Rileva da sola</option>{LINGUE.map(([c, n]) => <option key={c} value={c}>{n}</option>)}</select></label>
          <span aria-hidden="true">→</span>
          <label><span>A</span><select aria-label="Lingua di arrivo" value={a} onChange={(e) => scegliA(e.target.value)}>{LINGUE.map(([c, n]) => <option key={c} value={c}>{n}</option>)}</select></label>
        </div>
        <label className="pp-campo"><span>Testo da tradurre</span>
          <textarea className="scan-testo-area scan-testo-breve" value={testo} onChange={(e) => { setTesto(e.target.value); setTradotto(''); }} placeholder="Scrivi o incolla, oppure fotografa un foglio" rows={6} />
        </label>
        <button className="pp-bottone pp-bottone-largo" disabled={!app || !testo.trim()} onClick={traduci}>Traduci in {nomeLingua(a)}</button>
      </fieldset>
      {lavoro && <p className="pp-riga-meta" role="status"><span className="pp-rotella" /> {lavoro}</p>}
      {tradotto && (
        <>
          <label className="pp-campo"><span>Traduzione{rilevata && da === 'auto' ? ` (da ${nomeLingua(rilevata)})` : ''}</span>
            <textarea className="scan-testo-area" value={tradotto} onChange={(e) => setTradotto(e.target.value)} rows={10} />
          </label>
          <p className="pp-riga-meta">Traduzione automatica: controlla nomi, numeri e termini medici prima di usarla.</p>
          <div className="scan-output-actions">
            <button className="pp-bottone" onClick={async () => { try { await navigator.clipboard.writeText(tradotto); mostra('Traduzione copiata.'); } catch { mostra('Copia non riuscita.'); } }}>Copia</button>
            <button className="pp-bottone pp-bottone-chiaro" onClick={condividiTesto}><IconaCondividi size={18} /> Condividi</button>
            <button className="pp-bottone pp-bottone-chiaro" onClick={salvaWord}>Salva in Word</button>
            <button className="pp-bottone pp-bottone-chiaro" onClick={salvaTxt}>Salva come .txt</button>
          </div>
        </>
      )}
    </div>
  );
}
