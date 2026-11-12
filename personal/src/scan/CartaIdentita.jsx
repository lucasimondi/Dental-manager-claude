// SCAN-HUB (PO 2026-11-12) — «Carta d'identità»: fronte e retro di una tessera fotografati,
// raddrizzati e messi su un solo foglio A4, come una fotocopia. Tutto sul telefono: il PDF si
// condivide, si scarica, si firma o si archivia (in «Documenti personali»), mai inviato da solo.
import { useEffect, useRef, useState } from 'react';
import { elaboraPagina, rilevaAngoli } from '../lib/scansione.js';
import { DIMENSIONI, daGirare, pdfFronteRetro, riquadriFacce, A4 } from '../lib/fronteRetro.js';
import { condividi, scaricaDocumento } from '../lib/condividi.js';
import { validaFile } from '../pdf/filePdf.js';
import { Segmenti } from '../ui.jsx';
import { Angoli } from '../Angoli.jsx';
import { IconaFotocamera, IconaFoto, IconaRuota, IconaTaglia, IconaCestino, IconaCondividi } from '../Icone.jsx';

export const TESSERE = [
  ['Identità', "Carta d'identità"],
  ['Patente', 'Patente di guida'],
  ['Sanitaria', 'Tessera sanitaria'],
  ['Altra', 'Tessera'],
];
const FACCE = [['fronte', 'Fronte'], ['retro', 'Retro']];

async function prepara(file, { modo, rotazione = 0, angoli = 'auto' }) {
  let r = await elaboraPagina(file, { modo, rotazione, angoli });
  // Tessera fotografata in verticale: si gira, così fronte e retro stanno orizzontali sul foglio.
  if (rotazione === 0 && angoli === 'auto' && daGirare(r.larghezza, r.altezza)) {
    rotazione = 90;
    r = await elaboraPagina(file, { modo, rotazione, angoli });
  }
  return { file, rotazione, ...r, rilevati: angoli === 'auto' ? r.angoli : undefined, manuali: angoli !== 'auto' ? angoli : null };
}

