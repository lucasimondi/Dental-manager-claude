import React, { useState, useEffect } from 'react';
import { Btn, Crd, Fld, Inp, Sel, Modal, Toast, Ic, Bdg } from './ui';
import { C, uid, fmt, DEF_PRICE, getCategoriePrestazioni } from '../lib/utils';
import { supabase } from '../lib/supabase.js';

const FORM_VUOTO = { cat: '', cod: '', nome: '', prezzo: '', richiamoMesi: '', durataMinuti: '' };

// Costo di un materiale/macchinario collegato a una prestazione, per singolo
// utilizzo: stessa formula usata in Costi → Materiali/Macchinari, qui solo
// riletta per calcolare la marginalità della prestazione.
const costoUsoMateriale = (m) => Number(m.costo) / Math.max(1, Number(m.resa));
const costoUsoMacchinario = (m) => {
  if (!m.utilizzi_stimati_anno) return null;
  return (Number(m.costo_acquisto) / Math.max(1, Number(m.anni_ammortamento))) / Number(m.utilizzi_stimati_anno) + Number(m.costo_consumabile_uso || 0);
};

// ─────────────────────────────────────────────────────────────────
// Costi collegati a una prestazione: materiali/macchinari usati (con
// quantità) + tempo poltrona, per calcolarne la marginalità reale. Ogni
// aggiunta/rimozione scrive subito sul DB (come Operatori/Poltrone in
// Agenda), non fa parte del ciclo salva/annulla della prestazione — solo
// disponibile modificando una prestazione già esistente (serve un id reale
// su cui agganciare i collegamenti).
function CostiCollegati({ pricelistId, studioId, prezzo }) {
  const [materiali, setMateriali] = useState([]);
  const [macchinari, setMacchinari] = useState([]);
  const [collegatiMat, setCollegatiMat] = useState([]);
  const [collegatiMacc, setCollegatiMacc] = useState([]);
  const [costoOrario, setCostoOrario] = useState(null);
  const [nuovoMatId, setNuovoMatId] = useState('');
  const [nuovoMaccId, setNuovoMaccId] = useState('');

  const carica = async () => {
    const [{ data: mat }, { data: macc }, { data: cm }, { data: cmc }] = await Promise.all([
      supabase.from('materiali').select('*').eq('attivo', true).order('nome'),
      supabase.from('macchinari').select('*').eq('attivo', true).order('nome'),
      supabase.from('prestazione_materiali').select('*').eq('pricelist_id', pricelistId),
      supabase.from('prestazione_macchinari').select('*').eq('pricelist_id', pricelistId),
    ]);
    setMateriali(mat || []);
    setMacchinari(macc || []);
    setCollegatiMat(cm || []);
    setCollegatiMacc(cmc || []);
  };
  useEffect(() => { carica(); }, [pricelistId]);
  useEffect(() => {
    if (!studioId) return;
    supabase.rpc('get_costo_orario', { p_studio_id: studioId }).then(({ data }) => { if (data) setCostoOrario(data.costo_orario); });
  }, [studioId]);

  const aggiungiMateriale = async () => {
    if (!nuovoMatId) return;
    await supabase.from('prestazione_materiali').insert([{ studio_id: studioId, pricelist_id: pricelistId, materiale_id: Number(nuovoMatId), quantita: 1 }]);
    setNuovoMatId('');
    carica();
  };
  const aggiungiMacchinario = async () => {
    if (!nuovoMaccId) return;
    await supabase.from('prestazione_macchinari').insert([{ studio_id: studioId, pricelist_id: pricelistId, macchinario_id: Number(nuovoMaccId), quantita: 1 }]);
    setNuovoMaccId('');
    carica();
  };
  const aggiornaQuantitaMat = async (id, quantita) => { await supabase.from('prestazione_materiali').update({ quantita }).eq('id', id); carica(); };
  const aggiornaQuantitaMacc = async (id, quantita) => { await supabase.from('prestazione_macchinari').update({ quantita }).eq('id', id); carica(); };
  const rimuoviMateriale = async (id) => { await supabase.from('prestazione_materiali').delete().eq('id', id); carica(); };
  const rimuoviMacchinario = async (id) => { await supabase.from('prestazione_macchinari').delete().eq('id', id); carica(); };

  const materialiDisponibili = materiali.filter((m) => !collegatiMat.some((c) => c.materiale_id === m.id));
  const macchinariDisponibili = macchinari.filter((m) => !collegatiMacc.some((c) => c.macchinario_id === m.id));

  const costoMateriali = collegatiMat.reduce((s, c) => { const m = materiali.find((x) => x.id === c.materiale_id); return m ? s + costoUsoMateriale(m) * Number(c.quantita) : s; }, 0);
  const costoMacchinari = collegatiMacc.reduce((s, c) => { const m = macchinari.find((x) => x.id === c.macchinario_id); const cu = m ? costoUsoMacchinario(m) : null; return cu != null ? s + cu * Number(c.quantita) : s; }, 0);
  const costoTotale = costoMateriali + costoMacchinari;
  const margine = Number(prezzo || 0) - costoTotale;
  const marginePct = Number(prezzo) > 0 ? (margine / Number(prezzo)) * 100 : null;

  return (
    <div style={{ borderTop: `1px solid ${C.brd}`, marginTop: 4, paddingTop: 14, marginBottom: 8 }}>
      <div style={{ fontSize: 11.5, fontWeight: 700, marginBottom: 2 }}>Costi collegati</div>
      <div style={{ fontSize: 10.5, color: C.txl, marginBottom: 10 }}>Materiali e macchinari usati per questa prestazione — per la marginalità in Controllo → Marginalità.</div>

      <div style={{ fontSize: 11, fontWeight: 700, color: C.txm, marginBottom: 6 }}>Materiali</div>
      {collegatiMat.map((c) => {
        const m = materiali.find((x) => x.id === c.materiale_id);
        if (!m) return null;
        return (
          <div key={c.id} style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6, padding: '5px 0' }}>
            <span style={{ flex: '1 1 100px', minWidth: 0, fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.nome}</span>
            <span style={{ fontSize: 10.5, color: C.txl, flexShrink: 0, whiteSpace: 'nowrap' }}>{fmt(costoUsoMateriale(m))}/uso ×</span>
            <input type="number" min="0.1" step="0.1" value={c.quantita} onChange={(e) => aggiornaQuantitaMat(c.id, Number(e.target.value) || 1)} style={{ width: 46, flexShrink: 0, border: `1px solid ${C.brd}`, borderRadius: 6, padding: '3px 5px', fontSize: 12, textAlign: 'center' }} />
            <button onClick={() => rimuoviMateriale(c.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, flexShrink: 0 }}><Ic n="x" s={12} c={C.dan} /></button>
          </div>
        );
      })}
      {materialiDisponibili.length > 0 && (
        <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
          <Sel value={nuovoMatId} onChange={(e) => setNuovoMatId(e.target.value)} style={{ flex: 1, minWidth: 0 }}>
            <option value="">+ Aggiungi materiale...</option>
            {materialiDisponibili.map((m) => <option key={m.id} value={m.id}>{m.nome} ({fmt(costoUsoMateriale(m))}/uso)</option>)}
          </Sel>
          <button onClick={aggiungiMateriale} disabled={!nuovoMatId} style={{ background: nuovoMatId ? C.priL : C.bg, border: 'none', borderRadius: 8, padding: '0 12px', color: nuovoMatId ? C.pri : C.txl, fontWeight: 700, fontSize: 12, cursor: nuovoMatId ? 'pointer' : 'not-allowed', flexShrink: 0 }}>+</button>
        </div>
      )}
      {materiali.length === 0 && <div style={{ fontSize: 10.5, color: C.txl }}>Nessun materiale in libreria — aggiungili in Controllo → Costi → Materiali.</div>}

      <div style={{ fontSize: 11, fontWeight: 700, color: C.txm, marginTop: 14, marginBottom: 6 }}>Macchinari</div>
      {collegatiMacc.map((c) => {
        const m = macchinari.find((x) => x.id === c.macchinario_id);
        if (!m) return null;
        const cu = costoUsoMacchinario(m);
        return (
          <div key={c.id} style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6, padding: '5px 0' }}>
            <span style={{ flex: '1 1 100px', minWidth: 0, fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.nome}</span>
            <span style={{ fontSize: 10.5, color: C.txl, flexShrink: 0, whiteSpace: 'nowrap' }}>{cu != null ? `${fmt(cu)}/uso ×` : 'costo/uso non configurato'}</span>
            <input type="number" min="0.1" step="0.1" value={c.quantita} onChange={(e) => aggiornaQuantitaMacc(c.id, Number(e.target.value) || 1)} style={{ width: 46, flexShrink: 0, border: `1px solid ${C.brd}`, borderRadius: 6, padding: '3px 5px', fontSize: 12, textAlign: 'center' }} />
            <button onClick={() => rimuoviMacchinario(c.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, flexShrink: 0 }}><Ic n="x" s={12} c={C.dan} /></button>
          </div>
        );
      })}
      {macchinariDisponibili.length > 0 && (
        <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
          <Sel value={nuovoMaccId} onChange={(e) => setNuovoMaccId(e.target.value)} style={{ flex: 1, minWidth: 0 }}>
            <option value="">+ Aggiungi macchinario...</option>
            {macchinariDisponibili.map((m) => <option key={m.id} value={m.id}>{m.nome}</option>)}
          </Sel>
          <button onClick={aggiungiMacchinario} disabled={!nuovoMaccId} style={{ background: nuovoMaccId ? C.priL : C.bg, border: 'none', borderRadius: 8, padding: '0 12px', color: nuovoMaccId ? C.pri : C.txl, fontWeight: 700, fontSize: 12, cursor: nuovoMaccId ? 'pointer' : 'not-allowed', flexShrink: 0 }}>+</button>
        </div>
      )}
      {macchinari.length === 0 && <div style={{ fontSize: 10.5, color: C.txl }}>Nessun macchinario in libreria — aggiungili in Controllo → Costi → Macchinari.</div>}

      {(costoMateriali > 0 || costoMacchinari > 0) && (
        <div style={{ background: C.bg, borderRadius: 10, padding: 12, marginTop: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11.5, color: C.txm, marginBottom: 3 }}><span>Costo materiali</span><span>{fmt(costoMateriali)}</span></div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11.5, color: C.txm, marginBottom: 3 }}><span>Costo macchinari</span><span>{fmt(costoMacchinari)}</span></div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, fontWeight: 800, color: C.txt, marginTop: 6, paddingTop: 6, borderTop: `1px solid ${C.brd}` }}>
            <span>Margine</span>
            <span style={{ color: marginePct == null ? C.txt : marginePct >= 40 ? C.suc : marginePct >= 20 ? C.war : C.dan }}>
              {fmt(margine)}{marginePct != null && ` (${Math.round(marginePct)}%)`}
            </span>
          </div>
          {costoOrario != null && <div style={{ fontSize: 10, color: C.txl, marginTop: 4 }}>Non include il tempo poltrona — vedi il dettaglio in Controllo → Marginalità (costo orario stimato {fmt(costoOrario)}/h).</div>}
        </div>
      )}
    </div>
  );
}

