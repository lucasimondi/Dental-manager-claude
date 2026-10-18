// Impostazioni — persone, documenti personali, sezioni dei documenti, categorie, etichette, studio, account.
import { useEffect, useState } from 'react';
import { archivioDb } from '../../lib/supabasePersonal.js';
import { sessioneStudio, esciStudio, studioDb } from '../../lib/studio.js';
import { slug } from '../../lib/impostazioni.js';
import { colore, Sezione, Gruppo, Conferma } from '../../ui.jsx';
import { IconaPiu, IconaChiudi, IconaFreccia, IconaCestino, IconaEsci } from '../../Icone.jsx';

function ListaModificabile({ voci, onTogli, onAggiungi, segnaposto }) {
  const [nuovo, setNuovo] = useState('');
  return (
    <Gruppo>
      {voci.map((v) => (
        <div key={v.id} className="pp-voce">
          <span>{v.nome}</span>
          <button className="pp-icona-bottone pp-piccolo" aria-label={`Togli ${v.nome}`} onClick={() => onTogli(v.id)}><IconaChiudi size={16} /></button>
        </div>
      ))}
      <form className="pp-voce pp-voce-nuova" onSubmit={(e) => { e.preventDefault(); if (nuovo.trim()) { onAggiungi(nuovo.trim()); setNuovo(''); } }}>
        <input value={nuovo} onChange={(e) => setNuovo(e.target.value)} placeholder={segnaposto} />
        <button type="submit" className="pp-chip-azione" disabled={!nuovo.trim()}>Aggiungi</button>
      </form>
    </Gruppo>
  );
}

