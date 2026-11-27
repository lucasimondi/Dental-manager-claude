// Synthetic-only fixture (AGENDA-TASTI): the Studio phone dock on the shared Agenda and on another page.
import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import '../../src/styles/designTokens.css';
import '../../src/components/PremiumVisualSystem.css';
import PoliedronMobileDock from '../../src/components/poliedron/PoliedronMobileDock.jsx';
if (new URLSearchParams(location.search).get('tema') === 'dark') document.documentElement.dataset.theme = 'dark';
window.studioTest = { pagine: [] };
function App() {
  const [page, setPage] = useState(new URLSearchParams(location.search).get('pagina') || 'agenda');
  const vai = (p) => { window.studioTest.pagine.push(p); setPage(p); };
  return (
    <div style={{ minHeight: '100vh', background: 'var(--pol-bg, #f4f6fa)', padding: 16 }}>
      <h1 style={{ margin: 0 }}>Pagina: {page}</h1>
      <PoliedronMobileDock page={page} setPage={vai} open={false} onToggle={() => {}} panelId="p" positionLocked={false} archivio />
    </div>
  );
}
createRoot(document.getElementById('root')).render(<App />);
