import React, { Suspense, lazy, useMemo } from 'react';
import SchedaPaz from './SchedaPaz.jsx';
import { createPatientWorkspaceRealAdapter, isPatientWorkspaceV2Enabled } from '../lib/patientWorkspaceRealAdapter.js';

const PatientWorkspaceV2 = lazy(() => import('./PatientWorkspaceV2.jsx'));

export default function PatientWorkspaceBoundary(props) {
  const { paz, plans, payments, appointments, pricelist, richiami, documents, canonicalFinancial, financialScope,
    features, studioMembership, currentUserId, isStudioAdmin, initTab, initialDocumentRequest } = props;
  const context = useMemo(() => createPatientWorkspaceRealAdapter({
    patient: paz, plans, payments, appointments, pricelist, recalls: richiami, documents,
    canonicalFinancial, financialScope, features, studioMembership, currentUserId, isStudioAdmin,
  }), [paz, plans, payments, appointments, pricelist, richiami, documents, canonicalFinancial, financialScope, features, studioMembership, currentUserId, isStudioAdmin]);

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
      onClose={props.onClose}
      onEdit={() => props.onEdit?.(paz)}
    />
  </Suspense>;
}
