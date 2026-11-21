// IMPOSTAZIONI-UNICHE (PO 2026-11-21): «le impostazioni nella stessa pagina … tasto studio e
// personale per le impostazioni dei due, deve essere tutto impostabile».
// Le impostazioni della vita personale (persone, documenti personali, sezioni dei documenti,
// categorie di spese e incassi) si modificano anche da qui. Stesso dato di Personal: tabella
// impostazioni_app dell'archivio personale (progetto Supabase separato, RLS solo proprietario),
// letta e scritta con la sessione dell'archivio già salvata da Personal nello stesso indirizzo.
// Nessun nuovo accesso; senza sessione si spiega come collegarlo.
import React, { useEffect, useState } from 'react';
import { Btn, Crd, Fld, Inp, Ic } from './ui';
import { C } from '../lib/utils';
import { archivio } from '../lib/scadenzePersonali.js';
import { sectionDestination } from '../../shared/agenda/navigation.js';

const destinazionePersonal = () => {
  const url = new URL(sectionDestination('personal', 'impostazioni'));
  url.searchParams.set('imp', 'personale');
  return url.href;
};

function Titolo({ titolo, sotto }) {
  return (
    <div style={{ marginTop: 22, marginBottom: 10 }}>
      <div style={{ fontSize: 17, fontWeight: 800 }}>{titolo}</div>
      {sotto && <div style={{ fontSize: 12, color: C.txl, marginTop: 2 }}>{sotto}</div>}
    </div>
  );
}

function Elenco({ voci, onTogli, onAggiungi, segnaposto, etichetta }) {
  const [nuovo, setNuovo] = useState('');
  const aggiungi = () => { if (nuovo.trim()) { onAggiungi(nuovo.trim()); setNuovo(''); } };
  return (
    <Crd style={{ marginBottom: 12, padding: 0, overflow: 'hidden' }}>
      {voci.map((v) => (
        <div key={v.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 13px', borderBottom: `1px solid ${C.brd}` }}>
          <span style={{ flex: 1, minWidth: 0, fontWeight: 600, fontSize: 13, overflowWrap: 'anywhere' }}>{v.nome}</span>
          <button type="button" aria-label={`Togli ${v.nome}`} onClick={() => onTogli(v.id)} style={{ minWidth: 36, minHeight: 36, border: 0, borderRadius: 8, background: 'none', cursor: 'pointer' }}><Ic n="x" s={13} c={C.txm} /></button>
        </div>
      ))}
      <div style={{ display: 'flex', gap: 8, padding: 10 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <Inp value={nuovo} onChange={(e) => setNuovo(e.target.value)} placeholder={segnaposto} aria-label={etichetta}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); aggiungi(); } }} />
        </div>
        <Btn ch="Aggiungi" v="sec" onClick={aggiungi} dis={!nuovo.trim()} />
      </div>
    </Crd>
  );
}

