import './AppointmentWorkspace.css';
import React, { lazy, Suspense, useEffect, useId, useRef, useState } from 'react';
import { PannelloInvioDocumento } from './ui';
import { lockPageScroll } from './ui/Modal.jsx';
import Odontogramma from './Odontogramma.jsx';
import { implantQuoteRows, isImplantQuoteRequest } from '../lib/domain/implantQuote.js';
import { planAssignmentForPatient } from '../lib/domain/incassiActions.js';
const AppointmentDocuments = lazy(() => import('./AppointmentDocuments.jsx'));
const DocMedico = lazy(() => import('./DocMedico.jsx'));
const blankRow = () => ({ description: '', price: '', tooth: '' });
function Field({ label, children }) {
  const id = useId();
  return <div className="appointment-field"><label htmlFor={id}>{label}</label>{React.cloneElement(children, { id })}</div>;
}

function ImplantPreview({ row }) {
  let rows, error;
  try { rows = implantQuoteRows(row); } catch(e) { error = e.message; }
  const money = value => Number(value).toLocaleString('it-IT', {style:'currency',currency:'EUR'});
  return <div className="appointment-implant-preview"><strong>Preventivo impianto · 3 voci</strong>
    {(rows || [{description:'Impianto osteointegrato',price:500},{description:'Moncone',price:150},{description:'Corona composito ceramica'}]).map(item=><div key={item.description}><span>{item.description}</span><b>{item.price == null ? 'Resto del totale' : money(item.price)}</b></div>)}
    {error && row.price !== '' && <p role="alert">{error}</p>}
    <small>Si salva nel preventivo. Inserisci il totale qui sopra.</small>
  </div>;
}

function EntryRows({ rows, onChange, listId, pricelist, dentist, name }) {
  const update = (index, patch) => onChange(rows.map((r,i) => i === index ? { ...r, ...patch } : r));
  return <div className="appointment-entry-rows">{rows.map((row,index) => {
    const implant = dentist && isImplantQuoteRequest(row.description);
    const selectedTeeth = String(row.tooth || '').split(/[^0-9]+/).map(Number).filter(d => d>=11 && d<=48 && d%10>=1 && d%10<=8);
    return <div key={index} className="appointment-entry-row">
    <Field label={`${name} ${index + 1}`}><input list={listId} placeholder="Scrivi o scegli dal listino" value={row.description} onChange={e => { const item = pricelist.find(p => p.nome === e.target.value); update(index, { description: e.target.value, ...(item && !isImplantQuoteRequest(e.target.value) ? { price: String(item.prezzo) } : {}) }); }} /></Field>
    <div className="appointment-field-pair"><Field label={implant ? `Totale impianto ${index + 1} (€)` : `Prezzo ${name.toLowerCase()} ${index + 1} (€)`}><input type="number" min={implant?650:0} step="0.01" inputMode="decimal" placeholder={implant?'Inserisci totale':'0,00'} value={row.price} onChange={e => update(index, { price: e.target.value })} /></Field>{dentist && <Field label={`Dente ${name.toLowerCase()} ${index + 1} (facoltativo)`}><input value={row.tooth} placeholder="es. 16" onChange={e => update(index, { tooth: e.target.value })} /></Field>}</div>
    {dentist && <details className="appointment-tooth-picker"><summary>Odontogramma {name.toLowerCase()} {index+1}{row.tooth ? ` · ${row.tooth}` : ''}</summary><Odontogramma touchFriendly selected={selectedTeeth} onChange={()=>{}} onDenteChange={tooth=>update(index,{tooth})} /></details>}
    {implant && <ImplantPreview row={row} />}
    <div className="appointment-row-actions"><button type="button" className="appointment-text-button" onClick={() => onChange([...rows.slice(0,index+1), {...row}, ...rows.slice(index+1)])}>Duplica {name.toLowerCase()} {index+1}</button>
    {rows.length > 1 && <button type="button" className="appointment-text-button" onClick={() => onChange(rows.filter((_,i) => i !== index))}>Rimuovi {name.toLowerCase()} {index + 1}</button>}</div>
  </div>; })}<button type="button" className="appointment-add-row" onClick={() => onChange([...rows, blankRow()])}>+ Altra {name.toLowerCase()}</button></div>;
}

