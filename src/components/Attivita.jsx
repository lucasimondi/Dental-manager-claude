import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase.js';
import { Btn, Crd, Fld, Inp, Modal, Toast, Bdg, Ic, StatCard, SelettorePaziente, WaAction, PageHeader, EmptyState, Sel } from './ui';
import { C, fmtD, today, uid, TODO_CATEGORIE, todoCategoriaTab, RICHIAMO_CATEGORIE, DEF_TPL_GENERICO } from '../lib/utils';
import { buildActivityText } from '../lib/appointmentQuickHub.js';
import { useFormPersistente } from '../lib/useFormPersistente';
import { generaRichiamiBot } from '../lib/richiamiBot';

const CATEGORIE_ATTIVITA_FILTRO = [
  { id: 'tutte', label: 'Tutte', icona: null },
  ...Object.entries(TODO_CATEGORIE).map(([id, c]) => ({ id, label: c.label, icona: c.icona })),
];
const CATEGORIE_RICHIAMI_FILTRO = [
  { id: 'tutte', label: 'Tutte', icona: null },
  ...Object.entries(RICHIAMO_CATEGORIE).map(([id, c]) => ({ id, label: c.label, icona: c.icona })),
];

/* ── SEZIONE ATTIVITÀ (POL-UI-034) ──
   Product Owner, prima richiesta: "Attività e promemoria: dobbiamo mettere
   in modo che siano classificate con etichette visibili... e poi deve
   esserci una sezione attività in modo che sia tutto più chiaro". Dopo aver
   visto una prima versione solo-Attività, ha chiarito: "Deve esserci
   sezione apposita per attività e promemoria, ovvero pagina in cui ci
   siano tutte le attività per etichette implementabili" — cioè UNA sola
   pagina dedicata che copra ENTRAMBE (non solo le Attività), ciascuna
   filtrabile per la propria etichetta/categoria.

   Un interruttore di sezione in cima (stesso linguaggio visivo del
   toggle Da-fare/Fatte già usato sotto) sceglie fra le due liste — ognuna
   con le proprie StatCard, la propria tabbar di filtro per categoria e il
   proprio modale di creazione. Il vecchio ingresso "Richiami" in NAV
   resta invariato (stesso stato `richiami`/`setRichiami` di App.jsx, zero
   duplicazione di dati): qui è solo un secondo punto d'accesso, più
   completo, allo stesso identico contenuto — stesso principio già usato
   per il tasto Esci duplicato in Impostazioni/Home (POL-UI-031/033). */
