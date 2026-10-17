// POL-VITA-006 — elementi comuni di Poliedron Personal (usati da App, Conti, Agenda).
import { archivioDb } from './lib/supabasePersonal.js';
import { eCaricato } from './lib/archivio.js';
import { euro } from './lib/coreArchivio.js';
import { useEffect, useState } from 'react';
import { preparaFile, comeFile, condividi } from './lib/condividi.js';
import { IconaFreccia, IconaPratiche, IconaCondividi } from './Icone.jsx';
import { Miniatura } from './Miniatura.jsx';

/* ---------- utilità ---------- */
export const COLORI = {
  identita: '#1F4E79', immobili: '#8B5E34', successione: '#5B4B8A', conti: '#2E7D5B', fiscale: '#B7791F',
  previdenza: '#3C7AA0', utenze: '#5E8C31', riscaldamento: '#C2410C', studio_fornitori: '#2F7F84', studio_fatture_emesse: '#1E8A66',
  legale: '#B42318', assicurazioni: '#8E5079', veicoli: '#4A5A6A', famiglia_scuola: '#C26A1A',
  sanitario_famiglia: '#A63D6B', clinico_pazienti: '#667085', servizi: '#5D6B82', acquisti: '#86704A', altro: '#8A94A3',
};
export const colore = (f) => COLORI[f] || COLORI.altro;
export const dataBreve = (d) => (d ? new Date(String(d).length === 10 ? `${d}T12:00:00` : d).toLocaleDateString('it-IT', { day: 'numeric', month: 'short', year: 'numeric' }) : '');
export const oggiIso = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
export const giorniA = (d) => Math.round((new Date(`${d}T12:00:00`) - new Date(`${oggiIso()}T12:00:00`)) / 86400000);
export const quando = (d) => {
  const g = giorniA(d);
  if (g === 0) return 'oggi';
  if (g === 1) return 'domani';
  if (g === -1) return 'ieri';
  const n = Math.abs(g);
  const durata = n < 60 ? `${n} giorni` : n < 730 ? `${Math.round(n / 30.4)} mesi` : `${Math.round(n / 365.25)} anni`;
  return g < 0 ? `scaduta da ${durata}` : `tra ${durata}`;
};
export const titoloDoc = (d) => d?.titolo || d?.nome_file_originale || d?.email_oggetto || 'Documento';
export const saluto = () => { const h = new Date().getHours(); return h < 13 ? 'Buongiorno' : h < 18 ? 'Buon pomeriggio' : 'Buonasera'; };
export const VISTA_KEY = 'poliedron-personal-vista';
export const leggiVista = () => { try { return localStorage.getItem(VISTA_KEY) || 'oggi'; } catch { return 'oggi'; } };
// Indirizzo dell'app: personal.poliedrasoft.it (dominio proprio) oppure /poliedron/personal/ sul
// sito dello studio. Il link per la password riporta alla stessa pagina da cui è partito.
export const INDIRIZZO_APP = () => `${location.origin}${location.pathname}`;
export const tokenSessione = async () => (await archivioDb.auth.getSession()).data.session?.access_token;


/* ---------- elementi comuni ---------- */
export const Vuoto = ({ children }) => <p className="pp-vuoto">{children}</p>;
export const Sezione = ({ titolo, azione, children }) => (
  <section className="pp-sezione">
    {(titolo || azione) && <div className="pp-sezione-testa">{titolo && <h2>{titolo}</h2>}{azione}</div>}
    {children}
  </section>
);
export const Gruppo = ({ children }) => <div className="pp-gruppo">{children}</div>;

export function RigaDocumento({ doc, onApri }) {
  return (
    <button className="pp-riga" onClick={() => onApri(doc)}>
      <Miniatura doc={doc} colore={colore(doc.fascicolo)} />
      <span className="pp-riga-testo">
        <span className="pp-riga-titolo">{titoloDoc(doc)}</span>
        <span className="pp-riga-meta">{[dataBreve(doc.data_documento || doc.email_data), doc.persona, eCaricato(doc) ? 'caricato da te' : null].filter(Boolean).join(' · ')}</span>
      </span>
      {doc.importo != null && <span className="pp-riga-importo">{euro(doc.importo)}</span>}
      {doc.azione_richiesta && <span className={`pp-pallino pp-${doc.urgenza || 'media'}`} aria-label="Da gestire" />}
      <IconaFreccia size={16} />
    </button>
  );
}

