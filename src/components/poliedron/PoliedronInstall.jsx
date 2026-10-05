import React, { useEffect, useState } from 'react';

export default function PoliedronInstall() {
  const [prompt, setPrompt] = useState(null);
  const [help, setHelp] = useState(false);
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
  if (installed) return null;
  const install = async () => {
    if (!prompt) { setHelp((current) => !current); return; }
    try { await prompt.prompt(); await prompt.userChoice; }
    catch { setHelp(true); }
    finally { setPrompt(null); }
  };
  return (
    <div className="poliedron-install">
      <button type="button" onClick={install} aria-expanded={help}>Installa</button>
      {help && <div className="poliedron-install__help" role="status">
        <strong>Poliedron sulla schermata Home</strong>
        <p>Su iPhone: apri in Safari, tocca Condividi, poi “Aggiungi alla schermata Home”. Su Android: apri il menu del browser e scegli “Installa app” o “Aggiungi a schermata Home”.</p>
        <button type="button" onClick={() => setHelp(false)}>Chiudi</button>
      </div>}
    </div>
  );
}
