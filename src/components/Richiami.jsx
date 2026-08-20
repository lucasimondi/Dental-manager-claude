import React, { useState, useEffect } from 'react';
import { Btn, Crd, Fld, Inp, Sel, Modal, Toast, Bdg, Ic, SelettorePaziente, WaAction } from './ui';
import { C, fmtD, today, uid, RICHIAMO_CATEGORIE, DEF_TPL_GENERICO } from '../lib/utils';
import { useFormPersistente } from '../lib/useFormPersistente';
import { generaRichiamiBot } from '../lib/richiamiBot';

const CATEGORIE_FILTRO = [
  { id: 'tutte', label: 'Tutte' },
  ...Object.entries(RICHIAMO_CATEGORIE).map(([id, c]) => ({ id, label: `${c.icona} ${c.label}` })),
];

/* ── SEZIONE RICHIAMI ──
   Aggrega in un unico posto i richiami clinici (dopo un'igiene/impianto,
   se non c'è già un appuntamento vicino alla data), i preventivi fermi in
   attesa da troppo tempo e gli incassi sospesi — generati dal "bot"
   (generaRichiamiBot, vedi anche l'effetto automatico in App.jsx) oppure
   creati a mano qui. "Scansiona ora" forza un ricalcolo immediato, utile
   per le condizioni che dipendono solo dal passare dei giorni (standby). */
