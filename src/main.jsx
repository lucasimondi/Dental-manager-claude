import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import PrenotaOnline from './components/PrenotaOnline.jsx';
import FirmaConsenso from './components/FirmaConsenso.jsx';
import './styles.css';

// Pagine pubbliche (nessun login richiesto), intercettate qui al vero entry
// point prima che App venga anche solo montata — così App resta del tutto
// invariata per ogni altro percorso, zero rischio di rompere l'ordine
// degli hook o il comportamento autenticato esistente.
const pathPrenota = window.location.pathname.match(/^\/prenota\/([a-z0-9-]+)\/?$/i);
const pathFirma = window.location.pathname.match(/^\/firma\/([0-9a-f-]{36})\/?$/i);

let elementoRadice;
if (pathPrenota) elementoRadice = <PrenotaOnline slug={pathPrenota[1]} />;
else if (pathFirma) elementoRadice = <FirmaConsenso token={pathFirma[1]} />;
else elementoRadice = <App />;

ReactDOM.createRoot(document.getElementById('root')).render(elementoRadice);
