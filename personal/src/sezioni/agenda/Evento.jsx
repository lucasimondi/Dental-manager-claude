import AgendaVisibility from '../../../../shared/agenda/AgendaVisibility.jsx';
// Agenda — nuovo evento o modifica di un evento personale (anche ripetuto: solo questo, successivi, tutti).
import { useState } from 'react';
import { salvaImpegno, salvaImpegni, eliminaImpegno, impegniDellaSerie, aggiornaImpegni, eliminaImpegni } from '../../lib/studio.js';
import {
  daIso, oggi, minuti, ora, generaDateRipetizione, piuGiorni, nomeEtichetta, nuovoIdRipetizione, AMBITI_SERIE, occorrenzeDaToccare, applicaAOccorrenza, giorniTra,
} from '../../lib/agenda.js';
import { IconaCestino } from '../../Icone.jsx';
import { ModuloAppuntamento } from './Appuntamento.jsx';

export function PaginaEvento({ evento: iniziale = {}, cosa: cosaIniziale = 'evento', ctx, chiudi }) {
  const [cosa, setCosa] = useState(cosaIniziale);
  if (!iniziale.id && cosa === 'appuntamento') {
    return (
      <>
        <SceltaNuovo cosa={cosa} setCosa={setCosa} />
        <ModuloAppuntamento a={{ data: iniziale.data_inizio || oggi(), ora: (iniziale.ora_inizio || '09:00').slice(0, 5) }} ctx={ctx} chiudi={chiudi} />
      </>
    );
  }
  return <ModuloEvento iniziale={iniziale} ctx={ctx} chiudi={chiudi} scelta={!iniziale.id && <SceltaNuovo cosa={cosa} setCosa={setCosa} />} />;
}

function SceltaNuovo({ cosa, setCosa }) {
  return (
    <div className="pp-segmenti pp-segmenti-due">
      {[['evento', 'Evento mio'], ['appuntamento', 'Appuntamento paziente']].map(([k, l]) => (
        <button key={k} type="button" className={cosa === k ? 'attivo' : ''} onClick={() => setCosa(k)}>{l}</button>
      ))}
    </div>
  );
}

