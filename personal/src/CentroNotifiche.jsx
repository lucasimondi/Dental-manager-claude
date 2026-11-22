// PR #337 §8 — Centro notifiche stile Windows 11: pannello a destra sopra la barra (foglio dal basso su
// mobile) con le notifiche raggruppate (Scadenze, Pratiche aperte, Documenti nuovi) e le azioni rapide
// (Apri documento, Posticipa, Segna come fatto), poi il calendario del mese con i giorni delle scadenze.
// Toast Win11 in basso a destra per gli eventi nuovi. Stessa fonte dei pallini (lib/centroNotifiche.js).
import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { archivioDb } from './lib/supabasePersonal.js';
import { segnaScadenza, cambiaStatoPratica } from './lib/archivio.js';
import {
  statoCentro, ascoltaCentro, aggiornaCentro, notificheDa, raggruppaNotifiche, leggiPosticipate, posticipa,
  calendarioMese, giorniConScadenze, nomeMese,
} from './lib/centroNotifiche.js';
import { oggiRoma } from './lib/revisioneArchivio.js';

const Ico = ({ d, size = 16 }) => <svg viewBox="0 0 16 16" width={size} height={size} aria-hidden="true"><path d={d} fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" /></svg>;
const ICONE = { scadenze: 'M3 4h10v9H3zM3 7h10M6 2.5v3M10 2.5v3', pratiche: 'M2.5 5h4l1.5 1.5h5.5v7h-11z', nuovi: 'M4 2h5.5L12 4.5V14H4zM6 8h4M6 10.5h4' };

export function useCentro() { return useSyncExternalStore(ascoltaCentro, statoCentro); }

