// PRATICHE-CONSULENTI (PO 2026-11-19): schede «Consulenti» ed «Email» della pratica.
import { useState } from 'react';
import { archivioDb } from '../../lib/supabasePersonal.js';
import { RUOLI_CONSULENTE, salvaConsulente, togliConsulente, consulentiSuggeriti, linkTelefono, linkWhatsAppA, linkScrivi, linkConversazione, linkGmailConsulenti, nomeMittente } from '../../lib/consulenti.js';
import { dataBreve, Vuoto, Sezione } from '../../ui.jsx';

const VUOTO = { nome: '', ruolo: '', studio: '', email: '', pec: '', telefono: '', note: '' };

export function ConsulentiPratica({ p, consulenti, parti, ctx, onCambiato }) {
  const { esegui, mostra } = ctx;
  const [modulo, setModulo] = useState(null); // null | {…campi, id?}
  const [chiedi, setChiedi] = useState(null); // id da togliere
  const suggeriti = consulentiSuggeriti(parti, consulenti);
  const salva = (e) => { e.preventDefault(); esegui(async () => { await salvaConsulente(archivioDb, p.id, modulo); setModulo(null); await onCambiato(); mostra(modulo.id ? 'Consulente aggiornato' : 'Consulente aggiunto'); }); };
  const togli = (c) => esegui(async () => { await togliConsulente(archivioDb, c.id); setChiedi(null); await onCambiato(); mostra(`${c.nome} tolto dalla pratica`); });
  const campo = (k, etichetta, attr = {}) => (
    <label className="pp-campo"><span>{etichetta}</span><input value={modulo[k] || ''} onChange={(e) => setModulo({ ...modulo, [k]: e.target.value })} {...attr} /></label>
  );

  return (
    <>
      <Sezione titolo="Chi segue la pratica">
        {!consulenti ? <Vuoto>Carico…</Vuoto> : !consulenti.length ? <Vuoto>Nessun consulente: aggiungi avvocato, commercialista o perito con i contatti.</Vuoto> : (
          <div className="pp-consulenti">
            {consulenti.map((c) => (
              <article key={c.id} className="pp-consulente">
                <div className="pp-consulente-testa">
                  <span className="pp-consulente-iniziali" aria-hidden="true">{iniziali(c.nome)}</span>
                  <span className="pp-consulente-nome">
                    <strong>{c.nome}</strong>
                    <span className="pp-riga-meta">{[c.ruolo, c.studio].filter(Boolean).join(' · ') || 'Consulente'}</span>
                  </span>
                </div>
                {(c.telefono || c.email || c.pec) && (
                  <ul className="pp-consulente-contatti">
                    {c.telefono && <li><span>Telefono</span><a href={linkTelefono(c.telefono)}>{c.telefono}</a></li>}
                    {c.email && <li><span>Email</span><a href={linkScrivi(c.email, p.titolo)}>{c.email}</a></li>}
                    {c.pec && <li><span>PEC</span><a href={linkScrivi(c.pec, p.titolo)}>{c.pec}</a></li>}
                  </ul>
                )}
                {c.note && <p className="pp-promemoria-nota">📝 {c.note}</p>}
                <div className="pp-consulente-azioni">
                  {c.telefono && <a className="pp-chip" href={linkTelefono(c.telefono)}>📞 Chiama</a>}
                  {c.telefono && <a className="pp-chip" href={linkWhatsAppA(c.telefono)} target="_blank" rel="noreferrer">💬 WhatsApp</a>}
                  {c.email && <a className="pp-chip" href={linkScrivi(c.email, p.titolo)}>✉ Scrivi</a>}
                  <button type="button" className="pp-chip" onClick={() => setModulo({ ...VUOTO, ...c })}>Modifica</button>
                  {chiedi === c.id
                    ? <button type="button" className="pp-chip pp-chip-rosso" onClick={() => togli(c)}>Conferma: togli</button>
                    : <button type="button" className="pp-chip" onClick={() => setChiedi(c.id)}>Togli</button>}
                </div>
              </article>
            ))}
          </div>
        )}
      </Sezione>

      {!modulo && suggeriti.length > 0 && (
        <Sezione titolo="Dalla scheda della pratica">
          <div className="pp-consulente-azioni">
            {suggeriti.map((s) => <button key={s.nome} type="button" className="pp-chip" onClick={() => setModulo({ ...VUOTO, ...s })}>+ {s.nome}{s.ruolo ? ` · ${s.ruolo}` : ''}</button>)}
          </div>
        </Sezione>
      )}

      {modulo ? (
        <Sezione titolo={modulo.id ? 'Modifica consulente' : 'Nuovo consulente'}>
          <form onSubmit={salva} className="pp-consulente-modulo">
            {campo('nome', 'Nome e cognome', { required: true, autoComplete: 'name' })}
            <label className="pp-campo"><span>Ruolo</span>
              <input list="pp-ruoli-consulente" value={modulo.ruolo || ''} onChange={(e) => setModulo({ ...modulo, ruolo: e.target.value })} />
              <datalist id="pp-ruoli-consulente">{RUOLI_CONSULENTE.map((r) => <option key={r} value={r} />)}</datalist>
            </label>
            {campo('studio', 'Studio o società')}
            {campo('telefono', 'Telefono', { type: 'tel', inputMode: 'tel', autoComplete: 'tel' })}
            {campo('email', 'Email', { type: 'email', inputMode: 'email', autoComplete: 'email' })}
            {campo('pec', 'PEC', { type: 'email', inputMode: 'email' })}
            <label className="pp-campo"><span>Note</span><textarea rows={2} value={modulo.note || ''} onChange={(e) => setModulo({ ...modulo, note: e.target.value })} /></label>
            <p className="pp-riga-meta">Con email o PEC, le conversazioni con questa persona compaiono anche nella scheda «Email» della pratica.</p>
            <div className="pp-form-azioni">
              <button type="button" className="pp-bottone pp-bottone-chiaro" onClick={() => setModulo(null)}>Annulla</button>
              <button className="pp-bottone">Salva</button>
            </div>
          </form>
        </Sezione>
      ) : (
        <button type="button" className="pp-bottone" onClick={() => setModulo({ ...VUOTO })}>+ Aggiungi consulente</button>
      )}
    </>
  );
}

