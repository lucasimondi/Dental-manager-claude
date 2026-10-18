// Agenda — appuntamento dello studio creato, modificato o eliminato da Personal.
import { useEffect, useState } from 'react';
import { tipiAppuntamento, cercaPazienti, salvaAppuntamento, eliminaAppuntamento } from '../../lib/studio.js';
import { oggi, minuti, ora, STATI_APPUNTAMENTO } from '../../lib/agenda.js';
import { IconaCestino } from '../../Icone.jsx';
import { nomeGiorno } from './Agenda.jsx';

export function PaginaAppuntamento({ a, ctx, chiudi }) {
  return <ModuloAppuntamento a={a} ctx={ctx} chiudi={chiudi} />;
}

// Appuntamento dello studio: lo stesso che si vede e si modifica nell'agenda dello studio.
export function ModuloAppuntamento({ a: iniziale, ctx, chiudi }) {
  const { esegui, aggiorna, mostra } = ctx;
  const [tipi, setTipi] = useState([]);
  const [f, setF] = useState(() => ({
    id: iniziale.id || null, paziente_id: iniziale.paziente_id || null, paziente: iniziale.paziente || '',
    data: iniziale.data || oggi(), ora: String(iniziale.ora || '09:00').slice(0, 5), durata: Number(iniziale.durata) || 30,
    tipo: iniziale.tipo || '', colore: iniziale.colore || '', note: iniziale.note || '', stato: iniziale.stato || 'confermato',
  }));
  const [cerca, setCerca] = useState('');
  const [trovati, setTrovati] = useState([]);
  const [conferma, setConferma] = useState(false);
  const [salvando, setSalvando] = useState(false);
  useEffect(() => { tipiAppuntamento().then((t) => {
    setTipi(t);
    setF((x) => (x.tipo ? x : { ...x, tipo: t[0]?.nome || 'Visita', colore: x.colore || t[0]?.colore || '' }));
  }).catch(() => {}); }, []);
  useEffect(() => {
    if (f.paziente_id || cerca.trim().length < 2) { setTrovati([]); return undefined; }
    let vivo = true;
    const t = setTimeout(() => cercaPazienti(cerca).then((r) => vivo && setTrovati(r)).catch(() => {}), 250);
    return () => { vivo = false; clearTimeout(t); };
  }, [cerca, f.paziente_id]);
  const cambia = (k, v) => setF((x) => ({ ...x, [k]: v }));
  const colore = f.colore || tipi.find((t) => t.nome === f.tipo)?.colore || '#0c447c';
  const fine = ora(Math.min(minuti(f.ora) + Number(f.durata || 30), 23 * 60 + 59));
  const valido = !!f.paziente_id && !!f.data && /^\d{2}:\d{2}$/.test(f.ora);
  const salva = () => {
    if (!valido || salvando) return;
    setSalvando(true);
    esegui(async () => {
      try {
        await salvaAppuntamento({ ...f, colore });
        aggiorna(); mostra(f.id ? 'Appuntamento aggiornato' : 'Appuntamento fissato'); chiudi();
      } finally { setSalvando(false); }
    });
  };
  return (
    <>
      <div className="pp-evento-anteprima pp-appuntamento-anteprima" style={{ '--c': colore }}>
        <span className="pp-etichetta">{f.id ? 'Appuntamento dello studio' : 'Nuovo appuntamento dello studio'}</span>
        <strong>{f.paziente || 'Nuovo appuntamento'}</strong>
        <span>{nomeGiorno(f.data)} · {f.ora}–{fine}{f.tipo ? ` · ${f.tipo}` : ''}</span>
      </div>
      {f.paziente_id ? (
        <div className="pp-campo"><span>Paziente</span>
          <div className="pp-voce pp-paziente-scelto"><strong>{f.paziente}</strong>
            {!f.id && <button type="button" className="pp-testo-link" onClick={() => { setF((x) => ({ ...x, paziente_id: null, paziente: '' })); setCerca(''); }}>Cambia</button>}
          </div>
        </div>
      ) : (
        <label className="pp-campo"><span>Paziente</span>
          <input autoFocus value={cerca} onChange={(e) => setCerca(e.target.value)} placeholder="Cerca per nome o cognome" />
        </label>
      )}
      {!f.paziente_id && trovati.length > 0 && (
        <div className="pp-gruppo pp-trovati">
          {trovati.map((p) => {
            const nome = [p.nome, p.cognome].filter(Boolean).join(' ');
            return <button key={p.id} type="button" className="pp-riga" onClick={() => setF((x) => ({ ...x, paziente_id: p.id, paziente: nome }))}><span className="pp-riga-testo"><span className="pp-riga-titolo">{nome}</span></span></button>;
          })}
        </div>
      )}
      {!f.paziente_id && cerca.trim().length >= 2 && !trovati.length && <p className="pp-riga-meta">Nessun paziente trovato. I nuovi pazienti si creano nello studio.</p>}
      <div className="pp-due">
        <label className="pp-campo"><span>Giorno</span><input type="date" value={f.data} onChange={(e) => cambia('data', e.target.value)} /></label>
        <label className="pp-campo"><span>Ora</span><input type="time" step="300" value={f.ora} onChange={(e) => cambia('ora', e.target.value)} /></label>
      </div>
      <div className="pp-due">
        <label className="pp-campo"><span>Durata</span>
          <select className="pp-select" value={f.durata} onChange={(e) => cambia('durata', Number(e.target.value))}>
            {[...new Set([15, 30, 45, 60, 90, 120, Number(f.durata) || 30])].sort((x, y) => x - y).map((d) => <option key={d} value={d}>{d} min</option>)}
          </select>
        </label>
        <label className="pp-campo"><span>Stato</span>
          <select className="pp-select" value={f.stato} onChange={(e) => cambia('stato', e.target.value)}>
            {STATI_APPUNTAMENTO.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </select>
        </label>
      </div>
      <label className="pp-campo"><span>Tipo</span>
        <select className="pp-select" value={f.tipo} onChange={(e) => setF((x) => ({ ...x, tipo: e.target.value, colore: tipi.find((t) => t.nome === e.target.value)?.colore || x.colore }))}>
          {[...new Set([...tipi.map((t) => t.nome), f.tipo].filter(Boolean))].map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
      </label>
      <label className="pp-campo"><span>Note</span><textarea rows={3} value={f.note} onChange={(e) => cambia('note', e.target.value)} /></label>
      <button className="pp-bottone pp-bottone-largo" disabled={!valido || salvando} onClick={salva}>{salvando ? 'Salvataggio…' : f.id ? 'Salva modifiche' : 'Fissa appuntamento'}</button>
      <p className="pp-riga-meta">È l'agenda dello studio: lo vedono subito anche gli altri. Poltrona, operatore e promemoria si scelgono dallo studio.</p>
      {f.id && (
        <div className="pp-elimina">
          {!conferma
            ? <button className="pp-testo-link pp-rosso" onClick={() => setConferma(true)}><IconaCestino size={16} /> Elimina appuntamento</button>
            : (
              <div className="pp-conferma"><span>Eliminare l'appuntamento di {f.paziente || 'questo paziente'}? Sparisce anche dall'agenda dello studio. Per una disdetta puoi anche mettere lo stato "Annullato".</span>
                <button className="pp-bottone pp-bottone-rosso" onClick={() => esegui(async () => { await eliminaAppuntamento(f.id); aggiorna(); mostra('Appuntamento eliminato'); chiudi(); })}>Elimina</button>
                <button className="pp-bottone pp-bottone-chiaro" onClick={() => setConferma(false)}>Annulla</button>
              </div>
            )}
        </div>
      )}
    </>
  );
}
