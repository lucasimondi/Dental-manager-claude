import React, { useEffect, useMemo, useState } from 'react';
import LegacyPhysioCartella from './PhysioCartella.jsx';
import {
  amendClinicalNote, createPhysioEpisode, draftFromPrevious, finalizeClinicalNote,
  loadPhysioEpisode, loadPhysioEpisodes, saveBodyMap, saveClinicalNote, savePhysioAnamnesis,
} from '../lib/physioClinical.js';
import { C, fmtD } from '../lib/utils.js';

const TABS = [
  ['overview', 'Overview'], ['anamnesis', 'Anamnesi'], ['body', 'Body map'],
  ['sessions', 'Sedute'], ['timeline', 'Timeline'], ['legacy', 'Storico precedente'],
];
const EMPTY_NOTE = draftFromPrevious(null);
const BODY_REGIONS = ['Testa/collo', 'Spalla dx', 'Spalla sx', 'Dorso', 'Lombare', 'Anca dx', 'Anca sx', 'Ginocchio dx', 'Ginocchio sx', 'Caviglia/piede dx', 'Caviglia/piede sx'];
const SYMPTOMS = ['dolore', 'irradiazione', 'parestesia', 'anestesia', 'rigidità', 'edema', 'limitazione', 'altro'];

const button = (primary = false) => ({
  minHeight: 44, border: primary ? 'none' : `1px solid ${C.brd}`, borderRadius: 10,
  background: primary ? C.pri : '#fff', color: primary ? '#fff' : C.txt,
  padding: '9px 13px', fontWeight: 750, cursor: 'pointer', fontSize: 13,
});
const field = { width: '100%', minHeight: 44, boxSizing: 'border-box', border: `1px solid ${C.brd}`, borderRadius: 9, padding: '9px 10px', font: 'inherit', background: '#fff' };
const card = { background: '#fff', border: `1px solid ${C.brd}`, borderRadius: 14, padding: 14 };

