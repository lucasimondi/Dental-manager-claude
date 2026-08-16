import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase.js';
import { Btn, Crd, Fld, Inp, Sel, Txt, Modal, Toast, Bdg, Ic } from './ui';
import { C, TIPI_EFFETTO_AZIONE, TIPI_PARAMETRO_AZIONE, LIVELLI_AZIONE_AGENTE } from '../lib/utils';
import { estraiTestoDocumento } from '../lib/estraiTestoDocumento';

const TABS = [
  ['istruzioni', '🧭 Istruzioni'],
  ['faq', '❓ FAQ'],
  ['documenti', '📄 Documenti'],
  ['azioni', '⚡ Azioni'],
  ['livello', '⚙️ Livello & Costi'],
];

// Le tabelle ai_agent_* non hanno una colonna studio_id riempita da un
// trigger: va passata esplicitamente in ogni insert, presa dalla sessione
// (stesso fallback usato altrove nell'app per lo studio demo di default).
const contestoStudio = async () => {
  const { data: { session } } = await supabase.auth.getSession();
  return {
    studioId: session?.user?.app_metadata?.studio_id || '00000000-0000-0000-0000-000000000001',
    userId: session?.user?.id || null,
  };
};

export default function AgenteAISetup({ features }) {
  const [tab, setTab] = useState('istruzioni');
  const [toast, setToast] = useState('');
  const attivo = features?.assistente_ai && features.assistente_ai !== 'off';

  if (!attivo) {
    return (
      <div>
        <div style={{ fontSize: 20, fontWeight: 800, marginBottom: 14 }}>Agente AI</div>
        <Crd style={{ textAlign: 'center', padding: 30, color: C.txm }}>
          L'assistente AI non è attivo per il tuo piano. Attivalo per configurare istruzioni, FAQ, documenti e azioni personalizzate.
        </Crd>
      </div>
    );
  }

  return (
    <div>
      {toast && <Toast msg={toast} onDone={() => setToast('')} />}
      <div style={{ fontSize: 20, fontWeight: 800, marginBottom: 4 }}>Agente AI</div>
      <div style={{ fontSize: 12, color: C.txm, marginBottom: 14 }}>
        Configura la conoscenza e le azioni dell'assistente AI per il tuo studio. Tutto qui si aggiunge alle capacità già presenti, senza toglierle.
      </div>

      <div style={{ display: 'flex', background: C.bg, borderRadius: 10, border: `1px solid ${C.brd}`, marginBottom: 16, overflow: 'hidden', flexWrap: 'wrap' }}>
        {TABS.map(([id, lbl]) => (
          <button key={id} onClick={() => setTab(id)} style={{ flex: 1, minWidth: 100, padding: '10px 6px', border: 'none', background: tab === id ? C.pri : 'transparent', color: tab === id ? '#fff' : C.txm, fontWeight: 700, fontSize: 12.5, cursor: 'pointer' }}>{lbl}</button>
        ))}
      </div>

      {tab === 'istruzioni' && <TabIstruzioni onToast={setToast} />}
      {tab === 'faq' && <TabFaq onToast={setToast} />}
      {tab === 'documenti' && <TabDocumenti onToast={setToast} />}
      {tab === 'azioni' && <TabAzioni onToast={setToast} />}
      {tab === 'livello' && <TabLivello features={features} onToast={setToast} />}
    </div>
  );
}

