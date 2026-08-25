import React, { useMemo, useState } from 'react';
import { Ic } from './ui';
import { fmt, fmtD } from '../lib/utils';
import { PATIENT_WORKSPACE_ACTIONS } from '../lib/patientWorkspaceActionRegistry';
import './PatientWorkspaceV2.css';

const yearsOld = (date) => {
  if (!date) return null;
  const born = new Date(`${date}T12:00:00`);
  if (Number.isNaN(born.getTime())) return null;
  const now = new Date();
  let years = now.getFullYear() - born.getFullYear();
  if (now < new Date(now.getFullYear(), born.getMonth(), born.getDate())) years -= 1;
  return years;
};

const samePatient = (row, id) => String(row?.pazienteId ?? row?.paziente_id ?? '') === String(id);
const safeItems = (plan) => Array.isArray(plan?.voci) ? plan.voci : [];

export function buildPatientWorkspaceV2Model({ patient, plans = [], payments = [], appointments = [] }) {
  const patientPlans = (Array.isArray(plans) ? plans : []).filter((row) => samePatient(row, patient?.id));
  const items = patientPlans.flatMap((plan) => safeItems(plan).map((item, index) => ({ ...item, planId: plan.id, key: `${plan.id}-${index}` })));
  const completed = items.filter((item) => item.eseguita === true);
  const pending = items.filter((item) => item.eseguita !== true);
  const total = items.reduce((sum, item) => sum + (Number(item.prezzo) || 0), 0);
  const paidRows = (Array.isArray(payments) ? payments : []).filter((row) => samePatient(row, patient?.id));
  const paid = paidRows.reduce((sum, row) => sum + (Number(row.importo) || 0), 0);
  const visits = (Array.isArray(appointments) ? appointments : []).filter((row) => samePatient(row, patient?.id) && row.stato !== 'annullato');
  const sortedVisits = [...visits].sort((a, b) => `${b.data || ''}${b.ora || ''}`.localeCompare(`${a.data || ''}${a.ora || ''}`));
  const today = new Date().toISOString().slice(0, 10);
  const lastVisit = sortedVisits.find((row) => (row.data || '') <= today) || null;
  const nextVisit = [...visits].filter((row) => (row.data || '') >= today).sort((a, b) => `${a.data || ''}${a.ora || ''}`.localeCompare(`${b.data || ''}${b.ora || ''}`))[0] || null;
  const activePlans = patientPlans.filter((plan) => !['concluso', 'rifiutato'].includes(plan.stato));
  const notes = Array.isArray(patient?.annotazioni) ? patient.annotazioni.filter((note) => note?.testo) : [];
  const risks = [patient?.note, ...(Array.isArray(patient?.allergie) ? patient.allergie : [])].filter(Boolean);
  return {
    patientPlans, items, completed, pending, paidRows, total, paid,
    outstanding: Math.max(0, total - paid), lastVisit, nextVisit, activePlans, notes, risks,
    progress: items.length ? Math.round((completed.length / items.length) * 100) : null,
  };
}

function ActionButton({ icon, children, onClick, href }) {
  const props = href ? { as: 'a', href } : { as: 'button', onClick };
  const Tag = props.as;
  return <Tag className="pw2-action" href={props.href} onClick={props.onClick}><Ic n={icon} s={15} c="currentColor" />{children}</Tag>;
}

function DetailDrawer({ title, onClose, children }) {
  return <div className="pw2-drawer-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
    <aside className="pw2-drawer" role="dialog" aria-modal="true" aria-label={title}>
      <div className="pw2-drawer-head"><div><small>Dettaglio paziente</small><h2>{title}</h2></div><button onClick={onClose} aria-label="Chiudi"><Ic n="x" s={16} c="currentColor" /></button></div>
      <div className="pw2-drawer-body">{children}</div>
    </aside>
  </div>;
}