export default function PhysioClinicalCore({ paziente_id, studio_id, paziente, studio }) {
  const [episodes, setEpisodes] = useState([]);
  const [episodeId, setEpisodeId] = useState(null);
  const [detail, setDetail] = useState(null);
  const [tab, setTab] = useState('overview');
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState('');
  const episode = episodes.find((item) => item.id === episodeId) || null;

  const refreshEpisodes = async (preferredId) => {
    const rows = await loadPhysioEpisodes(studio_id, paziente_id);
    setEpisodes(rows);
    setEpisodeId(preferredId || rows.find((row) => row.status === 'active')?.id || rows[0]?.id || null);
  };
  const refreshDetail = async () => {
    if (!episodeId) { setDetail(null); return; }
    setDetail(await loadPhysioEpisode(studio_id, episodeId));
  };

  useEffect(() => {
    let alive = true;
    setBusy(true); setError('');
    loadPhysioEpisodes(studio_id, paziente_id)
      .then((rows) => { if (alive) { setEpisodes(rows); setEpisodeId(rows.find((r) => r.status === 'active')?.id || rows[0]?.id || null); } })
      .catch(() => { if (alive) setError('Accesso clinico non disponibile. Verifica ruolo e autorizzazione con il titolare.'); })
      .finally(() => { if (alive) setBusy(false); });
    return () => { alive = false; };
  }, [studio_id, paziente_id]);

  useEffect(() => {
    let alive = true;
    if (!episodeId) { setDetail(null); return undefined; }
    setBusy(true);
    loadPhysioEpisode(studio_id, episodeId)
      .then((value) => { if (alive) setDetail(value); })
      .catch(() => { if (alive) setError('La cartella non è accessibile con le autorizzazioni correnti.'); })
      .finally(() => { if (alive) setBusy(false); });
    return () => { alive = false; };
  }, [studio_id, episodeId]);

  const createEpisode = async () => {
    const title = window.prompt('Titolo episodio (es. Lombalgia 2026)');
    if (!title?.trim()) return;
    const primaryProblem = window.prompt('Problema principale (facoltativo)') || '';
    const bodyRegion = window.prompt('Distretto corporeo (facoltativo)') || '';
    try {
      setBusy(true); const created = await createPhysioEpisode(studio_id, paziente_id, { title, primaryProblem, bodyRegion });
      await refreshEpisodes(created.id); setTab('anamnesis');
    } catch (e) { setError(e.message); } finally { setBusy(false); }
  };

  if (busy && !episodes.length) return <div className="physio-state">Caricamento cartella clinica…</div>;
  if (error && !episodes.length) return <div className="physio-state physio-error" role="alert">{error}</div>;

  return <div className="physio-core">
    <style>{`
      .physio-core{display:grid;gap:12px}.physio-head{display:flex;gap:10px;align-items:center;flex-wrap:wrap}
      .physio-head select{min-width:220px;flex:1}.physio-tabs{display:flex;gap:6px;overflow-x:auto;padding-bottom:3px;scrollbar-width:thin}
      .physio-tab{min-height:44px;white-space:nowrap;border:0;border-radius:22px;padding:8px 14px;font-weight:750;cursor:pointer}
      .physio-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}.physio-grid.two{grid-template-columns:repeat(2,minmax(0,1fr))}
      .physio-stack{display:grid;gap:10px}.physio-actions{display:flex;gap:8px;flex-wrap:wrap}.physio-actions button{flex:0 0 auto}
      .physio-label{display:grid;gap:5px;font-size:12px;font-weight:700;color:${C.txm}}.physio-label textarea{min-height:92px;resize:vertical}
      .physio-note-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.physio-note-grid .wide{grid-column:1/-1}
      .physio-timeline{border-left:2px solid ${C.brd};padding-left:15px;display:grid;gap:12px}.physio-event{position:relative}.physio-event:before{content:'';position:absolute;left:-21px;top:5px;width:10px;height:10px;border-radius:50%;background:${C.pri}}
      .physio-body-regions{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:7px}.physio-state{text-align:center;padding:36px;color:${C.txl}}.physio-error{color:${C.dan}}
      @media(max-width:1024px){.physio-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}
      @media(max-width:767px){.physio-grid,.physio-grid.two,.physio-note-grid{grid-template-columns:1fr}.physio-note-grid .wide{grid-column:auto}.physio-head>*{width:100%}.physio-actions{position:sticky;bottom:8px;background:#ffffffee;padding:8px;border-radius:12px;z-index:2}.physio-actions button{flex:1 1 130px}.physio-body-regions{grid-template-columns:1fr}}
      @media(min-width:1280px){.physio-core{max-width:1200px;margin:auto}}
    `}</style>
    <div className="physio-head">
      <select style={field} value={episodeId || ''} onChange={(e) => setEpisodeId(Number(e.target.value))} aria-label="Episodio di cura">
        {!episodes.length && <option value="">Nessun episodio</option>}
        {episodes.map((item) => <option key={item.id} value={item.id}>{item.title} · {item.status}</option>)}
      </select>
      <button style={button(true)} onClick={createEpisode}>+ Nuovo episodio</button>
    </div>
    {error && <div className="physio-error" role="alert">{error}</div>}
    {!episode ? <EmptyEpisode onCreate={createEpisode} /> : <>
      <div className="physio-tabs" role="tablist">
        {TABS.map(([id, label]) => <button key={id} role="tab" aria-selected={tab === id} className="physio-tab" onClick={() => setTab(id)} style={{ background: tab === id ? C.pri : C.bg, color: tab === id ? '#fff' : C.txm }}>{label}</button>)}
      </div>
      {tab === 'overview' && <Overview episode={episode} detail={detail} go={setTab} />}
      {tab === 'anamnesis' && <Anamnesis studioId={studio_id} episodeId={episodeId} value={detail?.anamnesis} onSaved={refreshDetail} />}
      {tab === 'body' && <BodyMap studioId={studio_id} episodeId={episodeId} maps={detail?.bodyMaps || []} onSaved={refreshDetail} />}
      {tab === 'sessions' && <Sessions studioId={studio_id} episodeId={episodeId} notes={detail?.notes || []} onSaved={refreshDetail} />}
      {tab === 'timeline' && <Timeline detail={detail} />}
      {tab === 'legacy' && <LegacyPhysioCartella paziente_id={paziente_id} studio_id={studio_id} paziente={paziente} studio={studio} />}
    </>}
  </div>;
}