/* ── TAB ISTRUZIONI ── */
function TabIstruzioni({ onToast }) {
  const [id, setId] = useState(null);
  const [testo, setTesto] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    supabase.from('ai_agent_config').select('id, system_prompt').maybeSingle().then(({ data }) => {
      if (data) { setId(data.id); setTesto(data.system_prompt || ''); }
      setLoading(false);
    });
  }, []);

  const salva = async () => {
    setSaving(true);
    const { studioId, userId } = await contestoStudio();
    if (id) {
      const { error } = await supabase.from('ai_agent_config').update({ system_prompt: testo, updated_by: userId }).eq('id', id);
      if (!error) onToast('Istruzioni salvate ✓'); else onToast('Errore: ' + error.message);
    } else {
      const { data, error } = await supabase.from('ai_agent_config').insert({ system_prompt: testo, studio_id: studioId, updated_by: userId }).select('id').single();
      if (!error) { setId(data.id); onToast('Istruzioni salvate ✓'); } else onToast('Errore: ' + error.message);
    }
    setSaving(false);
  };

  if (loading) return <div style={{ textAlign: 'center', color: C.txl, padding: 30 }}>Caricamento…</div>;

  return (
    <Crd>
      <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 6 }}>Istruzioni aggiuntive per l'assistente</div>
      <div style={{ fontSize: 11.5, color: C.txm, marginBottom: 10, lineHeight: 1.5 }}>
        Questo testo si aggiunge alle regole di base dell'assistente (permessi, conferme, tono) — non le sostituisce.
        Usalo per indicazioni specifiche dello studio: come rispondere in certi casi, cosa dire o non dire, procedure interne.
      </div>
      <Txt rows={10} value={testo} onChange={(e) => setTesto(e.target.value)} placeholder={'Es. "Quando registri un pagamento in contanti, ricorda sempre di chiedere se serve la ricevuta cartacea."'} />
      <div style={{ marginTop: 10 }}><Btn ch={saving ? 'Salvataggio…' : 'Salva istruzioni'} onClick={salva} dis={saving} /></div>
    </Crd>
  );
}

/* ── TAB FAQ ── */
function TabFaq({ onToast }) {
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [form, setForm] = useState({ domanda: '', risposta: '' });

  const carica = () => supabase.from('ai_agent_faq').select('*').order('ordine', { ascending: true }).then(({ data }) => { setList(data || []); setLoading(false); });
  useEffect(() => { carica(); }, []);

  const openNew = () => { setForm({ domanda: '', risposta: '' }); setEditItem(null); setModal(true); };
  const openEdit = (item) => { setForm({ domanda: item.domanda, risposta: item.risposta }); setEditItem(item); setModal(true); };

  const salva = async () => {
    if (!form.domanda.trim() || !form.risposta.trim()) return;
    if (editItem) {
      const { error } = await supabase.from('ai_agent_faq').update({ domanda: form.domanda.trim(), risposta: form.risposta.trim() }).eq('id', editItem.id);
      if (error) { onToast('Errore: ' + error.message); return; }
    } else {
      const { studioId } = await contestoStudio();
      const { error } = await supabase.from('ai_agent_faq').insert({ domanda: form.domanda.trim(), risposta: form.risposta.trim(), ordine: list.length, studio_id: studioId });
      if (error) { onToast('Errore: ' + error.message); return; }
    }
    setModal(false);
    carica();
    onToast(editItem ? 'FAQ aggiornata ✓' : 'FAQ aggiunta ✓');
  };

  const elimina = async (item) => {
    if (!confirm(`Eliminare la domanda "${item.domanda}"?`)) return;
    const { error } = await supabase.from('ai_agent_faq').delete().eq('id', item.id);
    if (error) { onToast('Errore: ' + error.message); return; }
    carica();
  };

  if (loading) return <div style={{ textAlign: 'center', color: C.txl, padding: 30 }}>Caricamento…</div>;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 10 }}>
        <Btn ch="+ Domanda" ic="plus" onClick={openNew} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
        {list.map((f) => (
          <Crd key={f.id} onClick={() => openEdit(f)}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 13 }}>{f.domanda}</div>
                <div style={{ fontSize: 12, color: C.txm, marginTop: 3 }}>{f.risposta}</div>
              </div>
              <button onClick={(e) => { e.stopPropagation(); elimina(f); }} style={{ background: C.danL, border: 'none', borderRadius: 7, padding: '5px 8px', cursor: 'pointer', flexShrink: 0, height: 'fit-content' }}><Ic n="del" s={13} c={C.dan} /></button>
            </div>
          </Crd>
        ))}
        {list.length === 0 && <div style={{ textAlign: 'center', color: C.txl, padding: 30 }}>Nessuna FAQ ancora</div>}
      </div>

      {modal && (
        <Modal title={editItem ? 'Modifica FAQ' : 'Nuova FAQ'} onClose={() => setModal(false)}>
          <Fld label="Domanda"><Inp value={form.domanda} onChange={(e) => setForm((f) => ({ ...f, domanda: e.target.value }))} placeholder="es. Fate trattamenti la sera?" /></Fld>
          <Fld label="Risposta"><Txt rows={4} value={form.risposta} onChange={(e) => setForm((f) => ({ ...f, risposta: e.target.value }))} /></Fld>
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <Btn ch="Annulla" v="sec" onClick={() => setModal(false)} full />
            <Btn ch="Salva" onClick={salva} dis={!form.domanda.trim() || !form.risposta.trim()} full />
          </div>
        </Modal>
      )}
    </div>
  );
}

