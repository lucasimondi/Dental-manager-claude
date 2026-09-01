import React, { useEffect, useMemo, useState } from 'react';
import { C } from '../lib/utils';
import { fetchSaldiApertiStudio } from '../lib/domain/incassiService.js';
import { Btn, Crd, EmptyState, ErrorState, Fld, Inp, LoadingState, Modal, PageHeader, Sel, SelettorePaziente } from './ui';
import UploadDocumento from './ui/UploadDocumentoSpesa.jsx';
import { addReceivableToLatestPlan, buildContextualPayment, planAssignmentForPatient, unassignedPaymentsForMultiPlanPatients } from '../lib/domain/incassiActions.js';
import { matchPaymentsToPatients, flagPossibleDuplicates, riepilogoEstrattoConto, buildPaymentsFromEstrattoConto } from '../lib/domain/estrattoContoService.js';

const euro = (value) => Number(value || 0).toLocaleString('it-IT', { style: 'currency', currency: 'EUR' });
const today = () => new Date().toISOString().slice(0, 10);

const readSort = (studioId) => {
  try { return localStorage.getItem(`pol_incassi_sort:${studioId}`) === 'giorni' ? 'giorni' : 'saldo'; }
  catch { return 'saldo'; }
};

const emptyForm = { pazienteId: '', origine: 'listino', prestazione: '', descrizione: '', importo: '', eseguita: true, pagamento: '' };