// Scheda con l'anteprima grande del documento (elenchi a griglia e Home).
export function SchedaDocumento({ doc, onApri }) {
  return (
    <button className="pp-scheda-doc" style={{ '--c': colore(doc.fascicolo) }} onClick={() => onApri(doc)}>
      <Miniatura doc={doc} colore={colore(doc.fascicolo)} grande />
      <span className="pp-scheda-doc-testo">
        <span className="pp-scheda-doc-titolo">{titoloDoc(doc)}</span>
        <span className="pp-riga-meta">{dataBreve(doc.data_documento || doc.email_data)}</span>
      </span>
      {doc.importo != null && <span className="pp-scheda-doc-importo">{euro(doc.importo)}</span>}
      {doc.azione_richiesta && <span className={`pp-pallino pp-${doc.urgenza || 'media'} pp-scheda-doc-pallino`} aria-label="Da gestire" />}
    </button>
  );
}

export function RigaPagamento({ s, onApri, onPagato }) {
  const scaduto = !s.completata && s.data < oggiIso();
  const giorno = new Date(`${s.data}T12:00:00`);
  return (
    <div className={`pp-scadenza${scaduto ? ' pp-scadenza-scaduta' : ''}${s.completata ? ' pp-scadenza-fatta' : ''}`}>
      <button className="pp-scadenza-corpo" onClick={() => onApri(s)}>
        <span className="pp-scadenza-data">
          <span className="pp-scadenza-giorno">{giorno.getDate()}</span>
          <span className="pp-scadenza-mese">{giorno.toLocaleDateString('it-IT', { month: 'short' })}</span>
        </span>
        <span className="pp-scadenza-testo">
          <span className="pp-riga-titolo">{s.descrizione}</span>
          <span className="pp-riga-meta">{[s.completata ? 'pagato' : quando(s.data), s.pratica?.titolo || s.documento?.titolo].filter(Boolean).join(' · ')}</span>
        </span>
      </button>
      <div className="pp-scadenza-destra">
        {s.importo != null && <span className="pp-riga-importo">{euro(s.importo)}</span>}
        {onPagato && !s.completata && <button className="pp-chip-azione" onClick={() => onPagato(s)} aria-label={`Segna pagato: ${s.descrizione}`}>Pagato</button>}
      </div>
    </div>
  );
}

export function Chips({ voci, attiva, onScegli }) {
  return (
    <div className="pp-chips" role="tablist">
      {voci.map(([id, nome]) => (
        <button key={id} role="tab" aria-selected={attiva === id} className={`pp-chip${attiva === id ? ' attiva' : ''}`} onClick={() => onScegli(id)}>{nome}</button>
      ))}
    </div>
  );
}

export function Segmenti({ voci, attiva, onScegli }) {
  return (
    <div className="pp-segmenti">
      {voci.map(([k, l]) => <button key={k} className={attiva === k ? 'attivo' : ''} onClick={() => onScegli(k)}>{l}</button>)}
    </div>
  );
}

export function Conferma({ testo, etichetta = 'Elimina', onSi, onNo }) {
  return (
    <div className="pp-conferma" role="alertdialog">
      <span>{testo}</span>
      <button className="pp-bottone pp-bottone-rosso" onClick={onSi}>{etichetta}</button>
      <button className="pp-bottone pp-bottone-chiaro" onClick={onNo}>Annulla</button>
    </div>
  );
}