/* ── TAB DOCUMENTI ── */
function TabDocumenti({ onToast }) {
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [caricando, setCaricando] = useState(false);
  const [modalTesto, setModalTesto] = useState(false);
  const [formTesto, setFormTesto] = useState({ nome: '', testo: '' });

  const carica = () => supabase.from('ai_agent_documenti').select('id, nome, testo, created_at').order('created_at', { ascending: false }).then(({ data }) => { setList(data || []); setLoading(false); });
  useEffect(() => { carica(); }, []);

  const caricaFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setCaricando(true);
    try {
      const testo = await estraiTestoDocumento(file);
      if (!testo) { onToast('Non ho trovato testo leggibile in questo file'); return; }
      const { studioId } = await contestoStudio();
      const { error } = await supabase.from('ai_agent_documenti').insert({ nome: file.name, testo, studio_id: studioId });
      if (error) { onToast('Errore: ' + error.message); return; }
      carica();
      onToast('Documento caricato ✓');
    } catch (err) {
      onToast('Non sono riuscito a leggere il file: ' + (err.message || err));
    } finally {
      setCaricando(false);
    }
  };

  const salvaTesto = async () => {
    if (!formTesto.nome.trim() || !formTesto.testo.trim()) return;
    const { studioId } = await contestoStudio();
    const { error } = await supabase.from('ai_agent_documenti').insert({ nome: formTesto.nome.trim(), testo: formTesto.testo.trim(), studio_id: studioId });
    if (error) { onToast('Errore: ' + error.message); return; }
    setModalTesto(false);
    carica();
    onToast('Testo aggiunto ✓');
  };

  const elimina = async (item) => {
    if (!confirm(`Eliminare "${item.nome}"?`)) return;
    const { error } = await supabase.from('ai_agent_documenti').delete().eq('id', item.id);
    if (error) { onToast('Errore: ' + error.message); return; }
    carica();
  };

  if (loading) return <div style={{ textAlign: 'center', color: C.txl, padding: 30 }}>Caricamento…</div>;

  return (
    <div>
      <div style={{ fontSize: 11.5, color: C.txm, marginBottom: 10, lineHeight: 1.5 }}>
        Carica PDF o file di testo (es. listino esteso, protocolli, condizioni): il testo estratto alimenta la conoscenza dell'assistente. Il file originale non viene conservato, solo il testo.
      </div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
        <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: C.pri, color: '#fff', borderRadius: 10, padding: '10px 17px', fontWeight: 700, fontSize: 14, cursor: caricando ? 'not-allowed' : 'pointer', opacity: caricando ? 0.6 : 1 }}>
          <Ic n="plus" s={14} c="#fff" />{caricando ? 'Caricamento…' : 'Carica file (PDF/TXT)'}
          <input type="file" accept=".pdf,.txt,application/pdf,text/plain" onChange={caricaFile} disabled={caricando} style={{ display: 'none' }} />
        </label>
        <Btn ch="+ Testo manuale" v="sec" onClick={() => { setFormTesto({ nome: '', testo: '' }); setModalTesto(true); }} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
        {list.map((d) => (
          <Crd key={d.id}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 13 }}>{d.nome}</div>
                <div style={{ fontSize: 11, color: C.txl, marginTop: 3 }}>{d.testo.length.toLocaleString('it-IT')} caratteri</div>
              </div>
              <button onClick={() => elimina(d)} style={{ background: C.danL, border: 'none', borderRadius: 7, padding: '5px 8px', cursor: 'pointer', flexShrink: 0, height: 'fit-content' }}><Ic n="del" s={13} c={C.dan} /></button>
            </div>
          </Crd>
        ))}
        {list.length === 0 && <div style={{ textAlign: 'center', color: C.txl, padding: 30 }}>Nessun documento ancora</div>}
      </div>

      {modalTesto && (
        <Modal title="Aggiungi testo manuale" onClose={() => setModalTesto(false)}>
          <Fld label="Nome"><Inp value={formTesto.nome} onChange={(e) => setFormTesto((f) => ({ ...f, nome: e.target.value }))} placeholder="es. Protocollo accoglienza pazienti" /></Fld>
          <Fld label="Testo"><Txt rows={10} value={formTesto.testo} onChange={(e) => setFormTesto((f) => ({ ...f, testo: e.target.value }))} /></Fld>
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <Btn ch="Annulla" v="sec" onClick={() => setModalTesto(false)} full />
            <Btn ch="Salva" onClick={salvaTesto} dis={!formTesto.nome.trim() || !formTesto.testo.trim()} full />
          </div>
        </Modal>
      )}
    </div>
  );
}