function EmptyEpisode({ onCreate }) {
  return <div style={card}><h3 style={{ marginTop: 0 }}>Inizia un episodio di cura</h3><p style={{ color: C.txm }}>Gli episodi separano percorsi clinici diversi senza modificare lo storico Fisio precedente.</p><button style={button(true)} onClick={onCreate}>Crea il primo episodio</button></div>;
}

function Overview({ episode, detail, go }) {
  const finalized = (detail?.notes || []).filter((n) => n.note_type === 'session' && n.status === 'finalized');
  const last = finalized[0];
  return <div className="physio-stack">
    <div className="physio-actions">
      <button style={button(true)} onClick={() => go('sessions')}>+ Nuova seduta</button>
      <button style={button()} onClick={() => go('sessions')}>+ Rivalutazione</button>
      <button style={button()} onClick={() => go('sessions')}>+ Nota</button>
      <button style={button()} onClick={() => go('body')}>+ Body map</button>
    </div>
    <div className="physio-grid">
      <Metric label="Episodio attivo" value={episode.title} />
      <Metric label="Problema principale" value={episode.primary_problem || 'Non registrato'} />
      <Metric label="Distretto" value={episode.body_region || 'Non registrato'} />
      <Metric label="Dolore attuale" value={last?.post_pain == null ? 'Non disponibile' : `${last.post_pain}/10`} />
      <Metric label="Sedute firmate" value={String(finalized.length)} />
      <Metric label="Ultima seduta" value={last ? fmtD(last.occurred_at) : 'Nessuna'} />
      <Metric label="Problemi attivi" value={String((detail?.problems || []).filter((p) => p.status !== 'resolved').length)} />
      <Metric label="Obiettivi" value={String((detail?.goals || []).length)} />
      <Metric label="Piano" value={detail?.plans?.[0] ? `Versione ${detail.plans[0].version_number}` : 'Non definito'} />
    </div>
    {(detail?.anamnesis?.red_flags || last?.adverse_events) && <div style={{ ...card, borderColor: C.dan, background: C.danL }}><b>Alert clinici</b><div>{detail?.anamnesis?.red_flags || last?.adverse_events}</div></div>}
  </div>;
}
function Metric({ label, value }) { return <div style={card}><div style={{ color: C.txl, fontSize: 11, fontWeight: 800, textTransform: 'uppercase' }}>{label}</div><div style={{ marginTop: 5, fontWeight: 750 }}>{value}</div></div>; }

const ANAMNESIS_FIELDS = [
  ['consultation_reason','Motivo consultazione'],['main_complaint','Disturbo principale'],['onset_description','Insorgenza/durata'],['trend','Andamento'],
  ['trauma_mechanism','Traumatico/meccanismo'],['previous_episodes','Episodi precedenti'],['clinical_history','Storia clinica'],['comorbidities','Patologie/comorbidità'],
  ['surgeries','Interventi chirurgici'],['specialist_visits','Visite specialistiche'],['diagnostic_exams','Esami diagnostici'],['medications','Terapia farmacologica'],
  ['allergies','Allergie'],['general_practitioner','MMG'],['specialist','Specialista'],['referrer','Professionista inviante'],['work_activity','Attività lavorativa'],
  ['physical_activity','Attività fisica/sportiva'],['functional_limitations','Limitazioni funzionali'],['aggravating_factors','Fattori aggravanti'],['easing_factors','Fattori allevianti'],
  ['patient_expectations','Aspettative'],['red_flags','Red flags / alert'],['free_note','Nota libera'],
];
function Anamnesis({ studioId, episodeId, value, onSaved }) {
  const [form, setForm] = useState({}); const [advanced, setAdvanced] = useState(false); const [saving, setSaving] = useState(false);
  useEffect(() => setForm(Object.fromEntries(ANAMNESIS_FIELDS.map(([key]) => [key, value?.[key] || '']))), [value, episodeId]);
  const visible = advanced ? ANAMNESIS_FIELDS : ANAMNESIS_FIELDS.filter(([key]) => ['consultation_reason','main_complaint','onset_description','clinical_history','medications','red_flags','free_note'].includes(key));
  const save = async () => { try { setSaving(true); await savePhysioAnamnesis(studioId, episodeId, form); await onSaved(); } finally { setSaving(false); } };
  return <div className="physio-stack"><div className="physio-grid two">{visible.map(([key,label]) => <label className={`physio-label ${key === 'free_note' ? 'wide' : ''}`} key={key}>{label}<textarea style={field} value={form[key] || ''} onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))} /></label>)}</div><div className="physio-actions"><button style={button()} onClick={() => setAdvanced((v) => !v)}>{advanced ? 'Mostra essenziali' : 'Approfondisci anamnesi'}</button><button style={button(true)} disabled={saving} onClick={save}>{saving ? 'Salvataggio…' : 'Salva anamnesi'}</button></div></div>;
}

