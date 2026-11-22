// PR #337 §2 — barre della finestra di Esplora file stile Windows 11: barra del titolo con le schede,
// barra degli indirizzi (Indietro / Avanti / Su / Aggiorna, breadcrumb con le frecce che aprono le
// sottocartelle, clic sullo spazio vuoto = percorso da scrivere), campo Cerca, barra dei comandi,
// barra di stato con i pulsanti rapidi Icone / Dettagli, riquadro destro (anteprima / dettagli).
import { useEffect, useRef, useState } from 'react';
import { IconaCartellaW11, IconaFileW11 } from '../../IconeW11.jsx';
import { IcoMenu } from './EsploraFinestre.jsx';
import { Anteprima } from './AnteprimaDocumento.jsx';
import { nomeNodo, sottocartelle, tipoFile, tipoLeggibile, dimensioneLeggibile, dataLeggibile, eVirtuale, HOME } from '../../lib/esplora.js';
import { posizioneDaX, testoPercorso, FILTRI_TIPO, FILTRI_DATA } from '../../lib/esploraNav.js';

const Ico = ({ d, size = 16 }) => <svg viewBox="0 0 16 16" width={size} height={size} aria-hidden="true"><path d={d} fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" /></svg>;
const IcoCasa = ({ size = 16 }) => <Ico size={size} d="M2.5 7.5 8 3l5.5 4.5M4 6.5V13h3V9.5h2V13h3V6.5" />;

/* ---------- barra del titolo con le schede ---------- */
export function TitoloSchede({ schede, attiva, nomeDi, mobile, sopra, lavoro, onScegli, onNuova, onChiudi, onSposta }) {
  const lista = useRef(null);
  const [presa, setPresa] = useState(null); // { id, x0, x, a }
  if (mobile) {
    // Su mobile le schede diventano un selettore a tendina, con + e chiudi.
    return (
      <div className="esp-titolo esp-titolo-mobile" role="tablist" aria-label="Schede">
        <IconaCartellaW11 size={16} />
        <select className="esp-schede-tendina" value={attiva} onChange={(e) => onScegli(e.target.value)} aria-label="Scheda">
          {schede.map((s, i) => <option key={s.id} value={s.id}>{`${i + 1}. ${nomeDi(s)}`}</option>)}
        </select>
        <button type="button" className="esp-scheda-nuova" onClick={onNuova} aria-label="Nuova scheda" title="Nuova scheda (Ctrl+T)"><Ico d="M8 3v10M3 8h10" /></button>
        <button type="button" className="esp-scheda-nuova" onClick={() => onChiudi(attiva)} aria-label="Chiudi scheda" title="Chiudi scheda (Ctrl+W)"><Ico d="M4 4l8 8M12 4l-8 8" /></button>
        {lavoro > 0 && <span className="esp-titolo-sync" aria-live="polite">Drive…</span>}
      </div>
    );
  }
  const inizia = (e, id) => {
    if (e.button !== 0 || e.target.closest('.esp-scheda-chiudi')) return;
    const x0 = e.clientX;
    let attivo = false;
    const muovi = (ev) => {
      if (!attivo && Math.abs(ev.clientX - x0) < 6) return;
      attivo = true;
      const r = [...lista.current.querySelectorAll('[role="tab"]')].filter((el) => el.dataset.id !== id).map((el) => el.getBoundingClientRect());
      setPresa({ id, x0, x: ev.clientX, a: posizioneDaX(r, ev.clientX) });
    };
    const fine = (ev) => {
      window.removeEventListener('pointermove', muovi); window.removeEventListener('pointerup', fine);
      if (attivo) {
        const r = [...lista.current.querySelectorAll('[role="tab"]')].filter((el) => el.dataset.id !== id).map((el) => el.getBoundingClientRect());
        onSposta(id, posizioneDaX(r, ev.clientX));
      }
      setPresa(null);
    };
    window.addEventListener('pointermove', muovi); window.addEventListener('pointerup', fine);
  };
  return (
    <div className="esp-titolo">
      <div className="esp-schede" ref={lista} role="tablist" aria-label="Schede">
        {schede.map((s) => {
          const nome = nomeDi(s);
          return (
            <div key={s.id} data-id={s.id} role="tab" tabIndex={s.id === attiva ? 0 : -1} aria-selected={s.id === attiva}
              className={`esp-scheda${s.id === attiva ? ' attiva' : ''}${sopra === `scheda:${s.id}` ? ' sopra' : ''}${presa?.id === s.id ? ' presa' : ''}`}
              style={presa?.id === s.id ? { transform: `translateX(${presa.x - presa.x0}px)` } : undefined}
              data-bersaglio={`scheda:${s.id}`} title={nome}
              onPointerDown={(e) => inizia(e, s.id)} onClick={() => onScegli(s.id)}
              onAuxClick={(e) => { if (e.button === 1) { e.preventDefault(); onChiudi(s.id); } }}
              onMouseDown={(e) => { if (e.button === 1) e.preventDefault(); }}
              onKeyDown={(e) => { if (e.key === 'Delete') onChiudi(s.id); }}>
              <IconaCartellaW11 size={16} />
              <span className="esp-scheda-nome">{nome}</span>
              <button type="button" className="esp-scheda-chiudi" onClick={(e) => { e.stopPropagation(); onChiudi(s.id); }} aria-label={`Chiudi ${nome}`} title="Chiudi (Ctrl+W)"><Ico size={12} d="M4 4l8 8M12 4l-8 8" /></button>
            </div>
          );
        })}
        <button type="button" className="esp-scheda-nuova" onClick={onNuova} aria-label="Nuova scheda" title="Nuova scheda (Ctrl+T)"><Ico d="M8 3v10M3 8h10" /></button>
      </div>
      {lavoro > 0 && <span className="esp-titolo-sync" aria-live="polite">Sincronizzo con Drive…</span>}
    </div>
  );
}

