import React, { lazy, Suspense } from 'react';
import ReactDOM from 'react-dom/client';
import './styles.css';

const App = lazy(() => import('./App.jsx'));
const PrenotaOnline = lazy(() => import('./components/PrenotaOnline.jsx'));
const FirmaConsenso = lazy(() => import('./components/FirmaConsenso.jsx'));
const StoriaClinicaRemota = lazy(() => import('./components/StoriaClinicaRemota.jsx'));
const AgendaLab = lazy(() => import('./components/AgendaLab/AgendaLab.jsx'));

// Pagine pubbliche (nessun login richiesto), intercettate qui al vero entry
// point prima che App venga anche solo montata — così App resta del tutto
// invariata per ogni altro percorso, zero rischio di rompere l'ordine
// degli hook o il comportamento autenticato esistente.
const pathPrenota = window.location.pathname.match(/^\/prenota\/([a-z0-9-]+)\/?$/i);
const pathFirma = window.location.pathname.match(/^\/firma\/([0-9a-f-]{36})\/?$/i);
const pathStoriaClinica = window.location.pathname.match(/^\/storia-clinica\/([0-9a-f-]{36})\/?$/i);
const pathAgendaLab = /^\/agenda-lab\/?$/i.test(window.location.pathname);

let elementoRadice;
if (pathAgendaLab) elementoRadice = <AgendaLab />;
else if (pathPrenota) elementoRadice = <PrenotaOnline slug={pathPrenota[1]} />;
else if (pathFirma) elementoRadice = <FirmaConsenso token={pathFirma[1]} />;
else if (pathStoriaClinica) elementoRadice = <StoriaClinicaRemota token={pathStoriaClinica[1]} />;
else elementoRadice = <App />;

ReactDOM.createRoot(document.getElementById('root')).render(
  <Suspense fallback={<div className="route-loading" aria-label="Caricamento" />}>
    {elementoRadice}
  </Suspense>,
);
