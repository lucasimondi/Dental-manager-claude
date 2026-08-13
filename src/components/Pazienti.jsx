import React, { useState } from 'react';
import { Btn, Crd, Fld, Inp, Txt, Modal, Toast, Ic } from './ui';
import { C, uid, fmtD, today } from '../lib/utils';
import ImportCsvModal from './ImportCsvModal.jsx';
import DupModal from './DupModal.jsx';
import SchedaPaz from './SchedaPaz.jsx';
import { salvaPosizione, pulisciPosizione } from '../lib/posizioneNavigazione';

export default function Pazienti({ patients, setPatients, plans, setPlans, payments, setPayments, appointments, setAppointments, si, features, onNuovoPiano, implants, setImplants, onNuovoAppuntamento, templates }) {
  const [modal, setModal] = useState(false);
  const [importModal, setImportModal] = useState(false);
  const [dupModal, setDupModal] = useState(false);
  const [form, setForm] = useState({});
  const [scheda, setScheda] = useState(null);
  const [search, setSearch] = useState('');
  const [searchFocus, setSearchFocus] = useState(false);
  const [toast, setToast] = useState('');
  const [confirmDelId, setConfirmDelId] = useState(null);
  const F = (f) => setForm((p) => ({ ...p, ...f }));
  const limitePazienti = features?.max_pazienti ?? null;
  const limiteRaggiunto = limitePazienti != null && patients.length >= limitePazienti;

  const openEdit = (p) => {
    if (!p && limiteRaggiunto) { setToast(`Hai raggiunto il limite di ${limitePazienti} pazienti del tuo piano. Passa a Pro per pazienti illimitati.`); return; }
    setForm(p || { nome: '', cognome: '', dataNascita: '', telefono: '', email: '', cf: '', indirizzo: '', cap: '', comune: '', provincia: '', opposizione_sts: false, note: '' }); setModal(true);
  };
  const save = () => {
    if (!form.nome || !form.cognome) return;
    if (!form.id && limiteRaggiunto) { setToast(`Limite di ${limitePazienti} pazienti raggiunto.`); setModal(false); return; }
    if (form.id) setPatients((p) => p.map((x) => (x.id === form.id ? form : x)));
    else setPatients((p) => [...p, { ...form, id: uid() }]);
    setModal(false);
    setToast('Salvato ✓');
  };
  const del = (id) => {
    setPatients((p) => p.filter((x) => x.id !== id));
    setPlans((p) => p.filter((x) => x.pazienteId !== id));
    setToast('Paziente eliminato');
  };

  const chiaveDup = (p) => `${(p.nome || '').trim().toLowerCase()}|${(p.cognome || '').trim().toLowerCase()}`;
  const handleImport = (nuoviPazienti) => {
    const esistenti = new Set(patients.map(chiaveDup));
    let daImportare = nuoviPazienti.filter((p) => !esistenti.has(chiaveDup(p)));
    const scartati = nuoviPazienti.length - daImportare.length;
    let bloccatiDaLimite = 0;
    if (limitePazienti != null) {
      const postiLiberi = Math.max(0, limitePazienti - patients.length);
      if (daImportare.length > postiLiberi) {
        bloccatiDaLimite = daImportare.length - postiLiberi;
        daImportare = daImportare.slice(0, postiLiberi);
      }
    }
    setPatients((prev) => [...prev, ...daImportare.map((p) => ({ ...p, id: uid() }))]);
    setImportModal(false);
    if (bloccatiDaLimite > 0) setToast(`${daImportare.length} importati. ${bloccatiDaLimite} non importati: limite di ${limitePazienti} pazienti raggiunto.`);
    else setToast(scartati > 0 ? `${daImportare.length} importati, ${scartati} scartati (già esistenti)` : `${daImportare.length} pazienti importati ✓`);
  };

  const gruppiDuplicati = (() => {
    const mappa = {};
    patients.forEach((p) => {
      const k = chiaveDup(p);
      if (!k.trim() || k === '|') return;
      if (!mappa[k]) mappa[k] = [];
      mappa[k].push(p);
    });
    return Object.values(mappa).filter((g) => g.length > 1);
  })();

  // ── RICERCA TOLLERANTE ──
  // Normalizza rimuovendo accenti/maiuscole, così "Perù" == "peru".
  const normalizza = (s) => (s || '')
    .toString()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

  // Distanza di Levenshtein "economica": conta quante modifiche servono per
  // trasformare a in b, ma si ferma presto se supera la soglia (per
  // performance su liste lunghe). Usata solo su parole corte/medie.
  const distanzaBreve = (a, b, soglia) => {
    if (Math.abs(a.length - b.length) > soglia) return soglia + 1;
    const dp = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
    for (let j = 0; j <= b.length; j++) dp[0][j] = j;
    for (let i = 1; i <= a.length; i++) {
      for (let j = 1; j <= b.length; j++) {
        dp[i][j] = a[i - 1] === b[j - 1]
          ? dp[i - 1][j - 1]
          : 1 + Math.min(dp[i - 1][j - 1], dp[i - 1][j], dp[i][j - 1]);
      }
    }
    return dp[a.length][b.length];
  };

  // Una "parola" cercata combacia con un campo del paziente se: è contenuta
  // direttamente (caso più comune), oppure se è abbastanza vicina per
  // tolleranza a un piccolo errore di battitura (1 carattere ogni ~5).
  const tokenCombacia = (token, campoNorm) => {
    if (!token) return true;
    if (campoNorm.includes(token)) return true;
    if (token.length < 3) return false; // token troppo corti: solo match esatto, altrimenti troppi falsi positivi
    const soglia = token.length <= 5 ? 1 : 2;
    // confronta contro ogni parola del campo, non l'intera stringa
    return campoNorm.split(/\s+/).some((w) => w.length >= 2 && distanzaBreve(token, w, soglia) <= soglia);
  };

  const patientsConScore = (() => {
    const q = normalizza(search);
    if (!q) return patients.map((p) => ({ p, score: 0 }));
    const tokens = q.split(/\s+/).filter(Boolean);
    const risultati = [];
    for (const p of patients) {
      const nomeCompleto = normalizza(`${p.nome} ${p.cognome}`);
      const cf = normalizza(p.cf);
      const tel = normalizza(p.telefono);
      const campoUnico = `${nomeCompleto} ${cf} ${tel}`;

      // Ogni token della query deve combaciare con qualcosa (ordine libero:
      // "Rossi Mario" o "Mario Rossi" trovano lo stesso paziente).
      const tuttiCombaciano = tokens.every((t) =>
        tokenCombacia(t, nomeCompleto) || tokenCombacia(t, cf) || tokenCombacia(t, tel)
      );
      if (!tuttiCombaciano) continue;

      // Punteggio di rilevanza: match esatto all'inizio del nome > contiene > fuzzy
      let score = 0;
      if (nomeCompleto.startsWith(q)) score = 100;
      else if (nomeCompleto.includes(q)) score = 80;
      else if (campoUnico.includes(q)) score = 60;
      else score = 30; // trovato solo grazie alla tolleranza fuzzy
      risultati.push({ p, score });
    }
    return risultati.sort((a, b) => b.score - a.score);
  })();
  const filtered = patientsConScore.map((r) => r.p);

  // Evidenzia nel testo la porzione che ha fatto scattare il match, per dare
  // un riscontro visivo immediato del perché quel paziente è comparso.
  const evidenzia = (testo) => {
    if (!search.trim() || !testo) return testo;
    const norm = normalizza(testo);
    const tokens = normalizza(search).split(/\s+/).filter((t) => t.length >= 2);
    let ranges = [];
    tokens.forEach((t) => {
      const idx = norm.indexOf(t);
      if (idx >= 0) ranges.push([idx, idx + t.length]);
    });
    if (ranges.length === 0) return testo;
    ranges.sort((a, b) => a[0] - b[0]);
    const merged = [];
    ranges.forEach(([s, e]) => {
      const last = merged[merged.length - 1];
      if (last && s <= last[1]) last[1] = Math.max(last[1], e);
      else merged.push([s, e]);
    });
    const parts = [];
    let cursor = 0;
    merged.forEach(([s, e], i) => {
      if (s > cursor) parts.push(testo.slice(cursor, s));
      parts.push(<mark key={i} style={{ background: C.pri + '33', color: C.pri, borderRadius: 3, padding: '0 1px' }}>{testo.slice(s, e)}</mark>);
      cursor = e;
    });
    if (cursor < testo.length) parts.push(testo.slice(cursor));
    return parts;
  };

  if (scheda) {
    return (
      <SchedaPaz
        paz={scheda} plans={plans} setPlans={setPlans} payments={payments} appointments={appointments}
        si={si} features={features} implants={implants} setImplants={setImplants}
        onClose={() => { setScheda(null); pulisciPosizione(['schedaPazId', 'schedaPazTab']); }}
        onEdit={(p) => { setScheda(null); openEdit(p); }}
        onNuovoPiano={(id) => { setScheda(null); onNuovoPiano(id); }}
        setPatients={setPatients}
        setAppointments={setAppointments}
        onNuovoAppuntamento={onNuovoAppuntamento}
        templates={templates}
        setPayments={setPayments}
      />
    );
  }

  // STATISTICHE
  const oggi = today();
  const meseCorrente = oggi.slice(0, 7);
  const annoCorrente = oggi.slice(0, 4);
  const dataCreazione = (p) => {
    const tms = Number(p.id);
    if (!tms || isNaN(tms)) return null;
    return new Date(tms).toISOString().slice(0, 10);
  };
  const nuoviMese = patients.filter((p) => { const d = dataCreazione(p); return d && d.startsWith(meseCorrente); }).length;
  const nuoviAnno = patients.filter((p) => { const d = dataCreazione(p); return d && d.startsWith(annoCorrente); }).length;
  const preventiviAccettati = plans.filter((pl) => pl.stato === 'accettato' || pl.stato === 'concluso').length;
  const preventiviNonAccettati = plans.filter((pl) => pl.stato === 'rifiutato').length;
  const preventiviAttesa = plans.filter((pl) => (pl.stato || 'attivo') === 'attivo').length;
  const contaPrestazioni = {};
  plans.forEach((pl) => pl.voci.forEach((v) => {
    if (!v.eseguita) return;
    const k = v.prestazione || '—';
    contaPrestazioni[k] = (contaPrestazioni[k] || 0) + 1;
  }));
  const topPrestazioni = Object.entries(contaPrestazioni).sort((a, b) => b[1] - a[1]).slice(0, 5);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100%' }}>
      {toast && <Toast msg={toast} onDone={() => setToast('')} />}

      {/* Header + barra di ricerca: sticky in cima anche scrollando la lista */}
      <div style={{ position: 'sticky', top: -13, zIndex: 20, background: C.bg, marginLeft: -13, marginRight: -13, marginTop: -13, padding: '13px 13px 0' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, gap: 8 }}>
          <div style={{ fontSize: 20, fontWeight: 800 }}>Pazienti</div>
          <div style={{ display: 'flex', gap: 6 }}>
            {gruppiDuplicati.length > 0 && (
              <button onClick={() => setDupModal(true)} style={{ background: C.danL, border: 'none', borderRadius: 10, padding: '10px 13px', color: C.dan, fontWeight: 700, fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}>
                ⚠️ {gruppiDuplicati.length} dup.
              </button>
            )}
            <button onClick={() => setImportModal(true)} style={{ background: C.priL, border: 'none', borderRadius: 10, padding: '10px 13px', color: C.pri, fontWeight: 700, fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}>
              📥 CSV
            </button>
            <Btn ch={limiteRaggiunto ? '🔒 Limite raggiunto' : 'Nuovo'} ic={limiteRaggiunto ? undefined : 'plus'} onClick={() => openEdit()} />
          </div>
        </div>
        {limitePazienti != null && (
          <div style={{ fontSize: 11, color: limiteRaggiunto ? C.dan : C.txl, marginBottom: 10, marginTop: -8 }}>
            {patients.length}/{limitePazienti} pazienti usati nel piano attuale{limiteRaggiunto ? ' — passa a Pro per pazienti illimitati' : ''}
          </div>
        )}

        <div style={{ position: 'relative', marginBottom: searchFocus ? 10 : 14 }}>
          <div style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)' }}><Ic n="srch" s={15} c={C.txl} /></div>
          <Inp
            placeholder="Cerca nome, CF, telefono…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onFocus={() => setSearchFocus(true)}
            enterKeyHint="search"
            autoCorrect="off"
            autoCapitalize="words"
            style={{ paddingLeft: 36, paddingRight: search ? 36 : 12 }}
          />
          {search && (
            <button
              onClick={() => { setSearch(''); }}
              style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: C.brd, border: 'none', borderRadius: '50%', width: 20, height: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: C.txm, fontSize: 12, lineHeight: 1, padding: 0 }}
            >✕</button>
          )}
          {searchFocus && (
            <button
              onClick={() => { setSearchFocus(false); setSearch(''); }}
              style={{ marginTop: 8, background: 'none', border: 'none', color: C.pri, fontSize: 13, fontWeight: 700, cursor: 'pointer', padding: 0 }}
            >Annulla</button>
          )}
        </div>
      </div>

      {/* ── MODALITÀ RICERCA ATTIVA ──
          Nasconde le statistiche e mostra solo i risultati, così su iPhone/Android
          la tastiera non copre mai la lista: l'area risultati resta sempre sopra
          la tastiera perché non c'è altro contenuto sotto a spingerla giù. */}
      {searchFocus ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
          {search.trim() === '' ? (
            <div style={{ textAlign: 'center', color: C.txl, padding: '30px 20px', fontSize: 13 }}>
              Scrivi nome, cognome, codice fiscale o telefono
            </div>
          ) : (
            <>
              <div style={{ fontSize: 11, color: C.txl, fontWeight: 600 }}>
                {filtered.length} {filtered.length === 1 ? 'risultato' : 'risultati'}
              </div>
              {filtered.map((p) => (
                <RigaPaziente key={p.id} p={p} evidenzia={evidenzia} onOpen={() => { setScheda(p); salvaPosizione({ schedaPazId: p.id, schedaPazTab: 'info' }); setSearchFocus(false); }} onDelete={() => setConfirmDelId(p.id)} confirming={confirmDelId === p.id} onCancelDelete={() => setConfirmDelId(null)} onConfirmDelete={() => { del(p.id); setConfirmDelId(null); }} />
              ))}
              {filtered.length === 0 && (
                <div style={{ textAlign: 'center', color: C.txl, padding: 40 }}>
                  Nessun paziente trovato per "{search}"
                </div>
              )}
            </>
          )}
        </div>
      ) : (
        <>
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 11, fontWeight: 800, color: C.txm, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>📊 Andamento studio</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 9, marginBottom: 9 }}>
          <Crd style={{ padding: 12, display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ background: C.priL, borderRadius: 9, padding: 8, flexShrink: 0 }}><Ic n="pz" s={17} c={C.pri} /></div>
            <div><div style={{ fontSize: 18, fontWeight: 800 }}>{nuoviMese}</div><div style={{ fontSize: 10, color: C.txm, fontWeight: 600 }}>Nuovi questo mese</div></div>
          </Crd>
          <Crd style={{ padding: 12, display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ background: '#E8FAF9', borderRadius: 9, padding: 8, flexShrink: 0 }}><Ic n="pz" s={17} c={C.acc} /></div>
            <div><div style={{ fontSize: 18, fontWeight: 800 }}>{nuoviAnno}</div><div style={{ fontSize: 10, color: C.txm, fontWeight: 600 }}>Nuovi quest'anno</div></div>
          </Crd>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 9 }}>
          <Crd style={{ padding: '10px 8px', textAlign: 'center' }}>
            <div style={{ fontSize: 17, fontWeight: 800, color: C.suc }}>{preventiviAccettati}</div>
            <div style={{ fontSize: 9, color: C.txm, fontWeight: 600, marginTop: 2 }}>Preventivi accettati</div>
          </Crd>
          <Crd style={{ padding: '10px 8px', textAlign: 'center' }}>
            <div style={{ fontSize: 17, fontWeight: 800, color: C.war }}>{preventiviAttesa}</div>
            <div style={{ fontSize: 9, color: C.txm, fontWeight: 600, marginTop: 2 }}>In attesa</div>
          </Crd>
          <Crd style={{ padding: '10px 8px', textAlign: 'center' }}>
            <div style={{ fontSize: 17, fontWeight: 800, color: C.dan }}>{preventiviNonAccettati}</div>
            <div style={{ fontSize: 9, color: C.txm, fontWeight: 600, marginTop: 2 }}>Rifiutati</div>
          </Crd>
        </div>
        {topPrestazioni.length > 0 && (
          <Crd style={{ padding: 12 }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: C.txm, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 9 }}>🏆 Prestazioni più eseguite</div>
            {topPrestazioni.map(([nome, n], i) => {
              const max = topPrestazioni[0][1];
              const pct = Math.round((n / max) * 100);
              return (
                <div key={nome} style={{ marginBottom: i < topPrestazioni.length - 1 ? 7 : 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: C.txt }}>{i + 1}. {nome}</span>
                    <span style={{ fontSize: 12, fontWeight: 800, color: C.pri }}>{n}</span>
                  </div>
                  <div style={{ background: C.bg, borderRadius: 4, height: 5, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${pct}%`, background: C.pri, borderRadius: 4 }} />
                  </div>
                </div>
              );
            })}
          </Crd>
        )}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
        {filtered.map((p) => (
          <RigaPaziente key={p.id} p={p} evidenzia={evidenzia} onOpen={() => { setScheda(p); salvaPosizione({ schedaPazId: p.id, schedaPazTab: 'info' }); }} onDelete={() => setConfirmDelId(p.id)} confirming={confirmDelId === p.id} onCancelDelete={() => setConfirmDelId(null)} onConfirmDelete={() => { del(p.id); setConfirmDelId(null); }} />
        ))}
        {filtered.length === 0 && <div style={{ textAlign: 'center', color: C.txl, padding: 40 }}>Nessun paziente</div>}
      </div>
      </>
      )}

      {modal && (
        <Modal title={form.id ? 'Modifica paziente' : 'Nuovo paziente'} onClose={() => setModal(false)} wide>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <Fld label="Nome"><Inp value={form.nome || ''} onChange={(e) => F({ nome: e.target.value })} /></Fld>
            <Fld label="Cognome"><Inp value={form.cognome || ''} onChange={(e) => F({ cognome: e.target.value })} /></Fld>
            <Fld label="Data nascita"><Inp type="date" value={form.dataNascita || ''} onChange={(e) => F({ dataNascita: e.target.value })} /></Fld>
            <Fld label="Codice fiscale"><Inp value={form.cf || ''} onChange={(e) => F({ cf: e.target.value.toUpperCase() })} /></Fld>
            <Fld label="Telefono"><Inp type="tel" value={form.telefono || ''} onChange={(e) => F({ telefono: e.target.value })} /></Fld>
            <Fld label="Email"><Inp type="email" value={form.email || ''} onChange={(e) => F({ email: e.target.value })} /></Fld>
          </div>
          <Fld label="Indirizzo"><Inp value={form.indirizzo || ''} onChange={(e) => F({ indirizzo: e.target.value })} /></Fld>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
            <Fld label="CAP"><Inp value={form.cap || ''} onChange={(e) => F({ cap: e.target.value })} /></Fld>
            <Fld label="Comune"><Inp value={form.comune || ''} onChange={(e) => F({ comune: e.target.value })} /></Fld>
            <Fld label="Provincia"><Inp value={form.provincia || ''} onChange={(e) => F({ provincia: e.target.value.toUpperCase().slice(0, 2) })} placeholder="es. MI" /></Fld>
          </div>
          {(!si?.regime_fiscale || si.regime_fiscale === 'sanitario_esente_art10') && (
            <div onClick={() => F({ opposizione_sts: !form.opposizione_sts })} style={{ display: 'flex', alignItems: 'center', gap: 10, background: form.opposizione_sts ? C.warL : C.bg, borderRadius: 10, padding: 10, marginTop: 8, marginBottom: 8, cursor: 'pointer' }}>
              <input type="checkbox" checked={!!form.opposizione_sts} onChange={() => {}} style={{ width: 16, height: 16 }} />
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: C.txt }}>Si oppone all'invio dei dati al Sistema Tessera Sanitaria</div>
                <div style={{ fontSize: 10, color: C.txl }}>Diritto del paziente — se attivo, questa prestazione non verrà inclusa nella trasmissione STS</div>
              </div>
            </div>
          )}
          <Fld label="Note cliniche"><Txt value={form.note || ''} onChange={(e) => F({ note: e.target.value })} /></Fld>
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <Btn ch="Annulla" v="sec" onClick={() => setModal(false)} full />
            <Btn ch="Salva" onClick={save} full />
          </div>
        </Modal>
      )}
      {importModal && <ImportCsvModal onClose={() => setImportModal(false)} onImport={handleImport} />}
      {dupModal && <DupModal patients={patients} setPatients={setPatients} onClose={() => setDupModal(false)} />}
    </div>
  );
}

// Riga paziente riusata sia nella lista normale sia nella modalità ricerca
// attiva, con evidenziazione opzionale del testo che ha fatto scattare il match.
function RigaPaziente({ p, evidenzia, onOpen, onDelete, confirming, onCancelDelete, onConfirmDelete }) {
  return (
    <Crd style={{ padding: 0, overflow: 'hidden' }}>
      <div onClick={onOpen} style={{ display: 'flex', alignItems: 'center', gap: 11, padding: 14, cursor: 'pointer' }}>
        <div style={{ background: C.priL, borderRadius: 12, width: 42, height: 42, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <span style={{ fontSize: 14, fontWeight: 800, color: C.pri }}>{(p.nome[0] || '') + (p.cognome[0] || '')}</span>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: 14 }}>{evidenzia(`${p.nome} ${p.cognome}`)}</div>
          <div style={{ display: 'flex', gap: 10, marginTop: 2, flexWrap: 'wrap' }}>
            {p.telefono && <span style={{ fontSize: 11, color: C.txm }}>📞 {evidenzia(p.telefono)}</span>}
            {p.dataNascita && <span style={{ fontSize: 11, color: C.txm }}>🎂 {fmtD(p.dataNascita)}</span>}
            {p.cf && <span style={{ fontSize: 11, color: C.txm }}>{evidenzia(p.cf)}</span>}
          </div>
          {p.note && <div style={{ fontSize: 10, color: C.war, marginTop: 2 }}>⚠️ {p.note.slice(0, 50)}{p.note.length > 50 ? '…' : ''}</div>}
        </div>
        <button onClick={(e) => { e.stopPropagation(); confirming ? onCancelDelete() : onDelete(); }} style={{ background: C.danL, border: 'none', borderRadius: 8, padding: 8, cursor: 'pointer', display: 'flex', flexShrink: 0 }}>
          <Ic n="del" s={15} c={C.dan} />
        </button>
        <div style={{ color: C.txl }}>›</div>
      </div>
      {confirming && (
        <div style={{ background: C.danL, padding: '9px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, borderTop: `1px solid ${C.dan}30` }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: C.dan }}>Eliminare {p.nome} {p.cognome}? Verranno rimossi anche piani e pagamenti associati.</span>
          <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
            <button onClick={onCancelDelete} style={{ background: '#fff', border: `1px solid ${C.brd}`, borderRadius: 7, padding: '5px 10px', fontSize: 11, fontWeight: 700, cursor: 'pointer', color: C.txm }}>No</button>
            <button onClick={onConfirmDelete} style={{ background: C.dan, border: 'none', borderRadius: 7, padding: '5px 10px', fontSize: 11, fontWeight: 700, cursor: 'pointer', color: '#fff' }}>Sì, elimina</button>
          </div>
        </div>
      )}
    </Crd>
  );
}
