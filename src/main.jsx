import React, { Suspense } from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import LoadingScreen from './components/LoadingScreen.jsx';
import { lazyWithRetry } from './lib/lazyWithRetry.js';
import './styles.css';

// POL-PERF-001: le pagine pubbliche sono caricate solo quando si apre il
// loro indirizzo. Prima erano importate qui in modo statico e finivano nel
// download iniziale di ogni avvio dell'app (FirmaConsenso trascinava con sé
// jsPDF), anche per chi apre solo il gestionale.
const PrenotaOnline = lazyWithRetry(() => import('./components/PrenotaOnline.jsx'), 'PrenotaOnline');
const FirmaConsenso = lazyWithRetry(() => import('./components/FirmaConsenso.jsx'), 'FirmaConsenso');
const StoriaClinicaRemota = lazyWithRetry(() => import('./components/StoriaClinicaRemota.jsx'), 'StoriaClinicaRemota');
const PatientWorkspaceV2Demo = lazyWithRetry(() => import('./components/PatientWorkspaceV2Demo.jsx'), 'PatientWorkspaceV2Demo');
const PatientWorkspaceRealPreview = lazyWithRetry(() => import('./components/PatientWorkspaceRealPreview.jsx'), 'PatientWorkspaceRealPreview');

// Pagine pubbliche (nessun login richiesto), intercettate qui al vero entry
// point prima che App venga anche solo montata — così App resta del tutto
// invariata per ogni altro percorso, zero rischio di rompere l'ordine
// degli hook o il comportamento autenticato esistente.
const pathPrenota = window.location.pathname.match(/^\/prenota\/([a-z0-9-]+)\/?$/i);
const pathFirma = window.location.pathname.match(/^\/firma\/([0-9a-f-]{36})\/?$/i);
const pathStoriaClinica = window.location.pathname.match(/^\/storia-clinica\/([0-9a-f-]{36})\/?$/i);
const pathPatientWorkspaceDemo = window.location.pathname === '/patient-workspace-v2-demo' || window.location.pathname === '/patient-workspace-v2-demo/';
const pathPatientWorkspaceRealPreview = window.location.pathname === '/patient-workspace-v2-real-preview' || window.location.pathname === '/patient-workspace-v2-real-preview/';

let elementoRadice;
if (pathPrenota) elementoRadice = <PrenotaOnline slug={pathPrenota[1]} />;
else if (pathFirma) elementoRadice = <FirmaConsenso token={pathFirma[1]} />;
else if (pathStoriaClinica) elementoRadice = <StoriaClinicaRemota token={pathStoriaClinica[1]} />;
else if (pathPatientWorkspaceRealPreview) elementoRadice = <PatientWorkspaceRealPreview />;
else if (pathPatientWorkspaceDemo) elementoRadice = <PatientWorkspaceV2Demo />;
else elementoRadice = <App />;

ReactDOM.createRoot(document.getElementById('root')).render(
  <Suspense fallback={<LoadingScreen />}>{elementoRadice}</Suspense>
);