function BodyMap({ studioId, episodeId, maps, onSaved }) {
  const [view, setView] = useState('front'); const [symptom, setSymptom] = useState('dolore'); const [markers, setMarkers] = useState([]); const [note, setNote] = useState('');
  const toggle = (region) => setMarkers((items) => items.some((m) => m.region === region && m.symptom === symptom) ? items.filter((m) => !(m.region === region && m.symptom === symptom)) : [...items, { region, symptom }]);
  const save = async () => { await saveBodyMap(studioId, episodeId, view, markers, note); setMarkers([]); setNote(''); await onSaved(); };
  return <div className="physio-grid two"><div style={card} className="physio-stack"><div className="physio-actions"><button style={button(view === 'front')} onClick={() => setView('front')}>Anteriore</button><button style={button(view === 'back')} onClick={() => setView('back')}>Posteriore</button></div><label className="physio-label">Sintomo<select style={field} value={symptom} onChange={(e) => setSymptom(e.target.value)}>{SYMPTOMS.map((s) => <option key={s}>{s}</option>)}</select></label><div className="physio-body-regions">{BODY_REGIONS.map((region) => { const active = markers.some((m) => m.region === region && m.symptom === symptom); return <button key={region} style={{ ...button(active), minHeight: 52 }} onClick={() => toggle(region)}>{region}</button>; })}</div><label className="physio-label">Annotazione libera<textarea style={field} value={note} onChange={(e) => setNote(e.target.value)} /></label><button style={button(true)} disabled={!markers.length} onClick={save}>Salva fotografia body map</button></div><div style={card}><h3 style={{ marginTop: 0 }}>Confronto longitudinale</h3>{!maps.length && <p style={{ color: C.txl }}>Nessuna body map salvata.</p>}{maps.map((map) => <div key={map.id} style={{ borderTop: `1px solid ${C.brd}`, padding: '9px 0' }}><b>{fmtD(map.recorded_at)} · {map.view}</b><div style={{ color: C.txm, fontSize: 12 }}>{map.markers.map((m) => `${m.region}: ${m.symptom}`).join(' · ')}</div>{map.note && <div>{map.note}</div>}</div>)}</div></div>;
}