/* ---------- barra degli indirizzi ---------- */
export function BarraIndirizzi({ briciole, nomi, cartelle, nodo, sopra, puo, onVai, onIndietro, onAvanti, onSu, onAggiorna, onPercorso, onMenu, cerca, mobile, onApriPannello }) {
  const [modifica, setModifica] = useState(null); // testo del percorso in modifica
  const [tendina, setTendina] = useState(null); // { id, x, y }
  useEffect(() => { setModifica(null); setTendina(null); }, [nodo]);
  const freccia = (e, id) => {
    e.stopPropagation();
    const r = e.currentTarget.getBoundingClientRect();
    if (tendina?.id === id) { setTendina(null); return; }
    setTendina({ id, x: r.left, y: r.bottom + 4 });
  };
  const figli = tendina ? (tendina.id === HOME ? [{ id: 'radice', nome: 'Personale' }] : sottocartelle(cartelle, tendina.id)) : [];
  return (
    <div className="esp-indirizzi">
      {mobile && <button type="button" className="esp-cmd" onClick={onApriPannello} aria-label="Pannello di navigazione" title="Pannello di navigazione"><Ico size={18} d="M2.5 4h11M2.5 8h11M2.5 12h11" /></button>}
      <button type="button" className="esp-cmd" onClick={onIndietro} disabled={!puo.indietro} aria-label="Indietro" title="Indietro (Alt+←)"><Ico size={18} d="M13 8H3M7 4 3 8l4 4" /></button>
      {!mobile && <button type="button" className="esp-cmd" onClick={onAvanti} disabled={!puo.avanti} aria-label="Avanti" title="Avanti (Alt+→)"><Ico size={18} d="M3 8h10M9 4l4 4-4 4" /></button>}
      <button type="button" className="esp-cmd" onClick={onSu} disabled={!puo.su} aria-label="Cartella superiore" title="Su (Alt+↑)"
        data-bersaglio={puo.su && !eVirtuale(puo.su) ? `cartella:${puo.su}` : undefined}><Ico size={18} d="M8 13V3M4 7l4-4 4 4" /></button>
      {!mobile && <button type="button" className="esp-cmd" onClick={onAggiorna} aria-label="Aggiorna" title="Aggiorna (F5)"><Ico size={18} d="M12.5 8a4.5 4.5 0 1 1-1.3-3.2M12.5 3v2.5H10" /></button>}
      {modifica !== null ? (
        <form className="esp-percorso esp-percorso-modifica" onSubmit={(e) => { e.preventDefault(); if (onPercorso(modifica)) setModifica(null); }}>
          <input autoFocus value={modifica} onFocus={(e) => e.target.select()} onChange={(e) => setModifica(e.target.value)} onBlur={() => setModifica(null)}
            onKeyDown={(e) => { e.stopPropagation(); if (e.key === 'Escape') setModifica(null); }} aria-label="Percorso" spellCheck={false} />
        </form>
      ) : (
        <nav className="esp-percorso" aria-label="Percorso" onClick={(e) => { if (e.target === e.currentTarget || e.target.classList.contains('esp-percorso-vuoto')) setModifica(testoPercorso(briciole)); }}>
          <button type="button" className="esp-percorso-casa" onClick={() => onVai(HOME)} aria-label="Home" title="Home"><IcoCasa /></button>
          <button type="button" className="esp-percorso-freccia" onClick={(e) => freccia(e, HOME)} aria-label="Cartelle in Home" aria-haspopup="menu" aria-expanded={tendina?.id === HOME}>›</button>
          {briciole.filter((b) => b.id !== HOME).map((b, i, arr) => {
            const ultima = i === arr.length - 1;
            const conFigli = !eVirtuale(b.id) && sottocartelle(cartelle, b.id).length > 0;
            return (
              <span key={b.id} className="esp-percorso-pezzo">
                <button type="button" onClick={() => onVai(b.id)} aria-current={ultima ? 'page' : undefined}
                  data-bersaglio={!ultima && !eVirtuale(b.id) ? `cartella:${b.id}` : undefined} className={sopra === `cartella:${b.id}` ? 'sopra' : ''}>{b.nome}</button>
                {conFigli && <button type="button" className="esp-percorso-freccia" onClick={(e) => freccia(e, b.id)} aria-label={`Sottocartelle di ${b.nome}`} aria-haspopup="menu" aria-expanded={tendina?.id === b.id}>›</button>}
              </span>
            );
          })}
          <span className="esp-percorso-vuoto" aria-hidden="true" />
        </nav>
      )}
      {tendina && (
        <div className="esp-velo-menu" onMouseDown={(e) => { if (e.target === e.currentTarget) setTendina(null); }}>
          <div className="esp-menu esp-tendina" role="menu" aria-label={`Sottocartelle di ${nomeNodo(tendina.id, nomi)}`} style={{ left: Math.max(8, Math.min(tendina.x, window.innerWidth - 248)), top: tendina.y }}>
            {figli.map((c) => <button key={c.id} type="button" role="menuitem" className="esp-menu-voce" onClick={() => { setTendina(null); onVai(c.id); }}><IconaCartellaW11 size={16} /><span className="esp-menu-nome">{c.nome}</span></button>)}
            {!figli.length && <p className="esp-nota">Nessuna sottocartella</p>}
          </div>
        </div>
      )}
      {cerca}
    </div>
  );
}