function Sezioni({ sezioni, fascicoli, onSalva }) {
  const [aperta, setAperta] = useState(null); // id della sezione o 'nuova'
  const [bozza, setBozza] = useState(null);
  const apri = (s) => { setAperta(s?.id || 'nuova'); setBozza({ id: s?.id || null, nome: s?.nome || '', fascicoli: s?.fascicoli || [], parole: (s?.parole || []).join(', ') }); };
  const salva = async () => {
    const { slug } = await import('../../personal/src/lib/impostazioni.js');
    const sezione = { id: bozza.id || slug(bozza.nome), nome: bozza.nome.trim(), fascicoli: bozza.fascicoli, parole: bozza.parole.split(',').map((p) => p.trim()).filter(Boolean) };
    const ok = await onSalva(bozza.id ? sezioni.map((s) => (s.id === bozza.id ? sezione : s)) : [...sezioni.filter((s) => s.id !== sezione.id), sezione]);
    if (ok) { setAperta(null); setBozza(null); }
  };
  return (
    <Crd style={{ marginBottom: 12, padding: 0, overflow: 'hidden' }}>
      {sezioni.map((s) => (
        <button key={s.id} type="button" onClick={() => apri(s)} style={{ display: 'flex', width: '100%', alignItems: 'center', gap: 10, padding: '11px 13px', border: 0, borderBottom: `1px solid ${C.brd}`, background: aperta === s.id ? C.bg : 'none', textAlign: 'left', cursor: 'pointer' }}>
          <span style={{ flex: 1, minWidth: 0 }}>
            <span style={{ display: 'block', fontWeight: 600, fontSize: 13 }}>{s.nome}</span>
            <span style={{ display: 'block', fontSize: 11, color: C.txm, overflowWrap: 'anywhere' }}>{[...s.fascicoli, ...s.parole].join(', ') || 'nessuna regola'}</span>
          </span>
          <Ic n="edit" s={12} c={C.txl} />
        </button>
      ))}
      {aperta && bozza ? (
        <div style={{ padding: 12, display: 'grid', gap: 4 }}>
          <Fld label="Nome della sezione"><Inp value={bozza.nome} onChange={(e) => setBozza((b) => ({ ...b, nome: e.target.value }))} placeholder="Es. Casa al mare" /></Fld>
          {fascicoli.length > 0 && (
            <Fld label="Fascicoli inclusi">
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {fascicoli.map((f) => {
                  const on = bozza.fascicoli.includes(f.codice);
                  return <button key={f.codice} type="button" aria-pressed={on} onClick={() => setBozza((b) => ({ ...b, fascicoli: on ? b.fascicoli.filter((x) => x !== f.codice) : [...b.fascicoli, f.codice] }))} style={{ padding: '5px 10px', borderRadius: 20, border: `1.5px solid ${on ? C.pri : C.brd}`, background: on ? C.priL : C.sur, color: on ? C.pri : C.txm, fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>{f.nome}</button>;
                })}
              </div>
            </Fld>
          )}
          <Fld label="Parole chiave (separate da virgole)"><Inp value={bozza.parole} onChange={(e) => setBozza((b) => ({ ...b, parole: e.target.value }))} placeholder="Es. pellet, legna, stufa" /></Fld>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {bozza.id && <Btn ch="Togli" v="dan" onClick={async () => { if (confirm('Togliere la sezione? I documenti restano in archivio.')) { if (await onSalva(sezioni.filter((s) => s.id !== bozza.id))) { setAperta(null); setBozza(null); } } }} />}
            <Btn ch="Annulla" v="sec" onClick={() => { setAperta(null); setBozza(null); }} full />
            <Btn ch="Salva sezione" onClick={salva} dis={!bozza.nome.trim() || (!bozza.fascicoli.length && !bozza.parole.trim())} full />
          </div>
        </div>
      ) : (
        <button type="button" onClick={() => apri(null)} style={{ display: 'flex', width: '100%', alignItems: 'center', gap: 8, padding: '11px 13px', border: 0, background: 'none', color: C.pri, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>+ Nuova sezione</button>
      )}
    </Crd>
  );
}

export default function ImpostazioniPersonali({ setToast }) {
  const [stato, setStato] = useState({ caricamento: true });
  const [imp, setImp] = useState(null);
  const [fascicoli, setFascicoli] = useState([]);
  useEffect(() => {
    let vivo = true;
    (async () => {
      try {
        const db = await archivio();
        const { data } = await db.auth.getSession();
        if (!data?.session) { if (vivo) setStato({ collegato: false }); return; }
        const [{ leggiImpostazioni }, { conteggiFascicoli }] = await Promise.all([import('../../personal/src/lib/impostazioni.js'), import('../../personal/src/lib/archivio.js')]);
        const [valore, fasc] = await Promise.all([leggiImpostazioni(db), conteggiFascicoli(db).catch(() => [])]);
        if (!vivo) return;
        setImp(valore); setFascicoli(fasc || []); setStato({ collegato: true, email: data.session.user?.email });
      } catch (e) { if (vivo) setStato({ errore: e.message || String(e) }); }
    })();
    return () => { vivo = false; };
  }, []);

  // Rilegge prima di scrivere: si cambia solo la parte toccata (le etichette dell'agenda, per esempio,
  // si gestiscono in Agenda e Personal ne tiene una copia).
  const salva = async (parte) => {
    try {
      const db = await archivio();
      const { leggiImpostazioni, salvaImpostazioni } = await import('../../personal/src/lib/impostazioni.js');
      const attuali = await leggiImpostazioni(db);
      const nuove = await salvaImpostazioni(db, { ...attuali, ...parte });
      setImp(nuove);
      setToast('Salvato ✓');
      return true;
    } catch (e) { setToast(`Non salvato — ${e.message || 'riprova'}`); return false; }
  };

  if (stato.caricamento) return <Crd><div style={{ fontSize: 12.5, color: C.txm }}>Carico le impostazioni personali…</div></Crd>;
  if (!stato.collegato) {
    return (
      <Crd style={{ marginTop: 16 }}>
        <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 6 }}>{stato.errore ? 'Impostazioni personali non disponibili' : 'Archivio personale non collegato su questo dispositivo'}</div>
        <div style={{ fontSize: 12.5, color: C.txm, marginBottom: 12 }}>{stato.errore || 'Apri Personal una volta su questo dispositivo: dopo le impostazioni personali si modificano anche da qui.'}</div>
        <a href={destinazionePersonal()} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, minHeight: 44, borderRadius: 10, background: C.pri, color: '#fff', fontWeight: 700, fontSize: 13, textDecoration: 'none' }}>Apri Personal</a>
      </Crd>
    );
  }
  const lista = (xs) => xs.map((x) => ({ id: x, nome: x }));
  return (
    <div className="impostazioni-personali">
      <Titolo titolo="Persone" sotto="A chi appartengono i documenti personali (carta d'identità, codice fiscale, …)" />
      <Elenco voci={lista(imp.persone)} etichetta="Nuova persona" segnaposto="Nome e cognome"
        onTogli={(p) => salva({ persone: imp.persone.filter((x) => x !== p) })}
        onAggiungi={(p) => salva({ persone: [...imp.persone, p] })} />

      <Titolo titolo="Documenti personali" sotto="Le schede della sezione Personali" />
      <Elenco voci={imp.categorie} etichetta="Nuovo documento personale" segnaposto="Es. Tessera elettorale"
        onTogli={(id) => salva({ categorie: imp.categorie.filter((c) => c.id !== id) })}
        onAggiungi={async (nome) => { const { slug } = await import('../../personal/src/lib/impostazioni.js'); return salva({ categorie: [...imp.categorie, { id: slug(nome), nome, parole: [nome.toLowerCase()] }] }); }} />

      <Titolo titolo="Sezioni dei documenti" sotto="Le schede in Documenti, accanto a Tutti e Pratiche: fascicoli e parole chiave" />
      <Sezioni sezioni={imp.sezioni} fascicoli={fascicoli} onSalva={(sezioni) => salva({ sezioni })} />

      <Titolo titolo="Categorie delle spese" />
      <Elenco voci={lista(imp.categorieSpesa)} etichetta="Nuova categoria di spesa" segnaposto="Es. Animali"
        onTogli={(c) => salva({ categorieSpesa: imp.categorieSpesa.filter((x) => x !== c) })}
        onAggiungi={(c) => salva({ categorieSpesa: [...imp.categorieSpesa, c] })} />

      <Titolo titolo="Categorie degli incassi" />
      <Elenco voci={lista(imp.categorieIncasso)} etichetta="Nuova categoria di incasso" segnaposto="Es. Vendite"
        onTogli={(c) => salva({ categorieIncasso: imp.categorieIncasso.filter((x) => x !== c) })}
        onAggiungi={(c) => salva({ categorieIncasso: [...imp.categorieIncasso, c] })} />

      <Titolo titolo="Notifiche e account personale" sotto={`Archivio collegato come ${stato.email || '—'}`} />
      <Crd style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 12.5, color: C.txm, marginBottom: 12 }}>Le notifiche dei promemoria si attivano sul telefono, dentro Personal (servono i permessi di quell'app).</div>
        <a href={destinazionePersonal()} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, minHeight: 44, borderRadius: 10, border: `1.5px solid ${C.brd}`, color: C.pri, fontWeight: 700, fontSize: 13, textDecoration: 'none' }}>Notifiche e account in Personal</a>
      </Crd>
    </div>
  );
}
