import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase.js';
import { Crd, Bdg, Modal, Ic, Btn, Fld, Sel, Inp, Txt, TimePicker } from './ui';
import { apriWaDiretto, waAbilitato } from './ui/WaAction.jsx';
import { C, fmt, fmtD, today } from '../lib/utils';
import { BarChart, Bar, LineChart, Line, ComposedChart, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { useControlloDati } from '../lib/useControlloDati';

const WIDGETS_DEFAULT = [
  { id: 'agenda',       label: '📅 Agenda oggi',            attivo: true },
  { id: 'consigli_ai',  label: '🧭 Consigli AI',              attivo: true },
  { id: 'todo',         label: '✅ Attività e promemoria',   attivo: true },
  { id: 'appuntamenti', label: '📅 Prossimi appuntamenti',   attivo: true },
  { id: 'wa',           label: '💬 Reminder WhatsApp',       attivo: false },
  { id: 'economico',    label: '💰 Pannello economico',      attivo: false },
  { id: 'preventivi',   label: '📋 Preventivi',              attivo: false },
  { id: 'richiami',     label: '🔔 Richiami',                attivo: false },
  { id: 'scadenze',     label: '📆 Scadenze pagamento',      attivo: false },
  { id: 'ortodonzia',   label: '🦷 Ortodonzia',              attivo: false },
  { id: 'statistiche',  label: '📊 Statistiche',             attivo: false },
  { id: 'grafici',      label: '📈 Grafici e andamento',     attivo: false },
];

const PALETTE = [
  '#1A4E66','#2EC4B6','#2D9E61','#7C3AED','#E63946',
  '#F4A261','#EC4899','#0EA5E9','#84CC16','#F59E0B',
  '#6366F1','#14B8A6','#64748B','#DC2626','#059669',
];

const THEME_DEFAULT = {
  incMese: C?.suc || '#2D9E61',
  incAnno: C?.suc || '#2D9E61',
  lucaMese: '#7C3AED',
  lucaAnno: '#7C3AED',
  speseMese: C?.dan || '#E63946',
  speseAnno: C?.dan || '#E63946',
  margine: C?.suc || '#2D9E61',
  esegDaInc: C?.dan || '#E63946',
  accNonEseg: '#7C3AED',
  totAccettati: C?.acc || '#2EC4B6',
};

const loadTheme = () => {
  try { return { ...THEME_DEFAULT, ...JSON.parse(localStorage.getItem('dm_theme') || '{}') }; }
  catch { return THEME_DEFAULT; }
};
const saveTheme = (t) => { try { localStorage.setItem('dm_theme', JSON.stringify(t)); } catch {} };

const loadWidgets = () => {
  try {
    const saved = JSON.parse(localStorage.getItem('dm_widgets') || 'null');
    if (!saved) return WIDGETS_DEFAULT;
    const ids = saved.map(w => w.id);
    const missing = WIDGETS_DEFAULT.filter(w => !ids.includes(w.id));
    return [...saved, ...missing];
  } catch { return WIDGETS_DEFAULT; }
};

const saveWidgets = (ws) => {
  try { localStorage.setItem('dm_widgets', JSON.stringify(ws)); } catch {}
};

const NOMI_F = ['alessia','alice','anna','beatrice','camilla','chiara','claudia','elena','elisa','emma','federica','francesca','giulia','ilaria','laura','lisa','lucia','luisa','mara','maria','marina','martina','monica','paola','roberta','sara','silvia','sofia','valentina','veronica','virginia'];
const getSaluto = (nome) => { if (!nome) return 'Benvenuto'; const ora = new Date().getHours(); const s = ora < 12 ? 'Buongiorno' : ora < 18 ? 'Buon pomeriggio' : 'Buonasera'; const p = nome.trim().split(' ')[0].toLowerCase(); const fem = NOMI_F.includes(p) || (p.endsWith('a') && !['luca','andrea','mattia','nicola','enea'].includes(p)); return s + ', ' + (fem ? 'cara ' : 'caro ') + nome.trim().split(' ')[0]; };

export default function Dashboard({ patients, appointments, setAppointments, payments, plans, richiami = [], onOpenPaz, appTypes, onGoAgenda, onGoRichiami, templates, userName: userNameProp, si, features, studioId, isStudioAdmin }) {
  // Widget economico/operativi (preventivi, richiami, scadenze, ortodonzia,
  // statistiche, grafici): stessa fonte di calcolo di Controllo di Gestione,
  // vedi useControlloDati — evita di ricalcolare qui gli stessi numeri con
  // una logica potenzialmente diversa (era esattamente il problema di
  // Dashboard/ControlloGestione risolto in precedenza per i KPI economici).
  const [periodoEconomico, setPeriodoEconomico] = useState('mese');
  const {
    kpi: kpiPeriodo, kpiLoading: kpiPeriodoLoading, pagExt,
    mInc, aInc, extMese, extAnno, incassoLucaMese, incassoLucaAnno,
    esegDaInc, totEsegDaInc, accNonEseg, totAccNonEseg,
    preventiviAccettati, preventiviAttesa, preventiviRifiutati, totAccettati, tassoAccettazione,
    scadenzePagamento, scadenzeScadute, scadenzeProssime,
    pianiOrto,
    nuoviMese, mediaValore, topPrest,
    andamentoMensile, incassoPerPrestazione, incassoPerGiorno, speseMensili, speseCategoria,
    spese, calcPlanTot,
  } = useControlloDati({ studioId, patients, plans, payments, periodo: periodoEconomico });

  const isDentistico = !si?.vertical || si.vertical === 'dentistico';
  const t = today();
  const [userName, setUserName] = useState(userNameProp || '');

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      const m = session?.user?.user_metadata;
      if (m?.nome) setUserName((m.nome + ' ' + (m.cognome || '')).trim());
    });
  }, []);
  const anno = t.slice(0, 4);

  // ── Consigli AI: consulente CFO/marketing proattivo, generato in
  // background (genera-consigli-ai) senza che nessuno apra la chat — stesso
  // spirito del bot Richiami. Solo per admin dello studio (RLS lo impone
  // comunque) e solo al livello Premium dell'assistente (è la funzione che
  // lo genera a deciderlo server-side; qui evitiamo solo la chiamata inutile).
  const [consigli, setConsigli] = useState([]);
  const [consigliLoading, setConsigliLoading] = useState(false);
  const [consigliErr, setConsigliErr] = useState('');
  const consigliAttivi = isStudioAdmin && features?.assistente_ai === 'premium';

  const rigeneraConsigli = async () => {
    setConsigliLoading(true);
    setConsigliErr('');
    try {
      const { data, error } = await supabase.functions.invoke('genera-consigli-ai');
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setConsigli(data.consigli || []);
    } catch (e) {
      setConsigliErr(e.message || 'Errore nella generazione dei consigli');
    } finally {
      setConsigliLoading(false);
    }
  };

  const segnaLettoConsiglio = async (id) => {
    setConsigli((prev) => prev.map((c) => (c.id === id ? { ...c, letto: true } : c)));
    await supabase.from('ai_agent_consigli').update({ letto: true }).eq('id', id);
  };

  useEffect(() => {
    if (!consigliAttivi) return;
    let cancelled = false;
    supabase.from('ai_agent_consigli').select('*').order('creato_il', { ascending: false }).limit(4).then(({ data }) => {
      if (cancelled) return;
      setConsigli(data || []);
      const piuRecente = data && data[0] ? new Date(data[0].creato_il) : null;
      const settimanaFa = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      if (!piuRecente || piuRecente < settimanaFa) rigeneraConsigli();
    });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [consigliAttivi]);

  const [detailModal, setDetailModal] = useState(null);
  const [editApp, setEditApp] = useState(null);
  const [editForm, setEditForm] = useState(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [mostraGraficiDash, setMostraGraficiDash] = useState(false);
  const [widgets, setWidgets] = useState(loadWidgets);
  const [theme, setTheme] = useState(loadTheme);
  const [themeTab, setThemeTab] = useState('widgets'); // 'widgets' | 'colori'
  const isOn = (id) => { const w = widgets.find(x => x.id === id); return w ? w.attivo !== false : true; };
  const [todoList, setTodoList] = useState([]);
  const [todoInput, setTodoInput] = useState('');
  const [todoModal, setTodoModal] = useState(false);
  const [todoLoading, setTodoLoading] = useState(false);
  useEffect(() => {
    loadTodos();
    // Realtime: aggiorna automaticamente quando cambiano i todo
    const channel = supabase.channel('todos-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'todos' }, () => { loadTodos(); })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const loadTodos = async () => {
    setTodoLoading(true);
    const { data, error } = await supabase.from('todos').select('*').order('created_at', { ascending: false });
    if (!error && data) setTodoList(data);
    setTodoLoading(false);
  };

  const addTodo = async () => {
    if (!todoInput.trim()) return;
    const nuova = { id: Date.now(), testo: todoInput.trim(), fatto: false, data: t };
    const { error } = await supabase.from('todos').insert([nuova]);
    if (!error) { setTodoList(prev => [nuova, ...prev]); setTodoInput(''); }
  };

  const toggleTodo = async (id) => {
    const todo = todoList.find(x => x.id === id);
    if (!todo) return;
    const { error } = await supabase.from('todos').update({ fatto: !todo.fatto }).eq('id', id);
    if (!error) setTodoList(prev => prev.map(x => x.id === id ? { ...x, fatto: !x.fatto } : x));
  };

  const deleteTodo = async (id) => {
    const { error } = await supabase.from('todos').delete().eq('id', id);
    if (!error) setTodoList(prev => prev.filter(x => x.id !== id));
  };

  const getColore = (a) => {
    if (a.colore) return a.colore;
    if (appTypes) { const t = appTypes.find(x => x.nome === a.tipo); if (t) return t.colore; }
    return C.pri;
  };

  // ── CALCOLI ──
  const todayApps = appointments.filter(a => a.data === t).sort((a, b) => a.ora.localeCompare(b.ora));
  const upcoming = [...appointments].filter(a => a.data > t).sort((a, b) => a.data.localeCompare(b.data) || a.ora.localeCompare(b.ora)).slice(0, 8);

  const apriEditApp = (a) => {
    setEditApp(a);
    setEditForm({ data: a.data, ora: a.ora, durata: a.durata, tipo: a.tipo, stato: a.stato || 'confermato', note: a.note || '' });
  };
  const salvaEditApp = () => {
    if (!editApp || !setAppointments) return;
    setAppointments(prev => prev.map(x => x.id === editApp.id ? { ...x, ...editForm, durata: Number(editForm.durata) } : x));
    setEditApp(null);
  };
  const eliminaEditApp = () => {
    if (!editApp || !setAppointments) return;
    if (!confirm('Eliminare questo appuntamento?')) return;
    setAppointments(prev => prev.filter(x => x.id !== editApp.id));
    setEditApp(null);
  };
  const eliminaAppuntamentoDiretto = (a) => {
    if (!setAppointments) return;
    if (!confirm('Eliminare questo appuntamento?')) return;
    setAppointments(prev => prev.filter(x => x.id !== a.id));
  };
  const domani = (() => { const d = new Date(t + 'T12:00'); d.setDate(d.getDate() + 1); return d.toISOString().slice(0,10); })();
  const domaniApps = appointments.filter(a => a.data === domani).sort((a, b) => a.ora.localeCompare(b.ora));

  const hInc = payments.filter(p => p.data === t).reduce((s, p) => s + Number(p.importo), 0);
  const speseMese = spese.filter(s => !s.ricorrente && s.data && s.data.startsWith(t.slice(0,7))).reduce((s, x) => s + Number(x.importo), 0);
  const speseAnnoTotale = kpiPeriodo ? kpiPeriodo.costi_totali : null;
  const margineAnno = kpiPeriodo ? kpiPeriodo.ebitda : null;
  const speseRicorrentiAnno = spese.filter(s => s.ricorrente).reduce((s, x) => {
    const m = { Mensile: 12, Bimestrale: 6, Trimestrale: 4, Semestrale: 2, Annuale: 1 }[x.frequenza] || 12;
    return s + Number(x.importo) * m;
  }, 0); // usata solo come nota informativa "proiezione a regime", non nel totale

  const promemoria = patients.flatMap(paz => (paz.annotazioni || []).filter(a => a.richiamo && !a.richiamo.fatto).map(a => ({ paz, ann: a, richiamo: a.richiamo }))).sort((a, b) => (a.richiamo.data || '').localeCompare(b.richiamo.data || ''));

  const CHART_PALETTE = [C.pri, C.acc, C.war, C.suc, '#7C3AED', C.dan, C.txl];
  const todoAttivi = todoList.filter(x => !x.fatto);
  const todoFatti = todoList.filter(x => x.fatto);

  const StatCard = ({ label, value, sub, color = C.pri, bg, onClick, urgent }) => (
    <div onClick={onClick} style={{ background: bg || (color + '12'), borderRadius: 12, padding: '12px 14px', border: `1px solid ${color}25`, cursor: onClick ? 'pointer' : 'default', position: 'relative' }}>
      {urgent && <div style={{ position: 'absolute', top: 8, right: 8, width: 8, height: 8, borderRadius: '50%', background: C.dan }} />}
      <div style={{ fontSize: 10, fontWeight: 800, color, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 900, color, lineHeight: 1.1 }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: color + 'AA', marginTop: 3 }}>{sub}</div>}
      {onClick && <div style={{ position: 'absolute', bottom: 8, right: 10, fontSize: 12, color: color + '80' }}>›</div>}
    </div>
  );

  return (
    <div>
      {/* ── SETTINGS MODAL ── */}
      {settingsOpen && (
        <Modal title="⚙️ Personalizza dashboard" onClose={() => setSettingsOpen(false)}>
          {/* TAB SWITCHER */}
          <div style={{ display: 'flex', background: C.bg, borderRadius: 9, border: `1px solid ${C.brd}`, marginBottom: 14, overflow: 'hidden' }}>
            {[['widgets','📦 Widget'],['colori','🎨 Colori card']].map(([id, lbl]) => (
              <button key={id} onClick={() => setThemeTab(id)} style={{ flex: 1, padding: '9px 0', border: 'none', background: themeTab === id ? C.pri : 'transparent', color: themeTab === id ? '#fff' : C.txm, fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>{lbl}</button>
            ))}
          </div>

          {/* TAB WIDGET */}
          {themeTab === 'widgets' && <>
            <div style={{ fontSize: 12, color: C.txm, marginBottom: 12 }}>Trascina ⠿ per riordinare · toggle per attivare/disattivare</div>
            {widgets.map((w, i) => {
              if (w.id === 'consigli_ai' && !consigliAttivi) return null;
              return (
              <div key={w.id} draggable
                onDragStart={e => e.dataTransfer.setData('widgetIdx', String(i))}
                onDragOver={e => e.preventDefault()}
                onDrop={e => {
                  const from = Number(e.dataTransfer.getData('widgetIdx'));
                  if (from === i) return;
                  const next = [...widgets];
                  const [moved] = next.splice(from, 1);
                  next.splice(i, 0, moved);
                  setWidgets(next); saveWidgets(next);
                }}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '11px 10px', marginBottom: 6, background: C.bg, borderRadius: 10, border: `1px solid ${C.brd}`, cursor: 'grab', userSelect: 'none' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 18, color: C.txl }}>⠿</span>
                  <span style={{ fontSize: 13, fontWeight: 600, color: w.attivo !== false ? C.txt : C.txl }}>{w.label}</span>
                </div>
                <button onClick={() => {
                  const next = widgets.map(x => x.id === w.id ? { ...x, attivo: x.attivo === false } : x);
                  setWidgets(next); saveWidgets(next);
                }} style={{ width: 44, height: 24, borderRadius: 12, background: w.attivo !== false ? C.pri : C.brd, border: 'none', cursor: 'pointer', position: 'relative', flexShrink: 0 }}>
                  <div style={{ width: 18, height: 18, borderRadius: '50%', background: '#fff', position: 'absolute', top: 3, left: w.attivo !== false ? 23 : 3, transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }} />
                </button>
              </div>
              );
            })}
            <button onClick={() => { setWidgets([...WIDGETS_DEFAULT]); saveWidgets([...WIDGETS_DEFAULT]); }} style={{ width: '100%', padding: '9px', marginTop: 8, background: C.danL, border: 'none', borderRadius: 9, color: C.dan, fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>↺ Ripristina ordine predefinito</button>
          </>}

          {/* TAB COLORI */}
          {themeTab === 'colori' && <>
            <div style={{ fontSize: 12, color: C.txm, marginBottom: 14 }}>Scegli il colore per ogni card del pannello economico.</div>
            {[
              ['incMese', '📈 Incassato mese'],
              ['incAnno', '📈 Incassato anno'],
              ['lucaMese', '💼 Incasso mese'],
              ['lucaAnno', '💼 Incasso anno'],
              ['speseMese', '💸 Spese mese'],
              ['speseAnno', '💸 Spese anno'],
              ['margine', '✅ Margine stimato'],
              ['esegDaInc', '💰 Eseguito da incassare'],
              ['accNonEseg', '✓ Accettato da eseguire'],
              ['totAccettati', '✓ Totale accettati'],
            ].map(([key, label]) => (
              <div key={key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0', borderBottom: `1px solid ${C.brd}` }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: C.txt }}>{label}</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', maxWidth: 160, justifyContent: 'flex-end' }}>
                    {PALETTE.map(col => (
                      <button key={col} onClick={() => { const next = { ...theme, [key]: col }; setTheme(next); saveTheme(next); }}
                        style={{ width: 18, height: 18, borderRadius: 4, background: col, border: theme[key] === col ? '2px solid #000' : '1px solid rgba(0,0,0,0.15)', cursor: 'pointer', padding: 0, flexShrink: 0 }} />
                    ))}
                  </div>
                  <div style={{ width: 28, height: 28, borderRadius: 6, background: theme[key], border: '2px solid rgba(0,0,0,0.15)', flexShrink: 0 }} />
                </div>
              </div>
            ))}
            <button onClick={() => { setTheme(THEME_DEFAULT); saveTheme(THEME_DEFAULT); }} style={{ width: '100%', padding: '9px', marginTop: 12, background: C.danL, border: 'none', borderRadius: 9, color: C.dan, fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>↺ Ripristina colori predefiniti</button>
          </>}
        </Modal>
      )}

      {/* ── MODALS ── */}
      {detailModal === 'attesa' && (
        <Modal title="⏳ Preventivi in attesa" onClose={() => setDetailModal(null)} wide>
          <div style={{ background: C.purL, borderRadius: 10, padding: '10px 14px', marginBottom: 12, display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ fontWeight: 700, color: C.pur }}>{preventiviAttesa.length} preventivi in attesa di risposta</span>
          </div>
          {preventiviAttesa.length === 0 && <div style={{ textAlign: 'center', color: C.txl, padding: 30 }}>Nessun preventivo in attesa</div>}
          {preventiviAttesa.map(pl => {
            const paz = patients.find(x => x.id === pl.pazienteId);
            if (!paz) return null;
            const tot = calcPlanTot(pl);
            return (
              <Crd key={pl.id} style={{ marginBottom: 8, borderLeft: `3px solid ${C.pur}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div onClick={() => { setDetailModal(null); onOpenPaz(paz, 'piani'); }} style={{ fontWeight: 700, color: C.pri, cursor: 'pointer', fontSize: 13 }}>{paz.nome} {paz.cognome} ›</div>
                    <div style={{ fontSize: 11, color: C.txm }}>{pl.titolo} · {fmtD(pl.data)}</div>
                  </div>
                  <span style={{ fontWeight: 900, color: C.pur }}>{fmt(tot)}</span>
                </div>
              </Crd>
            );
          })}
        </Modal>
      )}

      {detailModal === 'rifiutati' && (
        <Modal title="✗ Preventivi rifiutati" onClose={() => setDetailModal(null)} wide>
          <div style={{ background: C.danL, borderRadius: 10, padding: '10px 14px', marginBottom: 12 }}>
            <span style={{ fontWeight: 700, color: C.dan }}>{preventiviRifiutati.length} preventivi non accettati</span>
          </div>
          {preventiviRifiutati.length === 0 && <div style={{ textAlign: 'center', color: C.txl, padding: 30 }}>Nessun preventivo rifiutato</div>}
          {preventiviRifiutati.map(pl => {
            const paz = patients.find(x => x.id === pl.pazienteId);
            if (!paz) return null;
            const tot = calcPlanTot(pl);
            return (
              <Crd key={pl.id} style={{ marginBottom: 8, borderLeft: `3px solid ${C.dan}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div onClick={() => { setDetailModal(null); onOpenPaz(paz, 'piani'); }} style={{ fontWeight: 700, color: C.pri, cursor: 'pointer', fontSize: 13 }}>{paz.nome} {paz.cognome} ›</div>
                    <div style={{ fontSize: 11, color: C.txm }}>{pl.titolo} · {fmtD(pl.data)}</div>
                  </div>
                  <span style={{ fontWeight: 900, color: C.dan }}>{fmt(tot)}</span>
                </div>
              </Crd>
            );
          })}
        </Modal>
      )}

      {detailModal === 'accettati' && (
        <Modal title="✓ Piani accettati" onClose={() => setDetailModal(null)} wide>
          <div style={{ background: '#E8FAF9', borderRadius: 10, padding: '10px 14px', marginBottom: 12, display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ fontWeight: 700, color: C.acc }}>Totale accettato</span>
            <span style={{ fontWeight: 900, fontSize: 18, color: C.acc }}>{fmt(totAccettati)}</span>
          </div>
          {preventiviAccettati.map(pl => { const paz = patients.find(x => x.id === pl.pazienteId); if (!paz) return null; const done = pl.voci.filter(v => v.eseguita).length; const pct = pl.voci.length ? Math.round(done/pl.voci.length*100) : 0; return (
            <Crd key={pl.id} style={{ marginBottom: 8, borderLeft: `3px solid ${C.acc}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                <div style={{ flex: 1 }}>
                  <div onClick={() => { setDetailModal(null); onOpenPaz(paz, 'piani'); }} style={{ fontWeight: 700, color: C.pri, cursor: 'pointer', fontSize: 13 }}>{paz.nome} {paz.cognome} ›</div>
                  <div style={{ fontSize: 11, color: C.txm }}>{pl.titolo}</div>
                  <div style={{ background: C.bg, borderRadius: 3, height: 4, marginTop: 5 }}><div style={{ height: '100%', width: `${pct}%`, background: C.acc, borderRadius: 3 }} /></div>
                  <div style={{ fontSize: 10, color: C.txl, marginTop: 2 }}>{done}/{pl.voci.length} eseguite</div>
                </div>
                <span style={{ fontWeight: 900, color: C.acc }}>{fmt(calcPlanTot(pl))}</span>
              </div>
            </Crd>
          ); })}
        </Modal>
      )}

      {detailModal === 'lucaMese' && (
        <Modal title="💼 Incasso — questo mese" onClose={() => setDetailModal(null)} wide>
          <div style={{ background: '#F5F3FF', borderRadius: 10, padding: '10px 14px', marginBottom: 12, display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ fontWeight: 700, color: '#7C3AED' }}>Totale mese</span>
            <span style={{ fontWeight: 900, fontSize: 18, color: '#7C3AED' }}>{fmt(incassoLucaMese)}</span>
          </div>
          <div style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: C.suc, textTransform: 'uppercase', marginBottom: 6 }}>🦷 Studio ({fmt(mInc)})</div>
            {payments.filter(p => p.data && p.data.startsWith(t.slice(0,7))).sort((a,b) => b.data.localeCompare(a.data)).map(pay => {
              const paz = patients.find(x => x.id === pay.pazienteId);
              return <Crd key={pay.id} style={{ marginBottom: 6, borderLeft: `3px solid ${C.suc}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div><div style={{ fontWeight: 700, fontSize: 13 }}>{paz ? `${paz.nome} ${paz.cognome}` : '—'}</div><div style={{ fontSize: 11, color: C.txm }}>{fmtD(pay.data)} · {pay.metodo}</div></div>
                  <span style={{ fontWeight: 800, color: C.suc }}>{fmt(pay.importo)}</span>
                </div>
              </Crd>;
            })}
            {payments.filter(p => p.data && p.data.startsWith(t.slice(0,7))).length === 0 && <div style={{ fontSize: 12, color: C.txl, padding: '8px 0' }}>Nessun pagamento studio questo mese</div>}
          </div>
          {extMese > 0 && <div>
            <div style={{ fontSize: 11, fontWeight: 800, color: '#7C3AED', textTransform: 'uppercase', marginBottom: 6 }}>🤝 Collaborazioni ({fmt(extMese)})</div>
            {pagExt.filter(p => p.data && p.data.startsWith(t.slice(0,7))).map(pag => (
              <Crd key={pag.id} style={{ marginBottom: 6, borderLeft: '3px solid #7C3AED' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div><div style={{ fontWeight: 700, fontSize: 13 }}>{pag.collaborazione_nome}</div><div style={{ fontSize: 11, color: C.txm }}>{fmtD(pag.data)} · {pag.metodo}</div></div>
                  <span style={{ fontWeight: 800, color: '#7C3AED' }}>{fmt(pag.importo)}</span>
                </div>
              </Crd>
            ))}
          </div>}
        </Modal>
      )}

      {detailModal === 'lucaAnno' && (
        <Modal title={`💼 Incasso — ${anno}`} onClose={() => setDetailModal(null)} wide>
          <div style={{ background: '#F5F3FF', borderRadius: 10, padding: '10px 14px', marginBottom: 12, display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ fontWeight: 700, color: '#7C3AED' }}>Totale anno {anno}</span>
            <span style={{ fontWeight: 900, fontSize: 18, color: '#7C3AED' }}>{fmt(incassoLucaAnno)}</span>
          </div>
          <div style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: C.suc, textTransform: 'uppercase', marginBottom: 6 }}>🦷 Studio ({fmt(aInc)})</div>
            {(() => {
              const mesiStudio = {};
              payments.filter(p => p.data && p.data.startsWith(anno)).forEach(p => { const m = p.data.slice(0,7); mesiStudio[m] = (mesiStudio[m] || 0) + Number(p.importo); });
              const MESI = ['Gen','Feb','Mar','Apr','Mag','Giu','Lug','Ago','Set','Ott','Nov','Dic'];
              return Object.entries(mesiStudio).sort((a,b) => b[0].localeCompare(a[0])).map(([m, tot]) => (
                <Crd key={m} style={{ marginBottom: 6, borderLeft: `3px solid ${C.suc}` }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontWeight: 600 }}>{MESI[parseInt(m.slice(5))-1]} {m.slice(0,4)}</span>
                    <span style={{ fontWeight: 800, color: C.suc }}>{fmt(tot)}</span>
                  </div>
                </Crd>
              ));
            })()}
          </div>
          {extAnno > 0 && <div>
            <div style={{ fontSize: 11, fontWeight: 800, color: '#7C3AED', textTransform: 'uppercase', marginBottom: 6 }}>🤝 Collaborazioni ({fmt(extAnno)})</div>
            {(() => {
              const mesiExt = {};
              pagExt.filter(p => p.data && p.data.startsWith(anno)).forEach(p => { const key = p.collaborazione_nome + '|' + p.data.slice(0,7); mesiExt[key] = (mesiExt[key] || { nome: p.collaborazione_nome, mese: p.data.slice(0,7), tot: 0 }); mesiExt[key].tot += Number(p.importo); });
              const MESI = ['Gen','Feb','Mar','Apr','Mag','Giu','Lug','Ago','Set','Ott','Nov','Dic'];
              return Object.values(mesiExt).sort((a,b) => b.mese.localeCompare(a.mese)).map((x, i) => (
                <Crd key={i} style={{ marginBottom: 6, borderLeft: '3px solid #7C3AED' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <div><span style={{ fontWeight: 600 }}>{x.nome}</span><div style={{ fontSize: 11, color: C.txl }}>{MESI[parseInt(x.mese.slice(5))-1]} {x.mese.slice(0,4)}</div></div>
                    <span style={{ fontWeight: 800, color: '#7C3AED' }}>{fmt(x.tot)}</span>
                  </div>
                </Crd>
              ));
            })()}
          </div>}
        </Modal>
      )}

      {detailModal === 'spese' && (
        <Modal title="💸 Spese" onClose={() => setDetailModal(null)} wide>
          <div style={{ background: C.danL, borderRadius: 10, padding: '10px 14px', marginBottom: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
              <span style={{ fontWeight: 700, color: C.dan }}>Costi {anno} (dato reale a oggi)</span>
              <span style={{ fontWeight: 900, fontSize: 18, color: C.dan }}>{speseAnnoTotale == null ? '—' : fmt(speseAnnoTotale)}</span>
            </div>
            {speseRicorrentiAnno > 0 && <div style={{ fontSize: 11, color: C.txm }}>Se tutte le ricorrenti attuali restassero invariate un anno intero: {fmt(speseRicorrentiAnno)}/anno a regime</div>}
          </div>
          {margineAnno != null && margineAnno !== 0 && (
            <div style={{ background: margineAnno > 0 ? C.sucL : C.danL, borderRadius: 10, padding: '8px 14px', marginBottom: 12, display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontWeight: 700, color: margineAnno > 0 ? C.suc : C.dan }}>EBITDA {anno} (dato reale, stessa fonte di Controllo di Gestione)</span>
              <span style={{ fontWeight: 900, color: margineAnno > 0 ? C.suc : C.dan }}>{margineAnno > 0 ? '+' : ''}{fmt(margineAnno)}</span>
            </div>
          )}
          {spese.filter(s => s.ricorrente).length > 0 && (
            <>
              <div style={{ fontSize: 11, fontWeight: 800, color: C.war, textTransform: 'uppercase', marginBottom: 8 }}>🔄 Ricorrenti</div>
              {spese.filter(s => s.ricorrente).map(s => {
                const m = { Mensile: 12, Bimestrale: 6, Trimestrale: 4, Semestrale: 2, Annuale: 1 }[s.frequenza] || 12;
                return <Crd key={s.id} style={{ marginBottom: 6, borderLeft: `3px solid ${C.war}` }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <div><div style={{ fontWeight: 700, fontSize: 13 }}>{s.titolo}</div><div style={{ fontSize: 11, color: C.txm }}>{s.frequenza} · {fmt(s.importo)} × {m}</div></div>
                    <span style={{ fontWeight: 800, color: C.war }}>{fmt(Number(s.importo) * m)}/anno</span>
                  </div>
                </Crd>;
              })}
            </>
          )}
          <div style={{ fontSize: 11, fontWeight: 800, color: C.dan, textTransform: 'uppercase', margin: '12px 0 8px' }}>📋 Questo mese ({fmt(speseMese)})</div>
          {spese.filter(s => !s.ricorrente && s.data && s.data.startsWith(t.slice(0,7))).length === 0
            ? <div style={{ textAlign: 'center', color: C.txl, padding: 16 }}>Nessuna spesa questo mese</div>
            : spese.filter(s => !s.ricorrente && s.data && s.data.startsWith(t.slice(0,7))).map(s => (
              <Crd key={s.id} style={{ marginBottom: 6, borderLeft: `3px solid ${C.dan}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <div><div style={{ fontWeight: 700, fontSize: 13 }}>{s.titolo}</div><div style={{ fontSize: 11, color: C.txm }}>{s.categoria}</div></div>
                  <span style={{ fontWeight: 800, color: C.dan }}>{fmt(s.importo)}</span>
                </div>
              </Crd>
            ))
          }
        </Modal>
      )}

      {detailModal === 'esegDaInc' && (
        <Modal title="💰 Eseguito da incassare" onClose={() => setDetailModal(null)} wide>
          <div style={{ background: C.danL, borderRadius: 10, padding: '10px 14px', marginBottom: 12, display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ fontWeight: 700, color: C.dan }}>Totale da incassare</span>
            <span style={{ fontWeight: 900, fontSize: 18, color: C.dan }}>{fmt(totEsegDaInc)}</span>
          </div>
          {esegDaInc.map(({ paz, voci, tot }) => (
            <Crd key={paz.id} style={{ marginBottom: 9, borderLeft: `3px solid ${C.dan}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <div onClick={() => { setDetailModal(null); onOpenPaz(paz, 'piani'); }} style={{ fontWeight: 700, color: C.pri, cursor: 'pointer' }}>{paz.nome} {paz.cognome} ›</div>
                <span style={{ fontWeight: 900, color: C.dan }}>{fmt(tot)}</span>
              </div>
              {voci.map((v, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderTop: `1px solid ${C.brd}`, fontSize: 11 }}>
                  <span>{v.prestazione}{v.dente ? ` · d.${v.dente}` : ''}</span>
                  <span style={{ fontWeight: 700, color: C.dan }}>{fmt(v.prezzoScontato)}</span>
                </div>
              ))}
            </Crd>
          ))}
          {esegDaInc.length === 0 && <div style={{ textAlign: 'center', color: C.txl, padding: 30 }}>Nessuna prestazione eseguita da incassare 🎉</div>}
        </Modal>
      )}

      {detailModal === 'accNonEseg' && (
        <Modal title="✓ Accettato da eseguire" onClose={() => setDetailModal(null)} wide>
          <div style={{ background: C.purL, borderRadius: 10, padding: '10px 14px', marginBottom: 12, display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ fontWeight: 700, color: C.pur }}>Totale accettato da eseguire</span>
            <span style={{ fontWeight: 900, fontSize: 18, color: C.pur }}>{fmt(totAccNonEseg)}</span>
          </div>
          {accNonEseg.map(({ paz, voci, tot }) => (
            <Crd key={paz.id} style={{ marginBottom: 9, borderLeft: `3px solid ${C.pur}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <div onClick={() => { setDetailModal(null); onOpenPaz(paz, 'piani'); }} style={{ fontWeight: 700, color: C.pri, cursor: 'pointer' }}>{paz.nome} {paz.cognome} ›</div>
                <span style={{ fontWeight: 900, color: C.pur }}>{fmt(tot)}</span>
              </div>
              {voci.slice(0,4).map((v, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderTop: `1px solid ${C.brd}`, fontSize: 11 }}>
                  <span>{v.prestazione}{v.dente ? ` · d.${v.dente}` : ''}</span>
                  <span style={{ fontWeight: 700, color: C.pur }}>{fmt(v.prezzo)}</span>
                </div>
              ))}
              {voci.length > 4 && <div style={{ fontSize: 10, color: C.txl, textAlign: 'center', marginTop: 4 }}>+{voci.length-4} altre</div>}
            </Crd>
          ))}
        </Modal>
      )}

      {detailModal === 'scadenze' && (
        <Modal title="📆 Scadenze pagamento" onClose={() => setDetailModal(null)} wide>
          {scadenzePagamento.length === 0 && <div style={{ textAlign: 'center', color: C.txl, padding: 30 }}>Nessuna scadenza impostata</div>}
          {scadenzeScadute.length > 0 && (
            <>
              <div style={{ fontSize: 11, fontWeight: 800, color: C.dan, textTransform: 'uppercase', marginBottom: 8 }}>⚠️ Scadute ({scadenzeScadute.length})</div>
              {scadenzeScadute.map((s, i) => (
                <Crd key={i} style={{ marginBottom: 8, borderLeft: `3px solid ${C.dan}` }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div onClick={() => { setDetailModal(null); onOpenPaz(s.paz, 'paga'); }} style={{ fontWeight: 700, color: C.pri, cursor: 'pointer', fontSize: 13 }}>{s.paz.nome} {s.paz.cognome} ›</div>
                      <div style={{ fontSize: 11, color: C.txm }}>{s.pl.titolo}</div>
                      <div style={{ fontSize: 11, color: C.dan, fontWeight: 700 }}>Scadenza: {fmtD(s.scadenza)}</div>
                    </div>
                    <span style={{ fontWeight: 900, color: C.dan, fontSize: 16 }}>{fmt(s.importo)}</span>
                  </div>
                </Crd>
              ))}
            </>
          )}
          {scadenzeProssime.length > 0 && (
            <>
              <div style={{ fontSize: 11, fontWeight: 800, color: C.war, textTransform: 'uppercase', margin: '12px 0 8px' }}>📅 Prossime 30 giorni ({scadenzeProssime.length})</div>
              {scadenzeProssime.map((s, i) => (
                <Crd key={i} style={{ marginBottom: 8, borderLeft: `3px solid ${C.war}` }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div onClick={() => { setDetailModal(null); onOpenPaz(s.paz, 'paga'); }} style={{ fontWeight: 700, color: C.pri, cursor: 'pointer', fontSize: 13 }}>{s.paz.nome} {s.paz.cognome} ›</div>
                      <div style={{ fontSize: 11, color: C.txm }}>{s.pl.titolo}</div>
                      <div style={{ fontSize: 11, color: C.war, fontWeight: 700 }}>Scadenza: {fmtD(s.scadenza)}</div>
                    </div>
                    <span style={{ fontWeight: 900, color: C.war, fontSize: 16 }}>{fmt(s.importo)}</span>
                  </div>
                </Crd>
              ))}
            </>
          )}
          {scadenzeScadute.length === 0 && scadenzeProssime.length === 0 && scadenzePagamento.length > 0 && (
            <div style={{ textAlign: 'center', color: C.txl, padding: 30 }}>Tutte le scadenze sono lontane 🎉</div>
          )}
        </Modal>
      )}

      {detailModal === 'orto' && (
        <Modal title="🦷 Ortodonzia — mascherine" onClose={() => setDetailModal(null)} wide>
          {pianiOrto.length === 0 && <div style={{ textAlign: 'center', color: C.txl, padding: 30 }}>Nessun piano ortodontico attivo</div>}
          {pianiOrto.filter(o => o.cambioScaduto).length > 0 && (
            <>
              <div style={{ fontSize: 11, fontWeight: 800, color: C.dan, textTransform: 'uppercase', marginBottom: 8 }}>⚠️ Cambio mascherina scaduto</div>
              {pianiOrto.filter(o => o.cambioScaduto).map(o => (
                <Crd key={o.pl.id} style={{ marginBottom: 8, borderLeft: `3px solid ${C.dan}` }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div onClick={() => { setDetailModal(null); onOpenPaz(o.paz, 'piani'); }} style={{ fontWeight: 700, color: C.pri, cursor: 'pointer', fontSize: 13 }}>{o.paz.nome} {o.paz.cognome} ›</div>
                      <div style={{ fontSize: 11, color: C.txm }}>Mascherina {o.cons}/{o.tot || '?'} · prevista il {fmtD(o.prossima)}</div>
                    </div>
                    <Bdg ch="⚠️ Scaduto" co={C.dan} />
                  </div>
                </Crd>
              ))}
            </>
          )}
          {pianiOrto.filter(o => !o.cambioScaduto && !o.completato).length > 0 && (
            <>
              <div style={{ fontSize: 11, fontWeight: 800, color: C.pur, textTransform: 'uppercase', margin: '12px 0 8px' }}>🔄 In corso</div>
              {pianiOrto.filter(o => !o.cambioScaduto && !o.completato).map(o => {
                const pct = o.tot > 0 ? Math.round(o.cons / o.tot * 100) : 0;
                return (
                  <Crd key={o.pl.id} style={{ marginBottom: 8, borderLeft: `3px solid ${C.pur}` }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                      <div onClick={() => { setDetailModal(null); onOpenPaz(o.paz, 'piani'); }} style={{ fontWeight: 700, color: C.pri, cursor: 'pointer', fontSize: 13 }}>{o.paz.nome} {o.paz.cognome} ›</div>
                      <span style={{ fontWeight: 800, color: C.pur }}>{o.cons}/{o.tot || '?'}</span>
                    </div>
                    {o.tot > 0 && <div style={{ background: C.bg, borderRadius: 4, height: 6 }}><div style={{ height: '100%', width: `${pct}%`, background: C.pur, borderRadius: 4 }} /></div>}
                    <div style={{ fontSize: 11, color: C.txl, marginTop: 4 }}>
                      {o.inAttesa ? '⏳ Da avviare' : `Prossimo cambio: ${o.prossima ? fmtD(o.prossima) : '—'}`}
                    </div>
                  </Crd>
                );
              })}
            </>
          )}
          {pianiOrto.filter(o => o.completato).length > 0 && (
            <>
              <div style={{ fontSize: 11, fontWeight: 800, color: C.suc, textTransform: 'uppercase', margin: '12px 0 8px' }}>✓ Completati</div>
              {pianiOrto.filter(o => o.completato).map(o => (
                <Crd key={o.pl.id} style={{ marginBottom: 8, borderLeft: `3px solid ${C.suc}` }}>
                  <div onClick={() => { setDetailModal(null); onOpenPaz(o.paz, 'piani'); }} style={{ fontWeight: 700, color: C.pri, cursor: 'pointer', fontSize: 13 }}>{o.paz.nome} {o.paz.cognome} ›</div>
                  <div style={{ fontSize: 11, color: C.suc }}>Ciclo di {o.tot} mascherine completato ✓</div>
                </Crd>
              ))}
            </>
          )}
        </Modal>
      )}

      {todoModal && (
        <Modal title="+ Nuova attività" onClose={() => setTodoModal(false)}>
          <textarea value={todoInput} onChange={e => setTodoInput(e.target.value)} autoFocus rows={4} placeholder="es. Richiamare Rossi per RX&#10;es. Ordinare viti Nobel 4.3mm" style={{ width: '100%', padding: '11px 12px', border: `1.5px solid ${C.brd}`, borderRadius: 10, fontSize: 13, color: C.txt, background: C.sur, boxSizing: 'border-box', resize: 'vertical', fontFamily: 'inherit' }} />
          <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
            <Btn ch="Annulla" v="sec" onClick={() => setTodoModal(false)} full />
            <Btn ch="Aggiungi" onClick={() => { addTodo(); setTodoModal(false); }} dis={!todoInput.trim()} full />
          </div>
        </Modal>
      )}

      {/* ── HEADER ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 900, color: C.txt }}>{getSaluto(userName)}</div>
          <div style={{ fontSize: 12, color: C.txl, marginTop: 1 }}>{new Date().toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</div>
        </div>
        <button onClick={() => setSettingsOpen(true)} style={{ background: C.bg, border: `1px solid ${C.brd}`, borderRadius: 10, padding: '8px 12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, color: C.txm, fontSize: 12, fontWeight: 700 }}>
          <Ic n="set" s={14} c={C.txm} /> Personalizza
        </button>
      </div>

      {/* ── WIDGET ORDINATI DINAMICAMENTE ── */}
      {widgets.filter(w => w.attivo !== false).map(w => {
        if (w.id === 'agenda') return (
          <div key="agenda" style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: C.txm, textTransform: 'uppercase', letterSpacing: '0.06em' }}>📅 Agenda oggi</div>
              <button onClick={() => onGoAgenda && onGoAgenda()} style={{ background: C.priL, border: 'none', borderRadius: 7, padding: '5px 10px', color: C.pri, fontWeight: 700, fontSize: 11, cursor: 'pointer' }}>Apri agenda ›</button>
            </div>
            {todayApps.length === 0 ? (
              <Crd style={{ textAlign: 'center', color: C.txl, padding: '16px 0', fontSize: 13 }}>Nessun appuntamento oggi</Crd>
            ) : (
              <Crd style={{ padding: 0, overflow: 'hidden' }}>
                {todayApps.map((a, i) => {
                  const p = patients.find(x => x.id === a.pazienteId);
                  const co = getColore(a);
                  const isPast = a.ora < new Date().toTimeString().slice(0, 5);
                  return (
                    <div key={a.id} onClick={() => onGoAgenda && onGoAgenda()} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderBottom: i < todayApps.length - 1 ? `1px solid ${C.brd}` : 'none', background: isPast ? '#fafafa' : '#fff', cursor: 'pointer' }}>
                      <div style={{ background: co + '20', borderRadius: 8, padding: '4px 8px', textAlign: 'center', flexShrink: 0, minWidth: 44, borderLeft: `3px solid ${co}` }}>
                        <div style={{ fontSize: 13, fontWeight: 900, color: co }}>{a.ora}</div>
                        <div style={{ fontSize: 9, color: co, opacity: 0.8 }}>{a.durata}m</div>
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 700, fontSize: 13, color: isPast ? C.txm : C.txt, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p ? `${p.nome} ${p.cognome}` : '—'}</div>
                        <div style={{ fontSize: 11, color: C.txl, display: 'flex', alignItems: 'center', gap: 5 }}><div style={{ width: 7, height: 7, borderRadius: '50%', background: co }} />{a.tipo}</div>
                      </div>
                      <Bdg ch={a.stato} co={a.stato === 'confermato' ? C.suc : C.war} />
                    </div>
                  );
                })}
              </Crd>
            )}
            {hInc > 0 && <div style={{ marginTop: 6, background: C.sucL, borderRadius: 9, padding: '7px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: C.suc }}>💳 Incassato oggi</span>
              <span style={{ fontSize: 15, fontWeight: 900, color: C.suc }}>{fmt(hInc)}</span>
            </div>}
          </div>
        );

        if (w.id === 'consigli_ai') {
          if (!consigliAttivi) return null;
          const nonLetti = consigli.filter((c) => !c.letto);
          return (
            <div key="consigli_ai" style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <div style={{ fontSize: 11, fontWeight: 800, color: C.txm, textTransform: 'uppercase', letterSpacing: '0.06em' }}>🧭 Consigli AI</div>
                <button onClick={rigeneraConsigli} disabled={consigliLoading} style={{ background: 'none', border: 'none', cursor: consigliLoading ? 'default' : 'pointer', fontSize: 11, fontWeight: 700, color: C.pri, opacity: consigliLoading ? 0.5 : 1 }}>
                  {consigliLoading ? '⏳ Genero…' : '🔄 Rigenera'}
                </button>
              </div>
              {consigliErr && <div style={{ fontSize: 11, color: C.dan, marginBottom: 8 }}>{consigliErr}</div>}
              {!consigliLoading && consigli.length === 0 && !consigliErr && (
                <Crd style={{ textAlign: 'center', color: C.txl, padding: '16px 0', fontSize: 13 }}>Genero i primi consigli, un attimo…</Crd>
              )}
              {!consigliLoading && consigli.length > 0 && nonLetti.length === 0 && (
                <Crd style={{ textAlign: 'center', color: C.txl, padding: '16px 0', fontSize: 13 }}>Hai letto tutti i consigli di questa settimana ✓</Crd>
              )}
              {nonLetti.map((c) => {
                const colore = c.categoria === 'cfo' ? C.pri : c.categoria === 'commerciale' ? C.war : C.pur;
                const label = c.categoria === 'cfo' ? '💰 CFO' : c.categoria === 'commerciale' ? '🤝 Commerciale' : '📈 Marketing';
                const paz = c.paziente_id ? patients.find(p => p.id === c.paziente_id) : null;
                return (
                  <Crd key={c.id} style={{ marginBottom: 8, borderLeft: `3px solid ${colore}` }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ marginBottom: 5 }}><Bdg ch={label} co={colore} /></div>
                        <div style={{ fontWeight: 800, fontSize: 13, marginBottom: 3, color: C.txt }}>{c.titolo}</div>
                        <div style={{ fontSize: 12, color: C.txm, lineHeight: 1.45 }}>{c.testo}</div>
                        {paz && (
                          <div onClick={() => onOpenPaz(paz, 'info')} style={{ marginTop: 6, fontSize: 12, fontWeight: 700, color: C.pri, cursor: 'pointer' }}>{paz.nome} {paz.cognome} ›</div>
                        )}
                      </div>
                      <button onClick={() => segnaLettoConsiglio(c.id)} title="Segna come letto" style={{ background: C.sucL, border: 'none', borderRadius: 7, padding: 6, cursor: 'pointer', flexShrink: 0, height: 'fit-content' }}>
                        <Ic n="ok" s={13} c={C.suc} />
                      </button>
                    </div>
                  </Crd>
                );
              })}
            </div>
          );
        }

        if (w.id === 'todo') return (
          <div key="todo" style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: C.txm, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>✅ Attività e promemoria</div>
            <Crd style={{ marginBottom: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ fontSize: 12, fontWeight: 700 }}>Attività {todoAttivi.length > 0 && <span style={{ background: C.dan, color: '#fff', borderRadius: 8, padding: '1px 6px', fontSize: 10 }}>{todoAttivi.length}</span>}</span>
                <button onClick={() => setTodoModal(true)} style={{ background: C.pri, border: 'none', borderRadius: 7, padding: '5px 10px', color: '#fff', fontWeight: 700, fontSize: 11, cursor: 'pointer' }}>+ Aggiungi</button>
              </div>
              {todoLoading && <div style={{ fontSize: 12, color: C.txl, textAlign: 'center', padding: '8px 0' }}>⏳ Caricamento...</div>}
              {!todoLoading && todoAttivi.length === 0 && <div style={{ fontSize: 12, color: C.txl, textAlign: 'center', padding: '8px 0' }}>Nessuna attività in sospeso 🎉</div>}
              <div style={{ maxHeight: 220, overflowY: 'auto' }}>
                {todoAttivi.map(todo => (
                  <div key={todo.id} style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '7px 0', borderBottom: `1px solid ${C.brd}` }}>
                    <button onClick={() => toggleTodo(todo.id)} style={{ width: 20, height: 20, borderRadius: 5, border: `2px solid ${C.brd}`, background: '#fff', cursor: 'pointer', flexShrink: 0, padding: 0 }} />
                    <span style={{ flex: 1, fontSize: 12, fontWeight: 600 }}>{todo.testo}</span>
                    <button onClick={() => { const msg = encodeURIComponent('📋 Attività: ' + todo.testo); window.open('https://wa.me/?text=' + msg, '_blank'); }} style={{ background: '#25D366', border: 'none', borderRadius: 5, padding: '3px 6px', cursor: 'pointer', fontSize: 10, color: '#fff', fontWeight: 700, flexShrink: 0 }}>WA</button>
                    <button onClick={() => deleteTodo(todo.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2 }}><Ic n="x" s={11} c={C.dan} /></button>
                  </div>
                ))}
              </div>
              {todoFatti.length > 0 && <div style={{ marginTop: 6, fontSize: 10, color: C.txl, textAlign: 'center' }}>{todoFatti.length} completate</div>}
            </Crd>
            {promemoria.length > 0 && (
              <Crd>
                <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 8 }}>📌 Promemoria {promemoria.filter(p => p.richiamo.data < t).length > 0 && <span style={{ background: C.dan, color: '#fff', borderRadius: 8, padding: '1px 6px', fontSize: 10 }}>{promemoria.filter(p => p.richiamo.data < t).length} scaduti</span>}</div>
                {promemoria.slice(0, 4).map(({ paz, ann, richiamo }, i) => (
                  <div key={i} style={{ padding: '6px 0', borderBottom: `1px solid ${C.brd}`, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ flex: 1 }}>
                      <div onClick={() => onOpenPaz(paz, 'info')} style={{ fontSize: 12, fontWeight: 700, color: C.pri, cursor: 'pointer' }}>{paz.nome} {paz.cognome} ›</div>
                      <div style={{ fontSize: 11, color: C.txm }}>{richiamo.testo}</div>
                    </div>
                    <span style={{ fontSize: 10, fontWeight: 700, color: richiamo.data < t ? C.dan : C.pur, flexShrink: 0 }}>{fmtD(richiamo.data)}</span>
                  </div>
                ))}
              </Crd>
            )}
          </div>
        );

        if (w.id === 'wa') {
          if (!waAbilitato(features)) return null;
          return (
          <div key="wa" style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: C.txm, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>💬 Reminder WhatsApp — domani</div>
            {domaniApps.length === 0 ? (
              <Crd style={{ textAlign: 'center', color: C.txl, padding: '16px 0', fontSize: 13 }}>Nessun appuntamento domani</Crd>
            ) : (
              <Crd>
                <div style={{ fontSize: 11, color: C.txm, marginBottom: 10 }}>
                  {domaniApps.length} appuntament{domaniApps.length === 1 ? 'o' : 'i'} domani — tocca WA per inviare il reminder
                </div>
                {domaniApps.map((a, i) => {
                  const p = patients.find(x => x.id === a.pazienteId);
                  const co = getColore(a);
                  const hasTel = p?.telefono;
                  const defMsg = p ? `Gentile ${p.nome},\nricordiamo il suo appuntamento:\n📅 ${fmtD(a.data)} alle ${a.ora}\n🦷 ${a.tipo}\nPer variazioni contattarci entro 24h. Grazie!` : '';
                  return (
                    <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: i < domaniApps.length - 1 ? `1px solid ${C.brd}` : 'none' }}>
                      <div style={{ background: co + '20', borderRadius: 7, padding: '3px 7px', textAlign: 'center', flexShrink: 0, borderLeft: `3px solid ${co}` }}>
                        <div style={{ fontSize: 12, fontWeight: 900, color: co }}>{a.ora}</div>
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 700, fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p ? `${p.nome} ${p.cognome}` : '—'}</div>
                        <div style={{ fontSize: 10, color: C.txl }}>{a.tipo}</div>
                      </div>
                      {hasTel ? (
                        <button onClick={() => apriWaDiretto(p.telefono, defMsg)}
                          style={{ background: '#25D366', border: 'none', borderRadius: 7, padding: '6px 10px', cursor: 'pointer', color: '#fff', fontWeight: 700, fontSize: 11, flexShrink: 0 }}>
                          WA
                        </button>
                      ) : (
                        <span style={{ fontSize: 10, color: C.txl }}>no tel.</span>
                      )}
                    </div>
                  );
                })}
                <button onClick={() => {
                  domaniApps.forEach(a => {
                    const p = patients.find(x => x.id === a.pazienteId);
                    if (!p?.telefono) return;
                    const msg = `Gentile ${p.nome},\nricordiamo il suo appuntamento:\n📅 ${fmtD(a.data)} alle ${a.ora}\n🦷 ${a.tipo}\nPer variazioni contattarci entro 24h. Grazie!`;
                    setTimeout(() => apriWaDiretto(p.telefono, msg), 500);
                  });
                }} style={{ width: '100%', marginTop: 10, padding: '9px', background: '#25D366', border: 'none', borderRadius: 9, color: '#fff', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>
                  💬 Invia reminder a tutti ({domaniApps.filter(a => patients.find(x => x.id === a.pazienteId)?.telefono).length}/{domaniApps.length})
                </button>
              </Crd>
            )}
          </div>
          );
        }

        if (w.id === 'appuntamenti' && upcoming.length > 0) return (
          <div key="appuntamenti" style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: C.txm, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>📅 Prossimi appuntamenti</div>
            <Crd>
              {upcoming.map((a, i) => {
                const p = patients.find(x => x.id === a.pazienteId);
                return (
                  <div key={a.id} onClick={() => apriEditApp(a)} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: i < upcoming.length-1 ? `1px solid ${C.brd}` : 'none', cursor: 'pointer' }}>
                    <div style={{ background: C.priL, borderRadius: 7, padding: '4px 7px', textAlign: 'center', minWidth: 44, flexShrink: 0 }}>
                      <div style={{ fontSize: 9, color: C.pri, fontWeight: 700 }}>{a.data.slice(8)}/{a.data.slice(5,7)}</div>
                      <div style={{ fontSize: 12, fontWeight: 800, color: C.priD }}>{a.ora}</div>
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p ? `${p.nome} ${p.cognome}` : '—'}</div>
                      <div style={{ fontSize: 11, color: C.txm }}>{a.tipo}</div>
                    </div>
                    <Bdg ch={a.stato} co={a.stato === 'confermato' ? C.suc : C.war} />
                    <button onClick={e => { e.stopPropagation(); eliminaAppuntamentoDiretto(a); }} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, display: 'flex', flexShrink: 0, opacity: 0.5 }} title="Elimina">
                      <Ic n="del" s={14} c={C.dan} />
                    </button>
                  </div>
                );
              })}
            </Crd>
          </div>
        );

        if (w.id === 'economico') return (
          <div key="economico" style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: C.txm, textTransform: 'uppercase', letterSpacing: '0.06em' }}>💰 Pannello economico</div>
              <div style={{ display: 'flex', gap: 4, background: C.bg, borderRadius: 8, padding: 3 }}>
                {[['mese', 'Mese'], ['anno', 'Anno']].map(([id, lbl]) => (
                  <button key={id} onClick={() => setPeriodoEconomico(id)} style={{ border: 'none', borderRadius: 6, padding: '4px 9px', fontSize: 11, fontWeight: 700, cursor: 'pointer', background: periodoEconomico === id ? C.pri : 'transparent', color: periodoEconomico === id ? '#fff' : C.txm }}>{lbl}</button>
                ))}
              </div>
            </div>
            <Crd style={{ background: `linear-gradient(135deg, ${C.priD}, ${C.pri})`, border: 'none' }}>
              {kpiPeriodoLoading && <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: 13 }}>Calcolo in corso…</div>}
              {kpiPeriodo && !kpiPeriodoLoading && (
                <>
                  <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', padding: '5px 0' }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,0.85)' }}>Incassato</span>
                    <span style={{ fontSize: 17, fontWeight: 900, color: '#fff' }}>{fmt(kpiPeriodo.incassato)}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', padding: '5px 0', borderTop: '1px solid rgba(255,255,255,0.15)' }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,0.85)' }}>− Costi</span>
                    <span style={{ fontSize: 15, fontWeight: 800, color: 'rgba(255,255,255,0.9)' }}>{fmt(kpiPeriodo.costi_totali)}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', padding: '7px 0 0', borderTop: '1px solid rgba(255,255,255,0.15)' }}>
                    <span style={{ fontSize: 13, fontWeight: 800, color: '#fff' }}>= EBITDA</span>
                    <span style={{ fontSize: 20, fontWeight: 900, color: kpiPeriodo.ebitda >= 0 ? '#8CFFB0' : '#FFB0B0' }}>{fmt(kpiPeriodo.ebitda)}</span>
                  </div>
                </>
              )}
            </Crd>
            <Crd style={{ padding: 0, overflow: 'hidden', marginTop: 8 }}>
              <div onClick={() => setDetailModal('esegDaInc')} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', cursor: 'pointer', background: totEsegDaInc > 0 ? C.danL : 'transparent' }}>
                <span style={{ fontSize: 12, color: totEsegDaInc > 0 ? C.dan : C.txm, fontWeight: totEsegDaInc > 0 ? 700 : 400 }}>💰 Eseguito da incassare</span>
                <span style={{ fontSize: 13.5, fontWeight: 800, color: totEsegDaInc > 0 ? C.dan : C.txt }}>{fmt(totEsegDaInc)}</span>
              </div>
              <div onClick={() => setDetailModal('accNonEseg')} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', cursor: 'pointer', borderTop: `1px solid ${C.brd}` }}>
                <span style={{ fontSize: 12, color: C.txm }}>✓ Accettato da eseguire</span>
                <span style={{ fontSize: 13.5, fontWeight: 800, color: C.txt }}>{fmt(totAccNonEseg)}</span>
              </div>
            </Crd>
          </div>
        );

        if (w.id === 'preventivi') return (
          <div key="preventivi" style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: C.txm, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>📋 Preventivi</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
              <StatCard label="Attesa" value={preventiviAttesa.length} color={C.pur} onClick={() => setDetailModal('attesa')} />
              <StatCard label="Accettati" value={preventiviAccettati.length} sub={fmt(totAccettati)} color={C.acc} onClick={() => setDetailModal('accettati')} />
              <StatCard label="Rifiutati" value={preventiviRifiutati.length} color={C.dan} onClick={() => setDetailModal('rifiutati')} />
            </div>
          </div>
        );

        if (w.id === 'richiami') {
          const t2 = today();
          const aperti = richiami.filter(r => r.stato === 'da_fare');
          const scad = aperti.filter(r => r.dataScadenza < t2).length;
          return (
            <div key="richiami" style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: C.txm, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>🔔 Richiami</div>
              <StatCard label="Da gestire" value={aperti.length} sub={`${scad} scaduti`} color={scad > 0 ? C.dan : C.pur} urgent={scad > 0} onClick={() => onGoRichiami && onGoRichiami()} />
            </div>
          );
        }

        if (w.id === 'scadenze') return (
          <div key="scadenze" style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: C.txm, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>📆 Scadenze pagamento</div>
            <StatCard label="Totale" value={scadenzePagamento.length} sub={`${scadenzeScadute.length} scadute · ${scadenzeProssime.length} prossime 30gg`} color={scadenzeScadute.length > 0 ? C.dan : C.pri} urgent={scadenzeScadute.length > 0} onClick={() => setDetailModal('scadenze')} />
          </div>
        );

        if (w.id === 'ortodonzia') {
          if (!isDentistico) return null;
          return (
            <div key="ortodonzia" style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: C.txm, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>🦷 Ortodonzia</div>
              <StatCard label="Piani attivi" value={pianiOrto.filter(o => !o.completato).length} sub={`${pianiOrto.filter(o => o.cambioScaduto).length} da cambiare · ${pianiOrto.filter(o => o.inAttesa).length} da avviare`} color={pianiOrto.some(o => o.cambioScaduto) ? C.dan : C.pur} urgent={pianiOrto.some(o => o.cambioScaduto)} onClick={() => setDetailModal('orto')} />
            </div>
          );
        }

        if (w.id === 'statistiche') return (
          <div key="statistiche" style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: C.txm, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>📊 Statistiche</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <StatCard label="Pazienti totali" value={patients.length} sub={`+${nuoviMese} questo mese`} />
              <StatCard label="Tasso accettazione" value={`${tassoAccettazione}%`} color={tassoAccettazione >= 70 ? C.suc : tassoAccettazione >= 40 ? C.war : C.dan} onClick={() => setDetailModal('attesa')} />
              <StatCard label="Valore medio piano" value={fmt(mediaValore)} />
              {topPrest && <StatCard label="Top prestazione" value={topPrest[0].length > 18 ? topPrest[0].slice(0, 16) + '…' : topPrest[0]} sub={`${topPrest[1]}x eseguita`} color={C.acc} />}
            </div>
          </div>
        );

        if (w.id === 'grafici') return (
          <div key="grafici" style={{ marginBottom: 16 }}>
            <button onClick={() => setMostraGraficiDash(v => !v)} style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'none', border: 'none', padding: 0, marginBottom: 8, cursor: 'pointer' }}>
              <span style={{ fontSize: 11, fontWeight: 800, color: C.txm, textTransform: 'uppercase', letterSpacing: '0.06em' }}>📈 Grafici e andamento</span>
              <span style={{ fontSize: 11, color: C.pri, fontWeight: 700 }}>{mostraGraficiDash ? 'Nascondi ▲' : 'Mostra ▼'}</span>
            </button>
            {mostraGraficiDash && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <Crd>
                  <div style={{ fontSize: 12.5, fontWeight: 700, color: C.txt, marginBottom: 8 }}>Ultimi mesi</div>
                  {andamentoMensile.length === 0 ? (
                    <div style={{ textAlign: 'center', color: C.txl, padding: '16px 0', fontSize: 13 }}>Nessun incasso registrato</div>
                  ) : (
                    <ResponsiveContainer width="100%" height={180}>
                      <ComposedChart data={andamentoMensile} margin={{ top: 4, right: 8, left: -22, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke={C.brd} vertical={false} />
                        <XAxis dataKey="mese" tick={{ fontSize: 11, fill: C.txl }} axisLine={{ stroke: C.brd }} tickLine={false} />
                        <YAxis tick={{ fontSize: 10, fill: C.txl }} axisLine={false} tickLine={false} width={42} />
                        <Tooltip contentStyle={{ background: C.txt, border: 'none', borderRadius: 8, color: C.sur, fontSize: 12 }} labelStyle={{ color: C.sur }} formatter={(v, n) => [fmt(v), n === 'incasso' ? 'Incasso' : 'Media mobile']} />
                        <Bar dataKey="incasso" fill={C.priL} radius={[6, 6, 0, 0]} barSize={22} />
                        <Line dataKey="media" stroke={C.pri} strokeWidth={2.5} dot={{ r: 3, fill: C.pri }} />
                      </ComposedChart>
                    </ResponsiveContainer>
                  )}
                </Crd>
                <Crd>
                  <div style={{ fontSize: 12.5, fontWeight: 700, color: C.txt, marginBottom: 8 }}>Dove incasso di più</div>
                  {incassoPerPrestazione.length === 0 ? (
                    <div style={{ textAlign: 'center', color: C.txl, padding: '16px 0', fontSize: 13 }}>Nessuna prestazione eseguita</div>
                  ) : (
                    <ResponsiveContainer width="100%" height={Math.max(140, incassoPerPrestazione.length * 34)}>
                      <BarChart data={incassoPerPrestazione} layout="vertical" margin={{ top: 4, right: 24, left: 4, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke={C.brd} horizontal={false} />
                        <XAxis type="number" tick={{ fontSize: 10, fill: C.txl }} axisLine={false} tickLine={false} />
                        <YAxis type="category" dataKey="tipo" tick={{ fontSize: 11, fill: C.txt }} axisLine={false} tickLine={false} width={92} />
                        <Tooltip contentStyle={{ background: C.txt, border: 'none', borderRadius: 8, color: C.sur, fontSize: 12 }} labelStyle={{ color: C.sur }} formatter={(v) => fmt(v)} />
                        <Bar dataKey="incasso" radius={[0, 6, 6, 0]} barSize={16}>
                          {incassoPerPrestazione.map((_, i) => <Cell key={i} fill={CHART_PALETTE[i % CHART_PALETTE.length]} />)}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </Crd>
                <Crd>
                  <div style={{ fontSize: 12.5, fontWeight: 700, color: C.txt, marginBottom: 8 }}>Incasso per giorno</div>
                  <ResponsiveContainer width="100%" height={160}>
                    <BarChart data={incassoPerGiorno} margin={{ top: 4, right: 8, left: -22, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke={C.brd} vertical={false} />
                      <XAxis dataKey="giorno" tick={{ fontSize: 11, fill: C.txl }} axisLine={{ stroke: C.brd }} tickLine={false} />
                      <YAxis tick={{ fontSize: 10, fill: C.txl }} axisLine={false} tickLine={false} width={42} />
                      <Tooltip contentStyle={{ background: C.txt, border: 'none', borderRadius: 8, color: C.sur, fontSize: 12 }} labelStyle={{ color: C.sur }} formatter={(v) => fmt(v)} />
                      <Bar dataKey="incasso" radius={[6, 6, 0, 0]} barSize={26}>
                        {incassoPerGiorno.map((d, i) => <Cell key={i} fill={d.top ? C.pri : C.priL} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </Crd>
                <Crd>
                  <div style={{ fontSize: 12.5, fontWeight: 700, color: C.txt, marginBottom: 8 }}>Andamento spese</div>
                  {speseMensili.length === 0 ? (
                    <div style={{ textAlign: 'center', color: C.txl, padding: '16px 0', fontSize: 13 }}>Nessuna spesa registrata</div>
                  ) : (
                    <ResponsiveContainer width="100%" height={180}>
                      <BarChart data={speseMensili} margin={{ top: 4, right: 8, left: -22, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke={C.brd} vertical={false} />
                        <XAxis dataKey="mese" tick={{ fontSize: 11, fill: C.txl }} axisLine={{ stroke: C.brd }} tickLine={false} />
                        <YAxis tick={{ fontSize: 10, fill: C.txl }} axisLine={false} tickLine={false} width={42} />
                        <Tooltip contentStyle={{ background: C.txt, border: 'none', borderRadius: 8, color: C.sur, fontSize: 12 }} labelStyle={{ color: C.sur }} formatter={(v, n) => [fmt(v), n === 'unaTantum' ? 'Una tantum' : 'Ricorrenti (quota mese)']} />
                        <Bar dataKey="ricorrenti" stackId="s" fill={C.war + '55'} radius={[0, 0, 0, 0]} barSize={22} />
                        <Bar dataKey="unaTantum" stackId="s" fill={C.dan} radius={[6, 6, 0, 0]} barSize={22} />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </Crd>
                {speseCategoria.length > 0 && (
                  <Crd>
                    <div style={{ fontSize: 12.5, fontWeight: 700, color: C.txt, marginBottom: 2 }}>Spese per categoria</div>
                    <div style={{ fontSize: 11, color: C.txl, marginBottom: 8 }}>Ricorrenti proiettate su base annua/12</div>
                    <ResponsiveContainer width="100%" height={Math.max(140, speseCategoria.length * 34)}>
                      <BarChart data={speseCategoria} layout="vertical" margin={{ top: 4, right: 24, left: 4, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke={C.brd} horizontal={false} />
                        <XAxis type="number" tick={{ fontSize: 10, fill: C.txl }} axisLine={false} tickLine={false} />
                        <YAxis type="category" dataKey="categoria" tick={{ fontSize: 11, fill: C.txt }} axisLine={false} tickLine={false} width={92} />
                        <Tooltip contentStyle={{ background: C.txt, border: 'none', borderRadius: 8, color: C.sur, fontSize: 12 }} labelStyle={{ color: C.sur }} formatter={(v) => fmt(v)} />
                        <Bar dataKey="tot" radius={[0, 6, 6, 0]} barSize={16}>
                          {speseCategoria.map((_, i) => <Cell key={i} fill={C.dan} fillOpacity={1 - i * 0.12} />)}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </Crd>
                )}
              </div>
            )}
          </div>
        );

        return null;
      })}

      {editApp && editForm && (
        <Modal title="✏️ Modifica appuntamento" onClose={() => setEditApp(null)}>
          {(() => {
            const p = patients.find(x => x.id === editApp.pazienteId);
            return (
              <div style={{ background: C.priL, borderRadius: 9, padding: '9px 12px', marginBottom: 12 }}>
                <div style={{ fontWeight: 700, fontSize: 13 }}>{p ? `${p.nome} ${p.cognome}` : '—'}</div>
                {p?.telefono && <div style={{ fontSize: 11, color: C.txm }}>{p.telefono}</div>}
              </div>
            );
          })()}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <Fld label="Data"><Inp type="date" value={editForm.data} onChange={e => setEditForm(f => ({ ...f, data: e.target.value }))} /></Fld>
            <Fld label="Ora"><TimePicker value={editForm.ora} onChange={(v) => setEditForm(f => ({ ...f, ora: v }))} label="Orario appuntamento" /></Fld>
            <Fld label="Durata">
              <Sel value={editForm.durata} onChange={e => setEditForm(f => ({ ...f, durata: e.target.value }))}>
                {[15,30,45,60,90,120].map(d => <option key={d} value={d}>{d} min</option>)}
              </Sel>
            </Fld>
            <Fld label="Stato">
              <Sel value={editForm.stato} onChange={e => setEditForm(f => ({ ...f, stato: e.target.value }))}>
                <option value="confermato">Confermato</option>
                <option value="da confermare">Da confermare</option>
                <option value="annullato">Annullato</option>
              </Sel>
            </Fld>
          </div>
          <Fld label="Tipo visita">
            <Inp value={editForm.tipo} onChange={e => setEditForm(f => ({ ...f, tipo: e.target.value }))} />
          </Fld>
          <Fld label="Note"><Txt value={editForm.note} onChange={e => setEditForm(f => ({ ...f, note: e.target.value }))} /></Fld>
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <Btn ch="Elimina" v="dan" onClick={eliminaEditApp} />
            <Btn ch="Annulla" v="sec" onClick={() => setEditApp(null)} full />
            <Btn ch="Salva" onClick={salvaEditApp} full />
          </div>
        </Modal>
      )}
    </div>
  );
}



