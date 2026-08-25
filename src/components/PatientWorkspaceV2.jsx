import React, { useMemo, useState } from 'react';
import { Ic } from './ui';
import { fmt, fmtD } from '../lib/utils';
import './PatientWorkspaceV2.css';

const yearsOld = (date) => {
  if (!date) return null;
  const born = new Date(`${date}T12:00:00`);
  if (Number.isNaN(born.getTime())) return null;
  const now = new Date();
  let years = now.getFullYear() - born.getFullYear();
  if (now < new Date(now.getFullYear(), born.getMonth(), born.getDate())) years -= 1;
  return years;
};

const samePatient = (row, id) => String(row?.pazienteId ?? row?.paziente_id ?? '') === String(id);
const safeItems = (plan) => Array.isArray(plan?.voci) ? plan.voci : [];

export function buildPatientWorkspaceV2Model({ patient, plans = [], payments = [], appointments = [] }) {
  const patientPlans = (Array.isArray(plans) ? plans : []).filter((row) => samePatient(row, patient?.id));
  const items = patientPlans.flatMap((plan) => safeItems(plan).map((item, index) => ({ ...item, planId: plan.id, key: `${plan.id}-${index}` })));
  const completed = items.filter((item) => item.eseguita === true);
  const pending = items.filter((item) => item.eseguita !== true);
  const total = items.reduce((sum, item) => sum + (Number(item.prezzo) || 0), 0);
  const paidRows = (Array.isArray(payments) ? payments : []).filter((row) => samePatient(row, patient?.id));
  const paid = paidRows.reduce((sum, row) => sum + (Number(row.importo) || 0), 0);
  const visits = (Array.isArray(appointments) ? appointments : []).filter((row) => samePatient(row, patient?.id) && row.stato !== 'annullato');
  const sortedVisits = [...visits].sort((a, b) => `${b.data || ''}${b.ora || ''}`.localeCompare(`${a.data || ''}${a.ora || ''}`));
  const today = new Date().toISOString().slice(0, 10);
  const lastVisit = sortedVisits.find((row) => (row.data || '') <= today) || null;
  const nextVisit = [...visits].filter((row) => (row.data || '') >= today).sort((a, b) => `${a.data || ''}${a.ora || ''}`.localeCompare(`${b.data || ''}${b.ora || ''}`))[0] || null;
  const activePlans = patientPlans.filter((plan) => !['concluso', 'rifiutato'].includes(plan.stato));
  const notes = Array.isArray(patient?.annotazioni) ? patient.annotazioni.filter((note) => note?.testo) : [];
  const risks = [patient?.note, ...(Array.isArray(patient?.allergie) ? patient.allergie : [])].filter(Boolean);
  return {
    patientPlans, items, completed, pending, paidRows, total, paid,
    outstanding: Math.max(0, total - paid), lastVisit, nextVisit, activePlans, notes, risks,
    progress: items.length ? Math.round((completed.length / items.length) * 100) : null,
  };
}

function ActionButton({ icon, children, onClick, href }) {
  const props = href ? { as: 'a', href } : { as: 'button', onClick };
  const Tag = props.as;
  return <Tag className="pw2-action" href={props.href} onClick={props.onClick}><Ic n={icon} s={15} c="currentColor" />{children}</Tag>;
}

function DetailDrawer({ title, onClose, children }) {
  return <div className="pw2-drawer-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
    <aside className="pw2-drawer" role="dialog" aria-modal="true" aria-label={title}>
      <div className="pw2-drawer-head"><div><small>Dettaglio paziente</small><h2>{title}</h2></div><button onClick={onClose} aria-label="Chiudi"><Ic n="x" s={16} c="currentColor" /></button></div>
      <div className="pw2-drawer-body">{children}</div>
    </aside>
  </div>;
}

