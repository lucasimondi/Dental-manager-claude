import { useCallback, useEffect, useState } from 'react';
import { archivioDb } from '../../lib/supabasePersonal.js';
import { caricaDaFare, cambiaStato, rimanda, dataTra, rimandato, filtri, filtra, riepilogo, categoria, CATEGORIE, PRIORITA, passi, puoRispondere, bozzaPerPromemoria, testoCondivisione, telefoni, linkIA, linkWhatsApp, linkEmail, eventoDaPromemoria, datiPagamento, conNota, salvaNota, leggiContatti, salvaContatti, linkEmailA } from '../../lib/daFare.js';
import { salvaImpegno } from '../../lib/studio.js';
import { dataBreve, Vuoto, tokenSessione } from '../../ui.jsx';

// DA-FARE v2 (2026-11-16): filtri per urgenza e categoria, riepilogo, Risolta/Elimina con Annulla, Rimanda.
// DA-FARE (2026-11-16): ogni promemoria è breve (titolo) e spiegato (spiegazione), con quattro tasti:
// Gestita, Rimuovi (non cancella: lo segna rimosso), Dimmi cosa fare (i passi), Rispondi all'email
// (bozza in Gmail con il testo già pronto o scritto da Luca; non parte nulla).
const euro = (n) => (n == null ? '' : Number(n).toLocaleString('it-IT', { style: 'currency', currency: 'EUR' }));

export function VistaDaFare({ ctx, db = archivioDb }) {
  const { esegui, mostra } = ctx;
  const [voci, setVoci] = useState(null);
  const [filtro, setFiltro] = useState('tutte');
  const carica = useCallback(() => esegui(async () => setVoci(await caricaDaFare(db))), [esegui, db]);
  useEffect(() => { carica(); }, [carica]);
  if (!voci) return <Vuoto>Carico…</Vuoto>;
  if (!voci.length) return <Vuoto>Niente da fare: tutto gestito.</Vuoto>;
  const sost = (id, campi) => setVoci((v) => (campi ? v.map((p) => (p.id === id ? { ...p, ...campi } : p)) : v.filter((p) => p.id !== id)));
  // Risolta / Elimina: la voce sparisce subito e l'avviso offre Annulla (riporta lo stato ad aperto).
  const chiudi = (p, stato) => esegui(async () => {
    await cambiaStato(db, p.id, stato);
    sost(p.id);
    mostra(stato === 'gestito' ? 'Segnata come risolta' : 'Eliminata dai promemoria', {
      etichetta: 'Annulla', fai: async () => { await cambiaStato(db, p.id, 'aperto'); setVoci((v) => [...v, p]); return 'Ripristinata'; },
    });
  });
  const posticipa = (p, giorno) => esegui(async () => {
    await rimanda(db, p.id, giorno);
    sost(p.id, { rimanda_al: giorno });
    mostra(giorno ? `Rimandata al ${dataBreve(giorno)}` : 'Tornata nella lista');
  });
  const r = riepilogo(voci);
  const lista = filtra(voci, filtro);
  return (
    <div className="pp-dafare">
      <div className="pp-dafare-riepilogo">
        <div><strong>{r.aperte}</strong><span>da gestire</span></div>
        <div className="pp-dafare-rosso"><strong>{r.urgenti}</strong><span>urgenti</span></div>
        <div><strong>{euro(r.importo)}</strong><span>in ballo</span></div>
      </div>
      <div className="pp-dafare-filtri" role="tablist">
        {filtri(voci).map((f) => (
          <button key={f.id} role="tab" aria-selected={filtro === f.id} className={`pp-chip${filtro === f.id ? ' attiva' : ''}`} onClick={() => setFiltro(f.id)}>
            {f.nome} <span>{f.n}</span>
          </button>
        ))}
      </div>
      {lista.length ? lista.map((p) => <Promemoria key={p.id} p={p} ctx={ctx} db={db} onChiudi={(stato) => chiudi(p, stato)} onRimanda={(g) => posticipa(p, g)} onAggiorna={(campi) => sost(p.id, campi)} />)
        : <Vuoto>Niente in questo filtro.</Vuoto>}
    </div>
  );
}

const NOME_CAT = Object.fromEntries(CATEGORIE.map((c) => [c.id, c.nome]));

