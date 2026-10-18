// POL-VITA-006 — Conti: incassi e spese registrati da Luca, pagamenti da fare dall'archivio e
// bilancino del mese o dell'anno. I pagamenti segnati "pagato" diventano spese da soli.
import { useEffect, useMemo, useState } from 'react';
import { archivioDb } from './lib/supabasePersonal.js';
import { pagamenti as caricaPagamenti } from './lib/archivio.js';
import { euro } from './lib/coreArchivio.js';
import {
  movimentiTra, salvaMovimento, eliminaMovimento, nuovaScadenza, bilancio, perMese, periodo, spostaPeriodo,
  CATEGORIE_SPESA, CATEGORIE_INCASSO, importoNumero,
} from './lib/conti.js';
import { Vuoto, Sezione, Gruppo, Segmenti, Conferma, RigaPagamento, oggiIso, dataBreve } from './ui.jsx';
import { IconaIndietro, IconaFreccia, IconaCestino, IconaPiu, IconaFile } from './Icone.jsx';

const meseCorrente = () => oggiIso().slice(0, 7);
const nomePeriodo = (tipo, rif) => {
  if (tipo === 'anno') return rif.slice(0, 4);
  const [a, m] = rif.split('-').map(Number);
  const t = new Date(a, m - 1, 1).toLocaleDateString('it-IT', { month: 'long', year: 'numeric' });
  return t.charAt(0).toUpperCase() + t.slice(1);
};
const segno = (m) => (m.tipo === 'entrata' ? '+' : '−');

export function RigaMovimento({ m, onApri }) {
  return (
    <button className={`pp-riga pp-movimento ${m.tipo}`} onClick={() => onApri(m)}>
      <span className="pp-movimento-icona" aria-hidden="true">{m.tipo === 'entrata' ? '↓' : '↑'}</span>
      <span className="pp-riga-testo">
        <span className="pp-riga-titolo">{m.descrizione}</span>
        <span className="pp-riga-meta">{[dataBreve(m.data), m.categoria, m.scadenza_id ? 'da un pagamento' : null].filter(Boolean).join(' · ')}</span>
      </span>
      <span className="pp-riga-importo pp-movimento-importo">{segno(m)}{euro(m.importo)}</span>
    </button>
  );
}

function Periodo({ tipo, rif, onTipo, onRif }) {
  return (
    <>
      <Segmenti voci={[['mese', 'Mese'], ['anno', 'Anno']]} attiva={tipo} onScegli={onTipo} />
      <div className="pp-agenda-testa">
        <button className="pp-icona-bottone" aria-label="Periodo precedente" onClick={() => onRif(spostaPeriodo(tipo, rif, -1))}><IconaIndietro size={20} /></button>
        <span className="pp-agenda-titolo">{nomePeriodo(tipo, rif)}</span>
        <button className="pp-icona-bottone" aria-label="Periodo successivo" onClick={() => onRif(spostaPeriodo(tipo, rif, 1))}><IconaFreccia size={20} /></button>
      </div>
    </>
  );
}

// Riquadro del saldo: usato anche nella Home.
export function RiquadroSaldo({ b, titolo, onApri }) {
  const max = Math.max(b.entrate, b.uscite, 1);
  return (
    <button className="pp-saldo" onClick={onApri} disabled={!onApri}>
      <span className="pp-saldo-titolo">{titolo}</span>
      <span className={`pp-saldo-numero${b.saldo < 0 ? ' negativo' : ''}`}>{b.saldo < 0 ? '−' : ''}{euro(Math.abs(b.saldo))}</span>
      <span className="pp-saldo-righe">
        <span><i className="entrata" style={{ width: `${(b.entrate / max) * 100}%` }} /><b>Entrate</b><em>{euro(b.entrate)}</em></span>
        <span><i className="uscita" style={{ width: `${(b.uscite / max) * 100}%` }} /><b>Uscite</b><em>{euro(b.uscite)}</em></span>
      </span>
    </button>
  );
}

function Barre({ mesi }) {
  const max = Math.max(1, ...mesi.flatMap((m) => [m.entrate, m.uscite]));
  return (
    <div className="pp-barre" role="img" aria-label="Entrate e uscite per mese">
      {mesi.map((m) => (
        <div key={m.mese} className="pp-barre-mese" title={`${m.mese}: +${euro(m.entrate)} −${euro(m.uscite)}`}>
          <div className="pp-barre-coppia">
            <i className="entrata" style={{ height: `${(m.entrate / max) * 100}%` }} />
            <i className="uscita" style={{ height: `${(m.uscite / max) * 100}%` }} />
          </div>
          <span>{new Date(`${m.mese}-15`).toLocaleDateString('it-IT', { month: 'narrow' })}</span>
        </div>
      ))}
    </div>
  );
}

