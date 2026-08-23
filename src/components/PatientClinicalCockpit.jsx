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

function PatientHeader({ patient, appointments, onEdit, onClose }) {
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
        <button className="patient-cockpit-secondary-button" onClick={() => onEdit(patient)}><Ic n="edit" s={14} c="currentColor" />Modifica</button>
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

function PrimaryKpis({ model, canViewFinancial }) {
  const cards = [
    ['Da fare', model.treatmentSummary.remaining, 'amber', 'clk'],
    ['Eseguito', model.treatmentSummary.completed, 'green', 'okc'],
    ['Da incassare', canViewFinancial && model.financial.available ? fmt(model.financial.outstanding) : 'Non disponibile', 'blue', 'eur'],
    ['Completezza dati', model.dataHealth.scoreAvailable ? `${model.dataHealth.completenessPercent}%` : 'Non disponibile', 'purple', 'pulse'],
  ];
  return (
    <div className="patient-cockpit-kpis" aria-label="Indicatori principali paziente">
      {cards.map(([label, value, tone, icon]) => (
        <article className={`patient-cockpit-kpi patient-cockpit-kpi--${tone}`} key={label}>
          <div className="patient-cockpit-kpi__icon"><Ic n={icon} s={17} c="currentColor" /></div>
          <strong>{value}</strong>
          <span>{label}</span>
        </article>
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
  onStartCanonicalPlan,
  dentalApplicable,
}) {
  const [tab, setTab] = React.useState(dentalApplicable ? 'tooth' : 'body_region');
  const [bodySide, setBodySide] = React.useState('front');
  const [procedure, setProcedure] = React.useState('');
  const statusByTooth = Object.fromEntries(treatmentGroups
    .filter((group) => group.area.type === ANATOMICAL_AREA_TYPE.TOOTH)
    .map((group) => [group.area.value, {
      total: group.treatments.length,
      completed: group.completedCount,
      remaining: group.remainingCount,
    }]));
  const toothContexts = selectedTeeth.map((tooth) => buildAnatomicalContext('tooth', String(tooth), `Elemento ${tooth}`));
  const preview = buildMultiTreatmentPreview(toothContexts, procedure);

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
              <div className="patient-multi-action__controls">
                <select value={procedure} onChange={(event) => setProcedure(event.target.value)} aria-label="Prestazione da applicare">
                  <option value="">Scegli prestazione</option>
                  {(pricelist || []).map((item) => <option key={item.id || item.nome} value={item.nome}>{item.nome}</option>)}
                </select>
                <button className="patient-cockpit-primary-button" disabled={!procedure} onClick={() => onStartCanonicalPlan({ procedure, teeth: selectedTeeth })}>Applica prestazione</button>
              </div>
              {preview.length > 0 && (
                <div className="patient-multi-action__preview" aria-label="Anteprima prestazioni">
                  {preview.map((item) => <span key={item.anatomicalContext.value}>{item.anatomicalContext.value} → {item.procedure}</span>)}
                  <small>L'aggiunta prosegue nel flusso Piano di cura esistente; nessuna modifica viene eseguita da questa anteprima.</small>
                </div>
              )}
            </div>
          )}
        </>
      )}
      {tab === 'face_region' && (
        <div className="patient-anatomical-map">
          <div className="patient-anatomical-silhouette patient-anatomical-silhouette--face" aria-hidden="true"><span /></div>
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
            <div className="patient-anatomical-silhouette patient-anatomical-silhouette--body" aria-hidden="true"><span /></div>
            <RegionPicker regions={BODY_REGIONS[bodySide]} type="body_region" selectedContext={selectedContext} onSelect={setSelectedContext} />
          </div>
        </>
      )}
    </Section>
  );
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

function CarePlan({ groups, onSelect, onToggle, onNewPlan }) {
  const [filter, setFilter] = React.useState('all');
  const visibleGroups = filterTreatmentGroups(groups, filter);
  return (
    <Section
      title="Piano di cura"
      eyebrow="Prestazioni raggruppate per area"
      action={<button className="patient-cockpit-secondary-button" onClick={onNewPlan}><Ic n="plus" s={13} c="currentColor" />Nuovo piano</button>}
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
  return (
    <Section
      title="Attività recente"
      eyebrow="Timeline unificata"
      action={<div className="patient-section-actions"><button onClick={onOpenNotes}>Note</button><button onClick={onOpenDocuments}>Documenti</button></div>}
    >
      {entries.length === 0 ? <div className="patient-cockpit-empty">Nessuna attività recente disponibile.</div> : (
        <div className="patient-timeline">
          {entries.slice(0, 10).map((entry) => (
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
  onOpenPlans,
  onOpenPayments,
  onOpenDocuments,
  onOpenNotes,
  onGoAgenda,
  canViewFinancial,
}) {
  const [selectedTeeth, setSelectedTeeth] = React.useState([]);
  const [selectedContext, setSelectedContext] = React.useState(null);
  const [detailGroup, setDetailGroup] = React.useState(null);

  React.useEffect(() => {
    if (!detailGroup) return;
    const refreshed = model.treatmentGroups.find((group) => group.key === detailGroup.key);
    setDetailGroup(refreshed || null);
  }, [model.treatmentGroups]);

  return (
    <div className="patient-cockpit">
      <PatientHeader patient={patient} appointments={model.appointments} onEdit={onEdit} onClose={onClose} />
      <main className="patient-cockpit-content">
        <PrimaryKpis model={model} canViewFinancial={canViewFinancial} />
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
              onStartCanonicalPlan={onNewPlan}
              dentalApplicable={model.dentalApplicable}
            />
            <CarePlan groups={model.treatmentGroups} onSelect={setDetailGroup} onToggle={onToggleTreatment} onNewPlan={onNewPlan} />
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
    </div>
  );
}
