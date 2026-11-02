import { createContext, useContext, useEffect, useState } from 'react';
import { applicaAspetto, CHIAVE_ASPETTO, leggiAspetto, normalizzaAspetto, salvaAspetto, storageAspetto } from './lib/aspetto.js';

const ContestoAspetto = createContext(null);
export function AspettoProvider({ children }) {
  const [aspetto, setAspetto] = useState(() => leggiAspetto(storageAspetto()));
  useEffect(() => {
    applicaAspetto(document.documentElement, aspetto);
    salvaAspetto(storageAspetto(), aspetto);
  }, [aspetto]);
  useEffect(() => {
    const cambia = (e) => { if (e.key === CHIAVE_ASPETTO || e.key === null) setAspetto(normalizzaAspetto(e.newValue)); };
    window.addEventListener('storage', cambia);
    return () => window.removeEventListener('storage', cambia);
  }, []);
  return <ContestoAspetto.Provider value={{ aspetto, setAspetto }}>{children}</ContestoAspetto.Provider>;
}
export function CambioAspetto({ esteso = false }) {
  const { aspetto, setAspetto } = useContext(ContestoAspetto);
  const retro = aspetto === 'win95';
  if (esteso) return <div className="pp-aspetto-preferenze">
    <p>Due stili, le stesse funzioni. La scelta si ricorda su questo dispositivo.</p>
    <div className="pp-aspetto-scelte" role="group" aria-label="Aspetto dell’app">
      <button type="button" aria-pressed={!retro} onClick={() => setAspetto('moderno')}><span className="pp-campione-moderno" aria-hidden="true">P</span><strong>Moderno</strong><small>Pulito ed essenziale</small></button>
      <button type="button" aria-pressed={retro} onClick={() => setAspetto('win95')}><span className="pp-campione-retro" aria-hidden="true">95</span><strong>Windows 95</strong><small>Il fascino dei primi PC</small></button>
    </div>
  </div>;
  return <button type="button" className="pp-cambio-aspetto" aria-pressed={retro} aria-label={retro ? 'Torna allo stile moderno' : 'Attiva stile Windows 95'} title={retro ? 'Torna allo stile moderno' : 'Attiva stile Windows 95'} onClick={() => setAspetto(retro ? 'moderno' : 'win95')}>
    <svg width="20" height="18" viewBox="0 0 20 18" fill="none" aria-hidden="true"><path d="M2 1h16v11H2zM6 16h8M10 12v4" stroke="currentColor" strokeWidth="1.5" /><path d="M5 4h10v5H5z" fill="currentColor" opacity=".3" /></svg><span>{retro ? 'Moderno' : 'Win 95'}</span>
  </button>;
}