function Categorie({ voci, totale, tipo }) {
  if (!voci.length) return <Vuoto>Nessun movimento.</Vuoto>;
  return (
    <Gruppo>
      {voci.map((v) => (
        <div key={v.categoria} className="pp-categoria">
          <span className="pp-categoria-testa"><span>{v.categoria}</span><strong>{euro(v.totale)}</strong></span>
          <span className="pp-categoria-barra"><i className={tipo} style={{ width: `${totale ? (v.totale / totale) * 100 : 0}%` }} /></span>
        </div>
      ))}
    </Gruppo>
  );
}

export function VistaConti({ ctx }) {
  const { esegui, apri, pagato, versione, sotto } = ctx;
  const [scheda, setScheda] = useState(['dapagare', 'bilancio'].includes(sotto) ? sotto : 'movimenti');
  const [tipo, setTipo] = useState('mese');
  const [rif, setRif] = useState(meseCorrente);
  const [movimenti, setMovimenti] = useState(null);
  const [anno, setAnno] = useState(null);
  const [scadenze, setScadenze] = useState(null);
  const [filtro, setFiltro] = useState('aperti');

  useEffect(() => {
    // I promemoria delle cartelle senza importo non sono pagamenti (POL-VITA-014): restano in Agenda e Oggi.
    if (scheda === 'dapagare') { esegui(async () => setScadenze((await caricaPagamenti(archivioDb)).filter((s) => !(s.cartella && s.importo == null)))); return; }
    const { da, a } = periodo(tipo, rif);
    esegui(async () => {
      setMovimenti(await movimentiTra(archivioDb, da, a));
      if (scheda === 'bilancio') { const y = periodo('anno', rif); setAnno(await movimentiTra(archivioDb, y.da, y.a)); }
    });
  }, [scheda, tipo, rif, esegui, versione]);

  const b = useMemo(() => bilancio(movimenti || []), [movimenti]);
  const apriM = (m) => apri({ tipo: 'movimento', m });

  return (
    <>
      <Segmenti voci={[['movimenti', 'Movimenti'], ['dapagare', 'Da pagare'], ['bilancio', 'Bilancio']]} attiva={scheda} onScegli={setScheda} />
      {scheda !== 'dapagare' && <Periodo tipo={tipo} rif={rif} onTipo={setTipo} onRif={setRif} />}

      {scheda === 'movimenti' && movimenti && (
        <>
          <RiquadroSaldo b={b} titolo={`Saldo · ${nomePeriodo(tipo, rif)}`} onApri={() => setScheda('bilancio')} />
          <div className="pp-azioni pp-azioni-due">
            <button className="pp-bottone pp-bottone-verde" onClick={() => apri({ tipo: 'movimento', m: { tipo: 'entrata' } })}><IconaPiu size={18} /> Incasso</button>
            <button className="pp-bottone pp-bottone-rosso" onClick={() => apri({ tipo: 'movimento', m: { tipo: 'uscita' } })}><IconaPiu size={18} /> Spesa</button>
          </div>
          {movimenti.length
            ? Object.entries(movimenti.reduce((g, m) => { (g[m.data] ||= []).push(m); return g; }, {})).map(([giorno, xs]) => (
              <Sezione key={giorno} titolo={dataBreve(giorno)}>
                <Gruppo>{xs.map((m) => <RigaMovimento key={m.id} m={m} onApri={apriM} />)}</Gruppo>
              </Sezione>
            ))
            : <Vuoto>Nessun movimento in questo periodo. Registra un incasso o una spesa, oppure segna "Pagato" un pagamento: diventa una spesa da solo.</Vuoto>}
        </>
      )}

      {scheda === 'bilancio' && movimenti && (
        <>
          <RiquadroSaldo b={b} titolo={`Bilancio · ${nomePeriodo(tipo, rif)}`} />
          {anno && (
            <Sezione titolo={`Mese per mese · ${rif.slice(0, 4)}`}>
              <div className="pp-pannello"><Barre mesi={perMese(anno, rif.slice(0, 4))} />
                <p className="pp-legenda pp-riga-meta"><i className="entrata" /> Entrate <i className="uscita" /> Uscite</p></div>
            </Sezione>
          )}
          <Sezione titolo="Dove vanno i soldi"><Categorie voci={b.speseCategoria} totale={b.uscite} tipo="uscita" /></Sezione>
          <Sezione titolo="Da dove arrivano"><Categorie voci={b.incassiCategoria} totale={b.entrate} tipo="entrata" /></Sezione>
        </>
      )}

      {scheda === 'dapagare' && scadenze && <DaPagare tutti={scadenze} filtro={filtro} setFiltro={setFiltro} apri={apri} pagato={pagato} />}
    </>
  );
}