function Sessions({ studioId, episodeId, notes, onSaved }) {
  const sessions = notes.filter((n) => n.note_type === 'session'); const [form, setForm] = useState(EMPTY_NOTE); const [noteId, setNoteId] = useState(null); const [saving, setSaving] = useState(false);
  const change = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));
  const save = async (finalize = false) => { try { setSaving(true); const note = await saveClinicalNote(studioId, episodeId, form, noteId); if (finalize) { if (!window.confirm('Firmare e chiudere la nota? Dopo la firma sarà immutabile.')) return; await finalizeClinicalNote(studioId, note.id); } setForm(EMPTY_NOTE); setNoteId(null); await onSaved(); } finally { setSaving(false); } };
  const duplicate = () => { const previous = sessions.find((n) => n.status === 'finalized'); if (previous && window.confirm('Creare una nuova bozza copiando solo trattamento, esercizi e indicazioni?')) { setForm(draftFromPrevious(previous)); setNoteId(null); } };
  const edit = (n) => { setNoteId(n.id); setForm({ ...EMPTY_NOTE, ...n, pre_pain: n.pre_pain ?? '', post_pain: n.post_pain ?? '' }); };
  const amend = async (n) => { const correction = window.prompt('Correzione da aggiungere senza modificare la nota firmata'); if (correction?.trim()) { await amendClinicalNote(studioId, episodeId, n, correction); await onSaved(); } };
  return <div className="physio-stack"><div style={card}><div className="physio-actions" style={{ marginBottom: 10 }}><button style={button()} onClick={duplicate}>Duplica precedente</button></div><div className="physio-note-grid">
    <label className="physio-label">Dolore prima (0–10)<input style={field} type="number" min="0" max="10" value={form.pre_pain} onChange={change('pre_pain')} /></label>
    <label className="physio-label">Andamento<select style={field} value={form.trend} onChange={change('trend')}><option value="">Non indicato</option><option value="improved">Migliorato</option><option value="stable">Stabile</option><option value="worse">Peggiorato</option><option value="not_comparable">Non confrontabile</option></select></label>
    <label className="physio-label wide">Aggiornamento soggettivo<textarea style={field} value={form.subjective_update} onChange={change('subjective_update')} /></label>
    <label className="physio-label">Trattamento eseguito<textarea style={field} value={form.interventions} onChange={change('interventions')} /></label>
    <label className="physio-label">Esercizi<textarea style={field} value={form.exercises} onChange={change('exercises')} /></label>
    <label className="physio-label">Risposta<textarea style={field} value={form.response} onChange={change('response')} /></label>
    <label className="physio-label">Dolore dopo (0–10)<input style={field} type="number" min="0" max="10" value={form.post_pain} onChange={change('post_pain')} /></label>
    <label className="physio-label">Home program / indicazioni<textarea style={field} value={form.home_instructions} onChange={change('home_instructions')} /></label>
    <label className="physio-label">Prossimo passo<textarea style={field} value={form.next_step} onChange={change('next_step')} /></label>
    <label className="physio-label wide">Nota libera<textarea style={{ ...field, minHeight: 130 }} value={form.free_note} onChange={change('free_note')} /></label>
  </div><div className="physio-actions"><button style={button()} disabled={saving} onClick={() => save(false)}>Salva bozza</button><button style={button(true)} disabled={saving} onClick={() => save(true)}>Firma e chiudi</button></div></div>
  <div className="physio-stack">{sessions.map((n) => <div style={card} key={n.id}><div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}><b>{fmtD(n.occurred_at)} · {n.status}</b><div>{n.status === 'draft' ? <button style={button()} onClick={() => edit(n)}>Modifica bozza</button> : n.status === 'finalized' ? <button style={button()} onClick={() => amend(n)}>Aggiungi correzione</button> : null}</div></div><div style={{ color: C.txm, marginTop: 6 }}>{n.interventions || n.free_note || 'Nota senza riepilogo'}</div></div>)}</div></div>;
}

function Timeline({ detail }) {
  const events = useMemo(() => [
    ...(detail?.notes || []).map((n) => ({ id: `n-${n.id}`, at: n.occurred_at, type: n.note_type, title: n.status === 'amendment' ? 'Correzione' : n.note_type, text: n.free_note || n.interventions || n.subjective_update })),
    ...(detail?.bodyMaps || []).map((m) => ({ id: `b-${m.id}`, at: m.recorded_at, type: 'body_map', title: `Body map ${m.view}`, text: m.note })),
    ...(detail?.plans || []).map((p) => ({ id: `p-${p.id}`, at: p.created_at, type: 'plan', title: `Piano terapeutico v${p.version_number}`, text: p.strategy || p.free_note })),
    ...(detail?.outcomes || []).map((o) => ({ id: `o-${o.id}`, at: o.recorded_at, type: 'outcome', title: `${o.scale_name} · ${o.phase}`, text: o.raw_score == null ? o.clinician_note : `Punteggio ${o.raw_score}${o.unit ? ` ${o.unit}` : ''}` })),
  ].sort((a,b) => new Date(b.at)-new Date(a.at)), [detail]);
  return <div style={card}><div className="physio-timeline">{!events.length && <div style={{ color: C.txl }}>Nessun evento nell’episodio.</div>}{events.map((event) => <div className="physio-event" key={event.id}><div style={{ fontSize: 11, color: C.txl }}>{fmtD(event.at)}</div><b>{event.title}</b>{event.text && <div style={{ color: C.txm, marginTop: 3 }}>{event.text}</div>}</div>)}</div></div>;
}