export function CentroNotifiche({ onChiudi, apri, mobile }) {
  const st = useCentro();
  const [post, setPost] = useState(() => leggiPosticipate());
  const [mese, setMese] = useState(() => { const o = oggiRoma(); return { anno: Number(o.slice(0, 4)), mese: Number(o.slice(5, 7)) - 1 }; });
  const [giorno, setGiorno] = useState(null);
  const [lavoro, setLavoro] = useState(null);
  const [errore, setErrore] = useState(null);
  const [menuPost, setMenuPost] = useState(null);
  const oggi = oggiRoma();
  useEffect(() => { aggiornaCentro(archivioDb).catch((e) => setErrore(e.message)); }, []);
  useEffect(() => {
    const k = (e) => { if (e.key === 'Escape') { e.stopPropagation(); onChiudi(); } };
    window.addEventListener('keydown', k, true); // in cattura: vale anche con il cursore in un campo
    return () => window.removeEventListener('keydown', k, true);
  }, [onChiudi]);
  const tutte = useMemo(() => notificheDa(st, { posticipate: post, oggi }), [st, post, oggi]);
  const lista = giorno ? tutte.filter((n) => n.gruppo === 'scadenze' && n.data === giorno) : tutte;
  const gruppi = raggruppaNotifiche(lista);
  const conScadenze = giorniConScadenze(st.scadenze);
  const settimane = calendarioMese(mese.anno, mese.mese);
  const fai = async (n, f) => {
    setLavoro(n.chiave); setErrore(null);
    try { await f(); await aggiornaCentro(archivioDb); } catch (e) { setErrore(`Non riuscito: ${e.message}`); } finally { setLavoro(null); }
  };
  const fatto = (n) => fai(n, () => (n.scadenza_id ? segnaScadenza(archivioDb, n.scadenza_id, true) : n.pratica_id ? cambiaStatoPratica(archivioDb, n.pratica_id, 'risolta') : Promise.resolve(setPost(posticipa(n.chiave, 3650)))));
  const rimanda = (n, giorni) => { setMenuPost(null); setPost(posticipa(n.chiave, giorni)); };
  const cambiaMese = (d) => setMese((m) => { const t = new Date(Date.UTC(m.anno, m.mese + d, 1)); return { anno: t.getUTCFullYear(), mese: t.getUTCMonth() }; });
  return (
    <div className="pn-velo" onClick={onChiudi}>
      <aside className={`pn-centro${mobile ? ' pn-foglio' : ''}`} role="dialog" aria-label="Centro notifiche" onClick={(e) => { e.stopPropagation(); setMenuPost(null); }}>
        {mobile && <div className="pn-maniglia" aria-hidden="true" />}
        <section className="pn-notifiche" aria-label="Notifiche">
          <header className="pn-testa">
            <h2>Notifiche{giorno ? ` del ${new Date(`${giorno}T12:00:00Z`).toLocaleDateString('it-IT', { day: 'numeric', month: 'long', timeZone: 'UTC' })}` : ''}</h2>
            {giorno && <button type="button" className="pn-link" onClick={() => setGiorno(null)}>Tutte</button>}
          </header>
          {errore && <p className="pn-errore" role="alert">{errore}</p>}
          {!st.pronto && <p className="pn-vuoto"><span className="pp-rotella" /> Carico…</p>}
          {st.pronto && !gruppi.length && <p className="pn-vuoto">Nessuna notifica.</p>}
          {gruppi.map((g) => (
            <div key={g.id} className="pn-gruppo">
              <h3><Ico d={ICONE[g.id]} /> {g.nome} <span>{g.voci.length}</span></h3>
              <ul>
                {g.voci.slice(0, 12).map((n) => (
                  <li key={n.chiave} className={`pn-voce${n.urgente ? ' urgente' : ''}`}>
                    <strong>{n.titolo}</strong>
                    <small>{n.testo}</small>
                    <div className="pn-azioni">
                      {n.documento_id && <button type="button" onClick={() => { onChiudi(); apri({ tipo: 'documento', id: n.documento_id }); }}>Apri documento</button>}
                      {n.pratica && !n.documento_id && <button type="button" onClick={() => { onChiudi(); apri({ tipo: 'pratica', p: n.pratica }); }}>Apri pratica</button>}
                      <span className="pn-posticipa">
                        <button type="button" aria-haspopup="menu" aria-expanded={menuPost === n.chiave} onClick={(e) => { e.stopPropagation(); setMenuPost(menuPost === n.chiave ? null : n.chiave); }}>Posticipa ▾</button>
                        {menuPost === n.chiave && (
                          <span className="pn-menu" role="menu" onClick={(e) => e.stopPropagation()}>
                            {[[1, 'A domani'], [3, 'Fra 3 giorni'], [7, 'Fra una settimana']].map(([gg, t]) => <button key={gg} type="button" role="menuitem" onClick={() => rimanda(n, gg)}>{t}</button>)}
                          </span>
                        )}
                      </span>
                      <button type="button" disabled={lavoro === n.chiave} onClick={() => fatto(n)}>{n.gruppo === 'nuovi' ? 'Segna come letto' : 'Segna come fatto'}</button>
                    </div>
                  </li>
                ))}
              </ul>
              {g.voci.length > 12 && <p className="pn-vuoto">e altre {g.voci.length - 12}</p>}
            </div>
          ))}
        </section>
        <section className="pn-calendario" aria-label="Calendario">
          <header className="pn-testa">
            <h2 className="pn-mese">{nomeMese(mese.anno, mese.mese)}</h2>
            <span>
              <button type="button" className="pn-freccia" onClick={() => cambiaMese(-1)} aria-label="Mese precedente"><Ico d="M10 3 5 8l5 5" /></button>
              <button type="button" className="pn-freccia" onClick={() => cambiaMese(1)} aria-label="Mese successivo"><Ico d="m6 3 5 5-5 5" /></button>
            </span>
          </header>
          <div className="pn-griglia" role="grid" aria-label={nomeMese(mese.anno, mese.mese)}>
            <div role="row" className="pn-riga">{['lu', 'ma', 'me', 'gi', 've', 'sa', 'do'].map((g) => <span key={g} role="columnheader" className="pn-sett">{g}</span>)}</div>
            {settimane.map((s) => (
              <div key={s[0].giorno} role="row" className="pn-riga">
                {s.map((d) => {
                  const n = conScadenze.get(d.giorno) || 0;
                  return (
                    <button key={d.giorno} type="button" role="gridcell" aria-selected={giorno === d.giorno}
                      className={`pn-giorno${d.fuori ? ' fuori' : ''}${d.giorno === oggi ? ' oggi' : ''}${n ? ' con' : ''}${giorno === d.giorno ? ' scelto' : ''}`}
                      aria-label={`${d.numero}${n ? `, ${n} ${n === 1 ? 'scadenza' : 'scadenze'}` : ''}`} onClick={() => setGiorno(n ? (giorno === d.giorno ? null : d.giorno) : null)}>
                      {d.numero}{n > 0 && <i aria-hidden="true" />}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </section>
      </aside>
    </div>
  );
}

// Toast Win11 in basso a destra: eventi nuovi dall'ultima volta (scadenze, pratiche, documenti).
export function ToastNotifiche({ toast, onChiudi, onApri }) {
  useEffect(() => { if (!toast.length) return undefined; const t = setTimeout(() => onChiudi(toast[0].chiave), 7000); return () => clearTimeout(t); }, [toast, onChiudi]);
  if (!toast.length) return null;
  return (
    <div className="pn-toast-pila" role="region" aria-label="Avvisi nuovi">
      {toast.slice(0, 3).map((n) => (
        <div key={n.chiave} className="pn-toast" role="status">
          <span className="pn-toast-app"><Ico d={ICONE[n.gruppo]} size={14} /> Poliedra · {n.gruppo === 'scadenze' ? 'Scadenza' : n.gruppo === 'pratiche' ? 'Pratica' : 'Documento nuovo'}</span>
          <button type="button" className="pn-toast-chiudi" onClick={() => onChiudi(n.chiave)} aria-label="Chiudi avviso">✕</button>
          <strong>{n.titolo}</strong>
          <small>{n.testo}</small>
          {(n.documento_id || n.pratica_id) && <button type="button" className="pn-toast-apri" onClick={() => { onChiudi(n.chiave); onApri(n); }}>Apri</button>}
        </div>
      ))}
    </div>
  );
}
