// POL-VITA-032 ARCHIVIO-COSE — «Le mie cose»: non cartelle ma le cose della vita (Casa, Auto,
// Famiglia, Studio, Soldi e le persone delle Impostazioni). Ogni scheda mostra la prossima
// scadenza; dentro: i dati che contano (targa, POD, polizza… dai documenti), le prossime cose da
// fare e i documenti come prove. Raggruppa categorie esistenti: nessun modello, pazienti esclusi.
import { useEffect, useMemo, useState } from 'react';
import { archivioDb } from '../../lib/supabasePersonal.js';
import { coseConPersone, riepilogoCose, documentiDellaCosa, fattiDaDocumenti } from '../../lib/vita.js';
import { Vuoto, dataBreve, giorniA } from '../../ui.jsx';
import { RigaCompatta } from './Tempo.jsx';

const quando = (data) => { const g = giorniA(data); return g < 0 ? `scaduta da ${-g} g` : g === 0 ? 'oggi' : g === 1 ? 'domani' : `tra ${g} giorni`; };
const chiaroScuro = (hex) => { const n = parseInt(hex.slice(1), 16); const l = (0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255; return l > 0.6 ? '#17171A' : '#FFFFFF'; };

function usaCose(ctx) {
  const persone = ctx.impostazioni?.persone || [];
  const chiave = persone.join('|');
  return useMemo(() => coseConPersone(persone), [chiave]); // eslint-disable-line react-hooks/exhaustive-deps
}

export function VistaCose({ ctx }) {
  const { esegui, apri, versione } = ctx;
  const cose = usaCose(ctx);
  const [riepilogo, setRiepilogo] = useState(null);
  useEffect(() => { let vivo = true; esegui(async () => { const r = await riepilogoCose(archivioDb, cose); if (vivo) setRiepilogo(r); }); return () => { vivo = false; }; }, [cose, esegui, versione]);
  return (
    <div className="pp-cose">
      <p className="pp-riga-meta pp-cose-intro">Le cose della tua vita, ognuna con quello che devi sapere.</p>
      <div className="pp-cose-griglia">
        {cose.map((c) => {
          const r = riepilogo?.[c.id];
          const prossima = r?.scadenze?.[0];
          return (
            <button key={c.id} type="button" className="pp-cosa" style={{ '--sfondo': c.colore, '--testo': chiaroScuro(c.colore) }} onClick={() => apri({ tipo: 'cosa', id: c.id })}>
              <span className="pp-cosa-testa"><strong>{c.nome}</strong><span>{c.sotto}</span></span>
              <span className="pp-cosa-piede">
                <span className="pp-cosa-chiave">{prossima ? `${prossima.descrizione} · ${quando(prossima.data)}` : r ? 'Niente in scadenza' : '…'}</span>
                {r?.n != null && <span className="pp-cosa-n">{r.n === 1 ? '1 documento' : `${r.n} documenti`}</span>}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function PaginaCosa({ id, ctx }) {
  const { esegui, apri, versione } = ctx;
  const cose = usaCose(ctx);
  const cosa = cose.find((c) => c.id === id);
  const [documenti, setDocumenti] = useState(null);
  const [riepilogo, setRiepilogo] = useState(null);
  useEffect(() => {
    if (!cosa) return undefined;
    let vivo = true;
    esegui(async () => {
      const [d, r] = await Promise.all([documentiDellaCosa(archivioDb, cosa), riepilogoCose(archivioDb, [cosa])]);
      if (vivo) { setDocumenti(d); setRiepilogo(r[cosa.id]); }
    });
    return () => { vivo = false; };
  }, [id, versione]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!cosa) return <Vuoto>Questa cosa non c’è più.</Vuoto>;
  const fatti = documenti ? fattiDaDocumenti(documenti, cosa.chiavi) : [];
  const scadenze = (riepilogo?.scadenze || []).slice(0, 5);
  const conImporto = (documenti || []).filter((d) => d.importo != null).slice(0, 3);
  return (
    <div className="pp-cosa-pagina">
      <header className="pp-cosa-intestazione" style={{ '--sfondo': cosa.colore, '--testo': chiaroScuro(cosa.colore) }}>
        <span>{cosa.sotto}</span>
        <h1>{cosa.nome}</h1>
        {riepilogo?.n != null && <span>{riepilogo.n === 1 ? '1 documento' : `${riepilogo.n} documenti`}</span>}
      </header>

      {fatti.length > 0 && (
        <section aria-label="Da sapere">
          <h2 className="pp-chiedi-h2">Da sapere</h2>
          <div className="pp-gruppo">
            {fatti.map((f) => (
              <button key={f.k} type="button" className="pp-riga pp-cosa-fatto" onClick={() => apri({ tipo: 'documento', id: f.doc })}>
                <span className="pp-riga-meta">{f.k}</span><strong>{f.v}</strong>
              </button>
            ))}
          </div>
        </section>
      )}

      <section aria-label="Prossime cose">
        <h2 className="pp-chiedi-h2">Prossime cose</h2>
        {riepilogo ? (scadenze.length ? scadenze.map((s) => (
          <button key={s.id} type="button" className="pp-chiedi-dafare" disabled={!s.documento_id} onClick={() => s.documento_id && apri({ tipo: 'documento', id: s.documento_id })}>
            <span className="pp-tempo-punto" style={{ background: cosa.colore }} />
            <span className="pp-chiedi-dafare-testo"><span className="pp-chiedi-dafare-titolo">{s.descrizione}</span><span className="pp-chiedi-meta">{dataBreve(s.data)} · {quando(s.data)}</span></span>
          </button>
        )) : <p className="pp-riga-meta">Niente in scadenza nei prossimi mesi.</p>) : <p className="pp-riga-meta">Carico…</p>}
      </section>

      {conImporto.length > 0 && (
        <section aria-label="Ultimi importi">
          <h2 className="pp-chiedi-h2">Ultimi importi</h2>
          <div className="pp-tempo-righe">{conImporto.map((d) => <RigaCompatta key={d.id} doc={d} conGiorno={false} onApri={(x) => apri({ tipo: 'documento', id: x.id })} />)}</div>
        </section>
      )}

      <section aria-label="Documenti">
        <div className="pp-mie-testa">
          <h2 className="pp-chiedi-h2">Documenti</h2>
          {documenti && documenti.length > 12 && (
            <button type="button" className="pp-testo-link" onClick={() => apri({ tipo: 'elenco', titolo: cosa.nome, carica: () => documentiDellaCosa(archivioDb, cosa, 400) })}>Tutti</button>
          )}
        </div>
        {!documenti ? <p className="pp-riga-meta">Carico…</p> : documenti.length ? (
          <div className="pp-tempo-righe">
            {documenti.slice(0, 12).map((d) => <RigaCompatta key={d.id} doc={d} conGiorno={false} onApri={(x) => apri({ tipo: 'documento', id: x.id })} />)}
          </div>
        ) : <Vuoto>Nessun documento.</Vuoto>}
      </section>
    </div>
  );
}