/* ---------- campo Cerca ---------- */
export function CampoCerca({ inputRef, valore, onCambia, onCerca, dove, mobile }) {
  return (
    <form className={`esp-cerca${mobile ? ' esp-cerca-mobile' : ''}`} role="search" onSubmit={(e) => { e.preventDefault(); onCerca(valore); }}>
      <input ref={inputRef} value={valore} onChange={(e) => onCambia(e.target.value)} placeholder={`Cerca in ${dove}`} aria-label={`Cerca in ${dove}`}
        onKeyDown={(e) => { e.stopPropagation(); if (e.key === 'Escape') { onCambia(''); e.currentTarget.blur(); } }} enterKeyHint="search" spellCheck={false} />
      <button type="submit" aria-label="Cerca"><Ico d="M7 12a5 5 0 1 0 0-10 5 5 0 0 0 0 10ZM10.7 10.7 14 14" /></button>
    </form>
  );
}

// Filtri dei risultati di ricerca: tipo, data, categoria.
export function FiltriRicerca({ filtri, fascicoli, onFiltri, n, testo, base }) {
  return (
    <div className="esp-filtri" role="group" aria-label="Filtri della ricerca">
      <span className="esp-filtri-testo">{n} {n === 1 ? 'risultato' : 'risultati'} per «{testo}» in {base}</span>
      <select value={filtri.tipo} onChange={(e) => onFiltri({ ...filtri, tipo: e.target.value })} aria-label="Tipo">{FILTRI_TIPO.map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
      <select value={filtri.data} onChange={(e) => onFiltri({ ...filtri, data: e.target.value })} aria-label="Data">{FILTRI_DATA.map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
      <select value={filtri.categoria} onChange={(e) => onFiltri({ ...filtri, categoria: e.target.value })} aria-label="Categoria">
        <option value="">Tutte le categorie</option>
        {fascicoli.filter((f) => f.codice !== 'clinico_pazienti').map((f) => <option key={f.codice} value={f.codice}>{f.nome}</option>)}
      </select>
    </div>
  );
}

/* ---------- barra dei comandi ---------- */
export function BarraComandi({ comandi, onMenu, mobile }) {
  const tasto = (c) => (
    <button key={c.id} type="button" className={`esp-cmd${c.testo ? ' esp-cmd-testo' : ''}`} disabled={c.disattivo} title={c.titolo || c.nome} aria-label={c.nome}
      aria-haspopup={c.menu ? 'menu' : undefined}
      onClick={(e) => { if (c.menu) { const r = e.currentTarget.getBoundingClientRect(); onMenu(c.menu, r.left, r.bottom + 4); } else c.fai(); }}>
      <IcoMenu id={c.icona || c.id} size={18} />{c.testo && !mobile && <span>{c.nome}</span>}{c.menu && <span aria-hidden="true" className="esp-cmd-giu">▾</span>}
    </button>
  );
  return (
    <div className="esp-comandi" role="toolbar" aria-label="Comandi">
      {comandi.map((c, i) => (c === '|' ? <span key={`sep${i}`} className="esp-cmd-sep" role="separator" aria-orientation="vertical" /> : tasto(c)))}
    </div>
  );
}

/* ---------- barra di stato ---------- */
export function BarraStato({ testo, selezione, vista, onVista }) {
  return (
    <footer className="esp-stato">
      <span className="esp-stato-testo">{testo}{selezione ? <><span className="esp-stato-sep" aria-hidden="true">|</span>{selezione}</> : null}</span>
      <span className="esp-stato-viste" role="group" aria-label="Visualizzazione rapida">
        <button type="button" className={vista === 'dettagli' ? 'attiva' : ''} aria-pressed={vista === 'dettagli'} onClick={() => onVista('dettagli')} title="Dettagli" aria-label="Dettagli"><Ico d="M2.5 4h11M2.5 8h11M2.5 12h11" /></button>
        <button type="button" className={vista === 'grandi' || vista === 'medie' ? 'attiva' : ''} aria-pressed={vista === 'grandi'} onClick={() => onVista('grandi')} title="Icone grandi" aria-label="Icone grandi"><Ico d="M2.5 2.5h4.5v4.5H2.5zM9 2.5h4.5v4.5H9zM2.5 9h4.5v4.5H2.5zM9 9h4.5v4.5H9z" /></button>
      </span>
    </footer>
  );
}

/* ---------- riquadro destro: anteprima (Alt+P) o dettagli (Alt+Maiusc+P) ---------- */
export function Riquadro({ modo, voce, cosa, titolo, categoria, scadenze, percorso, mobile, onModo, onChiudi, onApri }) {
  const corpo = !voce ? <p className="esp-nota esp-riquadro-vuoto">Seleziona un file per {modo === 'anteprima' ? 'l’anteprima' : 'vederne i dettagli'}.</p> : (
    <>
      <div className="esp-riquadro-testa">
        {cosa === 'cartella' ? <IconaCartellaW11 size={40} /> : <IconaFileW11 tipo={tipoFile(voce)} size={40} />}
        <strong>{titolo}</strong>
      </div>
      {modo === 'anteprima' && cosa !== 'cartella' && (
        <div className="esp-riquadro-anteprima">
          {['pdf', 'immagine'].includes(tipoFile(voce)) && voce.drive_file_id ? <Anteprima doc={voce} /> : <p className="esp-nota">Anteprima non disponibile per questo tipo di file.</p>}
        </div>
      )}
      <dl className="esp-proprieta esp-riquadro-dati">
        {(cosa === 'cartella' ? [['Tipo', 'Cartella di file'], ['Percorso', percorso], ['Modificata', dataLeggibile(voce.modificato_il)]] : [
          ['Tipo', tipoLeggibile(voce)], ['Dimensione', dimensioneLeggibile(voce.dimensione_byte) || '—'], ['Data', dataLeggibile(voce.data_documento || voce.creato_il)],
          ['Categoria', categoria || '—'], ['Ente', voce.ente || '—'], ['Percorso', percorso || '—'],
        ]).map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v || '—'}</dd></div>)}
      </dl>
      {cosa !== 'cartella' && !!voce.tag?.length && <div className="esp-riquadro-tag">{voce.tag.filter((t) => t !== 'cestino').map((t) => <span key={t} className="esp-etichetta">{t}</span>)}</div>}
      {cosa !== 'cartella' && voce.riassunto && <p className="esp-riquadro-riassunto">{voce.riassunto}</p>}
      {cosa !== 'cartella' && (
        <>
          <h3 className="esp-sezione">Scadenze collegate</h3>
          {scadenze === null ? <p className="esp-nota">Carico…</p> : scadenze.length ? (
            <ul className="esp-riquadro-scadenze">{scadenze.map((s) => <li key={s.id} className={s.completata ? 'fatta' : ''}><span>{new Date(`${s.data}T12:00:00`).toLocaleDateString('it-IT', { day: 'numeric', month: 'short', year: 'numeric' })}</span><span>{s.descrizione || 'Scadenza'}</span>{s.importo ? <span>{Number(s.importo).toLocaleString('it-IT', { style: 'currency', currency: 'EUR' })}</span> : null}</li>)}</ul>
          ) : <p className="esp-nota">Nessuna scadenza.</p>}
        </>
      )}
      <div className="esp-finestra-piede"><button type="button" className="esp-bottone" onClick={onApri}>Apri</button></div>
    </>
  );
  const schede = (
    <div className="esp-riquadro-schede" role="tablist" aria-label="Riquadro">
      <button type="button" role="tab" aria-selected={modo === 'anteprima'} className={modo === 'anteprima' ? 'attiva' : ''} onClick={() => onModo('anteprima')}>Anteprima</button>
      <button type="button" role="tab" aria-selected={modo === 'dettagli'} className={modo === 'dettagli' ? 'attiva' : ''} onClick={() => onModo('dettagli')}>Dettagli</button>
      <button type="button" className="esp-riquadro-chiudi" onClick={onChiudi} aria-label="Chiudi il riquadro"><Ico size={12} d="M4 4l8 8M12 4l-8 8" /></button>
    </div>
  );
  if (mobile) {
    return (
      <div className="esp-velo esp-velo-foglio" onClick={onChiudi}>
        <aside className="esp-foglio-menu esp-riquadro esp-riquadro-foglio" aria-label={modo === 'anteprima' ? 'Anteprima' : 'Dettagli'} onClick={(e) => e.stopPropagation()}>
          <div className="esp-foglio-maniglia" />{schede}{corpo}
        </aside>
      </div>
    );
  }
  return <aside className="esp-riquadro" aria-label={modo === 'anteprima' ? 'Riquadro di anteprima' : 'Riquadro dei dettagli'}>{schede}<div className="esp-riquadro-corpo">{corpo}</div></aside>;
}
