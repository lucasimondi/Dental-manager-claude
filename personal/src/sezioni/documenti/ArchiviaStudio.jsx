// ACQUISISCI-UNICO (PO 2026-11-10): dal tasto unico si sceglie dove archiviare. «Studio» salva il PDF
// nei documenti dello studio (bucket privato), legato se serve a un paziente: stessa funzione di Studio
// (acquisisciDocumento) con la sessione dello studio già salvata. Il file non viene letto né analizzato.
import { useEffect, useState } from 'react';
import { sessioneStudio, cercaPazienti, archiviaDocumentoStudio } from '../../lib/studio.js';
import { TIPI_DOCUMENTO } from '../../../../shared/documenti/documentiStudio.js';

export function ArchiviaStudio({ file, titolo, ctx, onFatto }) {
  const { mostra } = ctx;
  const [collegato, setCollegato] = useState(null);
  const [q, setQ] = useState('');
  const [trovati, setTrovati] = useState([]);
  const [paziente, setPaziente] = useState(null);
  const [tipo, setTipo] = useState('referto');
  const [stato, setStato] = useState(null);
  useEffect(() => { let vivo = true; sessioneStudio().then((s) => vivo && setCollegato(!!s)).catch(() => vivo && setCollegato(false)); return () => { vivo = false; }; }, []);
  useEffect(() => {
    if (paziente || q.trim().length < 2) { setTrovati([]); return undefined; }
    let vivo = true;
    const t = setTimeout(() => { cercaPazienti(q).then((r) => vivo && setTrovati((r || []).slice(0, 6))).catch(() => vivo && setTrovati([])); }, 250);
    return () => { vivo = false; clearTimeout(t); };
  }, [q, paziente]);
  const salva = async () => {
    setStato({ invio: true });
    try {
      await archiviaDocumentoStudio({ file, titolo, tipo, pazienteId: paziente?.id || null });
      mostra(`Archiviato in Studio${paziente ? ` · ${paziente.cognome} ${paziente.nome}` : ''}`);
      onFatto?.();
    } catch (e) { setStato({ errore: e.message }); }
  };
  if (collegato === false) return <p className="pp-messaggio pp-messaggio-errore">Studio non collegato a Personal: accedi allo studio da Impostazioni, poi riprova.</p>;
  return (
    <>
      <label className="pp-campo"><span>Paziente (facoltativo)</span>
        {paziente
          ? <span className="pp-scelto pp-paziente-scelto"><strong>{paziente.cognome} {paziente.nome}</strong><button className="pp-testo-link" onClick={() => { setPaziente(null); setQ(''); }}>Cambia</button></span>
          : <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cerca per cognome o nome" aria-label="Cerca paziente" />}
      </label>
      {!paziente && trovati.length > 0 && <div className="pp-elenco-pazienti" role="listbox" aria-label="Pazienti trovati">
        {trovati.map((p) => <button key={p.id} role="option" aria-selected="false" className="pp-riga-paziente" onClick={() => { setPaziente(p); setTrovati([]); }}>{p.cognome} {p.nome}</button>)}
      </div>}
      <div className="pp-campo"><span>Tipo</span>
        <div className="pp-chip-tipi" role="radiogroup" aria-label="Tipo di documento">
          {TIPI_DOCUMENTO.map((t) => <button key={t.id} role="radio" aria-checked={tipo === t.id} className={tipo === t.id ? 'attivo' : ''} onClick={() => setTipo(t.id)}>{t.nome}</button>)}
        </div>
      </div>
      <p className="pp-riga-meta">Il file va nei documenti dello studio{paziente ? ', nella scheda del paziente' : ''}. Non viene letto né analizzato.</p>
      <button className="pp-bottone pp-bottone-largo" disabled={!file || !collegato || stato?.invio} onClick={salva}>{stato?.invio ? 'Salvo nello studio…' : paziente ? `Archivia in Studio · ${paziente.cognome}` : 'Archivia in Studio'}</button>
      {stato?.errore && <p className="pp-messaggio pp-messaggio-errore">{stato.errore}</p>}
    </>
  );
}