function DaPagare({ tutti, filtro, setFiltro, apri, pagato }) {
  const aperti = tutti.filter((s) => !s.completata);
  const oggi = oggiIso();
  const tra30 = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
  const totale = aperti.reduce((t, s) => t + Number(s.importo || 0), 0);
  const scaduti = aperti.filter((s) => s.data < oggi);
  const apriP = (s) => apri({ tipo: 'pagamento', s });
  const gruppo = (titolo, elenco) => {
    if (!elenco.length) return null;
    const somma = elenco.reduce((t, s) => t + Number(s.importo || 0), 0);
    return (
      <Sezione key={titolo} titolo={titolo} azione={somma > 0 ? <span className="pp-riga-meta">{euro(somma)}</span> : null}>
        <Gruppo>{elenco.map((s) => <RigaPagamento key={s.id} s={s} onApri={apriP} onPagato={pagato} />)}</Gruppo>
      </Sezione>
    );
  };
  return (
    <>
      <div className="pp-riassunto">
        <div className="pp-tessera pp-tessera-forte"><span className="pp-tessera-numero">{euro(totale)}</span><span>da pagare</span></div>
        <div className="pp-tessera"><span className="pp-tessera-numero">{scaduti.length}</span><span>{scaduti.length === 1 ? 'pagamento scaduto' : 'pagamenti scaduti'}</span></div>
      </div>
      <button className="pp-riga pp-riga-aggiungi pp-riga-sola" onClick={() => apri({ tipo: 'scadenza' })}><IconaPiu size={18} /><span>Aggiungi un pagamento da fare</span></button>
      <Segmenti voci={[['aperti', 'Da pagare'], ['pagati', 'Pagati'], ['tutti', 'Tutti']]} attiva={filtro} onScegli={setFiltro} />
      {filtro === 'aperti' && (aperti.length ? [
        gruppo('Scaduti', scaduti),
        gruppo('Prossimi 30 giorni', aperti.filter((s) => s.data >= oggi && s.data <= tra30)),
        gruppo('Più avanti', aperti.filter((s) => s.data > tra30)),
      ] : <Vuoto>Nessun pagamento da fare.</Vuoto>)}
      {filtro === 'pagati' && (tutti.some((s) => s.completata)
        ? <Gruppo>{[...tutti].filter((s) => s.completata).reverse().map((s) => <RigaPagamento key={s.id} s={s} onApri={apriP} />)}</Gruppo>
        : <Vuoto>Nessun pagamento segnato come pagato.</Vuoto>)}
      {filtro === 'tutti' && (tutti.length
        ? <Gruppo>{[...tutti].reverse().map((s) => <RigaPagamento key={s.id} s={s} onApri={apriP} onPagato={pagato} />)}</Gruppo>
        : <Vuoto>Nessun pagamento in archivio.</Vuoto>)}
    </>
  );
}

