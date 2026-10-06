import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom';

// "Installa": puts the Poliedron app (its own icon and manifest, /poliedron/)
// on the phone's Home screen.
// - Android/desktop Chrome: the browser's install prompt, captured as early as
//   possible because it can fire before this menu is ever rendered.
// - iPhone: there is no install prompt; it is Safari → Condividi → "Aggiungi
//   alla schermata Home". From an already installed app (standalone) Safari is
//   needed, so the sheet offers "Apri in Safari" and "Copia link".
// `href`: from the studio app, open the Poliedron app page first.
let deferredPrompt = null;
const listeners = new Set();
if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    deferredPrompt = event;
    listeners.forEach((fn) => fn(event));
  });
}

const isIOS = () => typeof navigator !== 'undefined'
  && (/iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1));
const isStandalone = () => typeof window !== 'undefined'
  && (window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true);
const notSafariOnIOS = () => /crios|fxios|edgios|opios/i.test(navigator.userAgent || '');
const askedToInstall = () => {
  try { return new URLSearchParams(window.location.search).get('installa') === '1'; } catch { return false; }
};
const absolute = (path) => new URL(path, window.location.origin).href;

function Sheet({ prompt, onInstall, onClose, appUrl, fromInstalledApp }) {
  const [copied, setCopied] = useState(false);
  const ios = isIOS();
  const copy = async () => {
    try { await navigator.clipboard.writeText(appUrl); setCopied(true); } catch { setCopied(false); }
  };
  return ReactDOM.createPortal(
    <div className="poliedron-install__backdrop" onClick={onClose}>
      <div className="poliedron-install__help" role="dialog" aria-modal="true" aria-label="Installa Poliedron" onClick={(e) => e.stopPropagation()}>
        <img src="/poliedron-v2-180.png" width="64" height="64" alt="" />
        <strong>Poliedron sulla schermata Home</strong>
        {prompt ? (
          <>
            <p>Tocca il pulsante e conferma: l'icona Poliedron comparirà sulla schermata Home.</p>
            <button type="button" className="is-primary" onClick={onInstall}>Installa ora</button>
          </>
        ) : ios ? (
          fromInstalledApp || notSafariOnIOS() ? (
            <>
              <p>Su iPhone l'icona si aggiunge da <b>Safari</b>:</p>
              <ol>
                <li>Tocca <b>Apri in Safari</b> (oppure copia il link e incollalo in Safari).</li>
                <li>In Safari tocca <b>Condividi</b> (il quadrato con la freccia in su).</li>
                <li>Scegli <b>Aggiungi alla schermata Home</b> e poi <b>Aggiungi</b>.</li>
              </ol>
              <button type="button" className="is-primary" onClick={() => window.open(appUrl, '_blank')}>Apri in Safari</button>
              <button type="button" onClick={copy}>{copied ? 'Link copiato' : 'Copia link'}</button>
            </>
          ) : (
            <ol>
              <li>Tocca <b>Condividi</b> in basso (il quadrato con la freccia in su).</li>
              <li>Scorri e scegli <b>Aggiungi alla schermata Home</b>.</li>
              <li>Tocca <b>Aggiungi</b>: comparirà l'icona Poliedron.</li>
            </ol>
          )
        ) : (
          <ol>
            <li>Apri il menu del browser (⋮ in alto a destra).</li>
            <li>Scegli <b>Installa app</b> o <b>Aggiungi a schermata Home</b>.</li>
            <li>Conferma: comparirà l'icona Poliedron.</li>
          </ol>
        )}
        <button type="button" onClick={onClose}>Chiudi</button>
      </div>
    </div>,
    document.body,
  );
}

export default function PoliedronInstall({ href = null }) {
  const [prompt, setPrompt] = useState(() => deferredPrompt);
  const [help, setHelp] = useState(() => !href && askedToInstall());
  const [installed, setInstalled] = useState(() => !href && isStandalone());

  useEffect(() => {
    const onPrompt = (event) => setPrompt(event);
    const didInstall = () => { setInstalled(true); setPrompt(null); setHelp(false); deferredPrompt = null; };
    listeners.add(onPrompt);
    window.addEventListener('appinstalled', didInstall);
    if (!href && askedToInstall()) {
      try { window.history.replaceState(window.history.state, '', window.location.pathname); } catch { /* keep the URL */ }
    }
    return () => { listeners.delete(onPrompt); window.removeEventListener('appinstalled', didInstall); };
  }, [href]);

  if (installed) return null;
  const appUrl = absolute(href || '/poliedron/');
  const fromInstalledApp = isStandalone();

  const install = async () => {
    for (const menu of document.querySelectorAll('details[open]')) if (menu.contains(document.activeElement) || menu.querySelector('.poliedron-install')) menu.open = false;
    // From the studio app in a normal browser tab: open the Poliedron page,
    // which shows the right install steps at once.
    if (href && !fromInstalledApp) { window.location.assign(href); return; }
    if (prompt) {
      try { await prompt.prompt(); await prompt.userChoice; } catch { setHelp(true); }
      deferredPrompt = null;
      setPrompt(null);
      return;
    }
    setHelp(true);
  };

  return (
    <div className="poliedron-install">
      <button type="button" onClick={install} aria-haspopup="dialog">{href ? 'Installa Poliedron sul telefono' : 'Installa'}</button>
      {help && (
        <Sheet
          prompt={!href ? prompt : null}
          onInstall={async () => { await install(); setHelp(false); }}
          onClose={() => setHelp(false)}
          appUrl={href ? appUrl : absolute('/poliedron/')}
          fromInstalledApp={fromInstalledApp}
        />
      )}
    </div>
  );
}