/* ── TAB AZIONI ── */
const AZIONE_VUOTA = { nome: '', descrizione: '', tipo_effetto: 'crea_richiamo', richiede_conferma: true, attiva: true, config: {}, parametri: [] };

function TabAzioni({ onToast }) {
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [form, setForm] = useState(AZIONE_VUOTA);

  const carica = () => supabase.from('ai_agent_actions').select('*').order('created_at', { ascending: false }).then(({ data }) => { setList(data || []); setLoading(false); });
  useEffect(() => { carica(); }, []);

  const openNew = () => { setForm(AZIONE_VUOTA); setEditItem(null); setModal(true); };
  const openEdit = (item) => { setForm({ ...AZIONE_VUOTA, ...item, config: item.config || {}, parametri: item.parametri || [] }); setEditItem(item); setModal(true); };

  const nomeValido = /^[a-z][a-z0-9_]*$/.test(form.nome);
  const pronta = nomeValido && form.descrizione.trim() && (form.tipo_effetto !== 'webhook' || form.config?.url?.trim());

  const salva = async () => {
    if (!pronta) return;
    const payload = {
      nome: form.nome, descrizione: form.descrizione.trim(), tipo_effetto: form.tipo_effetto,
      richiede_conferma: form.richiede_conferma, attiva: form.attiva,
      config: form.tipo_effetto === 'webhook' ? { url: form.config.url.trim() } : {},
      parametri: form.tipo_effetto === 'webhook' ? form.parametri.filter((p) => p.nome) : [],
    };
    if (editItem) {
      const { error } = await supabase.from('ai_agent_actions').update(payload).eq('id', editItem.id);
      if (error) { onToast('Errore: ' + error.message); return; }
    } else {
      const { studioId } = await contestoStudio();
      const { error } = await supabase.from('ai_agent_actions').insert({ ...payload, studio_id: studioId });
      if (error) { onToast('Errore: ' + (error.message.includes('duplicate') ? 'Esiste già un\'azione con questo nome' : error.message)); return; }
    }
    setModal(false);
    carica();
    onToast(editItem ? 'Azione aggiornata ✓' : 'Azione creata ✓');
  };

  const elimina = async (item) => {
    if (!confirm(`Eliminare l'azione "${item.nome}"?`)) return;
    const { error } = await supabase.from('ai_agent_actions').delete().eq('id', item.id);
    if (error) { onToast('Errore: ' + error.message); return; }
    carica();
  };

  const aggiungiParametro = () => setForm((f) => ({ ...f, parametri: [...f.parametri, { nome: '', tipo: 'string', descrizione: '', obbligatorio: false }] }));
  const aggiornaParametro = (i, patch) => setForm((f) => ({ ...f, parametri: f.parametri.map((p, j) => (j === i ? { ...p, ...patch } : p)) }));
  const rimuoviParametro = (i) => setForm((f) => ({ ...f, parametri: f.parametri.filter((_, j) => j !== i) }));

  const effettoInfo = TIPI_EFFETTO_AZIONE.find((t) => t.id === form.tipo_effetto);

  if (loading) return <div style={{ textAlign: 'center', color: C.txl, padding: 30 }}>Caricamento…</div>;

  return (
    <div>
      <div style={{ fontSize: 11.5, color: C.txm, marginBottom: 10, lineHeight: 1.5 }}>
        Le azioni già disponibili nell'assistente (appuntamenti, pagamenti, ecc.) restano invariate. Qui puoi aggiungerne di nuove che l'assistente può eseguire da solo, scegliendo tra effetti sicuri predefiniti.
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 10 }}>
        <Btn ch="+ Azione" ic="plus" onClick={openNew} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
        {list.map((a) => {
          const info = TIPI_EFFETTO_AZIONE.find((t) => t.id === a.tipo_effetto);
          return (
            <Crd key={a.id} onClick={() => openEdit(a)}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 13, fontFamily: 'monospace' }}>{a.nome}</div>
                  <div style={{ fontSize: 12, color: C.txm, marginTop: 3 }}>{a.descrizione}</div>
                  <div style={{ marginTop: 6, display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                    <Bdg ch={`${info?.icona || ''} ${info?.label || a.tipo_effetto}`} co={C.pri} />
                    {a.richiede_conferma && <Bdg ch="richiede conferma" co={C.war} />}
                    {!a.attiva && <Bdg ch="disattivata" co={C.txl} />}
                  </div>
                </div>
                <button onClick={(e) => { e.stopPropagation(); elimina(a); }} style={{ background: C.danL, border: 'none', borderRadius: 7, padding: '5px 8px', cursor: 'pointer', flexShrink: 0, height: 'fit-content' }}><Ic n="del" s={13} c={C.dan} /></button>
              </div>
            </Crd>
          );
        })}
        {list.length === 0 && <div style={{ textAlign: 'center', color: C.txl, padding: 30 }}>Nessuna azione personalizzata ancora</div>}
      </div>

      {modal && (
        <Modal title={editItem ? 'Modifica azione' : 'Nuova azione'} onClose={() => setModal(false)} wide>
          <Fld label="Nome tecnico (solo minuscole, numeri, underscore)">
            <Inp value={form.nome} onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_') }))} placeholder="es. richiama_dopo_trattamento" />
          </Fld>
          <Fld label="Descrizione (spiega all'AI quando usarla)">
            <Txt rows={2} value={form.descrizione} onChange={(e) => setForm((f) => ({ ...f, descrizione: e.target.value }))} placeholder="es. Usa questa azione quando il paziente chiede di essere richiamato per un controllo" />
          </Fld>
          <Fld label="Effetto">
            <Sel value={form.tipo_effetto} onChange={(e) => setForm((f) => ({ ...f, tipo_effetto: e.target.value }))}>
              {TIPI_EFFETTO_AZIONE.map((t) => <option key={t.id} value={t.id}>{t.icona} {t.label}</option>)}
            </Sel>
          </Fld>
          {effettoInfo && <div style={{ fontSize: 11.5, color: C.txm, marginTop: -8, marginBottom: 13 }}>{effettoInfo.descr}</div>}

          {form.tipo_effetto !== 'webhook' && effettoInfo?.parametriFissi && (
            <div style={{ background: C.bg, borderRadius: 8, padding: '8px 12px', marginBottom: 13, fontSize: 11.5, color: C.txm }}>
              Parametri fissi che l'AI compilerà: <span style={{ fontFamily: 'monospace' }}>{effettoInfo.parametriFissi}</span>
            </div>
          )}

          {form.tipo_effetto === 'webhook' && (
            <>
              <Fld label="URL webhook">
                <Inp value={form.config.url || ''} onChange={(e) => setForm((f) => ({ ...f, config: { ...f.config, url: e.target.value } }))} placeholder="https://..." />
              </Fld>
              <Fld label="Parametri che l'AI dovrà fornire">
                {form.parametri.map((p, i) => (
                  <div key={i} style={{ display: 'flex', gap: 6, marginBottom: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                    <Inp value={p.nome} onChange={(e) => aggiornaParametro(i, { nome: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_') })} placeholder="nome_campo" style={{ flex: '1 1 110px' }} />
                    <Sel value={p.tipo} onChange={(e) => aggiornaParametro(i, { tipo: e.target.value })} style={{ flex: '0 0 100px' }}>
                      {TIPI_PARAMETRO_AZIONE.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
                    </Sel>
                    <Inp value={p.descrizione} onChange={(e) => aggiornaParametro(i, { descrizione: e.target.value })} placeholder="descrizione (per l'AI)" style={{ flex: '2 1 140px' }} />
                    <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: C.txm, flexShrink: 0 }}>
                      <input type="checkbox" checked={p.obbligatorio} onChange={(e) => aggiornaParametro(i, { obbligatorio: e.target.checked })} /> Oblig.
                    </label>
                    <button onClick={() => rimuoviParametro(i)} style={{ background: C.danL, border: 'none', borderRadius: 6, padding: '6px 8px', cursor: 'pointer', flexShrink: 0 }}><Ic n="del" s={12} c={C.dan} /></button>
                  </div>
                ))}
                <button onClick={aggiungiParametro} style={{ background: C.priL, border: 'none', borderRadius: 7, padding: '6px 10px', color: C.pri, fontWeight: 700, fontSize: 11.5, cursor: 'pointer' }}>+ Parametro</button>
              </Fld>
            </>
          )}

          <div style={{ display: 'flex', gap: 16, marginTop: 4, marginBottom: 13 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, fontWeight: 600, color: C.txt, cursor: 'pointer' }}>
              <input type="checkbox" checked={form.richiede_conferma} onChange={(e) => setForm((f) => ({ ...f, richiede_conferma: e.target.checked }))} /> Richiede conferma prima di eseguire
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, fontWeight: 600, color: C.txt, cursor: 'pointer' }}>
              <input type="checkbox" checked={form.attiva} onChange={(e) => setForm((f) => ({ ...f, attiva: e.target.checked }))} /> Attiva
            </label>
          </div>

          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <Btn ch="Annulla" v="sec" onClick={() => setModal(false)} full />
            <Btn ch="Salva" onClick={salva} dis={!pronta} full />
          </div>
        </Modal>
      )}
    </div>
  );
}

