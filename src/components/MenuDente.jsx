// PO 2026-11-10 — menu del tocco prolungato sul dente e funzione condivisa «segna eseguito»
// (usata anche dalla scheda appuntamento dell'Agenda), con messaggio in basso e «Annulla».
import React, { useEffect, useRef, useState } from 'react';
import { appuntamentoDelGiorno, impostaDenteAssente, messaggioEseguite, ripristinaPiani, segnaEseguite, vociDaFareDente } from '../lib/domain/denteRapido.js';
import './MenuDente.css';

const DURATA_TOAST = 6000;

// Un solo punto per segnare eseguito: aggiorna i piani (setPlans = persistenza dell'app),
// lega l'esecuzione alla seduta di oggi e prepara l'annullamento.
export function useEsecuzioneRapida({ patientId, patient, appointments = [], setPlans, setPatients, onPatientChange, data, appuntamento = null }) {
  const [toast, setToast] = useState(null);
  const seduta = appuntamento || appuntamentoDelGiorno(appointments, patientId, data);
  const segna = (plans, targets, dente) => {
    if (!setPlans || !targets.length) return 0;
    const r = segnaEseguite(plans, targets, { data, operatoreId: seduta?.operatoreId ?? null, appuntamentoId: seduta?.id ?? null });
    if (!r.n) return 0;
    const nuovi = new Map(r.plans.filter(p => r.prima.some(q => String(q.id) === String(p.id))).map(p => [String(p.id), p]));
    setPlans(cur => cur.map(p => nuovi.get(String(p.id)) || p));
    setToast({ id: Date.now(), testo: messaggioEseguite(dente, r.n), annulla: { tipo: 'piani', prima: r.prima } });
    return r.n;
  };
  const assente = (dente, valore) => {
    if (!setPatients || !patient) return;
    const prima = patient, dopo = impostaDenteAssente(patient, dente, valore, data);
    setPatients(cur => cur.map(p => String(p.id) === String(patient.id) ? dopo : p));
    onPatientChange?.(dopo);
    setToast({ id: Date.now(), testo: `Dente ${dente} ${valore ? 'segnato assente' : 'di nuovo presente'}`, annulla: { tipo: 'paziente', prima } });
  };
  const annulla = () => {
    const a = toast?.annulla;
    if (!a) return;
    if (a.tipo === 'piani') setPlans?.(cur => ripristinaPiani(cur, a.prima));
    if (a.tipo === 'paziente') { setPatients?.(cur => cur.map(p => String(p.id) === String(a.prima.id) ? a.prima : p)); onPatientChange?.(a.prima); }
    setToast(null);
  };
  return { segna, assente, annulla, toast, chiudiToast: () => setToast(null), puoSalvare: !!setPlans, puoAssente: !!(setPatients && patient) };
}

export function ToastAnnulla({ toast, onAnnulla, onChiudi }) {
  useEffect(() => {
    if (!toast) return undefined;
    const t = setTimeout(onChiudi, DURATA_TOAST);
    return () => clearTimeout(t);
  }, [toast?.id]);
  if (!toast) return null;
  return <div className="dente-toast" role="status" aria-live="polite"><span>{toast.testo}</span>{toast.annulla && <button type="button" onClick={onAnnulla}>Annulla</button>}</div>;
}

export default function MenuDente({ dente, punto, plans, patientId, assente, rapido, onAggiungi, onChiudi }) {
  const ref = useRef(null);
  const voci = vociDaFareDente(plans, patientId, dente);
  useEffect(() => {
    const fuori = e => { if (ref.current && !ref.current.contains(e.target)) onChiudi(); };
    const esc = e => { if (e.key === 'Escape') onChiudi(); };
    document.addEventListener('pointerdown', fuori, true);
    document.addEventListener('keydown', esc);
    ref.current?.querySelector('button:not(:disabled)')?.focus({ preventScroll: true });
    return () => { document.removeEventListener('pointerdown', fuori, true); document.removeEventListener('keydown', esc); };
  }, []);
  // Vicino al dente: sotto se c'è spazio, altrimenti sopra; sempre dentro lo schermo.
  const W = 268, vw = globalThis.innerWidth || 390, vh = globalThis.innerHeight || 800;
  const r = punto?.rect;
  const left = Math.max(8, Math.min(vw - W - 8, (r ? r.left + r.width / 2 : punto?.x || 0) - W / 2));
  const sotto = r ? r.bottom + 6 : (punto?.y || 0) + 10;
  const style = sotto + 260 > vh && r ? { left, bottom: Math.max(8, vh - r.top + 6), width: W } : { left, top: Math.min(sotto, vh - 120), width: W };
  const tutte = () => { rapido.segna(plans, voci.map(v => ({ planId: v.planId, index: v.index })), dente); onChiudi(); };
  return <div ref={ref} className="dente-menu" role="dialog" aria-label={`Dente ${dente}`} style={style}>
    <div className="dente-menu-titolo">Dente {dente}{assente && <small> · assente</small>}</div>
    <button type="button" className="dente-menu-primario" disabled={!voci.length || !rapido.puoSalvare} onClick={tutte}>Segna tutto eseguito</button>
    {voci.length ? <ul className="dente-menu-voci" aria-label="Prestazioni da fare">{voci.map(v => <li key={`${v.planId}:${v.index}`}>
      <label><input type="checkbox" disabled={!rapido.puoSalvare} onChange={() => rapido.segna(plans, [{ planId: v.planId, index: v.index }], dente)} /><span>{v.prestazione}<small>{v.piano}</small></span></label>
    </li>)}</ul> : <p className="dente-menu-vuoto">Nessuna prestazione da fare su questo dente.</p>}
    <div className="dente-menu-azioni">
      <button type="button" disabled={!onAggiungi} onClick={onAggiungi}>Aggiungi prestazione</button>
      <button type="button" disabled={!rapido.puoAssente} onClick={() => { rapido.assente(dente, !assente); onChiudi(); }}>{assente ? 'Segna come presente' : 'Segna come assente'}</button>
    </div>
  </div>;
}