export function CartaIdentita({ ctx, sostituisci }) {
  const { mostra } = ctx;
  const [facce, setFacce] = useState({ fronte: null, retro: null });
  const [tipo, setTipo] = useState(TESSERE[0][0]);
  const [grande, setGrande] = useState(false);
  const [modo, setModo] = useState('colore');
  const [lavoro, setLavoro] = useState(null);
  const [pronto, setPronto] = useState(null); // { chiave, file }
  const [taglia, setTaglia] = useState(null); // { lato, url, automatici }
  const input = { fronte: { scatto: useRef(null), galleria: useRef(null) }, retro: { scatto: useRef(null), galleria: useRef(null) } };
  const nome = TESSERE.find(([t]) => t === tipo)?.[1] || 'Tessera';
  const presenti = FACCE.map(([k]) => facce[k]).filter(Boolean);
  const chiave = `${presenti.map((f) => `${f.url.length}:${f.rotazione}`).join('|')}#${grande}#${nome}`;

  const lavora = async (messaggio, fn) => {
    if (lavoro) return;
    setLavoro(messaggio);
    try { await fn(); } catch (e) { mostra(e.message || 'Foto non leggibile'); } finally { setLavoro(null); }
  };
  const scegli = (lato, files) => {
    const file = files?.[0];
    if (!file) return;
    lavora(`Preparo il ${lato}…`, async () => {
      validaFile(file);
      if (!file.type.startsWith('image/') && !/\.(heic|heif)$/i.test(file.name)) throw new Error('Scegli una foto della tessera.');
      const f = await prepara(file, { modo });
      setFacce((x) => ({ ...x, [lato]: f }));
    });
  };
  const ruota = (lato) => lavora('Giro la foto…', async () => {
    const f = facce[lato];
    const g = await prepara(f.file, { modo, rotazione: (f.rotazione + 90) % 360, angoli: f.manuali || 'auto' });
    setFacce((x) => ({ ...x, [lato]: { ...g, rotazione: (f.rotazione + 90) % 360 } }));
  });
  const apriAngoli = (lato) => lavora('Apro la foto…', async () => {
    const f = facce[lato];
    const [r, automatici] = await Promise.all([
      elaboraPagina(f.file, { modo: 'originale', rotazione: f.rotazione }),
      f.rilevati ?? rilevaAngoli(f.file, { rotazione: f.rotazione }),
    ]);
    setTaglia({ lato, url: r.url, automatici });
  });
  const raddrizza = (angoli) => {
    const { lato } = taglia; setTaglia(null);
    lavora('Raddrizzo…', async () => {
      const f = facce[lato];
      const g = await prepara(f.file, { modo, rotazione: f.rotazione, angoli });
      setFacce((x) => ({ ...x, [lato]: { ...g, rilevati: f.rilevati } }));
    });
  };

  // Colori: si rielaborano le foto già scelte.
  useEffect(() => {
    if (!presenti.length) return undefined;
    let vivo = true;
    (async () => {
      setLavoro('Miglioro le foto…');
      const nuove = {};
      for (const [k] of FACCE) if (facce[k]) nuove[k] = { ...facce[k], ...(await prepara(facce[k].file, { modo, rotazione: facce[k].rotazione, angoli: facce[k].manuali || 'auto' })), rotazione: facce[k].rotazione };
      if (vivo) setFacce((x) => ({ ...x, ...nuove }));
    })().catch((e) => vivo && mostra(e.message)).finally(() => vivo && setLavoro(null));
    return () => { vivo = false; };
  }, [modo]); // eslint-disable-line react-hooks/exhaustive-deps

  // Il PDF si prepara da solo: Condividi parte subito al tocco (iOS vuole il file già pronto).
  useEffect(() => {
    setPronto(null);
    if (!presenti.length || lavoro) return undefined;
    let vivo = true;
    const t = setTimeout(() => {
      pdfFronteRetro(presenti, { nome, larghezza: grande ? DIMENSIONI.grande : DIMENSIONI.reale })
        .then((file) => vivo && setPronto({ chiave, file }))
        .catch((e) => vivo && mostra(`PDF non creato: ${e.message}`));
    }, 250);
    return () => { vivo = false; clearTimeout(t); };
  }, [chiave, lavoro]); // eslint-disable-line react-hooks/exhaustive-deps

  const file = !lavoro && pronto?.chiave === chiave ? pronto.file : null;
  const riquadri = presenti.length ? riquadriFacce(presenti.length, { larghezza: grande ? DIMENSIONI.grande : DIMENSIONI.reale }) : [];
  const pct = (r) => ({ left: `${(r.x / A4.w) * 100}%`, top: `${(r.y / A4.h) * 100}%`, width: `${(r.w / A4.w) * 100}%`, height: `${(r.h / A4.h) * 100}%` });
  const condividiPdf = async () => {
    if (!file) return;
    try {
      const r = await condividi({ titolo: nome, file });
      if (r === 'non_disponibile' || r === 'link') { scaricaDocumento(file); mostra('Condivisione file non disponibile: PDF scaricato.'); }
      if (r !== 'annullato') ctx.ricorda?.([file]);
    } catch (e) { mostra(e.message); }
  };

  return (
    <div className="scan-tessera">
      <Segmenti voci={TESSERE.map(([t]) => [t, t])} attiva={tipo} onScegli={setTipo} />
      <div className="scan-facce">
        {FACCE.map(([lato, etichetta]) => {
          const f = facce[lato];
          return (
            <section key={lato} className="scan-faccia" aria-label={etichetta}>
              <input ref={input[lato].scatto} type="file" accept="image/*" capture="environment" hidden onChange={(e) => { scegli(lato, e.target.files); e.target.value = ''; }} />
              <input ref={input[lato].galleria} type="file" accept="image/*,.heic,.heif" hidden onChange={(e) => { scegli(lato, e.target.files); e.target.value = ''; }} />
              <h3>{etichetta}{lato === 'retro' && <small> · facoltativo</small>}</h3>
              {f ? (
                <>
                  <div className="scan-faccia-foto">{f.angoli && <span className="pp-scan-auto">Raddrizzata</span>}<img src={f.url} alt={`${etichetta} della tessera`} /></div>
                  <div className="scan-faccia-azioni">
                    <button disabled={!!lavoro} aria-label={`Raddrizza ${etichetta.toLowerCase()}`} onClick={() => apriAngoli(lato)}><IconaTaglia size={18} /></button>
                    <button disabled={!!lavoro} aria-label={`Ruota ${etichetta.toLowerCase()}`} onClick={() => ruota(lato)}><IconaRuota size={18} /></button>
                    <button disabled={!!lavoro} aria-label={`Rifai ${etichetta.toLowerCase()}`} onClick={() => input[lato].scatto.current.click()}><IconaFotocamera size={18} /></button>
                    <button disabled={!!lavoro} aria-label={`Togli ${etichetta.toLowerCase()}`} onClick={() => setFacce((x) => ({ ...x, [lato]: null }))}><IconaCestino size={18} /></button>
                  </div>
                </>
              ) : (
                <div className="scan-faccia-vuota">
                  <button className="pp-bottone" disabled={!!lavoro} onClick={() => input[lato].scatto.current.click()}><IconaFotocamera size={20} /> Scatta il {lato}</button>
                  <button className="pp-bottone pp-bottone-chiaro" disabled={!!lavoro} onClick={() => input[lato].galleria.current.click()}><IconaFoto size={20} /> Dalla galleria</button>
                </div>
              )}
            </section>
          );
        })}
      </div>
      {!presenti.length && <p className="pp-riga-meta pp-spiegazione">Appoggia la tessera su un piano scuro e scatta dall'alto: si raddrizza da sola. Fronte e retro finiscono sullo stesso foglio A4, come una fotocopia.</p>}
      {presenti.length > 0 && (
        <>
          <div className="scan-foglio" aria-label="Anteprima del foglio A4">
            {presenti.map((f, i) => <img key={i} src={f.url} alt="" style={pct(riquadri[i])} />)}
          </div>
          <Segmenti voci={[[false, 'Dimensione reale'], [true, 'Più grande']]} attiva={grande} onScegli={setGrande} />
          <Segmenti voci={[['colore', 'Nitida'], ['documento', 'Bianco e nero'], ['originale', 'Originale']]} attiva={modo} onScegli={setModo} />
          <div className="scan-output-actions">
            <button className="pp-bottone" disabled={!file} onClick={condividiPdf}><IconaCondividi size={18} /> Condividi PDF</button>
            <button className="pp-bottone pp-bottone-chiaro" disabled={!file} onClick={() => { scaricaDocumento(file); ctx.ricorda?.([file]); }}>Scarica PDF</button>
            <button className="pp-bottone pp-bottone-chiaro" disabled={!file} onClick={() => { ctx.ricorda?.([file]); ctx.apri({ tipo: 'pdf', file }); }}>Apri · Firma</button>
            <button className="pp-bottone pp-bottone-chiaro" disabled={!file} onClick={() => { ctx.ricorda?.([file]); sostituisci({ tipo: 'carica', file, opzioni: { descrizione: nome, fascicolo: 'identita', portafoglio: true, scelto: true } }); }}>Archivia nei documenti personali</button>
          </div>
        </>
      )}
      {lavoro && <p className="pp-riga-meta" role="status"><span className="pp-rotella" /> {lavoro}</p>}
      {taglia && <Angoli src={taglia.url} iniziale={facce[taglia.lato]?.manuali || facce[taglia.lato]?.angoli} automatici={taglia.automatici} onFatto={raddrizza} onAnnulla={() => setTaglia(null)} />}
    </div>
  );
}
