import React, { useState, useEffect } from 'react';
import { Btn, Crd, Fld, Inp, Sel, Modal, Toast, Bdg, Ic, StatCard, SelettorePaziente, WaAction, PageHeader, EmptyState } from './ui';
import { C, fmtD, today, uid, RICHIAMO_CATEGORIE, DEF_TPL_GENERICO } from '../lib/utils';
import { useFormPersistente } from '../lib/useFormPersistente';
import { generaRichiamiBot } from '../lib/richiamiBot';

const CATEGORIE_FILTRO = [
  { id: 'tutte', label: 'Tutte', icona: null },
  ...Object.entries(RICHIAMO_CATEGORIE).map(([id, c]) => ({ id, label: c.label, icona: c.icona })),
];

/* ── SEZIONE RICHIAMI ──
   Aggrega in un unico posto i richiami clinici (dopo un'igiene/impianto,
   se non c'è già un appuntamento vicino alla data), i preventivi fermi in
   attesa da troppo tempo e gli incassi sospesi — generati dal "bot"
   (generaRichiamiBot, vedi anche l'effetto automatico in App.jsx) oppure
   creati a mano qui. "Scansiona ora" forza un ricalcolo immediato, utile
   per le condizioni che dipendono solo dal passare dei giorni (standby). */
export default function Richiami({ patients, plans, payments, appointments, richiami, setRichiami, templates, features, onOpenPaz, si, autoOpenNew, onAutoOpenNewHandled, initialPatientRequest, onInitialPatientRequestHandled }) {
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
    if (autoOpenNew || initialPatientRequest?.patient) {
      const patient = initialPatientRequest?.patient;
      setForm({ pazienteId: patient?.id != null ? String(patient.id) : '', categoria: 'generico', motivo: '', dataScadenza: today() });
      setPazSearch('');
      setModal(true);
      if (autoOpenNew) onAutoOpenNewHandled?.();
      if (initialPatientRequest?.id) onInitialPatientRequestHandled?.(initialPatientRequest.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoOpenNew, initialPatientRequest?.id]);

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

      <PageHeader icon="bell" title="Richiami" actions={
        <>
          <Btn ch="Scansiona ora" ic="refresh" v="sec" onClick={scansiona} />
          <Btn ch="Richiamo" ic="plus" onClick={() => { setForm({ pazienteId: '', categoria: 'generico', motivo: '', dataScadenza: today() }); setPazSearch(''); setModal(true); }} />
        </>
      } />

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
        <StatCard icon="warn" color={C.dan} value={scaduti.length} label="Scaduti" />
        <StatCard icon="clk" color={C.pur} value={prossimi.length} label="Prossimi 30gg" />
      </div>

      <div className="pol-tabbar" style={{ marginBottom: 10, paddingBottom: 2 }}>
        {CATEGORIE_FILTRO.map((c) => (
          <button key={c.id} onClick={() => setFiltroCategoria(c.id)} className={`pol-tab${filtroCategoria === c.id ? ' is-active' : ''}`} style={{ display: 'flex', alignItems: 'center', gap: 5, background: filtroCategoria === c.id ? C.priL : C.sur, color: filtroCategoria === c.id ? C.pri : C.txm, border: `1.5px solid ${filtroCategoria === c.id ? C.pri : C.brd}` }}>
            {c.icona && <Ic n={c.icona} s={11} c={filtroCategoria === c.id ? C.pri : C.txm} />}{c.label}
          </button>
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
                  <div style={{ marginTop: 5, display: 'flex', gap: 5, flexWrap: 'wrap', alignItems: 'center' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Ic n={cat.icona} s={11} c={cat.colore} /><Bdg ch={cat.label} co={cat.colore} /></span>
                    <Bdg ch={scaduto ? `scaduto ${fmtD(r.dataScadenza)}` : fmtD(r.dataScadenza)} co={scaduto ? C.dan : C.txm} />
                    {r.origine === 'bot' && <Bdg ch="Bot" co={C.acc} />}
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
        {filtrati.length === 0 && <EmptyState icon="bell" title={mostraFatti ? 'Nessun richiamo evaso' : 'Nessun richiamo da gestire'} />}
      </div>

      {modal && (
        <Modal title="Nuovo richiamo" icon="bell" onClose={() => setModal(false)}>
          <Fld label="Paziente">
            <SelettorePaziente patients={patients} value={form.pazienteId} onChange={(id) => F({ pazienteId: id })} search={pazSearch} onSearchChange={setPazSearch} autoFocus />
          </Fld>
          <Fld label="Categoria">
            <Sel value={form.categoria} onChange={(e) => F({ categoria: e.target.value })}>
              {Object.entries(RICHIAMO_CATEGORIE).map(([id, c]) => <option key={id} value={id}>{c.label}</option>)}
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
