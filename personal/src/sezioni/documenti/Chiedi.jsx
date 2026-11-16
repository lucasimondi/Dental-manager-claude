// POL-VITA-030 ARCHIVIO-CHIEDI — Documenti: una sola casella che capisce.
// Scrivi come parli ("bollette luce 2025 sopra 100 €", "quanto ho speso di pellet quest'anno"):
// l'interprete sul telefono riconosce anni, mesi, importi e persone (etichette «Ho capito»),
// la ricerca nel database usa sinonimi, accenti, errori di battitura e ordina per pertinenza.
// In cima la risposta (il documento più probabile, o il totale), sotto gli altri.
// Nessun modello: i documenti dei pazienti non escono dall'archivio.
import { useEffect, useMemo, useState } from 'react';
import { archivioDb } from '../../lib/supabasePersonal.js';
import { cercaChiedi, scadenzeAperte } from '../../lib/archivio.js';
import { interpretaDomanda, riepilogoImporti } from '../../lib/interpreta.js';
import { Vuoto, dataBreve, giorniA, titoloDoc, colore } from '../../ui.jsx';
import { IconaCerca, IconaChiudi } from '../../Icone.jsx';
import { ElencoSelezionabile } from './Selezione.jsx';
import { CartelleInCima } from './CartelleMie.jsx';

const euro = (n) => Number(n).toLocaleString('it-IT', { style: 'currency', currency: 'EUR' });
const quandoDoc = (d) => dataBreve(d.data_documento || d.email_data);

function suggerimenti(persone) {
  const s = ['bollette luce quest’anno', 'polizza auto', 'quanto ho speso di pellet quest’anno?', 'tasse anno scorso'];
  if (persone[0]) s.splice(1, 0, `carta d’identità di ${persone[0].split(' ')[0]}`);
  return s;
}

