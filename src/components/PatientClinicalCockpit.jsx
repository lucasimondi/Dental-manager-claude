import React from 'react';
import Odontogramma from './Odontogramma.jsx';
import { Ic } from './ui';
import { fmt, fmtD } from '../lib/utils';
import {
  ANATOMICAL_AREA_TYPE,
  buildAnatomicalContext,
  buildMultiTreatmentPreview,
  filterTreatmentGroups,
} from '../lib/patientCockpitModel.js';
import { openPoliedronWithPatientContext } from '../lib/poliedron/patientChatContext.js';
import faceReference from '../assets/clinical/face-reference.png';
import bodyReference from '../assets/clinical/body-reference.png';
import './PatientClinicalCockpit.css';

const FACE_REGIONS = [
  ['forehead', 'Fronte'],
  ['glabella', 'Glabella'],
  ['periocular', 'Perioculare'],
  ['temples', 'Tempie'],
  ['zygomatic', 'Zigomi'],
  ['nose', 'Naso'],
  ['lips', 'Labbra'],
  ['nasolabial', 'Area naso-labiale'],
  ['chin', 'Mento'],
  ['jawline', 'Mandibola'],
  ['neck', 'Collo'],
];

const BODY_REGIONS = {
  front: [['head', 'Testa'], ['neck', 'Collo'], ['chest', 'Torace'], ['abdomen', 'Addome'], ['left_arm', 'Braccio sx'], ['right_arm', 'Braccio dx'], ['left_leg', 'Gamba sx'], ['right_leg', 'Gamba dx']],
  back: [['neck_back', 'Collo posteriore'], ['upper_back', 'Dorso alto'], ['lower_back', 'Zona lombare'], ['left_shoulder', 'Spalla sx'], ['right_shoulder', 'Spalla dx'], ['left_leg_back', 'Gamba sx'], ['right_leg_back', 'Gamba dx']],
};

