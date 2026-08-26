import React, { useMemo, useState } from 'react';
import { Ic } from './ui';
import { fmt, fmtD } from '../lib/utils';
import { PATIENT_WORKSPACE_ACTIONS } from '../lib/patientWorkspaceActionRegistry';
import { createPatientWorkspaceContext } from '../lib/patientWorkspaceDomain';
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
const addMonthsISO = (iso, months) => {
  const date = new Date(`${iso || '2026-09-15'}T12:00:00`);
  date.setMonth(date.getMonth() + months);
  return date.toISOString().slice(0, 10);
};

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
    <section className="pw2-drawer" role="dialog" aria-modal="true" aria-label={title}>
      <div className="pw2-drawer-head"><div><small>Dettaglio paziente</small><h2>{title}</h2></div><button onClick={onClose} aria-label="Chiudi"><Ic n="x" s={16} c="currentColor" /></button></div>
      <div className="pw2-drawer-body">{children}</div>
    </section>
  </div>;
}

const QUICK_SERVICES = ['Corona zirconia', 'Implantologia', 'Igiene professionale', 'Otturazione composito', 'Controllo clinico'];
const ODONTOGRAM_QUADRANTS = [
  { id: 'sup-dx', label: 'Superiore destro', teeth: ['18', '16', '14', '12', '11'] },
  { id: 'sup-sx', label: 'Superiore sinistro', teeth: ['21', '22', '24', '26', '28'] },
  { id: 'inf-dx', label: 'Inferiore destro', teeth: ['48', '46', '44', '42', '41'] },
  { id: 'inf-sx', label: 'Inferiore sinistro', teeth: ['31', '32', '34', '36', '38'] },
];
const PLAN_COMPOSER_ITEMS = [
  { id: 'endo-26', treatment: 'Endodonzia', site: '26', price: 420 },
  { id: 'rebuild-36', treatment: 'Ricostruzione', site: 'Dente 36', price: 190 },
  { id: 'crown-arch', treatment: 'Corona zirconia', site: 'Arcata superiore', price: 720 },
  { id: 'check-quadrant', treatment: 'Controllo parodontale', site: 'Quadrante 3', price: 90 },
  { id: 'hygiene', treatment: 'Igiene', site: 'Generale', price: 110 },
];

const statusTone = (status) => status === 'Eseguita' ? 'done' : status === 'In corso' ? 'progress' : status === 'Richiamo da programmare' ? 'recall' : 'todo';
const contextualActions = (status) => status === 'Eseguita'
  ? ['Crea follow-up', 'Crea richiamo', 'Apri dettaglio', 'Modifica nota']
  : status === 'In corso'
    ? ['Programma', 'Segna eseguita', 'Crea follow-up', 'Modifica', 'Annulla']
    : status === 'Richiamo da programmare'
      ? ['Programma', 'Crea follow-up', 'Modifica', 'Annulla']
      : ['Programma', 'Segna in corso', 'Segna eseguita', 'Crea richiamo', 'Modifica', 'Annulla'];
const primaryActions = (status) => status === 'Eseguita'
  ? ['Crea follow-up', 'Crea richiamo']
  : status === 'In corso'
    ? ['Segna eseguita', 'Programma']
    : status === 'Richiamo da programmare'
      ? ['Programma', 'Modifica']
      : ['Segna eseguita', 'Segna in corso'];

function DiscountEditor({ type, value, onType, onValue, subtotal, discount, total }) {
  return <div className="pw2-discount"><strong>Sconto</strong><div>{['Nessuno', '%', '€'].map((option) => <button type="button" className={type === option ? 'is-active' : ''} key={option} onClick={() => onType(option)}>{option}</button>)}</div>{type !== 'Nessuno' && <input value={value} inputMode="decimal" onChange={(event) => onValue(event.target.value)} aria-label="Valore sconto" />}<dl><div><dt>Subtotale</dt><dd>{fmt(subtotal)}</dd></div><div><dt>Sconto</dt><dd>− {fmt(discount)}</dd></div><div><dt>Totale finale</dt><dd>{fmt(total)}</dd></div></dl></div>;
}

const ECON_TONE = { Preventivato: 'pw2-econ-blue', Accettato: 'pw2-econ-violet', Eseguito: 'pw2-econ-amber', Pagato: 'pw2-econ-green', Residuo: 'pw2-econ-red' };
const INSTALLMENT_TONE = { PAID: 'pw2-econ-green', OVERDUE: 'pw2-econ-red', PENDING: 'pw2-econ-blue' };

