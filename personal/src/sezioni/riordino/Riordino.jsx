// POL-VITA-ORDINA fase 2 — «Piano di riordino», da telefono. Le proposte di Claude Code raggruppate per
// cartella di destinazione: tocco su una riga = anteprima e tasti Approva / Cambia cartella / Rinomina /
// Rifiuta; «Approva tutto il gruppo» e «Approva tutto ≥ 0,85». Giallo = confidenza fra 0,60 e 0,85.
// Qui si decide e basta: niente si sposta su Drive finché non parte la fase 3 (solo righe approvate).
import { useCallback, useEffect, useMemo, useState } from 'react';
import { archivioDb } from '../../lib/supabasePersonal.js';
import { Vuoto, Chips, Conferma, tokenSessione } from '../../ui.jsx';
import {
  caricaPiano, caricaCategorie, approva, rifiuta, riproponi, rinomina, cambiaCartella, importaPiano,
  riepilogo, filtra, raggruppa, radici, livello, confidenzaTesto, controllaNome, FILTRI, SOGLIA_ALTA,
} from '../../lib/pianoRiordino.js';
import './riordino.css';

const STATI = { proposto: 'Da decidere', approvato: 'Approvato', rifiutato: 'Rifiutato', eseguito: 'Eseguito' };
const MAX_GRUPPI = 60;

function Riga({ x, aperta, onTocca, onAzione, categorie, ctx }) {
  const [modo, setModo] = useState(null); // 'cartella' | 'nome'
  const [valore, setValore] = useState('');
  const errNome = modo === 'nome' ? controllaNome(valore) : null;
  const scelta = modo === 'cartella' ? categorie.find((c) => c.percorso === valore) : null;
  return (
    <li className={`rr-riga rr-${livello(x.confidenza)} rr-stato-${x.stato}${aperta ? ' aperta' : ''}`}>
      <button type="button" className="rr-tocco" onClick={onTocca} aria-expanded={aperta}>
        <span className="rr-nuovo">{x.nome_nuovo}</span>
        <span className="rr-vecchio">da «{x.nome_attuale || 'senza nome'}»{x.percorso_attuale ? ` · ${x.percorso_attuale}` : ''}</span>
        <span className="rr-meta">
          <b className="rr-conf" title="Confidenza">{confidenzaTesto(x.confidenza)}</b>
          {x.stato !== 'proposto' && <b className="rr-chip">{STATI[x.stato]}</b>}
          {x.duplicato_di && <b className="rr-chip">Copia identica</b>}
          {x.scorciatoie?.length > 0 && <b className="rr-chip">+ scorciatoia</b>}
        </span>
      </button>
      {aperta && (
        <div className="rr-dettagli">
          <p className="rr-motivo">{x.motivo}</p>
          {x.scorciatoie?.length > 0 && <p className="rr-motivo">Scorciatoia (non una copia) anche in: {x.scorciatoie.join(', ')}</p>}
          {x.documento_id && <button type="button" className="rr-link" onClick={() => ctx.apri({ tipo: 'documento', id: x.documento_id })}>Anteprima del documento ›</button>}
          {modo === 'nome' && (
            <div className="rr-modifica">
              <label>Nuovo nome<input value={valore} onChange={(e) => setValore(e.target.value)} maxLength={120} autoFocus /></label>
              <small className={errNome ? 'rr-errore' : ''}>{errNome || `${valore.trim().length}/90 · AAAA-MM-GG_Tipo_Soggetto_Dettaglio`}</small>
              <span className="rr-tasti">
                <button type="button" className="pp-bottone" disabled={Boolean(errNome)} onClick={() => onAzione('nome', valore).then(() => setModo(null))}>Salva e approva</button>
                <button type="button" className="pp-bottone pp-bottone-chiaro" onClick={() => setModo(null)}>Annulla</button>
              </span>
            </div>
          )}
          {modo === 'cartella' && (
            <div className="rr-modifica">
              <label>Cartella<input list="rr-cartelle" value={valore} onChange={(e) => setValore(e.target.value)} placeholder="Scrivi per cercare…" autoFocus /></label>
              <small className={scelta ? '' : 'rr-errore'}>{scelta ? 'Cartella della tassonomia' : 'Scegli una cartella dall’elenco'}</small>
              <span className="rr-tasti">
                <button type="button" className="pp-bottone" disabled={!scelta} onClick={() => onAzione('cartella', scelta).then(() => setModo(null))}>Sposta qui e approva</button>
                <button type="button" className="pp-bottone pp-bottone-chiaro" onClick={() => setModo(null)}>Annulla</button>
              </span>
            </div>
          )}
          {!modo && (
            <span className="rr-tasti">
              {x.stato !== 'approvato' && <button type="button" className="pp-bottone" onClick={() => onAzione('approva')}>Approva</button>}
              <button type="button" className="pp-bottone pp-bottone-chiaro" onClick={() => { setValore(''); setModo('cartella'); }}>Cambia cartella</button>
              <button type="button" className="pp-bottone pp-bottone-chiaro" onClick={() => { setValore(x.nome_nuovo); setModo('nome'); }}>Rinomina</button>
              {x.stato !== 'rifiutato' && <button type="button" className="pp-bottone pp-bottone-chiaro" onClick={() => onAzione('rifiuta')}>Rifiuta</button>}
              {x.stato !== 'proposto' && x.stato !== 'eseguito' && <button type="button" className="pp-bottone pp-bottone-chiaro" onClick={() => onAzione('riproponi')}>Da decidere</button>}
            </span>
          )}
        </div>
      )}
    </li>
  );
}