const calculateAge = (birthDate) => {
  if (!birthDate) return null;
  const birth = new Date(`${birthDate}T12:00:00`);
  if (Number.isNaN(birth.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  const monthDelta = now.getMonth() - birth.getMonth();
  if (monthDelta < 0 || (monthDelta === 0 && now.getDate() < birth.getDate())) age -= 1;
  return age >= 0 ? age : null;
};

const statusLabel = (treatment) => treatment.completed ? 'Eseguita' : 'Da fare';
const normalizeSearch = (value) => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();

function AnatomyGraphic({ kind, side = 'front', selectedContext, onSelect }) {
  const zone = (value, label) => ({
    role: 'button', tabIndex: 0, 'aria-label': label,
    className: `patient-anatomy-zone ${selectedContext?.value === value ? 'is-selected' : ''}`,
    onClick: () => onSelect(buildAnatomicalContext(kind === 'face' ? 'face_region' : 'body_region', value, label)),
    onKeyDown: (event) => { if (event.key === 'Enter' || event.key === ' ') onSelect(buildAnatomicalContext(kind === 'face' ? 'face_region' : 'body_region', value, label)); },
  });
  if (kind === 'face') return (
    <svg className="patient-anatomy-svg" viewBox="0 0 220 280" role="img" aria-label="Mappa anatomica del viso">
      <image className="patient-anatomy-reference" href={faceReference} x="12" y="5" width="196" height="270" preserveAspectRatio="xMidYMid meet" />
      <path {...zone('forehead', 'Fronte')} d="M66 56Q110 28 154 56L145 82Q110 69 75 82Z" />
      <path {...zone('periocular', 'Area perioculare')} d="M69 91Q90 78 109 93L104 123Q84 129 69 112ZM111 93Q130 78 151 91L151 112Q136 129 116 123Z" />
      <path {...zone('nose', 'Naso')} d="M101 104h18l9 50-18 12-18-12Z" />
      <path {...zone('zygomatic', 'Zigomi')} d="M57 120l36-3 9 34-35 18ZM163 120l-36-3-9 34 35 18Z" />
      <path {...zone('lips', 'Labbra')} d="M82 170Q110 151 138 170Q110 198 82 170Z" />
      <path {...zone('chin', 'Mento')} d="M85 192Q110 210 135 192L128 224Q110 242 92 224Z" />
      <path {...zone('jawline', 'Mandibola')} d="M54 157Q65 213 110 244Q155 213 166 157L151 195Q134 229 110 238Q86 229 69 195Z" />
    </svg>
  );
  return (
    <svg className="patient-anatomy-svg patient-anatomy-svg--body" viewBox="0 0 220 420" role="img" aria-label={`Mappa anatomica corpo ${side === 'front' ? 'frontale' : 'posteriore'}`}>
      <image className="patient-anatomy-reference" href={bodyReference} x={side === 'front' ? 0 : -220} y="0" width="440" height="420" preserveAspectRatio="none" />
      <path {...zone(side === 'front' ? 'chest' : 'upper_back', side === 'front' ? 'Torace' : 'Dorso alto')} d="M63 88Q110 70 157 88l-8 58Q110 128 71 146Z" />
      <path {...zone(side === 'front' ? 'abdomen' : 'lower_back', side === 'front' ? 'Addome' : 'Zona lombare')} d="M69 157Q110 140 151 157l-10 69Q110 240 79 226Z" />
      <path {...zone(side === 'front' ? 'left_arm' : 'left_shoulder', side === 'front' ? 'Braccio sinistro' : 'Spalla sinistra')} d="M42 82 70 91 56 244 25 224Z" />
      <path {...zone(side === 'front' ? 'right_arm' : 'right_shoulder', side === 'front' ? 'Braccio destro' : 'Spalla destra')} d="M178 82 150 91 164 244 195 224Z" />
      <path {...zone(side === 'front' ? 'left_leg' : 'left_leg_back', 'Gamba sinistra')} d="M49 263h45l4 123H58Z" />
      <path {...zone(side === 'front' ? 'right_leg' : 'right_leg_back', 'Gamba destra')} d="M126 263h45l-9 123h-40Z" />
    </svg>
  );
}

function TreatmentSearch({ pricelist, value, onChange, onPick }) {
  const q = normalizeSearch(value);
  const matches = q.length < 2 ? [] : (pricelist || [])
    .map((item) => ({ item, name: normalizeSearch(item.nome) }))
    .filter(({ name }) => name.includes(q))
    .sort((a, b) => Number(!a.name.startsWith(q)) - Number(!b.name.startsWith(q)) || a.name.localeCompare(b.name))
    .slice(0, 8)
    .map(({ item }) => item);
  return (
    <div className="patient-treatment-search">
      <label htmlFor="cockpit-treatment-search">Cerca prestazione</label>
      <input id="cockpit-treatment-search" value={value} onChange={(event) => onChange(event.target.value)} placeholder="Scrivi almeno 2 lettere, es. ott…" autoComplete="off" />
      {q.length >= 2 && <div className="patient-treatment-search__results">
        {matches.map((item) => <button key={item.id || item.nome} onClick={() => onPick(item)}><strong>{item.nome}</strong><span>{item.categoria || 'Listino'} · {fmt(Number(item.prezzo || 0))}</span></button>)}
        {matches.length === 0 && <div>Nessuna prestazione coerente con “{value}”.</div>}
      </div>}
    </div>
  );
}

function Section({ title, eyebrow, action, children, className = '' }) {
  return (
    <section className={`patient-cockpit-section ${className}`}>
      <div className="patient-cockpit-section__heading">
        <div>
          {eyebrow && <div className="patient-cockpit-eyebrow">{eyebrow}</div>}
          <h2>{title}</h2>
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

function PatientHeader({ patient, appointments, onEdit, onClose, onNewAppointment, onWhatsApp, onCall, onOpenDetails }) {
  const age = calculateAge(patient.dataNascita);
  return (
    <header className="patient-cockpit-header">
      <div className="patient-cockpit-header__main">
        <button className="patient-cockpit-icon-button" onClick={onClose} aria-label="Torna ai pazienti"><Ic n="back" s={19} c="currentColor" /></button>
        <div className="patient-cockpit-avatar" aria-hidden="true">{patient.nome?.[0]}{patient.cognome?.[0]}</div>
        <div className="patient-cockpit-header__identity">
          <div className="patient-cockpit-eyebrow">Cockpit clinico</div>
          <h1>{patient.nome} {patient.cognome}</h1>
          <div className="patient-cockpit-header__meta">
            {patient.cf && <span>Codice {patient.cf}</span>}
            {patient.dataNascita && <span>{fmtD(patient.dataNascita)}{age != null ? ` · ${age} anni` : ''}</span>}
            <span>{patient.stato || 'Paziente attivo'}</span>
          </div>
        </div>
        <div className="patient-header-actions">
          <button className="patient-cockpit-secondary-button" onClick={onNewAppointment}><Ic n="cal" s={14} c="currentColor" />Appuntamento</button>
          {patient.telefono && <button className="patient-cockpit-icon-button" onClick={onCall} aria-label="Chiama paziente"><Ic n="ph" s={17} c="currentColor" /></button>}
          {patient.telefono && <button className="patient-cockpit-icon-button" onClick={onWhatsApp} aria-label="Apri WhatsApp"><Ic n="wa" s={17} c="currentColor" /></button>}
          <button className="patient-cockpit-icon-button" onClick={onOpenDetails} aria-label="Apri dati paziente"><Ic n="menu" s={17} c="currentColor" /></button>
        </div>
      </div>
      <div className="patient-cockpit-header__facts">
        <div><span>Contatti</span><strong>{patient.telefono || patient.email || 'Non disponibili'}</strong></div>
        <div><span>Responsabile</span><strong>{patient.responsabile || patient.clinicoResponsabile || 'Non disponibile'}</strong></div>
        <div><span>Ultima visita</span><strong>{appointments.last ? fmtD(appointments.last.data) : 'Non disponibile'}</strong></div>
        <div><span>Prossimo appuntamento</span><strong>{appointments.next ? `${fmtD(appointments.next.data)} · ${appointments.next.ora || ''}` : 'Non programmato'}</strong></div>
      </div>
    </header>
  );
}

function PatientNavigation({ onNavigate, canViewFinancial }) {
  const items = [['overview', 'Overview'], ['info', 'Clinica'], ['piani', 'Piani'], ['app', 'Agenda'], ...(canViewFinancial ? [['paga', 'Economico']] : []), ['doc', 'Documenti'], ['info', 'Attività']];
  return <nav className="patient-workspace-nav" aria-label="Sezioni paziente">{items.map(([id, label], index) => <button key={`${id}-${label}`} className={index === 0 ? 'is-active' : ''} onClick={() => id !== 'overview' && onNavigate(id)}>{label}</button>)}</nav>;
}

function PrimaryKpis({ model, canViewFinancial, onNavigate }) {
  const cards = [
    ['Prestazioni da eseguire', String(model.treatmentSummary.remaining), 'amber', 'clk', 'info'],
    ['Prestazioni eseguite', String(model.treatmentSummary.completed), 'green', 'okc', 'piani'],
    ['Situazione economica', canViewFinancial && model.financial.available ? fmt(model.financial.outstanding) : 'Non disponibile', 'blue', 'eur', canViewFinancial ? 'paga' : null],
    ['Prossima azione', model.appointments.next ? fmtD(model.appointments.next.data) : 'Da pianificare', 'purple', 'pulse', 'app'],
  ];
  return (
    <div className="patient-cockpit-kpis" aria-label="Indicatori principali paziente">
      {cards.map(([label, value, tone, icon, target]) => (
        <button className={`patient-cockpit-kpi patient-cockpit-kpi--${tone}`} key={label} onClick={() => target && onNavigate(target)} disabled={!target}>
          <div className="patient-cockpit-kpi__icon"><Ic n={icon} s={17} c="currentColor" /></div>
          <strong>{value}</strong>
          <span>{label}</span>
        </button>
      ))}
    </div>
  );
}

function RegionPicker({ regions, type, selectedContext, onSelect }) {
  return (
    <div className="patient-region-picker">
      {regions.map(([value, label]) => {
        const active = selectedContext?.type === type && selectedContext?.value === value;
        return (
          <button
            key={value}
            className={active ? 'is-selected' : ''}
            aria-pressed={active}
            onClick={() => onSelect(buildAnatomicalContext(type, value, label))}
          >
            <span aria-hidden="true" />
            {label}
          </button>
        );
      })}
    </div>
  );
}

function ClinicalMap({
  treatmentGroups,
  selectedTeeth,
  setSelectedTeeth,
  selectedContext,
  setSelectedContext,
  onSelectGroup,
  pricelist,
  onAddTreatments,
  dentalApplicable,
}) {
  const [tab, setTab] = React.useState(dentalApplicable ? 'tooth' : 'body_region');
  const [bodySide, setBodySide] = React.useState('front');
  const [procedure, setProcedure] = React.useState('');
  const [selectedProcedure, setSelectedProcedure] = React.useState(null);
  const [saved, setSaved] = React.useState(false);
  const statusByTooth = Object.fromEntries(treatmentGroups
    .filter((group) => group.area.type === ANATOMICAL_AREA_TYPE.TOOTH)
    .map((group) => [group.area.value, {
      total: group.treatments.length,
      completed: group.completedCount,
      remaining: group.remainingCount,
    }]));
  const toothContexts = selectedTeeth.map((tooth) => buildAnatomicalContext('tooth', String(tooth), `Elemento ${tooth}`));
  const activeContexts = tab === 'tooth' ? toothContexts : selectedContext ? [selectedContext] : [];
  const preview = buildMultiTreatmentPreview(activeContexts, selectedProcedure?.nome || procedure);
  const saveTreatments = () => {
    if (!selectedProcedure || activeContexts.length === 0) return;
    onAddTreatments({ procedure: selectedProcedure, contexts: activeContexts });
    setSaved(true);
    setTimeout(() => setSaved(false), 1800);
  };

  return (
    <Section title="Mappa clinica" eyebrow="Contesto anatomico" className="patient-cockpit-map-section">
      <div className="patient-cockpit-tabs" role="tablist" aria-label="Tipo di mappa clinica">
        {[...(dentalApplicable ? [['tooth', 'Odontogramma']] : []), ['face_region', 'Viso'], ['body_region', 'Corpo']].map(([id, label]) => (
          <button key={id} role="tab" aria-selected={tab === id} className={tab === id ? 'is-active' : ''} onClick={() => setTab(id)}>{label}</button>
        ))}
      </div>
      {tab === 'tooth' && (
        <>
          <Odontogramma
            selected={selectedTeeth}
            onChange={(teeth) => {
              setSelectedTeeth(teeth);
              const last = teeth.at(-1);
              setSelectedContext(last ? buildAnatomicalContext('tooth', String(last), `Elemento ${last}`) : null);
            }}
            onDenteChange={() => {}}
            statusByTooth={statusByTooth}
            onToothActivate={(tooth) => {
              const group = treatmentGroups.find((item) => item.area.type === 'tooth' && item.area.value === String(tooth));
              if (group) onSelectGroup(group);
            }}
            title="Seleziona uno o più elementi"
          />
          {selectedTeeth.length > 0 && (
            <div className="patient-multi-action">
              <div className="patient-multi-action__title">{selectedTeeth.length} element{selectedTeeth.length === 1 ? 'o selezionato' : 'i selezionati'}</div>
              <TreatmentSearch pricelist={pricelist} value={procedure} onChange={(value) => { setProcedure(value); setSelectedProcedure(null); }} onPick={(item) => { setSelectedProcedure(item); setProcedure(item.nome); }} />
            </div>
          )}
        </>
      )}
      {tab === 'face_region' && (
        <div className="patient-anatomical-map">
            <div className="patient-anatomical-silhouette"><AnatomyGraphic kind="face" selectedContext={selectedContext} onSelect={setSelectedContext} /></div>
          <RegionPicker regions={FACE_REGIONS} type="face_region" selectedContext={selectedContext} onSelect={setSelectedContext} />
        </div>
      )}
      {tab === 'body_region' && (
        <>
          <div className="patient-cockpit-tabs patient-cockpit-tabs--sub">
            <button className={bodySide === 'front' ? 'is-active' : ''} onClick={() => setBodySide('front')}>Fronte</button>
            <button className={bodySide === 'back' ? 'is-active' : ''} onClick={() => setBodySide('back')}>Retro</button>
          </div>
          <div className="patient-anatomical-map">
            <div className="patient-anatomical-silhouette"><AnatomyGraphic kind="body" side={bodySide} selectedContext={selectedContext} onSelect={setSelectedContext} /></div>
            <RegionPicker regions={BODY_REGIONS[bodySide]} type="body_region" selectedContext={selectedContext} onSelect={setSelectedContext} />
          </div>
        </>
      )}
      {tab !== 'tooth' && selectedContext && <div className="patient-multi-action"><div className="patient-multi-action__title">Area selezionata: {selectedContext.label}</div><TreatmentSearch pricelist={pricelist} value={procedure} onChange={(value) => { setProcedure(value); setSelectedProcedure(null); }} onPick={(item) => { setSelectedProcedure(item); setProcedure(item.nome); }} /></div>}
      {activeContexts.length > 0 && selectedProcedure && <div className="patient-save-treatment"><div><strong>{selectedProcedure.nome}</strong><span>{activeContexts.map((item) => item.label).join(', ')}</span></div><button className="patient-cockpit-primary-button" onClick={saveTreatments}>{saved ? 'Salvata ✓' : 'Salva prestazione'}</button></div>}
    </Section>
  );
}

function QuickActionsBar({ onNewAppointment, onOpenDocuments, onOpenNotes, onOpenPayments, onCreateQuote }) {
  const catalog = React.useMemo(() => [
    { id: 'appointment', icon: 'cal', label: 'Appuntamento', tone: 'sky', action: onNewAppointment },
    { id: 'quote', icon: 'plan', label: 'Preventivo', tone: 'violet', action: onCreateQuote },
    { id: 'consent', icon: 'doc', label: 'Consenso', tone: 'teal', action: onOpenDocuments },
    { id: 'prescription', icon: 'file', label: 'Ricetta', tone: 'indigo', action: onOpenDocuments },
    { id: 'invoice', icon: 'eur', label: 'Fattura', tone: 'amber', action: onOpenPayments },
    { id: 'refund', icon: 'pay', label: 'Rimborso', tone: 'rose', action: onOpenPayments },
    { id: 'note', icon: 'clip', label: 'Nota', tone: 'slate', action: onOpenNotes },
  ], [onNewAppointment, onCreateQuote, onOpenDocuments, onOpenPayments, onOpenNotes]);
  const [editing, setEditing] = React.useState(false);
  const [configured, setConfigured] = React.useState(() => {
    try { return JSON.parse(localStorage.getItem('poliedra.patientQuickActions')) || ['appointment', 'quote', 'consent', 'prescription']; } catch { return ['appointment', 'quote', 'consent', 'prescription']; }
  });
  React.useEffect(() => { localStorage.setItem('poliedra.patientQuickActions', JSON.stringify(configured)); }, [configured]);
  const selected = configured.map((id) => catalog.find((item) => item.id === id)).filter(Boolean);
  const toggle = (id) => setConfigured((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  const move = (id, delta) => setConfigured((current) => { const index = current.indexOf(id); const nextIndex = index + delta; if (index < 0 || nextIndex < 0 || nextIndex >= current.length) return current; const next = [...current]; [next[index], next[nextIndex]] = [next[nextIndex], next[index]]; return next; });
  return <div className="patient-quick-actions">
    <div className="patient-quick-actions__intro"><span>Workspace actions</span><strong>Azioni rapide</strong><small>Personalizzate per il tuo lavoro e disponibili anche a Poliedron.</small></div>
    <div className="patient-quick-actions__buttons">{selected.map((item) => <button className={`tone-${item.tone}`} key={item.id} onClick={item.action} disabled={!item.action}><span><Ic n={item.icon} s={15} c="currentColor" /></span>{item.label}</button>)}<button className="is-more" onClick={() => setEditing(true)}><Ic n="set" s={14} c="currentColor" />Personalizza</button></div>
    {editing && <div className="patient-action-editor-backdrop" onMouseDown={(event) => event.target === event.currentTarget && setEditing(false)}><div className="patient-action-editor"><div className="patient-action-editor__header"><div><span>Azioni rapide</span><h3>Personalizza il workspace</h3><p>Scegli e ordina le azioni che usi più spesso.</p></div><button onClick={() => setEditing(false)} aria-label="Chiudi"><Ic n="x" s={16} c="currentColor" /></button></div><div className="patient-action-editor__list">{catalog.map((item) => { const active = configured.includes(item.id); const position = configured.indexOf(item.id); return <div key={item.id} className={active ? 'is-active' : ''}><button className="patient-action-editor__toggle" onClick={() => toggle(item.id)}><span className={`tone-${item.tone}`}><Ic n={item.icon} s={15} c="currentColor" /></span><strong>{item.label}</strong><em>{active ? 'Visibile' : 'Nascosta'}</em></button>{active && <div><button onClick={() => move(item.id, -1)} disabled={position === 0}>↑</button><button onClick={() => move(item.id, 1)} disabled={position === configured.length - 1}>↓</button></div>}</div>; })}</div><button className="patient-cockpit-primary-button" onClick={() => setEditing(false)}>Salva configurazione</button></div></div>}
  </div>;
}

function TreatmentGroup({ group, onSelect, onToggle }) {
  const progress = group.treatments.length ? Math.round((group.completedCount / group.treatments.length) * 100) : 0;
  return (
    <article className="patient-treatment-group">
      <button className="patient-treatment-group__header" onClick={() => onSelect(group)}>
        <div>
          <div className="patient-cockpit-eyebrow">{group.area.type === 'tooth' ? 'Elemento dentario' : 'Contesto clinico'}</div>
          <h3>{group.area.label}</h3>
          <span>{group.treatments.length} prestazion{group.treatments.length === 1 ? 'e' : 'i'} · {group.completedCount} eseguit{group.completedCount === 1 ? 'a' : 'e'} · {group.remainingCount} da fare</span>
        </div>
        <span aria-hidden="true">›</span>
      </button>
      <div className="patient-treatment-progress" aria-label={`${progress}% completato`}><span style={{ width: `${progress}%` }} /></div>
      <div className="patient-treatment-list">
        {group.treatments.map((treatment) => (
          <div className="patient-treatment-row" key={treatment.key}>
            <div>
              <strong>{treatment.procedure}</strong>
              <span>{treatment.completedAt ? `Eseguita il ${fmtD(treatment.completedAt)}` : treatment.planTitle}</span>
            </div>
            <button className={treatment.completed ? 'is-complete' : ''} onClick={() => onToggle(treatment)}>
              <Ic n={treatment.completed ? 'okc' : 'clk'} s={13} c="currentColor" />
              {statusLabel(treatment)}
            </button>
          </div>
        ))}
      </div>
    </article>
  );
}

function CarePlan({ groups, onSelect, onToggle, onCreateQuote }) {
  const [filter, setFilter] = React.useState('all');
  const visibleGroups = filterTreatmentGroups(groups, filter);
  return (
    <Section
      title="Percorso clinico"
      eyebrow="Unico e aggiornato nel tempo"
      action={<button className="patient-cockpit-secondary-button" onClick={onCreateQuote}><Ic n="plan" s={13} c="currentColor" />Crea preventivo</button>}
    >
      <div className="patient-care-filters" aria-label="Filtri piano di cura">
        {[['all', 'Tutto'], ['todo', 'Da fare'], ['done', 'Eseguito']].map(([id, label]) => (
          <button key={id} className={filter === id ? 'is-active' : ''} onClick={() => setFilter(id)}>{label}</button>
        ))}
      </div>
      {visibleGroups.length === 0
        ? <div className="patient-cockpit-empty">Nessuna prestazione per questo filtro.</div>
        : visibleGroups.map((group) => <TreatmentGroup key={group.key} group={group} onSelect={onSelect} onToggle={onToggle} />)}
    </Section>
  );
}

function PoliedronCard({ patient, selectedContext }) {
  const openPoliedron = () => {
    openPoliedronWithPatientContext({ patient, anatomicalContext: selectedContext });
  };
  return (
    <Section title="Poliedron" eyebrow="Assistente contestuale" className="patient-poliedron-card">
      <p>Chiedi, ricevi suggerimenti e prepara aggiornamenti con il contesto di {patient.nome} già attivo.</p>
      {selectedContext && <div className="patient-context-chip"><Ic n="pin" s={12} c="currentColor" />{selectedContext.label}</div>}
      <button className="patient-cockpit-primary-button" onClick={openPoliedron}><Ic n="spark" s={15} c="currentColor" />Chat con {patient.nome}</button>
      <small>Le azioni cliniche restano in anteprima: POL-AI-005A non esegue scritture.</small>
    </Section>
  );
}

function DataHealth({ dataHealth, onOpenPlans }) {
  return (
    <Section title="Dati da completare" eyebrow="Data Health">
      {dataHealth.issues.length === 0
        ? <div className="patient-cockpit-positive"><Ic n="okc" s={15} c="currentColor" />Nessuna incompletezza clinica strutturale rilevata.</div>
        : dataHealth.issues.map((issue) => (
          <div className="patient-data-issue" key={issue.key}>
            <div><Ic n="warn" s={14} c="currentColor" /><span>{issue.label}</span></div>
            <button onClick={onOpenPlans}>Completa dato</button>
          </div>
        ))}
      {!dataHealth.scoreAvailable && <small>{dataHealth.reason}</small>}
    </Section>
  );
}

function FinancialSummary({ financial, onOpenPayments, canViewFinancial }) {
  if (!canViewFinancial) return null;
  return (
    <Section title="Situazione finanziaria" eyebrow="Contratto paziente esistente">
      {financial.available ? <div className="patient-financial-grid">
        <div><span>Totale piani</span><strong>{fmt(financial.planned)}</strong></div>
        <div><span>Incassato</span><strong>{fmt(financial.collected)}</strong></div>
        <div><span>Da incassare</span><strong>{fmt(financial.outstanding)}</strong></div>
      </div> : <div className="patient-cockpit-empty">{financial.reason}</div>}
      <button className="patient-cockpit-text-button" onClick={onOpenPayments}>Apri dettaglio pagamenti →</button>
    </Section>
  );
}

function NextAppointment({ appointment, onGoAgenda }) {
  return (
    <Section title="Prossimo appuntamento" eyebrow="Agenda">
      {appointment ? (
        <div className="patient-next-appointment">
          <div className="patient-next-appointment__date"><strong>{fmtD(appointment.data)}</strong><span>{appointment.ora || 'Orario non disponibile'}</span></div>
          <div><strong>{appointment.tipo || 'Appuntamento'}</strong><span>{appointment.operatore || appointment.clinico || 'Clinico non indicato'}</span></div>
        </div>
      ) : <div className="patient-cockpit-empty">Nessun appuntamento futuro programmato.</div>}
      <button className="patient-cockpit-text-button" onClick={onGoAgenda}>Vai all'agenda →</button>
    </Section>
  );
}

function Timeline({ entries, onOpenNotes, onOpenDocuments }) {
  const [filter, setFilter] = React.useState('all');
  const category = (entry) => entry.type === 'payment' ? 'payments' : entry.type === 'appointment' ? 'agenda' : entry.type === 'document' ? 'documents' : entry.type === 'annotation' ? 'communications' : 'clinical';
  const visible = filter === 'all' ? entries : entries.filter((entry) => category(entry) === filter);
  return (
    <Section
      title="Attività recente"
      eyebrow="Timeline unificata"
      action={<div className="patient-section-actions"><button onClick={onOpenNotes}>Note</button><button onClick={onOpenDocuments}>Documenti</button></div>}
    >
      <div className="patient-timeline-filters">{[['all','Tutto'],['clinical','Clinica'],['agenda','Agenda'],['payments','Pagamenti'],['documents','Documenti'],['communications','Comunicazioni']].map(([id,label]) => <button key={id} className={filter === id ? 'is-active' : ''} onClick={() => setFilter(id)}>{label}</button>)}</div>
      {visible.length === 0 ? <div className="patient-cockpit-empty">Nessun evento per questo filtro.</div> : (
        <div className="patient-timeline">
          {visible.slice(0, 20).map((entry) => (
            <div className="patient-timeline__entry" key={entry.key}>
              <span className={`patient-timeline__dot patient-timeline__dot--${entry.type}`} />
              <div><strong>{entry.title}</strong><span>{fmtD(entry.date)}{entry.time ? ` · ${entry.time}` : ''}{entry.detail ? ` · ${entry.detail}` : ''}{entry.amount != null ? ` · ${fmt(entry.amount)}` : ''}</span></div>
            </div>
          ))}
        </div>
      )}
    </Section>
  );
}

function PatientDetailsDrawer({ patient, onClose, onEdit }) {
  const rows = [['Nome', patient.nome], ['Cognome', patient.cognome], ['Codice fiscale', patient.cf], ['Data di nascita', patient.dataNascita && fmtD(patient.dataNascita)], ['Sesso', patient.sesso], ['Telefono', patient.telefono], ['Email', patient.email], ['Indirizzo', patient.indirizzo], ['Sistema TS', patient.sistemaTs ?? patient.sistema_ts], ['Assicurazione', patient.assicurazione], ['Privacy / marketing', patient.consensoMarketing ?? patient.consenso_marketing]];
  return <div className="patient-detail-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}><aside className="patient-details-drawer" role="dialog" aria-modal="true" aria-label="Dati paziente"><div className="patient-treatment-detail__header"><div><div className="patient-cockpit-eyebrow">Dati completi</div><h2>{patient.nome} {patient.cognome}</h2></div><button className="patient-cockpit-icon-button" onClick={onClose}><Ic n="x" s={16} c="currentColor" /></button></div><div className="patient-details-list">{rows.map(([label,value]) => <div key={label}><span>{label}</span><strong>{value === true ? 'Sì' : value === false ? 'No' : value || 'Non disponibile'}</strong></div>)}<button className="patient-cockpit-primary-button" onClick={() => onEdit(patient)}>Modifica dati</button></div></aside></div>;
}

function TreatmentDetail({ group, onClose, onToggle, onEdit, canViewFinancial }) {
  if (!group) return null;
  return (
    <div className="patient-detail-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <aside className="patient-treatment-detail" role="dialog" aria-modal="true" aria-label={`Dettaglio ${group.area.label}`}>
        <div className="patient-treatment-detail__header">
          <div><div className="patient-cockpit-eyebrow">Dettaglio clinico</div><h2>{group.area.label}</h2><span>{group.treatments.length} prestazioni · {group.completedCount} eseguite · {group.remainingCount} da fare</span></div>
          <button className="patient-cockpit-icon-button" onClick={onClose} aria-label="Chiudi dettaglio"><Ic n="x" s={16} c="currentColor" /></button>
        </div>
        <div className="patient-treatment-detail__body">
          {group.treatments.map((treatment) => (
            <article key={treatment.key}>
              <div>
                <h3>{treatment.procedure}</h3>
                <span>{treatment.completedAt ? fmtD(treatment.completedAt) : 'Data non disponibile'}{canViewFinancial ? ` · ${fmt(treatment.price)}` : ''}</span>
              </div>
              {treatment.notes && <p>{treatment.notes}</p>}
              <div>
                <button className={treatment.completed ? 'patient-cockpit-success-button' : 'patient-cockpit-primary-button'} onClick={() => onToggle(treatment)}>{treatment.completed ? 'Eseguita' : 'Segna eseguita'}</button>
                <button className="patient-cockpit-secondary-button" onClick={() => onEdit(treatment.planId)}>Modifica piano</button>
              </div>
            </article>
          ))}
        </div>
      </aside>
    </div>
  );
}

export default function PatientClinicalCockpit({
  patient,
  model,
  pricelist,
  onClose,
  onEdit,
  onToggleTreatment,
  onNewPlan,
  onAddTreatments,
  onOpenPlans,
  onOpenPayments,
  onOpenDocuments,
  onOpenNotes,
  onGoAgenda,
  onNavigate,
  onNewAppointment,
  onWhatsApp,
  canViewFinancial,
}) {
  const [selectedTeeth, setSelectedTeeth] = React.useState([]);
  const [selectedContext, setSelectedContext] = React.useState(null);
  const [detailGroup, setDetailGroup] = React.useState(null);
  const [detailsOpen, setDetailsOpen] = React.useState(false);

  React.useEffect(() => {
    if (!detailGroup) return;
    const refreshed = model.treatmentGroups.find((group) => group.key === detailGroup.key);
    setDetailGroup(refreshed || null);
  }, [model.treatmentGroups]);

  return (
    <div className="patient-cockpit">
      <PatientHeader patient={patient} appointments={model.appointments} onEdit={onEdit} onClose={onClose} onNewAppointment={onNewAppointment} onWhatsApp={onWhatsApp} onCall={() => window.location.assign(`tel:${patient.telefono || ''}`)} onOpenDetails={() => setDetailsOpen(true)} />
      <PatientNavigation onNavigate={onNavigate} canViewFinancial={canViewFinancial} />
      <main className="patient-cockpit-content">
        <QuickActionsBar onNewAppointment={onNewAppointment} onOpenDocuments={onOpenDocuments} onOpenNotes={onOpenNotes} onOpenPayments={onOpenPayments} onCreateQuote={onNewPlan} />
        <PrimaryKpis model={model} canViewFinancial={canViewFinancial} onNavigate={onNavigate} />
        <div className="patient-cockpit-layout">
          <div className="patient-cockpit-main-column">
            <ClinicalMap
              treatmentGroups={model.treatmentGroups}
              selectedTeeth={selectedTeeth}
              setSelectedTeeth={setSelectedTeeth}
              selectedContext={selectedContext}
              setSelectedContext={setSelectedContext}
              onSelectGroup={setDetailGroup}
              pricelist={pricelist}
              onAddTreatments={onAddTreatments}
              dentalApplicable={model.dentalApplicable}
            />
            <CarePlan groups={model.treatmentGroups} onSelect={setDetailGroup} onToggle={onToggleTreatment} onCreateQuote={onNewPlan} />
          </div>
          <div className="patient-cockpit-side-column">
            <PoliedronCard patient={patient} selectedContext={selectedContext} />
            <DataHealth dataHealth={model.dataHealth} onOpenPlans={onOpenPlans} />
            <NextAppointment appointment={model.appointments.next} onGoAgenda={onGoAgenda} />
            <FinancialSummary financial={model.financial} onOpenPayments={onOpenPayments} canViewFinancial={canViewFinancial} />
          </div>
        </div>
        <Timeline entries={model.timeline.filter((entry) => canViewFinancial || entry.type !== 'payment')} onOpenNotes={onOpenNotes} onOpenDocuments={onOpenDocuments} />
      </main>
      <TreatmentDetail group={detailGroup} onClose={() => setDetailGroup(null)} onToggle={onToggleTreatment} onEdit={onOpenPlans} canViewFinancial={canViewFinancial} />
      {detailsOpen && <PatientDetailsDrawer patient={patient} onClose={() => setDetailsOpen(false)} onEdit={onEdit} />}
    </div>
  );
}