function EconomyDetail({ onAction }) {
  const values = [['Preventivato',4800],['Accettato',4200],['Eseguito',2100],['Pagato',1700],['Residuo',400]];
  return <div className="pw2-economy-detail"><div className="pw2-economy-grid">{values.map(([label,value]) => <button key={label} className={ECON_TONE[label]}><small>{label}</small><strong>{fmt(value)}</strong></button>)}</div><section><div className="pw2-subhead"><h3>Pagamenti</h3><button onClick={() => onAction('payment')}>Registra pagamento</button></div>{[['25/08/26','€500','Carta'],['10/08/26','€1.000','Bonifico'],['01/08/26','€200','Contanti']].map((row) => <div className="pw2-payment-row" key={row[0]}><span>{row[0]}</span><strong>{row[1]}</strong><small>{row[2]}</small></div>)}</section><section className="pw2-payment-plan"><div className="pw2-subhead"><h3>Piano pagamenti</h3><button onClick={() => onAction('paymentPlan')}>Modifica piano</button></div><strong>3/5 pagate</strong><span>Prossima: €500 · 15/09/26</span><em>⚠ 1 rata scaduta</em><div className="pw2-installments" data-entity="INSTALLMENT">{[['€500','15/07','PAID'],['€500','15/08','PAID'],['€500','15/09','OVERDUE'],['€500','15/10','PENDING']].map((row) => <div key={row[1]} className={INSTALLMENT_TONE[row[2]]}><b>{row[0]}</b><span>{row[1]}</span><small>{row[2]}</small></div>)}</div></section></div>;
}

function PlansArchive({ onOpenQuote }) {
  return <section className="pw2-archive"><div className="pw2-section-heading"><div><span>Oggetti permanenti</span><h2>Piani clinici | Preventivi</h2></div></div><div className="pw2-archive-grid"><article><small>Piano clinico</small><h3>Piano clinico 25/08/26</h3><p>4 prestazioni · €1.152</p><b>Attivo</b><div><button>Apri</button><button>Modifica</button><button>Genera preventivo</button><button>Duplica</button><button>Archivia</button></div></article><article><small>Preventivo</small><h3>Preventivo #2026-014</h3><p>€1.152 · 25/08/26</p><b>Inviato</b><div><button onClick={onOpenQuote}>Apri</button><button>WhatsApp</button><button>PDF</button><button>Stampa</button><button>Modifica</button><button>Duplica</button></div></article></div></section>;
}

function Timeline() {
  const events = [['25 agosto 2026','✓','Ricostruzione con perno 26','€250'],['20 agosto 2026','💳','Pagamento','€500'],['18 agosto 2026','✓','Endodonzia 26',''],['10 agosto 2026','📄','Preventivo #014 inviato WhatsApp',''],['8 agosto 2026','🦷','Piano clinico creato',''],['5 agosto 2026','📅','Visita','']];
  return <section className="pw2-timeline" data-entity="TIMELINE_EVENT"><div className="pw2-section-heading"><div><span>Storia universale</span><h2>Timeline</h2></div></div>{events.map(([date,icon,title,meta]) => <article key={date}><time>{date}</time><span>{icon}</span><div><strong>{title}</strong>{meta && <small>{meta}</small>}</div></article>)}</section>;
}