function ModuloEvento({ iniziale, ctx, chiudi, scelta }) {
  const { esegui, aggiorna, mostra, impostazioni } = ctx;
  const etichette = impostazioni.etichette;
  const [ev, setEv] = useState(() => ({
    titolo: '',
    tipo: etichette[0]?.id || 'personale',
    colore: '',
    data_inizio: oggi(),
    data_fine: iniziale.data_fine || iniziale.data_inizio || oggi(),
    tutto_il_giorno: false,
    ora_inizio: '09:00',
    ora_fine: '10:00',
    note: '',
    ripeti: 'nessuna',
    ripeti_fino: iniziale.data_inizio || oggi(),
    ...iniziale,
    data_fine: iniziale.data_fine || iniziale.data_inizio || oggi(),
    ora_inizio: (iniziale.ora_inizio || '09:00').slice(0, 5),
    ora_fine: (iniziale.ora_fine || iniziale.ora_inizio || '10:00').slice(0, 5),
    ripeti: 'nessuna',
    ripeti_fino: iniziale.data_inizio || oggi(),
    visibile_studio: iniziale.visibile_studio !== false,
    visibile_personal: iniziale.visibile_personal !== false,
  }));
  const [conferma, setConferma] = useState(false);
  const [salvando, setSalvando] = useState(false);
  // Evento di una serie: prima di salvare o eliminare si chiede quali occorrenze toccare.
  const [chiediSerie, setChiediSerie] = useState(null);
  const inSerie = !!(iniziale.id && iniziale.recurrence_id);
  const cambia = (k, v) => setEv((x) => ({ ...x, [k]: v }));
  const etichetta = etichette.find((e) => e.id === ev.tipo || e.nome === ev.tipo);
  const colore = ev.colore || etichetta?.colore || '#64748b';
  const dataFineEvento = ev.data_fine && ev.data_fine >= ev.data_inizio ? ev.data_fine : ev.data_inizio;
  const dataFineRipetizione = ev.ripeti_fino || ev.data_inizio;
  const valido = !!ev.titolo.trim()
    && !!ev.data_inizio
    && dataFineEvento >= ev.data_inizio
    && (ev.tutto_il_giorno || minuti(ev.ora_fine) > minuti(ev.ora_inizio))
    && (ev.id || ev.ripeti === 'nessuna' || dataFineRipetizione >= ev.data_inizio);

  const salva = async (ambito) => {
    if (salvando || !valido) return;
    if (inSerie && !ambito) { setChiediSerie('salva'); return; }
    setSalvando(true);
    try {
      await esegui(async () => {
        const payload = {
          ...ev,
          data_fine: dataFineEvento,
          colore: ev.colore || etichetta?.colore || null,
        };
        if (!ev.id && ev.ripeti && ev.ripeti !== 'nessuna') {
          const date = generaDateRipetizione(ev.data_inizio, dataFineRipetizione, ev.ripeti);
          if (!date.length) throw new Error('Controlla la data finale della ripetizione.');
          const durataGiorni = Math.max(0, Math.round((daIso(dataFineEvento).getTime() - daIso(ev.data_inizio).getTime()) / 86400000));
          const recurrenceId = date.length > 1 ? nuovoIdRipetizione() : null;
          const occorrenze = date.map((data) => ({
            ...payload,
            data_inizio: data,
            data_fine: piuGiorni(data, durataGiorni),
            recurrence_id: recurrenceId,
          }));
          await salvaImpegni(occorrenze);
          aggiorna();
          mostra(date.length > 1 ? 'Creati ' + date.length + ' impegni ricorrenti' : "Evento aggiunto all'agenda");
        } else if (inSerie && ambito && ambito !== 'questo') {
          const serie = await impegniDellaSerie(iniziale.recurrence_id);
          const spostamento = giorniTra(iniziale.data_inizio, payload.data_inizio);
          const daToccare = occorrenzeDaToccare(serie, { ...iniziale, data_inizio_originale: iniziale.data_inizio }, ambito);
          await aggiornaImpegni(daToccare.map((o) => (o.id === ev.id ? payload : applicaAOccorrenza(o, payload, spostamento))));
          aggiorna();
          mostra(`Aggiornati ${daToccare.length} eventi della serie`);
        } else {
          await salvaImpegno(payload);
          aggiorna();
          mostra(ev.id ? 'Evento aggiornato' : "Evento aggiunto all'agenda");
        }
        chiudi();
      });
    } finally {
      setSalvando(false);
    }
  };

  const elimina = (ambito) => esegui(async () => {
    if (inSerie && ambito !== 'questo') {
      const serie = await impegniDellaSerie(iniziale.recurrence_id);
      const ids = occorrenzeDaToccare(serie, { ...iniziale, data_inizio_originale: iniziale.data_inizio }, ambito).map((o) => o.id);
      await eliminaImpegni(ids.includes(ev.id) ? ids : [...ids, ev.id]);
      mostra(`Eliminati ${Math.max(ids.length, 1)} eventi della serie`);
    } else {
      await eliminaImpegno(ev.id);
      mostra('Evento eliminato');
    }
    aggiorna(); chiudi();
  });

  return (
    <>
      {scelta}
      <div className="pp-evento-anteprima" style={{ '--c': colore }}>
        <strong>{ev.titolo || 'Nuovo evento'}</strong>
        <span>{nomeEtichetta(ev.tipo, etichette)}{ev.tutto_il_giorno ? ' · tutto il giorno' : ' · ' + ev.ora_inizio + '–' + ev.ora_fine}</span>
      </div>
      <label className="pp-campo"><span>Titolo</span><input value={ev.titolo} onChange={(e) => cambia('titolo', e.target.value)} placeholder="Es. Calcetto, cena, dentista Giulia" /></label>
      <div className="pp-due">
        <label className="pp-campo"><span>Giorno</span><input type="date" value={ev.data_inizio} onChange={(e) => setEv((x) => {
          const inizio = e.target.value;
          return {
            ...x,
            data_inizio: inizio,
            data_fine: x.data_fine && x.data_fine >= inizio ? x.data_fine : inizio,
            ripeti_fino: x.ripeti_fino && x.ripeti_fino >= inizio ? x.ripeti_fino : inizio,
          };
        })} /></label>
        <label className="pp-campo"><span>Fino al</span><input type="date" value={ev.data_fine || ev.data_inizio} min={ev.data_inizio} onChange={(e) => cambia('data_fine', e.target.value)} /></label>
      </div>
      <label className="pp-interruttore"><input type="checkbox" checked={ev.tutto_il_giorno} onChange={(e) => cambia('tutto_il_giorno', e.target.checked)} /><span>Tutto il giorno</span></label>
      {!ev.tutto_il_giorno && (
        <div className="pp-due">
          <label className="pp-campo"><span>Dalle</span><input type="time" step="300" value={ev.ora_inizio} onChange={(e) => {
            const nuovaInizio = e.target.value;
            const durata = minuti(ev.ora_fine) - minuti(ev.ora_inizio);
            setEv((x) => ({ ...x, ora_inizio: nuovaInizio, ora_fine: ora(Math.min(minuti(nuovaInizio) + Math.max(durata, 15), 23 * 60 + 59)) }));
          }} /></label>
          <label className="pp-campo"><span>Alle</span><input type="time" step="300" value={ev.ora_fine} onChange={(e) => cambia('ora_fine', e.target.value)} /></label>
        </div>
      )}
      {!ev.id && (
        <div className="pp-evento-ripetizione">
          <label className="pp-campo"><span>Ripeti</span>
            <select value={ev.ripeti || 'nessuna'} onChange={(e) => setEv((x) => ({
              ...x,
              ripeti: e.target.value,
              ripeti_fino: e.target.value === 'nessuna' ? '' : (
                x.ripeti === 'nessuna' || !x.ripeti_fino || x.ripeti_fino <= x.data_inizio
                  ? piuGiorni(x.data_inizio, ({ giornaliera: 7, settimanale: 28, quindicinale: 56, mensile: 180 })[e.target.value] || 28)
                  : x.ripeti_fino
              ),
            }))}>
              <option value="nessuna">Non si ripete</option>
              <option value="giornaliera">Ogni giorno</option>
              <option value="settimanale">Ogni settimana</option>
              <option value="quindicinale">Ogni 2 settimane</option>
              <option value="mensile">Ogni mese</option>
            </select>
          </label>
          {ev.ripeti !== 'nessuna' && (
            <label className="pp-campo"><span>Ripeti fino al</span>
              <input type="date" value={ev.ripeti_fino || ev.data_inizio} min={ev.data_inizio} onChange={(e) => cambia('ripeti_fino', e.target.value)} />
            </label>
          )}
        </div>
      )}
      <div className="pp-campo"><span>Etichetta</span>
        <div className="pp-etichette">
          {etichette.map((e) => (
            <button key={e.id} type="button" className={'pp-etichetta-scelta' + ((ev.tipo === e.id || ev.tipo === e.nome) ? ' attiva' : '')} style={{ '--c': e.colore }} onClick={() => setEv((x) => ({ ...x, tipo: e.id, etichetta: e.id, colore: '' }))}>{e.nome}</button>
          ))}
        </div>
      </div>
      <label className="pp-campo"><span>Colore di questo evento</span>
        <input type="color" className="pp-colore" value={colore} onChange={(e) => cambia('colore', e.target.value)} />
      </label>
      <label className="pp-campo"><span>Descrizione / note</span>
        <textarea rows={3} value={ev.note || ''} onChange={(e) => cambia('note', e.target.value)} placeholder="Aggiungi dettagli, luogo o persone coinvolte…" />
      </label>
      <AgendaVisibility value={ev} onChange={flags => setEv(x => ({ ...x, ...flags }))} />
      <button className="pp-bottone pp-bottone-largo" disabled={!valido || salvando} onClick={() => salva()}>{salvando ? 'Salvataggio…' : ev.id ? 'Salva modifiche' : ev.ripeti !== 'nessuna' ? 'Crea impegni' : "Aggiungi all'agenda"}</button>
      <p className="pp-riga-meta">Le modifiche aggiornano lo stesso evento nelle agende selezionate.</p>
      {ev.id && (
        <div className="pp-elimina">
          {!conferma
            ? <button className="pp-testo-link pp-rosso" onClick={() => (inSerie ? setChiediSerie('elimina') : setConferma(true))}><IconaCestino size={16} /> Elimina evento</button>
            : (
              <div className="pp-conferma"><span>Eliminare l'evento? Sparisce anche dall'agenda dello studio.</span>
                <button className="pp-bottone pp-bottone-rosso" onClick={() => elimina('questo')}>Elimina</button>
                <button className="pp-bottone pp-bottone-chiaro" onClick={() => setConferma(false)}>Annulla</button>
              </div>
            )}
        </div>
      )}
      {chiediSerie && (
        <div className="pp-velo" onClick={() => setChiediSerie(null)}>
          <div className="pp-foglio" role="dialog" aria-modal="true" aria-label="Evento ripetuto" onClick={(e) => e.stopPropagation()}>
            <div className="pp-foglio-maniglia" />
            <div className="pp-foglio-testa"><span>{chiediSerie === 'salva' ? 'Modificare anche gli altri eventi?' : 'Eliminare anche gli altri eventi?'}</span></div>
            <div className="pp-foglio-corpo">
              <p className="pp-riga-meta pp-spiegazione">"{iniziale.titolo}" si ripete. {chiediSerie === 'elimina' ? "Gli eventi eliminati spariscono anche dall'agenda dello studio." : "Le modifiche valgono anche nell'agenda dello studio."}</p>
              <div className="pp-gruppo">
                {AMBITI_SERIE.map(([ambito, etichetta]) => (
                  <button key={ambito} className={`pp-riga${chiediSerie === 'elimina' ? ' pp-rosso' : ''}`}
                    onClick={() => { const azione = chiediSerie; setChiediSerie(null); if (azione === 'salva') salva(ambito); else elimina(ambito); }}>
                    <span className="pp-riga-testo"><span className="pp-riga-titolo">{etichetta}</span></span>
                  </button>
                ))}
              </div>
              <button className="pp-bottone pp-bottone-chiaro pp-bottone-largo" onClick={() => setChiediSerie(null)}>Annulla</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

