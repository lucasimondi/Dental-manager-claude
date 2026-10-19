// Oggi — il cruscotto: saldo del mese, azioni rapide, agenda di oggi, pagamenti, ultimi documenti, pratiche.
import { useEffect, useState } from 'react';
import { archivioDb } from '../../lib/supabasePersonal.js';
import { conteggiFascicoli, pratiche as caricaPratiche, documentiDaGestire, documentiRecenti, pagamenti as caricaPagamenti, cambiaStatoPratica } from '../../lib/archivio.js';
import { movimentiTra, bilancio, periodo } from '../../lib/conti.js';
import { sessioneStudio, appuntamentiTra, impegniTra } from '../../lib/studio.js';
import { oggi as oggiAgenda } from '../../lib/agenda.js';
import { euro } from '../../lib/coreArchivio.js';
import { oggiIso, Vuoto, Sezione, Gruppo, RigaDocumento, SchedaDocumento, RigaPagamento, ElencoPratiche } from '../../ui.jsx';
import { IconaCalendario, IconaFreccia, IconaFotocamera, IconaEuro, IconaScansiona } from '../../Icone.jsx';
import { ElencoGiorno } from '../agenda/index.jsx';
import { RiquadroSaldo } from '../conti/index.jsx';

/* ---------- Oggi: cruscotto ---------- */
const dataLunga = () => { const t = new Date().toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' }); return t.charAt(0).toUpperCase() + t.slice(1); };

export function VistaOggi({ ctx }) {
  const [dati, setDati] = useState(null);
  const { esegui, apri, vai, pagato, versione, aggiungi } = ctx;
  useEffect(() => {
    esegui(async () => {
      const mese = periodo('mese', oggiIso().slice(0, 7));
      const [tutte, daGestire, recenti, fascicoli, elencoPratiche, movimenti] = await Promise.all([
        caricaPagamenti(archivioDb), documentiDaGestire(archivioDb), documentiRecenti(archivioDb, 10), conteggiFascicoli(archivioDb),
        caricaPratiche(archivioDb), movimentiTra(archivioDb, mese.da, mese.a).catch(() => []),
      ]);
      const limite = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
      const aperte = tutte.filter((s) => !s.completata);
      // Agenda di oggi, se l'agenda dello studio è collegata.
      let agenda = null;
      const collegata = !!(await sessioneStudio().catch(() => null));
      if (collegata) {
        const g = oggiAgenda();
        const [appuntamenti, impegni] = await Promise.all([appuntamentiTra(g, g), impegniTra(g, g)]).catch(() => [null, null]);
        if (appuntamenti) agenda = { appuntamenti, impegni, scadenze: tutte.filter((s) => s.data === g) };
      }
      setDati({
        prossime: aperte.filter((s) => s.data <= limite), aperte, daGestire, recenti, agenda, collegata,
        pratiche: elencoPratiche.filter((p) => ['aperta', 'in_corso'].includes(p.stato)),
        totale: fascicoli.reduce((t, f) => t + Number(f.n || 0), 0), saldo: bilancio(movimenti),
      });
    });
  }, [esegui, versione]);
  if (!dati) return <p className="pp-data-oggi">{dataLunga()}</p>;
  const scaduti = dati.aperte.filter((s) => s.data < oggiIso());
  const entro30 = dati.prossime.reduce((t, s) => t + Number(s.importo || 0), 0);
  const urgenti = [...dati.pratiche].sort((x, y) => (x.urgenza === 'alta' ? -1 : 0) - (y.urgenza === 'alta' ? -1 : 0)
    || String(x.prossima_scadenza || '9999').localeCompare(String(y.prossima_scadenza || '9999')));
  const apriDoc = (d) => apri({ tipo: 'documento', id: d.id });
  return (
    <>
      <p className="pp-data-oggi">{dataLunga()}</p>
      <button className="pp-invito" onClick={() => apri({ tipo: 'revisione' })}><span><strong>Da valutare con Poliedron</strong><br />Pagamenti da verificare, inviti e documenti importanti</span></button>
      <RiquadroSaldo b={dati.saldo} titolo={`Saldo di ${new Date().toLocaleDateString('it-IT', { month: 'long' })}`} onApri={() => vai('conti')} />
      <div className="pp-rapide">
        {[['scansiona', 'Scansiona', IconaScansiona], ['spesa', 'Spesa', IconaEuro], ['incasso', 'Incasso', IconaEuro], ['fotocamera', 'Foto', IconaFotocamera]].map(([id, nome, Icona]) => (
          <button key={id} className={`pp-rapida pp-av-${id}`} onClick={() => aggiungi(id)}><span><Icona size={22} /></span>{nome}</button>
        ))}
      </div>
      <div className="pp-riassunto pp-riassunto-quattro">
        <button className={`pp-tessera${scaduti.length ? ' pp-tessera-allarme' : ''}`} onClick={() => vai('conti', 'dapagare')}>
          <span className="pp-tessera-numero">{scaduti.length}</span><span>{scaduti.length === 1 ? 'pagamento scaduto' : 'pagamenti scaduti'}</span>
        </button>
        <button className="pp-tessera" onClick={() => vai('conti', 'dapagare')}>
          <span className="pp-tessera-numero">{euro(entro30)}</span><span>da pagare entro 30 giorni</span>
        </button>
        <button className="pp-tessera" onClick={() => apri({ tipo: 'elenco', titolo: 'Da gestire', carica: () => documentiDaGestire(archivioDb) })}>
          <span className="pp-tessera-numero">{dati.daGestire.length}</span><span>documenti da gestire</span>
        </button>
        <button className="pp-tessera" onClick={() => vai('documenti', 'pratiche')}>
          <span className="pp-tessera-numero">{dati.pratiche.length}</span><span>pratiche aperte</span>
        </button>
      </div>
      {dati.agenda ? (
        <Sezione titolo="Oggi in agenda" azione={<button className="pp-testo-link" onClick={() => vai('agenda')}>Agenda</button>}>
          <ElencoGiorno giorno={oggiAgenda()} dati={dati.agenda} ctx={ctx} etichette={ctx.impostazioni.etichette} coloriTipi={{}} intestazione={false} />
        </Sezione>
      ) : !dati.collegata && (
        <button className="pp-invito" onClick={() => vai('agenda')}><IconaCalendario size={20} /><span><strong>Collega l'agenda dello studio</strong><br />Appuntamenti ed eventi qui, ogni mattina.</span><IconaFreccia size={16} /></button>
      )}
      <Sezione titolo="Prossimi pagamenti" azione={<button className="pp-testo-link" onClick={() => vai('conti', 'dapagare')}>Tutti</button>}>
        {dati.prossime.length
          ? <Gruppo>{dati.prossime.slice(0, 5).map((s) => <RigaPagamento key={s.id} s={s} onApri={(x) => apri({ tipo: 'pagamento', s: x })} onPagato={pagato} />)}</Gruppo>
          : <Vuoto>Nessun pagamento nei prossimi 30 giorni.</Vuoto>}
      </Sezione>
      <Sezione titolo="Ultimi documenti" azione={<button className="pp-testo-link" onClick={() => vai('documenti')}>Tutti</button>}>
        {dati.recenti.length
          ? <div className="pp-carosello">{dati.recenti.map((d) => <SchedaDocumento key={d.id} doc={d} onApri={apriDoc} />)}</div>
          : <Vuoto>L'archivio si sta riempiendo: lo script importa la posta ogni 10 minuti.</Vuoto>}
      </Sezione>
      {dati.daGestire.length > 0 && (
        <Sezione titolo="Da gestire" azione={dati.daGestire.length > 4 ? <button className="pp-testo-link" onClick={() => apri({ tipo: 'elenco', titolo: 'Da gestire', carica: () => documentiDaGestire(archivioDb) })}>Tutti</button> : null}>
          <Gruppo>{dati.daGestire.slice(0, 4).map((d) => <RigaDocumento key={d.id} doc={d} onApri={apriDoc} />)}</Gruppo>
        </Sezione>
      )}
      {urgenti.length > 0 && (
        <Sezione titolo="Pratiche in corso" azione={<button className="pp-testo-link" onClick={() => vai('documenti', 'pratiche')}>Tutte</button>}>
          <ElencoPratiche elenco={urgenti.slice(0, 4)} onApri={(p) => apri({ tipo: 'pratica', p })}
            onRisolvi={(p) => ctx.esegui(async () => { await cambiaStatoPratica(archivioDb, p.id, 'risolta'); ctx.aggiorna(); ctx.mostra('Pratica risolta'); })} />
        </Sezione>
      )}
      <p className="pp-riga-meta pp-nota-fondo">{dati.totale} documenti in archivio.</p>
    </>
  );
}
