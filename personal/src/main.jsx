import { registraIngresso } from './pdf/ingresso.js';
import React from 'react';
import { createRoot } from 'react-dom/client';
import './personal.css';
import './pro.css';
import './retro.css';
import { AspettoProvider } from './Aspetto.jsx';
import { applicaAspetto, leggiAspetto, storageAspetto } from './lib/aspetto.js';
import App from './App.jsx';
import { isPersonalConsentPath } from './lib/oauthConsent.js';
import OAuthConsent from './OAuthConsent.jsx';

const consenso = isPersonalConsentPath(window.location.pathname);
if (!consenso) void registraIngresso().catch(() => { /* File picker remains available without service workers. */ });
if (!consenso) applicaAspetto(document.documentElement, leggiAspetto(storageAspetto()));
createRoot(document.getElementById('root')).render(<React.StrictMode>{consenso ? <OAuthConsent /> : <AspettoProvider><App /></AspettoProvider>}</React.StrictMode>);
