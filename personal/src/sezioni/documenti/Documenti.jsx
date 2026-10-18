// POL-VITA-007 — Documenti: ricerca immediata con filtri (categoria, ente, anno, tipo, persona),
// cartelle per ente (POL-VITA-016, vista principale), categorie, pratiche; le cose poco utili (pubblicità, foto, catene) restano
// nascoste finché non le chiedi. Selezione multipla (tieni premuto o "Seleziona") con azioni di
// massa: sposta, importanza, ente, persona, Personali, elimina.
import { useEffect, useState } from 'react';
import { archivioDb } from '../../lib/supabasePersonal.js';
import { cercaArchivio, enti as caricaEnti, pratiche as caricaPratiche } from '../../lib/archivio.js';
import { VistaCartelle } from './Cartelle.jsx';
import { colore, Vuoto, Sezione, Gruppo, Chips, Segmenti, ElencoPratiche } from '../../ui.jsx';
import { IconaCerca, IconaChiudi, IconaDocumenti, IconaFreccia, IconaStella, IconaFoto } from '../../Icone.jsx';
import { ElencoSelezionabile } from './Selezione.jsx';
import { BarraFiltri, filtriVuoti, conFiltri } from './Filtri.jsx';

/* ---------- vista Documenti ---------- */
export function VistaDocumenti({ ctx }) {
  const { esegui, apri, versione, impostazioni, fascicoli, sotto } = ctx;
  const [scheda, setScheda] = useState(sotto === 'enti' ? 'cartelle' : sotto || 'cartelle');
  const [testo, setTesto] = useState('');
  const [filtri, setFiltri] = useState(filtriVuoti);
  const [risultati, setRisultati] = useState(null);
  const [elencoEnti, setElencoEnti] = useState(null);
  const [elencoPratiche, setElencoPratiche] = useState(null);
  const [filtroPratiche, setFiltroPratiche] = useState('aperte');
  const [rinfresca, setRinfresca] = useState(0);
  const ricerca = testo.trim().length > 1 || conFiltri(filtri);

  useEffect(() => { caricaEnti(archivioDb).then(setElencoEnti).catch(() => setElencoEnti([])); }, [versione]);
  useEffect(() => { if (scheda === 'pratiche') esegui(async () => setElencoPratiche(await caricaPratiche(archivioDb))); }, [scheda, esegui, versione]);

  // Ricerca immediata (dopo una breve pausa nella digitazione) o elenco dei recenti.
  useEffect(() => {
    if (!ricerca && scheda !== 'recenti') return undefined;
    let vivo = true;
    const t = setTimeout(() => {
      esegui(async () => {
        const r = await cercaArchivio(archivioDb, { testo, ...filtri, limite: ricerca ? 200 : 60 });
        if (vivo) setRisultati(r);
      });
    }, ricerca ? 280 : 0);
    return () => { vivo = false; clearTimeout(t); };
  }, [testo, filtri, scheda, ricerca, esegui, versione, rinfresca]);

  const sezioni = impostazioni.sezioni;
  const apriFascicolo = (f) => apri({ tipo: 'ricerca', titolo: f.nome, filtri: { fascicolo: f.codice } });
  const apriSezione = (s) => apri({ tipo: 'ricerca', titolo: s.nome, sezione: s });
  const principali = fascicoli.filter((f) => f.n > 0 && !['pubblicita', 'foto_video', 'corrispondenza', 'altro'].includes(f.codice));
  const secondari = fascicoli.filter((f) => f.n > 0 && ['pubblicita', 'foto_video', 'corrispondenza', 'altro'].includes(f.codice));

  return (
    <>
      <div className="pp-cerca">
        <IconaCerca size={18} />
        <input type="search" value={testo} onChange={(e) => setTesto(e.target.value)} placeholder="Cerca: Enel, IMU 2024, carta d'identità…" enterKeyHint="search" aria-label="Cerca nell'archivio" />
        {testo && <button type="button" className="pp-cerca-pulisci" aria-label="Cancella ricerca" onClick={() => setTesto('')}><IconaChiudi size={16} /></button>}
      </div>
      <BarraFiltri filtri={filtri} setFiltri={setFiltri} ctx={ctx} elencoEnti={elencoEnti} />
      {ricerca ? (
        risultati
          ? (risultati.length
            ? <ElencoSelezionabile elenco={risultati} ctx={ctx} onCambiato={() => setRinfresca((n) => n + 1)} intestazione={`${risultati.length}${risultati.length >= 200 ? '+' : ''} risultati`} />
            : <Vuoto>Nessun documento. Prova un'altra parola o togli un filtro{filtri.anchePocoUtili ? '' : ', oppure tocca "Anche poco utili"'}.</Vuoto>)
          : <Vuoto>Cerco…</Vuoto>
      ) : (
        <>
          <button className="pp-ingresso-foto" onClick={() => apri({ tipo: 'fotovideo' })}>
            <span className="pp-ingresso-foto-icona"><IconaFoto size={22} /></span>
            <span className="pp-riga-testo"><span className="pp-riga-titolo">Foto e video</span><span className="pp-riga-meta">Album, anni e luoghi</span></span>
            <IconaFreccia size={16} />
          </button>
          <Chips voci={[['cartelle', 'Cartelle'], ['recenti', 'Recenti'], ['categorie', 'Categorie'], ['pratiche', 'Pratiche']]} attiva={scheda} onScegli={setScheda} />
          {scheda === 'cartelle' && <VistaCartelle ctx={ctx} anchePocoUtili={filtri.anchePocoUtili} />}
          {scheda === 'recenti' && risultati && <ElencoSelezionabile elenco={risultati} ctx={ctx} onCambiato={() => setRinfresca((n) => n + 1)} intestazione="Ultimi arrivati" />}
          {scheda === 'categorie' && (
            <>
              {sezioni.length > 0 && (
                <Sezione titolo="Le tue sezioni">
                  <div className="pp-griglia">
                    {sezioni.map((s) => (
                      <button key={s.id} className="pp-cartella pp-cartella-sezione" style={{ '--c': colore(s.fascicoli[0] || 'altro') }} onClick={() => apriSezione(s)}>
                        <span className="pp-cartella-icona"><IconaStella size={20} /></span>
                        <span className="pp-cartella-nome">{s.nome}</span>
                        <span className="pp-cartella-numero">{[...s.fascicoli.map((f) => fascicoli.find((x) => x.codice === f)?.nome || f), ...s.parole].slice(0, 3).join(', ')}</span>
                      </button>
                    ))}
                  </div>
                </Sezione>
              )}
              <Sezione titolo="Categorie">
                <div className="pp-griglia">
                  {principali.map((f) => (
                    <button key={f.codice} className="pp-cartella" style={{ '--c': colore(f.codice) }} onClick={() => apriFascicolo(f)}>
                      <span className="pp-cartella-icona"><IconaDocumenti size={20} /></span>
                      <span className="pp-cartella-nome">{f.nome}</span>
                      <span className="pp-cartella-numero">{f.n}{f.n_azioni ? <em> · {f.n_azioni} da fare</em> : null}</span>
                    </button>
                  ))}
                </div>
              </Sezione>
              {secondari.length > 0 && (
                <Sezione titolo="Meno importanti">
                  <Gruppo>
                    {secondari.map((f) => (
                      <button key={f.codice} className="pp-riga" onClick={() => apriFascicolo(f)}>
                        <span className="pp-punto" style={{ '--c': colore(f.codice) }} />
                        <span className="pp-riga-testo"><span className="pp-riga-titolo">{f.nome}</span></span>
                        <span className="pp-conteggio">{f.n}</span>
                        <IconaFreccia size={16} />
                      </button>
                    ))}
                  </Gruppo>
                </Sezione>
              )}
            </>
          )}
          {scheda === 'pratiche' && elencoPratiche && (
            <>
              <Segmenti voci={[['aperte', 'Aperte'], ['risolte', 'Risolte'], ['tutte', 'Tutte']]} attiva={filtroPratiche} onScegli={setFiltroPratiche} />
              <ElencoPratiche
                elenco={elencoPratiche.filter((p) => (filtroPratiche === 'aperte' ? ['aperta', 'in_corso'].includes(p.stato) : filtroPratiche === 'risolte' ? p.stato === 'risolta' : true))}
                onApri={(p) => apri({ tipo: 'pratica', p })}
              />
            </>
          )}
        </>
      )}
    </>
  );
}

/* ---------- pagina con un elenco filtrato (ente, categoria, sezione, da gestire) ---------- */
