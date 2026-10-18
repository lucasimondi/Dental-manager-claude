// Poliedron — la chat a pagina intera: AI sull'archivio o sola ricerca, allegati con la graffetta.
import { useEffect, useRef, useState } from 'react';
import { archivioDb } from '../../lib/supabasePersonal.js';
import { rispondi, caricaDocumento, chiediPoliedronCompleto, partiRisposta } from '../../lib/archivio.js';
import { titoloProposta, elementiScelti, eseguiProposta, esitoProposta } from '../../lib/pulizia.js';
import { euro } from '../../lib/coreArchivio.js';
import { preparaFile as preparaCaricamento } from '../../lib/file.js';
import { ACCETTA_ALLEGATI, dimensioneFile, domandaDa, esitoAllegato, puoInviare, storiaChat } from '../../lib/chat.js';
import { tokenSessione, Sezione, Gruppo, RigaDocumento, RigaPagamento, Segmenti, ElencoPratiche } from '../../ui.jsx';
import { IconaChiudi, IconaFile, IconaInvia, IconaGraffetta } from '../../Icone.jsx';

/* ---------- Documenti ---------- */
function Risultato({ risposta, ctx }) {
  const { apri, pagato } = ctx;
  const apriDoc = (d) => apri({ tipo: 'documento', id: d.id });
  if (risposta.tipo === 'vuoto') return null;
  if (risposta.tipo === 'debito' || risposta.tipo === 'scadenze') {
    const elenco = risposta.tipo === 'debito' ? risposta.aperte : risposta.scadenze;
    const totale = elenco.reduce((t, s) => t + Number(s.importo || 0), 0);
    return (
      <>
        <p className="pp-frase">{risposta.frase || `${elenco.length} pagamenti aperti, ${euro(totale)}${risposta.scadute ? `, di cui ${risposta.scadute} già scaduti` : ''}.`}</p>
        {elenco.length > 0 && <Gruppo>{elenco.map((s) => <RigaPagamento key={s.id} s={s} onApri={(x) => apri({ tipo: 'pagamento', s: x })} onPagato={pagato} />)}</Gruppo>}
        {risposta.documenti?.length > 0 && <Sezione titolo="Documenti"><Gruppo>{risposta.documenti.slice(0, 30).map((d) => <RigaDocumento key={d.id} doc={d} onApri={apriDoc} />)}</Gruppo></Sezione>}
      </>
    );
  }
  if (risposta.tipo === 'pratiche') return <ElencoPratiche elenco={risposta.pratiche} onApri={(p) => apri({ tipo: 'pratica', p })} />;
  return (
    <>
      <p className="pp-frase">{risposta.documenti.length ? `${risposta.documenti.length} documenti${risposta.titolo ? ` · ${risposta.titolo}` : ''}` : 'Nessun documento trovato.'}</p>
      {risposta.documenti.length > 0 && <Gruppo>{risposta.documenti.map((d) => <RigaDocumento key={d.id} doc={d} onApri={apriDoc} />)}</Gruppo>}
    </>
  );
}