const QUICK_SERVICES = ['Corona zirconia', 'Implantologia', 'Igiene professionale', 'Otturazione composito', 'Controllo clinico'];
const PLAN_COMPOSER_ITEMS = [
  { id: 'endo-26', treatment: 'Endodonzia', site: '26', price: 420 },
  { id: 'rebuild-26', treatment: 'Ricostruzione', site: '26', price: 190 },
  { id: 'crown-26', treatment: 'Corona zirconia', site: '26', price: 720 },
  { id: 'hygiene', treatment: 'Igiene', site: 'Generale', price: 110 },
];

function QuickCreateDrawer({ kind, plans, onClose, onChangeKind }) {
  const [query, setQuery] = useState('');
  const [siteType, setSiteType] = useState('Nessuna');
  const [planReady, setPlanReady] = useState(false);
  const [quoteReady, setQuoteReady] = useState(false);
  const [selectedQuoteItems, setSelectedQuoteItems] = useState(PLAN_COMPOSER_ITEMS.map((item) => item.id));
  const [shareMessage, setShareMessage] = useState('Situazione attuale:\n• 2 trattamenti programmati\n• 1 completato\n• prossimo step: corona elemento 26\n• controllo consigliato: ottobre');
  const titles = { service: 'Aggiungi prestazione', plan: 'Nuovo piano clinico', quote: 'Nuovo preventivo', prescription: 'Nuova ricetta', consent: 'Nuovo consenso', share: 'Condividi situazione clinica', polyedron: 'Prova con Polyedron', odontogram: 'Odontogramma' };
  const matches = QUICK_SERVICES.filter((item) => item.toLowerCase().includes(query.toLowerCase())).slice(0, 4);
  const quoteTotal = PLAN_COMPOSER_ITEMS.filter((item) => selectedQuoteItems.includes(item.id)).reduce((sum, item) => sum + item.price, 0);
  const action = (id) => PATIENT_WORKSPACE_ACTIONS[id];
  return <DetailDrawer title={titles[kind]} onClose={onClose}>
    {kind === 'service' && <form className="pw2-quick-form" onSubmit={(event) => event.preventDefault()}>
      <label className="pw2-search-field"><span>Prestazione</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="🔍 Cerca prestazione o scrivi liberamente…" /></label>
      <div className="pw2-search-results" aria-label="Risultati prestazioni">{matches.map((item) => <button type="button" key={item} onClick={() => setQuery(item)}><span>{item}</span><small>Seleziona</small></button>)}</div>
      <fieldset><legend>Sede</legend><div className="pw2-choice-grid">{['Dente', 'Quadrante', 'Arcata', 'Generale', 'Nessuna'].map((item) => <button type="button" className={siteType === item ? 'is-active' : ''} key={item} onClick={() => setSiteType(item)}>{item}</button>)}</div></fieldset>
      {siteType === 'Dente' && <label><span>Elemento dentale</span><input inputMode="numeric" placeholder="Es. 26" maxLength={2} /></label>}
      <div className="pw2-form-grid"><label><span>Stato</span><select defaultValue="Proposta"><option>Proposta</option><option>Pianificata</option><option>In corso</option><option>Eseguita</option></select></label><label><span>Prezzo</span><input inputMode="decimal" placeholder="€ 0,00" /></label></div>
      <label><span>Piano associato</span><select defaultValue=""><option value="">Nessun piano</option>{plans.map((plan) => <option key={plan.id}>{plan.titolo || 'Piano clinico'}</option>)}</select></label>
      <button className="pw2-prototype-submit" type="button">Anteprima prestazione <small>Prototype · nessun salvataggio</small></button>
    </form>}
    {kind === 'plan' && <div className="pw2-concept-flow">{!planReady ? <><span className="pw2-concept-icon"><Ic n="plan" s={22} c="currentColor" /></span><h3>Piano clinico</h3><p>Contiene ciò che intendiamo fare al paziente. Il preventivo sarà il successivo passaggio economico.</p><div className="pw2-workflow-items">{PLAN_COMPOSER_ITEMS.map((item) => <div key={item.id}><span>{item.site}</span><strong>{item.treatment}</strong><small>{fmt(item.price)}</small></div>)}</div><button data-action={action('CREATE_CLINICAL_PLAN').id} className="pw2-prototype-submit" type="button" onClick={() => setPlanReady(true)}>Conferma piano clinico <small>Anteprima prima della creazione</small></button></> : <div className="pw2-ready-state"><span>✓</span><small>Prossimo step consigliato</small><h3>Piano clinico pronto</h3><p>4 prestazioni · {fmt(1440)}</p><button data-action={action('CREATE_QUOTE').id} className="pw2-prototype-submit" type="button" onClick={() => onChangeKind('quote')}>Genera preventivo →</button><button type="button" onClick={() => setPlanReady(false)}>Modifica piano</button></div>}</div>}
    {kind === 'quote' && <div className="pw2-concept-flow">{!quoteReady ? <><span className="pw2-concept-icon"><Ic n="eur" s={22} c="currentColor" /></span><h3>Preventivo dal piano clinico</h3><p>Seleziona tutte o solo alcune prestazioni. Il totale si aggiorna senza creare documenti reali.</p><div className="pw2-quote-composer">{PLAN_COMPOSER_ITEMS.map((item) => <label key={item.id}><input type="checkbox" checked={selectedQuoteItems.includes(item.id)} onChange={() => setSelectedQuoteItems((current) => current.includes(item.id) ? current.filter((id) => id !== item.id) : [...current, item.id])} /><span><strong>{item.treatment}</strong><small>{item.site}</small></span><b>{fmt(item.price)}</b></label>)}</div><label className="pw2-partial"><input type="checkbox" checked={selectedQuoteItems.length < PLAN_COMPOSER_ITEMS.length} readOnly /> Preventivo parziale</label><div className="pw2-quote-total"><span>Totale anteprima</span><strong>{fmt(quoteTotal)}</strong></div><button data-action={action('CREATE_QUOTE').id} className="pw2-prototype-submit" type="button" onClick={() => setQuoteReady(true)}>Crea preventivo <small>Conferma richiesta · nessun salvataggio</small></button></> : <div className="pw2-ready-state"><span>✓</span><small>Pronto per condivisione</small><h3>Preventivo pronto — {fmt(quoteTotal)}</h3><p>{selectedQuoteItems.length} prestazioni incluse</p><div className="pw2-document-actions"><button data-action={action('SEND_QUOTE').id}>WhatsApp</button><button>PDF</button><button data-action={action('PRINT_QUOTE').id}>Stampa</button><button onClick={() => setQuoteReady(false)}>Modifica</button></div><em>Ogni invio o documento definitivo richiederà conferma.</em></div>}</div>}
    {kind === 'prescription' && <form className="pw2-quick-form" onSubmit={(event) => event.preventDefault()}>{['Farmaco', 'Dosaggio', 'Posologia', 'Durata', 'Note'].map((field) => <label key={field}><span>{field}</span><input placeholder={field === 'Farmaco' ? 'Cerca o inserisci farmaco…' : `Inserisci ${field.toLowerCase()}…`} /></label>)}<div className="pw2-document-actions"><button data-action={action('CREATE_PRESCRIPTION').id}>Genera</button><button>Stampa</button><button>PDF</button></div><p className="pw2-confirm-note">Anteprima e conferma obbligatorie prima della generazione definitiva.</p></form>}
    {kind === 'consent' && <div className="pw2-concept-flow"><p>Scegli il documento da preparare. La firma paziente non è attiva in questo prototipo.</p><div className="pw2-consent-grid">{['Trattamento odontoiatrico', 'Implantologia', 'Chirurgia', 'Ortodonzia', 'Privacy / foto', 'Altro'].map((type) => <label key={type}><input type="radio" name="consent" /> {type}</label>)}</div><button data-action={action('CREATE_CONSENT').id} className="pw2-prototype-submit">Prepara consenso → <small>Firma e Storage non attivi</small></button></div>}
    {kind === 'share' && <div className="pw2-concept-flow"><span className="pw2-concept-icon"><Ic n="wa" s={22} c="currentColor" /></span><h3>Anteprima messaggio</h3><textarea className="pw2-share-message" value={shareMessage} onChange={(event) => setShareMessage(event.target.value)} /><div className="pw2-document-actions"><button>Modifica</button><button onClick={() => navigator.clipboard?.writeText(shareMessage)}>Copia</button><button data-action={action('SEND_CLINICAL_SUMMARY').id}>Invia WhatsApp</button></div><p className="pw2-confirm-note">Invio disattivato · sarà richiesta conferma esplicita.</p></div>}
    {kind === 'polyedron' && <div className="pw2-polyedron-flow"><div className="pw2-polyedron-command">“Per Marco Bianchi aggiungi endodonzia, ricostruzione e corona sul 26, igiene generale, crea il piano clinico e prepara il preventivo.”</div><small>Interpretazione tramite lo stesso registry della UI</small><ol><li>Crea piano clinico</li><li>Aggiunge Endodonzia — 26</li><li>Aggiunge Ricostruzione — 26</li><li>Aggiunge Corona — 26</li><li>Aggiunge Igiene — Generale</li><li>Prepara preventivo</li></ol><div className="pw2-polyedron-preview"><strong>Anteprima</strong><span>Nessuna azione è stata eseguita.</span></div><div className="pw2-document-actions"><button>Conferma</button><button>Modifica</button><button>Annulla</button></div></div>}
    {kind === 'odontogram' && <div className="pw2-odontogram-placeholder"><div className="pw2-teeth" aria-hidden="true">{Array.from({ length: 12 }, (_, i) => <span key={i} />)}</div><h3>Modulo clinico in preparazione</h3><p>L’odontogramma sarà collegato in una fase dedicata, con modello clinico e persistenza autorevoli.</p></div>}
  </DetailDrawer>;
}

