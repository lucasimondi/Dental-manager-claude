// PO 2026-11-10 — scheda della seduta aperta dall'Agenda: pannello laterale 480 px (tutto
// schermo su telefono). Stato a 4 passi, prestazioni della seduta con «Segna eseguito» (stessa
// funzione del tocco prolungato sul dente), nota clinica, azioni e barra fissa in fondo.
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Ic } from './ui';
import { fmt, fmtD, today } from '../lib/utils';
import { aggregateSaldi } from '../lib/domain/incassiMath.js';
import { fetchSaldiPiani } from '../lib/domain/incassiService.js';
import { patientDentalOverview } from '../lib/patientDentalOverview.js';
import { useEsecuzioneRapida, ToastAnnulla } from './MenuDente.jsx';
import './AppointmentSessionPanel.css';

export const PASSI_SEDUTA = [
  { stato: 'confermato', label: 'Prenotato' },
  { stato: 'arrivato', label: 'Arrivato' },
  { stato: 'in_poltrona', label: 'In poltrona' },
  { stato: 'concluso', label: 'Concluso' },
];
// Stati non previsti (es. «in attesa») contano come «Prenotato».
export const passoSeduta = stato => Math.max(0, PASSI_SEDUTA.findIndex(p => p.stato === stato));

// Prestazioni di questa seduta: quelle già eseguite in questo appuntamento e quelle ancora
// da fare nei piani del paziente (le si segna mentre si lavora).
export function prestazioniSeduta(plans, patientId, appointmentId) {
  const m = patientDentalOverview(plans, patientId);
  const fatte = m.done.filter(r => r.appuntamentoId != null && String(r.appuntamentoId) === String(appointmentId));
  return [...fatte.map(r => ({ ...r, fatta: true })), ...m.pending.map(r => ({ ...r, fatta: false }))]
    .map(r => ({ key: r.key, planId: r.planId, index: r.itemIndex, nome: r.name, sede: r.site, piano: r.planTitle, prezzo: r.price, fatta: r.fatta }));
}

export const allergiePaziente = patient => (patient?.anamnesiAllarme ? (patient.anamnesiAllarmeDettagli || []).map(d => [d.titolo, d.nota].filter(Boolean).join(': ')).filter(Boolean) : []);