/* ---------- Proposte di pulizia in massa: Luca sceglie e conferma ---------- */
function Proposta({ proposta, ctx, onFatto }) {
  const { apri, aggiorna } = ctx;
  const [esclusi, setEsclusi] = useState(() => new Set());
  const [aperta, setAperta] = useState(false);
  const [ancheDrive, setAncheDrive] = useState(true);
  const [ancheEmail, setAncheEmail] = useState(true);
  const [stato, setStato] = useState(null);
  const scelti = elementiScelti(proposta, esclusi);
  const clinici = scelti.filter((e) => e.fascicolo === 'clinico_pazienti').length;
  const commuta = (id) => setEsclusi((x) => { const n = new Set(x); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const conferma = async () => {
    setStato({ lavoro: true, testo: 'Sto eseguendo…' });
    try {
      const r = await eseguiProposta({ proposta, elementi: scelti, db: archivioDb, token: await tokenSessione(), ancheDrive, ancheEmail,
        avanzamento: (fatti, totale) => setStato({ lavoro: true, testo: `${fatti} di ${totale}…` }) });
      aggiorna();
      onFatto(esitoProposta(proposta, r));
    } catch (e) { setStato({ errore: e.message }); }
  };
  if (proposta.fatto) return <div className="pp-proposta pp-proposta-fatta"><strong>Fatto.</strong> {proposta.fatto}</div>;
  return (
    <div className="pp-proposta">
      <strong>{titoloProposta(proposta, scelti.length)}</strong>
      {proposta.descrizione && <span className="pp-riga-meta">{proposta.descrizione}</span>}
      {!proposta.completa && <span className="pp-riga-meta">Sono i primi {proposta.n}: dopo la conferma chiedi di nuovo per i successivi.</span>}
      {clinici > 0 && <span className="pp-riga-meta pp-rosso">Comprende {clinici} documenti dei pazienti.</span>}
      <button className="pp-testo-link" onClick={() => setAperta((x) => !x)}>{aperta ? 'Nascondi elenco' : `Vedi elenco e togli quelli da tenere (${proposta.elementi.length})`}</button>
      {aperta && (
        <ul className="pp-proposta-elenco">
          {proposta.elementi.map((e) => (
            <li key={e.id}>
              <label><input type="checkbox" checked={!esclusi.has(e.id)} onChange={() => commuta(e.id)} /> <span>{e.titolo}</span></label>
              {proposta.tipo !== 'risolvi_pratiche' && <button className="pp-chat-togli" onClick={() => apri({ tipo: 'documento', id: e.id })} aria-label="Apri"><IconaFile size={14} /></button>}
            </li>
          ))}
        </ul>
      )}
      {proposta.tipo === 'elimina' && (
        <>
          <label className="pp-conferma-drive"><input type="checkbox" checked={ancheDrive} onChange={(e) => setAncheDrive(e.target.checked)} /><span>Anche i file su Google Drive <small>(Cestino di Drive, 30 giorni)</small></span></label>
          <label className="pp-conferma-drive"><input type="checkbox" checked={ancheEmail} onChange={(e) => setAncheEmail(e.target.checked)} /><span>Anche le email da cui arrivano <small>(Cestino di Gmail, 30 giorni; tenute se hanno altri allegati utili)</small></span></label>
        </>
      )}
      {stato?.errore && <p className="pp-messaggio pp-messaggio-errore">{stato.errore}</p>}
      <button className={`pp-bottone ${proposta.tipo === 'elimina' ? 'pp-bottone-rosso' : 'pp-bottone-verde'}`} disabled={!scelti.length || stato?.lavoro} onClick={conferma}>
        {stato?.lavoro ? stato.testo : `Conferma: ${titoloProposta(proposta, scelti.length).toLowerCase()}`}
      </button>
    </div>
  );
}

const SUGGERIMENTI_CHAT = ['Quanto devo pagare questo mese?', 'Dov\'è la carta d\'identità di Giulia?', 'Trova depliant e pubblicità da eliminare', 'Chiudi le pratiche ferme da più di 2 anni'];

// Poliedron come scheda a pagina intera (PO 2026-10-17): la conversazione resta passando da una
// scheda all'altra; la graffetta allega una foto, un PDF o un file, che viene archiviato e letto.
export function VistaPoliedron({ ctx }) {
  const { apri, aggiorna, chat, setChat } = ctx;
  const { modo, messaggi, documento } = chat;
  const [testo, setTesto] = useState('');
  const [file, setFile] = useState(null);
  const [attesa, setAttesa] = useState(null);
  const lista = useRef(null);
  const selettore = useRef(null);
  useEffect(() => { const el = lista.current; if (el) el.scrollTop = el.scrollHeight; }, [messaggi.length, attesa]);
  const aggiungi = (m) => setChat((c) => ({ ...c, messaggi: [...c.messaggi, m] }));

  const invia = async (scritto) => {
    const allegato = file;
    if (!puoInviare({ testo: scritto, file: allegato, attesa })) return;
    const q = scritto.trim();
    setTesto(''); setFile(null);
    const storia = storiaChat(messaggi);
    aggiungi({ ruolo: 'utente', testo: q, allegato: allegato ? { nome: allegato.name, dimensione: dimensioneFile(allegato.size) } : null });
    let documentoId = documento?.id || null;
    if (allegato) {
      setAttesa('Archivio il file e lo leggo…');
      try {
        const r = await caricaDocumento({ token: await tokenSessione(), ...(await preparaCaricamento(allegato)) });
        aggiorna();
        const esito = esitoAllegato(r, allegato.name);
        documentoId = esito.documento?.id || documentoId;
        setChat((c) => ({ ...c, documento: esito.documento || c.documento, messaggi: [...c.messaggi, esito.messaggio] }));
      } catch (e) {
        aggiungi({ ruolo: 'assistente', fonte: 'archivio', nota: `File non archiviato: ${e.message}` });
        setAttesa(null);
        return;
      }
    }
    const domanda = domandaDa(q, Boolean(allegato));
    let nuovo = null;
    if (modo === 'ai') {
      setAttesa('Cerco nell\'archivio…');
      try {
        const r = await chiediPoliedronCompleto({ token: await tokenSessione(), domanda, documentoId, storia });
        nuovo = { ruolo: 'assistente', testo: r.risposta, proposte: r.proposte, fonte: 'ai' };
      } catch (e) {
        nuovo = q
          ? { ruolo: 'assistente', risposta: await rispondi(archivioDb, q).catch(() => null), fonte: 'core', nota: `${e.message} Ti rispondo con la ricerca di Poliedron.` }
          : { ruolo: 'assistente', fonte: 'core', nota: e.message };
      }
    } else if (q) {
      setAttesa('Cerco…');
      nuovo = { ruolo: 'assistente', risposta: await rispondi(archivioDb, q).catch(() => null), fonte: 'core' };
    }
    if (nuovo) aggiungi(nuovo);
    setAttesa(null);
  };

  const scegliFile = (e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) setFile(f); };
  const etichettaFonte = (m) => (m.fonte === 'ai' ? 'Poliedron AI' : m.fonte === 'archivio' ? 'Poliedron · archivio' : 'Poliedron · ricerca');

  return (
    <div className="pp-chat">
      <div className="pp-chat-modo"><Segmenti voci={[['ai', 'Poliedron AI'], ['core', 'Solo ricerca']]} attiva={modo} onScegli={(m) => setChat((c) => ({ ...c, modo: m }))} /></div>
      <div className="pp-chat-lista" ref={lista}>
        {!messaggi.length && (
          <div className="pp-chat-vuota">
            <p>{modo === 'ai' ? 'Chiedimi qualsiasi cosa sull\'archivio: documenti, pagamenti, pratiche, persone. Con la graffetta mi mandi una foto o un PDF: lo archivio e ti dico cos\'è.' : 'Ricerca senza AI: fornitori, bollette, scadenze, "quanto devo a…", pratiche.'}</p>
            <div className="pp-suggerimenti">
              {(documento ? ['Riassumimi questo documento', 'Cosa devo fare?', 'Ci sono scadenze?'] : SUGGERIMENTI_CHAT).map((x) => <button key={x} className="pp-chip" onClick={() => invia(x)}>{x}</button>)}
            </div>
          </div>
        )}
        {messaggi.map((m, i) => (
          <div key={i} className={`pp-messaggio-chat ${m.ruolo}`}>
            {m.ruolo === 'utente' ? (
              <>
                {m.allegato && <span className="pp-chat-allegato"><IconaGraffetta size={15} /> {m.allegato.nome} · {m.allegato.dimensione}</span>}
                {m.testo}
              </>
            ) : (
              <>
                {m.nota && <p className="pp-riga-meta">{m.nota}</p>}
                {m.archiviato && <p className="pp-chat-testo">{m.duplicato ? 'Era già in archivio: ' : 'Archiviato: '}
                  <button className="pp-chat-link" onClick={() => apri({ tipo: 'documento', id: m.archiviato.id })}><IconaFile size={14} />{m.archiviato.titolo}</button></p>}
                {m.testo && <div className="pp-chat-testo">{partiRisposta(m.testo).map((p, j) => (p.doc
                  ? <button key={j} className="pp-chat-link" onClick={() => apri({ tipo: 'documento', id: p.doc })}><IconaFile size={14} />{p.titolo}</button>
                  : <span key={j}>{p.testo}</span>))}</div>}
                {m.risposta && <Risultato risposta={m.risposta} ctx={ctx} />}
                {(m.proposte || []).map((p, j) => <Proposta key={j} proposta={p} ctx={ctx}
                  onFatto={(esito) => setChat((c) => ({ ...c, messaggi: c.messaggi.map((x, k) => (k === i ? { ...x, proposte: x.proposte.map((y, h) => (h === j ? { ...y, fatto: esito } : y)) } : x)) }))} />)}
                {m.fonte === 'core' && !m.risposta && !m.nota && <p>Nessun risultato.</p>}
                <span className="pp-chat-fonte">{etichettaFonte(m)}</span>
              </>
            )}
          </div>
        ))}
        {attesa && <div className="pp-messaggio-chat assistente"><span className="pp-rotella" /> {attesa}</div>}
      </div>
      <div className="pp-chat-composer">
        {(documento || file) && (
          <div className="pp-chat-contesti">
            {documento && <span className="pp-chat-contesto">
              <button onClick={() => apri({ tipo: 'documento', id: documento.id })}><IconaFile size={14} /> Sul documento: <strong>{documento.titolo}</strong></button>
              <button className="pp-chat-togli" onClick={() => setChat((c) => ({ ...c, documento: null }))} aria-label="Non parlare più di questo documento"><IconaChiudi size={14} /></button>
            </span>}
            {file && <span className="pp-chat-contesto pp-chat-file">
              <span><IconaGraffetta size={14} /> <strong>{file.name}</strong> · {dimensioneFile(file.size)}</span>
              <button className="pp-chat-togli" onClick={() => setFile(null)} aria-label="Togli l'allegato"><IconaChiudi size={14} /></button>
            </span>}
          </div>
        )}
        <form className="pp-chat-barra" onSubmit={(e) => { e.preventDefault(); invia(testo); }}>
          <input ref={selettore} type="file" accept={ACCETTA_ALLEGATI} hidden onChange={scegliFile} />
          <button type="button" className="pp-chat-allega" onClick={() => selettore.current?.click()} disabled={Boolean(attesa)} aria-label="Allega una foto, un PDF o un file"><IconaGraffetta size={21} /></button>
          <input value={testo} onChange={(e) => setTesto(e.target.value)} placeholder={file ? 'Domanda (facoltativa)…' : 'Scrivi a Poliedron…'} enterKeyHint="send" aria-label="Domanda a Poliedron" />
          <button type="submit" className="pp-chat-invia" disabled={!puoInviare({ testo, file, attesa })} aria-label="Invia"><IconaInvia size={20} /></button>
        </form>
      </div>
    </div>
  );
}