function MedicalFields({ api, patient }) {
  const { tipo, setTipo, cnt, setCnt, tipiDisponibili, pronto, farmaciPreferiti = [] } = api;
  const drugsListId = useId(), favoritesRef = useRef(null);
  const patch = change => { if (pronto) api.nuovoDocumento(); setCnt(v => ({ ...v, ...change })); };
  const text = (key,label,placeholder='') => <Field label={label}><textarea rows={3} placeholder={placeholder} value={cnt[key] || ''} onChange={e => patch({ [key]: e.target.value })} /></Field>;
  return <div className="appointment-medical-fields">
    <Field label="Tipo documento"><select value={tipo} onChange={e => { setTipo(e.target.value); api.nuovoDocumento(); }}>{tipiDisponibili.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}</select></Field>
    {tipo === 'ricetta' && <><datalist id={drugsListId}>{farmaciPreferiti.map(fp=><option key={fp.id} value={fp.farmaco} />)}</datalist>{!!farmaciPreferiti.length && <details ref={favoritesRef} className="appointment-drug-favorites"><summary>Farmaci frequenti ({farmaciPreferiti.length})</summary><div>{farmaciPreferiti.map(fp=><button type="button" key={fp.id} className="appointment-secondary-button" disabled={(cnt.farmaci || []).some(f=>f.farmaco?.trim().toLocaleLowerCase('it-IT')===fp.farmaco.toLocaleLowerCase('it-IT'))} onClick={()=>{api.aggiungiFarmacoPreferito(fp);favoritesRef.current.open=false;}}>{fp.farmaco}</button>)}</div><small>Dosi e posologie dello studio: verifica prima di generare.</small></details>}{(cnt.farmaci || []).map((f,i) => <div key={i} className="appointment-entry-row"><Field label={`Farmaco ${i + 1}`}><input list={drugsListId} placeholder="Farmaco e formulazione" value={f.farmaco} onChange={e => { const chosen = farmaciPreferiti.find(fp=>fp.farmaco.toLocaleLowerCase('it-IT')===e.target.value.trim().toLocaleLowerCase('it-IT')); patch({ farmaci: cnt.farmaci.map((v,j) => j === i ? { ...v, ...(chosen ? {dosaggio:chosen.dosaggio,posologia:chosen.posologia,durata:chosen.durata,note:chosen.note} : {}), farmaco:e.target.value } : v) }); }} /></Field><Field label={`Posologia ${i + 1}`}><textarea rows={2} placeholder="Come e quando assumerlo" value={f.posologia} onChange={e => patch({ farmaci: cnt.farmaci.map((v,j) => j === i ? { ...v, posologia: e.target.value } : v) })} /></Field><details><summary>Dose, durata e note</summary>{[['dosaggio','Dosaggio'],['durata','Durata'],['note','Note']].map(([key,label]) => <Field key={key} label={`${label} farmaco ${i+1}`}><input value={f[key] || ''} onChange={e => patch({ farmaci: cnt.farmaci.map((v,j) => j === i ? { ...v, [key]: e.target.value } : v) })} /></Field>)}</details>{cnt.farmaci.length > 1 && <button type="button" className="appointment-text-button" onClick={() => patch({ farmaci: cnt.farmaci.filter((_,j) => j !== i) })}>Rimuovi farmaco {i+1}</button>}</div>)}<button type="button" className="appointment-add-row" onClick={() => patch({ farmaci: [...cnt.farmaci, { farmaco:'',posologia:'',dosaggio:'',durata:'',note:'' }] })}>+ Altro farmaco</button></>}
    {tipo === 'diagnostica' && <>{text('esamiDiagnostici','Esami richiesti','es. Ecografia addome completo')}{text('quesitoEsami','Quesito clinico')}{text('distrettoEsami','Distretto anatomico')}{text('noteDiagnostica','Note esami')}</>}
    {tipo === 'esami' && <>{text('noteEsami','Note esami ematici')}<Field label="Esami ematici (uno per riga)"><textarea rows={5} value={[...(cnt.esamiSelezionati || []), ...(cnt.esamiExtra || [])].join('\n')} onChange={e => patch({ esamiSelezionati: [], esamiExtra: e.target.value.split('\n') })} /></Field></>}
    {tipo === 'certificato' && <>{text('motivoCert','Motivo della visita')}{text('noteCert','Note certificato')}</>}
    {tipo === 'riposo' && <><Field label="Giorni di riposo"><input type="number" min="1" value={cnt.giorniRiposo} onChange={e => patch({ giorniRiposo:e.target.value })} /></Field>{text('noteRiposo','Note riposo')}</>}
    {tipo === 'lettera' && <>{text('specialista','Specialista destinatario')}{text('motivoLettera','Motivo invio')}{text('anamnesi','Anamnesi')}{text('diagnosi','Diagnosi')}{text('richiesta','Richiesta')}</>}
    {tipo === 'protocollo' && <>{text('titoloProtocollo','Titolo istruzioni')}{text('testoProtocollo','Istruzioni')}</>}
    {tipo === 'vuoto' && <>{text('titoloVuoto','Titolo documento')}{text('testoVuoto','Testo documento')}</>}
    {api.erroreGenerazione && <p role="alert">{api.erroreGenerazione}</p>}
    <button type="button" className="appointment-secondary-button" onClick={api.genera}>Genera PDF</button>
    {pronto && <PannelloInvioDocumento pronto={pronto} paziente={patient} archiviato={api.archiviato} onChiudi={api.nuovoDocumento} onNuovoDocumento={api.nuovoDocumento} />}
    <p className="appointment-field-help">Il PDF si genera qui. Prestazioni e incasso si salvano con il pulsante in basso.</p>
  </div>;
}