export function ElencoPratiche({ elenco, onApri }) {
  if (!elenco.length) return <Vuoto>Nessuna pratica.</Vuoto>;
  return (
    <Gruppo>
      {elenco.map((p) => (
        <button key={p.id} className="pp-riga" onClick={() => onApri(p)}>
          <span className="pp-riga-icona" style={{ '--c': colore(p.fascicolo) }}><IconaPratiche size={18} /></span>
          <span className="pp-riga-testo">
            <span className="pp-riga-titolo">{p.titolo}</span>
            <span className="pp-riga-meta">{[`${p.n_documenti} documenti`, p.prossima_scadenza && `scade ${dataBreve(p.prossima_scadenza)}`, p.stato !== 'aperta' && p.stato].filter(Boolean).join(' · ')}</span>
          </span>
          {p.urgenza === 'alta' && <span className="pp-pallino pp-alta" aria-label="Urgente" />}
          <IconaFreccia size={16} />
        </button>
      ))}
    </Gruppo>
  );
}


// Conferma di eliminazione con la scelta di togliere anche i file da Google Drive (Cestino, 30 giorni).
export function ConfermaElimina({ n, onSi, onNo }) {
  const [ancheDrive, setAncheDrive] = useState(false);
  const cosa = n === 1 ? 'il documento' : `${n} documenti`;
  return (
    <div className="pp-conferma" role="alertdialog">
      <span>Eliminare {cosa} dall'archivio?</span>
      <label className="pp-conferma-drive">
        <input type="checkbox" checked={ancheDrive} onChange={(e) => setAncheDrive(e.target.checked)} />
        <span><strong>Elimina anche da Google Drive</strong><br />
          <small>{ancheDrive ? 'I file vanno nel Cestino di Drive: recuperabili per 30 giorni, poi spariscono.' : 'I file restano nel tuo Google Drive.'}</small></span>
      </label>
      <button className="pp-bottone pp-bottone-rosso" onClick={() => onSi(ancheDrive)}>{ancheDrive ? 'Elimina anche da Drive' : 'Elimina'}</button>
      <button className="pp-bottone pp-bottone-chiaro" onClick={onNo}>Annulla</button>
    </div>
  );
}

// POL-VITA-008 — Condividi (foglio di condivisione del sistema). Nel dettaglio il file si prepara
// all'apertura; nelle schede il primo tocco lo prepara e il secondo apre il foglio, perché iOS
// apre la condivisione solo se parte subito dal tocco.
export function BottoneCondividi({ doc, piccolo = false, mostra }) {
  const [file, setFile] = useState(null);
  const [stato, setStato] = useState('pronto');
  useEffect(() => {
    setFile(null);
    if (piccolo || !doc?.drive_file_id) return undefined;
    let vivo = true;
    tokenSessione().then((t) => preparaFile(doc.drive_file_id, t)).then((f) => { if (vivo) setFile(comeFile(f)); }).catch(() => {});
    return () => { vivo = false; };
  }, [doc?.drive_file_id, piccolo]);
  const tocca = async (e) => {
    e.stopPropagation();
    if (piccolo && !file && doc?.drive_file_id && stato !== 'carico' && stato !== 'secondo') {
      setStato('carico');
      try { setFile(comeFile(await preparaFile(doc.drive_file_id, await tokenSessione()))); } catch { /* si condivide il link */ }
      setStato('secondo');
      mostra?.('Pronto: tocca di nuovo per condividere');
      return;
    }
    try {
      const r = await condividi({ titolo: titoloDoc(doc), link: doc.drive_url, file });
      if (r === 'copiato') mostra?.('Link copiato');
      if (r === 'non_disponibile') mostra?.('Condivisione non disponibile su questo dispositivo');
    } catch (err) { mostra?.(`Condivisione non riuscita: ${err.message}`); }
    setStato('pronto');
  };
  if (piccolo) {
    return (
      <span role="button" tabIndex={0} className={`pp-condividi-piccolo${stato === 'secondo' ? ' pronto' : ''}`} onClick={tocca} onKeyDown={(e) => e.key === 'Enter' && tocca(e)} aria-label={`Condividi ${titoloDoc(doc)}`}>
        {stato === 'carico' ? <span className="pp-rotella" /> : <IconaCondividi size={16} />}
      </span>
    );
  }
  return <button className="pp-bottone pp-bottone-chiaro" onClick={tocca}><IconaCondividi size={18} /> Condividi</button>;
}