function QuickCreateDrawer({ kind, plans, context, onClose, onChangeKind }) {
  const [query, setQuery] = useState('');
  const [siteType, setSiteType] = useState('Nessuna');
  const [selectedTooth, setSelectedTooth] = useState('26');
  const [discountType, setDiscountType] = useState('Nessuno');
  const [discountValue, setDiscountValue] = useState(0);
  const [planReady, setPlanReady] = useState(false);
  const [quoteReady, setQuoteReady] = useState(false);
  const [selectedQuoteItems, setSelectedQuoteItems] = useState(PLAN_COMPOSER_ITEMS.map((item) => item.id));
  const [shareMessage, setShareMessage] = useState('Situazione attuale:\n• 2 trattamenti programmati\n• 1 completato\n• prossimo step: corona elemento 26\n• controllo consigliato: ottobre');
  const [paymentPlanDraft, setPaymentPlanDraft] = useState({ total: '3000', deposit: '500', count: '5', frequency: 'Mensile', firstDue: '2026-09-15' });
  const [installmentOverrides, setInstallmentOverrides] = useState({});
  const [paymentPlanReady, setPaymentPlanReady] = useState(false);
  const titles = { service: 'Prestazione', plan: 'Nuovo piano clinico', quote: 'Nuovo preventivo', prescription: 'Nuova ricetta', consent: 'Nuovo consenso', share: 'Condividi situazione clinica', polyedron: 'Prova con Polyedron', odontogram: 'Odontogramma', automations: 'Automazioni cliniche', payment: 'Registra pagamento', paymentPlan: 'Nuova rateizzazione', economy: 'Situazione economica' };
  const matches = QUICK_SERVICES.filter((item) => item.toLowerCase().includes(query.toLowerCase())).slice(0, 4);
  const quoteTotal = PLAN_COMPOSER_ITEMS.filter((item) => selectedQuoteItems.includes(item.id)).reduce((sum, item) => sum + item.price, 0);
  const subtotal = kind === 'quote' ? quoteTotal : 1440;
  const discount = discountType === '%' ? subtotal * Math.min(100, Number(discountValue) || 0) / 100 : discountType === '€' ? Math.min(subtotal, Number(discountValue) || 0) : 0;
  const finalTotal = subtotal - discount;
  const paymentRemainder = Math.max(0, (Number(paymentPlanDraft.total) || 0) - (Number(paymentPlanDraft.deposit) || 0));
  const paymentCount = Math.min(24, Math.max(1, Number.parseInt(paymentPlanDraft.count, 10) || 1));
  const frequencyMonths = paymentPlanDraft.frequency === 'Bimestrale' ? 2 : 1;
  const installmentRows = Array.from({ length: paymentCount }, (_, index) => ({ index, date: installmentOverrides[index]?.date ?? addMonthsISO(paymentPlanDraft.firstDue, index * frequencyMonths), amount: installmentOverrides[index]?.amount ?? String(Math.round((paymentRemainder / paymentCount) * 100) / 100) }));
  const updatePaymentPlan = (field, value) => { setPaymentPlanReady(false); setInstallmentOverrides({}); setPaymentPlanDraft((current) => ({ ...current, [field]: value })); };
  const updateInstallment = (index, field, value) => { setPaymentPlanReady(false); setInstallmentOverrides((current) => ({ ...current, [index]: { ...current[index], [field]: value } })); };
  const action = (id) => PATIENT_WORKSPACE_ACTIONS[id];
  return <DetailDrawer title={titles[kind]} onClose={onClose}>
    {kind === 'service' && <form className="pw2-quick-form" onSubmit={(event) => event.preventDefault()}>
      <label className="pw2-search-field"><span>Prestazione</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="🔍 Cerca prestazione o scrivi liberamente…" /></label>
      <div className="pw2-search-results" aria-label="Risultati prestazioni">{matches.map((item) => <button type="button" key={item} onClick={() => setQuery(item)}><span>{item}</span><small>Seleziona</small></button>)}</div>
      <fieldset><legend>Sede</legend><div className="pw2-choice-grid">{['Dente', 'Quadrante', 'Arcata', 'Generale', 'Nessuna'].map((item) => <button type="button" className={siteType === item ? 'is-active' : ''} key={item} onClick={() => setSiteType(item)}>{item}</button>)}</div></fieldset>
      {siteType === 'Dente' && <div className="pw2-mini-odontogram" data-entity="ANATOMICAL_SITE" data-anatomical-type="TOOTH" data-anatomical-value={selectedTooth}>
        <small>Seleziona elemento · odontogramma a 4 quadranti</small>
        <div className="pw2-odontogram-quadrants">
          {ODONTOGRAM_QUADRANTS.map((quadrant) => <div className="pw2-odontogram-quadrant" key={quadrant.id} data-quadrant={quadrant.id}>
            <span className="pw2-odontogram-quadrant-label">{quadrant.label}</span>
            <div className="pw2-odontogram-teeth" role="group" aria-label={quadrant.label}>
              {quadrant.teeth.map((tooth) => <button type="button" key={tooth} className={selectedTooth === tooth ? 'is-selected' : ''} aria-pressed={selectedTooth === tooth} aria-label={`Dente ${tooth}`} onClick={() => setSelectedTooth(tooth)}>{tooth}</button>)}
            </div>
          </div>)}
        </div>
        <strong>Elemento selezionato: {selectedTooth}</strong>
      </div>}
      <div className="pw2-form-grid"><label><span>Stato</span><select defaultValue="Proposta"><option>Proposta</option><option>Pianificata</option><option>In corso</option><option>Eseguita</option><option>Annullata</option></select></label><label><span>Prezzo</span><input inputMode="decimal" placeholder="€ 0,00" /></label></div>
      <label><span>Piano associato</span><select defaultValue=""><option value="">Nessun piano</option>{plans.map((plan) => <option key={plan.id}>{plan.titolo || 'Piano clinico'}</option>)}</select></label>
      <button className="pw2-prototype-submit" type="button">Anteprima prestazione <small>Prototype · nessun salvataggio</small></button>
    </form>}
    {kind === 'plan' && <div className="pw2-concept-flow">{!planReady ? <><span className="pw2-concept-icon"><Ic n="plan" s={22} c="currentColor" /></span><h3>Piano clinico</h3><p>Contiene ciò che intendiamo fare al paziente. Il preventivo sarà il successivo passaggio economico.</p><div className="pw2-workflow-items">{PLAN_COMPOSER_ITEMS.map((item) => <div key={item.id}><span>{item.site}</span><strong>{item.treatment}</strong><small>{fmt(item.price)}</small></div>)}</div><DiscountEditor type={discountType} value={discountValue} onType={setDiscountType} onValue={setDiscountValue} subtotal={subtotal} discount={discount} total={finalTotal} /><button data-action={action('CREATE_CLINICAL_PLAN').id} className="pw2-prototype-submit" type="button" onClick={() => setPlanReady(true)}>Conferma piano clinico <small>Anteprima prima della creazione</small></button></> : <div className="pw2-ready-state"><span>✓</span><small>Prossimo step consigliato</small><h3>Piano clinico pronto</h3><p>Salvato nei Piani clinici del paziente · {fmt(finalTotal)}</p><button data-action={action('CREATE_QUOTE').id} className="pw2-prototype-submit" type="button" onClick={() => onChangeKind('quote')}>Genera preventivo →</button><button type="button" onClick={onClose}>Chiudi</button></div>}</div>}
    {kind === 'quote' && <div className="pw2-concept-flow">{!quoteReady ? <><span className="pw2-concept-icon"><Ic n="eur" s={22} c="currentColor" /></span><h3>Preventivo dal piano clinico</h3><p>Seleziona tutte o solo alcune prestazioni. Il totale si aggiorna senza creare documenti reali.</p><div className="pw2-quote-composer">{PLAN_COMPOSER_ITEMS.map((item) => <label key={item.id}><input type="checkbox" checked={selectedQuoteItems.includes(item.id)} onChange={() => setSelectedQuoteItems((current) => current.includes(item.id) ? current.filter((id) => id !== item.id) : [...current, item.id])} /><span><strong>{item.treatment}</strong><small>{item.site}</small></span><b>{fmt(item.price)}</b></label>)}</div><label className="pw2-partial"><input type="checkbox" checked={selectedQuoteItems.length < PLAN_COMPOSER_ITEMS.length} readOnly /> Preventivo parziale</label><DiscountEditor type={discountType} value={discountValue} onType={setDiscountType} onValue={setDiscountValue} subtotal={subtotal} discount={discount} total={finalTotal} /><button data-action={action('CREATE_QUOTE').id} className="pw2-prototype-submit" type="button" onClick={() => setQuoteReady(true)}>Crea preventivo <small>Conferma richiesta · nessun salvataggio</small></button></> : <div className="pw2-ready-state"><span>✓</span><small>Pronto per condivisione</small><h3>Preventivo pronto — {fmt(finalTotal)}</h3><p>Salvato nei Preventivi del paziente · {selectedQuoteItems.length} prestazioni</p><div className="pw2-document-actions"><button data-action={action('SEND_QUOTE').id}>WhatsApp</button><button>PDF</button><button data-action={action('PRINT_QUOTE').id}>Stampa</button><button onClick={onClose}>Chiudi</button></div><em>Ogni invio o documento definitivo richiederà conferma.</em></div>}</div>}
    {kind === 'prescription' && <form className="pw2-quick-form" onSubmit={(event) => event.preventDefault()}>{['Farmaco', 'Dosaggio', 'Posologia', 'Durata', 'Note'].map((field) => <label key={field}><span>{field}</span><input placeholder={field === 'Farmaco' ? 'Cerca o inserisci farmaco…' : `Inserisci ${field.toLowerCase()}…`} /></label>)}<div className="pw2-document-actions"><button data-action={action('CREATE_PRESCRIPTION').id}>Genera</button><button>Stampa</button><button>PDF</button></div><p className="pw2-confirm-note">Anteprima e conferma obbligatorie prima della generazione definitiva.</p></form>}
    {kind === 'consent' && <div className="pw2-concept-flow"><p>Scegli il documento da preparare. La firma paziente non è attiva in questo prototipo.</p><div className="pw2-consent-grid">{['Trattamento odontoiatrico', 'Implantologia', 'Chirurgia', 'Ortodonzia', 'Privacy / foto', 'Altro'].map((type) => <label key={type}><input type="radio" name="consent" /> {type}</label>)}</div><button data-action={action('CREATE_CONSENT').id} className="pw2-prototype-submit">Prepara consenso → <small>Firma e Storage non attivi</small></button></div>}
    {kind === 'share' && <div className="pw2-concept-flow"><span className="pw2-concept-icon"><Ic n="wa" s={22} c="currentColor" /></span><h3>Anteprima messaggio</h3><textarea className="pw2-share-message" value={shareMessage} onChange={(event) => setShareMessage(event.target.value)} /><div className="pw2-document-actions"><button>Modifica</button><button onClick={() => navigator.clipboard?.writeText(shareMessage)}>Copia</button><button data-action={action('SEND_CLINICAL_SUMMARY').id}>Invia WhatsApp</button></div><p className="pw2-confirm-note">Invio disattivato · sarà richiesta conferma esplicita.</p></div>}
    {kind === 'polyedron' && <div className="pw2-polyedron-flow"><div className="pw2-polyedron-command">“Cosa devo fare con Bianchi?”</div><small>Legge PatientWorkspaceContext, mai il DOM · {context?.alerts.length || 0} alert · {context?.installments.length || 0} rata scaduta</small><div className="pw2-polyedron-examples">{[['Quanto deve ancora pagare?','PAYMENT + INSTALLMENT'],['Segna corona 26 eseguita.','UPDATE_TREATMENT_STATUS'],['Preparami il preventivo del piano.','CREATE_QUOTE'],['Crea una rateizzazione in 6 rate.','CREATE_PAYMENT_PLAN'],['Quando richiamarlo per igiene?','RECALL + AUTOMATION_RULE'],['Preparami una ricetta.','CREATE_PRESCRIPTION']].map(([prompt,intent]) => <button key={prompt}><span>{prompt}</span><small>{intent}</small></button>)}</div><div className="pw2-polyedron-preview"><strong>Anteprima</strong><span>Suggerimenti ≠ fatti registrati. Nessuna azione è stata eseguita.</span></div><div className="pw2-document-actions"><button>Conferma</button><button>Modifica</button><button>Annulla</button></div></div>}
    {kind === 'automations' && <div className="pw2-automation-list">{[['Igiene eseguita','Nessun appuntamento futuro','Crea richiamo +6 mesi'],['Impianto inserito','Percorso attivo','Follow-up +7 / +30 / +90 giorni'],['Perno 26 eseguito','Corona assente','Suggerisci Corona 26'],['All-on-4 provvisorio','Definitivo non pianificato','Crea task e controllo']].map(([trigger,condition,result]) => <article key={trigger}><span>TRIGGER<strong>{trigger}</strong></span><b>→</b><span>CONDITION<strong>{condition}</strong></span><b>→</b><span>ACTION<strong>{result}</strong></span></article>)}<p>Regole demo · nessuna automazione viene eseguita.</p></div>}
    {kind === 'payment' && <form className="pw2-quick-form" onSubmit={(event) => event.preventDefault()}><label><span>Importo</span><input placeholder="€ 0,00" inputMode="decimal" /></label><div className="pw2-form-grid"><label><span>Data</span><input type="date" /></label><label><span>Metodo</span><select><option>Carta</option><option>Bonifico</option><option>Contanti</option></select></label></div><button data-action="REGISTER_PAYMENT" className="pw2-prototype-submit">Anteprima pagamento <small>Nessuna registrazione reale</small></button></form>}
    {kind === 'paymentPlan' && <form className="pw2-quick-form pw2-payment-plan-editor" onSubmit={(event) => event.preventDefault()}><div className="pw2-form-grid"><label><span>Importo totale</span><input value={paymentPlanDraft.total} inputMode="decimal" onChange={(event) => updatePaymentPlan('total', event.target.value)} /></label><label><span>Acconto</span><input value={paymentPlanDraft.deposit} inputMode="decimal" onChange={(event) => updatePaymentPlan('deposit', event.target.value)} /></label><label><span>Da rateizzare</span><input value={paymentRemainder} readOnly /></label><label><span>Numero rate</span><input value={paymentPlanDraft.count} type="number" min="1" max="24" onChange={(event) => updatePaymentPlan('count', event.target.value)} /></label><label><span>Frequenza</span><select value={paymentPlanDraft.frequency} onChange={(event) => updatePaymentPlan('frequency', event.target.value)}><option>Mensile</option><option>Bimestrale</option><option>Personalizzato</option></select></label><label><span>Prima scadenza</span><input type="date" value={paymentPlanDraft.firstDue} onChange={(event) => updatePaymentPlan('firstDue', event.target.value)} /></label></div><div className="pw2-installment-preview"><strong>{paymentCount} rate · {fmt(paymentRemainder)} da distribuire</strong><span>Modifica liberamente data e importo di ogni rata.</span></div><div className="pw2-installment-editor" data-entity="INSTALLMENT">{installmentRows.map((row) => <div key={row.index}><b>Rata {row.index + 1}</b><label><span>Scadenza</span><input aria-label={`Scadenza rata ${row.index + 1}`} type="date" value={row.date} onChange={(event) => updateInstallment(row.index, 'date', event.target.value)} /></label><label><span>Importo</span><input aria-label={`Importo rata ${row.index + 1}`} inputMode="decimal" value={row.amount} onChange={(event) => updateInstallment(row.index, 'amount', event.target.value)} /></label></div>)}</div>{paymentPlanReady ? <div className="pw2-payment-plan-ready" role="status"><strong>✓ Piano pagamenti configurato</strong><span>{paymentCount} rate · totale rate {fmt(installmentRows.reduce((sum, row) => sum + (Number(row.amount) || 0), 0))}</span><button type="button" onClick={() => setPaymentPlanReady(false)}>Modifica ancora</button></div> : <button type="button" data-action="CREATE_PAYMENT_PLAN" className="pw2-prototype-submit" onClick={() => setPaymentPlanReady(true)}>Conferma configurazione <small>Anteprima attiva · nessuna persistenza</small></button>}</form>}
    {kind === 'economy' && <EconomyDetail onAction={onChangeKind} />}
    {kind === 'odontogram' && <div className="pw2-odontogram-placeholder"><div className="pw2-teeth" aria-hidden="true">{Array.from({ length: 12 }, (_, i) => <span key={i} />)}</div><h3>Modulo clinico in preparazione</h3><p>L’odontogramma sarà collegato in una fase dedicata, con modello clinico e persistenza autorevoli.</p></div>}
  </DetailDrawer>;
}

