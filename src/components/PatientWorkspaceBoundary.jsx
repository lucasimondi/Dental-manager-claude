import './PatientRecordClean.css';
import React, { Suspense, lazy, useMemo, useState } from 'react';
import SchedaPaz from './SchedaPaz.jsx';
import { createPatientWorkspaceRealAdapter, isPatientWorkspaceV2Enabled } from '../lib/patientWorkspaceRealAdapter.js';

const PatientPlanEntry = lazy(() => import('./PatientPlanEntry.jsx'));

const PatientWorkspaceV2 = lazy(() => import('./PatientWorkspaceV2.jsx'));

export default function PatientWorkspaceBoundary(props) {
  const [entry, setEntry] = useState(null);
  const canSave = typeof props.onSavePatientEntry === 'function';
  const actions = canSave ? { onAddTreatment: () => setEntry('treatment'), onCreateQuote: () => setEntry('quote') } : {};
  return <>
    <PatientRecordContent {...props} {...actions} />
    {entry && <Suspense fallback={<div role="status">Caricamento modulo…</div>}><PatientPlanEntry key={`${props.paz.id}:${entry}`} patient={props.paz} mode={entry} plans={props.plans} pricelist={props.pricelist} si={props.si} features={props.features} onSave={draft => props.onSavePatientEntry(props.paz, draft)} onClose={() => setEntry(null)} /></Suspense>}
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
