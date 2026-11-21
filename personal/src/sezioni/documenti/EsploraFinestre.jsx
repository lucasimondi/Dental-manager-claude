// PR #337 — pezzi di Esplora file stile Windows 11: menu contestuale (popover su desktop, foglio dal basso su
// mobile, con riga rapida, sottomenu, scorciatoie e separatori), finestra di anteprima (riduci, ingrandisci,
// chiudi), Proprietà, Gestisci accesso Drive, Sposta in… / Duplica in…, avvisi (Annulla / Riprova).
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { preparaFile, comeFile } from '../../lib/condividi.js';
import { tokenSessione } from '../../ui.jsx';
import { Anteprima } from './AnteprimaDocumento.jsx';
import { IconaCartellaW11, IconaFileW11 } from '../../IconeW11.jsx';
import { posizioneMenu, dimensioneLeggibile, dataLeggibile, tipoLeggibile, tipoFile, proprietaDrive, accessoDrive } from '../../lib/esplora.js';

/* ---------- icone lineari 16 px ---------- */
const D = {
  apri: 'M2.5 5h4l1.5 1.5h5.5v7h-11z', 'apri-con': 'M3 3h10v10H3zM6 8h4M8 6l2 2-2 2', condividi: 'M8 2v8M5 5l3-3 3 3M3 9v4h10V9',
  taglia: 'M5 12a1.6 1.6 0 1 0 0 .01M11 12a1.6 1.6 0 1 0 0 .01M6.2 10.8 12 3M9.8 10.8 4 3', copia: 'M5 5h8v8H5zM3 11V3h8',
  duplica: 'M5 5h8v8H5zM3 11V3h8M9 7v4M7 9h4', incolla: 'M5.5 3h5v2h-5zM4 4H3v10h10V4h-1', 'incolla-qui': 'M5.5 3h5v2h-5zM4 4H3v10h10V4h-1',
  rinomina: 'M3 13h2.5l7-7-2.5-2.5-7 7zM9.5 4.5 12 7', sposta: 'M2.5 8h10M9 4.5 12.5 8 9 11.5', preferito: 'm8 2.5 1.7 3.5 3.8.5-2.8 2.6.7 3.8L8 11.1l-3.4 1.8.7-3.8L2.5 6.5l3.8-.5z',
  zip: 'M4 2h6l3 3v9H4zM8 4v1M8 6v1M8 8v1M7.3 10h1.4v2H7.3z', scarica: 'M8 2v8M5 7l3 3 3-3M3 13h10', proprieta: 'M3 3h10v10H3zM5.5 6h5M5.5 8.5h5M5.5 11h3',
  elimina: 'M3 4.5h10M6.5 4.5V3h3v1.5M4.5 4.5l.7 9h5.6l.7-9', nuova: 'M2.5 5h4l1.5 1.5h5.5v7h-11zM8 8.5v3M6.5 10h3', aggiorna: 'M12.5 8a4.5 4.5 0 1 1-1.3-3.2M12.5 3v2.5H10',
  vista: 'M3 3h4v4H3zM9 3h4v4H9zM3 9h4v4H3zM9 9h4v4H9z', 'seleziona-tutto': 'M3 3h10v10H3zM5.5 8l1.8 1.8L10.5 6.5',
  'condividi-sistema': 'M8 2v8M5 5l3-3 3 3M3 9v4h10V9',
};
export const IcoMenu = ({ id, size = 16 }) => <svg viewBox="0 0 16 16" width={size} height={size} aria-hidden="true"><path d={D[id] || D[String(id).split(':')[0]] || D.apri} fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" /></svg>;

