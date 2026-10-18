// Poliedron — la chat a pagina intera: AI sull'archivio o sola ricerca, allegati con la graffetta.
import { useEffect, useRef, useState } from 'react';
import { archivioDb } from '../../lib/supabasePersonal.js';
import { rispondi, caricaDocumento, chiediPoliedron, partiRisposta } from '../../lib/archivio.js';
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

const SUGGERIMENTI_CHAT = ['Quanto devo pagare questo mese?', 'Quali bollette Edison ho pagato quest\'anno?', 'Dov\'è la carta d\'identità di Giulia?', 'Che pratiche ho aperte?'];

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
        nuovo = { ruolo: 'assistente', testo: await chiediPoliedron({ token: await tokenSessione(), domanda, documentoId, storia }), fonte: 'ai' };
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