export default function Listino({ pricelist, setPricelist, si }) {
  const isDentistico = !si?.vertical || si.vertical === 'dentistico';
  const categorie = getCategoriePrestazioni(si?.vertical);
  const [modal, setModal] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [form, setForm] = useState(FORM_VUOTO);
  const [toast, setToast] = useState('');
  const [confirmDelId, setConfirmDelId] = useState(null);

  const cats = [...new Set(pricelist.map((p) => p.cat))];

  const openNew = () => { setForm({ ...FORM_VUOTO, cat: categorie[0] }); setEditItem(null); setModal(true); };
  const openEdit = (item) => { setForm({ ...FORM_VUOTO, cat: categorie[0], ...item, prezzo: String(item.prezzo), richiamoMesi: item.richiamoMesi != null ? String(item.richiamoMesi) : '', durataMinuti: item.durataMinuti != null ? String(item.durataMinuti) : '' }); setEditItem(item); setModal(true); };

  const save = () => {
    if (!form.nome || !form.prezzo) return;
    const salvata = { ...form, prezzo: Number(form.prezzo), richiamoMesi: form.richiamoMesi === '' ? null : Number(form.richiamoMesi), durataMinuti: form.durataMinuti === '' ? null : Number(form.durataMinuti) };
    if (editItem) setPricelist((p) => p.map((x) => (x.id === editItem.id ? salvata : x)));
    else setPricelist((p) => [...p, { ...salvata, id: uid() }]);
    setModal(false);
    setToast(editItem ? 'Aggiornata ✓' : 'Aggiunta ✓');
  };

  // nomi delle vecchie 12 voci del listino demo iniziale, da rimuovere durante l'aggiornamento
  const VECCHIE_VOCI_DEMO = [
    'Igiene professionale', 'Otturazione composito 1 sup.', 'Otturazione composito 2 sup.',
    'Devitalizzazione 1 canale', 'Devitalizzazione 3 canali', 'Corona in ceramica',
    'Impianto osseointegrato', 'Estrazione semplice', 'Estrazione dente incluso',
    'Consulenza ortodontica', 'Ortopantomografia', 'Curettage per quadrante',
  ];

  const caricaListinoStudio = () => {
    const daRimuovere = pricelist.filter((p) => VECCHIE_VOCI_DEMO.includes((p.nome || '').trim()));
    const esistenti = new Set(pricelist.map((p) => (p.nome || '').trim().toLowerCase()));
    const daAggiungere = DEF_PRICE.filter((item) => !esistenti.has(item.nome.trim().toLowerCase()));
    if (daRimuovere.length === 0 && daAggiungere.length === 0) {
      setToast('Listino già aggiornato');
      return;
    }
    if (!confirm(`Verranno rimosse ${daRimuovere.length} vecchie voci demo e aggiunte ${daAggiungere.length} voci del listino studio. Le voci aggiunte manualmente da te non vengono toccate. Procedere?`)) return;
    setPricelist((p) => [
      ...p.filter((x) => !VECCHIE_VOCI_DEMO.includes((x.nome || '').trim())),
      ...daAggiungere.map((item) => { const { id, ...rest } = item; return { ...rest, id: uid() }; }),
    ]);
    setToast(`${daRimuovere.length} rimosse, ${daAggiungere.length} aggiunte ✓`);
  };

  return (
    <div>
      {toast && <Toast msg={toast} onDone={() => setToast('')} />}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8, gap: 8, flexWrap: 'wrap' }}>
        <div style={{ fontSize: 20, fontWeight: 800 }}>Listino</div>
        <div style={{ display: 'flex', gap: 6 }}>
          {isDentistico && (
          <button onClick={caricaListinoStudio} style={{ background: C.purL, border: 'none', borderRadius: 10, padding: '10px 12px', color: C.pur, fontWeight: 700, fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}>
            🔄 Aggiorna listino
          </button>
          )}
          <Btn ch="Nuova" ic="plus" onClick={openNew} />
        </div>
      </div>
      <div style={{ fontSize: 12, color: C.txm, marginBottom: 12 }}>Tocca per modificare</div>

      {cats.map((cat) => (
        <div key={cat} style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: C.pri, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 7 }}>{cat}</div>
          <Crd style={{ padding: 0, overflow: 'hidden' }}>
            {pricelist.filter((p) => p.cat === cat).map((item, i, arr) => {
              const confirming = confirmDelId === item.id;
              return (
                <div key={item.id}>
                  <div onClick={() => openEdit(item)} style={{ display: 'flex', alignItems: 'center', padding: '12px 13px', borderBottom: i < arr.length - 1 || confirming ? `1px solid ${C.brd}` : 'none', gap: 9, cursor: 'pointer' }}>
                    {item.cod && <span style={{ fontFamily: 'monospace', fontSize: 10, background: C.bg, padding: '1px 5px', borderRadius: 3, color: C.txm, flexShrink: 0 }}>{item.cod}</span>}
                    <span style={{ flex: 1, fontWeight: 600, fontSize: 13 }}>{item.nome}</span>
                    {item.richiamoMesi != null && <span style={{ flexShrink: 0 }}><Bdg ch={`🔔 ${item.richiamoMesi}m`} co={C.pur} /></span>}
                    <span style={{ fontWeight: 800, color: C.pri, flexShrink: 0 }}>{fmt(item.prezzo)}</span>
                    <button onClick={(e) => { e.stopPropagation(); setConfirmDelId(confirming ? null : item.id); }} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, flexShrink: 0, display: 'flex' }}>
                      <Ic n="del" s={14} c={C.dan} />
                    </button>
                    <Ic n="edit" s={12} c={C.txl} />
                  </div>
                  {confirming && (
                    <div style={{ background: C.danL, padding: '8px 13px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, borderBottom: i < arr.length - 1 ? `1px solid ${C.brd}` : 'none' }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: C.dan }}>Eliminare "{item.nome}"?</span>
                      <div style={{ display: 'flex', gap: 5, flexShrink: 0 }}>
                        <button onClick={() => setConfirmDelId(null)} style={{ background: '#fff', border: `1px solid ${C.brd}`, borderRadius: 6, padding: '4px 9px', fontSize: 10, fontWeight: 700, cursor: 'pointer', color: C.txm }}>No</button>
                        <button onClick={() => { setPricelist((p) => p.filter((x) => x.id !== item.id)); setConfirmDelId(null); }} style={{ background: C.dan, border: 'none', borderRadius: 6, padding: '4px 9px', fontSize: 10, fontWeight: 700, cursor: 'pointer', color: '#fff' }}>Sì, elimina</button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </Crd>
        </div>
      ))}

      {modal && (
        <Modal title={editItem ? 'Modifica prestazione' : 'Nuova prestazione'} onClose={() => setModal(false)}>
          <Fld label="Categoria">
            <Sel value={form.cat} onChange={(e) => setForm((f) => ({ ...f, cat: e.target.value }))}>
              {categorie.map((c) => <option key={c}>{c}</option>)}
            </Sel>
          </Fld>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <Fld label="Codice"><Inp value={form.cod || ''} onChange={(e) => setForm((f) => ({ ...f, cod: e.target.value }))} placeholder="D2140" /></Fld>
            <Fld label="Prezzo €"><Inp type="number" inputMode="decimal" value={form.prezzo} onChange={(e) => setForm((f) => ({ ...f, prezzo: e.target.value }))} /></Fld>
          </div>
          <Fld label="Nome prestazione"><Inp value={form.nome} onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))} /></Fld>
          <Fld label="Richiamo dopo (mesi)">
            <Inp type="number" min="0" inputMode="numeric" value={form.richiamoMesi} onChange={(e) => setForm((f) => ({ ...f, richiamoMesi: e.target.value }))} placeholder="Automatico (rilevato dal nome, es. igiene → 6 mesi)" />
          </Fld>
          <div style={{ fontSize: 11, color: C.txl, marginTop: -8, marginBottom: 13 }}>Lasciare vuoto per lasciar decidere al bot in base al nome della prestazione. Vale quando questa prestazione viene segnata "eseguita" nella scheda paziente.</div>
          <Fld label="Durata media (minuti, opzionale)">
            <Inp type="number" min="0" inputMode="numeric" value={form.durataMinuti} onChange={(e) => setForm((f) => ({ ...f, durataMinuti: e.target.value }))} placeholder="es. 45" />
          </Fld>
          <div style={{ fontSize: 11, color: C.txl, marginTop: -8, marginBottom: 13 }}>Usata per stimare il costo del tempo poltrona nella marginalità (Controllo → Marginalità).</div>
          <div style={{ display: 'flex', gap: 7, marginTop: 8 }}>
            <Btn ch="Annulla" v="sec" onClick={() => setModal(false)} full />
            <Btn ch="Salva" onClick={save} full />
          </div>
          {editItem && <CostiCollegati pricelistId={editItem.id} studioId={si?.studio_id} prezzo={form.prezzo} />}
        </Modal>
      )}
    </div>
  );
}
