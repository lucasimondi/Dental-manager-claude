// POL-VITA-032 ARCHIVIO-TEMPO — il fiume del tempo: i documenti in ordine di arrivo, mese per mese,
// con miniature grandi e un colore per ogni cosa (Casa, Auto, Famiglia, Studio, Soldi).
// «Anni» mostra un anno per riga con la barra dei colori; toccando un anno si vedono i suoi mesi.
// Esclusi i documenti dei pazienti e quelli poco utili.
import { useEffect, useMemo, useRef, useState } from 'react';
import { archivioDb } from '../../lib/supabasePersonal.js';
import { COSE, anniDaMesi, mesiDaRighe, righeTempo, documentiDelMese, coloreDi } from '../../lib/vita.js';
import { Vuoto } from '../../ui.jsx';
import { IconaChiudi } from '../../Icone.jsx';
import { VoceDocumento } from './Selezione.jsx';

const PASSO = 4; // mesi caricati alla volta

export function VistaTempo({ ctx }) {
  const { esegui, apri, versione } = ctx;
  const [righe, setRighe] = useState(null);
  const [zoom, setZoom] = useState('mesi');
  const [filo, setFilo] = useState('tutto');
  const [anno, setAnno] = useState(null);
  const [quanti, setQuanti] = useState(PASSO);
  const [docs, setDocs] = useState({}); // `${filo}|${mese}` → documenti

  useEffect(() => { let vivo = true; esegui(async () => { const r = await righeTempo(archivioDb); if (vivo) setRighe(r); }); return () => { vivo = false; }; }, [esegui, versione]);
  const anni = useMemo(() => (righe ? anniDaMesi(righe, filo) : []), [righe, filo]);
  const mesi = useMemo(() => (righe ? mesiDaRighe(righe, filo, anno) : []), [righe, filo, anno]);
  const visibili = mesi.slice(0, quanti);
  const chiaveVisibili = visibili.map((m) => m.mese).join(',');
  const inCorso = useRef(new Set());

  // Carica i mesi visibili che mancano, uno per volta, senza richieste doppie.
  useEffect(() => {
    const mancanti = visibili.map((m) => `${filo}|${m.mese}`).filter((k) => !docs[k] && !inCorso.current.has(k));
    if (!mancanti.length) return;
    mancanti.forEach((k) => inCorso.current.add(k));
    (async () => {
      for (const k of mancanti) {
        const mese = k.split('|')[1];
        let r = [];
        try { r = await documentiDelMese(archivioDb, mese, filo); } catch { /* il mese resta vuoto */ }
        inCorso.current.delete(k);
        setDocs((d) => ({ ...d, [k]: r }));
      }
    })();
  }, [chiaveVisibili, filo, docs]); // eslint-disable-line react-hooks/exhaustive-deps

  const scegliFilo = (f) => { setFilo(f); setQuanti(PASSO); };
  const apriAnno = (a) => { setAnno(a); setZoom('mesi'); setQuanti(PASSO); };

  if (!righe) return <Vuoto>Carico…</Vuoto>;
  return (
    <div className="pp-tempo">
      <div className="pp-tempo-testa">
        <div className="pp-segmenti pp-tempo-zoom" role="group" aria-label="Zoom">
          <button type="button" className={zoom === 'anni' ? 'attivo' : ''} aria-pressed={zoom === 'anni'} onClick={() => setZoom('anni')}>Anni</button>
          <button type="button" className={zoom === 'mesi' ? 'attivo' : ''} aria-pressed={zoom === 'mesi'} onClick={() => setZoom('mesi')}>Mesi</button>
        </div>
        <div className="pp-tempo-fili" role="group" aria-label="Filtra per cosa">
          {[{ id: 'tutto', nome: 'Tutto', colore: '#8A877F' }, ...COSE].map((c) => (
            <button key={c.id} type="button" className={`pp-tempo-filo${filo === c.id ? ' attivo' : ''}`} aria-pressed={filo === c.id} onClick={() => scegliFilo(c.id)}>
              <span className="pp-tempo-punto" style={{ background: c.colore }} />{c.nome}
            </button>
          ))}
        </div>
      </div>

      {zoom === 'anni' && (
        <div className="pp-tempo-anni">
          {anni.map((a) => (
            <button key={a.anno} type="button" className="pp-tempo-anno" onClick={() => apriAnno(a.anno)}>
              <span className="pp-tempo-anno-testa"><strong>{a.anno}</strong><span>{a.n} documenti</span></span>
              <span className="pp-tempo-barra" aria-hidden="true">{a.seg.map((s) => <span key={s.id} style={{ width: `${s.quota}%`, background: s.colore }} />)}</span>
            </button>
          ))}
          {!anni.length && <Vuoto>Nessun documento per questa cosa.</Vuoto>}
        </div>
      )}

      {zoom === 'mesi' && (
        <>
          {anno && <button type="button" className="pp-chiedi-chip pp-tempo-solo" onClick={() => { setAnno(null); setQuanti(PASSO); }}>Solo {anno} <IconaChiudi size={12} /></button>}
          <div className="pp-tempo-fiume">
            {visibili.map((m) => {
              const elenco = docs[`${filo}|${m.mese}`];
              return (
                <section key={m.mese} className="pp-tempo-mese" aria-label={m.etichetta}>
                  <span className="pp-tempo-nodo" aria-hidden="true" />
                  <h2 className="pp-tempo-h2">{m.etichetta} <span>· {m.n === 1 ? '1 documento' : `${m.n} documenti`}</span></h2>
                  {!elenco ? <p className="pp-riga-meta">Carico…</p> : (
                    <div className="pp-griglia-doc">
                      {elenco.map((d) => (
                        <span key={d.id} className="pp-tempo-voce" style={{ '--filo': coloreDi(d.fascicolo) }}>
                          <VoceDocumento doc={d} modo="griglia" selezione={null} onApri={(x) => apri({ tipo: 'documento', id: x.id })} onSeleziona={() => {}} />
                        </span>
                      ))}
                    </div>
                  )}
                  {elenco && m.n > elenco.length && <p className="pp-riga-meta">e altri {m.n - elenco.length} in questo mese</p>}
                </section>
              );
            })}
          </div>
          {mesi.length > quanti && <button type="button" className="pp-bottone pp-bottone-chiaro pp-mie-largo" onClick={() => setQuanti((q) => q + PASSO)}>Mesi precedenti</button>}
          {!mesi.length && <Vuoto>Nessun documento per questa cosa.</Vuoto>}
        </>
      )}
    </div>
  );
}
