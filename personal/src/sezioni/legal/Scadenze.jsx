// LEGAL-SCHEDE (PO 2026-11-18): tabella delle scadenze legali ed economiche. Una riga per scadenza (i doppioni
// dei vari documenti uniti), le perentorie in rosso con i giorni che mancano, le date in conflitto segnalate.
import { useEffect, useState } from 'react';
import { archivioDb } from '../../lib/supabasePersonal.js';
import { scadenzeLegali, segnaScadenzeFatte } from '../../lib/legal.js';
import { euro } from '../../lib/coreArchivio.js';
import { Chips, Vuoto } from '../../ui.jsx';

const ETICHETTA = { perentoria: 'Perentoria', udienza: 'Udienza', pagamento: 'Pagamento', altro: 'Scadenza' };
const dataCorta = (d) => new Date(`${d}T12:00:00`).toLocaleDateString('it-IT', { day: 'numeric', month: 'short' });
export const mancano = (g) => (g <= 0 ? 'oggi' : g === 1 ? 'domani' : `${g} gg`);

export function TabellaScadenze({ ctx }) {
  const [elenco, setElenco] = useState(null), [ambito, setAmbito] = useState('tutte'), [giorni, setGiorni] = useState(60);
  useEffect(() => { let vivo = true; ctx.esegui(async () => { const r = await scadenzeLegali(archivioDb, { giorni }); if (vivo) setElenco(r); }); return () => { vivo = false; }; }, [ctx.esegui, ctx.versione, giorni]);
  const visibili = (elenco || []).filter((s) => ambito === 'tutte' || s.ambito === ambito);
  const fatta = (s) => ctx.esegui(async () => { await segnaScadenzeFatte(archivioDb, s.ids); setElenco((e) => e.filter((x) => x !== s)); ctx.aggiorna?.(); ctx.mostra?.('Segnata come fatta'); });
  const apri = (s) => (s.pratica_id ? ctx.apri({ tipo: 'pratica', p: { id: s.pratica_id, titolo: s.pratica } }) : s.documento_id && ctx.apri({ tipo: 'documento', id: s.documento_id }));
  return (
    <section className="pp-legal-scadenze" aria-label="Scadenze legali ed economiche">
      <div className="pp-legal-testa"><h3>Scadenze</h3>
        <select className="pp-select pp-legal-periodo" aria-label="Periodo" value={giorni} onChange={(e) => setGiorni(Number(e.target.value))}>
          {[30, 60, 120, 365].map((g) => <option key={g} value={g}>{g === 365 ? 'Un anno' : `${g} giorni`}</option>)}
        </select>
      </div>
      <Chips voci={[['tutte', 'Tutte'], ['legale', 'Legali'], ['economico', 'Economiche']]} attiva={ambito} onScegli={setAmbito} />
      {!elenco ? <Vuoto>Carico…</Vuoto> : !visibili.length ? <Vuoto>Nessuna scadenza nel periodo.</Vuoto> : (
        <ul className="pp-legal-lista">
          {visibili.map((s) => (
            <li key={s.ids.join()} className={`pp-legal-riga pp-tipo-${s.tipo}${s.giorni <= 7 ? ' pp-vicina' : ''}`}>
              <button type="button" className="pp-legal-quando" onClick={() => apri(s)} aria-label={`${dataCorta(s.data)}, ${mancano(s.giorni)}: ${s.descrizione}`}>
                <strong>{dataCorta(s.data)}</strong><span>{mancano(s.giorni)}</span>
              </button>
              <button type="button" className="pp-legal-cosa" onClick={() => apri(s)}>
                <span className="pp-legal-tipo">{ETICHETTA[s.tipo]}{s.ambito === 'economico' ? ' · economica' : ''}</span>
                <span className="pp-legal-desc">{s.descrizione}</span>
                <span className="pp-legal-rif">{s.titolo}{s.importo != null ? ` · ${euro(s.importo)}` : ''}{s.fonti > 1 ? ` · da ${s.fonti} documenti` : ''}</span>
                {s.altre_date.length > 0 && <span className="pp-legal-conflitto">⚠ Nei documenti c'è anche {s.altre_date.map(dataCorta).join(', ')}: tengo la data più vicina.</span>}
              </button>
              <button type="button" className="pp-legal-fatta" aria-label="Segna come fatta" onClick={() => fatta(s)}>✓</button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
