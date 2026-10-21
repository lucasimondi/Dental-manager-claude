import { CartelleRisultati } from '../../CartelleRisultati.jsx';
import { AzioniFascicolo } from './AzioniFascicolo.jsx';
// Documenti — pagina di ricerca o elenco (filtri, sezione, oppure un elenco già pronto).
import { useCallback, useEffect, useMemo, useState } from 'react';
import { archivioDb } from '../../lib/supabasePersonal.js';
import { cercaArchivio, documentiSezione } from '../../lib/archivio.js';
import { Vuoto } from '../../ui.jsx';
import { IconaCerca, IconaChiudi } from '../../Icone.jsx';
import { ElencoSelezionabile } from './Selezione.jsx';

export function PaginaRicerca({ filtri: base = {}, sezione, carica, ctx }) {
  const { esegui, versione } = ctx;
  const [testo, setTesto] = useState('');
  const [anchePocoUtili, setAnchePocoUtili] = useState(false);
  const [elenco, setElenco] = useState(null);
  const [rinfresca, setRinfresca] = useState(0);
  const chiave = JSON.stringify(base);
  const leggi = useCallback(async () => {
    if (carica) return carica();
    if (sezione) return documentiSezione(archivioDb, sezione);
    return cercaArchivio(archivioDb, { ...base, testo, anchePocoUtili, limite: 400 });
  }, [carica, sezione, chiave, testo, anchePocoUtili]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const t = setTimeout(() => esegui(async () => setElenco(await leggi())), testo ? 250 : 0);
    return () => clearTimeout(t);
  }, [leggi, esegui, versione, rinfresca, testo]);
  const filtrato = useMemo(() => {
    if (!elenco || !(carica || sezione) || !testo.trim()) return elenco;
    const w = testo.toLowerCase();
    return elenco.filter((d) => `${d.titolo} ${d.ente || ''} ${d.riassunto || ''} ${d.tipo_documento || ''}`.toLowerCase().includes(w));
  }, [elenco, testo, carica, sezione]);
  return (
    <>
      <div className="pp-cerca">
        <IconaCerca size={18} />
        <input type="search" value={testo} onChange={(e) => setTesto(e.target.value)} placeholder="Cerca qui dentro" aria-label="Cerca nell'elenco" />
        {testo && <button type="button" className="pp-cerca-pulisci" aria-label="Cancella" onClick={() => setTesto('')}><IconaChiudi size={16} /></button>}
      </div>
      {!carica && !sezione && !base.fascicolo && !base.ente && (
        <div className="pp-filtri"><button className={`pp-filtro${anchePocoUtili ? ' attivo' : ''}`} onClick={() => setAnchePocoUtili(!anchePocoUtili)}>{anchePocoUtili ? 'Anche poco utili ✓' : 'Anche poco utili'}</button></div>
      )}
      {!filtrato ? <Vuoto>Carico…</Vuoto> : filtrato.length
        ? <><CartelleRisultati documenti={filtrato} ctx={ctx} />{carica && <AzioniFascicolo documenti={filtrato} nome="Documenti di questo elenco" ctx={ctx} />}<ElencoSelezionabile elenco={filtrato} ctx={ctx} onCambiato={() => setRinfresca((n) => n + 1)} /></>
        : <Vuoto>Nessun documento.</Vuoto>}
    </>
  );
}
