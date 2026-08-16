import React, { useState } from 'react';
import { Btn, Crd, Fld, Inp, Sel, Modal, Toast, Ic, Bdg } from './ui';
import { C, uid, fmt, DEF_PRICE, getCategoriePrestazioni } from '../lib/utils';

const FORM_VUOTO = { cat: '', cod: '', nome: '', prezzo: '', richiamoMesi: '' };

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
  const openEdit = (item) => { setForm({ ...FORM_VUOTO, cat: categorie[0], ...item, prezzo: String(item.prezzo), richiamoMesi: item.richiamoMesi != null ? String(item.richiamoMesi) : '' }); setEditItem(item); setModal(true); };

  const save = () => {
    if (!form.nome || !form.prezzo) return;
    const salvata = { ...form, prezzo: Number(form.prezzo), richiamoMesi: form.richiamoMesi === '' ? null : Number(form.richiamoMesi) };
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
          <div style={{ display: 'flex', gap: 7, marginTop: 8 }}>
            <Btn ch="Annulla" v="sec" onClick={() => setModal(false)} full />
            <Btn ch="Salva" onClick={save} full />
          </div>
        </Modal>
      )}
    </div>
  );
}