function Promemoria({ p, ctx, db, onChiudi, onRimanda, onAggiorna }) {
  const [aperto, setAperto] = useState(null); // 'passi' | 'rispondi' | 'rimanda' | 'elimina' | null
  const [esteso, setEsteso] = useState(false);
  const apri = (x) => setAperto(aperto === x ? null : x);
  const scaduta = p.scadenza && p.scadenza < new Date().toISOString().slice(0, 10);
  return (
    <article className={`pp-pannello pp-promemoria pp-priorita-${p.priorita}`}>
      <div className="pp-promemoria-testa">
        <span className={`pp-etichetta pp-etichetta-${p.priorita}`}>{PRIORITA[p.priorita] || 'Da fare'}</span>
        <span className="pp-etichetta">{NOME_CAT[categoria(p)]}</span>
        {p.importo != null && <span className="pp-promemoria-importo">{euro(p.importo)}</span>}
      </div>
      <strong className="pp-promemoria-titolo">{p.titolo}</strong>
      <p className="pp-riga-meta">
        {[p.ente, p.scadenza ? `${scaduta ? 'scaduta' : 'entro'} ${dataBreve(p.scadenza)}` : null, rimandato(p) ? `rimandata al ${dataBreve(p.rimanda_al)}` : null].filter(Boolean).join(' · ')}
      </p>
      {p.spiegazione && (
        <p className={`pp-testo-lungo pp-promemoria-spiega${esteso ? '' : ' pp-chiuso'}`} onClick={() => setEsteso(!esteso)}>{p.spiegazione}</p>
      )}
      {p.note && <p className="pp-promemoria-nota">📝 {String(p.note).split('\n')[0]}</p>}
      <div className="pp-promemoria-azioni">
        <button className="pp-bottone" onClick={() => onChiudi('gestito')}>✓ Risolta</button>
        {puoRispondere(p) && <button className={`pp-bottone ${p.bozza_risposta ? '' : 'pp-bottone-chiaro'}`} onClick={() => apri('rispondi')}>✉ Rispondi</button>}
        <button className="pp-bottone pp-bottone-chiaro" onClick={() => apri('passi')}>☰ Passi</button>
        <span className="pp-promemoria-icone">
          <button className="pp-bottone pp-bottone-chiaro" aria-label="Altre azioni" title="Chiama, inoltra, paga, IA, agenda, nota" onClick={() => apri('altro')}>⋯</button>
          <button className="pp-bottone pp-bottone-chiaro" aria-label="Rimanda" title="Rimanda" onClick={() => apri('rimanda')}>⏰</button>
          <button className="pp-bottone pp-bottone-chiaro" aria-label="Elimina" title="Elimina" onClick={() => apri('elimina')}>🗑</button>
        </span>
      </div>
      {aperto === 'passi' && <Passi p={p} />}
      {aperto === 'rispondi' && <Rispondi p={p} ctx={ctx} onChiudi={() => setAperto(null)} />}
      {aperto === 'altro' && <AltreAzioni p={p} ctx={ctx} db={db} onAggiorna={onAggiorna} />}
      {aperto === 'rimanda' && (
        <div className="pp-promemoria-passi pp-form-azioni">
          <span className="pp-riga-meta">Nascondila fino a:</span>
          <button className="pp-chip" onClick={() => onRimanda(dataTra(1))}>Domani</button>
          <button className="pp-chip" onClick={() => onRimanda(dataTra(7))}>Tra una settimana</button>
          <button className="pp-chip" onClick={() => onRimanda(dataTra(30))}>Tra un mese</button>
          {rimandato(p) && <button className="pp-chip" onClick={() => onRimanda(null)}>Rimetti ora</button>}
        </div>
      )}
      {aperto === 'elimina' && (
        <div className="pp-promemoria-passi pp-form-azioni">
          <span className="pp-riga-meta">Non serve più? Esce dai promemoria (l'email e il documento restano).</span>
          <button className="pp-bottone pp-bottone-pericolo" onClick={() => onChiudi('rimosso')}>Elimina</button>
          <button className="pp-testo-link" onClick={() => setAperto(null)}>Annulla</button>
        </div>
      )}
    </article>
  );
}

// Altre azioni: chiama, inoltra ai contatti salvati, paga, IA, condividi, agenda di Poliedron, nota.
// Tutto parte da un tocco di Luca: niente viene inviato da solo.
function AltreAzioni({ p, ctx, db, onAggiorna }) {
  const tel = telefoni(p);
  const testo = testoCondivisione(p);
  const pag = datiPagamento(p);
  const [contatti, setContatti] = useState(null);
  const [nuovo, setNuovo] = useState(null);
  const [agenda, setAgenda] = useState({ data: p.scadenza || dataTra(1), ora: '' });
  const [nota, setNota] = useState('');
  useEffect(() => { leggiContatti(db).then(setContatti).catch(() => setContatti([])); }, [db]);
  const copia = async (t, msg = 'Copiato') => {
    try { await navigator.clipboard.writeText(t); ctx.mostra(msg); } catch { ctx.mostra('Copia non riuscita'); }
  };
  const condividi = async () => {
    if (navigator.share) { try { await navigator.share({ title: p.titolo, text: testo }); } catch { /* annullato */ } return; }
    await copia(testo, 'Testo copiato');
  };
  const link = (href, etichetta) => <a className="pp-chip" href={href} target="_blank" rel="noreferrer">{etichetta}</a>;
  const blocco = (titolo, figli) => <div><span className="pp-riga-meta">{titolo}</span><div className="pp-promemoria-chip">{figli}</div></div>;
  const aggiungiContatto = () => ctx.esegui(async () => {
    setContatti(await salvaContatti(db, [...(contatti || []), nuovo])); setNuovo(null); ctx.mostra('Contatto salvato');
  });
  const inAgenda = () => ctx.esegui(async () => {
    try { await salvaImpegno(eventoDaPromemoria(p, agenda)); ctx.mostra(`In agenda il ${dataBreve(agenda.data)}`); }
    catch (e) { ctx.mostra(/sessione|session|jwt|auth/i.test(e.message) ? 'Collega l\'agenda dello studio da Impostazioni' : e.message); }
  });
  const salvaN = () => ctx.esegui(async () => {
    const note = conNota(p.note, nota); await salvaNota(db, p.id, note); onAggiorna({ note }); setNota(''); ctx.mostra('Nota salvata');
  });
  return (
    <div className="pp-promemoria-passi pp-promemoria-altro">
      {tel.length > 0 && blocco('Chiama', <>
        {tel.map((t) => <a key={t.tel} className="pp-chip" href={`tel:${t.tel}`}>📞 {t.mostra}</a>)}
        {tel.filter((t) => t.cellulare).map((t) => <a key={`w${t.tel}`} className="pp-chip" href={linkWhatsApp(p, t.tel)} target="_blank" rel="noreferrer">💬 {t.mostra}</a>)}
      </>)}
      {blocco('Inoltra a', <>
        {(contatti || []).map((c) => (
          <span key={c.nome} className="pp-promemoria-contatto">
            <b>{c.nome}</b>
            {c.email && <a className="pp-chip" href={linkEmailA(p, c.email)}>✉</a>}
            {c.telefono && <a className="pp-chip" href={linkWhatsApp(p, c.telefono)} target="_blank" rel="noreferrer">💬</a>}
          </span>
        ))}
        {!nuovo && <button className="pp-chip" onClick={() => setNuovo({ nome: '', email: '', telefono: '' })}>＋ Contatto</button>}
      </>)}
      {nuovo && (
        <div className="pp-promemoria-modulo">
          <input placeholder="Nome (es. Avv. Dottore)" value={nuovo.nome} onChange={(e) => setNuovo({ ...nuovo, nome: e.target.value })} />
          <input placeholder="Email" type="email" value={nuovo.email} onChange={(e) => setNuovo({ ...nuovo, email: e.target.value })} />
          <input placeholder="Cellulare per WhatsApp" type="tel" value={nuovo.telefono} onChange={(e) => setNuovo({ ...nuovo, telefono: e.target.value })} />
          <div className="pp-form-azioni"><button className="pp-bottone" disabled={!nuovo.nome || !(nuovo.email || nuovo.telefono)} onClick={aggiungiContatto}>Salva contatto</button><button className="pp-testo-link" onClick={() => setNuovo(null)}>Annulla</button></div>
        </div>
      )}
      {(pag.iban.length > 0 || p.importo != null) && blocco('Paga', <>
        {pag.iban.map((iban) => <button key={iban} className="pp-chip" onClick={() => copia(iban, 'IBAN copiato: incollalo nella tua banca')}>🏦 Copia IBAN {iban.slice(0, 4)}…{iban.slice(-4)}</button>)}
        {p.importo != null && <button className="pp-chip" onClick={() => copia(String(p.importo).replace('.', ','), 'Importo copiato')}>💶 Copia {euro(p.importo)}</button>}
        {pag.causale && <button className="pp-chip" onClick={() => copia(pag.causale, 'Causale copiata')}>🧾 Copia causale</button>}
        {!pag.iban.length && <span className="pp-riga-meta">IBAN non trovato: lo trovi nell'email o nel documento.</span>}
      </>)}
      {blocco('Chiedi all\'IA (le passi il promemoria)', <>{link(linkIA(p, 'claude'), '✨ Claude')}{link(linkIA(p, 'chatgpt'), '🤖 ChatGPT')}</>)}
      {blocco('Condividi con qualcuno', <>
        <button className="pp-chip" onClick={condividi}>📤 Condividi…</button>
        {link(linkWhatsApp(p), '💬 WhatsApp')}
        <a className="pp-chip" href={linkEmail(p)}>✉ Email</a>
        <button className="pp-chip" onClick={() => copia(testo, 'Testo copiato')}>📋 Copia</button>
        {p.documento?.drive_url && link(p.documento.drive_url, p.email ? '📨 Apri l\'email' : '📄 Apri il documento')}
      </>)}
      <div>
        <span className="pp-riga-meta">Metti in agenda (Poliedron, solo agenda personale)</span>
        <div className="pp-promemoria-modulo pp-promemoria-riga">
          <input type="date" value={agenda.data} onChange={(e) => setAgenda({ ...agenda, data: e.target.value })} />
          <input type="time" value={agenda.ora} onChange={(e) => setAgenda({ ...agenda, ora: e.target.value })} aria-label="Ora (facoltativa)" />
          <button className="pp-bottone" disabled={!agenda.data} onClick={inAgenda}>📅 Aggiungi</button>
        </div>
      </div>
      <div>
        <span className="pp-riga-meta">Nota (cosa hai fatto, chi hai sentito)</span>
        <div className="pp-promemoria-modulo pp-promemoria-riga">
          <input placeholder="es. chiamato, mi richiamano lunedì" value={nota} onChange={(e) => setNota(e.target.value)} />
          <button className="pp-bottone" disabled={!nota.trim()} onClick={salvaN}>📝 Salva</button>
        </div>
      </div>
      <p className="pp-riga-meta">Condividendo, il testo del promemoria esce dall'app: scegli tu con chi.</p>
    </div>
  );
}

function Passi({ p }) {
  const elenco = passi(p.cosa_fare);
  return (
    <div className="pp-promemoria-passi">
      {elenco.length ? <ol>{elenco.map((x, i) => <li key={i}>{x}</li>)}</ol> : <p className="pp-riga-meta">Nessun passo scritto: {p.spiegazione || p.titolo}</p>}
      <div className="pp-form-azioni">
        {p.documento?.drive_url && <a className="pp-bottone pp-bottone-chiaro" href={p.documento.drive_url} target="_blank" rel="noreferrer">{p.email ? 'Apri l\'email' : 'Apri il documento'}</a>}
        {p.documento?.gmail_message_id && p.email && !String(p.documento.drive_url || '').includes('mail.google.com') && (
          <a className="pp-bottone pp-bottone-chiaro" href={`https://mail.google.com/mail/u/0/#all/${p.documento.gmail_message_id}`} target="_blank" rel="noreferrer">Apri l'email</a>
        )}
      </div>
    </div>
  );
}

function Rispondi({ p, ctx, onChiudi }) {
  const [testo, setTesto] = useState(p.bozza_risposta || '');
  const [istruzioni, setIstruzioni] = useState('');
  const [attesa, setAttesa] = useState(false);
  const [fatta, setFatta] = useState(null);
  const crea = (conAi) => ctx.esegui(async () => {
    setAttesa(true);
    try {
      setFatta(await bozzaPerPromemoria({ token: await tokenSessione(), documento: p.documento_id, ente: p.ente, testo: conAi ? '' : testo, istruzioni: conAi ? istruzioni : '' }));
    } finally { setAttesa(false); }
  });
  if (fatta) return (
    <div className="pp-promemoria-passi">
      <p className="pp-riga-meta">A: {fatta.a} · {fatta.oggetto}</p>
      <p className="pp-testo-lungo">{fatta.testo}</p>
      <p className="pp-riga-meta">È tra le bozze di Gmail: rileggila e inviala tu da lì. Non è partito nulla.</p>
      <div className="pp-form-azioni"><a className="pp-bottone" href={fatta.link} target="_blank" rel="noreferrer">Apri le bozze di Gmail</a><button className="pp-testo-link" onClick={onChiudi}>Chiudi</button></div>
    </div>
  );
  return (
    <div className="pp-promemoria-passi">
      <label className="pp-campo">Testo della risposta (puoi modificarlo)
        <textarea rows={7} value={testo} onChange={(e) => setTesto(e.target.value)} placeholder="Scrivi la risposta, oppure chiedi a Poliedron di prepararla qui sotto" />
      </label>
      <div className="pp-form-azioni">
        <button className="pp-bottone" disabled={attesa || !testo.trim()} onClick={() => crea(false)}>{attesa ? 'Preparo…' : 'Metti tra le bozze di Gmail'}</button>
      </div>
      <label className="pp-campo">Oppure: cosa vuoi dire (Poliedron scrive la bozza)
        <input value={istruzioni} onChange={(e) => setIstruzioni(e.target.value)} placeholder="es. chiedi una rateizzazione in 3 mesi" />
      </label>
      <div className="pp-form-azioni">
        <button className="pp-bottone pp-bottone-chiaro" disabled={attesa} onClick={() => crea(true)}>Scrivila tu</button>
        <button className="pp-testo-link" onClick={onChiudi}>Annulla</button>
      </div>
      <p className="pp-riga-meta">Non invia nulla: la bozza finisce in Gmail e la mandi tu.</p>
    </div>
  );
}
