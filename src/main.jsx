import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import PrenotaOnline from './components/PrenotaOnline.jsx';
import FirmaConsenso from './components/FirmaConsenso.jsx';
import StoriaClinicaRemota from './components/StoriaClinicaRemota.jsx';
import PatientWorkspaceV2Demo from './components/PatientWorkspaceV2Demo.jsx';
import PatientWorkspaceRealPreview from './components/PatientWorkspaceRealPreview.jsx';
import './styles.css';
import { isPoliedronAppPath } from './lib/poliedron/phoneApp.js';

// Also restores install identity if the offline SW serves the shared HTML shell.
if (isPoliedronAppPath(window.location.pathname)) {
  document.title = 'Poliedron';
  document.querySelectorAll('link[rel="manifest"]').forEach((link, index) => {
    if (index > 0) link.remove();
    else link.href = '/poliedron.webmanifest';
  });
  document.querySelector('meta[name="apple-mobile-web-app-title"]')?.setAttribute('content', 'Poliedron');
  document.querySelector('link[rel="apple-touch-icon"]')?.setAttribute('href', '/poliedron-v2-180.png');
}


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

ReactDOM.createRoot(document.getElementById('root')).render(elementoRadice);
