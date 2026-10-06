import React, { useEffect, useState } from 'react';

// `href`: from the studio app, "Installa" opens the dedicated Poliedron app
// (its own icon and manifest), which shows the install steps right away.
const askedToInstall = () => {
  try { return new URLSearchParams(window.location.search).get('installa') === '1'; } catch { return false; }
};

export default function PoliedronInstall({ href = null }) {
  const [prompt, setPrompt] = useState(null);
  const [help, setHelp] = useState(() => !href && askedToInstall());
  const [installed, setInstalled] = useState(() => window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true);
  useEffect(() => {
    const media = window.matchMedia('(display-mode: standalone)');
    const beforeInstall = (event) => { event.preventDefault(); setPrompt(event); };
    const didInstall = () => { setInstalled(true); setPrompt(null); setHelp(false); };
    const changed = () => setInstalled(media.matches || window.navigator.standalone === true);
    window.addEventListener('beforeinstallprompt', beforeInstall);
    window.addEventListener('appinstalled', didInstall);
    media.addEventListener('change', changed);
    return () => {
      window.removeEventListener('beforeinstallprompt', beforeInstall);
      window.removeEventListener('appinstalled', didInstall);
      media.removeEventListener('change', changed);
    };
  }, []);
  useEffect(() => {
    if (href || !askedToInstall()) return;
    try { window.history.replaceState(window.history.state, '', window.location.pathname); } catch { /* keep the URL */ }
  }, [href]);
  if (installed && !href) return null;
  const install = async () => {
    if (href) { window.location.assign(href); return; }
    if (!prompt) { setHelp((current) => !current); return; }
    try { await prompt.prompt(); await prompt.userChoice; }
    catch { setHelp(true); }
    finally { setPrompt(null); }
  };
  return (
    <div className="poliedron-install">
      <button type="button" onClick={install} aria-expanded={href ? undefined : help}>{href ? 'Installa Poliedron sul telefono' : 'Installa'}</button>
      {help && <div className="poliedron-install__help" role="status">
        <strong>Poliedron sulla schermata Home</strong>
        <p>Su iPhone: apri in Safari, tocca Condividi, poi “Aggiungi alla schermata Home”. Su Android: apri il menu del browser e scegli “Installa app” o “Aggiungi a schermata Home”.</p>
        <button type="button" onClick={() => setHelp(false)}>Chiudi</button>
      </div>}
    </div>
  );
}