export default function PatientWorkspaceV2({ patient, plans, payments, appointments, onClose = () => {}, onEdit = () => {} }) {
  const model = useMemo(() => buildPatientWorkspaceV2Model({ patient, plans, payments, appointments }), [patient, plans, payments, appointments]);
  const [drawer, setDrawer] = useState(null);
  const [quickCreate, setQuickCreate] = useState(null);
  const [tab, setTab] = useState('info');
  const [planFilter, setPlanFilter] = useState('Tutte');
  const [openTreatmentMenu, setOpenTreatmentMenu] = useState(null);
  const [locallyCompleted, setLocallyCompleted] = useState([]);
  const age = yearsOld(patient?.dataNascita);
  const kpis = [
    { id: 'plans', label: 'Piani', value: model.patientPlans.length, icon: 'plan', tone: '' },
    { id: 'done', label: 'Eseguito', value: fmt(model.completed.reduce((sum, item) => sum + (Number(item.prezzo) || 0), 0)), icon: 'okc', tone: 'pw2-econ-amber' },
    { id: 'paid', label: 'Pagato', value: fmt(model.paid), icon: 'eur', tone: 'pw2-econ-green' },
    { id: 'outstanding', label: 'Da pagare', value: fmt(model.outstanding), icon: 'clk', tone: 'pw2-econ-red' },
  ];
  const clinicalRows = model.items.map((item) => ({
    ...item,
    site: item.sede || item.dente || 'Generale',
    status: item.eseguita ? 'Eseguita' : item.stato === 'in_corso' ? 'In corso' : item.statoLabel || 'Da eseguire',
  }));
  const inProgress = clinicalRows.filter((item) => item.status === 'In corso').length;
  const toDo = clinicalRows.filter((item) => !['In corso', 'Eseguita'].includes(item.status)).length;
  const interactivePlanRows = clinicalRows.slice(0, 5).map((item) => locallyCompleted.includes(item.key) ? { ...item, status: 'Eseguita' } : item);
  const visiblePlanRows = interactivePlanRows.filter((item) => planFilter === 'Tutte' || (planFilter === 'Eseguite' && item.status === 'Eseguita') || (planFilter === 'In corso' && item.status === 'In corso') || (planFilter === 'Da fare' && !['Eseguita','In corso'].includes(item.status)));
  const workspaceContext = useMemo(() => createPatientWorkspaceContext({ patient, activeClinicalPlan: model.activePlans[0], clinicalPlans: model.patientPlans, treatments: clinicalRows, anatomicalContext: clinicalRows.map((item) => ({ type: item.site === 'Generale' ? 'GENERAL' : 'TOOTH', value: item.site })), alerts: [{ type: 'UNSCHEDULED_TREATMENT', severity: 'medium', source: 'TREATMENT', dueAt: '2026-08-29', status: 'OPEN' }], quotes: [{ id: 'quote-014', status: 'SENT', total: 1152 }], payments: model.paidRows, paymentPlans: [{ id: 'pp-1', total: 3000, status: 'ACTIVE' }], installments: [{ amount: 500, due_date: '2026-09-15', status: 'OVERDUE' }], appointments, recalls: [{ type: 'HYGIENE', dueAt: '2027-02-25' }], followups: [], prescriptions: [], consents: [], automationRules: [{ trigger: 'TREATMENT_COMPLETED(HYGIENE)', condition: 'NO_FUTURE_APPOINTMENT(HYGIENE)', action: 'CREATE_RECALL(+6 MONTHS)' }], timeline: [] }), [patient, model.activePlans, model.patientPlans, model.paidRows, clinicalRows, appointments]);
  const tabs = [['info', 'Info'], ['piani', 'Piani'], ['timeline', 'Timeline'], ['foto', 'Foto'], ['doc', 'Documenti'], ['app', 'Agenda']];

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
      {kpis.map((kpi) => <button key={kpi.id} className={kpi.tone} onClick={() => setDrawer(kpi.id)}><span className="pw2-kpi-icon"><Ic n={kpi.icon} s={17} c="currentColor" /></span><span><small>{kpi.label}</small><strong>{kpi.value}</strong></span><span aria-hidden="true">›</span></button>)}
    </section>

    <main className="pw2-main">
      <section className="pw2-action-bar" aria-label="Azioni paziente"><div><small>Azioni paziente</small><strong>Crea rapidamente</strong></div><div className="pw2-action-buttons"><button data-action="ADD_TREATMENT" onClick={() => setQuickCreate('service')}>Prestazione</button><button data-action="CREATE_CLINICAL_PLAN" onClick={() => setQuickCreate('plan')}>Piano clinico</button><button data-action="CREATE_QUOTE" onClick={() => setQuickCreate('quote')}>Preventivo</button><button data-action="CREATE_PRESCRIPTION" onClick={() => setQuickCreate('prescription')}>Ricetta</button><button data-action="CREATE_CONSENT" onClick={() => setQuickCreate('consent')}>Consenso</button></div></section>
      <button className="pw2-micro-profile" onClick={() => setDrawer('profile')}>
        <span>{[age != null ? `${age} anni` : null, patient?.comune, model.lastVisit ? `Ultima visita ${fmtD(model.lastVisit.data)}` : null].filter(Boolean).join('  ·  ') || 'Informazioni anagrafiche'}</span>
        <strong>Anagrafica <span aria-hidden="true">›</span></strong>
      </button>

      <button className={`pw2-risk ${model.risks.length ? 'is-alert' : 'is-clear'}`} onClick={() => setDrawer('risks')}>
        <span className="pw2-risk-bell"><Ic n="bell" s={16} c="currentColor" /></span>
        <span><strong>{model.risks.length ? 'Anamnesi da verificare' : 'Nessuna criticità nota'}</strong><small>{model.risks.length ? `${model.risks.length} segnalazioni disponibili` : 'Il profilo non riporta rischi o allergie'}</small></span>
        <span aria-hidden="true">›</span>
      </button>

      <section className="pw2-attention"><div><span>Da attenzionare</span><strong>Corona 26 non programmata</strong><small>Controllo consigliato entro 4 giorni</small></div><button onClick={() => setQuickCreate('automations')}>Automazioni</button></section>

      <section className="pw2-active-plan" data-entity="CLINICAL_PLAN"><div className="pw2-plan-head"><div><span>Piano clinico attivo</span><h2>Piano 25/08/26</h2><p>{model.completed.length + locallyCompleted.length}/5 completate · aggiornamento immediato</p></div><div><button onClick={() => setQuickCreate('share')}>Condividi</button><button onClick={() => setQuickCreate('odontogram')}>Odontogramma</button></div></div><div className="pw2-progress"><span style={{ width: `${Math.min(100, ((model.completed.length + locallyCompleted.length) / 5) * 100)}%` }} /></div><div className="pw2-plan-filters">{['Tutte','Da fare','In corso','Eseguite'].map((filter) => <button className={planFilter === filter ? 'is-active' : ''} key={filter} onClick={() => setPlanFilter(filter)}>{filter}</button>)}</div><div className="pw2-plan-table"><div className="pw2-plan-columns"><span>Prestazione</span><span>Sede</span><span>Stato</span><span>Prezzo</span><span>Prossimo step</span><span>Azioni</span></div>{visiblePlanRows.map((item) => { const isRecall = item.status === 'Richiamo da programmare'; const tone = statusTone(item.status); return <article key={item.key} data-entity={isRecall ? 'RECALL' : 'TREATMENT'} data-status={tone}><strong>{item.prestazione}</strong><span className="pw2-site-label">{item.site}</span><span className={`pw2-status-badge is-${tone}`}><i aria-hidden="true" />{item.status}</span><b>{fmt(Number(item.prezzo)||0)}</b><small>{item.status === 'Eseguita' ? 'Completata' : 'Da programmare'}</small><div className="pw2-row-actions">{primaryActions(item.status).map((label, index) => <button className={index === 0 ? `pw2-status-action is-${tone}` : 'pw2-secondary-action'} key={label} onClick={() => label === 'Segna eseguita' && setLocallyCompleted((current) => current.includes(item.key) ? current : [...current, item.key])}>{label === 'Segna eseguita' ? '✓ Segna eseguita' : label}</button>)}<span className="pw2-context-wrap"><button aria-label={`Altre azioni per ${item.prestazione}`} aria-haspopup="menu" aria-expanded={openTreatmentMenu === item.key} onClick={() => setOpenTreatmentMenu((current) => current === item.key ? null : item.key)}>⋯</button>{openTreatmentMenu === item.key && <span className="pw2-context-menu" role="menu" aria-label={`Azioni ${item.prestazione}`}>{contextualActions(item.status).map((label) => <button role="menuitem" key={label} onClick={() => setOpenTreatmentMenu(null)}>{label}</button>)}</span>}</span></div></article>; })}</div><footer><span>Le prestazioni eseguite restano nel piano e nella Timeline.</span><button onClick={() => setQuickCreate('quote')}>Genera preventivo →</button></footer></section>

      <aside className="pw2-plan-completion-contract"><span>Stato finale previsto: ✓ Piano clinico completato · resta nei Piani e nella Timeline.</span><span>Empty state previsto: Nessun piano clinico attivo → Crea Piano clinico.</span></aside>
      <section className="pw2-economy" data-entity="PAYMENT"><div><span>Situazione economica</span><h2><i className="pw2-econ-dot pw2-econ-green" aria-hidden="true" />Pagato {fmt(1700)}</h2><p><i className="pw2-econ-dot pw2-econ-red" aria-hidden="true" />Residuo {fmt(400)} · 3/5 rate pagate · prossima €500 il 15/09</p></div><button onClick={() => setQuickCreate('economy')}>Dettagli →</button></section>

      <nav className="pw2-tabs" aria-label="Workspace paziente">{tabs.map(([id, label]) => <button key={id} className={tab === id ? 'is-active' : ''} onClick={() => setTab(id)}>{label}</button>)}</nav>
      {tab === 'piani' ? <PlansArchive onOpenQuote={() => setQuickCreate('quote')} /> : tab === 'timeline' ? <Timeline /> : <section className="pw2-workspace"><div><span>Workspace operativo</span><h3>{tabs.find(([id]) => id === tab)?.[1]}</h3><p>{tab === 'info' ? 'Dati essenziali disponibili nella micro-anagrafica.' : 'Sezione contestuale pronta per il collegamento alle fonti canoniche.'}</p></div><button className="pw2-polyedron-try" onClick={() => setQuickCreate('polyedron')}>Prova con Polyedron</button></section>}
    </main>

    {drawer && <DetailDrawer title={{ plans: 'Piani di cura', done: 'Prestazioni eseguite', paid: 'Pagamenti registrati', outstanding: 'Residuo da pagare', profile: 'Anagrafica', risks: 'Anamnesi e rischi', clinical: 'Situazione clinica' }[drawer]} onClose={() => setDrawer(null)}>
      {drawer === 'profile' && <dl className="pw2-detail-list"><div><dt>Nome completo</dt><dd>{patient?.nome} {patient?.cognome}</dd></div><div><dt>Data di nascita</dt><dd>{fmtD(patient?.dataNascita)}</dd></div><div><dt>Comune</dt><dd>{patient?.comune || 'Non disponibile'}</dd></div><div><dt>Indirizzo</dt><dd>{patient?.indirizzo || 'Non disponibile'}</dd></div><div><dt>Email</dt><dd>{patient?.email || 'Non disponibile'}</dd></div></dl>}
      {drawer === 'risks' && (model.risks.length ? model.risks.map((risk, i) => <div className="pw2-detail-row" key={i}>{String(risk)}</div>) : <div className="pw2-empty">Nessuna criticità nota.</div>)}
      {drawer === 'plans' && (model.patientPlans.length ? model.patientPlans.map((plan) => <div className="pw2-detail-row" key={plan.id}><strong>{plan.titolo || 'Piano di cura'}</strong><span>{safeItems(plan).length} prestazioni</span></div>) : <div className="pw2-empty">Nessun piano disponibile.</div>)}
      {drawer === 'done' && (model.completed.length ? model.completed.map((item) => <div className="pw2-detail-row" key={item.key}><strong>{item.prestazione}</strong><span>{fmt(Number(item.prezzo) || 0)}</span></div>) : <div className="pw2-empty">Nessuna prestazione eseguita.</div>)}
      {drawer === 'paid' && (model.paidRows.length ? model.paidRows.map((row) => <div className="pw2-detail-row" key={row.id}><strong>{fmt(Number(row.importo) || 0)}</strong><span>{fmtD(row.data)}</span></div>) : <div className="pw2-empty">Nessun pagamento registrato.</div>)}
      {drawer === 'outstanding' && <div className="pw2-balance"><small>Totale piani</small><strong>{fmt(model.total)}</strong><small>Pagato</small><strong>{fmt(model.paid)}</strong><small>Residuo</small><strong>{fmt(model.outstanding)}</strong></div>}
    </DetailDrawer>}
    {quickCreate && <QuickCreateDrawer kind={quickCreate} plans={model.patientPlans} context={workspaceContext} onClose={() => setQuickCreate(null)} onChangeKind={setQuickCreate} />}
  </div>;
}
