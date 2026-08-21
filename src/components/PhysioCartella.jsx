import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase.js';
import { Crd, Fld, Ic, Bdg, Modal, EmptyState } from './ui';
import { Inp, Sel, Txt } from './ui/inputs.jsx';
import { C, fmtD, today } from '../lib/utils';
import { generaReportPercorso } from '../lib/physioReport';

/* ── CARTELLA FISIOTERAPICA ──
   Componente aggiuntivo montato come tab dedicata in SchedaPaz.jsx per i
   verticali fisioterapista/massofisioterapista. Non tocca alcuna tabella
   condivisa del CORE: legge/scrive solo sulle 7 tabelle physio_* (RLS
   studio-scoped, vedi supabase/migrations/20260818000000_physio_schema_dati.sql).

   Struttura interna a sotto-tab, coerente col mockup approvato
   public/mockup-fisioterapista.html: Valutazione · Obiettivi · Diario sedute
   · Domiciliare. "Info" (storia clinica) e "Pagamenti"/"Agenda" restano le
   tab già esistenti in SchedaPaz — non duplicate qui. */

const SUBTABS = [
  { id: 'valutazione', l: 'Valutazione', ic: 'trend' },
  { id: 'obiettivi', l: 'Obiettivi', ic: 'zap' },
  { id: 'diario', l: 'Diario sedute', ic: 'book' },
  { id: 'domiciliare', l: 'Domiciliare', ic: 'home' },
];

const fmtNum = (n) => (n === null || n === undefined || n === '' ? '—' : n);

/* POL-RBAC-001A: assignment_type -> [label, matching capability]. CAPABILITY
   (Setup → Collaboratori) says a user may act as a role; ASSIGNMENT (here)
   says which patient they may act on. Server-side RLS is authoritative —
   this list only drives what the picker offers, never grants access. */
const ASSIGNMENT_TYPES = [
  ['responsible_physiotherapist', 'Fisioterapista responsabile', 'clinical.physiotherapist'],
  ['physiotherapist', 'Fisioterapista', 'clinical.physiotherapist'],
  ['personal_trainer', 'Personal trainer', 'clinical.personal_trainer'],
  ['massage_therapist', 'Massaggiatore', 'clinical.massage_therapist'],
];
const ASSIGNMENT_TYPE_LABEL = Object.fromEntries(ASSIGNMENT_TYPES.map(([id, label]) => [id, label]));

export default function PhysioCartella({ paziente_id, studio_id, paziente, studio, accessMode = 'full', currentUserId, canManageTeam = false }) {
  const fullAccess = accessMode === 'full';
  const [sub, setSub] = useState(fullAccess ? 'valutazione' : 'percorso');
  const [valutazioni, setValutazioni] = useState([]);
  const [obiettivi, setObiettivi] = useState([]);
  const [diario, setDiario] = useState([]);
  const [prescrizioni, setPrescrizioni] = useState([]);
  const [esercizi, setEsercizi] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errore, setErrore] = useState('');

  const ricarica = async () => {
    setLoading(true);
    setErrore('');
    try {
      const [v, o, d, p, e] = await Promise.all([
        fullAccess ? supabase.from('physio_valutazioni').select('*').eq('paziente_id', paziente_id).order('data', { ascending: false }) : Promise.resolve({ data: [], error: null }),
        supabase.from('physio_obiettivi').select('*').eq('paziente_id', paziente_id).order('created_at', { ascending: false }),
        supabase.from('physio_diario_sedute').select('*').eq('paziente_id', paziente_id).order('data', { ascending: false }),
        supabase.from('physio_prescrizioni').select('*, physio_esercizi(nome, categoria, descrizione, istruzioni)').eq('paziente_id', paziente_id).order('created_at', { ascending: false }),
        supabase.from('physio_esercizi').select('id, nome, categoria').eq('studio_id', studio_id).eq('attivo', true).order('nome'),
      ]);
      if (v.error || o.error || d.error || p.error || e.error) {
        setErrore('Errore nel caricamento della cartella fisioterapica.');
      } else {
        setValutazioni(v.data || []);
        setObiettivi(o.data || []);
        setDiario(d.data || []);
        setPrescrizioni(p.data || []);
        setEsercizi(e.data || []);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { if (paziente_id) ricarica(); }, [paziente_id, accessMode]);

  const subtabs = fullAccess ? SUBTABS : [
    { id: 'percorso', l: 'Percorso autorizzato', ic: 'compass' },
    { id: 'diario', l: 'La mia attività', ic: 'book' },
  ];

  if (loading) return <div style={{ textAlign: 'center', color: C.txl, padding: 40 }}>Caricamento cartella…</div>;
  if (errore) return <div style={{ textAlign: 'center', color: C.dan, padding: 40 }}>{errore}</div>;

  return (
    <div>
      <SezioneTeam studio_id={studio_id} paziente_id={paziente_id} currentUserId={currentUserId} canManageTeam={canManageTeam} />

      {fullAccess && <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 10 }}>
        <button
          onClick={() => generaReportPercorso({ studio, paziente, valutazioni, obiettivi, diario, prescrizioni })}
          style={{ background: 'none', border: `1.5px solid ${C.brd}`, borderRadius: 9, padding: '7px 13px', fontSize: 12, fontWeight: 700, color: C.txm, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}
        >
          <Ic n="download" s={13} c={C.txm} /> Report percorso (PDF)
        </button>
      </div>}

      <div style={{ display: 'flex', gap: 6, overflowX: 'auto', marginBottom: 14, paddingBottom: 2 }}>
        {subtabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setSub(t.id)}
            style={{
              flexShrink: 0, display: 'flex', alignItems: 'center', gap: 6, padding: '8px 13px', borderRadius: 20, fontSize: 12.5, fontWeight: 700,
              border: 'none', cursor: 'pointer', whiteSpace: 'nowrap',
              background: sub === t.id ? C.pri : C.bg, color: sub === t.id ? '#fff' : C.txm,
            }}
          >
            <Ic n={t.ic} s={13} c={sub === t.id ? '#fff' : C.txm} />
            {t.l}
          </button>
        ))}
      </div>

      {fullAccess && sub === 'valutazione' && (
        <SezioneValutazione studio_id={studio_id} paziente_id={paziente_id} valutazioni={valutazioni} onChange={ricarica} />
      )}
      {fullAccess && sub === 'obiettivi' && (
        <SezioneObiettivi studio_id={studio_id} paziente_id={paziente_id} obiettivi={obiettivi} onChange={ricarica} />
      )}
      {sub === 'diario' && (
        <SezioneDiario studio_id={studio_id} paziente_id={paziente_id} diario={diario} onChange={ricarica} />
      )}
      {fullAccess && sub === 'domiciliare' && (
        <SezioneDomiciliare studio_id={studio_id} paziente_id={paziente_id} prescrizioni={prescrizioni} esercizi={esercizi} onChange={ricarica} />
      )}
      {!fullAccess && sub === 'percorso' && <SezionePercorsoOperativo obiettivi={obiettivi} prescrizioni={prescrizioni} />}
    </div>
  );
}

