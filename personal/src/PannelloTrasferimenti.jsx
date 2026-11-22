// PR #337 §9 — pannello «Trasferimento file» stile Windows 11 (in basso a destra, sopra la barra): le
// operazioni lunghe (caricamenti, Estrai tutto, copie di molti file) con avanzamento e Annulla.
import { useState, useSyncExternalStore } from 'react';
import { trasferimenti, ascoltaTrasferimenti, annullaTrasferimento, togliTrasferimento, togliFiniti, testoAvanzamento } from './lib/trasferimenti.js';

export function PannelloTrasferimenti() {
  const lista = useSyncExternalStore(ascoltaTrasferimenti, trasferimenti);
  const [chiuso, setChiuso] = useState(false);
  if (!lista.length) return null;
  const inCorso = lista.filter((t) => t.stato === 'in_corso').length;
  return (
    <section className={`pt-pannello${chiuso ? ' chiuso' : ''}`} role="region" aria-label="Trasferimento file">
      <header>
        <button type="button" className="pt-titolo" onClick={() => setChiuso((c) => !c)} aria-expanded={!chiuso}>
          {inCorso ? `${inCorso} ${inCorso === 1 ? 'operazione' : 'operazioni'} in corso` : 'Trasferimenti completati'} <span aria-hidden="true">{chiuso ? '▴' : '▾'}</span>
        </button>
        {!inCorso && <button type="button" className="pt-chiudi" onClick={togliFiniti} aria-label="Chiudi il pannello">✕</button>}
      </header>
      {!chiuso && (
        <ul>
          {lista.map((t) => (
            <li key={t.id} className={`pt-voce ${t.stato}`}>
              <div className="pt-riga">
                <strong title={t.nome}>{t.nome}</strong>
                {t.stato === 'in_corso'
                  ? <button type="button" onClick={() => annullaTrasferimento(t.id)} disabled={t.annullato} aria-label={`Annulla ${t.nome}`}>{t.annullato ? 'Annullo…' : 'Annulla'}</button>
                  : <button type="button" onClick={() => togliTrasferimento(t.id)} aria-label={`Togli ${t.nome}`}>✕</button>}
              </div>
              <div className="pt-barra" role="progressbar" aria-valuemin={0} aria-valuemax={t.totale} aria-valuenow={t.fatti} aria-label={t.nome}>
                <span style={{ width: `${t.totale ? Math.round((t.fatti / t.totale) * 100) : 0}%` }} />
              </div>
              <small>{testoAvanzamento(t)}{t.stato === 'in_corso' && t.corrente ? ` · ${t.corrente}` : ''}</small>
              {t.errori?.length > 0 && t.stato !== 'in_corso' && <small className="pt-errore">{t.errori[0]}</small>}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