export function EmailPratica({ email, consulenti, ctx }) {
  const cerca = linkGmailConsulenti(consulenti);
  return (
    <>
      <Sezione titolo="Scambi di email" azione={email ? <span className="pp-riga-meta">{email.length} {email.length === 1 ? 'conversazione' : 'conversazioni'}</span> : null}>
        {!email ? <Vuoto>Carico…</Vuoto> : !email.length ? <Vuoto>Nessuna email collegata. Aggiungi i consulenti con l'indirizzo email: le loro conversazioni compariranno qui.</Vuoto> : (
          <ul className="pp-email-pratica">
            {email.map((m) => (
              <li key={m.thread_id}>
                <a className="pp-email-riga" href={linkConversazione(m.thread_id)} target="_blank" rel="noreferrer">
                  <span className="pp-email-testa">
                    <strong>{m.oggetto || '(senza oggetto)'}</strong>
                    <time>{m.ultima ? dataBreve(String(m.ultima).slice(0, 10)) : ''}</time>
                  </span>
                  <span className="pp-riga-meta">{(m.mittenti || []).map(nomeMittente).join(', ') || '—'}</span>
                  <span className="pp-email-segni">
                    {m.da_consulente && <span className="pp-etichetta">consulente</span>}
                    {!m.in_pratica && <span className="pp-etichetta">non ancora nella pratica</span>}
                    {m.n_documenti > 1 && <span className="pp-riga-meta">{m.n_documenti} elementi in archivio</span>}
                  </span>
                </a>
                {m.documento_email && <button type="button" className="pp-chip" onClick={() => ctx.apri({ tipo: 'documento', id: m.documento_email })}>Leggi qui</button>}
              </li>
            ))}
          </ul>
        )}
      </Sezione>
      {cerca && <a className="pp-bottone pp-bottone-chiaro" href={cerca} target="_blank" rel="noreferrer">Tutte le email con i consulenti in Gmail ›</a>}
    </>
  );
}

const iniziali = (n) => String(n || '').replace(/^(avv|dott|dr|geom|ing|arch|rag|not)\.?\s+/i, '').split(/\s+/).filter(Boolean).slice(0, 2).map((x) => x[0].toUpperCase()).join('') || '?';