function SezionePercorsoOperativo({ obiettivi, prescrizioni }) {
  return <div>
    <Crd style={{ marginBottom: 12 }}>
      <div style={{ fontSize: 12, fontWeight: 800, color: C.txt, marginBottom: 8 }}>Obiettivi del percorso · sola lettura</div>
      {obiettivi.length === 0 ? <div style={{ fontSize: 12, color: C.txl }}>Nessun obiettivo disponibile</div>
        : obiettivi.map((ob) => <div key={ob.id} style={{ padding: '7px 0', borderBottom: `1px solid ${C.brd}`, fontSize: 12, color: C.txm }}>{ob.descrizione}</div>)}
    </Crd>
    <Crd>
      <div style={{ fontSize: 12, fontWeight: 800, color: C.txt, marginBottom: 8 }}>Attività prescritte · sola lettura</div>
      {prescrizioni.length === 0 ? <div style={{ fontSize: 12, color: C.txl }}>Nessuna attività disponibile</div>
        : prescrizioni.map((p) => <div key={p.id} style={{ padding: '7px 0', borderBottom: `1px solid ${C.brd}`, fontSize: 12, color: C.txm }}>{p.physio_esercizi?.nome || 'Attività prescritta'}</div>)}
    </Crd>
  </div>;
}

/* ── VALUTAZIONE ──
   Log ripetibile (iniziale + rivalutazioni). I campi clinici (ROM, forza,
   test) sono volutamente liberi (chiave/valore configurabile) invece di una
   tabella ROM rigida — professionisti diversi misurano cose diverse. */