export default function PatientWorkspaceV2({ patient, plans, payments, appointments, onClose = () => {}, onEdit = () => {} }) {
  const model = useMemo(() => buildPatientWorkspaceV2Model({ patient, plans, payments, appointments }), [patient, plans, payments, appointments]);
  const [drawer, setDrawer] = useState(null);
  const [quickCreate, setQuickCreate] = useState(null);
  const [tab, setTab] = useState('info');
  const age = yearsOld(patient?.dataNascita);
  const kpis = [
    { id: 'plans', label: 'Piani', value: model.patientPlans.length, icon: 'plan' },
    { id: 'done', label: 'Eseguito', value: fmt(model.completed.reduce((sum, item) => sum + (Number(item.prezzo) || 0), 0)), icon: 'okc' },
    { id: 'paid', label: 'Pagato', value: fmt(model.paid), icon: 'eur' },
    { id: 'outstanding', label: 'Da pagare', value: fmt(model.outstanding), icon: 'clk' },
  ];
  const clinicalRows = model.items.map((item) => ({
    ...item,
    site: item.sede || item.dente || 'Generale',
    status: item.eseguita ? 'Eseguita' : item.stato === 'in_corso' ? 'In corso' : item.statoLabel || 'Da eseguire',
  }));
  const inProgress = clinicalRows.filter((item) => item.status === 'In corso').length;
  const toDo = clinicalRows.filter((item) => !['In corso', 'Eseguita'].includes(item.status)).length;
  const tabs = [['info', 'Info'], ['piani', 'Piani'], ['impl', 'Impianti'], ['foto', 'Foto'], ['doc', 'Documenti'], ['app', 'Agenda']];

  return <div className="pw2-shell">
    <header className="pw2-hero">
      <div className="pw2-hero-glow" />
      <div className="pw2-hero-top">
        <button className="pw2-back" onClick={onClose} aria-label="Torna indietro"><Ic n="back" s={20} c="currentColor" /></button>
        <div className="pw2-identity">
          <span className="pw2-eyebrow">Scheda Paziente 2.0 · Preview</span>
          <h1>{patient?.nome} {patient?.cognome}</h1>
          <div className="pw2-identity-meta">
            {patient?.sesso && <span>{patient.sesso}</span>}
            {age != null && <span>{age} anni</span>}
            {patient?.dataNascita && <span>Nato il {fmtD(patient.dataNascita)}</span>}
            {patient?.telefono && <span>{patient.telefono}</span>}
          </div>
          {patient?.cf && <div className="pw2-cf"><span>CF {patient.cf}</span><button onClick={() => navigator.clipboard?.writeText(patient.cf)} aria-label="Copia codice fiscale"><Ic n="clip" s={13} c="currentColor" /></button></div>}
        </div>
        <div className="pw2-actions">
          {patient?.telefono && <ActionButton icon="ph" href={`tel:${patient.telefono}`}>Chiama</ActionButton>}
          {patient?.telefono && <ActionButton icon="wa" href={`https://wa.me/39${String(patient.telefono).replace(/\D/g, '')}`}>WhatsApp</ActionButton>}
          <ActionButton icon="edit" onClick={onEdit}>Modifica</ActionButton>
        </div>
      </div>
    </header>

    <section className="pw2-kpis" aria-label="Indicatori paziente">
      {kpis.map((kpi) => <button key={kpi.id} onClick={() => setDrawer(kpi.id)}><span className="pw2-kpi-icon"><Ic n={kpi.icon} s={17} c="currentColor" /></span><span><small>{kpi.label}</small><strong>{kpi.value}</strong></span><span aria-hidden="true">›</span></button>)}
    </section>

    <main className="pw2-main">
      <section className="pw2-action-bar" aria-label="Azioni paziente"><div><small>Azioni paziente</small><strong>Crea rapidamente</strong></div><div className="pw2-action-buttons"><button data-action="ADD_TREATMENT" onClick={() => setQuickCreate('service')}><span>+</span> Prestazione</button><button data-action="CREATE_CLINICAL_PLAN" onClick={() => setQuickCreate('plan')}><span>+</span> Piano clinico</button><button data-action="CREATE_QUOTE" onClick={() => setQuickCreate('quote')}><span>+</span> Preventivo</button><button data-action="CREATE_PRESCRIPTION" onClick={() => setQuickCreate('prescription')}>Ricetta</button><button data-action="CREATE_CONSENT" onClick={() => setQuickCreate('consent')}>Consenso</button></div></section>
      <button className="pw2-micro-profile" onClick={() => setDrawer('profile')}>
        <span>{[age != null ? `${age} anni` : null, patient?.comune, model.lastVisit ? `Ultima visita ${fmtD(model.lastVisit.data)}` : null].filter(Boolean).join('  ·  ') || 'Informazioni anagrafiche'}</span>
        <strong>Anagrafica <span aria-hidden="true">›</span></strong>
      </button>

      <button className={`pw2-risk ${model.risks.length ? 'is-alert' : 'is-clear'}`} onClick={() => setDrawer('risks')}>
        <span className="pw2-risk-bell"><Ic n="bell" s={16} c="currentColor" /></span>
        <span><strong>{model.risks.length ? 'Anamnesi da verificare' : 'Nessuna criticità nota'}</strong><small>{model.risks.length ? `${model.risks.length} segnalazioni disponibili` : 'Il profilo non riporta rischi o allergie'}</small></span>
        <span aria-hidden="true">›</span>
      </button>

      <section className="pw2-clinical">
        <div className="pw2-section-heading"><div><span>Quadro paziente</span><h2>Situazione clinica</h2><p>{toDo} da eseguire · {model.completed.length} eseguite · {inProgress} in corso</p></div><div className="pw2-clinical-links"><button data-action="SEND_CLINICAL_SUMMARY" onClick={() => setQuickCreate('share')}>Condividi ▾</button><button onClick={() => setDrawer('plans')}>Apri piano clinico <span aria-hidden="true">›</span></button><button onClick={() => setQuickCreate('odontogram')}>🦷 Odontogramma <span aria-hidden="true">›</span></button></div></div>
        {clinicalRows.length ? <div className="pw2-treatment-list">{clinicalRows.slice(0, 5).map((item) => <article key={item.key}><span className="pw2-treatment-site">{item.site}</span><div><strong>{item.prestazione || 'Prestazione clinica'}</strong><small>{item.note || item.descrizione || 'Prestazione del piano clinico'}</small></div><span className={`pw2-treatment-status status-${item.status.toLowerCase().replaceAll(' ', '-')}`}>{item.status}</span></article>)}</div> : <div className="pw2-empty"><Ic n="pulse" s={22} c="currentColor" /><div><strong>Nessuna prestazione clinica disponibile</strong><span>La sezione appare solo quando esistono dati pertinenti.</span></div></div>}
      </section>

      <nav className="pw2-tabs" aria-label="Workspace paziente">{tabs.map(([id, label]) => <button key={id} className={tab === id ? 'is-active' : ''} onClick={() => setTab(id)}>{label}</button>)}</nav>
      <section className="pw2-workspace"><div><span>Workspace operativo</span><h3>{tabs.find(([id]) => id === tab)?.[1]}</h3><p>Le azioni UI e la futura orchestrazione Polyedron condividono lo stesso contratto canonico, con anteprima e conferma.</p></div><button className="pw2-polyedron-try" onClick={() => setQuickCreate('polyedron')}>Prova con Polyedron</button></section>
    </main>

    {drawer && <DetailDrawer title={{ plans: 'Piani di cura', done: 'Prestazioni eseguite', paid: 'Pagamenti registrati', outstanding: 'Residuo da pagare', profile: 'Anagrafica', risks: 'Anamnesi e rischi', clinical: 'Situazione clinica' }[drawer]} onClose={() => setDrawer(null)}>
      {drawer === 'profile' && <dl className="pw2-detail-list"><div><dt>Nome completo</dt><dd>{patient?.nome} {patient?.cognome}</dd></div><div><dt>Data di nascita</dt><dd>{fmtD(patient?.dataNascita)}</dd></div><div><dt>Comune</dt><dd>{patient?.comune || 'Non disponibile'}</dd></div><div><dt>Indirizzo</dt><dd>{patient?.indirizzo || 'Non disponibile'}</dd></div><div><dt>Email</dt><dd>{patient?.email || 'Non disponibile'}</dd></div></dl>}
      {drawer === 'risks' && (model.risks.length ? model.risks.map((risk, i) => <div className="pw2-detail-row" key={i}>{String(risk)}</div>) : <div className="pw2-empty">Nessuna criticità nota.</div>)}
      {drawer === 'plans' && (model.patientPlans.length ? model.patientPlans.map((plan) => <div className="pw2-detail-row" key={plan.id}><strong>{plan.titolo || 'Piano di cura'}</strong><span>{safeItems(plan).length} prestazioni</span></div>) : <div className="pw2-empty">Nessun piano disponibile.</div>)}
      {drawer === 'done' && (model.completed.length ? model.completed.map((item) => <div className="pw2-detail-row" key={item.key}><strong>{item.prestazione}</strong><span>{fmt(Number(item.prezzo) || 0)}</span></div>) : <div className="pw2-empty">Nessuna prestazione eseguita.</div>)}
      {drawer === 'paid' && (model.paidRows.length ? model.paidRows.map((row) => <div className="pw2-detail-row" key={row.id}><strong>{fmt(Number(row.importo) || 0)}</strong><span>{fmtD(row.data)}</span></div>) : <div className="pw2-empty">Nessun pagamento registrato.</div>)}
      {drawer === 'outstanding' && <div className="pw2-balance"><small>Totale piani</small><strong>{fmt(model.total)}</strong><small>Pagato</small><strong>{fmt(model.paid)}</strong><small>Residuo</small><strong>{fmt(model.outstanding)}</strong></div>}
    </DetailDrawer>}
    {quickCreate && <QuickCreateDrawer kind={quickCreate} plans={model.patientPlans} onClose={() => setQuickCreate(null)} onChangeKind={setQuickCreate} />}
  </div>;
}
