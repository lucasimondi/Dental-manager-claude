import React, { useState, useEffect } from 'react';
import { Crd, Fld, Inp, Sel, Modal, Toast, Bdg, Ic, Btn, PdfViewerModal } from './ui';
import { cercaPazienti } from '../lib/ricercaPazienti';
import { C, fmt, fmtD, today } from '../lib/utils';
import { supabase } from '../lib/supabase.js';
import { scaricaPdf } from '../lib/condivisionePdf';

export default function ArchivioDocs({ patients, onApriDocFiscale, onApriDocMedico }) {
  const [pazModal, setPazModal] = useState(null); // 'fiscale' | 'medico' | null
  const [pazSearch, setPazSearch] = useState('');
  const [docs, setDocs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState('');
  const [filtroTipo, setFiltroTipo] = useState('tutti');
  const [filtroPaz, setFiltroPaz] = useState('');
  const [selDoc, setSelDoc] = useState([]);
  const [editDoc, setEditDoc] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [docInVisualizzazione, setDocInVisualizzazione] = useState(null);
  const [caricamentoAnteprima, setCaricamentoAnteprima] = useState(null);

  useEffect(() => { loadDocs(); }, []);

  const loadDocs = async () => {
    setLoading(true);
    const [fiscali, medici] = await Promise.all([
      supabase.from('documenti_fiscali').select('id, tipo, numero, data, paziente_nome, paziente_id, importo, created_at').order('data', { ascending: false }),
      supabase.from('documenti_medici').select('id, tipo, titolo, data, paziente_nome, paziente_id, created_at').order('data', { ascending: false }),
    ]);
    const uniti = [
      ...(fiscali.data || []).map(d => ({ ...d, tabella: 'documenti_fiscali' })),
      ...(medici.data || []).map(d => ({ ...d, tabella: 'documenti_medici', numero: null, importo: null })),
    ].sort((a, b) => new Date(b.data) - new Date(a.data));
    setDocs(uniti);
    setLoading(false);
  };

  const downloadDoc = async (doc) => {
    const { data } = await supabase.from(doc.tabella).select('pdf_base64').eq('id', doc.id).single();
    if (!data?.pdf_base64) { alert('PDF non disponibile'); return; }
    const nomeBase = doc.tabella === 'documenti_fiscali' ? `${doc.tipo}_${doc.numero}` : (doc.titolo || doc.tipo);
    const filename = `${nomeBase}_${doc.paziente_nome.replace(/\s+/g,'_')}_${doc.data}.pdf`.toLowerCase();
    scaricaPdf(data.pdf_base64, filename);
  };

  const visualizzaDoc = async (doc) => {
    setCaricamentoAnteprima(doc.id + doc.tabella);
    const { data } = await supabase.from(doc.tabella).select('pdf_base64').eq('id', doc.id).single();
    setCaricamentoAnteprima(null);
    if (!data?.pdf_base64) { alert('PDF non disponibile'); return; }
    const nomeBase = doc.tabella === 'documenti_fiscali' ? `${doc.tipo}_${doc.numero}` : (doc.titolo || doc.tipo);
    const filename = `${nomeBase}_${doc.paziente_nome.replace(/\s+/g,'_')}_${doc.data}.pdf`.toLowerCase();
    const titolo = doc.tabella === 'documenti_fiscali' ? `${doc.tipo === 'fattura' ? 'Fattura' : 'Rimborso'} n. ${doc.numero}` : (doc.titolo || doc.tipo);
    setDocInVisualizzazione({ titolo, dataUrl: data.pdf_base64, filename });
  };

  const deleteDoc = async (doc) => {
    if (!confirm('Eliminare questo documento?')) return;
    await supabase.from(doc.tabella).delete().eq('id', doc.id);
    setDocs(prev => prev.filter(d => !(d.id === doc.id && d.tabella === doc.tabella)));
    setToast('Eliminato ✓');
  };

  const deleteSelected = async () => {
    if (!confirm(`Eliminare ${selDoc.length} documento/i?`)) return;
    for (const key of selDoc) {
      const doc = docs.find(d => `${d.id}_${d.tabella}` === key);
      if (doc) await supabase.from(doc.tabella).delete().eq('id', doc.id);
    }
    setDocs(prev => prev.filter(d => !selDoc.includes(`${d.id}_${d.tabella}`)));
    setSelDoc([]);
    setToast(`${selDoc.length} documenti eliminati ✓`);
  };

  const downloadSelected = async () => {
    for (const key of selDoc) {
      const doc = docs.find(d => `${d.id}_${d.tabella}` === key);
      if (doc) { await downloadDoc(doc); await new Promise(r => setTimeout(r, 400)); }
    }
  };

  const openEdit = (doc) => {
    setEditDoc(doc);
    setEditForm({ numero: doc.numero, data: doc.data, importo: String(doc.importo), paziente_nome: doc.paziente_nome });
  };

  const saveEdit = async () => {
    const { error } = await supabase.from('documenti_fiscali').update({
      numero: editForm.numero,
      data: editForm.data,
      importo: Number(editForm.importo),
      paziente_nome: editForm.paziente_nome,
    }).eq('id', editDoc.id);
    if (!error) {
      setDocs(prev => prev.map(d => (d.id === editDoc.id && d.tabella === 'documenti_fiscali') ? { ...d, ...editForm, importo: Number(editForm.importo) } : d));
      setEditDoc(null);
      setToast('Aggiornato ✓');
    }
  };

  // Filtri
  const docsFiltrati = docs.filter(d => {
    if (filtroTipo !== 'tutti' && d.tipo !== filtroTipo) return false;
    if (filtroPaz && !d.paziente_nome.toLowerCase().includes(filtroPaz.toLowerCase())) return false;
    return true;
  });

  // Totali
  const totFatture = docs.filter(d => d.tipo === 'fattura').reduce((s, d) => s + Number(d.importo), 0);
  const totRimborsi = docs.filter(d => d.tipo === 'rimborso').reduce((s, d) => s + Number(d.importo), 0);
  const anno = today().slice(0, 4);
  const totAnno = docs.filter(d => d.data?.startsWith(anno)).reduce((s, d) => s + Number(d.importo), 0);

  const toggleSel = (doc) => setSelDoc(prev => {
    const key = `${doc.id}_${doc.tabella}`;
    return prev.includes(key) ? prev.filter(x => x !== key) : [...prev, key];
  });

  return (
    <div>
      {toast && <Toast msg={toast} onDone={() => setToast('')} />}

      {/* HEADER */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, flexWrap: 'wrap', gap: 8 }}>
        <div style={{ fontSize: 20, fontWeight: 800 }}>📁 Documenti</div>
        <div style={{ display: 'flex', gap: 6 }}>
          <button onClick={() => { setPazModal('medico'); setPazSearch(''); }} style={{ background: C.priL, border: 'none', borderRadius: 9, padding: '8px 12px', color: C.pri, fontWeight: 700, fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}>
            <Ic n="plus" s={12} c={C.pri} /> Ricetta/Cert.
          </button>
          <button onClick={() => { setPazModal('fiscale'); setPazSearch(''); }} style={{ background: '#E8FAF9', border: 'none', borderRadius: 9, padding: '8px 12px', color: C.acc, fontWeight: 700, fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}>
            <Ic n="plus" s={12} c={C.acc} /> Fattura/Rimb.
          </button>
        </div>
      </div>

      {/* MODAL SELEZIONA PAZIENTE */}
      {pazModal && (
        <Modal title={`Seleziona paziente — ${pazModal === 'fiscale' ? 'Fattura/Rimborso' : 'Ricetta/Certificato'}`} onClose={() => setPazModal(null)}>
          <Inp autoFocus value={pazSearch} onChange={e => setPazSearch(e.target.value)} placeholder="Cerca per nome, cognome, CF o telefono…" style={{ marginBottom: 12 }} />
          <div style={{ maxHeight: 320, overflowY: 'auto' }}>
            {cercaPazienti(patients, pazSearch)
              .slice(0, 30)
              .map(p => (
                <div key={p.id} onClick={() => {
                  setPazModal(null);
                  if (pazModal === 'fiscale' && onApriDocFiscale) onApriDocFiscale(p);
                  if (pazModal === 'medico' && onApriDocMedico) onApriDocMedico(p);
                }} style={{ padding: '11px 12px', cursor: 'pointer', borderBottom: `1px solid ${C.brd}`, borderRadius: 8 }}
                  onMouseEnter={e => e.currentTarget.style.background = C.bg}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                  <div style={{ fontWeight: 700, fontSize: 13 }}>{p.cognome} {p.nome}</div>
                  {p.telefono && <div style={{ fontSize: 11, color: C.txl }}>{p.telefono}</div>}
                </div>
              ))}
            {cercaPazienti(patients, pazSearch).length === 0 && (
              <div style={{ textAlign: 'center', color: C.txl, padding: 20 }}>Nessun paziente trovato</div>
            )}
          </div>
        </Modal>
      )}

      {/* KPI */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 14 }}>
        <Crd style={{ padding: 12 }}>
          <div style={{ fontSize: 9, fontWeight: 800, color: C.pri, textTransform: 'uppercase' }}>Fatture</div>
          <div style={{ fontSize: 18, fontWeight: 900, color: C.pri }}>{fmt(totFatture)}</div>
          <div style={{ fontSize: 10, color: C.txl }}>{docs.filter(d => d.tipo === 'fattura').length} doc.</div>
        </Crd>
        <Crd style={{ padding: 12 }}>
          <div style={{ fontSize: 9, fontWeight: 800, color: C.pur, textTransform: 'uppercase' }}>Rimborsi</div>
          <div style={{ fontSize: 18, fontWeight: 900, color: C.pur }}>{fmt(totRimborsi)}</div>
          <div style={{ fontSize: 10, color: C.txl }}>{docs.filter(d => d.tipo === 'rimborso').length} doc.</div>
        </Crd>
        <Crd style={{ padding: 12 }}>
          <div style={{ fontSize: 9, fontWeight: 800, color: C.suc, textTransform: 'uppercase' }}>{anno}</div>
          <div style={{ fontSize: 18, fontWeight: 900, color: C.suc }}>{fmt(totAnno)}</div>
          <div style={{ fontSize: 10, color: C.txl }}>{docs.filter(d => d.data?.startsWith(anno)).length} doc.</div>
        </Crd>
      </div>

      {/* FILTRI */}
      {(() => {
        const ETICHETTE_TIPO = {
          fattura: '🧾 Fatture', rimborso: '🧾 Rimborsi',
          ricetta: '💊 Ricette', esami: '🩸 Esami', certificato: '📋 Certificati', lettera: '✉️ Lettere',
          protocollo: '📖 Protocolli', vuoto: '📝 Liberi',
        };
        const tipiPresenti = Array.from(new Set(docs.map(d => d.tipo)));
        return (
          <div style={{ display: 'flex', gap: 6, marginBottom: 12, overflowX: 'auto', paddingBottom: 2 }}>
            <button onClick={() => setFiltroTipo('tutti')} style={{ flexShrink: 0, padding: '8px 14px', borderRadius: 20, border: `1.5px solid ${filtroTipo === 'tutti' ? C.pri : C.brd}`, background: filtroTipo === 'tutti' ? C.pri : C.sur, color: filtroTipo === 'tutti' ? '#fff' : C.txm, fontWeight: 700, fontSize: 11, cursor: 'pointer', whiteSpace: 'nowrap' }}>
              Tutti ({docs.length})
            </button>
            {tipiPresenti.map((t) => {
              const n = docs.filter(d => d.tipo === t).length;
              const attivo = filtroTipo === t;
              return (
                <button key={t} onClick={() => setFiltroTipo(attivo ? 'tutti' : t)} style={{ flexShrink: 0, padding: '8px 14px', borderRadius: 20, border: `1.5px solid ${attivo ? C.pri : C.brd}`, background: attivo ? C.pri : C.sur, color: attivo ? '#fff' : C.txm, fontWeight: 700, fontSize: 11, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                  {ETICHETTE_TIPO[t] || t} ({n})
                </button>
              );
            })}
          </div>
        );
      })()}
      <Inp value={filtroPaz} onChange={e => setFiltroPaz(e.target.value)} placeholder="Cerca paziente…" style={{ marginBottom: 12 }} />

      {/* AZIONI BATCH */}
      {selDoc.length > 0 && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 12, padding: '10px 12px', background: C.priL, borderRadius: 10, border: `1px solid ${C.pri}30` }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: C.pri, flex: 1 }}>{selDoc.length} selezionati</span>
          <button onClick={downloadSelected} style={{ background: C.pri, border: 'none', borderRadius: 8, padding: '6px 12px', color: '#fff', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>⬇️ Scarica</button>
          <button onClick={deleteSelected} style={{ background: C.dan, border: 'none', borderRadius: 8, padding: '6px 12px', color: '#fff', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>🗑️ Elimina</button>
          <button onClick={() => setSelDoc([])} style={{ background: C.bg, border: `1px solid ${C.brd}`, borderRadius: 8, padding: '6px 10px', color: C.txm, fontWeight: 700, fontSize: 11, cursor: 'pointer' }}>✕</button>
        </div>
      )}

      {/* SELEZIONA TUTTI */}
      {docsFiltrati.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <button onClick={() => setSelDoc(selDoc.length === docsFiltrati.length ? [] : docsFiltrati.map(d => `${d.id}_${d.tabella}`))}
            style={{ background: C.bg, border: `1px solid ${C.brd}`, borderRadius: 7, padding: '5px 10px', fontSize: 11, fontWeight: 700, color: C.txm, cursor: 'pointer' }}>
            {selDoc.length === docsFiltrati.length ? 'Deseleziona tutti' : 'Seleziona tutti'}
          </button>
          <span style={{ fontSize: 11, color: C.txl }}>{docsFiltrati.length} documenti</span>
        </div>
      )}

      {/* LISTA */}
      {loading && <div style={{ textAlign: 'center', color: C.txl, padding: 30 }}>⏳ Caricamento...</div>}
      {!loading && docsFiltrati.length === 0 && (
        <div style={{ textAlign: 'center', color: C.txl, padding: 40 }}>
          <div style={{ fontSize: 32, marginBottom: 10 }}>📄</div>
          <div style={{ fontWeight: 700 }}>Nessun documento</div>
          <div style={{ fontSize: 12, marginTop: 4, color: C.txl }}>I documenti generati appaiono qui automaticamente</div>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {docsFiltrati.map(doc => {
          const key = `${doc.id}_${doc.tabella}`;
          const isSel = selDoc.includes(key);
          const isFiscale = doc.tabella === 'documenti_fiscali';
          const isFattura = doc.tipo === 'fattura';
          const coloreAccento = isFiscale ? (isFattura ? C.pri : C.pur) : C.acc;
          const etichetta = isFiscale
            ? `${isFattura ? '📄' : '🧾'} ${isFattura ? 'Fattura' : 'Rimborso'} n° ${doc.numero}`
            : `${{ ricetta: '💊', esami: '🩸', certificato: '📋', lettera: '✉️', protocollo: '📖', vuoto: '📝' }[doc.tipo] || '📄'} ${doc.titolo || doc.tipo}`;
          const caricandoAnteprima = caricamentoAnteprima === key;
          return (
            <Crd key={key} style={{ border: isSel ? `2px solid ${C.pri}` : `1px solid ${C.brd}`, background: isSel ? C.priL : '#fff', borderLeft: `4px solid ${coloreAccento}` }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                {/* Checkbox */}
                <button onClick={() => toggleSel(doc)} style={{ width: 22, height: 22, borderRadius: 6, border: `2px solid ${isSel ? C.pri : C.brd}`, background: isSel ? C.pri : '#fff', cursor: 'pointer', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}>
                  {isSel && <Ic n="ok" s={11} c="#fff" />}
                </button>

                {/* Info */}
                <div style={{ flex: 1, minWidth: 0, cursor: 'pointer' }} onClick={() => visualizzaDoc(doc)}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 13, fontWeight: 800, color: coloreAccento }}>{etichetta}</span>
                  </div>
                  <div style={{ fontSize: 11, color: C.txm, marginTop: 2 }}>{doc.paziente_nome}</div>
                  <div style={{ fontSize: 11, color: C.txl }}>{fmtD(doc.data)}</div>
                </div>

                {/* Importo e azioni */}
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  {isFiscale && <div style={{ fontWeight: 900, fontSize: 15, color: coloreAccento }}>{fmt(doc.importo)}</div>}
                  <div style={{ display: 'flex', gap: 5, marginTop: 5, justifyContent: 'flex-end' }}>
                    <button onClick={() => visualizzaDoc(doc)} disabled={caricandoAnteprima} style={{ background: C.priL, border: 'none', borderRadius: 6, padding: '4px 7px', cursor: 'pointer', opacity: caricandoAnteprima ? 0.5 : 1 }} title="Visualizza">
                      <Ic n="eye" s={12} c={C.pri} />
                    </button>
                    {isFiscale && (
                      <button onClick={() => openEdit(doc)} style={{ background: C.bg, border: `1px solid ${C.brd}`, borderRadius: 6, padding: '4px 7px', cursor: 'pointer' }}>
                        <Ic n="edit" s={12} c={C.txm} />
                      </button>
                    )}
                    <button onClick={() => downloadDoc(doc)} style={{ background: C.bg, border: `1px solid ${C.brd}`, borderRadius: 6, padding: '4px 8px', cursor: 'pointer', fontSize: 11, fontWeight: 700, color: C.txm }}>⬇️</button>
                    <button onClick={() => deleteDoc(doc)} style={{ background: C.danL, border: 'none', borderRadius: 6, padding: '4px 7px', cursor: 'pointer' }}>
                      <Ic n="del" s={12} c={C.dan} />
                    </button>
                  </div>
                </div>
              </div>
            </Crd>
          );
        })}
      </div>

      {docInVisualizzazione && (
        <PdfViewerModal
          titolo={docInVisualizzazione.titolo}
          dataUrl={docInVisualizzazione.dataUrl}
          filename={docInVisualizzazione.filename}
          onClose={() => setDocInVisualizzazione(null)}
        />
      )}

      {/* MODAL MODIFICA */}
      {editDoc && (
        <Modal title={`✏️ Modifica ${editDoc.tipo === 'fattura' ? 'Fattura' : 'Rimborso'} n° ${editDoc.numero}`} onClose={() => setEditDoc(null)}>
          <Fld label="Numero documento">
            <Inp value={editForm.numero} onChange={e => setEditForm(f => ({ ...f, numero: e.target.value }))} />
          </Fld>
          <Fld label="Data">
            <Inp type="date" value={editForm.data} onChange={e => setEditForm(f => ({ ...f, data: e.target.value }))} />
          </Fld>
          <Fld label="Importo €">
            <Inp type="number" value={editForm.importo} onChange={e => setEditForm(f => ({ ...f, importo: e.target.value }))} />
          </Fld>
          <Fld label="Paziente">
            <Inp value={editForm.paziente_nome} onChange={e => setEditForm(f => ({ ...f, paziente_nome: e.target.value }))} />
          </Fld>
          <div style={{ background: C.danL, borderRadius: 8, padding: '8px 12px', marginBottom: 10 }}>
            <div style={{ fontSize: 11, color: C.dan, fontWeight: 700 }}>⚠️ Nota: la modifica aggiorna solo i metadati. Il PDF originale rimane invariato.</div>
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
            <Btn ch="Annulla" v="sec" onClick={() => setEditDoc(null)} full />
            <Btn ch="Salva modifiche" onClick={saveEdit} full />
          </div>
        </Modal>
      )}
    </div>
  );
}