export function PaginaImpostazioni({ ctx, email }) {
  const { impostazioni, salvaImp, apri } = ctx;
  const { persone, categorie, sezioni, etichette } = impostazioni;
  return (
    <>
      <Sezione titolo="Persone">
        <p className="pp-riga-meta pp-spiegazione">A chi appartengono i documenti personali (carta d'identità, codice fiscale, …).</p>
        <ListaModificabile
          voci={persone.map((p) => ({ id: p, nome: p }))}
          onTogli={(p) => salvaImp({ ...impostazioni, persone: persone.filter((x) => x !== p) })}
          onAggiungi={(p) => salvaImp({ ...impostazioni, persone: [...persone, p] })}
          segnaposto="Nome e cognome"
        />
      </Sezione>
      <Sezione titolo="Documenti personali">
        <p className="pp-riga-meta pp-spiegazione">Le schede della sezione Personali.</p>
        <ListaModificabile
          voci={categorie}
          onTogli={(id) => salvaImp({ ...impostazioni, categorie: categorie.filter((c) => c.id !== id) })}
          onAggiungi={(nome) => salvaImp({ ...impostazioni, categorie: [...categorie, { id: slug(nome), nome, parole: [nome.toLowerCase()] }] })}
          segnaposto="Es. Tessera elettorale"
        />
      </Sezione>
      <Sezione titolo="Sezioni dei documenti">
        <p className="pp-riga-meta pp-spiegazione">Le schede in Documenti, accanto a Tutti e Pratiche. Ogni sezione raccoglie fascicoli e parole chiave.</p>
        <Gruppo>
          {sezioni.map((s) => (
            <button key={s.id} className="pp-riga" onClick={() => apri({ tipo: 'sezione', id: s.id })}>
              <span className="pp-riga-testo"><span className="pp-riga-titolo">{s.nome}</span><span className="pp-riga-meta">{[...s.fascicoli, ...s.parole].join(', ') || 'nessuna regola'}</span></span>
              <IconaFreccia size={16} />
            </button>
          ))}
          <button className="pp-riga pp-riga-aggiungi" onClick={() => apri({ tipo: 'sezione', id: null })}><IconaPiu size={18} /><span>Nuova sezione</span></button>
        </Gruppo>
      </Sezione>
      <Sezione titolo="Categorie delle spese">
        <ListaModificabile
          voci={impostazioni.categorieSpesa.map((c) => ({ id: c, nome: c }))}
          onTogli={(c) => salvaImp({ ...impostazioni, categorieSpesa: impostazioni.categorieSpesa.filter((x) => x !== c) })}
          onAggiungi={(c) => salvaImp({ ...impostazioni, categorieSpesa: [...impostazioni.categorieSpesa, c] })}
          segnaposto="Es. Animali"
        />
      </Sezione>
      <Sezione titolo="Categorie degli incassi">
        <ListaModificabile
          voci={impostazioni.categorieIncasso.map((c) => ({ id: c, nome: c }))}
          onTogli={(c) => salvaImp({ ...impostazioni, categorieIncasso: impostazioni.categorieIncasso.filter((x) => x !== c) })}
          onAggiungi={(c) => salvaImp({ ...impostazioni, categorieIncasso: [...impostazioni.categorieIncasso, c] })}
          segnaposto="Es. Vendite"
        />
      </Sezione>
      <Sezione titolo="Etichette dell'agenda">
        <p className="pp-riga-meta pp-spiegazione">Per i tuoi eventi. Il colore compare anche nell'agenda dello studio.</p>
        <Gruppo>
          {etichette.map((e) => (
            <div key={e.id} className="pp-voce">
              <span><span className="pp-punto" style={{ '--c': e.colore }} />{e.nome}</span>
              <span className="pp-voce-azioni">
                <input type="color" className="pp-colore pp-colore-piccolo" value={e.colore} aria-label={`Colore di ${e.nome}`}
                  onChange={(ev) => salvaImp({ ...impostazioni, etichette: etichette.map((x) => (x.id === e.id ? { ...x, colore: ev.target.value } : x)) })} />
                <button className="pp-icona-bottone pp-piccolo" aria-label={`Togli ${e.nome}`} disabled={etichette.length < 2}
                  onClick={() => salvaImp({ ...impostazioni, etichette: etichette.filter((x) => x.id !== e.id) })}><IconaChiudi size={16} /></button>
              </span>
            </div>
          ))}
          <NuovaEtichetta onAggiungi={(nome, colore) => salvaImp({ ...impostazioni, etichette: [...etichette, { id: slug(nome), nome, colore }] })} />
        </Gruppo>
      </Sezione>
      <Sezione titolo="Agenda dello studio">
        <StatoStudio />
      </Sezione>
      <Sezione titolo="Account">
        <Gruppo>
          <div className="pp-voce"><span>{email}</span></div>
          <button className="pp-riga pp-rosso" onClick={() => archivioDb.auth.signOut()}><IconaEsci size={18} /><span>Esci</span></button>
        </Gruppo>
      </Sezione>
    </>
  );
}

function NuovaEtichetta({ onAggiungi }) {
  const [nome, setNome] = useState('');
  const [colore, setColore] = useState('#7c3aed');
  return (
    <form className="pp-voce pp-voce-nuova" onSubmit={(e) => { e.preventDefault(); if (nome.trim()) { onAggiungi(nome.trim(), colore); setNome(''); } }}>
      <input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Nuova etichetta" />
      <input type="color" className="pp-colore pp-colore-piccolo" value={colore} onChange={(e) => setColore(e.target.value)} aria-label="Colore" />
      <button type="submit" className="pp-chip-azione" disabled={!nome.trim()}>Aggiungi</button>
    </form>
  );
}

function StatoStudio() {
  const [sessione, setSessione] = useState(undefined);
  useEffect(() => {
    sessioneStudio().then(setSessione);
    const { data } = studioDb.auth.onAuthStateChange((_e, s) => setSessione(s));
    return () => data.subscription.unsubscribe();
  }, []);
  if (sessione === undefined) return null;
  return (
    <Gruppo>
      <div className="pp-voce"><span>{sessione ? `Collegata come ${sessione.user?.email}` : 'Non collegata: apri Agenda per collegarla.'}</span></div>
      {sessione && <button className="pp-riga pp-rosso" onClick={() => esciStudio()}><IconaEsci size={18} /><span>Scollega l'agenda dello studio</span></button>}
    </Gruppo>
  );
}

export function PaginaSezione({ id, ctx, chiudi }) {
  const { impostazioni, salvaImp, fascicoli } = ctx;
  const esistente = impostazioni.sezioni.find((s) => s.id === id);
  const [nome, setNome] = useState(esistente?.nome || '');
  const [scelti, setScelti] = useState(esistente?.fascicoli || []);
  const [parole, setParole] = useState((esistente?.parole || []).join(', '));
  const [conferma, setConferma] = useState(false);
  const salva = async () => {
    const sezione = { id: esistente?.id || slug(nome), nome: nome.trim(), fascicoli: scelti, parole: parole.split(',').map((p) => p.trim()).filter(Boolean) };
    const altre = impostazioni.sezioni.filter((s) => s.id !== esistente?.id);
    await salvaImp({ ...impostazioni, sezioni: esistente ? impostazioni.sezioni.map((s) => (s.id === esistente.id ? sezione : s)) : [...altre, sezione] });
    chiudi();
  };
  return (
    <>
      <label className="pp-campo"><span>Nome della sezione</span><input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Es. Casa al mare" /></label>
      <Sezione titolo="Fascicoli inclusi">
        <Gruppo>
          {fascicoli.map((f) => (
            <label key={f.codice} className="pp-voce pp-spunta">
              <span><span className="pp-punto" style={{ '--c': colore(f.codice) }} />{f.nome}</span>
              <input type="checkbox" checked={scelti.includes(f.codice)} onChange={(e) => setScelti(e.target.checked ? [...scelti, f.codice] : scelti.filter((x) => x !== f.codice))} />
            </label>
          ))}
        </Gruppo>
      </Sezione>
      <label className="pp-campo"><span>Parole chiave (separate da virgole)</span>
        <input value={parole} onChange={(e) => setParole(e.target.value)} placeholder="Es. pellet, legna, stufa" />
      </label>
      <p className="pp-riga-meta">Un documento entra nella sezione se è in uno dei fascicoli scelti, oppure se il titolo o il riassunto contiene una delle parole.</p>
      <button className="pp-bottone pp-bottone-largo" disabled={!nome.trim() || (!scelti.length && !parole.trim())} onClick={salva}>Salva sezione</button>
      {esistente && (
        <div className="pp-elimina">
          {!conferma
            ? <button className="pp-testo-link pp-rosso" onClick={() => setConferma(true)}><IconaCestino size={16} /> Togli la sezione</button>
            : <Conferma testo="Togliere la sezione? I documenti restano in archivio." etichetta="Togli"
              onNo={() => setConferma(false)} onSi={async () => { await salvaImp({ ...impostazioni, sezioni: impostazioni.sezioni.filter((s) => s.id !== esistente.id) }); chiudi(); }} />}
        </div>
      )}
    </>
  );
}
