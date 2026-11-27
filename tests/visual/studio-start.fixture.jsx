// Synthetic-only fixture (STUDIO-TELEFONO): Studio phone bar (7 slots, colour icons) and full-screen Start.
import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import '../../src/styles/designTokens.css';
import '../../src/components/PremiumVisualSystem.css';
import PoliedronMobileDock from '../../src/components/poliedron/PoliedronMobileDock.jsx';
import StartStudio from '../../src/components/StartStudio.jsx';
import { EVENTO_START } from '../../src/lib/startStudio.js';
import { NAV } from '../../src/lib/utils.js';
if (new URLSearchParams(location.search).get('tema') === 'dark') document.documentElement.dataset.theme = 'dark';
const senzaArchivio = new URLSearchParams(location.search).get('archivio') === 'no';
window.studioTest = { pagine: [] };
function App() {
  const [page, setPage] = useState(new URLSearchParams(location.search).get('pagina') || 'studio');
  const [start, setStart] = useState(false);
  useEffect(() => { const f = () => setStart((v) => !v); window.addEventListener(EVENTO_START, f); return () => window.removeEventListener(EVENTO_START, f); }, []);
  const vai = (p) => { window.studioTest.pagine.push(p); setPage(p); };
  return (
    <div style={{ minHeight: '100vh', background: 'var(--pol-bg, #f4f6fa)', padding: 16 }}>
      <h1 style={{ margin: 0 }}>Pagina: {page}</h1>
      <PoliedronMobileDock page={page} setPage={vai} open={false} onToggle={() => window.studioTest.pagine.push('poliedron-orb')} panelId="p" positionLocked={false} archivio={!senzaArchivio} />
      {start && <StartStudio nav={NAV.filter((n) => n.id !== 'agenteai')} onApri={vai} onChiudi={() => setStart(false)} />}
    </div>
  );
}
createRoot(document.getElementById('root')).render(<App />);
