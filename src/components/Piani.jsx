import React, { useState, useEffect } from 'react';
import { Btn, Crd, Fld, Inp, Sel, Modal, Toast, Bdg, Ic, StatCard, SelettorePaziente, PageHeader, EmptyState } from './ui';
import { C, uid, fmt, today, SCADENZA_PRESET, addMesi } from '../lib/utils';
import { cercaPazienti } from '../lib/ricercaPazienti';
import { useIsMobile } from '../lib/useIsMobile';
import { useFormPersistente } from '../lib/useFormPersistente';
import { salvaPosizione, leggiPosizione } from '../lib/posizioneNavigazione';
import { isTreatmentPlanCompleted } from '../lib/domain/treatmentPlanService.js';
import Odontogramma from './Odontogramma.jsx';
import PdfView from './PdfView.jsx';
import PianoDrillDown from './PianoDrillDown.jsx';

/* POL-FIN-007: "sezione piani generica : deve essere un elenco pazienti
   (che abbiano un piano) con filtro ricerca paziente, questi pazienti
   devono essere quindi cliccabili e si apre l'elenco dei piani (solo nomi
   dei piani) che sia poi cliccabile e si aprono le prestazioni" — the flat,
   every-plan-expanded list this page used to render is now a two-step
   drill-down: a searchable list of patients who have at least one plan
   (this file), then PianoDrillDown.jsx (shared with SchedaPaz.jsx's own
   "Piani" tab) for that patient's plan names → prestazioni. The KPI stat
   cards and their "browse all matching plans" panel are unchanged — they
   still summarize/list across every patient at once, a different, still
   useful view than the new per-patient drill-down. */
