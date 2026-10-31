import React from 'react';
import { createRoot } from 'react-dom/client';
import './personal.css';
import App from './App.jsx';
import { isPersonalConsentPath } from './lib/oauthConsent.js';
import OAuthConsent from './OAuthConsent.jsx';

const Page = isPersonalConsentPath(window.location.pathname) ? OAuthConsent : App;
createRoot(document.getElementById('root')).render(<React.StrictMode><Page /></React.StrictMode>);