/* ---------- menu contestuale ---------- */
export function MenuContestuale({ menu, struttura, mobile, schermo, onScegli, onChiudi }) {
  const [sotto, setSotto] = useState(null); // { id, voci, y }
  const [pos, setPos] = useState(null);
  const ref = useRef(null);
  const apertoIl = useRef(Date.now());
  useLayoutEffect(() => {
    if (mobile || !ref.current) return;
    const r = ref.current.getBoundingClientRect();
    setPos({ ...posizioneMenu(menu.x, menu.y, r.width, r.height, schermo.l, schermo.a), largo: r.width });
  }, [menu.x, menu.y, mobile, schermo.l, schermo.a, struttura]);
  useEffect(() => {
    const k = (e) => { if (e.key === 'Escape') { e.stopPropagation(); if (sotto) setSotto(null); else onChiudi(); } };
    window.addEventListener('keydown', k, true);
    return () => window.removeEventListener('keydown', k, true);
  }, [sotto, onChiudi]);
  // Al rilascio del dito il telefono genera un «click» proprio dove compare il menu: per un attimo lo si ignora.
  const pronto = () => Date.now() - apertoIl.current > 450;
  const scegli = (v) => { if (!pronto() || !v.attiva) return; if (v.sotto) { setSotto({ id: v.id, nome: v.nome, voci: v.sotto }); return; } onScegli(v.id); };
  const voce = (v, i) => (v.separatore ? <div key={`s${i}`} className="esp-menu-sep" role="separator" /> : (
    <button key={v.id} type="button" role="menuitem" className={`esp-menu-voce${sotto?.id === v.id ? ' aperta' : ''}`} disabled={!v.attiva}
      aria-haspopup={v.sotto ? 'menu' : undefined} onClick={() => scegli(v)}
      onMouseEnter={(e) => { if (!mobile && v.sotto && v.attiva) setSotto({ id: v.id, nome: v.nome, voci: v.sotto, y: e.currentTarget.getBoundingClientRect().top }); else if (!mobile && !v.sotto) setSotto(null); }}>
      <IcoMenu id={v.id} /><span className="esp-menu-nome">{v.nome}</span>
      {v.tasto && <kbd className="esp-menu-tasto">{v.tasto}</kbd>}
      {v.sotto && <span className="esp-menu-freccia" aria-hidden="true">›</span>}
    </button>
  ));
  const rapide = struttura.rapide?.length ? (
    <div className="esp-menu-rapide" role="group" aria-label="Azioni rapide">
      {struttura.rapide.map((r) => <button key={r.id} type="button" className="esp-menu-rapida" disabled={!r.attiva} title={r.nome} aria-label={r.nome} onClick={() => pronto() && r.attiva && onScegli(r.id)}><IcoMenu id={r.id} size={18} /></button>)}
    </div>
  ) : null;
  if (mobile) {
    return (
      <div className="esp-velo esp-velo-foglio" onClick={() => pronto() && onChiudi()}>
        <div className="esp-foglio-menu" role="menu" aria-label="Menu" onClick={(e) => e.stopPropagation()}>
          <div className="esp-foglio-maniglia" />
          {sotto ? (
            <>
              <button type="button" className="esp-menu-voce esp-menu-indietro" onClick={() => setSotto(null)}><span aria-hidden="true">‹</span><span className="esp-menu-nome">{sotto.nome}</span></button>
              {sotto.voci.map(voce)}
            </>
          ) : <>{menu.titolo && <p className="esp-foglio-titolo">{menu.titolo}</p>}{rapide}{struttura.voci.map(voce)}</>}
        </div>
      </div>
    );
  }
  // Sottomenu accanto al menu (a destra; a sinistra se non c'è spazio), sempre dentro lo schermo.
  const largo = pos?.largo || 232;
  const sottoLargo = 260;
  const sx = pos && pos.left + largo + sottoLargo > schermo.l - 8 ? pos.left - sottoLargo + 4 : (pos?.left || 0) + largo - 4;
  return (
    <div className="esp-velo-menu" onMouseDown={(e) => { if (e.target === e.currentTarget) onChiudi(); }} onContextMenu={(e) => { e.preventDefault(); onChiudi(); }}>
      <div ref={ref} className="esp-menu" role="menu" style={pos ? { left: pos.left, top: pos.top } : { left: -9999, top: 0 }}>
        {rapide}{struttura.voci.map(voce)}
      </div>
      {sotto && pos && (
        <div className="esp-menu esp-sottomenu" role="menu" aria-label={sotto.nome}
          style={{ left: Math.max(8, sx), top: Math.max(8, Math.min((sotto.y || pos.top) - 6, schermo.a - (sotto.voci.length * 40 + 16) - 8)) }}>
          {sotto.voci.map(voce)}
        </div>
      )}
    </div>
  );
}

