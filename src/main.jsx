import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import PrenotaOnline from './components/PrenotaOnline.jsx';
import './styles.css';

// Pagina pubblica di richiesta prenotazione: nessun login richiesto.
// Intercettata qui, al vero entry point, prima che App (con tutta la sua
// logica di sessione/dati/hook) venga anche solo montata — così App resta
// del tutto invariata per ogni altro percorso, zero rischio di rompere
// l'ordine degli hook o il comportamento autenticato esistente.
const pathPrenota = window.location.pathname.match(/^\/prenota\/([a-z0-9-]+)\/?$/i);

ReactDOM.createRoot(document.getElementById('root')).render(
  pathPrenota ? <PrenotaOnline slug={pathPrenota[1]} /> : <App />
);
