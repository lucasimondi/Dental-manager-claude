// Documenti — file a tutto schermo, informazioni e catalogo su richiesta.
import { useCallback, useEffect, useState } from 'react';
import { archivioDb } from '../../lib/supabasePersonal.js';
import { eliminaDocumento, documentoCompleto, impostaPortafoglio, eCaricato, nelPortafoglio, aggiornaDocumento, cestinaSuDrive } from '../../lib/archivio.js';
import { euro } from '../../lib/coreArchivio.js';
import { colore, dataBreve, titoloDoc, tokenSessione, Vuoto, Sezione, Gruppo, ConfermaElimina, BottoneCondividi } from '../../ui.jsx';
import { DocumentoIntero } from './DocumentoIntero.jsx';
import { CodiciDocumento } from './CodiciDocumento.jsx';
import { avvisoDocumento, dataScadenza, salvaValidita, storicoPersonale, archiviaPersonale } from '../../lib/portafoglio.js';
import { IconaPratiche, IconaFreccia, IconaApri, IconaEmail, IconaStella, IconaCestino, IconaChat } from '../../Icone.jsx';

/* ---------- pagine ---------- */
export function PaginaDocumento({ id, ctx, chiudi }) {
  const { esegui, aggiorna, mostra, apri, impostazioni, fascicoli } = ctx;
  const [doc, setDoc] = useState(null);
  const [conferma, setConferma] = useState(false);
  const [intero, setIntero] = useState(true);
  const [scadenza, setScadenza] = useState('');
  const carica = useCallback(() => esegui(async () => setDoc(await documentoCompleto(archivioDb, id))), [esegui, id]);
  useEffect(() => { carica(); }, [carica]);
  if (!doc) return <Vuoto>Carico…</Vuoto>;

  const personale=doc.fascicolo==='identita';
  const avviso=avvisoDocumento(doc);
  const dati = Object.entries(doc.dati_estratti || {}).filter(([k, v]) => v !== null && v !== '' && typeof v !== 'object' && !/pin|puk|password|token/i.test(k));
  const portafoglio = nelPortafoglio(doc);
  const cambia = (fn, messaggio) => esegui(async () => { await fn(); await carica(); aggiorna(); if (messaggio) mostra(messaggio); });
  const persone = [...new Set([...impostazioni.persone, ...(doc.persona ? [doc.persona] : [])])];
  const categorie = impostazioni.categorie.some((c) => c.id === doc.categoria) || !doc.categoria ? impostazioni.categorie : [...impostazioni.categorie, { id: doc.categoria, nome: doc.categoria }];

  return (
    <>
      {intero && <DocumentoIntero doc={doc} onInfo={() => setIntero(false)} onChiudi={chiudi} mostra={mostra} />}
      <button className="pp-bottone" onClick={() => setIntero(true)}>Apri a tutto schermo</button>
      {avviso && <p className={'pp-validita '+avviso.stato}>{avviso.testo} · {dataBreve(avviso.data)}</p>}
      <div className="pp-dettaglio-testa" style={{ '--c': colore(doc.fascicolo) }}>
        <span className="pp-etichetta">{doc.tipo_documento || fascicoli.find((f) => f.codice === doc.fascicolo)?.nome || doc.fascicolo}</span>
        <h2>{titoloDoc(doc)}</h2>
        <p className="pp-riga-meta">{[dataBreve(doc.data_documento || doc.email_data), !personale && doc.importo != null ? euro(doc.importo) : null, doc.persona].filter(Boolean).join(' · ')}</p>
      </div>
      <div className="pp-azioni">
        {doc.drive_url && <a className="pp-bottone" href={doc.drive_url} target="_blank" rel="noreferrer"><IconaApri size={18} /> Apri il file</a>}
        {(doc.drive_file_id || doc.drive_url) && <BottoneCondividi doc={doc} mostra={mostra} />}
        {!eCaricato(doc) && doc.gmail_message_id && <a className="pp-bottone pp-bottone-chiaro" href={`https://mail.google.com/mail/u/0/#all/${doc.gmail_message_id}`} target="_blank" rel="noreferrer"><IconaEmail size={18} /> Email</a>}
        <button className={`pp-bottone pp-bottone-chiaro${portafoglio ? ' pp-attivo' : ''}`} onClick={() => cambia(() => impostaPortafoglio(archivioDb, doc, !portafoglio), portafoglio ? 'Tolto dai Personali' : 'Aggiunto ai Personali')}>
          <IconaStella size={18} piena={portafoglio} /> {portafoglio ? 'Nei Personali' : 'Tieni a portata di mano'}
        </button>
      </div>
      {doc.fascicolo !== 'clinico_pazienti' && (
        <button className="pp-chiedi-doc" onClick={() => ctx.apriChat({ id: doc.id, titolo: titoloDoc(doc) })}>
          <IconaChat size={18} /> Chiedi a Poliedron su questo documento
        </button>
      )}
      {doc.fascicolo === 'clinico_pazienti' && <p className="pp-avviso">Documento di un paziente: archiviato senza leggerne il contenuto.</p>}
      {!personale && doc.azione_richiesta && <p className={`pp-avviso pp-avviso-${doc.urgenza || 'media'}`}><strong>Da fare:</strong> {doc.azione_descrizione || 'azione richiesta'}</p>}
      {!personale && doc.riassunto && <p className="pp-paragrafo">{doc.riassunto}</p>}
      {personale && <>
        <Sezione titolo="Validità del documento">
          <label className="pp-campo">Data di scadenza<input type="date" value={scadenza || dataScadenza(doc) || ''} onChange={e => setScadenza(e.target.value)}/></label>
          <button className="pp-bottone" disabled={!scadenza} onClick={() => cambia(() => salvaValidita(archivioDb,doc,scadenza),'Scadenza e promemoria salvati')}>Salva scadenza</button>
          <p className="pp-riga-meta">Il rinnovo compare in Oggi e Agenda. Non è un pagamento.</p>
        </Sezione>
        {!intero && <CodiciDocumento id={doc.id}/>}
        <button className="pp-bottone pp-bottone-chiaro" onClick={() => cambia(() => archiviaPersonale(archivioDb,doc,!storicoPersonale(doc)),storicoPersonale(doc)?'Ripristinato nei Personali':'Spostato fra i documenti vecchi')}>
          {storicoPersonale(doc)?'Ripristina nei Personali':'Archivia come documento vecchio'}
        </button>
      </>}
      {!personale && doc.scadenze?.length > 0 && <Sezione titolo="Date e termini"><Gruppo>{doc.scadenze.map(s=><div key={s.id} className="pp-riga"><span>{s.descrizione}</span><strong>{dataBreve(s.data)}</strong></div>)}</Gruppo></Sezione>}
      {doc.pratica && (
        <Sezione titolo="Pratica">
          <Gruppo>
            <button className="pp-riga" onClick={() => apri({ tipo: 'pratica', p: { ...doc.pratica, fascicolo: doc.fascicolo } })}>
              <span className="pp-riga-icona" style={{ '--c': colore(doc.fascicolo) }}><IconaPratiche size={18} /></span>
              <span className="pp-riga-testo"><span className="pp-riga-titolo">{doc.pratica.titolo}</span><span className="pp-riga-meta">{doc.pratica.stato}</span></span>
              <IconaFreccia size={16} />
            </button>
          </Gruppo>
        </Sezione>
      )}
      <Sezione titolo="Catalogo">
        <div className="pp-campi">
          <label className="pp-campo-riga"><span>Titolo</span>
            <input className="pp-campo-testo" defaultValue={doc.titolo || ''} onBlur={(e) => e.target.value.trim() && e.target.value.trim() !== doc.titolo && cambia(() => aggiornaDocumento(archivioDb, doc.id, { titolo: e.target.value }), 'Titolo salvato')} />
          </label>
          <label className="pp-campo-riga"><span>Ente</span>
            <input className="pp-campo-testo" defaultValue={doc.ente || ''} placeholder="Es. Enel Energia" onBlur={(e) => e.target.value.trim() !== (doc.ente || '') && cambia(() => aggiornaDocumento(archivioDb, doc.id, { ente: e.target.value }), 'Ente salvato')} />
          </label>
          <label className="pp-campo-riga"><span>Importanza</span>
            <select className="pp-select" value={doc.rilevanza || 'normale'} onChange={(e) => cambia(() => aggiornaDocumento(archivioDb, doc.id, { rilevanza: e.target.value }), 'Salvato')}>
              <option value="alta">Importante</option>
              <option value="normale">Normale</option>
              <option value="bassa">Poco utile (nascosto)</option>
            </select>
          </label>
          <label className="pp-campo-riga"><span>Persona</span>
            <select className="pp-select" value={doc.persona || ''} onChange={(e) => cambia(() => aggiornaDocumento(archivioDb, doc.id, { persona: e.target.value }), 'Salvato')}>
              <option value="">Nessuna</option>
              {persone.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </label>
          <label className="pp-campo-riga"><span>Doc. personale</span>
            <select className="pp-select" value={doc.categoria || ''} onChange={(e) => cambia(() => aggiornaDocumento(archivioDb, doc.id, { categoria: e.target.value }), 'Salvato')}>
              <option value="">Nessuno</option>
              {categorie.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
            </select>
          </label>
          <label className="pp-campo-riga"><span>Fascicolo</span>
            <select className="pp-select" value={doc.fascicolo} onChange={(e) => cambia(() => aggiornaDocumento(archivioDb, doc.id, { fascicolo: e.target.value }), 'Spostato')}>
              {fascicoli.map((f) => <option key={f.codice} value={f.codice}>{f.nome}</option>)}
            </select>
          </label>
        </div>
      </Sezione>
      {dati.length > 0 && (
        <Sezione titolo="Dati">
          <dl className="pp-dati">{dati.map(([k, v]) => <div key={k}><dt>{k.replace(/_/g, ' ')}</dt><dd>{String(v)}</dd></div>)}</dl>
        </Sezione>
      )}

      <div className="pp-elimina">
        {!conferma
          ? <button className="pp-testo-link pp-rosso" onClick={() => setConferma(true)}><IconaCestino size={16} /> Elimina dall'archivio</button>
          : <ConfermaElimina n={1} onNo={() => setConferma(false)}
            onSi={(ancheDrive) => esegui(async () => {
              const r = ancheDrive ? await cestinaSuDrive({ token: await tokenSessione(), ids: [doc.drive_file_id] }) : null;
              await eliminaDocumento(archivioDb, doc.id); aggiorna();
              mostra(r?.cestinati.length ? 'Eliminato; il file è nel Cestino di Drive' : 'Eliminato dall\'archivio'); chiudi();
            })} />}
      </div>
    </>
  );
}