export function VistaRiordino({ ctx, db = archivioDb }) {
  const { esegui, mostra } = ctx;
  const [righe, setRighe] = useState(null);
  const [categorie, setCategorie] = useState([]);
  const [filtro, setFiltro] = useState('da_decidere');
  const [testo, setTesto] = useState('');
  const [radice, setRadice] = useState(null);
  const [aperti, setAperti] = useState(() => new Set());
  const [riga, setRiga] = useState(null);
  const [chiedi, setChiedi] = useState(null);
  const [errore, setErrore] = useState(null);
  const [importo, setImporto] = useState(false);
  const [quanti, setQuanti] = useState(MAX_GRUPPI);

  const carica = useCallback(() => esegui(async () => {
    const [p, c] = await Promise.all([caricaPiano(db), caricaCategorie(db)]);
    setRighe(p); setCategorie(c);
  }), [esegui, db]);
  useEffect(() => { carica(); }, [carica]);

  const r = useMemo(() => riepilogo(righe || []), [righe]);
  const gruppiTutti = useMemo(() => raggruppa(filtra(righe || [], filtro, testo)), [righe, filtro, testo]);
  const indice = useMemo(() => radici(gruppiTutti), [gruppiTutti]);
  const gruppi = radice ? gruppiTutti.filter((g) => g.radice === radice) : gruppiTutti;

  const cambia = (ids, campi) => setRighe((v) => v.map((x) => (ids.includes(x.id) && x.stato !== 'eseguito' ? { ...x, ...campi } : x)));
  const conAnnulla = async (ids, campi, fai, messaggio) => {
    const prima = new Map(righe.filter((x) => ids.includes(x.id)).map((x) => [x.id, x.stato]));
    await fai();
    cambia(ids, campi);
    mostra(messaggio, {
      etichetta: 'Annulla',
      fai: async () => {
        const perStato = {};
        prima.forEach((s, id) => { (perStato[s] ||= []).push(id); });
        for (const [s, lista] of Object.entries(perStato)) {
          await (s === 'approvato' ? approva : s === 'rifiutato' ? rifiuta : riproponi)(db, lista);
          cambia(lista, { stato: s });
        }
        return 'Ripristinato';
      },
    });
  };
  const azione = (x) => (tipo, valore) => esegui(async () => {
    if (tipo === 'approva') return conAnnulla([x.id], { stato: 'approvato' }, () => approva(db, [x.id]), 'Approvato');
    if (tipo === 'rifiuta') return conAnnulla([x.id], { stato: 'rifiutato' }, () => rifiuta(db, [x.id]), 'Rifiutato: il file resta dov’è');
    if (tipo === 'riproponi') return conAnnulla([x.id], { stato: 'proposto' }, () => riproponi(db, [x.id]), 'Di nuovo da decidere');
    if (tipo === 'nome') { await rinomina(db, x.id, valore); cambia([x.id], { nome_nuovo: valore.trim(), stato: 'approvato' }); return mostra('Nome cambiato e approvato'); }
    if (tipo === 'cartella') { await cambiaCartella(db, x.id, valore); cambia([x.id], { percorso_nuovo: valore.percorso, categoria_id: valore.id, stato: 'approvato' }); return mostra(`Spostato in «${valore.percorso}» e approvato`); }
    return null;
  });
  const approvaTutti = (lista, messaggio) => {
    const ids = lista.filter((x) => x.stato === 'proposto').map((x) => x.id);
    if (!ids.length) return;
    setChiedi({ testo: messaggio(ids.length), fai: () => esegui(() => conAnnulla(ids, { stato: 'approvato' }, () => approva(db, ids), `${ids.length} approvati`)) });
  };
  const importa = async () => {
    setImporto(true); setErrore(null);
    try {
      const esito = await importaPiano({ token: await tokenSessione() });
      mostra(`Piano caricato: ${esito.righe} file, ${esito.categorie} cartelle`);
      await carica();
    } catch (e) { setErrore(e.message); } finally { setImporto(false); }
  };

  if (!righe) return <Vuoto>Carico il piano…</Vuoto>;
  if (!righe.length) {
    return (
      <div className="rr-vista">
        <section className="rr-carta">
          <h2>Piano di riordino</h2>
          <p>Claude Code ha preparato la proposta per tutto l’archivio (cartelle 00–13 e 99, nomi AAAA-MM-GG_Tipo_Soggetto_Dettaglio). Caricala per decidere riga per riga. Nessun file viene spostato.</p>
          {errore && <p className="rr-errore" role="alert">{errore}</p>}
          <button type="button" className="pp-bottone" disabled={importo} onClick={importa}>{importo ? 'Carico…' : 'Carica il piano proposto'}</button>
        </section>
      </div>
    );
  }
  return (
    <div className="rr-vista">
      <datalist id="rr-cartelle">{categorie.map((c) => <option key={c.id} value={c.percorso} />)}</datalist>
      <section className="rr-carta rr-riepilogo" aria-label="Riepilogo">
        <div className="rr-numeri">
          <span><b>{r.proposto}</b>da decidere</span>
          <span><b>{r.approvato}</b>approvati</span>
          <span><b>{r.rifiutato}</b>rifiutati</span>
        </div>
        <p className="rr-criteri">
          {r.totale} file · in «99 Da verificare» {r.percDaVerificare.toLocaleString('it-IT')}% (obiettivo ≤ 5%) · nomi conformi {r.percConformi.toLocaleString('it-IT')}% (obiettivo ≥ 95%)
        </p>
        <p className="rr-criteri">Approvare non sposta nulla: lo spostamento su Drive arriva dopo, a lotti di 100 annullabili.</p>
        {r.alte > 0 && (
          <button type="button" className="pp-bottone" onClick={() => approvaTutti(righe.filter((x) => Number(x.confidenza) >= SOGLIA_ALTA), (n) => `Approvare ${n} proposte con confidenza ≥ 0,85?`)}>
            Approva tutto ≥ 0,85 ({r.alte})
          </button>
        )}
        {chiedi && <Conferma testo={chiedi.testo} etichetta="Approva" onSi={() => { chiedi.fai(); setChiedi(null); }} onNo={() => setChiedi(null)} />}
      </section>

      <Chips voci={FILTRI.map((f) => [f.id, f.nome])} attiva={filtro} onScegli={(f) => { setFiltro(f); setQuanti(MAX_GRUPPI); }} />
      <input className="rr-cerca" type="search" placeholder="Cerca nome, cartella o motivo" value={testo} onChange={(e) => { setTesto(e.target.value); setQuanti(MAX_GRUPPI); }} aria-label="Cerca nel piano" />
      <div className="rr-indice" role="tablist" aria-label="Cartelle principali">
        <button type="button" role="tab" aria-selected={!radice} className={!radice ? 'attiva' : ''} onClick={() => setRadice(null)}>Tutte</button>
        {indice.map((i) => (
          <button key={i.nome} type="button" role="tab" aria-selected={radice === i.nome} className={radice === i.nome ? 'attiva' : ''} onClick={() => { setRadice(radice === i.nome ? null : i.nome); setQuanti(MAX_GRUPPI); }}>
            {i.nome.slice(0, 2)}<small>{i.n}</small>
          </button>
        ))}
      </div>

      {!gruppi.length && <Vuoto>Nessuna riga in questo filtro.</Vuoto>}
      {gruppi.slice(0, quanti).map((g) => {
        const aperto = aperti.has(g.percorso);
        return (
          <section key={g.percorso} className={`rr-gruppo rr-${livello(g.media)}`}>
            <header>
              <button type="button" className="rr-testa" aria-expanded={aperto} onClick={() => setAperti((s) => { const n = new Set(s); n.has(g.percorso) ? n.delete(g.percorso) : n.add(g.percorso); return n; })}>
                <span className="rr-percorso">{g.percorso}</span>
                <small>{g.voci.length} file · media {confidenzaTesto(g.media)}{g.daDecidere ? ` · ${g.daDecidere} da decidere` : ''}</small>
              </button>
              {g.daDecidere > 0 && (
                <button type="button" className="pp-bottone pp-bottone-chiaro rr-tutto" onClick={() => approvaTutti(g.voci, (n) => `Approvare ${n} proposte in «${g.percorso}»?`)}>Approva tutto il gruppo</button>
              )}
            </header>
            {aperto && (
              <ul>
                {g.voci.map((x) => (
                  <Riga key={x.id} x={x} ctx={ctx} categorie={categorie} aperta={riga === x.id} onTocca={() => setRiga(riga === x.id ? null : x.id)} onAzione={azione(x)} />
                ))}
              </ul>
            )}
          </section>
        );
      })}
      {gruppi.length > quanti && <button type="button" className="pp-bottone pp-bottone-chiaro rr-altri" onClick={() => setQuanti((q) => q + MAX_GRUPPI)}>Mostra altre {Math.min(MAX_GRUPPI, gruppi.length - quanti)} cartelle</button>}
    </div>
  );
}