/* ── TAB LIVELLO & COSTI ── */
function TabLivello({ features, onToast }) {
  const [azione, setAzione] = useState(features?.agente_azione || 'completo');
  const [saving, setSaving] = useState(false);
  const ceiling = features?.agente_azione_max || 'completo';
  const rankCeiling = LIVELLI_AZIONE_AGENTE.find((l) => l.id === ceiling)?.rank ?? 3;

  const [usoLoading, setUsoLoading] = useState(true);
  const [uso, setUso] = useState({ chat: { chiamate: 0, costo: 0 }, consigli_proattivi: { chiamate: 0, costo: 0 } });

  useEffect(() => {
    const inizioMese = new Date();
    inizioMese.setDate(1);
    const inizioMeseStr = inizioMese.toISOString().slice(0, 10);
    supabase.from('ai_agent_usage').select('fonte, costo_usd').gte('creato_il', inizioMeseStr).then(({ data }) => {
      const acc = { chat: { chiamate: 0, costo: 0 }, consigli_proattivi: { chiamate: 0, costo: 0 } };
      for (const r of (data || [])) {
        if (!acc[r.fonte]) continue;
        acc[r.fonte].chiamate += 1;
        acc[r.fonte].costo += Number(r.costo_usd || 0);
      }
      setUso(acc);
      setUsoLoading(false);
    });
  }, []);

  const salva = async (nuovoAzione) => {
    setSaving(true);
    const { error } = await supabase.rpc('set_agente_azione', { p_azione: nuovoAzione });
    setSaving(false);
    if (error) { onToast('Errore: ' + error.message); return; }
    setAzione(nuovoAzione);
    onToast('Livello aggiornato ✓');
  };

  const costoTotale = uso.chat.costo + uso.consigli_proattivi.costo;

  return (
    <div>
      <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 6 }}>Livello di autonomia</div>
      <div style={{ fontSize: 11.5, color: C.txm, marginBottom: 12, lineHeight: 1.5 }}>
        Controlla quanto l'agente può fare da solo, in chat e nei consigli proattivi — indipendente dal piano.
        {ceiling !== 'completo' && (
          <> Per questo studio è impostato un tetto massimo: <b>{LIVELLI_AZIONE_AGENTE.find((l) => l.id === ceiling)?.label}</b>.</>
        )}
      </div>
      {LIVELLI_AZIONE_AGENTE.slice().reverse().map((l) => {
        const disabilitato = l.rank > rankCeiling;
        const selezionato = azione === l.id;
        return (
          <Crd key={l.id} onClick={() => !disabilitato && !saving && salva(l.id)}
            style={{ marginBottom: 8, cursor: disabilitato ? 'not-allowed' : 'pointer', opacity: disabilitato ? 0.5 : 1, border: `2px solid ${selezionato ? C.pri : C.brd}` }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 18, height: 18, borderRadius: '50%', border: `2px solid ${selezionato ? C.pri : C.brd}`, background: selezionato ? C.pri : 'transparent', flexShrink: 0 }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: 13 }}>{l.label}</div>
                <div style={{ fontSize: 11.5, color: C.txm, marginTop: 2 }}>{l.descr}</div>
                {disabilitato && <div style={{ fontSize: 10.5, color: C.dan, marginTop: 3 }}>Non disponibile: supera il tetto impostato per questo studio.</div>}
              </div>
            </div>
          </Crd>
        );
      })}

      <div style={{ fontSize: 13, fontWeight: 700, marginTop: 22, marginBottom: 6 }}>Costo di questo mese</div>
      <div style={{ fontSize: 11.5, color: C.txm, marginBottom: 10, lineHeight: 1.5 }}>
        Stima basata sui token realmente consumati da ogni chiamata a Claude (chat + consigli proattivi).
      </div>
      {usoLoading ? (
        <div style={{ textAlign: 'center', color: C.txl, padding: 20 }}>⏳ Caricamento...</div>
      ) : (
        <>
          <Crd style={{ marginBottom: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: C.txm }}>Totale stimato</div>
              <div style={{ fontSize: 20, fontWeight: 900, color: C.pri }}>${costoTotale.toFixed(2)}</div>
            </div>
          </Crd>
          <div style={{ display: 'flex', gap: 8 }}>
            <Crd style={{ flex: 1 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: C.txm }}>💬 Chat</div>
              <div style={{ fontSize: 15, fontWeight: 800, marginTop: 2 }}>${uso.chat.costo.toFixed(2)}</div>
              <div style={{ fontSize: 10.5, color: C.txl }}>{uso.chat.chiamate} chiamate</div>
            </Crd>
            <Crd style={{ flex: 1 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: C.txm }}>🧭 Consigli proattivi</div>
              <div style={{ fontSize: 15, fontWeight: 800, marginTop: 2 }}>${uso.consigli_proattivi.costo.toFixed(2)}</div>
              <div style={{ fontSize: 10.5, color: C.txl }}>{uso.consigli_proattivi.chiamate} run</div>
            </Crd>
          </div>
        </>
      )}
    </div>
  );
}