export default function Piani({ patients, plans, setPlans, payments = [], setPayments, pricelist, templates, si, features, initPatId, onClearInitPat, onOpenPaz, autoOpenNew, onAutoOpenNewHandled }) {
  const isDentistico = !si?.vertical || si.vertical === 'dentistico';
  const isMobile = useIsMobile();
  const [modal, setModal] = useState(false);

  // Ricorda se il modale "nuovo piano" era aperto, così se l'app si
  // ricarica da zero (schermo spento, cambio app) lo ritroviamo aperto con
  // il contenuto già scritto (gestito separatamente da useFormPersistente).
  React.useEffect(() => { salvaPosizione({ pianiModaleNuovo: modal }); }, [modal]);
  React.useEffect(() => {
    if (leggiPosizione()?.pianiModaleNuovo) setModal(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [pazSearch, setPazSearch] = useState('');
  const ortoVuoto = { attivo: false, mascherineTotali: '', frequenzaSettimane: 2, dataConsegnaInizio: '', mascherineConsegnate: 0, storico: [] };
  const [form, setForm, clearFormDraft] = useFormPersistente('nuovo_piano_cura', { pazienteId: '', titolo: '', data: today(), voci: [], stato: 'attivo', sconto: 0, scontoTipo: 'pct', scadenzaPagamento: '', ortodonzia: null });
  const [nv, setNv] = useState({ prestazione: '', dente: '', prezzo: '' });
  const [selectedDenti, setSelectedDenti] = useState([]);
  const [pdfPlan, setPdfPlan] = useState(null);
  const [toast, setToast] = useState('');
  const [filtro, setFiltro] = useState(null); // null=tutti | 'attivo'|'accettato'|'rifiutato'|'concluso'|'inCorso'
  const [filtroModal, setFiltroModal] = useState(null);
  const [patSearch, setPatSearch] = useState('');
  const [selectedPatientId, setSelectedPatientId] = useState(null);

  useEffect(() => {
    if (initPatId) {
      setForm({ pazienteId: String(initPatId), titolo: '', data: today(), voci: [], stato: 'attivo', sconto: 0, scontoTipo: 'pct', scadenzaPagamento: '', ortodonzia: null });
      setNv({ prestazione: '', dente: '', prezzo: '' });
      setSelectedDenti([]);
      setModal(true);
      onClearInitPat && onClearInitPat();
    }
  }, [initPatId]);

  // Arrivo da un'azione rapida della Home ("+ Nuovo preventivo"): apre lo
  // stesso modale "Nuovo" del tasto qui sotto, senza paziente preselezionato
  // (lo sceglie l'utente nel form, come già previsto da SelettorePaziente).
  useEffect(() => {
    if (autoOpenNew) {
      setForm({ pazienteId: '', titolo: '', data: today(), voci: [], stato: 'attivo', sconto: 0, scontoTipo: 'pct', scadenzaPagamento: '', ortodonzia: null });
      setNv({ prestazione: '', dente: '', prezzo: '' });
      setSelectedDenti([]);
      setModal(true);
      onAutoOpenNewHandled && onAutoOpenNewHandled();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoOpenNew]);

  const kpi = {
    totali: plans.length,
    attivi: plans.filter((p) => (p.stato || 'attivo') === 'attivo').length,
    accettati: plans.filter((p) => p.stato === 'accettato').length,
    rifiutati: plans.filter((p) => p.stato === 'rifiutato').length,
    conclusi: plans.filter((p) => isTreatmentPlanCompleted(p)).length,
    inCorso: plans.filter((p) => { const d = p.voci.filter((v) => v.eseguita).length; return d > 0 && d < p.voci.length; }).length,
  };

  const pianiFiltrati = (stato) => {
    if (stato === 'inCorso') return plans.filter(p => { const d = p.voci.filter(v => v.eseguita).length; return d > 0 && d < p.voci.length; });
    if (stato === 'concluso') return plans.filter((p) => isTreatmentPlanCompleted(p));
    if (stato === 'totali') return plans;
    return plans.filter(p => (p.stato || 'attivo') === stato);
  };

  const calcTot = (voci, sconto, scontoTipo) => {
    const sub = voci.reduce((s, v) => s + Number(v.prezzo), 0);
    const sc = Number(sconto) || 0;
    const scontato = scontoTipo === 'pct' ? sub * (sc / 100) : Math.min(sc, sub);
    return { sub, scontato, finale: Math.max(0, sub - scontato) };
  };

  const addVoce = () => {
    if (!nv.prestazione) return;
    const prezzoUnit = Number(nv.prezzo) || 0;
    const denti = selectedDenti.length > 0 ? selectedDenti.slice().sort((a, b) => a - b) : [];
    if (denti.length > 1) {
      const nuove = denti.map((d) => ({ prestazione: nv.prestazione, dente: String(d), prezzo: prezzoUnit, eseguita: false, incassata: false }));
      setForm((f) => ({ ...f, voci: [...f.voci, ...nuove] }));
    } else {
      const denteStr = denti.length === 1 ? String(denti[0]) : (nv.dente || '');
      setForm((f) => ({ ...f, voci: [...f.voci, { prestazione: nv.prestazione, dente: denteStr, prezzo: prezzoUnit, eseguita: false, incassata: false }] }));
    }
    setNv({ prestazione: '', dente: '', prezzo: '' });
    setSelectedDenti([]);
  };

  const save = () => {
    if (!form.pazienteId || !form.titolo || !form.voci.length) return;
    setPlans((p) => [...p, { ...form, id: uid(), pazienteId: Number(form.pazienteId) }]);
    setModal(false);
    clearFormDraft();
    setToast('Piano salvato ✓');
  };

  const selPr = (nome) => { const item = pricelist.find((p) => p.nome === nome); setNv((v) => ({ ...v, prestazione: nome, prezzo: item ? item.prezzo : v.prezzo })); };

  if (pdfPlan) {
    const p = patients.find((x) => x.id === pdfPlan.pazienteId);
    return <PdfView pl={pdfPlan} paz={p} si={si} features={features} onClose={() => setPdfPlan(null)} />;
  }

  const patientsWithPlans = patients.filter((p) => plans.some((pl) => pl.pazienteId === p.id));
  const patientsFiltered = patSearch.trim() ? cercaPazienti(patientsWithPlans, patSearch) : patientsWithPlans;
  const selectedPatient = selectedPatientId != null ? patients.find((p) => p.id === selectedPatientId) : null;
  const selectedPatientPlans = selectedPatientId != null ? plans.filter((pl) => pl.pazienteId === selectedPatientId) : [];

  return (
    <div>
      {toast && <Toast msg={toast} onDone={() => setToast('')} />}
      <PageHeader icon="plan" title="Piani di cura" actions={
        <Btn ch="Nuovo" ic="plus" onClick={() => { setForm({ pazienteId: '', titolo: '', data: today(), voci: [], stato: 'attivo', sconto: 0, scontoTipo: 'pct', scadenzaPagamento: '', ortodonzia: null }); setNv({ prestazione: '', dente: '', prezzo: '' }); setSelectedDenti([]); setModal(true); }} />
      } />
      {/* POL-UI-005: each KPI now has a semantically distinct icon (was
          `Ic n="plan"` on all six, differentiated only by color) — Totali
          (all plans), Attivi (pulse = ongoing), Accettati (check),
          Rifiutati (cross), Conclusi (medal = completed), In corso
          (clock = partially executed). */}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : '1fr 1fr 1fr', gap: 8, marginBottom: 14 }}>
        {[
          ['Totali', kpi.totali, C.pri, 'totali', 'brief'],
          ['Attivi', kpi.attivi, C.war, 'attivo', 'pulse'],
          ['Accettati', kpi.accettati, C.acc, 'accettato', 'okc'],
          ['Rifiutati', kpi.rifiutati, C.dan, 'rifiutato', 'cross'],
          ['Conclusi', kpi.conclusi, C.suc, 'concluso', 'medal'],
          ['In corso', kpi.inCorso, C.pur, 'inCorso', 'clk'],
        ].map(([l, v, co, key, ic]) => (
          <StatCard key={l} icon={ic} value={v} label={l} color={co} active={filtro === key} onClick={() => setFiltroModal(key)} />
        ))}
      </div>

      {filtro && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, background: C.priL, borderRadius: 9, padding: '8px 12px' }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: C.pri }}>Filtro: {filtro === 'totali' ? 'Tutti' : filtro === 'inCorso' ? 'In corso' : filtro.charAt(0).toUpperCase() + filtro.slice(1)}</span>
          <button onClick={() => setFiltro(null)} style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'none', border: 'none', cursor: 'pointer', color: C.dan, fontWeight: 700, fontSize: 12 }}><Ic n="x" s={11} c={C.dan} />Rimuovi</button>
        </div>
      )}

      {filtroModal && (
        <Modal title={filtroModal === 'totali' ? 'Tutti i piani' : filtroModal === 'inCorso' ? 'In corso' : filtroModal.charAt(0).toUpperCase() + filtroModal.slice(1)} icon="plan" onClose={() => setFiltroModal(null)} wide>
          <div style={{ marginBottom: 12, display: 'flex', gap: 8 }}>
            <Btn ch="Mostra solo questi" onClick={() => { setFiltro(filtroModal); setFiltroModal(null); }} full />
            <Btn ch="Mostra tutti" v="sec" onClick={() => { setFiltro(null); setFiltroModal(null); }} full />
          </div>
          {pianiFiltrati(filtroModal).length === 0 && <EmptyState icon="plan" title="Nessun piano in questa categoria" />}
          {pianiFiltrati(filtroModal).map(pl => {
            const p = patients.find(x => x.id === pl.pazienteId);
            const { finale: tot } = calcTot(pl.voci, pl.sconto || 0, pl.scontoTipo || 'pct');
            const done = pl.voci.filter(v => v.eseguita).length;
            const pct = pl.voci.length ? Math.round(done / pl.voci.length * 100) : 0;
            const statoC = { attivo: C.war, accettato: C.acc, concluso: C.suc, rifiutato: C.dan }[pl.stato || 'attivo'] || C.war;
            return (
              <Crd key={pl.id} style={{ marginBottom: 9, borderLeft: `3px solid ${statoC}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{pl.titolo}</div>
                    <div style={{ fontSize: 12, color: C.txm }}>{p?.nome} {p?.cognome}</div>
                    <div style={{ fontSize: 11, color: C.txl, marginTop: 2 }}>{pl.data} · {done}/{pl.voci.length} eseguite · {pct}%</div>
                    <div style={{ background: C.bg, borderRadius: 4, height: 4, overflow: 'hidden', marginTop: 5 }}>
                      <div style={{ height: '100%', width: `${pct}%`, background: pct === 100 ? C.suc : C.pri, borderRadius: 4 }} />
                    </div>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{ fontWeight: 800, fontSize: 14, color: C.pri }}>{fmt(tot)}</div>
                    <Bdg ch={pl.stato || 'attivo'} co={statoC} />
                    <div style={{ marginTop: 6 }}>
                      <button onClick={() => { setFiltroModal(null); setPdfPlan(pl); }} style={{ background: C.priL, border: 'none', borderRadius: 7, padding: '5px 9px', cursor: 'pointer', color: C.pri, fontWeight: 700, fontSize: 11 }}>PDF</button>
                    </div>
                  </div>
                </div>
              </Crd>
            );
          })}
        </Modal>
      )}

      {!selectedPatient ? (
        <>
          <Fld label="Cerca paziente">
            <Inp value={patSearch} onChange={(e) => setPatSearch(e.target.value)} placeholder="Nome o cognome…" />
          </Fld>
          {patientsFiltered.length === 0 && <EmptyState icon="plan" title="Nessun paziente con un piano di cura" />}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
            {patientsFiltered.map((p) => {
              const patPlans = plans.filter((pl) => pl.pazienteId === p.id);
              const totale = patPlans.reduce((s, pl) => s + calcTot(pl.voci, pl.sconto || 0, pl.scontoTipo || 'pct').finale, 0);
              return (
                <button key={p.id} type="button" onClick={() => setSelectedPatientId(p.id)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, textAlign: 'left', background: C.sur, border: `1px solid ${C.brd}`, borderRadius: 10, padding: '11px 14px', cursor: 'pointer' }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: 14 }}>{p.nome} {p.cognome}</div>
                    <div style={{ fontSize: 11, color: C.txm }}>{patPlans.length} {patPlans.length === 1 ? 'piano' : 'piani'}</div>
                  </div>
                  <div style={{ fontWeight: 800, color: C.pri, fontSize: 13, flexShrink: 0 }}>{fmt(totale)}</div>
                </button>
              );
            })}
          </div>
        </>
      ) : (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
            <button type="button" onClick={() => setSelectedPatientId(null)} style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'none', border: 'none', cursor: 'pointer', color: C.pri, fontWeight: 700, fontSize: 12, padding: 0 }}>← Tutti i pazienti</button>
            {onOpenPaz && <button type="button" onClick={() => onOpenPaz(selectedPatient, 'piani')} style={{ background: C.priL, border: 'none', borderRadius: 7, padding: '5px 10px', cursor: 'pointer', color: C.pri, fontWeight: 700, fontSize: 11 }}>Apri scheda paziente →</button>}
          </div>
          <div style={{ fontWeight: 800, fontSize: 16, marginBottom: 10 }}>{selectedPatient.nome} {selectedPatient.cognome}</div>
          <PianoDrillDown
            plans={selectedPatientPlans}
            patients={patients}
            setPlans={setPlans}
            payments={payments}
            setPayments={setPayments}
            pricelist={pricelist}
            si={si}
            features={features}
          />
        </div>
      )}

      {modal && (
        <Modal title="Nuovo piano di cura" icon="plan" onClose={() => setModal(false)} wide>
          <Fld label="Paziente">
            <SelettorePaziente
              patients={patients}
              value={form.pazienteId}
              onChange={(id) => setForm(f => ({ ...f, pazienteId: id }))}
              search={pazSearch}
              onSearchChange={setPazSearch}
            />
          </Fld>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <Fld label="Titolo"><Inp value={form.titolo} onChange={(e) => setForm((f) => ({ ...f, titolo: e.target.value }))} placeholder={isDentistico ? 'es. Piano conservativa' : 'es. Piano di trattamento'} /></Fld>
            <Fld label="Data"><Inp type="date" value={form.data} onChange={(e) => setForm((f) => ({ ...f, data: e.target.value }))} /></Fld>
          </div>
          <Fld label="Stato preventivo">
            <div style={{ display: 'flex', gap: 6 }}>
              {[['attivo', 'clk', 'In attesa', C.war], ['accettato', 'ok', 'Accettato', C.acc], ['rifiutato', 'x', 'Non accettato', C.dan]].map(([val, ic, lbl, co]) => {
                const sel = form.stato === val;
                return (
                  <button key={val} onClick={() => setForm((f) => ({ ...f, stato: val }))} style={{ flex: 1, padding: '9px 4px', borderRadius: 9, border: `1.5px solid ${sel ? co : C.brd}`, background: sel ? co + '18' : C.sur, color: sel ? co : C.txm, fontWeight: sel ? 800 : 600, fontSize: 11.5, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}><Ic n={ic} s={11} c={sel ? co : C.txm} />{lbl}</button>
                );
              })}
            </div>
          </Fld>
          <Fld label="Scadenza pagamento (opzionale)">
            <div style={{ display: 'flex', gap: 6, marginBottom: 7 }}>
              {SCADENZA_PRESET.map((p) => {
                const sel = form._presetScadenza === p.mesi;
                return (
                  <button key={p.mesi} onClick={() => setForm((f) => ({ ...f, scadenzaPagamento: addMesi(f.data || today(), p.mesi), _presetScadenza: p.mesi }))} style={{ flex: 1, padding: '7px 4px', borderRadius: 8, border: `1.5px solid ${sel ? C.pri : C.brd}`, background: sel ? C.priL : C.sur, color: sel ? C.pri : C.txm, fontWeight: sel ? 800 : 600, fontSize: 11, cursor: 'pointer' }}>{p.label}</button>
                );
              })}
              {form.scadenzaPagamento && <button onClick={() => setForm((f) => ({ ...f, scadenzaPagamento: '', _presetScadenza: null }))} aria-label="Rimuovi scadenza" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '7px 10px', borderRadius: 8, border: `1px solid ${C.brd}`, background: C.sur, color: C.txl, cursor: 'pointer' }}><Ic n="x" s={12} c={C.txl} /></button>}
            </div>
            <Inp type="date" value={form.scadenzaPagamento || ''} onChange={(e) => setForm((f) => ({ ...f, scadenzaPagamento: e.target.value, _presetScadenza: null }))} />
          </Fld>

          {isDentistico && (
          <div style={{ background: form.ortodonzia?.attivo ? C.purL : C.bg, borderRadius: 10, padding: 11, marginBottom: 11, border: form.ortodonzia?.attivo ? `1.5px solid ${C.pur}40` : 'none' }}>
            <button onClick={() => setForm((f) => ({ ...f, ortodonzia: f.ortodonzia?.attivo ? { ...ortoVuoto } : { ...ortoVuoto, attivo: true } }))} style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'none', border: 'none', cursor: 'pointer', padding: 0, width: '100%' }}>
              <div style={{ width: 20, height: 20, borderRadius: 6, border: `2px solid ${form.ortodonzia?.attivo ? C.pur : C.brd}`, background: form.ortodonzia?.attivo ? C.pur : C.sur, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                {form.ortodonzia?.attivo && <Ic n="ok" s={11} c="#fff" />}
              </div>
              <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 700, color: form.ortodonzia?.attivo ? C.pur : C.txt }}><Ic n="tooth" s={14} c={form.ortodonzia?.attivo ? C.pur : C.txm} />Piano ortodontico (mascherine invisibili)</span>
            </button>
            {form.ortodonzia?.attivo && (
              <div style={{ marginTop: 12 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <Fld label="N° totale mascherine">
                    <Inp type="number" min="1" value={form.ortodonzia.mascherineTotali} onChange={(e) => setForm((f) => ({ ...f, ortodonzia: { ...f.ortodonzia, mascherineTotali: e.target.value } }))} placeholder="es. 20" />
                  </Fld>
                  <Fld label="Cambio ogni">
                    <Sel value={form.ortodonzia.frequenzaSettimane} onChange={(e) => setForm((f) => ({ ...f, ortodonzia: { ...f.ortodonzia, frequenzaSettimane: Number(e.target.value) } }))}>
                      <option value={1}>1 settimana</option><option value={2}>2 settimane</option>
                    </Sel>
                  </Fld>
                </div>
                {form.ortodonzia.mascherineTotali > 0 && (
                  <div style={{ background: '#fff', borderRadius: 8, padding: 10, marginTop: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 700, color: C.txm }}><Ic n="clk" s={12} c={C.txm} />Durata stimata del trattamento</span>
                    <span style={{ fontSize: 14, fontWeight: 900, color: C.pur }}>
                      {(() => { const settimane = Number(form.ortodonzia.mascherineTotali) * form.ortodonzia.frequenzaSettimane; const mesi = Math.round((settimane / 4.345) * 10) / 10; return `~${settimane} sett. (${mesi} mesi)`; })()}
                    </span>
                  </div>
                )}
                <div style={{ fontSize: 10, color: C.txl, marginTop: 7, lineHeight: 1.5 }}>
                  La consegna della prima mascherina e il conteggio delle successive si gestiscono dalla scheda del paziente, dopo aver salvato il piano.
                </div>
              </div>
            )}
          </div>
          )}

          <div style={{ background: C.bg, borderRadius: 10, padding: 11, marginBottom: 11 }}>
            <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 9 }}>Aggiungi prestazione</div>
            <Fld label="Prestazione (digita o scegli dal listino)">
              <div style={{ display: 'flex', gap: 8, marginBottom: 7 }}>
                <Inp
                  value={nv.prestazione}
                  onChange={(e) => setNv((v) => ({ ...v, prestazione: e.target.value }))}
                  placeholder="Digita nome prestazione…"
                  style={{ flex: 1 }}
                />
              </div>
              <Sel value={nv.prestazione} onChange={(e) => selPr(e.target.value)}>
                <option value="">Scegli dal listino…</option>
                {pricelist.map((p) => <option key={p.id} value={p.nome}>{p.nome} — {fmt(p.prezzo)}</option>)}
              </Sel>
            </Fld>
            {isDentistico && (
              <>
                <Odontogramma selected={selectedDenti} onChange={setSelectedDenti} onDenteChange={(v) => setNv((n) => ({ ...n, dente: v }))} />
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <Fld label={`Dente${nv.dente ? ' ✓' : ''}`}><Inp value={nv.dente} onChange={(e) => { setNv((v) => ({ ...v, dente: e.target.value })); if (!e.target.value) setSelectedDenti([]); }} placeholder="es. 16, 26 (opzionale)" /></Fld>
                  <Fld label="Prezzo €"><Inp type="number" value={nv.prezzo} onChange={(e) => setNv((v) => ({ ...v, prezzo: e.target.value }))} /></Fld>
                </div>
              </>
            )}
            {!isDentistico && (
              <Fld label="Prezzo €"><Inp type="number" value={nv.prezzo} onChange={(e) => setNv((v) => ({ ...v, prezzo: e.target.value }))} /></Fld>
            )}
            <Btn ch="+ Aggiungi" onClick={addVoce} full />
          </div>

          {form.voci.length > 0 && (
            <div style={{ marginBottom: 11 }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: C.txm, textTransform: 'uppercase', marginBottom: 7 }}>Prestazioni aggiunte</div>
              {form.voci.map((v, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', padding: '7px 0', borderBottom: `1px solid ${C.brd}`, gap: 8 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{v.prestazione}</div>
                    {v.dente && <div style={{ fontSize: 10, color: C.txl }}>Dente {v.dente}</div>}
                  </div>
                  <span style={{ fontWeight: 700, color: C.pri, fontSize: 12, flexShrink: 0 }}>{fmt(v.prezzo)}</span>
                  <button onClick={() => setForm((f) => ({ ...f, voci: f.voci.filter((_, j) => j !== i) }))} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 3 }}><Ic n="x" s={13} c={C.dan} /></button>
                </div>
              ))}
              <div style={{ background: C.priL, borderRadius: 10, padding: 11, marginTop: 10 }}>
                <div style={{ fontSize: 11, fontWeight: 800, color: C.pri, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Sconto</div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <div style={{ display: 'flex', background: C.sur, borderRadius: 8, border: `1.5px solid ${C.brd}`, overflow: 'hidden', flexShrink: 0 }}>
                    <button onClick={() => setForm((f) => ({ ...f, scontoTipo: 'pct' }))} style={{ padding: '8px 12px', border: 'none', background: form.scontoTipo === 'pct' ? C.pri : C.sur, color: form.scontoTipo === 'pct' ? '#fff' : C.txm, fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>%</button>
                    <button onClick={() => setForm((f) => ({ ...f, scontoTipo: 'eur' }))} style={{ padding: '8px 12px', border: 'none', background: form.scontoTipo === 'eur' ? C.pri : C.sur, color: form.scontoTipo === 'eur' ? '#fff' : C.txm, fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>€</button>
                  </div>
                  <Inp type="number" inputMode="decimal" min="0" max={form.scontoTipo === 'pct' ? 100 : undefined} value={form.sconto || ''} placeholder={form.scontoTipo === 'pct' ? 'es. 10' : 'es. 50'} onChange={(e) => setForm((f) => ({ ...f, sconto: e.target.value }))} style={{ flex: 1 }} />
                  {Number(form.sconto) > 0 && <button onClick={() => setForm((f) => ({ ...f, sconto: 0 }))} aria-label="Rimuovi sconto" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', background: C.danL, border: 'none', borderRadius: 7, padding: '8px 10px', color: C.dan, cursor: 'pointer', flexShrink: 0 }}><Ic n="x" s={12} c={C.dan} /></button>}
                </div>
              </div>
              {(() => {
                const { sub, scontato, finale } = calcTot(form.voci, form.sconto || 0, form.scontoTipo || 'pct');
                return (
                  <div style={{ marginTop: 10, background: C.priD, borderRadius: 10, padding: '10px 14px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ color: 'rgba(255,255,255,0.7)', fontSize: 12 }}>Subtotale</span>
                      <span style={{ color: '#fff', fontWeight: 700, fontSize: 13 }}>{fmt(sub)}</span>
                    </div>
                    {scontato > 0 && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
                        <span style={{ color: '#86efac', fontSize: 12 }}>Sconto {form.scontoTipo === 'pct' ? `${form.sconto}%` : `€ ${Number(form.sconto).toFixed(2)}`}</span>
                        <span style={{ color: '#86efac', fontWeight: 700, fontSize: 13 }}>−{fmt(scontato)}</span>
                      </div>
                    )}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 6, paddingTop: 6, borderTop: '1px solid rgba(255,255,255,0.2)' }}>
                      <span style={{ color: '#fff', fontWeight: 800, fontSize: 14 }}>Totale</span>
                      <span style={{ color: '#fff', fontWeight: 900, fontSize: 18 }}>{fmt(finale)}</span>
                    </div>
                  </div>
                );
              })()}
            </div>
          )}
          <div style={{ display: 'flex', gap: 8 }}>
            <Btn ch="Annulla" v="sec" onClick={() => setModal(false)} full />
            <Btn ch="Salva piano" onClick={save} dis={!form.pazienteId || !form.titolo || !form.voci.length} full />
          </div>
        </Modal>
      )}
    </div>
  );
}