export default function Attivita({ patients, onOpenPaz, richiami, setRichiami, plans, payments, appointments, templates, features, si }) {
  const isDentistico = !si?.vertical || si.vertical === 'dentistico';
  const [sezione, setSezione] = useState('attivita');
  const [toast, setToast] = useState('');

  // ── Attività (todos) ──
  const [todoList, setTodoList] = useState([]);
  const [todoLoading, setTodoLoading] = useState(true);
  const [filtroCategoriaAttivita, setFiltroCategoriaAttivita] = useState('tutte');
  const [mostraFatte, setMostraFatte] = useState(false);
  const [todoModal, setTodoModal] = useState(false);
  const [todoTesto, setTodoTesto] = useState('');
  const [todoPazienteId, setTodoPazienteId] = useState('');
  const [todoPazSearch, setTodoPazSearch] = useState('');
  const [todoCategoria, setTodoCategoria] = useState('GENERICO');

  const loadTodos = async () => {
    setTodoLoading(true);
    const { data, error } = await supabase.from('todos').select('*').order('created_at', { ascending: false });
    if (!error && data) setTodoList(data);
    setTodoLoading(false);
  };
  useEffect(() => { loadTodos(); }, []);

  const closeTodoModal = () => { setTodoModal(false); setTodoTesto(''); setTodoPazienteId(''); setTodoPazSearch(''); setTodoCategoria('GENERICO'); };

  const saveTodo = async () => {
    if (!todoTesto.trim()) return;
    const patient = patients.find((p) => String(p.id) === String(todoPazienteId));
    const nuova = { id: Date.now(), testo: buildActivityText(todoTesto, patient), fatto: false, data: today(), paziente_id: todoPazienteId || null, categoria: todoCategoria };
    const { error } = await supabase.from('todos').insert([nuova]);
    if (!error) {
      setTodoList((prev) => [nuova, ...prev]);
      closeTodoModal();
      setToast('Attività creata ✓');
    }
  };

  const toggleTodoFatto = async (t) => {
    const { error } = await supabase.from('todos').update({ fatto: !t.fatto }).eq('id', t.id);
    if (!error) setTodoList((prev) => prev.map((x) => (x.id === t.id ? { ...x, fatto: !x.fatto } : x)));
  };

  const eliminaTodo = async (id) => {
    if (!confirm('Eliminare questa attività?')) return;
    const { error } = await supabase.from('todos').delete().eq('id', id);
    if (!error) setTodoList((prev) => prev.filter((x) => x.id !== id));
  };

  const todoAttive = todoList.filter((t) => !t.fatto);
  const todoFatte = todoList.filter((t) => t.fatto);
  const todoFiltrate = todoList
    .filter((t) => (filtroCategoriaAttivita === 'tutte' || t.categoria === filtroCategoriaAttivita))
    .filter((t) => (mostraFatte ? t.fatto : !t.fatto));

  // ── Promemoria (richiami) — stessa logica di Richiami.jsx ──
  const [filtroCategoriaRichiami, setFiltroCategoriaRichiami] = useState('tutte');
  const [mostraRichiamiFatti, setMostraRichiamiFatti] = useState(false);
  const [richiamoModal, setRichiamoModal] = useState(false);
  const [richiamoPazSearch, setRichiamoPazSearch] = useState('');
  const [richiamoForm, setRichiamoForm, clearRichiamoFormDraft] = useFormPersistente('nuovo_richiamo', { pazienteId: '', categoria: 'generico', motivo: '', dataScadenza: today() });
  const FR = (f) => setRichiamoForm((p) => ({ ...p, ...f }));

  const scansionaRichiami = () => {
    const { proposte, daRimuovere } = generaRichiamiBot({ patients, plans, payments, appointments, richiami });
    if (proposte.length === 0 && daRimuovere.length === 0) { setToast('Nessun nuovo richiamo trovato'); return; }
    setRichiami((prev) => [
      ...prev.filter((r) => !daRimuovere.includes(r.id)),
      ...proposte.map((p) => ({ ...p, id: uid() })),
    ]);
    setToast(`${proposte.length} nuovo/i richiamo/i${daRimuovere.length ? ` · ${daRimuovere.length} risolto/i con l'agenda` : ''}`);
  };

  const saveRichiamo = () => {
    if (!richiamoForm.pazienteId || !richiamoForm.dataScadenza) return;
    setRichiami((prev) => [...prev, {
      id: uid(), pazienteId: Number(richiamoForm.pazienteId), categoria: richiamoForm.categoria,
      motivo: richiamoForm.motivo.trim(), dataScadenza: richiamoForm.dataScadenza, origine: 'manuale', stato: 'da_fare', chiaveBot: null,
    }]);
    setRichiamoModal(false);
    clearRichiamoFormDraft();
    setToast('Richiamo creato ✓');
  };

  const segnaRichiamoFatto = (id) => setRichiami((prev) => prev.map((r) => (r.id === id ? { ...r, stato: 'fatto' } : r)));
  const riapriRichiamo = (id) => setRichiami((prev) => prev.map((r) => (r.id === id ? { ...r, stato: 'da_fare' } : r)));
  const eliminaRichiamo = (id) => { if (confirm('Eliminare questo richiamo?')) setRichiami((prev) => prev.filter((r) => r.id !== id)); };

  const t = today();
  const tra30 = (() => { const d = new Date(t + 'T12:00'); d.setDate(d.getDate() + 30); return d.toISOString().slice(0, 10); })();
  const richiamiAperti = richiami.filter((r) => r.stato === 'da_fare');
  const richiamiScaduti = richiamiAperti.filter((r) => r.dataScadenza < t);
  const richiamiProssimi = richiamiAperti.filter((r) => r.dataScadenza >= t && r.dataScadenza <= tra30);
  const richiamiFiltrati = richiami
    .filter((r) => (filtroCategoriaRichiami === 'tutte' || r.categoria === filtroCategoriaRichiami))
    .filter((r) => (mostraRichiamiFatti ? r.stato === 'fatto' : r.stato === 'da_fare'))
    .sort((a, b) => a.dataScadenza.localeCompare(b.dataScadenza));
  const tplSollecito = templates.find((tp) => tp.nome === 'Sollecito controllo') || DEF_TPL_GENERICO[3];

  return (
    <div>
      {toast && <Toast msg={toast} onDone={() => setToast('')} />}

      <PageHeader icon="clip" title="Attività" actions={
        sezione === 'attivita'
          ? <Btn ch="Attività" ic="plus" onClick={() => setTodoModal(true)} />
          : <>
              <Btn ch="Scansiona ora" ic="refresh" v="sec" onClick={scansionaRichiami} />
              <Btn ch="Richiamo" ic="plus" onClick={() => { setRichiamoForm({ pazienteId: '', categoria: 'generico', motivo: '', dataScadenza: today() }); setRichiamoPazSearch(''); setRichiamoModal(true); }} />
            </>
      } />

      <div style={{ display: 'flex', background: C.bg, borderRadius: 10, border: `1px solid ${C.brd}`, marginBottom: 14, overflow: 'hidden' }}>
        {[['attivita', `Attività (${todoAttive.length})`], ['promemoria', `Promemoria (${richiamiAperti.length})`]].map(([v, lbl]) => (
          <button key={v} onClick={() => setSezione(v)} style={{ flex: 1, padding: '11px 0', border: 'none', background: sezione === v ? C.pri : 'transparent', color: sezione === v ? '#fff' : C.txm, fontWeight: 800, fontSize: 13, cursor: 'pointer' }}>{lbl}</button>
        ))}
      </div>

      {sezione === 'attivita' && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
            <StatCard icon="okc" color={C.dan} value={todoAttive.length} label="Da fare" />
            <StatCard icon="ok" color={C.suc} value={todoFatte.length} label="Completate" />
          </div>

          <div className="pol-tabbar" style={{ marginBottom: 10, paddingBottom: 2 }}>
            {CATEGORIE_ATTIVITA_FILTRO.map((c) => (
              <button key={c.id} onClick={() => setFiltroCategoriaAttivita(c.id)} className={`pol-tab${filtroCategoriaAttivita === c.id ? ' is-active' : ''}`} style={{ display: 'flex', alignItems: 'center', gap: 5, background: filtroCategoriaAttivita === c.id ? C.priL : C.sur, color: filtroCategoriaAttivita === c.id ? C.pri : C.txm, border: `1.5px solid ${filtroCategoriaAttivita === c.id ? C.pri : C.brd}` }}>
                {c.icona && <Ic n={c.icona} s={11} c={filtroCategoriaAttivita === c.id ? C.pri : C.txm} />}{c.label}
              </button>
            ))}
          </div>

          <div style={{ display: 'flex', background: C.bg, borderRadius: 10, border: `1px solid ${C.brd}`, marginBottom: 14, overflow: 'hidden' }}>
            {[[false, `Da fare (${todoAttive.length})`], [true, `Fatte (${todoFatte.length})`]].map(([v, lbl]) => (
              <button key={String(v)} onClick={() => setMostraFatte(v)} style={{ flex: 1, padding: '10px 0', border: 'none', background: mostraFatte === v ? C.pri : 'transparent', color: mostraFatte === v ? '#fff' : C.txm, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>{lbl}</button>
            ))}
          </div>

          {todoLoading && <div style={{ fontSize: 12, color: C.txl, textAlign: 'center', padding: '14px 0' }}>Caricamento...</div>}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
            {!todoLoading && todoFiltrate.map((tItem) => {
              const cat = TODO_CATEGORIE[tItem.categoria] || TODO_CATEGORIE.GENERICO;
              const paz = tItem.paziente_id != null ? patients.find((p) => String(p.id) === String(tItem.paziente_id)) : null;
              return (
                <Crd key={tItem.id} style={{ borderLeft: `3px solid ${cat.colore}` }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      {paz ? (
                        <div onClick={() => onOpenPaz(paz, todoCategoriaTab(tItem.categoria))} style={{ fontWeight: 700, fontSize: 13, color: C.pri, cursor: 'pointer' }}>{paz.nome} {paz.cognome} ›</div>
                      ) : null}
                      <div style={{ fontSize: 12, color: C.txt, marginTop: paz ? 2 : 0 }}>{tItem.testo}</div>
                      <div style={{ marginTop: 5, display: 'flex', gap: 5, flexWrap: 'wrap', alignItems: 'center' }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Ic n={cat.icona} s={11} c={cat.colore} /><Bdg ch={cat.label} co={cat.colore} /></span>
                      </div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 5, flexShrink: 0 }}>
                      {!tItem.fatto
                        ? <button onClick={() => toggleTodoFatto(tItem)} style={{ background: C.sucL, border: 'none', borderRadius: 7, padding: '5px 8px', cursor: 'pointer' }} title="Segna fatta"><Ic n="ok" s={13} c={C.suc} /></button>
                        : <button onClick={() => toggleTodoFatto(tItem)} style={{ background: C.priL, border: 'none', borderRadius: 7, padding: '5px 8px', cursor: 'pointer' }} title="Riapri"><Ic n="clk" s={13} c={C.pri} /></button>}
                      <button onClick={() => eliminaTodo(tItem.id)} style={{ background: C.danL, border: 'none', borderRadius: 7, padding: '5px 8px', cursor: 'pointer' }} title="Elimina"><Ic n="del" s={13} c={C.dan} /></button>
                    </div>
                  </div>
                </Crd>
              );
            })}
            {!todoLoading && todoFiltrate.length === 0 && <EmptyState icon="clip" title={mostraFatte ? 'Nessuna attività completata' : 'Nessuna attività da gestire'} />}
          </div>
        </>
      )}

      {sezione === 'promemoria' && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
            <StatCard icon="warn" color={C.dan} value={richiamiScaduti.length} label="Scaduti" />
            <StatCard icon="clk" color={C.pur} value={richiamiProssimi.length} label="Prossimi 30gg" />
          </div>

          <div className="pol-tabbar" style={{ marginBottom: 10, paddingBottom: 2 }}>
            {CATEGORIE_RICHIAMI_FILTRO.map((c) => (
              <button key={c.id} onClick={() => setFiltroCategoriaRichiami(c.id)} className={`pol-tab${filtroCategoriaRichiami === c.id ? ' is-active' : ''}`} style={{ display: 'flex', alignItems: 'center', gap: 5, background: filtroCategoriaRichiami === c.id ? C.priL : C.sur, color: filtroCategoriaRichiami === c.id ? C.pri : C.txm, border: `1.5px solid ${filtroCategoriaRichiami === c.id ? C.pri : C.brd}` }}>
                {c.icona && <Ic n={c.icona} s={11} c={filtroCategoriaRichiami === c.id ? C.pri : C.txm} />}{c.label}
              </button>
            ))}
          </div>

          <div style={{ display: 'flex', background: C.bg, borderRadius: 10, border: `1px solid ${C.brd}`, marginBottom: 14, overflow: 'hidden' }}>
            {[[false, `Da fare (${richiamiAperti.length})`], [true, `Fatti (${richiami.length - richiamiAperti.length})`]].map(([v, lbl]) => (
              <button key={String(v)} onClick={() => setMostraRichiamiFatti(v)} style={{ flex: 1, padding: '10px 0', border: 'none', background: mostraRichiamiFatti === v ? C.pri : 'transparent', color: mostraRichiamiFatti === v ? '#fff' : C.txm, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>{lbl}</button>
            ))}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
            {richiamiFiltrati.map((r) => {
              const paz = patients.find((p) => String(p.id) === String(r.pazienteId));
              const cat = RICHIAMO_CATEGORIE[r.categoria] || RICHIAMO_CATEGORIE.generico;
              const scaduto = r.stato === 'da_fare' && r.dataScadenza < t;
              const testoWa = tplSollecito.testo.replace(/\{nome\}/g, paz ? `${paz.nome} ${paz.cognome}` : '');
              return (
                <Crd key={r.id} style={{ borderLeft: `3px solid ${cat.colore}` }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div onClick={() => paz && onOpenPaz(paz, 'info')} style={{ fontWeight: 700, fontSize: 13, color: paz ? C.pri : C.txt, cursor: paz ? 'pointer' : 'default' }}>{paz ? `${paz.nome} ${paz.cognome} ›` : 'Paziente non trovato'}</div>
                      <div style={{ fontSize: 12, color: C.txm, marginTop: 2 }}>{r.motivo || cat.label}</div>
                      <div style={{ marginTop: 5, display: 'flex', gap: 5, flexWrap: 'wrap', alignItems: 'center' }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Ic n={cat.icona} s={11} c={cat.colore} /><Bdg ch={cat.label} co={cat.colore} /></span>
                        <Bdg ch={scaduto ? `scaduto ${fmtD(r.dataScadenza)}` : fmtD(r.dataScadenza)} co={scaduto ? C.dan : C.txm} />
                        {r.origine === 'bot' && <Bdg ch="Bot" co={C.acc} />}
                      </div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 5, flexShrink: 0 }}>
                      {r.stato === 'da_fare'
                        ? <button onClick={() => segnaRichiamoFatto(r.id)} style={{ background: C.sucL, border: 'none', borderRadius: 7, padding: '5px 8px', cursor: 'pointer' }} title="Segna fatto"><Ic n="ok" s={13} c={C.suc} /></button>
                        : <button onClick={() => riapriRichiamo(r.id)} style={{ background: C.priL, border: 'none', borderRadius: 7, padding: '5px 8px', cursor: 'pointer' }} title="Riapri"><Ic n="clk" s={13} c={C.pri} /></button>}
                      {paz?.telefono && <WaAction tel={paz.telefono} testo={testoWa} features={features} variant="icon" />}
                      <button onClick={() => eliminaRichiamo(r.id)} style={{ background: C.danL, border: 'none', borderRadius: 7, padding: '5px 8px', cursor: 'pointer' }} title="Elimina"><Ic n="del" s={13} c={C.dan} /></button>
                    </div>
                  </div>
                </Crd>
              );
            })}
            {richiamiFiltrati.length === 0 && <EmptyState icon="bell" title={mostraRichiamiFatti ? 'Nessun richiamo evaso' : 'Nessun richiamo da gestire'} />}
          </div>
        </>
      )}

      {todoModal && (
        <Modal title="+ Nuova attività" icon="clip" onClose={closeTodoModal}>
          <Fld label="Titolo">
            <textarea value={todoTesto} onChange={(e) => setTodoTesto(e.target.value)} autoFocus rows={4} placeholder={isDentistico ? 'es. Chiamare per preventivo' : 'es. Ordinare materiale'} style={{ width: '100%', padding: '11px 12px', border: `1.5px solid ${C.brd}`, borderRadius: 10, fontSize: 13, color: C.txt, background: C.sur, boxSizing: 'border-box', resize: 'vertical', fontFamily: 'inherit' }} />
          </Fld>
          <Fld label="Paziente (opzionale)">
            <SelettorePaziente patients={patients} value={todoPazienteId} onChange={(id) => setTodoPazienteId(id || '')} search={todoPazSearch} onSearchChange={setTodoPazSearch} placeholder="Nessun paziente" />
            {todoPazienteId && <button type="button" onClick={() => setTodoPazienteId('')} style={{ marginTop: 5, padding: 0, border: 0, background: 'none', color: C.txm, fontSize: 11, cursor: 'pointer' }}>Rimuovi associazione</button>}
          </Fld>
          <Fld label="Categoria">
            <Sel value={todoCategoria} onChange={(e) => setTodoCategoria(e.target.value)}>
              {Object.entries(TODO_CATEGORIE).map(([id, c]) => <option key={id} value={id}>{c.label}</option>)}
            </Sel>
          </Fld>
          <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
            <Btn ch="Annulla" v="sec" onClick={closeTodoModal} full />
            <Btn ch="Aggiungi" onClick={saveTodo} dis={!todoTesto.trim()} full />
          </div>
        </Modal>
      )}

      {richiamoModal && (
        <Modal title="Nuovo richiamo" icon="bell" onClose={() => setRichiamoModal(false)}>
          <Fld label="Paziente">
            <SelettorePaziente patients={patients} value={richiamoForm.pazienteId} onChange={(id) => FR({ pazienteId: id })} search={richiamoPazSearch} onSearchChange={setRichiamoPazSearch} autoFocus />
          </Fld>
          <Fld label="Categoria">
            <Sel value={richiamoForm.categoria} onChange={(e) => FR({ categoria: e.target.value })}>
              {Object.entries(RICHIAMO_CATEGORIE).map(([id, c]) => <option key={id} value={id}>{c.label}</option>)}
            </Sel>
          </Fld>
          <Fld label="Motivo"><Inp value={richiamoForm.motivo} onChange={(e) => FR({ motivo: e.target.value })} placeholder={isDentistico ? 'es. Richiamare per controllo tartaro' : 'es. Richiamare per controllo periodico'} /></Fld>
          <Fld label="Data richiamo"><Inp type="date" value={richiamoForm.dataScadenza} onChange={(e) => FR({ dataScadenza: e.target.value })} /></Fld>
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <Btn ch="Annulla" v="sec" onClick={() => setRichiamoModal(false)} full />
            <Btn ch="Crea richiamo" onClick={saveRichiamo} dis={!richiamoForm.pazienteId || !richiamoForm.dataScadenza} full />
          </div>
        </Modal>
      )}
    </div>
  );
}