/* ---------- finestra stile Win11 ---------- */
export function Finestra({ titolo, icona, stato: statoDato, onStato: onStatoDato, onChiudi, children, classe = '' }) {
  const [statoLocale, setStatoLocale] = useState('normale');
  const stato = statoDato ?? statoLocale;
  const onStato = onStatoDato || setStatoLocale;
  useEffect(() => {
    const k = (e) => { if (e.key === 'Escape') onChiudi(); };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [onChiudi]);
  if (stato === 'ridotta') {
    return <button type="button" className="esp-finestra-ridotta" onClick={() => onStato('normale')} aria-label={`Ripristina ${titolo}`}>{icona}<span>{titolo}</span></button>;
  }
  return (
    <div className={`esp-velo esp-velo-finestra${stato === 'ingrandita' ? ' ingrandita' : ''}`}>
      <section className={`esp-finestra ${classe}`} role="dialog" aria-label={titolo}>
        <header className="esp-finestra-titolo" onDoubleClick={() => onStato(stato === 'ingrandita' ? 'normale' : 'ingrandita')}>
          {icona}<span className="esp-finestra-nome">{titolo}</span>
          <div className="esp-finestra-tasti">
            <button type="button" onClick={() => onStato('ridotta')} aria-label="Riduci a icona" title="Riduci a icona"><svg viewBox="0 0 10 10" width="10" height="10"><path d="M1 5h8" stroke="currentColor" /></svg></button>
            <button type="button" onClick={() => onStato(stato === 'ingrandita' ? 'normale' : 'ingrandita')} aria-label={stato === 'ingrandita' ? 'Ripristina' : 'Ingrandisci'} title={stato === 'ingrandita' ? 'Ripristina' : 'Ingrandisci'}>
              <svg viewBox="0 0 10 10" width="10" height="10"><rect x="1.5" y="1.5" width="7" height="7" rx="1" fill="none" stroke="currentColor" /></svg>
            </button>
            <button type="button" className="esp-finestra-chiudi" onClick={onChiudi} aria-label="Chiudi" title="Chiudi"><svg viewBox="0 0 10 10" width="10" height="10"><path d="M1.5 1.5l7 7M8.5 1.5l-7 7" stroke="currentColor" /></svg></button>
          </div>
        </header>
        <div className="esp-finestra-corpo">{children}</div>
      </section>
    </div>
  );
}

// Anteprima integrata: PDF e immagini con l'anteprima di Documenti, video e audio con il lettore del browser.
export function FinestraAnteprima({ doc, tipo, titolo, stato, onStato, onChiudi, onApriScheda }) {
  const [url, setUrl] = useState(null);
  const [errore, setErrore] = useState(null);
  useEffect(() => {
    if (tipo !== 'video' && tipo !== 'audio') return undefined;
    let vivo = true; let u = null;
    tokenSessione().then((t) => preparaFile(doc.drive_file_id, t)).then((f) => { if (!vivo) return; u = URL.createObjectURL(comeFile(f)); setUrl(u); }).catch((e) => vivo && setErrore(e.message));
    return () => { vivo = false; if (u) URL.revokeObjectURL(u); };
  }, [doc.drive_file_id, tipo]);
  return (
    <Finestra titolo={titolo} icona={<IconaFileW11 tipo={tipoFile(doc)} size={16} />} stato={stato} onStato={onStato} onChiudi={onChiudi} classe="esp-finestra-anteprima">
      {(tipo === 'pdf' || tipo === 'immagine') && <Anteprima doc={doc} />}
      {(tipo === 'video' || tipo === 'audio') && !url && !errore && <p className="esp-nota"><span className="pp-rotella" /> Carico…</p>}
      {errore && <p className="esp-nota">{errore}</p>}
      {tipo === 'video' && url && <video src={url} controls playsInline className="esp-media" />}
      {tipo === 'audio' && url && <audio src={url} controls className="esp-media-audio" />}
      <div className="esp-finestra-piede"><button type="button" className="esp-bottone" onClick={onApriScheda}>Apri la scheda del documento</button></div>
    </Finestra>
  );
}

/* ---------- Proprietà ---------- */
export function DialogoProprieta({ voce, cosa, percorsoApp, onChiudi }) {
  const [drive, setDrive] = useState(null);
  useEffect(() => {
    let vivo = true;
    tokenSessione().then((token) => proprietaDrive({ token, id: voce.id, cartella: cosa === 'cartella' }))
      .then((r) => vivo && setDrive(r)).catch((e) => vivo && setDrive({ errore: e.message }));
    return () => { vivo = false; };
  }, [voce.id, cosa]);
  const file = cosa !== 'cartella';
  const righe = [
    ['Tipo', file ? tipoLeggibile(voce) : 'Cartella di file'],
    ['Percorso in Poliedra', percorsoApp],
    ['Percorso su Drive', drive?.percorso || (drive ? '—' : '…')],
    ['Dimensione', file ? (dimensioneLeggibile(drive?.dimensione ?? voce.dimensione_byte) || '—') : '—'],
    ['Creato', dataLeggibile(drive?.creato || voce.creato_il) || '—'],
    ['Modificato', dataLeggibile(drive?.modificato || voce.modificato_il) || '—'],
    ['Proprietario', drive?.proprietario || (drive ? '—' : '…')],
  ];
  return (
    <Finestra titolo={`Proprietà · ${file ? voce.titolo || voce.nome_file_originale || 'Documento' : voce.nome}`} icona={file ? <IconaFileW11 tipo={tipoFile(voce)} size={16} /> : <IconaCartellaW11 size={16} />} onChiudi={onChiudi} classe="esp-finestra-piccola">
      <dl className="esp-proprieta">{righe.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl>
      {drive?.errore && <p className="esp-nota">Drive non ha risposto: {drive.errore}</p>}
      {file && drive?.versioni && (
        <>
          <h3 className="esp-sezione">Cronologia versioni su Drive</h3>
          {drive.versioni.length ? <ul className="esp-versioni">{drive.versioni.map((v) => <li key={v.id}><span>{dataLeggibile(v.quando)}</span><span>{v.chi || ''}</span><span>{dimensioneLeggibile(v.dimensione)}</span></li>)}</ul> : <p className="esp-nota">Una sola versione.</p>}
        </>
      )}
      {drive?.link && <div className="esp-finestra-piede"><a className="esp-bottone" href={drive.link} target="_blank" rel="noopener noreferrer">Apri in Drive</a></div>}
    </Finestra>
  );
}

/* ---------- Gestisci accesso Drive ---------- */
export function DialogoAccesso({ doc, titolo, onChiudi }) {
  const [stato, setStato] = useState(null);
  const [email, setEmail] = useState('');
  const [ruolo, setRuolo] = useState('reader');
  const [lavoro, setLavoro] = useState(false);
  const [conferma, setConferma] = useState(null);
  const chiama = async (corpo) => {
    setLavoro(true);
    try { setStato(await accessoDrive({ token: await tokenSessione(), id: doc.id, ...corpo })); }
    catch (e) { setStato((s) => ({ ...(s || {}), errore: e.message })); }
    finally { setLavoro(false); setConferma(null); }
  };
  useEffect(() => { chiama({ operazione: 'leggi' }); }, [doc.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const pubblico = stato?.permessi?.some((p) => p.tipo === 'anyone');
  const ruoli = { owner: 'Proprietario', writer: 'Può modificare', reader: 'Può vedere', commenter: 'Può commentare' };
  return (
    <Finestra titolo={`Gestisci accesso · ${titolo}`} icona={<IconaFileW11 tipo={tipoFile(doc)} size={16} />} onChiudi={onChiudi} classe="esp-finestra-piccola">
      {!stato && <p className="esp-nota"><span className="pp-rotella" /> Leggo i permessi su Drive…</p>}
      {stato?.errore && <p className="esp-nota esp-errore" role="alert">{stato.errore}</p>}
      {stato?.permessi && (
        <>
          <ul className="esp-permessi">
            {stato.permessi.map((p) => (
              <li key={p.id}>
                <span><strong>{p.tipo === 'anyone' ? 'Chiunque abbia il link' : p.nome || p.email}</strong>{p.email && p.nome ? <small>{p.email}</small> : null}</span>
                <span className="esp-permesso-ruolo">{ruoli[p.ruolo] || p.ruolo}</span>
                {p.ruolo !== 'owner' && p.tipo !== 'anyone' && <button type="button" className="esp-bottone" disabled={lavoro} onClick={() => chiama({ operazione: 'togli', permesso: p.id })}>Togli</button>}
              </li>
            ))}
          </ul>
          <label className="esp-interruttore">
            <input type="checkbox" checked={!!pubblico} disabled={lavoro || (stato.clinico && !pubblico)} onChange={(e) => chiama({ operazione: 'link', attivo: e.target.checked })} />
            <span>Chiunque abbia il link può vedere{stato.clinico ? ' (non per i documenti dei pazienti)' : ''}</span>
          </label>
          <form className="esp-aggiungi-persona" onSubmit={(e) => { e.preventDefault(); if (email.trim()) setConferma({ email: email.trim(), ruolo }); }}>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email@esempio.it" aria-label="Email della persona" />
            <select value={ruolo} onChange={(e) => setRuolo(e.target.value)} aria-label="Permesso"><option value="reader">Può vedere</option><option value="writer">Può modificare</option></select>
            <button type="submit" className="esp-bottone" disabled={lavoro || !email.trim()}>Aggiungi</button>
          </form>
          {conferma && (
            <div className="esp-conferma" role="alertdialog">
              <p>Dare a <strong>{conferma.email}</strong> il permesso «{ruoli[conferma.ruolo]}» su questo file? Drive non manda email: il link lo invii tu.</p>
              <div className="esp-dialogo-azioni">
                <button type="button" className="esp-bottone" onClick={() => setConferma(null)}>Annulla</button>
                <button type="button" className="esp-bottone esp-bottone-blu" onClick={() => chiama({ operazione: 'aggiungi', email: conferma.email, ruolo: conferma.ruolo }).then(() => setEmail(''))}>Conferma</button>
              </div>
            </div>
          )}
        </>
      )}
    </Finestra>
  );
}

/* ---------- Sposta in… / Duplica in… ---------- */
export function FoglioSpostaIn({ disp, titolo = 'Sposta in…', voci, onScegli, onChiudi }) {
  useEffect(() => {
    const k = (e) => { if (e.key === 'Escape') onChiudi(); };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [onChiudi]);
  return (
    <div className="esp-velo" onClick={onChiudi}>
      <div className={`esp-dialogo esp-dialogo-${disp} esp-sposta`} role="dialog" aria-label={titolo.replace('…', '')} onClick={(e) => e.stopPropagation()}>
        <h2>{titolo}</h2>
        <ul className="esp-sposta-lista">
          {voci.map((v) => (
            <li key={v.id}>
              <button type="button" disabled={v.vietata} onClick={() => onScegli(v.id)} style={{ paddingLeft: 12 + v.livello * 16 }}>
                <IconaCartellaW11 size={18} /><span>{v.nome}</span>{v.attuale && <em>attuale</em>}
              </button>
            </li>
          ))}
        </ul>
        <div className="esp-dialogo-azioni"><button type="button" className="esp-bottone" onClick={onChiudi}>Annulla</button></div>
      </div>
    </div>
  );
}

/* ---------- avvisi: riuscito con Annulla, errore con Riprova ---------- */
export function Avviso({ avviso, onChiudi }) {
  if (!avviso) return null;
  const errore = avviso.tipo === 'errore';
  return (
    <div className={`esp-avviso${errore ? ' errore' : ''}`} role={errore ? 'alert' : 'status'}>
      {errore && <span className="esp-avviso-icona" aria-hidden="true">!</span>}
      <span className="esp-avviso-testo">{avviso.testo}</span>
      {avviso.azione && <button type="button" onClick={() => { const a = avviso.azione; onChiudi(); a.fai(); }}>{avviso.azione.nome}</button>}
      <button type="button" className="esp-avviso-chiudi" onClick={onChiudi} aria-label="Chiudi avviso">✕</button>
    </div>
  );
}