export default function AppointmentSessionPanel({ patient, appointment, plans = [], setPlans, appointments = [], setAppointments, sede = '', busy = false, onStatoChange, onSposta, onPromemoria, onDisdici, onApriScheda, onChiudi, renderDettagli, altreOpzioni }) {
  const [saldo, setSaldo] = useState(null);
  const [dettagli, setDettagli] = useState(false);
  const dettagliRef = useRef(null);
  const apriDettagli = () => { setDettagli(true); if (dettagliRef.current) dettagliRef.current.open = true; setTimeout(() => dettagliRef.current?.scrollIntoView({ block: 'start', behavior: 'smooth' }), 60); };
  const [nota, setNota] = useState(appointment.note || '');
  const notaSalvata = useRef(appointment.note || '');
  const patPlans = useMemo(() => plans.filter(p => p && String(p.pazienteId) === String(patient.id)), [plans, patient.id]);
  const ids = patPlans.map(p => p.id).join(',');
  useEffect(() => {
    let attivo = true;
    const lista = patPlans.map(p => p.id);
    if (!lista.length) { setSaldo(0); return undefined; }
    fetchSaldiPiani(lista).then(map => { if (attivo) setSaldo(aggregateSaldi(lista.map(id => map?.[id]).filter(Boolean)).saldo_piano); }).catch(() => { if (attivo) setSaldo(null); });
    return () => { attivo = false; };
  }, [ids]);
  const rapido = useEsecuzioneRapida({ patientId: patient.id, patient, appointments, setPlans, data: today(), appuntamento: appointment });
  const voci = prestazioniSeduta(plans, patient.id, appointment.id);
  const passo = passoSeduta(appointment.stato);
  const allergie = allergiePaziente(patient);
  const salvaStato = stato => {
    if (!setAppointments || stato === appointment.stato) return;
    setAppointments(cur => cur.map(a => String(a.id) === String(appointment.id) ? { ...a, stato } : a));
    onStatoChange?.(stato);
  };
  const salvaNota = () => {
    if (!setAppointments || nota === notaSalvata.current) return;
    notaSalvata.current = nota;
    setAppointments(cur => cur.map(a => String(a.id) === String(appointment.id) ? { ...a, note: nota } : a));
  };
  const disdici = () => {
    if (!globalThis.confirm?.(`Disdire l'appuntamento di ${patient.nome} ${patient.cognome} del ${fmtD(appointment.data)} alle ${appointment.ora}?`)) return;
    onDisdici?.();
  };
  return <section className="seduta-panel" aria-label="Seduta">
    <header className="seduta-head">
      <div className="seduta-head-riga">
        <div className="seduta-quando"><strong>{fmtD(appointment.data)} · {appointment.ora}</strong>{sede && <span>{sede}</span>}</div>
        <button type="button" className="seduta-chiudi" aria-label="Chiudi appuntamento" disabled={busy} onClick={onChiudi}>✕</button>
      </div>
      <div className="seduta-paziente"><h2>{patient.nome} {patient.cognome}</h2><span className={`seduta-saldo${saldo > 0 ? ' is-dovuto' : ''}`}>Saldo {saldo == null ? '…' : fmt(saldo)}</span></div>
      <div className="seduta-tipo">{appointment.tipo}{appointment.durata ? ` · ${appointment.durata} min` : ''}</div>
      {allergie.length > 0 && <div className="seduta-allergie" role="note"><Ic n="warn" s={14} c="#B42318" />{allergie.join(' · ')}</div>}
    </header>
    <div className="seduta-corpo">
      <ol className="seduta-passi" aria-label="Stato della seduta">{PASSI_SEDUTA.map((p, i) => <li key={p.stato}>
        <button type="button" aria-current={i === passo ? 'step' : undefined} className={i < passo ? 'is-fatto' : i === passo ? 'is-attivo' : ''} disabled={busy || !setAppointments} onClick={() => salvaStato(p.stato)}><span aria-hidden="true">{i < passo ? '✓' : i + 1}</span>{p.label}</button>
      </li>)}</ol>
      <div className="seduta-card">
        <h3>Prestazioni di questa seduta</h3>
        {voci.length ? <ul className="seduta-voci">{voci.map(v => <li key={v.key}>
          <div><strong>{v.nome}</strong><small>{v.sede !== 'Generale' ? `Dente ${v.sede} · ` : ''}{v.piano}</small></div>
          <button type="button" className={v.fatta ? 'is-eseguito' : ''} disabled={v.fatta || busy || !setPlans} onClick={() => rapido.segna(plans, [{ planId: v.planId, index: v.index }], v.sede !== 'Generale' ? v.sede : null)}>{v.fatta ? '✓ Eseguito' : 'Segna eseguito'}</button>
        </li>)}</ul> : <p className="seduta-vuoto">Nessuna prestazione da fare nei piani del paziente. Aggiungile qui sotto.</p>}
      </div>
      <div className="seduta-card">
        <label className="seduta-nota"><span>Nota clinica della seduta</span><textarea rows={3} value={nota} disabled={busy || !setAppointments} onChange={e => setNota(e.target.value)} onBlur={salvaNota} placeholder="Cosa è stato fatto, cosa controllare la prossima volta" /></label>
      </div>
      <div className="seduta-azioni">
        <button type="button" disabled={busy} onClick={onSposta}><Ic n="move" s={15} c="currentColor" />Sposta</button>
        <button type="button" disabled={busy || !onPromemoria} onClick={onPromemoria}><Ic n="wa" s={15} c="currentColor" />Promemoria WA</button>
        <button type="button" className="seduta-disdici" disabled={busy || !onDisdici} onClick={disdici}><Ic n="x" s={15} c="currentColor" />Disdici</button>
      </div>
      {renderDettagli && <details ref={dettagliRef} className="seduta-dettagli" onToggle={e => { if (e.currentTarget.open) setDettagli(true); }}><summary>Aggiungi prestazioni, documenti e incasso</summary>{dettagli && renderDettagli()}</details>}
      {altreOpzioni}
    </div>
    <footer className="seduta-piede">
      <button type="button" className="seduta-primario" disabled={busy} onClick={() => { salvaStato('concluso'); apriDettagli(); }}>Concludi seduta e incassa</button>
      <button type="button" className="seduta-secondario" disabled={busy || !onApriScheda} onClick={onApriScheda}>Apri scheda completa</button>
    </footer>
    <ToastAnnulla toast={rapido.toast} onAnnulla={rapido.annulla} onChiudi={rapido.chiudiToast} />
  </section>;
}
