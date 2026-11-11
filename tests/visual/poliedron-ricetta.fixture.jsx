import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import PoliedronPanel from '../../src/components/poliedron/PoliedronPanel.jsx';
import RicettaConRicerca from '../../src/components/RicettaConRicerca.jsx';
import { suggestedIdle } from '../../src/lib/poliedron/searchEngine.js';
import { ACTION_REGISTRY } from '../../src/lib/poliedron/actionRegistry.js';
import { NAVIGATION_INDEX } from '../../src/lib/poliedron/navigationIndex.js';
import '../../src/styles/designTokens.css';
import '../../src/components/PremiumVisualSystem.css';
// POLIEDRON-RICETTA — dati sintetici, nessun database.
const pazienti = [
  { id: 'p1', nome: 'Mario', cognome: 'Rossi' }, { id: 'p2', nome: 'Giulia', cognome: 'Bianchi' },
  { id: 'p3', nome: 'Anna', cognome: 'Verdi' }, { id: 'p4', nome: 'Paolo', cognome: 'Neri' },
];
const si = { nome: 'Studio di prova', vertical: 'dentistico', titolare: 'Dott. Prova' };
function Fixture() {
  const [patients, setPatients] = useState(pazienti);
  const [ricetta, setRicetta] = useState(null);
  const state = { intent: null, entities: {}, searchResults: suggestedIdle({ actions: ACTION_REGISTRY, navigationIndex: NAVIGATION_INDEX, context: {} }), suggestedActions: [] };
  const ctx = { openPrescription: (args) => setRicetta(args) };
  return (
    <>
      {!ricetta && <PoliedronPanel panelId="p" isMobile query="" onQueryChange={() => {}} state={state} highlightedIndex={0}
        onHighlightChange={() => {}} onSelectResult={(item) => item.data.navigate(ctx, item.data.entity)} onClose={() => {}} inputRef={{ current: null }} />}
      {ricetta && <RicettaConRicerca patients={patients} setPatients={setPatients} si={si} features={{}} onClose={() => setRicetta(null)} />}
    </>
  );
}
createRoot(document.getElementById('root')).render(<Fixture />);