/* ---------- incasso o spesa: nuovo o modifica ---------- */
export function PaginaMovimento({ m: iniziale, ctx, chiudi }) {
  const { esegui, aggiorna, mostra, apri, impostazioni } = ctx;
  const [m, setM] = useState(() => ({ data: oggiIso(), importo: '', descrizione: '', categoria: '', note: '', ...iniziale, importo: iniziale.importo ?? '' }));
  const [conferma, setConferma] = useState(false);
  const entrata = m.tipo === 'entrata';
  const categorie = entrata ? (impostazioni.categorieIncasso || CATEGORIE_INCASSO) : (impostazioni.categorieSpesa || CATEGORIE_SPESA);
  const valido = importoNumero(m.importo) > 0 && /^\d{4}-\d{2}-\d{2}$/.test(m.data);
  const salva = () => esegui(async () => {
    await salvaMovimento(archivioDb, m);
    aggiorna(); mostra(m.id ? 'Movimento aggiornato' : entrata ? 'Incasso registrato' : 'Spesa registrata'); chiudi();
  });
  return (
    <>
      <Segmenti voci={[['uscita', 'Spesa'], ['entrata', 'Incasso']]} attiva={m.tipo || 'uscita'} onScegli={(t) => setM({ ...m, tipo: t, categoria: '' })} />
      <label className="pp-campo pp-campo-importo"><span>Importo (€)</span>
        <input inputMode="decimal" autoFocus={!m.id} value={m.importo} onChange={(e) => setM({ ...m, importo: e.target.value })} placeholder="0,00" />
      </label>
      <label className="pp-campo"><span>Descrizione</span>
        <input value={m.descrizione} onChange={(e) => setM({ ...m, descrizione: e.target.value })} placeholder={entrata ? 'Es. Stipendio, rimborso' : 'Es. Spesa al supermercato'} />
      </label>
      <div className="pp-due">
        <label className="pp-campo"><span>Data</span><input type="date" value={m.data} onChange={(e) => setM({ ...m, data: e.target.value })} /></label>
        <label className="pp-campo"><span>Categoria</span>
          <select className="pp-select" value={m.categoria || ''} onChange={(e) => setM({ ...m, categoria: e.target.value })}>
            <option value="">—</option>
            {[...new Set([...categorie, ...(m.categoria ? [m.categoria] : [])])].map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </label>
      </div>
      <label className="pp-campo"><span>Note</span><input value={m.note || ''} onChange={(e) => setM({ ...m, note: e.target.value })} placeholder="facoltative" /></label>
      {m.documento?.id && (
        <Sezione titolo="Documento collegato">
          <Gruppo>
            <button className="pp-riga" onClick={() => apri({ tipo: 'documento', id: m.documento.id })}>
              <span className="pp-riga-icona" style={{ '--c': '#0c447c' }}><IconaFile size={18} /></span>
              <span className="pp-riga-testo"><span className="pp-riga-titolo">{m.documento.titolo}</span><span className="pp-riga-meta">Apri il documento</span></span>
              <IconaFreccia size={16} />
            </button>
          </Gruppo>
        </Sezione>
      )}
      <button className={`pp-bottone pp-bottone-largo ${entrata ? 'pp-bottone-verde' : ''}`} disabled={!valido} onClick={salva}>{m.id ? 'Salva' : entrata ? 'Registra incasso' : 'Registra spesa'}</button>
      {m.id && (
        <div className="pp-elimina">
          {!conferma
            ? <button className="pp-testo-link pp-rosso" onClick={() => setConferma(true)}><IconaCestino size={16} /> Elimina il movimento</button>
            : <Conferma testo="Eliminare questo movimento?" onNo={() => setConferma(false)}
              onSi={() => esegui(async () => { await eliminaMovimento(archivioDb, m.id); aggiorna(); mostra('Movimento eliminato'); chiudi(); })} />}
        </div>
      )}
    </>
  );
}

/* ---------- pagamento da fare inserito a mano ---------- */
export function PaginaNuovaScadenza({ ctx, chiudi }) {
  const { esegui, aggiorna, mostra } = ctx;
  const [s, setS] = useState({ data: oggiIso(), descrizione: '', importo: '' });
  const salva = () => esegui(async () => { await nuovaScadenza(archivioDb, s); aggiorna(); mostra('Pagamento aggiunto'); chiudi(); });
  return (
    <>
      <label className="pp-campo"><span>Cosa devi pagare</span><input autoFocus value={s.descrizione} onChange={(e) => setS({ ...s, descrizione: e.target.value })} placeholder="Es. Rata assicurazione auto" /></label>
      <div className="pp-due">
        <label className="pp-campo"><span>Entro il</span><input type="date" value={s.data} onChange={(e) => setS({ ...s, data: e.target.value })} /></label>
        <label className="pp-campo"><span>Importo (€)</span><input inputMode="decimal" value={s.importo} onChange={(e) => setS({ ...s, importo: e.target.value })} placeholder="facoltativo" /></label>
      </div>
      <p className="pp-riga-meta">Compare in Da pagare, in Agenda e nella Home. Quando lo segni pagato diventa una spesa.</p>
      <button className="pp-bottone pp-bottone-largo" disabled={!s.descrizione.trim() || !s.data} onClick={salva}>Aggiungi</button>
    </>
  );
}
