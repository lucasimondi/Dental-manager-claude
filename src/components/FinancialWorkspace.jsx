import React from 'react';
import Incassi from './Incassi.jsx';
import Pagamenti from './Pagamenti.jsx';
import { PageHeader } from './ui';

export default function FinancialWorkspace(props) {
  return <div className="financial-workspace">
    <PageHeader icon="pay" title="Incassi e pagamenti" subtitle="Saldi aperti, riscossioni e movimenti in un unico spazio" />
    <section className="financial-workspace__section" aria-labelledby="financial-open-title">
      <div className="financial-workspace__section-title"><span id="financial-open-title">Situazione e saldi</span><small>Da incassare, pagamenti da assegnare e lettura estratto conto</small></div>
      <Incassi {...props} embedded />
    </section>
    <section className="financial-workspace__section" aria-labelledby="financial-movements-title">
      <div className="financial-workspace__section-title"><span id="financial-movements-title">Movimenti registrati</span><small>Pagamenti dello studio e collaborazioni</small></div>
      <Pagamenti {...props} embedded />
    </section>
  </div>;
}