export default function PatientWorkspaceV2({ patient, plans, payments, appointments, onClose = () => {}, onEdit = () => {} }) {
  const model = useMemo(() => buildPatientWorkspaceV2Model({ patient, plans, payments, appointments }), [patient, plans, payments, appointments]);
  const [drawer, setDrawer] = useState(null);
  const [tab, setTab] = useState('info');
  const age = yearsOld(patient?.dataNascita);
  const kpis = [
    { id: 'plans', label: 'Piani', value: model.patientPlans.length, icon: 'plan' },
    { id: 'done', label: 'Eseguito', value: fmt(model.completed.reduce((sum, item) => sum + (Number(item.prezzo) || 0), 0)), icon: 'okc' },
    { id: 'paid', label: 'Pagato', value: fmt(model.paid), icon: 'eur' },
    { id: 'outstanding', label: 'Da pagare', value: fmt(model.outstanding), icon: 'clk' },
  ];
  const clinicalCards = [
    model.activePlans.length > 0 && { icon: 'plan', tone: 'indigo', label: 'Piano attivo', value: model.activePlans[0].titolo || 'Piano di cura', meta: model.progress == null ? null : `${model.progress}% completato` },
    model.pending.length > 0 && { icon: 'clk', tone: 'amber', label: 'Da programmare', value: `${model.pending.length} prestazioni`, meta: model.pending.slice(0, 2).map((item) => item.prestazione).filter(Boolean).join(' · ') },
    model.completed.length > 0 && { icon: 'okc', tone: 'teal', label: 'Ultima prestazione', value: model.completed.at(-1)?.prestazione || 'Prestazione completata', meta: fmtD(model.completed.at(-1)?.dataEsec) },
    model.notes.length > 0 && { icon: 'clip', tone: 'violet', label: 'Note cliniche', value: `${model.notes.length} elementi`, meta: model.notes[0]?.testo },
    model.nextVisit && { icon: 'cal', tone: 'blue', label: 'Prossimo appuntamento', value: fmtD(model.nextVisit.data), meta: model.nextVisit.ora || model.nextVisit.tipo },
  ].filter(Boolean);
  const tabs = [['info', 'Info'], ['piani', 'Piani'], ['impl', 'Impianti'], ['foto', 'Foto'], ['doc', 'Documenti'], ['app', 'Agenda']];

  return <div className="pw2-shell">
    <header className="pw2-hero">
      <div className="pw2-hero-glow" />
      <div className="pw2-hero-top">
        <button className="pw2-back" onClick={onClose} aria-label="Torna indietro"><Ic n="back" s={20} c="currentColor" /></button>
        <div className="pw2-identity">
          <span className="pw2-eyebrow">Scheda Paziente 2.0 · Preview</span>
          <h1>{patient?.nome} {patient?.cognome}</h1>
          <div className="pw2-identity-meta">
            {patient?.sesso && <span>{patient.sesso}</span>}
            {age != null && <span>{age} anni</span>}
            {patient?.dataNascita && <span>Nato il {fmtD(patient.dataNascita)}</span>}
            {patient?.telefono && <span>{patient.telefono}</span>}
          </div>
          {patient?.cf && <div className="pw2-cf"><span>CF {patient.cf}</span><button onClick={() => navigator.clipboard?.writeText(patient.cf)} aria-label="Copia codice fiscale"><Ic n="clip" s={13} c="currentColor" /></button></div>}
        </div>
        <div className="pw2-actions">
          {patient?.telefono && <ActionButton icon="ph" href={`tel:${patient.telefono}`}>Chiama</ActionButton>}
          {patient?.telefono && <ActionButton icon="wa" href={`https://wa.me/39${String(patient.telefono).replace(/\D/g, '')}`}>WhatsApp</ActionButton>}
          <ActionButton icon="edit" onClick={onEdit}>Modifica</ActionButton>
        </div>
      </div>
    </header>

    <section className="pw2-kpis" aria-label="Indicatori paziente">
      {kpis.map((kpi) => <button key={kpi.id} onClick={() => setDrawer(kpi.id)}><span className="pw2-kpi-icon"><Ic n={kpi.icon} s={17} c="currentColor" /></span><span><small>{kpi.label}</small><strong>{kpi.value}</strong></span><span aria-hidden="true">›</span></button>)}
    </section>

    <main className="pw2-main">
      <button className="pw2-micro-profile" onClick={() => setDrawer('profile')}>
        <span>{[age != null ? `${age} anni` : null, patient?.comune, model.lastVisit ? `Ultima visita ${fmtD(model.lastVisit.data)}` : null].filter(Boolean).join('  ·  ') || 'Informazioni anagrafiche'}</span>
        <strong>Anagrafica <span aria-hidden="true">›</span></strong>
      </button>

      <button className={`pw2-risk ${model.risks.length ? 'is-alert' : 'is-clear'}`} onClick={() => setDrawer('risks')}>
        <span className="pw2-risk-bell"><Ic n="bell" s={16} c="currentColor" /></span>
        <span><strong>{model.risks.length ? 'Anamnesi da verificare' : 'Nessuna criticità nota'}</strong><small>{model.risks.length ? `${model.risks.length} segnalazioni disponibili` : 'Il profilo non riporta rischi o allergie'}</small></span>
        <span aria-hidden="true">›</span>
      </button>

      <section className="pw2-clinical">
        <div className="pw2-section-heading"><div><span>Quadro paziente</span><h2>Situazione clinica</h2><p>Sintesi rapida dello stato clinico del paziente</p></div><button onClick={() => setDrawer('clinical')}>Apri situazione clinica <span aria-hidden="true">›</span></button></div>
        {clinicalCards.length ? <div className="pw2-clinical-grid">{clinicalCards.map((card) => <article className={`pw2-clinical-card tone-${card.tone}`} key={card.label}><span><Ic n={card.icon} s={17} c="currentColor" /></span><div><small>{card.label}</small><strong>{card.value}</strong>{card.meta && <p>{card.meta}</p>}</div></article>)}</div> : <div className="pw2-empty"><Ic n="pulse" s={22} c="currentColor" /><div><strong>Nessun elemento clinico da evidenziare</strong><span>La sintesi si popolerà solo con dati realmente disponibili.</span></div></div>}
      </section>

      <nav className="pw2-tabs" aria-label="Workspace paziente">{tabs.map(([id, label]) => <button key={id} className={tab === id ? 'is-active' : ''} onClick={() => setTab(id)}>{label}</button>)}</nav>
      <section className="pw2-workspace"><div><span>Workspace operativo</span><h3>{tabs.find(([id]) => id === tab)?.[1]}</h3><p>La base visuale è pronta. Le funzionalità esistenti verranno collegate nella fase successiva, dopo l’approvazione del Product Owner.</p></div><span className="pw2-preview-chip">Preview isolata</span></section>
    </main>

    {drawer && <DetailDrawer title={{ plans: 'Piani di cura', done: 'Prestazioni eseguite', paid: 'Pagamenti registrati', outstanding: 'Residuo da pagare', profile: 'Anagrafica', risks: 'Anamnesi e rischi', clinical: 'Situazione clinica' }[drawer]} onClose={() => setDrawer(null)}>
      {drawer === 'profile' && <dl className="pw2-detail-list"><div><dt>Nome completo</dt><dd>{patient?.nome} {patient?.cognome}</dd></div><div><dt>Data di nascita</dt><dd>{fmtD(patient?.dataNascita)}</dd></div><div><dt>Comune</dt><dd>{patient?.comune || 'Non disponibile'}</dd></div><div><dt>Indirizzo</dt><dd>{patient?.indirizzo || 'Non disponibile'}</dd></div><div><dt>Email</dt><dd>{patient?.email || 'Non disponibile'}</dd></div></dl>}
      {drawer === 'risks' && (model.risks.length ? model.risks.map((risk, i) => <div className="pw2-detail-row" key={i}>{String(risk)}</div>) : <div className="pw2-empty">Nessuna criticità nota.</div>)}
      {drawer === 'plans' && (model.patientPlans.length ? model.patientPlans.map((plan) => <div className="pw2-detail-row" key={plan.id}><strong>{plan.titolo || 'Piano di cura'}</strong><span>{safeItems(plan).length} prestazioni</span></div>) : <div className="pw2-empty">Nessun piano disponibile.</div>)}
      {drawer === 'done' && (model.completed.length ? model.completed.map((item) => <div className="pw2-detail-row" key={item.key}><strong>{item.prestazione}</strong><span>{fmt(Number(item.prezzo) || 0)}</span></div>) : <div className="pw2-empty">Nessuna prestazione eseguita.</div>)}
      {drawer === 'paid' && (model.paidRows.length ? model.paidRows.map((row) => <div className="pw2-detail-row" key={row.id}><strong>{fmt(Number(row.importo) || 0)}</strong><span>{fmtD(row.data)}</span></div>) : <div className="pw2-empty">Nessun pagamento registrato.</div>)}
      {drawer === 'outstanding' && <div className="pw2-balance"><small>Totale piani</small><strong>{fmt(model.total)}</strong><small>Pagato</small><strong>{fmt(model.paid)}</strong><small>Residuo</small><strong>{fmt(model.outstanding)}</strong></div>}
      {drawer === 'clinical' && clinicalCards.map((card) => <div className="pw2-detail-row" key={card.label}><strong>{card.label}</strong><span>{card.value}{card.meta ? ` · ${card.meta}` : ''}</span></div>)}
    </DetailDrawer>}
  </div>;
}