export function VistaChiedi({ ctx, onClassica }) {
  const { esegui, apri, versione, impostazioni } = ctx;
  const elencoPersone = impostazioni?.persone;
  const chiavePersone = (elencoPersone || []).join('|');
  const persone = useMemo(() => elencoPersone || [], [chiavePersone]); // eslint-disable-line react-hooks/exhaustive-deps
  const [testo, setTesto] = useState('');
  const [anchePocoUtili, setAnchePocoUtili] = useState(false);
  const [risultati, setRisultati] = useState(null);
  const [scadenze, setScadenze] = useState(null);
  const [rinfresca, setRinfresca] = useState(0);
  const capito = useMemo(() => interpretaDomanda(testo, { persone }), [testo, persone]);
  const attiva = testo.trim().length > 1 && !capito.vuota;

  useEffect(() => {
    let vivo = true;
    scadenzeAperte(archivioDb, 60).then((r) => { if (vivo) setScadenze((r || []).slice(0, 4)); }).catch(() => { if (vivo) setScadenze([]); });
    return () => { vivo = false; };
  }, [versione]);

  useEffect(() => {
    if (!attiva) { setRisultati(null); return undefined; }
    let vivo = true;
    setRisultati(null);
    const t = setTimeout(() => {
      esegui(async () => {
        const r = await cercaChiedi(archivioDb, { testo: capito.testo, filtri: capito.filtri, anchePocoUtili, limite: capito.somma ? 500 : 200 });
        if (vivo) setRisultati(r);
      });
    }, 300);
    return () => { vivo = false; clearTimeout(t); };
  }, [attiva, capito, anchePocoUtili, esegui, versione, rinfresca]);

  const primo = risultati?.[0];
  const somma = capito.somma && risultati ? riepilogoImporti(risultati) : null;
  const altri = risultati ? (somma ? risultati : risultati.slice(1)) : [];

  return (
    <div className="pp-chiedi">
      {!attiva && <h1 className="pp-chiedi-titolo">Cosa ti serve?</h1>}
      <label className="pp-chiedi-casella">
        <IconaCerca size={22} />
        <input type="search" value={testo} onChange={(e) => setTesto(e.target.value)} placeholder="Scrivi come parli…" enterKeyHint="search" aria-label="Chiedi all'archivio" />
        {testo && <button type="button" className="pp-chiedi-pulisci" aria-label="Cancella" onClick={() => setTesto('')}><IconaChiudi size={16} /></button>}
      </label>

      {!attiva && (
        <>
          <p className="pp-chiedi-etichetta">Prova a chiedere</p>
          <div className="pp-chiedi-suggerimenti">
            {suggerimenti(persone).map((s) => <button key={s} type="button" className="pp-chiedi-sugg" onClick={() => setTesto(s)}>{s}</button>)}
          </div>
          <CartelleInCima ctx={ctx} />
          {scadenze && scadenze.length > 0 && (
            <section className="pp-chiedi-blocco" aria-label="Da fare">
              <h2 className="pp-chiedi-h2">Da fare</h2>
              {scadenze.map((s) => {
                const g = giorniA(s.data);
                const d = new Date(`${s.data}T12:00:00`);
                return (
                  <button key={s.id} type="button" className={`pp-chiedi-dafare${g < 0 ? ' scaduta' : g <= 7 ? ' vicina' : ''}`} disabled={!s.documento_id} onClick={() => s.documento_id && apri({ tipo: 'documento', id: s.documento_id })}>
                    <span className="pp-chiedi-giorno"><strong>{d.getDate()}</strong><span>{d.toLocaleDateString('it-IT', { month: 'short' })}</span></span>
                    <span className="pp-chiedi-dafare-testo">
                      <span className="pp-chiedi-dafare-titolo">{s.descrizione}</span>
                      <span className="pp-chiedi-meta">{g < 0 ? `Scaduta da ${-g} giorni` : g === 0 ? 'Oggi' : `Tra ${g} giorni`}{s.importo ? ` · ${euro(s.importo)}` : ''}</span>
                    </span>
                  </button>
                );
              })}
            </section>
          )}
        </>
      )}

      {attiva && (
        <>
          <div className="pp-chiedi-capito" aria-label="Ho capito">
            <span className="pp-chiedi-etichetta">Ho capito</span>
            <div className="pp-chiedi-chips">{capito.etichette.map((e) => <span key={e} className="pp-chiedi-chip">{e}</span>)}</div>
          </div>

          {!risultati ? <Vuoto>Cerco…</Vuoto> : !risultati.length ? (
            <Vuoto>Nessun documento. Prova con meno parole{capito.etichette.length > 1 ? ' o senza la data o l’importo' : ''}{anchePocoUtili ? '' : ', oppure tocca «Anche poco utili»'}.</Vuoto>
          ) : (
            <>
              <section className="pp-chiedi-risposta" aria-label="Risposta">
                {somma ? (
                  <>
                    <span className="pp-chiedi-cifra">{euro(somma.totale)}</span>
                    <span className="pp-chiedi-sotto">{somma.n === 1 ? '1 documento con importo' : `${somma.n} documenti con importo`}{risultati.length > somma.n ? ` su ${risultati.length} trovati` : ''}</span>
                    {somma.barre.length > 1 && (
                      <div className="pp-chiedi-barre" role="img" aria-label="Importi per mese">
                        {somma.barre.map((b) => (
                          <span key={b.chiave} className="pp-chiedi-barra" title={`${b.etichetta}: ${euro(b.valore)}`}>
                            <span style={{ height: `${b.altezza}%` }} />
                            <em>{b.etichetta}</em>
                          </span>
                        ))}
                      </div>
                    )}
                  </>
                ) : (
                  <>
                    <span className="pp-chiedi-sotto">{risultati.length === 1 ? 'Ho trovato questo' : `Il più probabile su ${risultati.length}${risultati.length >= 200 ? '+' : ''}`}</span>
                    <div className="pp-chiedi-primo" style={{ '--c': colore(primo.fascicolo) }}>
                      <span className="pp-chiedi-foglio" aria-hidden="true"><i /><i /><i /><i /></span>
                      <span className="pp-chiedi-primo-testo">
                        <strong>{titoloDoc(primo)}</strong>
                        <span className="pp-chiedi-meta">{[primo.ente, quandoDoc(primo), primo.importo != null ? euro(primo.importo) : null].filter(Boolean).join(' · ')}</span>
                        {primo.azione_richiesta && primo.azione_descrizione && <span className="pp-chiedi-azione">{primo.azione_descrizione}</span>}
                        <span className="pp-chiedi-bottoni">
                          <button type="button" className="pp-chiedi-apri" onClick={() => apri({ tipo: 'documento', id: primo.id })}>Apri</button>
                          {primo.drive_url && <a className="pp-chiedi-secondario" href={primo.drive_url} target="_blank" rel="noreferrer">Originale</a>}
                        </span>
                      </span>
                    </div>
                  </>
                )}
              </section>
              {altri.length > 0 && (
                <ElencoSelezionabile elenco={altri} ctx={ctx} onCambiato={() => setRinfresca((n) => n + 1)} intestazione={somma ? 'I documenti del totale' : `Altri ${altri.length}`} />
              )}
            </>
          )}
          <div className="pp-filtri">
            <button type="button" className={`pp-filtro${anchePocoUtili ? ' attivo' : ''}`} onClick={() => setAnchePocoUtili(!anchePocoUtili)}>{anchePocoUtili ? 'Anche poco utili ✓' : 'Anche poco utili'}</button>
          </div>
        </>
      )}

      <button type="button" className="pp-chiedi-classica" onClick={onClassica}>Vista classica: cartelle, categorie, pratiche e strumenti</button>
    </div>
  );
}
