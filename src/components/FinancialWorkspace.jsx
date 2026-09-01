import React, { useState } from 'react';
import Incassi from './Incassi.jsx';
import Pagamenti from './Pagamenti.jsx';
import { Modal, PageHeader } from './ui';

// Product Owner follow-up: Incassato and Da incassare must live in ONE
// section, both clickable — Incassi.jsx now owns that unified view itself
// (KPI tiles double as the switcher). This wrapper's only remaining job is
// the page chrome and the deep-link ("+ Inserisci incasso"/Home's
// "Pagamento" quick action) plus the separate, distinct "Collaborazioni
// esterne" surface (non-patient income), reachable from here but no longer
// competing for the primary "Incassi" tab.
export default function FinancialWorkspace(props) {
  const [openNew, setOpenNew] = useState(Boolean(props.autoOpenNew));
  const [collabOpen, setCollabOpen] = useState(false);

  return <div className="financial-workspace">
    <PageHeader icon="pay" title="Incassi" subtitle="Controlla i saldi e registra gli incassi dello studio" actions={
      <button type="button" className="financial-workspace__new financial-workspace__new--sec" onClick={() => setCollabOpen(true)}>Collaborazioni esterne</button>
    } />
    <Incassi {...props} embedded autoOpenNew={openNew || props.autoOpenNew} onAutoOpenNewHandled={() => { setOpenNew(false); props.onAutoOpenNewHandled?.(); }} />
    {collabOpen && (
      <Modal title="Collaborazioni esterne" icon="brief" onClose={() => setCollabOpen(false)} wide mobileVariant="sheet">
        <Pagamenti {...props} embedded soloEsterno />
      </Modal>
    )}
  </div>;
}