function SezioneValutazione({ studio_id, paziente_id, valutazioni, onChange }) {
  const [form, setForm] = useState(null);
  const [salvando, setSalvando] = useState(false);

  const nuovo = () => setForm({
    tipo: valutazioni.length === 0 ? 'iniziale' : 'rivalutazione',
    data: today(), motivo_visita: '', distretto: '',
    dolore_riposo: '', dolore_esercizio: '', note: '',
    campi: [{ chiave: '', valore: '' }],
  });

  const salva = async () => {
    setSalvando(true);
    const dati = {};
    (form.campi || []).forEach((c) => { if (c.chiave) dati[c.chiave] = c.valore; });
    const { error } = await supabase.from('physio_valutazioni').insert({
      studio_id, paziente_id, tipo: form.tipo, data: form.data,
      motivo_visita: form.motivo_visita || null, distretto: form.distretto || null,
      dolore_riposo: form.dolore_riposo === '' ? null : Number(form.dolore_riposo),
      dolore_esercizio: form.dolore_esercizio === '' ? null : Number(form.dolore_esercizio),
      note: form.note || null, dati,
    });
    setSalvando(false);
    if (!error) { setForm(null); onChange(); }
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 11 }}>
        <button onClick={nuovo} style={{ background: C.pri, border: 'none', borderRadius: 10, padding: '10px 16px', color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
          <Ic n="plus" s={14} c="#fff" /> Nuova valutazione
        </button>
      </div>

      {form && (
        <Crd style={{ marginBottom: 14 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <Fld label="Tipo">
              <Sel value={form.tipo} onChange={(e) => setForm((f) => ({ ...f, tipo: e.target.value }))}>
                <option value="iniziale">Valutazione iniziale</option>
                <option value="rivalutazione">Rivalutazione</option>
              </Sel>
            </Fld>
            <Fld label="Data">
              <Inp type="date" value={form.data} onChange={(e) => setForm((f) => ({ ...f, data: e.target.value }))} />
            </Fld>
          </div>
          <Fld label="Distretto / zona interessata">
            <Inp value={form.distretto} onChange={(e) => setForm((f) => ({ ...f, distretto: e.target.value }))} placeholder="es. Ginocchio dx" />
          </Fld>
          <Fld label="Motivo della visita">
            <Txt value={form.motivo_visita} onChange={(e) => setForm((f) => ({ ...f, motivo_visita: e.target.value }))} rows={2} />
          </Fld>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <Fld label="Dolore a riposo (NRS 0-10)">
              <Inp type="number" min={0} max={10} value={form.dolore_riposo} onChange={(e) => setForm((f) => ({ ...f, dolore_riposo: e.target.value }))} />
            </Fld>
            <Fld label="Dolore durante esercizio (NRS 0-10)">
              <Inp type="number" min={0} max={10} value={form.dolore_esercizio} onChange={(e) => setForm((f) => ({ ...f, dolore_esercizio: e.target.value }))} />
            </Fld>
          </div>

          <Fld label="Campi clinici (ROM, forza, test — liberi)">
            {(form.campi || []).map((c, i) => (
              <div key={i} style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
                <Inp placeholder="es. ROM flessione ginocchio dx" value={c.chiave} onChange={(e) => setForm((f) => { const campi = [...f.campi]; campi[i] = { ...campi[i], chiave: e.target.value }; return { ...f, campi }; })} />
                <Inp placeholder="es. 95°" value={c.valore} onChange={(e) => setForm((f) => { const campi = [...f.campi]; campi[i] = { ...campi[i], valore: e.target.value }; return { ...f, campi }; })} />
                <button onClick={() => setForm((f) => ({ ...f, campi: f.campi.filter((_, j) => j !== i) }))} style={{ background: C.danL, border: 'none', borderRadius: 8, padding: '0 10px', cursor: 'pointer', flexShrink: 0 }}><Ic n="del" s={13} c={C.dan} /></button>
              </div>
            ))}
            <button onClick={() => setForm((f) => ({ ...f, campi: [...(f.campi || []), { chiave: '', valore: '' }] }))} style={{ background: 'none', border: `1.5px dashed ${C.brd}`, borderRadius: 8, padding: '7px 10px', fontSize: 12, fontWeight: 700, color: C.txm, cursor: 'pointer', width: '100%' }}>+ Aggiungi campo</button>
          </Fld>

          <Fld label="Note">
            <Txt value={form.note} onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))} rows={2} />
          </Fld>

          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button onClick={() => setForm(null)} style={{ background: 'none', border: `1px solid ${C.brd}`, borderRadius: 9, padding: '9px 15px', fontSize: 13, fontWeight: 700, color: C.txm, cursor: 'pointer' }}>Annulla</button>
            <button disabled={salvando} onClick={salva} style={{ background: C.suc, border: 'none', borderRadius: 9, padding: '9px 15px', fontSize: 13, fontWeight: 700, color: '#fff', cursor: 'pointer', opacity: salvando ? 0.6 : 1 }}>{salvando ? 'Salvataggio…' : 'Salva valutazione'}</button>
          </div>
        </Crd>
      )}

      {valutazioni.length === 0 && !form && <EmptyState icon="pulse" title="Nessuna valutazione registrata" />}

      {valutazioni.map((v, idx) => {
        const precedente = valutazioni[idx + 1]; // ordinate desc: la successiva nell'array è quella prima nel tempo
        return (
          <Crd key={v.id} style={{ marginBottom: 11 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
              <div>
                <div style={{ fontWeight: 800, fontSize: 14 }}>{v.tipo === 'iniziale' ? 'Valutazione iniziale' : 'Rivalutazione'} · {fmtD(v.data)}</div>
                {v.distretto && <div style={{ fontSize: 11, color: C.txm, marginTop: 2 }}>{v.distretto}</div>}
              </div>
              {v.tipo === 'iniziale' && <Bdg ch="Baseline" co={C.pri} />}
            </div>

            {v.motivo_visita && <div style={{ fontSize: 12.5, color: C.txt, marginBottom: 8 }}>{v.motivo_visita}</div>}

            {(v.dolore_riposo !== null || v.dolore_esercizio !== null) && (
              <div style={{ display: 'flex', gap: 16, marginBottom: 8 }}>
                {v.dolore_riposo !== null && <div style={{ fontSize: 11.5, color: C.txm }}>Riposo <b style={{ color: C.txt }}>{v.dolore_riposo}/10</b>{precedente?.dolore_riposo != null && ` (prima: ${precedente.dolore_riposo}/10)`}</div>}
                {v.dolore_esercizio !== null && <div style={{ fontSize: 11.5, color: C.txm }}>Esercizio <b style={{ color: C.txt }}>{v.dolore_esercizio}/10</b>{precedente?.dolore_esercizio != null && ` (prima: ${precedente.dolore_esercizio}/10)`}</div>}
              </div>
            )}

            {v.dati && Object.keys(v.dati).length > 0 && (
              <div style={{ background: C.bg, borderRadius: 9, padding: 10 }}>
                {Object.entries(v.dati).map(([k, val]) => {
                  const prevVal = precedente?.dati?.[k];
                  return (
                    <div key={k} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, padding: '4px 0', borderBottom: `1px solid ${C.brd}` }}>
                      <span style={{ fontSize: 11.5, color: C.txm, fontWeight: 600 }}>{k}</span>
                      <span style={{ fontSize: 12, color: C.txt, textAlign: 'right' }}>{val}{prevVal !== undefined && <span style={{ color: C.txl }}> (prima: {prevVal})</span>}</span>
                    </div>
                  );
                })}
              </div>
            )}

            {v.note && <div style={{ fontSize: 11.5, color: C.txm, marginTop: 8, fontStyle: 'italic' }}>{v.note}</div>}
          </Crd>
        );
      })}
    </div>
  );
}

