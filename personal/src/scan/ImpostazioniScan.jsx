// SCAN-IMPOSTAZIONI (PO 2026-11-12, passo 4) — preferenze di Scan su questo telefono e spazio usato.
import { useEffect, useState } from 'react';
import { LINGUE, PREDEFINITE, leggiImpostazione, salvaImpostazione } from './impostazioniScan.js';
import { elencoDocumenti, cartelleCreate, elencoCartelle, spazioUsato, formatoPeso, nomeAutomatico, pulisciNome } from '../lib/libreria.js';
import { inAppAndroid } from '../lib/nativo.js';

function Interruttore({ chiave, titolo, nota }) {
  const [v, setV] = useState(() => leggiImpostazione(chiave));
  return (
    <label className="scan-impostazione">
      <span><strong>{titolo}</strong>{nota && <small>{nota}</small>}</span>
      <input type="checkbox" role="switch" checked={v} onChange={(e) => { setV(e.target.checked); salvaImpostazione(chiave, e.target.checked); }} />
    </label>
  );
}

export function ImpostazioniScan() {
  const [cartelle, setCartelle] = useState([]);
  const [cartella, setCartella] = useState(() => leggiImpostazione('scan-cartella'));
  const [prefisso, setPrefisso] = useState(() => leggiImpostazione('scan-prefisso'));
  const [lingua, setLingua] = useState(() => leggiImpostazione('scan-lingua'));
  const [spazio, setSpazio] = useState(null);
  const [documenti, setDocumenti] = useState(null);
  useEffect(() => {
    Promise.all([elencoDocumenti(), cartelleCreate()]).then(([d, c]) => { setCartelle(elencoCartelle(d, c)); setDocumenti(d); }).catch(() => {});
    spazioUsato().then(setSpazio);
  }, []);
  const app = inAppAndroid();
  return (
    <div className="scan-impostazioni">
      <h2>Scansione</h2>
      {!app && <Interruttore chiave="scan-raddrizza-auto" titolo="Raddrizza automatico" nota="Trova i bordi del foglio nelle foto (nell'app lo fa lo scanner Google)" />}
      <Interruttore chiave="scan-peso-leggero" titolo="PDF leggero" nota="File più piccoli per Mail e WhatsApp" />
      <Interruttore chiave="scan-ocr" titolo="Testo ricercabile nei PDF" nota={app ? 'Google ML Kit sul telefono' : 'Riconoscimento nel browser, più lento'} />
      <h2>File</h2>
      <label className="scan-impostazione scan-impostazione-campo"><span><strong>Nome delle scansioni</strong><small>Es. «{nomeAutomatico(new Date(), prefisso || PREDEFINITE['scan-prefisso'])}»</small></span>
        <input aria-label="Inizio del nome" value={prefisso} maxLength={40} onChange={(e) => { setPrefisso(e.target.value); salvaImpostazione('scan-prefisso', pulisciNome(e.target.value) || PREDEFINITE['scan-prefisso']); }} />
      </label>
      <label className="scan-impostazione scan-impostazione-campo"><span><strong>Cartella per i file salvati da soli</strong><small>Condivisi, scaricati, archiviati, esportati</small></span>
        <select aria-label="Cartella predefinita" value={cartella} onChange={(e) => { setCartella(e.target.value); salvaImpostazione('scan-cartella', e.target.value); }}>
          {[...new Set([cartella, ...cartelle.map((c) => c.nome)])].map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </label>
      <h2>Traduzione</h2>
      <label className="scan-impostazione scan-impostazione-campo"><span><strong>Lingua di arrivo</strong><small>{app ? 'Google ML Kit, sul telefono' : 'Disponibile nell\'app Android'}</small></span>
        <select aria-label="Lingua di arrivo predefinita" value={lingua} onChange={(e) => { setLingua(e.target.value); salvaImpostazione('scan-lingua', e.target.value); }}>
          {LINGUE.map(([c, n]) => <option key={c} value={c}>{n}</option>)}
        </select>
      </label>
      <h2>Spazio</h2>
      <p className="pp-riga-meta">{documenti ? `${documenti.length} documenti in «I miei documenti»` : '…'}{spazio ? ` · ${formatoPeso(spazio.usato)} usati su questo telefono` : ''}.</p>
      <p className="pp-riga-meta">I documenti restano solo su questo telefono: se cancelli i dati del sito o disinstalli l'app vengono persi. Per tenerli al sicuro archiviali in Personal o salvali sul telefono.</p>
    </div>
  );
}
