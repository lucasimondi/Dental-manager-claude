// CONCORDATO › Ipoteche e atti (PO 2026-11-20): le note di trascrizione e iscrizione delle ispezioni ipotecarie,
// dalla più recente, con i beni a cui si riferiscono e quanto è certo il collegamento.
import { useEffect, useMemo, useState } from 'react';
import { archivioDb } from '../../lib/supabasePersonal.js';
import { caricaBeni, caricaFormalita, CERTEZZE, etichettaNatura, NATURE, riferimentoFormalita, tipoBene } from '../../lib/concordato.js';
import { Chips, Vuoto } from '../../ui.jsx';

const FILTRI = [['gravami', 'Contro di te'], ['ipoteche', 'Ipoteche'], ['pignoramenti', 'Pignoramenti e divisioni'], ['favore', 'Successioni'], ['tutte', 'Tutte']];
const passa = (f, filtro) => (filtro === 'tutte' ? true : filtro === 'favore' ? f.verso === 'favore' : filtro === 'gravami' ? f.verso === 'contro'
  : filtro === 'ipoteche' ? f.natura.startsWith('ipoteca') : ['pignoramento', 'domanda_divisione'].includes(f.natura));

export function Atti({ ctx }) {
  const [beni, setBeni] = useState(null), [formalita, setFormalita] = useState(null), [filtro, setFiltro] = useState('gravami'), [aperta, setAperta] = useState(null);
  useEffect(() => { let vivo = true; ctx.esegui(async () => {
    const [b, f] = await Promise.all([caricaBeni(archivioDb), caricaFormalita(archivioDb)]);
    if (vivo) { setBeni(b); setFormalita(f); }
  }); return () => { vivo = false; }; }, [ctx.esegui, ctx.versione]);
  const perId = useMemo(() => Object.fromEntries((beni || []).map((b) => [b.id, b])), [beni]);
  if (!beni || !formalita) return <Vuoto>Carico…</Vuoto>;
  const visibili = formalita.filter((f) => passa(f, filtro)).sort((a, b) => b.data.localeCompare(a.data));
  const contro = formalita.filter((f) => f.verso === 'contro' && !['convenzione', 'cessione'].includes(f.natura));
  return <>
    <p className="pp-cc-spiega">Dalle ispezioni ipotecarie: {contro.length} ipoteche, pignoramenti e domande giudiziali contro di te, più successioni e altri atti. Per ogni atto vedi su quali beni pesa: <strong>certo</strong> quando lo dicono gli atti, <strong>probabile</strong> o <strong>da verificare</strong> quando va confermato con l'ispezione per singolo immobile.</p>
    <Chips voci={FILTRI} attiva={filtro} onScegli={setFiltro} />
    {!visibili.length ? <Vuoto>Nessun atto.</Vuoto> : <ul className="pp-cc-atti">
      {visibili.map((f) => { const lista = (f.beni || []).map((l) => ({ ...l, b: perId[l.id] })).filter((l) => l.b); const certi = lista.filter((l) => l.certezza === 'certo').length;
        return <li key={f.id} className={`pp-cc-atto pp-cc-f-${NATURE[f.natura]?.[1] || 'grigio'}`}>
          <button type="button" aria-expanded={aperta === f.id} onClick={() => setAperta(aperta === f.id ? null : f.id)}>
            <span className="pp-cc-atto-testa"><strong>{etichettaNatura(f.natura)}</strong><span>{new Date(`${f.data}T12:00:00`).toLocaleDateString('it-IT', { day: 'numeric', month: 'short', year: 'numeric' })}</span></span>
            <span className="pp-cc-atto-chi">{f.creditore || f.pubblico_ufficiale}{f.procedura ? ` · ${f.procedura}` : ''}</span>
            <small>{riferimentoFormalita(f)} · {lista.length} {lista.length === 1 ? 'bene' : 'beni'}{lista.length && certi < lista.length ? ` (${certi} certi)` : ''}</small>
          </button>
          {aperta === f.id && <div className="pp-cc-atto-dettagli">
            <p>{f.atto}. {f.pubblico_ufficiale}, rep. {f.repertorio}.</p>
            {f.note && <p className="pp-riga-meta">{f.note}</p>}
            <ul>{lista.map((l) => <li key={l.id}><button type="button" onClick={() => ctx.apri({ tipo: 'concordato-bene', bene: l.b, formalita })}>{l.b.nome || tipoBene(l.b)}</button><em className={`pp-cc-cert-${l.certezza}`}>{CERTEZZE[l.certezza]}</em></li>)}</ul>
          </div>}
        </li>; })}
    </ul>}
    <p className="pp-riga-meta">Fonte: ispezioni ipotecarie «Note del soggetto» (Agenzia delle Entrate, 20/11/2026). Per confermare i collegamenti incerti serve l'ispezione per singolo immobile (o la relazione notarile dell'esecuzione).</p>
  </>;
}
