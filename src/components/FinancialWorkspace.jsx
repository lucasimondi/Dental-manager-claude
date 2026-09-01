import React, { useState } from 'react';
import Incassi from './Incassi.jsx';
import Pagamenti from './Pagamenti.jsx';
import { PageHeader } from './ui';

export default function FinancialWorkspace(props) {
  const [tab, setTab] = useState(props.autoOpenNew ? 'incassi' : 'overview');
  const [openNew, setOpenNew] = useState(Boolean(props.autoOpenNew));
  const openIncasso = () => { setTab('incassi'); setOpenNew(true); };

  return <div className="financial-workspace">
    <PageHeader icon="pay" title="Incassi" subtitle="Controlla i saldi e registra gli incassi dello studio" actions={<button type="button" className="financial-workspace__new" onClick={openIncasso}>+ Inserisci incasso</button>} />
    <nav className="financial-workspace__tabs" aria-label="Sezioni incassi">
      <button type="button" className={tab === 'overview' ? 'is-active' : ''} onClick={() => setTab('overview')}>Da incassare</button>
      <button type="button" className={tab === 'incassi' ? 'is-active' : ''} onClick={() => setTab('incassi')}>Incassi</button>
    </nav>
    {tab === 'overview' && <section className="financial-workspace__section" aria-labelledby="financial-open-title">
      <div className="financial-workspace__section-title"><span id="financial-open-title">Situazione e saldi</span><small>Da incassare, pagamenti da assegnare e lettura estratto conto</small></div>
      <Incassi {...props} embedded />
    </section>}
    {tab === 'incassi' && <section className="financial-workspace__section" aria-labelledby="financial-movements-title">
      <div className="financial-workspace__section-title"><span id="financial-movements-title">Incassi registrati</span><small>Incassi dello studio e collaborazioni</small></div>
      <Pagamenti {...props} embedded autoOpenNew={openNew || props.autoOpenNew} onAutoOpenNewHandled={() => { setOpenNew(false); props.onAutoOpenNewHandled?.(); }} />
    </section>}
  </div>;
}