export default function Incassi({ studioId, patients = [], plans = [], payments = [], pricelist = [], setPlans, setPayments, onOpenPaz, embedded = false }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [sortBy, setSortBy] = useState(() => readSort(studioId));
  const [period, setPeriod] = useState('mese');
  const [reloadKey, setReloadKey] = useState(0);
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [patientSearch, setPatientSearch] = useState('');
  const [formError, setFormError] = useState('');
  const [assignDraft, setAssignDraft] = useState({});
  const [estrattoContoOpen, setEstrattoContoOpen] = useState(false);
  const [estrattoContoRighe, setEstrattoContoRighe] = useState(null);
  const [estrattoContoPeriodo, setEstrattoContoPeriodo] = useState(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    fetchSaldiApertiStudio(studioId)
      .then((data) => { if (active) setRows(data); })
      .catch((cause) => { if (active) setError(cause?.message || 'Impossibile caricare i saldi aperti.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [studioId, reloadKey]);

  const patientById = useMemo(() => new Map(patients.map((patient) => [String(patient.id), patient])), [patients]);
  const sortedRows = useMemo(() => [...rows].sort((a, b) => sortBy === 'giorni'
    ? Number(b.giorni_apertura || 0) - Number(a.giorni_apertura || 0) || Number(b.saldo_piano || 0) - Number(a.saldo_piano || 0)
    : Number(b.saldo_piano || 0) - Number(a.saldo_piano || 0) || Number(b.giorni_apertura || 0) - Number(a.giorni_apertura || 0)), [rows, sortBy]);

  const changeSort = (value) => {
    setSortBy(value);
    try { localStorage.setItem(`pol_incassi_sort:${studioId}`, value); } catch { /* optional preference */ }
  };

  const currentPrefix = today().slice(0, period === 'mese' ? 7 : 4);
  const collected = payments
    .filter((payment) => String(payment.stato || '').toLowerCase() === 'pagato' && String(payment.data || '').startsWith(currentPrefix))
    .reduce((sum, payment) => sum + Number(payment.importo || 0), 0);
  const outstanding = rows.reduce((sum, row) => sum + Number(row.saldo_piano || 0), 0);

  const openPatient = (row) => {
    const patient = patientById.get(String(row.paziente_id));
    if (patient) onOpenPaz?.(patient, 'paga');
  };

  // POL-FIN-003 §6 — payments left piano_id unset because the patient had
  // more than one plan (backfill declined to guess, and no write path
  // silently infers across plans either). Nothing here is allocated: it's
  // excluded from every saldo until assigned, one payment at a time.
  const daAssegnare = useMemo(() => unassignedPaymentsForMultiPlanPatients(payments, plans), [payments, plans]);
  const daAssegnareTotale = daAssegnare.reduce((sum, payment) => sum + Number(payment.importo || 0), 0);
  const assignPayment = (paymentId) => {
    const pianoId = assignDraft[paymentId];
    if (!pianoId) return;
    setPayments?.((current) => current.map((payment) => String(payment.id) === String(paymentId) ? { ...payment, pianoId: Number(pianoId) } : payment));
    setAssignDraft((current) => { const next = { ...current }; delete next[paymentId]; return next; });
  };

  const updateForm = (patch) => setForm((current) => ({ ...current, ...patch }));
  const choosePricelist = (name) => {
    const item = pricelist.find((entry) => entry.nome === name);
    updateForm({ prestazione: name, descrizione: name, importo: item ? String(item.prezzo) : '' });
  };
  const closeModal = () => { setModal(false); setForm(emptyForm); setPatientSearch(''); setFormError(''); };
  const saveReceivable = () => {
    const amount = Number(form.importo);
    const paid = form.pagamento === '' ? 0 : Number(form.pagamento);
    if (!form.pazienteId || !form.descrizione.trim() || !Number.isFinite(amount) || amount <= 0 || !Number.isFinite(paid) || paid < 0) {
      setFormError('Seleziona il paziente e inserisci descrizione e importi validi.'); return;
    }
    const { plans: updatedPlans, planId } = addReceivableToLatestPlan(plans, { pazienteId: form.pazienteId, descrizione: form.descrizione, importo: amount, eseguita: form.eseguita });
    setPlans?.(updatedPlans);
    if (paid > 0) setPayments?.((current) => [...current, buildContextualPayment({ pazienteId: form.pazienteId, importo: paid, descrizione: form.descrizione, pianoId: planId })]);
    closeModal();
  };

  // POL-FIN-004 — "Leggi estratto conto": upload a bank statement, the AI
  // extracts incoming-payment rows only (edge function, no server write),
  // then the operator confirms/corrects patient+piano per row before
  // anything is registered. Never auto-registers.
  const closeEstrattoConto = () => { setEstrattoContoOpen(false); setEstrattoContoRighe(null); setEstrattoContoPeriodo(null); };
  const handleEstrattoContoEstratto = (estratto) => {
    const matched = matchPaymentsToPatients(estratto.righe, patients);
    const flagged = flagPossibleDuplicates(matched, payments);
    setEstrattoContoRighe(flagged.map((riga) => ({ ...riga, selected: Boolean(riga.pazienteId) && !riga.possibileDuplicato, pianoId: '' })));
    setEstrattoContoPeriodo({ da: estratto.periodo_da, a: estratto.periodo_a });
  };
  const updateEstrattoContoRiga = (index, patch) => setEstrattoContoRighe((current) => current.map((riga, i) => (i === index ? { ...riga, ...patch } : riga)));
  const estrattoContoRigaPronta = (riga) => {
    if (!riga.pazienteId) return false;
    const assignment = planAssignmentForPatient(plans, riga.pazienteId);
    return assignment.mode !== 'choose' || Boolean(riga.pianoId);
  };
  const registraEstrattoConto = () => {
    const selezionate = (estrattoContoRighe || []).filter((riga) => riga.selected && estrattoContoRigaPronta(riga));
    if (!selezionate.length) return;
    const nuovi = buildPaymentsFromEstrattoConto(selezionate, plans);
    setPayments?.((current) => [...current, ...nuovi]);
    setReloadKey((key) => key + 1);
    closeEstrattoConto();
  };

  return (
    <section className={`incassi-page${embedded ? ' is-embedded' : ''}`}>
      {!embedded && <PageHeader icon="pay" title="Incassi" subtitle="Pagamenti ricevuti e saldi ancora aperti" />}
      <div className="incassi-toolbar">
        <div className="incassi-period" aria-label="Periodo incassato">
          {[['mese', 'Questo mese'], ['anno', "Quest'anno"]].map(([id, label]) => (
            <button key={id} type="button" className={`pol-tab${period === id ? ' is-active' : ''}`} onClick={() => setPeriod(id)}>{label}</button>
          ))}
        </div>
        <label className="incassi-sort">Ordina
          <select value={sortBy} onChange={(event) => changeSort(event.target.value)}>
            <option value="saldo">Importo più alto</option>
            <option value="giorni">Attesa più lunga</option>
          </select>
        </label>
        <Btn ch="Leggi estratto conto" ic="file" v="sec" onClick={() => setEstrattoContoOpen(true)} />
        <Btn ch="Aggiungi da incassare" ic="add" onClick={() => setModal(true)} />
      </div>

      <div className="incassi-kpis">
        <Crd className="incassi-kpi is-collected"><span>Incassato</span><strong>{euro(collected)}</strong><small>{period === 'mese' ? 'nel mese corrente' : "nell'anno corrente"}</small></Crd>
        <Crd className="incassi-kpi is-outstanding"><span>Da incassare</span><strong>{euro(outstanding)}</strong><small>saldo totale dei piani aperti</small></Crd>
        {daAssegnare.length > 0 && <Crd className="incassi-kpi is-unassigned"><span>Da assegnare</span><strong>{euro(daAssegnareTotale)}</strong><small>{daAssegnare.length} {daAssegnare.length === 1 ? 'pagamento' : 'pagamenti'} senza piano</small></Crd>}
      </div>

      {daAssegnare.length > 0 && (
        <Crd className="incassi-worklist incassi-worklist--unassigned">
          <div className="incassi-worklist__header"><div><strong>Pagamenti da assegnare</strong><span>{daAssegnare.length} {daAssegnare.length === 1 ? 'pagamento' : 'pagamenti'} · {euro(daAssegnareTotale)}</span></div></div>
          <p className="incassi-note">Il paziente ha più piani e questi pagamenti storici non sono collegati a nessuno: non entrano nel saldo di nessun piano finché non li assegni.</p>
          <div className="incassi-list incassi-list--unassigned">
            {daAssegnare.map((payment) => {
              const patient = patientById.get(String(payment.pazienteId));
              const patientName = patient ? `${patient.nome || ''} ${patient.cognome || ''}`.trim() : `Paziente #${payment.pazienteId}`;
              const patientPlans = plans.filter((plan) => String(plan.pazienteId) === String(payment.pazienteId));
              return (
                <div className="incassi-unassigned-row" key={payment.id}>
                  <span className="incassi-row__identity"><strong>{patientName}</strong><small>{payment.data}{payment.nota ? ` · ${payment.nota}` : ''}</small></span>
                  <span className="incassi-row__amount">{euro(payment.importo)}</span>
                  <Sel value={assignDraft[payment.id] || ''} onChange={(event) => setAssignDraft((current) => ({ ...current, [payment.id]: event.target.value }))}>
                    <option value="">Assegna a…</option>
                    {patientPlans.map((plan) => <option key={plan.id} value={plan.id}>{plan.titolo}</option>)}
                  </Sel>
                  <Btn ch="Assegna" sz="sm" onClick={() => assignPayment(payment.id)} dis={!assignDraft[payment.id]} />
                </div>
              );
            })}
          </div>
        </Crd>
      )}

      <Crd className="incassi-worklist">
        <div className="incassi-worklist__header"><div><strong>Saldi aperti</strong><span>{rows.length} {rows.length === 1 ? 'piano' : 'piani'}</span></div></div>
        {loading && <LoadingState title="Caricamento saldi…" />}
        {!loading && error && <ErrorState title="Saldi non disponibili" message={error} onRetry={() => setReloadKey((key) => key + 1)} />}
        {!loading && !error && sortedRows.length === 0 && <EmptyState icon="ok" title="Nessun saldo aperto" subtitle="Tutti i piani risultano saldati." />}
        {!loading && !error && sortedRows.length > 0 && (
          <div className="incassi-list">
            {sortedRows.map((row) => {
              const patient = patientById.get(String(row.paziente_id));
              const patientName = patient ? `${patient.nome || ''} ${patient.cognome || ''}`.trim() : `Paziente #${row.paziente_id}`;
              return (
                <button type="button" className="incassi-row" key={row.piano_id} onClick={() => openPatient(row)} disabled={!patient}>
                  <span className="incassi-row__identity"><strong>{patientName}</strong><small>{row.titolo || 'Piano'} · aperto da {Number(row.giorni_apertura || 0)} giorni</small></span>
                  <span className="incassi-row__amount">{euro(row.saldo_piano)}</span>
                </button>
              );
            })}
          </div>
        )}
        <p className="incassi-note">I pagamenti sono compensati solo tra i piani dello stesso paziente; gli acconti non vengono mai spostati tra pazienti diversi.</p>
      </Crd>
      {modal && (
        <Modal title="Aggiungi da incassare" icon="pay" onClose={closeModal} mobileVariant="sheet">
          <Fld label="Paziente"><SelettorePaziente patients={patients} value={form.pazienteId} onChange={(pazienteId) => updateForm({ pazienteId })} search={patientSearch} onSearchChange={setPatientSearch} autoFocus /></Fld>
          <div className="incassi-source-toggle">
            {[['listino', 'Dal listino'], ['libero', 'Voce libera']].map(([value, label]) => <button type="button" key={value} className={`pol-tab${form.origine === value ? ' is-active' : ''}`} onClick={() => updateForm({ origine: value, prestazione: '', descrizione: '', importo: '' })}>{label}</button>)}
          </div>
          {form.origine === 'listino' && <Fld label="Prestazione"><Sel value={form.prestazione} onChange={(event) => choosePricelist(event.target.value)}><option value="">Seleziona dal listino…</option>{pricelist.map((item) => <option key={item.id} value={item.nome}>{item.nome} — {euro(item.prezzo)}</option>)}</Sel></Fld>}
          <Fld label="Descrizione"><Inp value={form.descrizione} onChange={(event) => updateForm({ descrizione: event.target.value })} placeholder="Prestazione o voce da incassare" /></Fld>
          <div className="incassi-form-grid"><Fld label="Importo €"><Inp type="number" min="0" step="0.01" inputMode="decimal" value={form.importo} onChange={(event) => updateForm({ importo: event.target.value })} /></Fld><Fld label="Pagamento contestuale € (opzionale)"><Inp type="number" min="0" step="0.01" inputMode="decimal" value={form.pagamento} onChange={(event) => updateForm({ pagamento: event.target.value })} /></Fld></div>
          <label className="incassi-check"><input type="checkbox" checked={form.eseguita} onChange={(event) => updateForm({ eseguita: event.target.checked })} /> Già eseguita</label>
          <div className="incassi-live-balance"><span>Rimane da incassare</span><strong>{euro(Math.max(0, Number(form.importo || 0) - Number(form.pagamento || 0)))}</strong></div>
          {formError && <p className="incassi-form-error" role="alert">{formError}</p>}
          <div className="incassi-form-actions"><Btn ch="Annulla" v="sec" onClick={closeModal} full /><Btn ch="Salva" onClick={saveReceivable} full /></div>
        </Modal>
      )}
      {estrattoContoOpen && (
        <Modal title="Leggi estratto conto" icon="file" onClose={closeEstrattoConto} wide mobileVariant="sheet">
          {!estrattoContoRighe && (
            <UploadDocumento
              endpoint="estrai-pagamenti-estratto-conto"
              titolo="Carica estratto conto"
              sottotitolo="Foto o PDF — riconosco i pagamenti ricevuti, tu confermi a chi collegarli"
              onEstratto={handleEstrattoContoEstratto}
            />
          )}
          {estrattoContoRighe && (() => {
            const riepilogo = riepilogoEstrattoConto(estrattoContoRighe, payments, { periodoDa: estrattoContoPeriodo?.da, periodoA: estrattoContoPeriodo?.a });
            const selezionate = estrattoContoRighe.filter((riga) => riga.selected && estrattoContoRigaPronta(riga));
            return (
              <>
                <div className="incassi-estratto-summary">
                  <div><span>Periodo</span><strong>{riepilogo.periodoDa || '?'} → {riepilogo.periodoA || '?'}</strong></div>
                  <div><span>Totale estratto conto</span><strong>{euro(riepilogo.totaleEstrattoConto)}</strong></div>
                  {riepilogo.totaleRegistratoPeriodo !== null && <div><span>Già registrato in app (stesso periodo)</span><strong>{euro(riepilogo.totaleRegistratoPeriodo)}</strong></div>}
                </div>
                {riepilogo.possibiliDuplicati > 0 && <p className="incassi-form-error" role="alert">{riepilogo.possibiliDuplicati} {riepilogo.possibiliDuplicati === 1 ? 'riga sembra' : 'righe sembrano'} già registrate (stesso importo, data vicina) — deselezionate di default, verifica prima di includerle.</p>}
                <div className="incassi-list incassi-list--estratto-conto">
                  {estrattoContoRighe.map((riga, index) => {
                    const assignment = riga.pazienteId ? planAssignmentForPatient(plans, riga.pazienteId) : { mode: 'none' };
                    const pronta = estrattoContoRigaPronta(riga);
                    return (
                      <div className="incassi-estratto-row" key={index}>
                        <input type="checkbox" checked={riga.selected && pronta} disabled={!pronta} onChange={(event) => updateEstrattoContoRiga(index, { selected: event.target.checked })} />
                        <span className="incassi-row__identity"><strong>{euro(riga.importo)}</strong><small>{riga.data} · {riga.descrizione}</small>{riga.possibileDuplicato && <small className="incassi-estratto-row__warning">Possibile duplicato</small>}</span>
                        <Sel value={riga.pazienteId || ''} onChange={(event) => updateEstrattoContoRiga(index, { pazienteId: event.target.value ? Number(event.target.value) : null, pianoId: '' })}>
                          <option value="">Nessun paziente…</option>
                          {patients.map((patient) => <option key={patient.id} value={patient.id}>{patient.nome} {patient.cognome}</option>)}
                        </Sel>
                        {assignment.mode === 'choose' && (
                          <Sel value={riga.pianoId || ''} onChange={(event) => updateEstrattoContoRiga(index, { pianoId: event.target.value })}>
                            <option value="">Seleziona piano…</option>
                            {assignment.options.map((plan) => <option key={plan.id} value={plan.id}>{plan.titolo}</option>)}
                          </Sel>
                        )}
                      </div>
                    );
                  })}
                </div>
                <div className="incassi-form-actions">
                  <Btn ch="Annulla" v="sec" onClick={closeEstrattoConto} full />
                  <Btn ch={`Registra selezionati (${selezionate.length})`} onClick={registraEstrattoConto} dis={!selezionate.length} full />
                </div>
              </>
            );
          })()}
        </Modal>
      )}
    </section>
  );
}