/* ── OBIETTIVI TERAPEUTICI ── */
function SezioneObiettivi({ studio_id, paziente_id, obiettivi, onChange }) {
  const [form, setForm] = useState(null);
  const [salvando, setSalvando] = useState(false);

  const nuovo = () => setForm({ termine: 'breve', descrizione: '', valore_iniziale: '', valore_attuale: '', valore_target: '', unita: '', data_prevista: '' });

  const salva = async () => {
    setSalvando(true);
    const { error } = await supabase.from('physio_obiettivi').insert({
      studio_id, paziente_id, termine: form.termine, descrizione: form.descrizione,
      valore_iniziale: form.valore_iniziale === '' ? null : Number(form.valore_iniziale),
      valore_attuale: form.valore_attuale === '' ? null : Number(form.valore_attuale),
      valore_target: form.valore_target === '' ? null : Number(form.valore_target),
      unita: form.unita || null, data_prevista: form.data_prevista || null,
    });
    setSalvando(false);
    if (!error) { setForm(null); onChange(); }
  };

  const aggiornaValoreAttuale = async (ob, nuovoValore) => {
    const valore_attuale = nuovoValore === '' ? null : Number(nuovoValore);
    const raggiunto = ob.valore_target !== null && valore_attuale !== null && (
      (ob.valore_target >= (ob.valore_iniziale ?? 0) && valore_attuale >= ob.valore_target) ||
      (ob.valore_target < (ob.valore_iniziale ?? 0) && valore_attuale <= ob.valore_target)
    );
    await supabase.from('physio_obiettivi').update({ valore_attuale, stato: raggiunto ? 'raggiunto' : ob.stato, updated_at: new Date().toISOString() }).eq('id', ob.id);
    onChange();
  };

  const progresso = (ob) => {
    if (ob.valore_iniziale === null || ob.valore_attuale === null || ob.valore_target === null) return null;
    const range = ob.valore_target - ob.valore_iniziale;
    if (range === 0) return ob.valore_attuale === ob.valore_target ? 100 : 0;
    const pct = ((ob.valore_attuale - ob.valore_iniziale) / range) * 100;
    return Math.max(0, Math.min(100, Math.round(pct)));
  };

  const STATO_LABEL = { attivo: ['In corso', C.pri], raggiunto: ['Raggiunto', C.suc], sospeso: ['Sospeso', C.war], annullato: ['Annullato', C.txl] };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 11 }}>
        <button onClick={nuovo} style={{ background: C.pri, border: 'none', borderRadius: 10, padding: '10px 16px', color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
          <Ic n="plus" s={14} c="#fff" /> Nuovo obiettivo
        </button>
      </div>

      {form && (
        <Crd style={{ marginBottom: 14 }}>
          <Fld label="Termine">
            <Sel value={form.termine} onChange={(e) => setForm((f) => ({ ...f, termine: e.target.value }))}>
              <option value="breve">Breve termine</option>
              <option value="medio">Medio termine</option>
              <option value="lungo">Lungo termine</option>
            </Sel>
          </Fld>
          <Fld label="Descrizione">
            <Inp value={form.descrizione} onChange={(e) => setForm((f) => ({ ...f, descrizione: e.target.value }))} placeholder="es. Cammino senza bastoni in piano" />
          </Fld>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
            <Fld label="Iniziale">
              <Inp type="number" value={form.valore_iniziale} onChange={(e) => setForm((f) => ({ ...f, valore_iniziale: e.target.value }))} />
            </Fld>
            <Fld label="Attuale">
              <Inp type="number" value={form.valore_attuale} onChange={(e) => setForm((f) => ({ ...f, valore_attuale: e.target.value }))} />
            </Fld>
            <Fld label="Target">
              <Inp type="number" value={form.valore_target} onChange={(e) => setForm((f) => ({ ...f, valore_target: e.target.value }))} />
            </Fld>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <Fld label="Unità (es. /10, °, kg)">
              <Inp value={form.unita} onChange={(e) => setForm((f) => ({ ...f, unita: e.target.value }))} />
            </Fld>
            <Fld label="Data prevista">
              <Inp type="date" value={form.data_prevista} onChange={(e) => setForm((f) => ({ ...f, data_prevista: e.target.value }))} />
            </Fld>
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button onClick={() => setForm(null)} style={{ background: 'none', border: `1px solid ${C.brd}`, borderRadius: 9, padding: '9px 15px', fontSize: 13, fontWeight: 700, color: C.txm, cursor: 'pointer' }}>Annulla</button>
            <button disabled={salvando || !form.descrizione} onClick={salva} style={{ background: C.suc, border: 'none', borderRadius: 9, padding: '9px 15px', fontSize: 13, fontWeight: 700, color: '#fff', cursor: 'pointer', opacity: salvando || !form.descrizione ? 0.6 : 1 }}>{salvando ? 'Salvataggio…' : 'Salva obiettivo'}</button>
          </div>
        </Crd>
      )}

      {obiettivi.length === 0 && !form && <EmptyState icon="trend" title="Nessun obiettivo impostato" />}

      {obiettivi.map((ob) => {
        const pct = progresso(ob);
        const [stLabel, stColor] = STATO_LABEL[ob.stato] || STATO_LABEL.attivo;
        return (
          <Crd key={ob.id} style={{ marginBottom: 11 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6, gap: 8 }}>
              <div style={{ fontWeight: 700, fontSize: 13.5, flex: 1 }}>{ob.descrizione}</div>
              <Bdg ch={stLabel} co={stColor} />
            </div>
            <div style={{ fontSize: 11, color: C.txm, marginBottom: 6, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <span>{ob.termine === 'breve' ? 'Breve termine' : ob.termine === 'medio' ? 'Medio termine' : 'Lungo termine'}</span>
              {ob.data_prevista && <span>Scadenza {fmtD(ob.data_prevista)}</span>}
              {ob.valore_iniziale !== null && <span>Iniziale {fmtNum(ob.valore_iniziale)}{ob.unita} → Target {fmtNum(ob.valore_target)}{ob.unita}</span>}
            </div>
            {pct !== null && (
              <div style={{ marginBottom: 8 }}>
                <div style={{ height: 7, background: C.bg, borderRadius: 4, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${pct}%`, background: pct >= 100 ? C.suc : C.pri, borderRadius: 4 }} />
                </div>
                <div style={{ fontSize: 11, color: C.txm, marginTop: 3, textAlign: 'right' }}>{pct}%</div>
              </div>
            )}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 11, color: C.txm }}>Aggiorna valore attuale:</span>
              <Inp type="number" defaultValue={ob.valore_attuale ?? ''} onBlur={(e) => { if (e.target.value !== String(ob.valore_attuale ?? '')) aggiornaValoreAttuale(ob, e.target.value); }} style={{ width: 90, padding: '5px 8px' }} />
            </div>
          </Crd>
        );
      })}
    </div>
  );
}

/* ── DIARIO SEDUTE ── */
function SezioneDiario({ studio_id, paziente_id, diario, onChange }) {
  const [form, setForm] = useState(null);
  const [salvando, setSalvando] = useState(false);

  const nuovo = () => setForm({ data: today(), durata_minuti: '', trattamenti_svolti: '', note: '', dolore_prima: '', dolore_dopo: '' });

  const salva = async () => {
    setSalvando(true);
    const numero_seduta = diario.length + 1;
    const { error } = await supabase.from('physio_diario_sedute').insert({
      studio_id, paziente_id, numero_seduta, data: form.data,
      durata_minuti: form.durata_minuti === '' ? null : Number(form.durata_minuti),
      trattamenti_svolti: form.trattamenti_svolti || null, note: form.note || null,
      dolore_prima: form.dolore_prima === '' ? null : Number(form.dolore_prima),
      dolore_dopo: form.dolore_dopo === '' ? null : Number(form.dolore_dopo),
    });
    setSalvando(false);
    if (!error) { setForm(null); onChange(); }
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 11 }}>
        <button onClick={nuovo} style={{ background: C.pri, border: 'none', borderRadius: 10, padding: '10px 16px', color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
          <Ic n="plus" s={14} c="#fff" /> Registra seduta
        </button>
      </div>

      {form && (
        <Crd style={{ marginBottom: 14 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <Fld label="Data">
              <Inp type="date" value={form.data} onChange={(e) => setForm((f) => ({ ...f, data: e.target.value }))} />
            </Fld>
            <Fld label="Durata (minuti)">
              <Inp type="number" value={form.durata_minuti} onChange={(e) => setForm((f) => ({ ...f, durata_minuti: e.target.value }))} />
            </Fld>
          </div>
          <Fld label="Trattamenti svolti">
            <Txt value={form.trattamenti_svolti} onChange={(e) => setForm((f) => ({ ...f, trattamenti_svolti: e.target.value }))} rows={2} placeholder="es. Mobilizzazione passiva + rinforzo isometrico quadricipite" />
          </Fld>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <Fld label="Dolore prima (NRS 0-10)">
              <Inp type="number" min={0} max={10} value={form.dolore_prima} onChange={(e) => setForm((f) => ({ ...f, dolore_prima: e.target.value }))} />
            </Fld>
            <Fld label="Dolore dopo (NRS 0-10)">
              <Inp type="number" min={0} max={10} value={form.dolore_dopo} onChange={(e) => setForm((f) => ({ ...f, dolore_dopo: e.target.value }))} />
            </Fld>
          </div>
          <Fld label="Note">
            <Txt value={form.note} onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))} rows={2} />
          </Fld>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button onClick={() => setForm(null)} style={{ background: 'none', border: `1px solid ${C.brd}`, borderRadius: 9, padding: '9px 15px', fontSize: 13, fontWeight: 700, color: C.txm, cursor: 'pointer' }}>Annulla</button>
            <button disabled={salvando} onClick={salva} style={{ background: C.suc, border: 'none', borderRadius: 9, padding: '9px 15px', fontSize: 13, fontWeight: 700, color: '#fff', cursor: 'pointer', opacity: salvando ? 0.6 : 1 }}>{salvando ? 'Salvataggio…' : 'Salva seduta'}</button>
          </div>
        </Crd>
      )}

      {diario.length === 0 && !form && <EmptyState icon="book" title="Nessuna seduta registrata" />}

      {diario.map((d) => (
        <Crd key={d.id} style={{ marginBottom: 10 }}>
          <div style={{ fontSize: 11.5, color: C.txm, marginBottom: 3 }}>{fmtD(d.data)} · seduta {d.numero_seduta}{d.durata_minuti ? ` · ${d.durata_minuti} min` : ''}</div>
          {d.trattamenti_svolti && <div style={{ fontSize: 13, fontWeight: 700, color: C.txt, marginBottom: 3 }}>{d.trattamenti_svolti}</div>}
          {d.note && <div style={{ fontSize: 12, color: C.txm, marginBottom: 4 }}>{d.note}</div>}
          {(d.dolore_prima !== null || d.dolore_dopo !== null) && (
            <div style={{ fontSize: 11.5, color: C.txm }}>Dolore <b style={{ color: C.txt }}>{fmtNum(d.dolore_prima)}/10</b> → <b style={{ color: C.txt }}>{fmtNum(d.dolore_dopo)}/10</b></div>
          )}
        </Crd>
      ))}
    </div>
  );
}

/* ── PROGRAMMA DOMICILIARE (prescrizione esercizi) ──
   Se l'esercizio scelto non esiste ancora nella libreria dello studio, viene
   creato al volo in physio_esercizi (libreria condivisa fra tutti i pazienti
   dello studio, riusabile per le prossime prescrizioni). */
function SezioneDomiciliare({ studio_id, paziente_id, prescrizioni, esercizi, onChange }) {
  const [form, setForm] = useState(null);
  const [salvando, setSalvando] = useState(false);

  const nuovo = () => setForm({ esercizio_id: '', nome_nuovo: '', serie: '', ripetizioni: '', durata_secondi: '', frequenza_settimanale: '', istruzioni_personalizzate: '' });

  const salva = async () => {
    setSalvando(true);
    let esercizio_id = form.esercizio_id;
    if (!esercizio_id && form.nome_nuovo) {
      const { data, error } = await supabase.from('physio_esercizi').insert({ studio_id, nome: form.nome_nuovo }).select('id').single();
      if (error) { setSalvando(false); return; }
      esercizio_id = data.id;
    }
    if (!esercizio_id) { setSalvando(false); return; }
    const { error } = await supabase.from('physio_prescrizioni').insert({
      studio_id, paziente_id, esercizio_id,
      serie: form.serie === '' ? null : Number(form.serie),
      ripetizioni: form.ripetizioni === '' ? null : Number(form.ripetizioni),
      durata_secondi: form.durata_secondi === '' ? null : Number(form.durata_secondi),
      frequenza_settimanale: form.frequenza_settimanale === '' ? null : Number(form.frequenza_settimanale),
      istruzioni_personalizzate: form.istruzioni_personalizzate || null,
    });
    setSalvando(false);
    if (!error) { setForm(null); onChange(); }
  };

  const disattiva = async (id) => {
    await supabase.from('physio_prescrizioni').update({ attiva: false, data_fine: today() }).eq('id', id);
    onChange();
  };

  const doseLabel = (p) => {
    const parti = [];
    if (p.serie && p.ripetizioni) parti.push(`${p.serie} serie × ${p.ripetizioni} rip.`);
    else if (p.ripetizioni) parti.push(`${p.ripetizioni} ripetizioni`);
    if (p.durata_secondi) parti.push(`${p.durata_secondi}s`);
    if (p.frequenza_settimanale) parti.push(`${p.frequenza_settimanale}×/settimana`);
    return parti.join(' · ') || '—';
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 11 }}>
        <button onClick={nuovo} style={{ background: C.pri, border: 'none', borderRadius: 10, padding: '10px 16px', color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
          <Ic n="plus" s={14} c="#fff" /> Prescrivi esercizio
        </button>
      </div>

      {form && (
        <Crd style={{ marginBottom: 14 }}>
          <Fld label="Esercizio dalla libreria">
            <Sel value={form.esercizio_id} onChange={(e) => setForm((f) => ({ ...f, esercizio_id: e.target.value, nome_nuovo: '' }))}>
              <option value="">— scegli o crea nuovo sotto —</option>
              {esercizi.map((e) => <option key={e.id} value={e.id}>{e.nome}{e.categoria ? ` (${e.categoria})` : ''}</option>)}
            </Sel>
          </Fld>
          {!form.esercizio_id && (
            <Fld label="Oppure nuovo esercizio">
              <Inp value={form.nome_nuovo} onChange={(e) => setForm((f) => ({ ...f, nome_nuovo: e.target.value }))} placeholder="es. Estensione passiva ginocchio" />
            </Fld>
          )}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
            <Fld label="Serie">
              <Inp type="number" value={form.serie} onChange={(e) => setForm((f) => ({ ...f, serie: e.target.value }))} />
            </Fld>
            <Fld label="Ripetizioni">
              <Inp type="number" value={form.ripetizioni} onChange={(e) => setForm((f) => ({ ...f, ripetizioni: e.target.value }))} />
            </Fld>
            <Fld label="Durata (sec)">
              <Inp type="number" value={form.durata_secondi} onChange={(e) => setForm((f) => ({ ...f, durata_secondi: e.target.value }))} />
            </Fld>
          </div>
          <Fld label="Frequenza settimanale">
            <Inp type="number" value={form.frequenza_settimanale} onChange={(e) => setForm((f) => ({ ...f, frequenza_settimanale: e.target.value }))} />
          </Fld>
          <Fld label="Istruzioni personalizzate">
            <Txt value={form.istruzioni_personalizzate} onChange={(e) => setForm((f) => ({ ...f, istruzioni_personalizzate: e.target.value }))} rows={2} />
          </Fld>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button onClick={() => setForm(null)} style={{ background: 'none', border: `1px solid ${C.brd}`, borderRadius: 9, padding: '9px 15px', fontSize: 13, fontWeight: 700, color: C.txm, cursor: 'pointer' }}>Annulla</button>
            <button disabled={salvando || (!form.esercizio_id && !form.nome_nuovo)} onClick={salva} style={{ background: C.suc, border: 'none', borderRadius: 9, padding: '9px 15px', fontSize: 13, fontWeight: 700, color: '#fff', cursor: 'pointer', opacity: salvando || (!form.esercizio_id && !form.nome_nuovo) ? 0.6 : 1 }}>{salvando ? 'Salvataggio…' : 'Prescrivi'}</button>
          </div>
        </Crd>
      )}

      {prescrizioni.filter((p) => p.attiva).length === 0 && !form && <EmptyState icon="pulse" title="Nessun esercizio domiciliare attivo" />}

      {prescrizioni.filter((p) => p.attiva).map((p) => (
        <Crd key={p.id} style={{ marginBottom: 10 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: 13.5 }}>{p.physio_esercizi?.nome || 'Esercizio'}</div>
              <div style={{ fontSize: 11.5, color: C.txm, marginTop: 2 }}>{doseLabel(p)}</div>
              {p.istruzioni_personalizzate && <div style={{ fontSize: 11.5, color: C.txt, marginTop: 4 }}>{p.istruzioni_personalizzate}</div>}
            </div>
            <button onClick={() => disattiva(p.id)} style={{ background: C.danL, border: 'none', borderRadius: 7, padding: '6px 9px', cursor: 'pointer', fontSize: 11, fontWeight: 700, color: C.dan, flexShrink: 0 }}>Sospendi</button>
          </div>
        </Crd>
      ))}

      {prescrizioni.some((p) => !p.attiva) && (
        <details style={{ marginTop: 6 }}>
          <summary style={{ fontSize: 12, color: C.txl, cursor: 'pointer', fontWeight: 700 }}>Esercizi sospesi/conclusi ({prescrizioni.filter((p) => !p.attiva).length})</summary>
          {prescrizioni.filter((p) => !p.attiva).map((p) => (
            <div key={p.id} style={{ fontSize: 11.5, color: C.txl, padding: '5px 0' }}>{p.physio_esercizi?.nome} — fino al {fmtD(p.data_fine)}</div>
          ))}
        </details>
      )}
    </div>
  );
}

/* ── TEAM DEL PERCORSO (POL-RBAC-001A) ──
   Shows who is actively assigned to this patient's care and, for whoever
   holds studio.manage_members or clinical.physiotherapist, lets them assign
   or terminate a professional. This is presentation only: every row shown
   and every action offered here is re-checked server-side by RLS on
   patient_care_assignments — hiding a button is UX, not security. */
function SezioneTeam({ studio_id, paziente_id, currentUserId, canManageTeam }) {
  const [team, setTeam] = useState([]);
  const [nomi, setNomi] = useState({});
  const [loading, setLoading] = useState(true);
  const [manageOpen, setManageOpen] = useState(false);
  const [assignForm, setAssignForm] = useState(null);
  const [eleggibili, setEleggibili] = useState([]);
  const [salvando, setSalvando] = useState(false);
  const [errore, setErrore] = useState('');

  const ricarica = async () => {
    setLoading(true);
    // Data-minimized roster read (server-authoritative): the RPC returns
    // only id/user_id/assignment_type/active, scoped to this one patient's
    // active team. Never select from patient_care_assignments directly here
    // — that table also carries created_by/timestamps/reason, which a
    // PT/massage teammate must not be able to read (Product Owner decision).
    const [{ data: assignments }, { data: utenti }] = await Promise.all([
      supabase.rpc('patient_care_team_roster_v1', { p_studio_id: studio_id, p_patient_id: paziente_id }),
      supabase.from('studio_users').select('user_id,nome,email').eq('studio_id', studio_id),
    ]);
    setTeam(assignments || []);
    const map = {};
    (utenti || []).forEach((u) => { if (u.user_id) map[u.user_id] = u.nome || u.email || 'Professionista'; });
    setNomi(map);
    setLoading(false);
  };

  useEffect(() => { if (paziente_id) ricarica(); }, [paziente_id]);

  const apriAssegna = async () => {
    setErrore('');
    setAssignForm({ assignment_type: 'personal_trainer', user_id: '' });
    const { data } = await supabase.from('studio_user_capabilities').select('user_id,capability').eq('studio_id', studio_id);
    setEleggibili(data || []);
  };

  const professionistiPer = (assignment_type) => {
    const entry = ASSIGNMENT_TYPES.find(([id]) => id === assignment_type);
    const capability = entry ? entry[2] : null;
    const giaAssegnati = new Set(team.filter((t) => t.assignment_type === assignment_type).map((t) => t.user_id));
    return eleggibili.filter((e) => e.capability === capability && !giaAssegnati.has(e.user_id));
  };

  const assegna = async () => {
    if (!assignForm?.user_id) return;
    setSalvando(true);
    setErrore('');
    const { error } = await supabase.from('patient_care_assignments').insert({
      studio_id, patient_id: paziente_id, user_id: assignForm.user_id, assignment_type: assignForm.assignment_type,
    });
    setSalvando(false);
    if (error) { setErrore('Assegnazione non riuscita: ' + error.message); return; }
    setAssignForm(null);
    ricarica();
  };

  const termina = async (row) => {
    if (!confirm(`Terminare l'assegnazione di ${nomi[row.user_id] || 'questo professionista'}?`)) return;
    const { error } = await supabase.from('patient_care_assignments').update({ active: false }).eq('id', row.id);
    if (!error) ricarica();
  };

  const gruppi = ASSIGNMENT_TYPES
    .map(([id, label]) => ({ id, label, righe: team.filter((t) => t.assignment_type === id) }))
    .filter((g) => g.righe.length > 0);

  return (
    <Crd style={{ marginBottom: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, flexWrap: 'wrap', gap: 8 }}>
        <div style={{ fontSize: 12, fontWeight: 800, color: C.txt, display: 'flex', alignItems: 'center', gap: 6 }}><Ic n="users" s={12} c={C.txt} />Team del percorso</div>
        {canManageTeam && (
          <button
            onClick={() => setManageOpen(true)}
            style={{ background: 'none', border: `1.5px solid ${C.brd}`, borderRadius: 8, padding: '6px 11px', fontSize: 11.5, fontWeight: 700, color: C.pri, cursor: 'pointer', minHeight: 32 }}
          >
            Gestisci team
          </button>
        )}
      </div>

      {loading ? (
        <div style={{ fontSize: 12, color: C.txl }}>Caricamento…</div>
      ) : gruppi.length === 0 ? (
        <div style={{ fontSize: 12, color: C.txl }}>Nessun professionista assegnato</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 10 }}>
          {gruppi.map((g) => (
            <div key={g.id}>
              <div style={{ fontSize: 10, fontWeight: 700, color: C.txm, textTransform: 'uppercase', marginBottom: 3 }}>{g.label}{g.righe.length > 1 ? 'i' : ''}</div>
              {g.righe.map((r) => (
                <div key={r.id} style={{ fontSize: 12.5, color: C.txt, padding: '2px 0' }}>
                  {nomi[r.user_id] || 'Professionista'}
                  {r.user_id === currentUserId && <span style={{ color: C.pri, fontWeight: 700 }}> (tu)</span>}
                </div>
              ))}
            </div>
          ))}
        </div>
      )}

      {manageOpen && (
        <Modal title="Team del percorso" icon="users" onClose={() => { setManageOpen(false); setAssignForm(null); }}>
          {team.length === 0 && <div style={{ fontSize: 12, color: C.txl, marginBottom: 12 }}>Nessun professionista assegnato</div>}

          {team.map((r) => (
            <div key={r.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '10px 0', borderBottom: `1px solid ${C.brd}` }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: C.txt, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{nomi[r.user_id] || 'Professionista'}</div>
                <div style={{ fontSize: 11, color: C.txm }}>{ASSIGNMENT_TYPE_LABEL[r.assignment_type] || r.assignment_type}</div>
              </div>
              <button
                onClick={() => termina(r)}
                style={{ background: C.danL, border: 'none', borderRadius: 7, padding: '8px 12px', fontSize: 11.5, fontWeight: 700, color: C.dan, cursor: 'pointer', flexShrink: 0, minHeight: 32 }}
              >
                Termina
              </button>
            </div>
          ))}

          {!assignForm ? (
            <button
              onClick={apriAssegna}
              style={{ marginTop: 14, width: '100%', minHeight: 44, background: C.pri, border: 'none', borderRadius: 10, padding: '11px 16px', color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
            >
              <Ic n="plus" s={14} c="#fff" /> Assegna professionista
            </button>
          ) : (
            <div style={{ marginTop: 14, paddingTop: 14, borderTop: `1px solid ${C.brd}` }}>
              <Fld label="Responsabilità">
                <Sel value={assignForm.assignment_type} onChange={(e) => setAssignForm((f) => ({ ...f, assignment_type: e.target.value, user_id: '' }))}>
                  {ASSIGNMENT_TYPES.map(([id, label]) => <option key={id} value={id}>{label}</option>)}
                </Sel>
              </Fld>
              <Fld label="Professionista">
                <Sel value={assignForm.user_id} onChange={(e) => setAssignForm((f) => ({ ...f, user_id: e.target.value }))}>
                  <option value="">— seleziona —</option>
                  {professionistiPer(assignForm.assignment_type).map((p) => (
                    <option key={p.user_id} value={p.user_id}>{nomi[p.user_id] || p.user_id}</option>
                  ))}
                </Sel>
              </Fld>
              {professionistiPer(assignForm.assignment_type).length === 0 && (
                <div style={{ fontSize: 11.5, color: C.txl, marginBottom: 8 }}>Nessun collaboratore dello studio con questa capability è disponibile (già assegnato o capability non assegnata in Setup → Collaboratori).</div>
              )}
              {errore && <div style={{ fontSize: 11.5, color: C.dan, marginBottom: 8 }}>{errore}</div>}
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button onClick={() => setAssignForm(null)} style={{ background: 'none', border: `1px solid ${C.brd}`, borderRadius: 9, padding: '9px 15px', fontSize: 13, fontWeight: 700, color: C.txm, cursor: 'pointer', minHeight: 40 }}>Annulla</button>
                <button
                  disabled={salvando || !assignForm.user_id}
                  onClick={assegna}
                  style={{ background: C.suc, border: 'none', borderRadius: 9, padding: '9px 15px', fontSize: 13, fontWeight: 700, color: '#fff', cursor: 'pointer', opacity: salvando || !assignForm.user_id ? 0.6 : 1, minHeight: 40 }}
                >
                  {salvando ? 'Salvataggio…' : 'Conferma'}
                </button>
              </div>
            </div>
          )}
        </Modal>
      )}
    </Crd>
  );
}
