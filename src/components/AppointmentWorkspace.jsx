import './AppointmentWorkspace.css';
import React, { lazy, Suspense, useState, useEffect } from 'react';
import { Btn } from './ui';
import { fmt, VERTICALI_CON_RICETTA } from '../lib/utils';
import { aggregateSaldi, totalePagatoPaziente } from '../lib/domain/incassiMath.js';
import { fetchSaldiPiani } from '../lib/domain/incassiService.js';
import { lockPageScroll } from './ui/Modal.jsx';
import PianoDrillDown from './PianoDrillDown.jsx';
import IncassoModal from './IncassoModal.jsx';
const DocMedico = lazy(() => import('./DocMedico.jsx'));
const Piani = lazy(() => import('./Piani.jsx'));
const tabs = [['treatment','Prestazioni'],['payment','Incasso'],['prescription','Ricetta'],['quote','Preventivo'],['documents','Documenti']];

export default function AppointmentWorkspace({ patient, appointment, plans = [], payments = [], setPlans, setPayments, pricelist = [], templates = [], si, features, onClose }) {
  const [saldiPiani, setSaldiPiani] = useState({});
  const [medicalType, setMedicalType] = useState('certificato');
  useEffect(() => lockPageScroll(), []);
  useEffect(() => {
    let active = true;
    setSaldiPiani({});
    if (!patient?.id || String(appointment?.pazienteId) !== String(patient.id)) return;
    const ids = plans.filter(p => String(p.pazienteId) === String(patient.id)).map(p => p.id);
    if (ids.length) fetchSaldiPiani(ids).then(result => { if (active) setSaldiPiani(result); }).catch(() => {});
    return () => { active = false; };
  }, [patient?.id, appointment?.pazienteId, plans, payments]);
  const [tab, setTab] = useState('treatment');
  const [visited, setVisited] = useState({ treatment: true });
  const [quoteVersion, setQuoteVersion] = useState(0);
  const [medicalVersion, setMedicalVersion] = useState(0);
  const [paymentVersion, setPaymentVersion] = useState(0);
  const [notice, setNotice] = useState('');
  if (!patient?.id || String(appointment?.pazienteId) !== String(patient.id)) return null;
  const patPlans = plans.filter(p => p && String(p.pazienteId) === String(patient.id)).map(p => ({ ...p, voci: Array.isArray(p.voci) ? p.voci : [] }));
  const patPayments = payments.filter(p => String(p.pazienteId) === String(patient.id));
  const loaded = patPlans.every(p => saldiPiani[p.id]);
  const saldo = aggregateSaldi(patPlans.map(p => saldiPiani[p.id]).filter(Boolean));
  const canPrescribe = !si?.vertical || VERTICALI_CON_RICETTA.has(si.vertical);
  const select = id => { if (id === 'prescription') setMedicalType('ricetta'); if (id === 'documents') setMedicalType('certificato'); setTab(id); setVisited(v => ({ ...v, [id]: true })); };
  return <section className="appointment-workspace" aria-label="Scheda appuntamento">
    <div className="appointment-workspace-toolbar"><strong>Scheda appuntamento</strong><Btn ch="Chiudi" v="sec" sz="sm" onClick={onClose} /></div>
    {(patient.anamnesiAllarme || patient.note) && <div className="appointment-workspace-alert">{patient.anamnesiAllarme ? 'Allarme anamnesi: ' + (patient.anamnesiAllarmeDettagli || []).map(d => [d.titolo,d.nota].filter(Boolean).join(': ')).join('; ') : patient.note}</div>}
    <nav className="appointment-workspace-tabs" aria-label="Operazioni appuntamento">{tabs.map(([id,label]) => <button key={id} type="button" aria-pressed={tab === id} disabled={id === 'prescription' && !canPrescribe} onClick={() => select(id)}>{label}</button>)}</nav>
    <p className="appointment-workspace-hint">Salva ogni operazione nel suo modulo. Puoi cambiare sezione senza perdere i campi compilati.</p>
    {notice && <p role="status">{notice}</p>}
    <Suspense fallback={<p role="status">Caricamento modulo…</p>}>
      <div hidden={tab !== 'treatment'}>
        {visited.treatment && <>{patPlans.length > 0 && <PianoDrillDown plans={patPlans} patients={[patient]} setPlans={setPlans} payments={patPayments} setPayments={setPayments} pricelist={pricelist} si={si} features={features} initialAddTreatment />}
        <Btn ch={patPlans.length ? 'Crea un altro piano / preventivo' : 'Crea piano e inserisci prestazioni'} v="sec" onClick={() => select('quote')} /></>}
      </div>
      <div hidden={tab !== 'payment'}>{visited.payment && <IncassoModal key={paymentVersion} embedded prefill={{ pazienteId: String(patient.id) }} patients={[patient]} plans={patPlans} setPayments={setPayments} onClose={() => { setPaymentVersion(v => v + 1); select('treatment'); }} onSaved={() => setNotice('Incasso registrato.')} />}</div>
      <div hidden={tab !== 'quote'}>{visited.quote && <Piani key={quoteVersion} embedded patients={[patient]} plans={patPlans} setPlans={setPlans} payments={patPayments} setPayments={setPayments} pricelist={pricelist} templates={templates} si={si} features={features} initPatId={patient.id} onSaved={() => { setQuoteVersion(v => v + 1); select('treatment'); setNotice('Piano / preventivo salvato.'); }} onCancel={() => { setQuoteVersion(v => v + 1); select('treatment'); }} />}</div>
      <div hidden={!['prescription','documents'].includes(tab)}>{(visited.prescription || visited.documents) && <DocMedico key={medicalVersion} embedded paz={patient} si={si} initialType={medicalType} onClose={() => { setMedicalVersion(v => v + 1); select('treatment'); }} />}</div>
    </Suspense>
    <footer className="appointment-workspace-summary" aria-label="Situazione del paziente"><span>Piani paziente <strong>{loaded ? fmt(saldo.totale_piano) : '…'}</strong></span><span>Incassato paziente <strong>{fmt(totalePagatoPaziente(patPayments))}</strong></span><span>Saldo paziente <strong>{loaded ? fmt(saldo.saldo_piano) : '…'}</strong></span></footer>
  </section>;
}