export default function Richiami({ patients, plans, payments, appointments, richiami, setRichiami, templates, features, onOpenPaz, si, autoOpenNew, onAutoOpenNewHandled }) {
  const isDentistico = !si?.vertical || si.vertical === 'dentistico';
  const [filtroCategoria, setFiltroCategoria] = useState('tutte');
  const [mostraFatti, setMostraFatti] = useState(false);
  const [modal, setModal] = useState(false);
  const [pazSearch, setPazSearch] = useState('');
  const [toast, setToast] = useState('');
  const [form, setForm, clearFormDraft] = useFormPersistente('nuovo_richiamo', { pazienteId: '', categoria: 'generico', motivo: '', dataScadenza: today() });
  const F = (f) => setForm((p) => ({ ...p, ...f }));

  // Arrivo da un'azione rapida della Home ("Richiamo"): apre subito il vero
  // modale "Nuovo richiamo" (stesso apri usato dal tasto "+" qui sotto).
  useEffect(() => {
    if (autoOpenNew) {
      setForm({ pazienteId: '', categoria: 'generico', motivo: '', dataScadenza: today() });
      setPazSearch('');
      setModal(true);
      onAutoOpenNewHandled && onAutoOpenNewHandled();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoOpenNew]);

  const scansiona = () => {
    const { proposte, daRimuovere } = generaRichiamiBot({ patients, plans, payments, appointments, richiami });
    if (proposte.length === 0 && daRimuovere.length === 0) { setToast('Nessun nuovo richiamo trovato'); return; }
    setRichiami((prev) => [
      ...prev.filter((r) => !daRimuovere.includes(r.id)),
      ...proposte.map((p) => ({ ...p, id: uid() })),
    ]);
    setToast(`${proposte.length} nuovo/i richiamo/i${daRimuovere.length ? ` · ${daRimuovere.length} risolto/i con l'agenda` : ''}`);
  };

  const save = () => {
    if (!form.pazienteId || !form.dataScadenza) return;
    setRichiami((prev) => [...prev, {
      id: uid(), pazienteId: Number(form.pazienteId), categoria: form.categoria,
      motivo: form.motivo.trim(), dataScadenza: form.dataScadenza, origine: 'manuale', stato: 'da_fare', chiaveBot: null,
    }]);
    setModal(false);
    clearFormDraft();
    setToast('Richiamo creato ✓');
  };

  const segnaFatto = (id) => setRichiami((prev) => prev.map((r) => (r.id === id ? { ...r, stato: 'fatto' } : r)));
  const riapri = (id) => setRichiami((prev) => prev.map((r) => (r.id === id ? { ...r, stato: 'da_fare' } : r)));
  const elimina = (id) => { if (confirm('Eliminare questo richiamo?')) setRichiami((prev) => prev.filter((r) => r.id !== id)); };

  const t = today();
  const tra30 = (() => { const d = new Date(t + 'T12:00'); d.setDate(d.getDate() + 30); return d.toISOString().slice(0, 10); })();

  const aperti = richiami.filter((r) => r.stato === 'da_fare');
  const scaduti = aperti.filter((r) => r.dataScadenza < t);
  const prossimi = aperti.filter((r) => r.dataScadenza >= t && r.dataScadenza <= tra30);

  const filtrati = richiami
    .filter((r) => (filtroCategoria === 'tutte' || r.categoria === filtroCategoria))
    .filter((r) => (mostraFatti ? r.stato === 'fatto' : r.stato === 'da_fare'))
    .sort((a, b) => a.dataScadenza.localeCompare(b.dataScadenza));

  const tplSollecito = templates.find((tp) => tp.nome === 'Sollecito controllo') || DEF_TPL_GENERICO[3];

  return (
    <div>
      {toast && <Toast msg={toast} onDone={() => setToast('')} />}

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, gap: 8, flexWrap: 'wrap' }}>
        <div style={{ fontSize: 20, fontWeight: 800 }}>Richiami</div>
        <div style={{ display: 'flex', gap: 7 }}>
          <Btn ch="🔄 Scansiona ora" v="sec" onClick={scansiona} />
          <Btn ch="Richiamo" ic="plus" onClick={() => { setForm({ pazienteId: '', categoria: 'generico', motivo: '', dataScadenza: today() }); setPazSearch(''); setModal(true); }} />
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
        <Crd style={{ display: 'flex', alignItems: 'center', gap: 11, padding: 12 }}>
          <div style={{ background: C.danL, borderRadius: 10, padding: 9 }}><Ic n="clk" s={20} c={C.dan} /></div>
          <div><div style={{ fontSize: 17, fontWeight: 800 }}>{scaduti.length}</div><div style={{ fontSize: 11, color: C.txm, fontWeight: 600 }}>Scaduti</div></div>
        </Crd>
        <Crd style={{ display: 'flex', alignItems: 'center', gap: 11, padding: 12 }}>
          <div style={{ background: C.purL, borderRadius: 10, padding: 9 }}><Ic n="clk" s={20} c={C.pur} /></div>
          <div><div style={{ fontSize: 17, fontWeight: 800 }}>{prossimi.length}</div><div style={{ fontSize: 11, color: C.txm, fontWeight: 600 }}>Prossimi 30gg</div></div>
        </Crd>
      </div>

      <div style={{ display: 'flex', gap: 6, marginBottom: 10, overflowX: 'auto', paddingBottom: 2 }}>
        {CATEGORIE_FILTRO.map((c) => (
          <button key={c.id} onClick={() => setFiltroCategoria(c.id)} style={{ flexShrink: 0, padding: '6px 12px', borderRadius: 20, border: `1.5px solid ${filtroCategoria === c.id ? C.pri : C.brd}`, background: filtroCategoria === c.id ? C.priL : C.sur, color: filtroCategoria === c.id ? C.pri : C.txm, fontWeight: 700, fontSize: 12, cursor: 'pointer', whiteSpace: 'nowrap' }}>{c.label}</button>
        ))}
      </div>

      <div style={{ display: 'flex', background: C.bg, borderRadius: 10, border: `1px solid ${C.brd}`, marginBottom: 14, overflow: 'hidden' }}>
        {[[false, `Da fare (${aperti.length})`], [true, `Fatti (${richiami.length - aperti.length})`]].map(([v, lbl]) => (
          <button key={String(v)} onClick={() => setMostraFatti(v)} style={{ flex: 1, padding: '10px 0', border: 'none', background: mostraFatti === v ? C.pri : 'transparent', color: mostraFatti === v ? '#fff' : C.txm, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>{lbl}</button>
        ))}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
        {filtrati.map((r) => {
          const paz = patients.find((p) => String(p.id) === String(r.pazienteId));
          const cat = RICHIAMO_CATEGORIE[r.categoria] || RICHIAMO_CATEGORIE.generico;
          const scaduto = r.stato === 'da_fare' && r.dataScadenza < t;
          const testoWa = tplSollecito.testo.replace(/\{nome\}/g, paz ? `${paz.nome} ${paz.cognome}` : '');
          return (
            <Crd key={r.id} style={{ borderLeft: `3px solid ${cat.colore}` }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div onClick={() => paz && onOpenPaz(paz, 'info')} style={{ fontWeight: 700, fontSize: 13, color: paz ? C.pri : C.txt, cursor: paz ? 'pointer' : 'default' }}>{paz ? `${paz.nome} ${paz.cognome} ›` : 'Paziente non trovato'}</div>
                  <div style={{ fontSize: 12, color: C.txm, marginTop: 2 }}>{r.motivo || cat.label}</div>
                  <div style={{ marginTop: 5, display: 'flex', gap: 4, flexWrap: 'wrap', alignItems: 'center' }}>
                    <Bdg ch={`${cat.icona} ${cat.label}`} co={cat.colore} />
                    <Bdg ch={scaduto ? `scaduto ${fmtD(r.dataScadenza)}` : fmtD(r.dataScadenza)} co={scaduto ? C.dan : C.txm} />
                    {r.origine === 'bot' && <Bdg ch="🤖 bot" co={C.acc} />}
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 5, flexShrink: 0 }}>
                  {r.stato === 'da_fare'
                    ? <button onClick={() => segnaFatto(r.id)} style={{ background: C.sucL, border: 'none', borderRadius: 7, padding: '5px 8px', cursor: 'pointer' }} title="Segna fatto"><Ic n="ok" s={13} c={C.suc} /></button>
                    : <button onClick={() => riapri(r.id)} style={{ background: C.priL, border: 'none', borderRadius: 7, padding: '5px 8px', cursor: 'pointer' }} title="Riapri"><Ic n="clk" s={13} c={C.pri} /></button>}
                  {paz?.telefono && <WaAction tel={paz.telefono} testo={testoWa} features={features} variant="icon" />}
                  <button onClick={() => elimina(r.id)} style={{ background: C.danL, border: 'none', borderRadius: 7, padding: '5px 8px', cursor: 'pointer' }} title="Elimina"><Ic n="del" s={13} c={C.dan} /></button>
                </div>
              </div>
            </Crd>
          );
        })}
        {filtrati.length === 0 && <div style={{ textAlign: 'center', color: C.txl, padding: 40 }}>{mostraFatti ? 'Nessun richiamo evaso' : 'Nessun richiamo da gestire 🎉'}</div>}
      </div>

      {modal && (
        <Modal title="📌 Nuovo richiamo" onClose={() => setModal(false)}>
          <Fld label="Paziente">
            <SelettorePaziente patients={patients} value={form.pazienteId} onChange={(id) => F({ pazienteId: id })} search={pazSearch} onSearchChange={setPazSearch} autoFocus />
          </Fld>
          <Fld label="Categoria">
            <Sel value={form.categoria} onChange={(e) => F({ categoria: e.target.value })}>
              {Object.entries(RICHIAMO_CATEGORIE).map(([id, c]) => <option key={id} value={id}>{c.icona} {c.label}</option>)}
            </Sel>
          </Fld>
          <Fld label="Motivo"><Inp value={form.motivo} onChange={(e) => F({ motivo: e.target.value })} placeholder={isDentistico ? 'es. Richiamare per controllo tartaro' : 'es. Richiamare per controllo periodico'} /></Fld>
          <Fld label="Data richiamo"><Inp type="date" value={form.dataScadenza} onChange={(e) => F({ dataScadenza: e.target.value })} /></Fld>
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <Btn ch="Annulla" v="sec" onClick={() => setModal(false)} full />
            <Btn ch="Crea richiamo" onClick={save} dis={!form.pazienteId || !form.dataScadenza} full />
          </div>
        </Modal>
      )}
    </div>
  );
}