export default function AppointmentWorkspace({ patient, appointment, plans = [], pricelist = [], si, onSave, onClose, onBusyChange = () => {}, documentClient }) {
  const eligible = plans.filter(p => p && String(p.pazienteId) === String(patient?.id) && ['attivo','accettato'].includes(p.stato));
  const assignment = planAssignmentForPatient(plans.filter(Boolean), patient?.id);
  const [draft,setDraft] = useState(() => ({ items:[blankRow()], planId:eligible.length === 1 ? String(eligible[0].id) : eligible.length ? '' : 'new', planTitle:'Prestazioni occasionali', amount:'', method:'Contanti', paymentPlanId:'context', paymentNote:'', quoteTitle:'Preventivo', quoteItems:[blankRow()] }));
  const [medicalOpen,setMedicalOpen] = useState(false),[saving,setSaving] = useState(false),[uncertain,setUncertain] = useState(false),[message,setMessage] = useState(''),[error,setError] = useState('');
  const [documentsOpen,setDocumentsOpen] = useState(false), [documentsReload,setDocumentsReload] = useState(0);
  const locked = useRef(false), listId = useId();
  const documentsRef = useRef(null), quoteRef = useRef(null), medicalRef = useRef(null), paymentRef = useRef(null);
  const openSection = ref => {
    if (!ref.current) return;
    ref.current.open = true;
    ref.current.scrollIntoView({ block: 'start', behavior: 'smooth' });
    ref.current.querySelector('summary')?.focus({ preventScroll: true });
  };
  useEffect(() => lockPageScroll(), []);
  const patch = value => { setDraft(v => ({ ...v,...value })); setMessage(''); setError(''); };
  const dentist = !si?.vertical || si.vertical === 'dentistico';
  const hasImplant = dentist && [...draft.items,...draft.quoteItems].some(r=>isImplantQuoteRequest(r.description));
  const hasTreatment = draft.items.some(r=>r.description.trim() && !(dentist && isImplantQuoteRequest(r.description)));
  if (!patient?.id || String(appointment?.pazienteId) !== String(patient.id)) return null;
  const save = async close => {
    if (locked.current || uncertain) return;
    locked.current = true; setSaving(true); onBusyChange(true); setError(''); setMessage('');
    try {
      const result = await onSave({...draft, implantPreset:dentist});
      setDraft(v => ({ ...v, items:[blankRow()], ...(result.treatmentId ? {planId:String(result.treatmentId)} : {}), quoteItems:[blankRow()], amount:'', paymentNote:'', paymentPlanId:'context' }));
      if (close) onClose(); else setMessage(result.completed ? 'Dati salvati.' : 'Nessun dato da salvare.');
    } catch(e) {
      setUncertain(!!e.writesStarted);
      setError(e.writesStarted ? `${e.completed || 0} operazioni confermate. ${e.message} Verifica i dati salvati prima di ripetere: nessun nuovo invio automatico.` : e.message);
    } finally { locked.current=false;setSaving(false);onBusyChange(false); }
  };
  return <section className="appointment-rapid-form" aria-label="Scheda appuntamento">
    <nav className="appointment-section-shortcuts" aria-label="Compila o consulta">
      <button type="button" onClick={()=>openSection(quoteRef)}><strong>+ Preventivo</strong><span>Prepara le voci</span></button>
      <button type="button" onClick={()=>openSection(medicalRef)}><strong>Ricetta e documenti</strong><span>Compila e genera PDF</span></button>
      <button type="button" onClick={()=>openSection(documentsRef)}><strong>Documenti salvati</strong><span>Preventivi e ricette</span></button>
      <button type="button" onClick={()=>openSection(paymentRef)}><strong>Registra incasso</strong><span>Importo e metodo</span></button>
    </nav>
    <details ref={documentsRef} className="appointment-form-section appointment-document-access" onToggle={e=>{if(e.currentTarget.open)setDocumentsOpen(true)}}><summary><span>Documenti del paziente</span><small>Preventivi · ricette</small></summary>{documentsOpen && <Suspense fallback={<p role="status">Caricamento documenti…</p>}><AppointmentDocuments patient={patient} plans={plans} si={si} reloadToken={documentsReload} client={documentClient} /></Suspense>}</details>
    <fieldset disabled={saving || uncertain}>
      {(patient.anamnesiAllarme || patient.note) && <div className="appointment-workspace-alert">{patient.anamnesiAllarme ? 'Allarme anamnesi: '+(patient.anamnesiAllarmeDettagli || []).map(d=>[d.titolo,d.nota].filter(Boolean).join(': ')).join('; ') : patient.note}</div>}
      <datalist id={listId}>{pricelist.map(p => <option key={p.id} value={p.nome}>{p.prezzo} €</option>)}</datalist>
      <div className="appointment-primary-fields"><h2>Prestazioni</h2><p className="appointment-field-help">Compila le cure di oggi, scegli dal listino o inserisci una voce libera.</p><EntryRows rows={draft.items} onChange={items=>patch({items})} listId={listId} pricelist={pricelist} dentist={dentist} name="Prestazione" />
        <details hidden={hasImplant && !hasTreatment} className="appointment-plan-options" open={eligible.length > 1 && !draft.planId}><summary>Piano: {draft.planId === 'new' ? 'nuovo' : eligible.find(p=>String(p.id)===draft.planId)?.titolo || 'scegli'}</summary><Field label="Salva prestazioni nel piano"><select value={draft.planId} onChange={e=>patch({planId:e.target.value})}><option value="">Scegli piano</option>{eligible.map(p=><option key={p.id} value={p.id}>{p.titolo}</option>)}<option value="new">Nuovo piano</option></select></Field>{draft.planId === 'new' && <Field label="Nome nuovo piano"><input value={draft.planTitle} onChange={e=>patch({planTitle:e.target.value})} /></Field>}</details>
      </div>
      <details ref={paymentRef} open className="appointment-form-section appointment-payment-section"><summary><span>Incasso</span><small>{draft.amount ? `${draft.amount} €` : 'Facoltativo'}</small></summary><div className="appointment-section-fields"><div className="appointment-field-pair"><Field label="Incassato (€)"><input type="number" min="0" step="0.01" inputMode="decimal" placeholder="Lascia vuoto se non incassi" value={draft.amount} onChange={e=>patch({amount:e.target.value})} /></Field><Field label="Metodo"><select value={draft.method} onChange={e=>patch({method:e.target.value})}>{['Contanti','Carta','Bonifico','POS','Assegno'].map(m=><option key={m}>{m}</option>)}</select></Field></div><Field label="Collega incasso"><select value={draft.paymentPlanId} onChange={e=>patch({paymentPlanId:e.target.value})}><option value="context">{hasTreatment ? 'Piano delle prestazioni compilate sopra' : hasImplant ? 'Preventivo impianto compilato sopra' : assignment.mode === 'auto' ? 'Piano attivo del paziente' : assignment.mode === 'none' ? 'Senza piano' : 'Scegli piano'}</option><option value="treatment">Piano delle prestazioni compilate sopra</option><option value="quote">Preventivo compilato in questa scheda</option>{(assignment.options || (assignment.mode === 'auto' ? plans.filter(p=>p.id===assignment.pianoId) : [])).map(p=><option key={p.id} value={p.id}>{p.titolo}</option>)}</select></Field><Field label="Nota incasso"><input value={draft.paymentNote} onChange={e=>patch({paymentNote:e.target.value})} /></Field></div></details>
      <details ref={medicalRef} className="appointment-form-section" onToggle={e=>{if(e.currentTarget.open)setMedicalOpen(true)}}><summary><span>Ricetta e documenti</span><small>Compila qui</small></summary><div className="appointment-section-fields">{medicalOpen && <Suspense fallback={<p role="status">Caricamento campi documento…</p>}><DocMedico onDocumentSaved={()=>setDocumentsReload(v=>v+1)} paz={patient} si={si} initialType="ricetta" embedded renderInline={api=><MedicalFields api={api} patient={patient} />} /></Suspense>}</div></details>
      <details ref={quoteRef} className="appointment-form-section"><summary><span>Preventivo</span><small>Manuale o listino</small></summary><div className="appointment-section-fields"><Field label="Titolo preventivo"><input value={draft.quoteTitle} onChange={e=>patch({quoteTitle:e.target.value})} /></Field><EntryRows rows={draft.quoteItems} onChange={quoteItems=>patch({quoteItems})} listId={listId} pricelist={pricelist} dentist={dentist} name="Voce preventivo" /></div></details>
    </fieldset>
    {error && <p className="appointment-save-error" role="alert">{error}</p>}{message && <p role="status">{message}</p>}
    <div className="appointment-save-bar"><button type="button" className="appointment-secondary-button" disabled={saving || uncertain} onClick={()=>save(false)}>{saving?'Salvataggio…':'Salva'}</button><button type="button" className="appointment-primary-button" disabled={saving || uncertain} onClick={()=>save(true)}>Salva e chiudi</button></div>
  </section>;
}
