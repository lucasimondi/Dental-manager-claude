import './PatientRecordClean.css';
import { dentalEntryTeeth } from '../lib/patientDentalOverview.js';
import React, { Suspense, lazy, useMemo, useState } from 'react';
import SchedaPaz from './SchedaPaz.jsx';
import { updateTreatmentItem } from '../lib/domain/treatmentPlanService.js';
import { createPatientWorkspaceRealAdapter, isPatientWorkspaceV2Enabled } from '../lib/patientWorkspaceRealAdapter.js';

const PatientPlanEntry = lazy(() => import('./PatientPlanEntry.jsx'));

const PatientWorkspaceV2 = lazy(() => import('./PatientWorkspaceV2.jsx'));

export default function PatientWorkspaceBoundary(props) {
  const [entry, setEntry] = useState(null);
  const canSave = typeof props.onSavePatientEntry === 'function';
  // PREVENTIVO-DA-PRESTAZIONI: «Crea preventivo» in Denti e cure passa il piano e le voci spuntate;
  // il modulo si apre già compilato con quelle voci (documento dal piano, senza duplicarlo).
  const actions = canSave ? { onAddTreatment: options => setEntry({mode:'treatment',tooth:dentalEntryTeeth(options?.tooth)}), onCreateQuote: options => setEntry({mode:'quote',tooth:dentalEntryTeeth(options?.tooth),sourcePlanId:options?.sourcePlanId ?? null,sourceRefs:Array.isArray(options?.sourceRefs) ? options.sourceRefs : null}) } : {};
  const sourcePlan = entry?.sourcePlanId != null ? (props.plans || []).find(p => String(p.id) === String(entry.sourcePlanId) && String(p.pazienteId) === String(props.paz.id)) : undefined;
  // Un prezzo cambiato nel preventivo cambia la voce del piano con la stessa regola di «Modifica»,
  // solo se la voce in quella posizione è ancora la stessa prestazione.
  const ownPlans = (props.plans || []).filter(p => String(p.pazienteId) === String(props.paz.id));
  // Voci spuntate anche da piani diversi (PO 2026-11-13): solo piani di questo paziente.
  const sourceRefs = sourcePlan && entry?.sourceRefs ? entry.sourceRefs.filter(r => ownPlans.some(p => String(p.id) === String(r.planId))) : null;
  const updateSourcePrices = changes => props.setPlans?.(cur => cur.map(p => { const mine = changes.filter(c => String(c.planId) === String(p.id)); return !mine.length ? p : mine.reduce((plan, c) => (plan.voci?.[c.index]?.prestazione || 'Prestazione') === c.prestazione ? updateTreatmentItem(plan, c.index, { prezzo: c.prezzo }) : plan, p); }));
  return <>
    <PatientRecordContent {...props} {...actions} />
    {entry && <Suspense fallback={<div role="status">Caricamento modulo…</div>}><PatientPlanEntry key={`${props.paz.id}:${entry.mode}:${entry.tooth}:${entry.sourceRefs?.map(r => `${r.planId}.${r.index}`).join(',') || ''}`} patient={props.paz} mode={entry.mode} initialTooth={entry.tooth} sourcePlan={sourcePlan} sourceRefs={sourceRefs} sourcePlans={ownPlans} onUpdateSourcePrices={updateSourcePrices} plans={props.plans} pricelist={props.pricelist} si={props.si} features={props.features} documentClient={props.documentClient} onSave={draft => props.onSavePatientEntry(props.paz, draft)} onClose={() => setEntry(null)} /></Suspense>}
  </>;
}

function PatientRecordContent(props) {
  const { paz, plans, payments, appointments, pricelist, richiami, documents, canonicalFinancial, financialScope,
    features, studioMembership, currentUserId, isStudioAdmin, initTab, initialDocumentRequest } = props;
  const context = useMemo(() => createPatientWorkspaceRealAdapter({
    patient: paz, plans, payments, appointments, pricelist, recalls: richiami, documents,
    canonicalFinancial, financialScope, features, studioMembership, currentUserId, isStudioAdmin,
  }), [paz, plans, payments, appointments, pricelist, richiami, documents, canonicalFinancial, financialScope, features, studioMembership, currentUserId, isStudioAdmin]);

  // Explicit operational actions use the existing stable write/document forms.
  // Normal V2 navigation and its capabilities remain unchanged.
  if (['treatment', 'prescription', 'documents', 'payment'].includes(props.initialAction)) return <SchedaPaz key={`${paz?.id}:${props.initialAction}`} {...props} />;
  if (!isPatientWorkspaceV2Enabled(features)) return <SchedaPaz key={`${paz?.id || 'none'}:${initTab || 'info'}:${initialDocumentRequest?.requestId || 'default'}`} {...props} />;
  return <Suspense fallback={<div role="status" style={{ padding: 24 }}>Caricamento Scheda Paziente 2.0…</div>}>
    <PatientWorkspaceV2
      key={`${paz?.id || 'none'}:${initialDocumentRequest?.requestId || 'default'}`}
      context={context}
      patient={paz}
      plans={context.clinicalPlans}
      payments={context.payments}
      appointments={context.appointments}
      studioInfo={props.si}
      documentClient={props.documentClient}
      realMode
      capabilities={{
        UPDATE_TREATMENT_STATUS: { enabled: false, reason: 'Scrittura disabilitata: plans.voci non dispone di controllo versione concorrente.' },
        REGISTER_PAYMENT: { enabled: false, reason: 'Usare il flusso Pagamenti esistente.' },
        CREATE_PAYMENT_PLAN: { enabled: false, reason: 'Nessun backend autorevole per la rateizzazione.' },
      }}
      features={features}
      studioMembership={studioMembership}
      currentUserId={currentUserId}
      isStudioAdmin={isStudioAdmin}
      pricelist={pricelist}
      initialTab={initTab}
      initialDocumentRequest={initialDocumentRequest}
      onDocumentRequestHandled={props.onDocumentRequestHandled}
      onAddTreatment={props.onAddTreatment}
      onCreateQuote={props.onCreateQuote}
      onClose={props.onClose}
      onNuovoAppuntamento={props.onNuovoAppuntamento}
      onEdit={() => props.onEdit?.(paz)}
    />
  </Suspense>;
}
