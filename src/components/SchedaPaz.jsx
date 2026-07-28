import React, { useState, useRef } from 'react';
import { supabase } from '../lib/supabase.js';
import { Btn, Crd, Fld, Inp, Sel, Txt, Modal, Toast, Bdg, Ic, PhStr } from './ui';
import { C, fmt, fmtD, today, SCADENZA_PRESET, addMesi, rilevaRichiamo } from '../lib/utils';
import PdfView from './PdfView.jsx';
import DocFiscale from './DocFiscale.jsx';
import DocMedico from './DocMedico.jsx';

const prossimaDataMascherina = (orto) => {
  if (!orto?.dataConsegnaInizio || !orto?.mascherineConsegnate) return null;
  const ultima = orto.storico && orto.storico.length > 0 ? orto.storico[orto.storico.length - 1].data : orto.dataConsegnaInizio;
  const d = new Date(ultima + 'T12:00');
  d.setDate(d.getDate() + (orto.frequenzaSettimane || 2) * 7);
  return d.toISOString().slice(0, 10);
};

export default function SchedaPaz({ paz, plans, payments, appointments, setAppointments, si, features, onClose, onEdit, onNuovoPiano, setPlans, initTab, implants = [], setImplants, setPatients, onNuovoAppuntamento, templates, setPayments }) {
  const [tab, setTab] = useState(initTab || 'info');
  const [pdfPlan, setPdfPlan] = useState(null);
  const [docFiscale, setDocFiscale] = useState(false);
  const [docMedico, setDocMedico] = useState(false);
  const [appModal, setAppModal] = useState(false);
  const [waModal, setWaModal] = useState(false);
  const [pagModal, setPagModal] = useState(false);
  const [pagForm, setPagForm] = useState({ importo: '', metodo: 'Contanti', nota: '', data: today(), pianoId: '' });
  const [pagVoceCtx, setPagVoceCtx] = useState(null); // { plId, voceIndex } quando la modale è aperta da "Da incassare" su una singola voce
  const [waMsg, setWaMsg] = useState('');
  const [waTplId, setWaTplId] = useState('');
  const [appForm, setAppForm] = useState({ data: today(), ora: '09:00', durata: 30, tipo: 'Visita di controllo', note: '', stato: 'confermato' });
  const [selPiani, setSelPiani] = useState([]);
  const [editPianoModal, setEditPianoModal] = useState(null);
  const [editForm, setEditForm] = useState(null);
  const [confirmDelId, setConfirmDelId] = useState(null);
  const [impModal, setImpModal] = useState(false);
  const [impForm, setImpForm] = useState({});
  const [impEditId, setImpEditId] = useState(null);
  const [impConfirmDel, setImpConfirmDel] = useState(null);
  const [foto, setFoto] = useState([]);
  const [fotoLoading, setFotoLoading] = useState(false);
  const [fotoLabelModal, setFotoLabelModal] = useState(null);
  const [fotoLabel, setFotoLabel] = useState('');
  const fileInputRef = useRef(null);
  const [noteGenerale, setNoteGenerale] = useState(paz.note || '');
  const [noteModalOpen, setNoteModalOpen] = useState(false);
  const [nuovaAnnotazione, setNuovaAnnotazione] = useState('');
  const [ricordaModal, setRicordaModal] = useState(null);
  const [ricordaTesto, setRicordaTesto] = useState('');
  const [ricordaData, setRicordaData] = useState(today());

  // ── NOTE CLINICHE ──
  const annotazioni = paz.annotazioni || [];

  const saveNoteGenerale = () => {
    if (!setPatients) return;
    setPatients(prev => prev.map(p => p.id === paz.id ? { ...p, note: noteGenerale } : p));
    setNoteModalOpen(false);
  };

  const aggiungiAnnotazione = () => {
    if (!nuovaAnnotazione.trim() || !setPatients) return;
    const nuova = { id: Date.now(), data: today(), testo: nuovaAnnotazione.trim(), richiamo: null };
    setPatients(prev => prev.map(p => p.id === paz.id ? { ...p, annotazioni: [nuova, ...(p.annotazioni || [])] } : p));
    setNuovaAnnotazione('');
  };

  const eliminaAnnotazione = (id) => {
    if (!setPatients || !confirm('Eliminare questa annotazione?')) return;
    setPatients(prev => prev.map(p => p.id === paz.id ? { ...p, annotazioni: (p.annotazioni || []).filter(a => a.id !== id) } : p));
  };

  const creaRichiamo = () => {
    if (!ricordaModal || !ricordaTesto.trim() || !setPatients) return;
    setPatients(prev => prev.map(p => p.id === paz.id ? {
      ...p,
      annotazioni: (p.annotazioni || []).map(a => a.id === ricordaModal ? { ...a, richiamo: { testo: ricordaTesto.trim(), data: ricordaData, fatto: false } } : a)
    } : p));
    setRicordaModal(null);
    setRicordaTesto('');
  };

  const segnaRichiamoFatto = (annId) => {
    if (!setPatients) return;
    setPatients(prev => prev.map(p => p.id === paz.id ? {
      ...p,
      annotazioni: (p.annotazioni || []).map(a => a.id === annId ? { ...a, richiamo: { ...a.richiamo, fatto: true } } : a)
    } : p));
  };

  // ── FOTO PAZIENTE ──
  const loadFoto = async () => {
    setFotoLoading(true);
    const { data, error } = await supabase.storage.from('patient-files').list(`${paz.id}/`, { sortBy: { column: 'created_at', order: 'desc' } });
    if (!error && data) {
      const items = await Promise.all(data.filter(f => f.name !== '.emptyFolderPlaceholder').map(async f => {
        const { data: { publicUrl } } = supabase.storage.from('patient-files').getPublicUrl(`${paz.id}/${f.name}`);
        const label = f.name.split('_LABEL_')[1]?.replace(/\.[^.]+$/, '') || f.name;
        return { name: f.name, url: publicUrl, label };
      }));
      setFoto(items);
    }
    setFotoLoading(false);
  };

  React.useEffect(() => { loadFoto(); }, [paz.id]);

  const uploadFoto = async (file) => {
    setFotoLoading(true);
    const ext = file.name.split('.').pop();
    const fname = `${Date.now()}_LABEL_${file.name.replace(/[^a-zA-Z0-9.]/g, '_')}.${ext}`;
    const { error } = await supabase.storage.from('patient-files').upload(`${paz.id}/${fname}`, file, { upsert: false });
    if (!error) await loadFoto();
    setFotoLoading(false);
  };

  const deleteFoto = async (name) => {
    if (!confirm('Eliminare questo file?')) return;
    await supabase.storage.from('patient-files').remove([`${paz.id}/${name}`]);
    await loadFoto();
  };

  const isImage = (name) => /\.(jpg|jpeg|png|gif|webp|heic)$/i.test(name);
  const isPdf = (name) => /\.pdf$/i.test(name);

  const patPlans = plans.filter((pl) => pl.pazienteId === paz.id);
  const patImpianti = (implants || []).filter((im) => im.pazienteId === paz.id).sort((a, b) => (b.dataInserimento || '').localeCompare(a.dataInserimento || ''));
  const patPay = [...payments.filter((p) => p.pazienteId === paz.id)].reverse();
  const patApp = [...appointments.filter((a) => a.pazienteId === paz.id)].sort((a, b) => b.data.localeCompare(a.data));

  const totEseguito = patPlans.reduce((s, pl) => s + pl.voci.filter(v => v.eseguita).reduce((a, v) => a + Number(v.prezzo), 0), 0);
  const totAccNonEseg = patPlans.filter(pl => pl.stato === 'accettato').reduce((s, pl) => s + pl.voci.filter(v => !v.eseguita).reduce((a, v) => a + Number(v.prezzo), 0), 0);
  const totDovuto = patPlans.reduce((s, pl) => {
    const sub = pl.voci.reduce((a, v) => a + Number(v.prezzo), 0);
    const sc = Number(pl.sconto) || 0;
    const scontato = pl.scontoTipo === 'pct' ? sub * (sc / 100) : Math.min(sc, sub);
    return s + Math.max(0, sub - scontato);
  }, 0);
  const totPaid = patPay.reduce((s, p) => s + Number(p.importo), 0);
  const totDaPagare = Math.max(0, totDovuto - totPaid);
  const pctPagato = totDovuto > 0 ? Math.min(100, Math.round((totPaid / totDovuto) * 100)) : 0;

  const toggleEseguita = (plId, i) => setPlans((prev) => prev.map((pl) => {
    if (pl.id !== plId) return pl;
    const nuoveVoci = pl.voci.map((v, j) => {
      if (j !== i) return v;
      const nowEseguita = !v.eseguita;
      let extra = {};
      if (nowEseguita) {
        const r = rilevaRichiamo(v.prestazione);
        if (r && !v.richiamoData) extra = { richiamoTipo: r.tipo, richiamoData: addMesi(today(), r.mesi) };
      }
      return { ...v, eseguita: nowEseguita, dataEsec: nowEseguita ? today() : null, incassata: nowEseguita ? v.incassata : false, ...extra };
    });
    const tutteEseguite = nuoveVoci.every((v) => v.eseguita);
    return { ...pl, voci: nuoveVoci, stato: tutteEseguite ? 'concluso' : (pl.stato === 'concluso' ? 'attivo' : pl.stato) };
  }));
  const setRichiamo = (plId, i, tipo, data) => setPlans((prev) => prev.map((pl) => (pl.id === plId ? { ...pl, voci: pl.voci.map((v, j) => (j === i ? { ...v, richiamoTipo: tipo, richiamoData: data } : v)) } : pl)));
  const setScadenzaPiano = (plId, data) => setPlans((prev) => prev.map((pl) => (pl.id === plId ? { ...pl, scadenzaPagamento: data } : pl)));
  const avviaConsegnaOrto = (plId, data) => setPlans((prev) => prev.map((pl) => {
    if (pl.id !== plId) return pl;
    const orto = pl.ortodonzia || {};
    return { ...pl, ortodonzia: { ...orto, dataConsegnaInizio: data, mascherineConsegnate: 1, storico: [{ n: 1, data }] } };
  }));
  const consegnaMascherinaSuccessiva = (plId) => setPlans((prev) => prev.map((pl) => {
    if (pl.id !== plId) return pl;
    const orto = pl.ortodonzia || {};
    const nuovoNum = (orto.mascherineConsegnate || 0) + 1;
    return { ...pl, ortodonzia: { ...orto, mascherineConsegnate: nuovoNum, storico: [...(orto.storico || []), { n: nuovoNum, data: today() }] } };
  }));
  const toggleIncassata = (plId, i) => setPlans((prev) => prev.map((pl) => (pl.id === plId ? { ...pl, voci: pl.voci.map((v, j) => (j === i ? { ...v, incassata: !v.incassata } : v)) } : pl)));
  const delPiano = (id) => setConfirmDelId((prev) => (prev === id ? null : id));
  const confirmDel = (id) => { setPlans((p) => p.filter((pl) => pl.id !== id)); setConfirmDelId(null); };

  const openEditPiano = (pl) => { setEditForm({ ...pl, sconto: pl.sconto || 0, scontoTipo: pl.scontoTipo || 'pct' }); setEditPianoModal(pl.id); };
  const saveEdit = () => {
    if (!editForm.titolo) return;
    setPlans((p) => p.map((pl) => (pl.id === editPianoModal ? { ...pl, ...editForm } : pl)));
    setEditPianoModal(null);
  };
  const delVoceEdit = (i) => setEditForm((f) => ({ ...f, voci: f.voci.filter((_, j) => j !== i) }));

  const toggleSel = (id) => setSelPiani((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  const selAll = () => setSelPiani(patPlans.map((p) => p.id));
  const deselAll = () => setSelPiani([]);

  const generaPdfMulti = () => {
    const pianiSel = patPlans.filter((pl) => selPiani.includes(pl.id));
    if (!pianiSel.length) return;
    const vociTot = pianiSel.flatMap((pl) => pl.voci);
    const totSconti = pianiSel.reduce((s, pl) => {
      const sub = pl.voci.reduce((a, v) => a + Number(v.prezzo), 0);
      const sc = Number(pl.sconto) || 0;
      return s + (pl.scontoTipo === 'pct' ? sub * (sc / 100) : Math.min(sc, sub));
    }, 0);
    const virtuale = { id: 'multi', titolo: pianiSel.length === 1 ? pianiSel[0].titolo : `Preventivo combinato (${pianiSel.length} piani)`, data: today(), voci: vociTot, sconto: totSconti, scontoTipo: 'eur', stato: 'attivo', pazienteId: paz.id };
    setPdfPlan(virtuale);
  };

  if (docMedico && features?.documenti !== false) return <DocMedico paz={paz} si={si} onClose={() => setDocMedico(false)} />;
  if (docFiscale && features?.documenti !== false) return <DocFiscale paz={paz} plans={plans} si={si} onClose={() => setDocFiscale(false)} />;
  if (pdfPlan) return <PdfView pl={pdfPlan} paz={paz} si={si} features={features} onClose={() => setPdfPlan(null)} />;

  const isDentistico = !si?.vertical || si.vertical === 'dentistico';
  const TABS = [{ id: 'info', l: '📋 Info' }, { id: 'piani', l: '🦷 Piani' }, ...(isDentistico ? [{ id: 'impl', l: '🔩 Impianti' }] : []), { id: 'paga', l: '💰 Pagamenti' }, { id: 'foto', l: '📁 Foto' }, { id: 'doc', l: '📄 Documenti' }, { id: 'app', l: '📅 Agenda' }];

  return (
    <div style={{ position: 'fixed', inset: 0, background: C.bg, zIndex: 500, display: 'flex', flexDirection: 'column' }}>
      <div style={{ background: C.priD, padding: '12px 14px', paddingTop: 'max(12px,env(safe-area-inset-top))', display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
        <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.12)', border: 'none', borderRadius: 8, padding: 8, cursor: 'pointer', display: 'flex' }}><Ic n="back" s={18} c="#fff" /></button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ color: '#fff', fontWeight: 800, fontSize: 15, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{paz.nome} {paz.cognome}</div>
          {paz.cf && <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: 11, fontFamily: 'monospace' }}>{paz.cf}</div>}
        </div>
        <button onClick={() => onEdit(paz)} style={{ background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: 8, padding: '6px 11px', cursor: 'pointer', color: '#fff', fontWeight: 700, fontSize: 12, display: 'flex', alignItems: 'center', gap: 4 }}><Ic n="edit" s={13} c="#fff" />Modifica</button>
      </div>

      <div style={{ background: C.priD, display: 'flex', borderTop: '1px solid rgba(255,255,255,0.1)', flexShrink: 0 }}>
        {[{ l: 'Piani', v: patPlans.length }, { l: 'Eseguito', v: fmt(totEseguito) }, { l: 'Pagato', v: fmt(totPaid) }, { l: 'Da pagare', v: fmt(totDaPagare) }].map((s) => (
          <div key={s.l} style={{ flex: 1, textAlign: 'center', padding: '8px 2px', borderRight: '1px solid rgba(255,255,255,0.1)' }}>
            <div style={{ color: s.l === 'Da pagare' && totDaPagare > 0 ? '#FCA5A5' : '#fff', fontWeight: 800, fontSize: 12 }}>{s.v}</div>
            <div style={{ color: 'rgba(255,255,255,0.55)', fontSize: 9 }}>{s.l}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', background: C.sur, borderBottom: `1px solid ${C.brd}`, flexShrink: 0 }}>
        {TABS.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{ flex: 1, padding: '11px 4px', background: 'none', border: 'none', borderBottom: `2.5px solid ${tab === t.id ? C.pri : 'transparent'}`, color: tab === t.id ? C.pri : C.txm, fontWeight: tab === t.id ? 700 : 500, fontSize: 11, cursor: 'pointer', whiteSpace: 'nowrap' }}>{t.l}</button>
        ))}
      </div>

      <div style={{ flex: 1, padding: 14, overflowY: 'auto' }}>
        {tab === 'info' && (
          <div>
            {paz.telefono && (
              <Crd style={{ marginBottom: 10 }}>
                <div style={{ fontWeight: 700, fontSize: 13 }}>📞 {paz.telefono}</div>
                <PhStr tel={paz.telefono} features={features} />
              </Crd>
            )}
            <Crd style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: C.pri, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>Anagrafica</div>
              {[['Nascita', fmtD(paz.dataNascita)], ['C.F.', paz.cf || '—'], ['Indirizzo', paz.indirizzo || '—'], ['Email', paz.email || '—']].map(([l, v]) => (
                <div key={l} style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', borderBottom: `1px solid ${C.brd}`, gap: 10 }}>
                  <span style={{ fontSize: 11, color: C.txm, fontWeight: 600, flexShrink: 0 }}>{l}</span>
                  <span style={{ fontSize: 12, color: C.txt, textAlign: 'right', wordBreak: 'break-word' }}>{v}</span>
                </div>
              ))}
            </Crd>
            {/* NOTE GENERALI (anamnesi/allergie) */}
            <Crd style={{ background: noteGenerale ? '#FFFBEB' : C.sur, border: noteGenerale ? '1px solid #FCD34D' : `1px solid ${C.brd}`, marginBottom: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: noteGenerale ? 7 : 0 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#92400E', textTransform: 'uppercase' }}>⚠️ Anamnesi / Allergie</div>
                <button onClick={() => { setNoteGenerale(paz.note || ''); setNoteModalOpen(true); }} style={{ background: 'none', border: `1px solid ${C.brd}`, borderRadius: 7, padding: '4px 9px', fontSize: 10, fontWeight: 700, color: C.txm, cursor: 'pointer' }}>
                  {noteGenerale ? '✏️ Modifica' : '+ Aggiungi'}
                </button>
              </div>
              {noteGenerale && <div style={{ fontSize: 13, color: '#78350F', lineHeight: 1.6 }}>{noteGenerale}</div>}
              {!noteGenerale && <div style={{ fontSize: 11, color: C.txl, marginTop: 4 }}>Nessuna nota generale — tocca per aggiungere allergie, anamnesi, ecc.</div>}
            </Crd>

            {/* STORICO ANNOTAZIONI CLINICHE */}
            <Crd style={{ marginBottom: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: C.pri, textTransform: 'uppercase', letterSpacing: '0.06em' }}>📝 Annotazioni cliniche</div>
              </div>
              <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
                <input value={nuovaAnnotazione} onChange={e => setNuovaAnnotazione(e.target.value)} onKeyDown={e => e.key === 'Enter' && !e.shiftKey && aggiungiAnnotazione()} placeholder="Scrivi una nota clinica..." style={{ flex: 1, padding: '9px 11px', border: `1.5px solid ${C.brd}`, borderRadius: 9, fontSize: 13, color: C.txt, background: C.sur }} />
                <button onClick={aggiungiAnnotazione} disabled={!nuovaAnnotazione.trim()} style={{ background: C.pri, border: 'none', borderRadius: 9, padding: '9px 14px', color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer', opacity: nuovaAnnotazione.trim() ? 1 : 0.4, whiteSpace: 'nowrap' }}>+ Aggiungi</button>
              </div>
              {annotazioni.length === 0 && <div style={{ textAlign: 'center', color: C.txl, padding: '14px 0', fontSize: 12 }}>Nessuna annotazione</div>}
              {annotazioni.map(ann => (
                <div key={ann.id} style={{ padding: '10px 0', borderBottom: `1px solid ${C.brd}` }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 10, color: C.txl, fontWeight: 700, marginBottom: 3 }}>{fmtD(ann.data)}</div>
                      <div style={{ fontSize: 13, color: C.txt, lineHeight: 1.5 }}>{ann.testo}</div>
                      {ann.richiamo && (
                        <div style={{ marginTop: 6, background: ann.richiamo.fatto ? C.sucL : C.purL, borderRadius: 7, padding: '6px 9px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                          <div>
                            <div style={{ fontSize: 10, fontWeight: 800, color: ann.richiamo.fatto ? C.suc : C.pur }}>📌 {ann.richiamo.fatto ? '✓ Fatto' : 'Richiamo'}: {fmtD(ann.richiamo.data)}</div>
                            <div style={{ fontSize: 11, color: ann.richiamo.fatto ? C.suc : C.pur }}>{ann.richiamo.testo}</div>
                          </div>
                          {!ann.richiamo.fatto && <button onClick={() => segnaRichiamoFatto(ann.id)} style={{ background: C.suc, border: 'none', borderRadius: 6, padding: '4px 8px', fontSize: 10, fontWeight: 700, color: '#fff', cursor: 'pointer', whiteSpace: 'nowrap' }}>✓ Fatto</button>}
                        </div>
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: 5, flexShrink: 0 }}>
                      {!ann.richiamo && <button onClick={() => { setRicordaModal(ann.id); setRicordaTesto(''); setRicordaData(today()); }} style={{ background: C.purL, border: 'none', borderRadius: 7, padding: '5px 8px', cursor: 'pointer', fontSize: 10, fontWeight: 700, color: C.pur, whiteSpace: 'nowrap' }}>📌 Richiamo</button>}
                      <button onClick={() => eliminaAnnotazione(ann.id)} style={{ background: C.danL, border: 'none', borderRadius: 7, padding: '5px 7px', cursor: 'pointer' }}><Ic n="del" s={12} c={C.dan} /></button>
                    </div>
                  </div>
                </div>
              ))}
            </Crd>

            {/* ── FOTO E DOCUMENTI ── */}
            <Crd>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: C.pri, textTransform: 'uppercase', letterSpacing: '0.06em' }}>📁 Foto e documenti</div>
                <button onClick={() => fileInputRef.current?.click()} style={{ background: C.pri, border: 'none', borderRadius: 8, padding: '7px 13px', color: '#fff', fontWeight: 700, fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}>
                  <Ic n="plus" s={12} c="#fff" /> Carica
                </button>
                <input ref={fileInputRef} type="file" accept="image/*,.pdf" multiple style={{ display: 'none' }} onChange={e => { Array.from(e.target.files).forEach(uploadFoto); e.target.value = ''; }} />
              </div>

              {fotoLoading && <div style={{ textAlign: 'center', color: C.txl, padding: 16, fontSize: 12 }}>⏳ Caricamento...</div>}

              {!fotoLoading && foto.length === 0 && (
                <label style={{ display: 'block', border: `2px dashed ${C.brd}`, borderRadius: 10, padding: '20px 14px', textAlign: 'center', cursor: 'pointer', background: C.bg }}>
                  <input type="file" accept="image/*,.pdf" multiple style={{ display: 'none' }} onChange={e => { Array.from(e.target.files).forEach(uploadFoto); e.target.value = ''; }} />
                  <div style={{ fontSize: 22, marginBottom: 4 }}>📷</div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: C.pri }}>Tocca per caricare foto o PDF</div>
                  <div style={{ fontSize: 10, color: C.txl, marginTop: 2 }}>Panoramiche, RX, documenti...</div>
                </label>
              )}

              {!fotoLoading && foto.length > 0 && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                  {foto.map((f, i) => (
                    <div key={i} style={{ position: 'relative' }}>
                      <a href={f.url} target="_blank" rel="noopener" style={{ display: 'block', textDecoration: 'none' }}>
                        {isImage(f.name) ? (
                          <div style={{ width: '100%', paddingBottom: '100%', position: 'relative', borderRadius: 8, overflow: 'hidden', background: C.bg }}>
                            <img src={f.url} alt={f.label} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
                          </div>
                        ) : (
                          <div style={{ width: '100%', paddingBottom: '100%', position: 'relative', borderRadius: 8, background: C.danL, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                              <div style={{ fontSize: 24 }}>📄</div>
                              <div style={{ fontSize: 9, color: C.dan, fontWeight: 700, marginTop: 3, textAlign: 'center', padding: '0 4px' }}>PDF</div>
                            </div>
                          </div>
                        )}
                        <div style={{ fontSize: 9, color: C.txm, marginTop: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 600 }}>{f.label}</div>
                      </a>
                      <button onClick={() => deleteFoto(f.name)} style={{ position: 'absolute', top: 3, right: 3, background: 'rgba(0,0,0,0.5)', border: 'none', borderRadius: 4, width: 18, height: 18, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}>
                        <Ic n="x" s={9} c="#fff" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </Crd>
          </div>
        )}

        {tab === 'piani' && (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, gap: 8, flexWrap: 'wrap' }}>
              <Btn ch="+ Nuovo piano" v="pri" sz="sm" onClick={() => onNuovoPiano(paz.id)} />
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                {selPiani.length > 0 ? (
                  <>
                    <button onClick={deselAll} style={{ fontSize: 11, fontWeight: 700, color: C.txm, background: C.bg, border: `1px solid ${C.brd}`, borderRadius: 7, padding: '5px 9px', cursor: 'pointer' }}>✕ Deseleziona</button>
                    <button onClick={generaPdfMulti} style={{ fontSize: 11, fontWeight: 700, color: '#fff', background: C.pri, border: 'none', borderRadius: 7, padding: '5px 11px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}><Ic n="prt" s={11} c="#fff" />PDF ({selPiani.length})</button>
                  </>
                ) : (
                  <button onClick={selAll} style={{ fontSize: 11, fontWeight: 700, color: C.pri, background: C.priL, border: 'none', borderRadius: 7, padding: '5px 9px', cursor: 'pointer' }}>Seleziona tutti</button>
                )}
              </div>
            </div>

            {patPlans.length === 0 && <div style={{ textAlign: 'center', color: C.txl, padding: 40 }}>Nessun piano di cura</div>}
            {patPlans.map((pl) => {
              const sub = pl.voci.reduce((s, v) => s + Number(v.prezzo), 0);
              const sc = Number(pl.sconto) || 0;
              const scontato = pl.scontoTipo === 'pct' ? sub * (sc / 100) : Math.min(sc, sub);
              const tot = Math.max(0, sub - scontato);
              const done = pl.voci.filter((v) => v.eseguita).length;
              const pct = pl.voci.length ? Math.round((done / pl.voci.length) * 100) : 0;
              const terminato = pct === 100;
              const isSel = selPiani.includes(pl.id);
              const statoEff = terminato ? 'concluso' : (pl.stato || 'attivo');
              const statoC = { attivo: C.war, accettato: C.acc, concluso: C.pri, rifiutato: C.dan }[statoEff] || C.war;

              return (
                <Crd key={pl.id} style={{ marginBottom: 12, border: `2px solid ${isSel ? C.pri : terminato ? C.pri + '50' : C.brd}`, background: terminato ? C.priL + '40' : '#fff' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 8 }}>
                    <button onClick={() => toggleSel(pl.id)} style={{ marginTop: 2, width: 22, height: 22, borderRadius: 6, border: `2px solid ${isSel ? C.pri : C.brd}`, background: isSel ? C.pri : '#fff', cursor: 'pointer', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}>
                      {isSel && <Ic n="ok" s={12} c="#fff" />}
                    </button>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 700, fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{pl.titolo}</div>
                      <div style={{ fontSize: 11, color: C.txm }}>{fmtD(pl.data)}</div>
                      <div style={{ marginTop: 4, display: 'flex', gap: 5, flexWrap: 'wrap', alignItems: 'center' }}>
                        <Bdg ch={terminato ? '✓ Terminato' : statoEff} co={statoC} />
                        {terminato && <span style={{ fontSize: 10, color: C.pri, fontWeight: 700 }}>Tutte le prestazioni eseguite</span>}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 5, flexShrink: 0 }}>
                      <button onClick={() => setPdfPlan(pl)} title="PDF" style={{ background: C.priL, border: 'none', borderRadius: 7, padding: '6px 8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 3, color: C.pri, fontWeight: 700, fontSize: 10 }}>
                        <Ic n="prt" s={12} c={C.pri} />Stampa PDF
                      </button>
                      <button onClick={() => openEditPiano(pl)} title="Modifica" style={{ background: '#EDE9FE', border: 'none', borderRadius: 7, padding: '6px 8px', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                        <Ic n="edit" s={13} c={C.pur} />
                      </button>
                      <button onClick={(e) => { e.stopPropagation(); delPiano(pl.id); }} title="Elimina" style={{ background: C.danL, border: 'none', borderRadius: 7, padding: '6px 8px', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                        <Ic n="del" s={13} c={C.dan} />
                      </button>
                    </div>
                  </div>

                  <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 10, color: C.txl, fontWeight: 700 }}>💰 Scadenza pagamento:</span>
                    {pl.scadenzaPagamento ? (
                      <span style={{ fontSize: 11, fontWeight: 700, color: new Date(pl.scadenzaPagamento) < new Date(today()) ? C.dan : C.pri }}>{fmtD(pl.scadenzaPagamento)}</span>
                    ) : <span style={{ fontSize: 11, color: C.txl }}>non impostata</span>}
                    <div style={{ display: 'flex', gap: 3 }}>
                      {SCADENZA_PRESET.map((p) => (
                        <button key={p.mesi} onClick={() => setScadenzaPiano(pl.id, addMesi(today(), p.mesi))} style={{ background: C.bg, border: `1px solid ${C.brd}`, borderRadius: 6, padding: '2px 6px', fontSize: 9, fontWeight: 700, color: C.txm, cursor: 'pointer' }}>{p.label}</button>
                      ))}
                      {pl.scadenzaPagamento && <button onClick={() => setScadenzaPiano(pl.id, '')} style={{ background: C.danL, border: 'none', borderRadius: 6, padding: '2px 6px', fontSize: 9, fontWeight: 700, color: C.dan, cursor: 'pointer' }}>✕</button>}
                    </div>
                  </div>

                  {pl.ortodonzia?.attivo && (() => {
                    const orto = pl.ortodonzia;
                    const tot2 = Number(orto.mascherineTotali) || 0;
                    const cons = orto.mascherineConsegnate || 0;
                    const pctOrto = tot2 > 0 ? Math.min(100, Math.round((cons / tot2) * 100)) : 0;
                    const prossima = prossimaDataMascherina(orto);
                    const completato = tot2 > 0 && cons >= tot2;
                    return (
                      <div style={{ marginTop: 8, background: C.purL, borderRadius: 9, padding: 10 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                          <span style={{ fontSize: 11, fontWeight: 800, color: C.pur }}>🦷 Mascherine ortodontiche</span>
                          <span style={{ fontSize: 11, fontWeight: 800, color: C.pur }}>{cons}/{tot2 || '?'}</span>
                        </div>
                        {tot2 > 0 && (
                          <div style={{ background: '#fff', borderRadius: 4, height: 6, overflow: 'hidden', marginBottom: 7 }}>
                            <div style={{ height: '100%', width: `${pctOrto}%`, background: completato ? C.suc : C.pur, borderRadius: 4 }} />
                          </div>
                        )}
                        {!orto.dataConsegnaInizio ? (
                          <div>
                            <div style={{ fontSize: 10, color: C.txm, marginBottom: 6 }}>Imposta la data di consegna della prima mascherina per avviare il conteggio.</div>
                            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                              <Inp type="date" defaultValue={today()} id={`orto-start-${pl.id}`} style={{ flex: 1, fontSize: 12, padding: '7px 9px' }} />
                              <button onClick={() => { const inp = document.getElementById(`orto-start-${pl.id}`); avviaConsegnaOrto(pl.id, inp.value || today()); }} style={{ background: C.pur, border: 'none', borderRadius: 7, padding: '8px 12px', color: '#fff', fontWeight: 700, fontSize: 11, cursor: 'pointer', whiteSpace: 'nowrap' }}>Avvia</button>
                            </div>
                          </div>
                        ) : completato ? (
                          <div style={{ fontSize: 11, fontWeight: 700, color: C.suc, textAlign: 'center', padding: '4px 0' }}>✓ Ciclo mascherine completato</div>
                        ) : (
                          <div>
                            <div style={{ fontSize: 10, color: C.txm, marginBottom: 2 }}>Ultima consegnata: <b>n° {cons}</b>{orto.storico?.length > 0 && ` il ${fmtD(orto.storico[orto.storico.length - 1].data)}`}</div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 6 }}>
                              <span style={{ fontSize: 11, color: prossima && new Date(prossima + 'T12:00') < new Date(today() + 'T12:00') ? C.dan : C.pur, fontWeight: 700 }}>
                                📅 Prossima: {prossima ? fmtD(prossima) : '—'}
                              </span>
                              <button onClick={() => consegnaMascherinaSuccessiva(pl.id)} style={{ background: C.pur, border: 'none', borderRadius: 7, padding: '7px 12px', color: '#fff', fontWeight: 700, fontSize: 11, cursor: 'pointer' }}>+ Consegna n°{cons + 1}</button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })()}

                  {confirmDelId === pl.id && (
                    <div style={{ background: C.danL, borderRadius: 9, padding: '10px 12px', marginBottom: 8, marginTop: 8, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: C.dan }}>Eliminare questo piano?</span>
                      <div style={{ display: 'flex', gap: 7, flexShrink: 0 }}>
                        <button onClick={() => setConfirmDelId(null)} style={{ background: '#fff', border: `1px solid ${C.brd}`, borderRadius: 7, padding: '5px 11px', fontSize: 12, fontWeight: 700, cursor: 'pointer', color: C.txm }}>No</button>
                        <button onClick={() => confirmDel(pl.id)} style={{ background: C.dan, border: 'none', borderRadius: 7, padding: '5px 11px', fontSize: 12, fontWeight: 700, cursor: 'pointer', color: '#fff' }}>Sì, elimina</button>
                      </div>
                    </div>
                  )}

                  <div style={{ background: C.bg, borderRadius: 5, height: 6, overflow: 'hidden', marginBottom: 4 }}>
                    <div style={{ height: '100%', width: `${pct}%`, background: C.pri, borderRadius: 5, transition: 'width 0.3s' }} />
                  </div>
                  <div style={{ fontSize: 10, color: C.txm, marginBottom: 10 }}>{done}/{pl.voci.length} eseguite · {pct}%</div>

                  {pl.voci.map((v, i) => (
                    <div key={i} style={{ padding: '7px 0', borderBottom: `1px solid ${C.brd}` }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ flex: 1, fontSize: 12, fontWeight: 600, color: v.eseguita ? C.txm : C.txt, textDecoration: v.eseguita ? 'line-through' : 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{v.prestazione}{v.dente ? ` (d.${v.dente})` : ''}</span>
                        <span style={{ fontWeight: 700, color: C.pri, fontSize: 12, flexShrink: 0 }}>{fmt(v.prezzo)}</span>
                      </div>
                      {v.dataEsec && <div style={{ fontSize: 10, color: C.suc, marginTop: 1 }}>Eseguita il {fmtD(v.dataEsec)}</div>}
                      {v.eseguita && (
                        <div style={{ marginTop: 5, background: v.richiamoData ? C.purL : C.bg, borderRadius: 7, padding: '6px 8px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6, flexWrap: 'wrap' }}>
                            <span style={{ fontSize: 10, fontWeight: 700, color: v.richiamoData ? C.pur : C.txl }}>
                              🔔 {v.richiamoData ? `${v.richiamoTipo || 'Richiamo'}: ${fmtD(v.richiamoData)}` : 'Nessun richiamo impostato'}
                            </span>
                            <div style={{ display: 'flex', gap: 3 }}>
                              {SCADENZA_PRESET.map((p) => (
                                <button key={p.mesi} onClick={() => setRichiamo(pl.id, i, v.richiamoTipo || 'Controllo', addMesi(v.dataEsec || today(), p.mesi))} style={{ background: '#fff', border: `1px solid ${C.brd}`, borderRadius: 6, padding: '2px 6px', fontSize: 9, fontWeight: 700, color: C.txm, cursor: 'pointer' }}>{p.label}</button>
                              ))}
                              {v.richiamoData && <button onClick={() => setRichiamo(pl.id, i, '', null)} style={{ background: C.danL, border: 'none', borderRadius: 6, padding: '2px 6px', fontSize: 9, fontWeight: 700, color: C.dan, cursor: 'pointer' }}>✕</button>}
                            </div>
                          </div>
                        </div>
                      )}
                      <div style={{ display: 'flex', gap: 5, marginTop: 5 }}>
                        <button onClick={() => toggleEseguita(pl.id, i)} style={{ flex: 1, padding: '6px 0', borderRadius: 7, border: `1.5px solid ${v.eseguita ? C.suc : C.brd}`, background: v.eseguita ? C.sucL : C.bg, color: v.eseguita ? C.suc : C.txm, fontWeight: 700, fontSize: 11, cursor: 'pointer' }}>
                          {v.eseguita ? '✓ Eseguita' : '○ Segna eseguita'}
                        </button>
                        {v.eseguita && (
                          <button onClick={() => {
                            if (v.incassata) {
                              if (confirm('Annullare l\'incasso di questa prestazione? Il pagamento già registrato in Pagamenti non verrà eliminato automaticamente.')) toggleIncassata(pl.id, i);
                              return;
                            }
                            setPagVoceCtx({ plId: pl.id, voceIndex: i });
                            setPagForm({ importo: Number(v.prezzo).toFixed(2), metodo: 'Contanti', nota: `${v.prestazione}${v.dente ? ` (d.${v.dente})` : ''}`, data: today(), pianoId: String(pl.id), stato: 'pagato' });
                            setPagModal(true);
                          }} style={{ flex: 1, padding: '6px 0', borderRadius: 7, border: `1.5px solid ${v.incassata ? C.suc : C.dan}`, background: v.incassata ? C.sucL : C.danL, color: v.incassata ? C.suc : C.dan, fontWeight: 700, fontSize: 11, cursor: 'pointer' }}>
                            {v.incassata ? '€ Incassata' : '€ Da incassare'}
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                  {scontato > 0 && <div style={{ fontSize: 11, color: C.suc, textAlign: 'right', marginTop: 5 }}>Sconto: −{fmt(scontato)}</div>}
                  <div style={{ textAlign: 'right', fontWeight: 800, color: C.pri, marginTop: 4 }}>Totale: {fmt(tot)}</div>
                </Crd>
              );
            })}

            {selPiani.length > 0 && (() => {
              const pianiSel = patPlans.filter((p) => selPiani.includes(p.id));
              const totSel = pianiSel.reduce((s, pl) => {
                const sub = pl.voci.reduce((a, v) => a + Number(v.prezzo), 0);
                const sc = Number(pl.sconto) || 0;
                const scontato = pl.scontoTipo === 'pct' ? sub * (sc / 100) : Math.min(sc, sub);
                return s + Math.max(0, sub - scontato);
              }, 0);
              return (
                <div style={{ position: 'sticky', bottom: 0, background: C.priD, borderRadius: 12, padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 }}>
                  <div>
                    <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: 11 }}>{selPiani.length} pian{selPiani.length === 1 ? 'o' : 'i'} selezionat{selPiani.length === 1 ? 'o' : 'i'}</div>
                    <div style={{ color: '#fff', fontWeight: 900, fontSize: 18 }}>{fmt(totSel)}</div>
                  </div>
                  <button onClick={generaPdfMulti} style={{ background: C.acc, border: 'none', borderRadius: 9, padding: '10px 16px', color: '#fff', fontWeight: 800, fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Ic n="prt" s={15} c="#fff" />Genera PDF
                  </button>
                </div>
              );
            })()}
          </div>
        )}


        {tab === 'impl' && isDentistico && (
          <div>
            {/* alert corona in scadenza */}
            {patImpianti.filter(im => im.dataCorona && new Date(im.dataCorona + 'T12:00') <= new Date(new Date().setDate(new Date().getDate() + 30))).map(im => (
              <div key={im.id} style={{ background: new Date(im.dataCorona + 'T12:00') < new Date() ? C.danL : '#FEF3E2', borderRadius: 10, padding: '10px 13px', marginBottom: 10, borderLeft: `3px solid ${new Date(im.dataCorona + 'T12:00') < new Date() ? C.dan : C.war}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 800, color: new Date(im.dataCorona + 'T12:00') < new Date() ? C.dan : C.war }}>
                    {new Date(im.dataCorona + 'T12:00') < new Date() ? '⚠️ Carico corona scaduto' : '📅 Carico corona in arrivo'}
                  </div>
                  <div style={{ fontSize: 11, color: C.txm }}>Dente {im.dente || '—'} · {im.marca || ''} {im.modello || ''} · previsto {fmtD(im.dataCorona)}</div>
                </div>
              </div>
            ))}

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 11 }}>
              <button onClick={() => { setImpForm({ dente: '', marca: '', modello: '', lotto: '', diametro: '', lunghezza: '', dataInserimento: today(), dataCorona: '', noteCorona: '' }); setImpEditId(null); setImpModal(true); }} style={{ background: C.pri, border: 'none', borderRadius: 10, padding: '10px 16px', color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
                <Ic n="plus" s={14} c="#fff" /> Nuovo impianto
              </button>
            </div>

            {patImpianti.length === 0 && <div style={{ textAlign: 'center', color: C.txl, padding: 40 }}>Nessun impianto registrato</div>}

            {patImpianti.map(im => {
              const hasCorona = !!im.dataCorona;
              const coronaScaduta = hasCorona && new Date(im.dataCorona + 'T12:00') < new Date();
              const coronaVicina = hasCorona && !coronaScaduta && new Date(im.dataCorona + 'T12:00') <= new Date(new Date().setDate(new Date().getDate() + 30));
              return (
                <Crd key={im.id} style={{ marginBottom: 11, borderLeft: `3px solid ${coronaScaduta ? C.dan : coronaVicina ? C.war : C.brd}` }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                    <div>
                      <div style={{ fontWeight: 800, fontSize: 15 }}>🦷 Dente {im.dente || '—'}</div>
                      <div style={{ fontSize: 11, color: C.txm, marginTop: 2 }}>Inserito: {fmtD(im.dataInserimento)}</div>
                    </div>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button onClick={() => { setImpForm({ ...im }); setImpEditId(im.id); setImpModal(true); }} style={{ background: C.purL, border: 'none', borderRadius: 7, padding: '6px 8px', cursor: 'pointer' }}><Ic n="edit" s={13} c={C.pur} /></button>
                      <button onClick={() => setImpConfirmDel(im.id)} style={{ background: C.danL, border: 'none', borderRadius: 7, padding: '6px 8px', cursor: 'pointer' }}><Ic n="del" s={13} c={C.dan} /></button>
                    </div>
                  </div>

                  {/* passaporto implantare */}
                  <div style={{ background: C.bg, borderRadius: 9, padding: 10, marginBottom: 8 }}>
                    <div style={{ fontSize: 10, fontWeight: 800, color: C.pri, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 7 }}>📋 Passaporto implantare</div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 5 }}>
                      {[['Marca', im.marca], ['Modello', im.modello], ['Lotto/N° serie', im.lotto], ['Diametro', im.diametro], ['Lunghezza', im.lunghezza]].map(([l, v]) => v ? (
                        <div key={l}>
                          <div style={{ fontSize: 9, color: C.txl, fontWeight: 700, textTransform: 'uppercase' }}>{l}</div>
                          <div style={{ fontSize: 12, fontWeight: 600, color: C.txt }}>{v}</div>
                        </div>
                      ) : null)}
                    </div>
                  </div>

                  {/* carico corona */}
                  <div style={{ background: coronaScaduta ? C.danL : coronaVicina ? '#FEF3E2' : C.sucL, borderRadius: 8, padding: '8px 11px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontSize: 10, fontWeight: 700, color: C.txm, textTransform: 'uppercase' }}>Carico / Corona prevista</div>
                      <div style={{ fontSize: 13, fontWeight: 800, color: coronaScaduta ? C.dan : coronaVicina ? C.war : C.suc }}>{hasCorona ? fmtD(im.dataCorona) : '— non impostata'}</div>
                      {im.noteCorona && <div style={{ fontSize: 10, color: C.txm, marginTop: 2 }}>{im.noteCorona}</div>}
                    </div>
                    {coronaScaduta && <Bdg ch="⚠️ Scaduto" co={C.dan} />}
                    {coronaVicina && <Bdg ch="📅 Prossimo" co={C.war} />}
                    {hasCorona && !coronaScaduta && !coronaVicina && <Bdg ch="✓ Programmato" co={C.suc} />}
                  </div>

                  {impConfirmDel === im.id && (
                    <div style={{ background: C.danL, borderRadius: 8, padding: '8px 11px', marginTop: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: C.dan }}>Eliminare questo impianto?</span>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button onClick={() => setImpConfirmDel(null)} style={{ background: '#fff', border: `1px solid ${C.brd}`, borderRadius: 6, padding: '4px 9px', fontSize: 11, fontWeight: 700, cursor: 'pointer', color: C.txm }}>No</button>
                        <button onClick={() => { setImplants && setImplants(prev => prev.filter(x => x.id !== im.id)); setImpConfirmDel(null); }} style={{ background: C.dan, border: 'none', borderRadius: 6, padding: '4px 9px', fontSize: 11, fontWeight: 700, cursor: 'pointer', color: '#fff' }}>Sì, elimina</button>
                      </div>
                    </div>
                  )}
                </Crd>
              );
            })}
          </div>
        )}

        {tab === 'paga' && (
          <div>
            <Crd style={{ marginBottom: 12, background: C.priD, border: 'none' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: 'rgba(255,255,255,0.6)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Situazione finanziaria</div>
            <div style={{ display: 'flex', gap: 6 }}>
              <button onClick={() => { setPagVoceCtx(null); setPagForm({ importo: totDaPagare > 0 ? totDaPagare.toFixed(2) : '', metodo: 'Contanti', nota: '', data: today(), pianoId: '' }); setPagModal(true); }} style={{ background: '#86efac', border: 'none', borderRadius: 8, padding: '6px 11px', color: '#166534', fontWeight: 700, fontSize: 11, cursor: 'pointer' }}>+ Pagamento</button>
              <button onClick={() => setDocFiscale(true)} style={{ background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: 8, padding: '6px 11px', color: '#fff', fontWeight: 700, fontSize: 11, cursor: 'pointer' }}>📄 Fattura</button>
            </div>
          </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <div><div style={{ fontSize: 10, color: 'rgba(255,255,255,0.55)' }}>Dovuto totale</div><div style={{ fontSize: 16, fontWeight: 800, color: '#fff' }}>{fmt(totDovuto)}</div></div>
                <div style={{ textAlign: 'center' }}><div style={{ fontSize: 10, color: 'rgba(255,255,255,0.55)' }}>Pagato</div><div style={{ fontSize: 16, fontWeight: 800, color: '#86efac' }}>{fmt(totPaid)}</div></div>
                <div style={{ textAlign: 'right' }}><div style={{ fontSize: 10, color: 'rgba(255,255,255,0.55)' }}>Da pagare</div><div style={{ fontSize: 16, fontWeight: 800, color: totDaPagare > 0 ? '#FCA5A5' : '#86efac' }}>{fmt(totDaPagare)}</div></div>
              </div>
              {totAccNonEseg > 0 && (
                <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid rgba(255,255,255,0.15)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.7)' }}>✓ Accettato da eseguire</span>
                  <span style={{ fontSize: 14, fontWeight: 800, color: '#c4b5fd' }}>{fmt(totAccNonEseg)}</span>
                </div>
              )}
              <div style={{ background: 'rgba(255,255,255,0.15)', borderRadius: 6, height: 8, overflow: 'hidden', marginBottom: 4 }}>
                <div style={{ height: '100%', width: `${pctPagato}%`, background: pctPagato >= 100 ? '#86efac' : '#60a5fa', borderRadius: 6, transition: 'width 0.3s' }} />
              </div>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)', textAlign: 'right' }}>{pctPagato}% saldato</div>
            </Crd>
            {patPlans.length > 0 && (
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 11, fontWeight: 800, color: C.txm, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 7 }}>Dettaglio per piano</div>
                {patPlans.map((pl) => {
                  const sub = pl.voci.reduce((s, v) => s + Number(v.prezzo), 0);
                  const sc = Number(pl.sconto) || 0;
                  const scontato = pl.scontoTipo === 'pct' ? sub * (sc / 100) : Math.min(sc, sub);
                  const plTot = Math.max(0, sub - scontato);
                  const plEseg = pl.voci.filter((v) => v.eseguita).reduce((s, v) => s + Number(v.prezzo), 0);
                  const plDaFare = pl.voci.filter((v) => !v.eseguita).reduce((s, v) => s + Number(v.prezzo), 0);
                  return (
                    <Crd key={pl.id} style={{ marginBottom: 8, borderLeft: `3px solid ${C.pri}` }}>
                      <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 6 }}>{pl.titolo}</div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        {[['Totale piano', plTot, C.pri], ['Eseguito', plEseg, C.acc], ['Da eseguire', plDaFare, C.war]].map(([l, v, co]) => (
                          <div key={l} style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span style={{ fontSize: 11, color: C.txm }}>{l}</span>
                            <span style={{ fontSize: 12, fontWeight: 700, color: co }}>{fmt(v)}</span>
                          </div>
                        ))}
                        {scontato > 0 && (
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span style={{ fontSize: 11, color: C.suc }}>Sconto</span>
                            <span style={{ fontSize: 12, fontWeight: 700, color: C.suc }}>−{fmt(scontato)}</span>
                          </div>
                        )}
                      </div>
                    </Crd>
                  );
                })}
              </div>
            )}
            <div style={{ fontSize: 11, fontWeight: 800, color: C.txm, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 7 }}>Pagamenti registrati</div>
            {patPay.length === 0 && <div style={{ textAlign: 'center', color: C.txl, padding: '20px 0' }}>Nessun pagamento registrato</div>}
            {patPay.map((p) => (
              <Crd key={p.id} style={{ marginBottom: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ background: C.sucL, borderRadius: 9, padding: 8, flexShrink: 0 }}><Ic n="eur" s={16} c={C.suc} /></div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 15, fontWeight: 800, color: C.suc }}>{fmt(p.importo)}</div>
                    <div style={{ fontSize: 11, color: C.txm, marginTop: 2 }}>{fmtD(p.data)}{p.nota ? ' · ' + p.nota : ''}</div>
                    <div style={{ marginTop: 4, display: 'flex', gap: 4, flexWrap: 'wrap' }}><Bdg ch={p.metodo} co={C.pri} /><Bdg ch={p.stato} co={p.stato === 'pagato' ? C.suc : C.war} /></div>
                  </div>
                </div>
              </Crd>
            ))}
            {totDaPagare > 0 && (
              <Crd style={{ background: '#FEF3E2', border: `1px solid ${C.war}40`, marginTop: 4 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: '#92400E' }}>⏳ Saldo residuo</span>
                  <span style={{ fontSize: 17, fontWeight: 900, color: C.dan }}>{fmt(totDaPagare)}</span>
                </div>
              </Crd>
            )}
          </div>
        )}

        {tab === 'foto' && (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <div style={{ fontSize: 14, fontWeight: 700 }}>📁 Foto e documenti</div>
              <button onClick={() => fileInputRef.current?.click()} style={{ background: C.pri, border: 'none', borderRadius: 8, padding: '8px 14px', color: '#fff', fontWeight: 700, fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}>
                <Ic n="plus" s={12} c="#fff" /> Carica
              </button>
              <input ref={fileInputRef} type="file" accept="image/*,.pdf" multiple style={{ display: 'none' }} onChange={e => { Array.from(e.target.files).forEach(uploadFoto); e.target.value = ''; }} />
            </div>
            {fotoLoading && <div style={{ textAlign: 'center', color: C.txl, padding: 16 }}>⏳ Caricamento...</div>}
            {!fotoLoading && foto.length === 0 && (
              <label style={{ display: 'block', border: `2px dashed ${C.brd}`, borderRadius: 10, padding: '30px 14px', textAlign: 'center', cursor: 'pointer' }}>
                <input type="file" accept="image/*,.pdf" multiple style={{ display: 'none' }} onChange={e => { Array.from(e.target.files).forEach(uploadFoto); e.target.value = ''; }} />
                <div style={{ fontSize: 28, marginBottom: 6 }}>📷</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: C.pri }}>Carica foto o PDF</div>
                <div style={{ fontSize: 11, color: C.txl, marginTop: 3 }}>Panoramiche, RX, documenti...</div>
              </label>
            )}
            {!fotoLoading && foto.length > 0 && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                {foto.map((f, i) => (
                  <div key={i} style={{ position: 'relative' }}>
                    <a href={f.url} target="_blank" rel="noopener" style={{ display: 'block', textDecoration: 'none' }}>
                      {isImage(f.name) ? (
                        <div style={{ width: '100%', paddingBottom: '100%', position: 'relative', borderRadius: 8, overflow: 'hidden', background: C.bg }}>
                          <img src={f.url} alt={f.label} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
                        </div>
                      ) : (
                        <div style={{ width: '100%', paddingBottom: '100%', position: 'relative', borderRadius: 8, background: C.danL }}>
                          <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                            <div style={{ fontSize: 28 }}>📄</div>
                            <div style={{ fontSize: 9, color: C.dan, fontWeight: 700, marginTop: 3 }}>PDF</div>
                          </div>
                        </div>
                      )}
                      <div style={{ fontSize: 9, color: C.txm, marginTop: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 600 }}>{f.label}</div>
                    </a>
                    <button onClick={() => deleteFoto(f.name)} style={{ position: 'absolute', top: 3, right: 3, background: 'rgba(0,0,0,0.5)', border: 'none', borderRadius: 4, width: 20, height: 20, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}>
                      <Ic n="x" s={10} c="#fff" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {tab === 'doc' && (
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 14 }}>📄 Documenti medici</div>
            {(features?.documenti === false) ? (
              <div style={{ background: C.bg, borderRadius: 12, padding: 20, textAlign: 'center' }}>
                <div style={{ fontSize: 24, marginBottom: 8 }}>🔒</div>
                <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 4 }}>Funzione non disponibile nel tuo piano</div>
                <div style={{ fontSize: 12, color: C.txm }}>Passa a Pro o Premium per generare ricette, certificati, lettere e fatture in PDF.</div>
              </div>
            ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <button onClick={() => setDocMedico(true)} style={{ background: C.priL, border: `1.5px solid ${C.pri}`, borderRadius: 12, padding: 16, cursor: 'pointer', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ background: C.pri, borderRadius: 8, padding: 8 }}><Ic n="plan" s={20} c="#fff" /></div>
                <div>
                  <div style={{ fontWeight: 800, fontSize: 14, color: C.pri }}>Ricetta / Certificato / Lettera / Protocollo</div>
                  <div style={{ fontSize: 11, color: C.txm, marginTop: 2 }}>Genera documenti medici in PDF</div>
                </div>
              </button>
              <button onClick={() => setDocFiscale(true)} style={{ background: '#E8FAF9', border: `1.5px solid ${C.acc}`, borderRadius: 12, padding: 16, cursor: 'pointer', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ background: C.acc, borderRadius: 8, padding: 8 }}><Ic n="eur" s={20} c="#fff" /></div>
                <div>
                  <div style={{ fontWeight: 800, fontSize: 14, color: C.acc }}>Fattura / Rimborso spese</div>
                  <div style={{ fontSize: 11, color: C.txm, marginTop: 2 }}>Genera documenti fiscali in PDF</div>
                </div>
              </button>
            </div>
            )}
          </div>
        )}

        {tab === 'app' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
              <button onClick={() => { if (onNuovoAppuntamento) { onClose(); onNuovoAppuntamento(paz.id); } else { setAppForm({ data: today(), ora: '09:00', durata: 30, tipo: 'Visita di controllo', note: '', stato: 'confermato' }); setAppModal(true); } }} style={{ background: C.pri, border: 'none', borderRadius: 8, padding: '8px 14px', color: '#fff', fontWeight: 700, fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}>
                <Ic n="plus" s={12} c="#fff" /> Nuovo appuntamento
              </button>
            </div>
            {patApp.length === 0 && <div style={{ textAlign: 'center', color: C.txl, padding: 40 }}>Nessun appuntamento</div>}
            {patApp.map((a) => (
              <Crd key={a.id} style={{ marginBottom: 8, borderLeft: `3px solid ${a.data >= today() ? C.pri : C.brd}` }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ background: a.data >= today() ? C.priL : C.bg, borderRadius: 8, padding: '5px 7px', textAlign: 'center', minWidth: 40, flexShrink: 0 }}>
                    <div style={{ fontSize: 10, color: a.data >= today() ? C.pri : C.txl, fontWeight: 700 }}>{a.data.slice(8)}/{a.data.slice(5, 7)}</div>
                    <div style={{ fontSize: 12, fontWeight: 800, color: a.data >= today() ? C.priD : C.txm }}>{a.ora}</div>
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: 13 }}>{a.tipo}</div>
                    <div style={{ fontSize: 11, color: C.txm }}>{a.durata}min{a.note ? ' · ' + a.note : ''}</div>
                  </div>
                  <Bdg ch={a.stato} co={a.stato === 'confermato' ? C.suc : a.stato === 'annullato' ? C.dan : C.war} />
                </div>
              </Crd>
            ))}
          </div>
        )}
      </div>

      {pagModal && (() => {
        const plSel = patPlans.find(p => String(p.id) === pagForm.pianoId);
        const eseguitoNonIncassato = plSel ? plSel.voci.filter(v => v.eseguita && !v.incassata).reduce((s, v) => s + Number(v.prezzo), 0) : 0;
        const importoNum = Number(pagForm.importo) || 0;
        const nonEseguito = plSel && importoNum > 0 && eseguitoNonIncassato === 0;
        const isAnticipo = plSel && importoNum > 0 && importoNum > eseguitoNonIncassato && eseguitoNonIncassato > 0;
        return (
          <Modal title="💳 Registra pagamento" onClose={() => { setPagModal(false); setPagVoceCtx(null); }}>
            <div style={{ background: C.priD, borderRadius: 10, padding: 12, marginBottom: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <div><div style={{ fontSize: 9, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase' }}>Dovuto</div><div style={{ fontSize: 14, fontWeight: 800, color: '#fff' }}>{fmt(totDovuto)}</div></div>
                <div style={{ textAlign: 'center' }}><div style={{ fontSize: 9, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase' }}>Pagato</div><div style={{ fontSize: 14, fontWeight: 800, color: '#86efac' }}>{fmt(totPaid)}</div></div>
                <div style={{ textAlign: 'right' }}><div style={{ fontSize: 9, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase' }}>Residuo</div><div style={{ fontSize: 14, fontWeight: 800, color: totDaPagare > 0 ? '#FCA5A5' : '#86efac' }}>{fmt(totDaPagare)}</div></div>
              </div>
            </div>

            {patPlans.length > 0 && (
              <Fld label="Piano di cura (opzionale)">
                <Sel value={pagForm.pianoId} onChange={e => {
                  const pl = patPlans.find(p => String(p.id) === e.target.value);
                  if (pl) {
                    const eseg = pl.voci.filter(v => v.eseguita && !v.incassata).reduce((s, v) => s + Number(v.prezzo), 0);
                    setPagForm(f => ({ ...f, pianoId: e.target.value, importo: eseg > 0 ? eseg.toFixed(2) : f.importo }));
                  } else {
                    setPagForm(f => ({ ...f, pianoId: '' }));
                  }
                }}>
                  <option value="">Nessun piano specifico</option>
                  {patPlans.map(pl => {
                    const eseg = pl.voci.filter(v => v.eseguita && !v.incassata).reduce((s, v) => s + Number(v.prezzo), 0);
                    return <option key={pl.id} value={pl.id}>{pl.titolo} {eseg > 0 ? `(eseguito da incassare: ${fmt(eseg)})` : '(nessuna voce eseguita)'}</option>;
                  })}
                </Sel>
              </Fld>
            )}

            {plSel && eseguitoNonIncassato > 0 && (
              <div style={{ background: C.sucL, borderRadius: 8, padding: '8px 12px', marginBottom: 8, display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: C.suc }}>✓ Eseguito da incassare</span>
                <span style={{ fontSize: 13, fontWeight: 800, color: C.suc }}>{fmt(eseguitoNonIncassato)}</span>
              </div>
            )}

            {nonEseguito && (
              <div style={{ background: C.danL, borderRadius: 8, padding: '8px 12px', marginBottom: 8 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: C.dan }}>⚠️ Nessuna prestazione eseguita su questo piano</div>
                <div style={{ fontSize: 11, color: C.dan, marginTop: 3 }}>Il pagamento verrà registrato come anticipo. Le prestazioni andranno segnate come eseguite dal tab Piani.</div>
              </div>
            )}

            {isAnticipo && (
              <div style={{ background: '#FEF3E2', borderRadius: 8, padding: '8px 12px', marginBottom: 8 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: C.war }}>⚠️ Importo superiore all'eseguito ({fmt(eseguitoNonIncassato)})</div>
                <div style={{ fontSize: 11, color: C.war, marginTop: 3 }}>La parte eccedente ({fmt(importoNum - eseguitoNonIncassato)}) verrà registrata come anticipo.</div>
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <Fld label="Data"><Inp type="date" value={pagForm.data} onChange={e => setPagForm(f => ({ ...f, data: e.target.value }))} /></Fld>
              <Fld label="Importo €"><Inp type="number" inputMode="decimal" value={pagForm.importo} onChange={e => setPagForm(f => ({ ...f, importo: e.target.value }))} /></Fld>
              <Fld label="Metodo">
                <Sel value={pagForm.metodo} onChange={e => setPagForm(f => ({ ...f, metodo: e.target.value }))}>
                  {['Contanti','Carta','Bonifico','POS','Assegno'].map(m => <option key={m}>{m}</option>)}
                </Sel>
              </Fld>
              <Fld label="Stato">
                <Sel value={pagForm.stato || 'pagato'} onChange={e => setPagForm(f => ({ ...f, stato: e.target.value }))}>
                  <option value="pagato">Pagato</option>
                  <option value="acconto">Acconto / Anticipo</option>
                </Sel>
              </Fld>
            </div>
            <Fld label="Note (opzionale)"><Inp value={pagForm.nota} onChange={e => setPagForm(f => ({ ...f, nota: e.target.value }))} /></Fld>
            <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
              <Btn ch="Annulla" v="sec" onClick={() => { setPagModal(false); setPagVoceCtx(null); }} full />
              <Btn ch={nonEseguito ? 'Registra anticipo' : 'Salva pagamento'} onClick={() => {
                if (!pagForm.importo) return;
                const stato = nonEseguito ? 'acconto' : (pagForm.stato || 'pagato');
                const nota = nonEseguito && !pagForm.nota ? 'Anticipo — prestazioni da eseguire' : pagForm.nota;
                const recordPag = { id: Date.now(), pazienteId: paz.id, data: pagForm.data, importo: Number(pagForm.importo), metodo: pagForm.metodo, nota, stato };
                if (setPayments) setPayments(prev => [...prev, recordPag]);

                // Aggiorna lo stato "incassata" sulle voci coerentemente col pagamento appena registrato
                if (pagVoceCtx) {
                  // Pagamento avviato dal singolo bottone "Da incassare" → marca solo quella voce
                  const { plId, voceIndex } = pagVoceCtx;
                  setPlans(prev => prev.map(pl => (pl.id === plId ? { ...pl, voci: pl.voci.map((v, j) => (j === voceIndex ? { ...v, incassata: true } : v)) } : pl)));
                } else if (plSel && !nonEseguito && importoNum >= eseguitoNonIncassato) {
                  // Pagamento generico su un piano che copre (o supera) tutto l'eseguito non incassato → marca tutte quelle voci
                  setPlans(prev => prev.map(pl => (pl.id === plSel.id ? { ...pl, voci: pl.voci.map(v => (v.eseguita && !v.incassata ? { ...v, incassata: true } : v)) } : pl)));
                }

                setPagModal(false);
                setPagVoceCtx(null);
              }} dis={!pagForm.importo} full />
            </div>
          </Modal>
        );
      })()}

      {waModal && (
        <Modal title="💬 Invia WhatsApp" onClose={() => setWaModal(false)}>
          <div style={{ background: C.priL, borderRadius: 9, padding: '9px 12px', marginBottom: 12 }}>
            <div style={{ fontWeight: 700, fontSize: 13 }}>{paz.nome} {paz.cognome}</div>
            {paz.telefono && <div style={{ fontSize: 11, color: C.txl }}>📱 {paz.telefono}</div>}
          </div>
          {templates?.length > 0 && (
            <Fld label="Template (opzionale)">
              <Sel value={waTplId} onChange={e => {
                const id = e.target.value;
                setWaTplId(id);
                if (id) {
                  const tpl = templates.find(t => String(t.id) === id);
                  if (tpl) setWaMsg(tpl.testo.replace(/{nome}/g, `${paz.nome} ${paz.cognome}`).replace(/{data}/g, '').replace(/{ora}/g, '').replace(/{tipo}/g, '').replace(/{totale}/g, '').replace(/{voci}/g, ''));
                }
              }}>
                <option value="">Messaggio personalizzato</option>
                {templates.map(t => <option key={t.id} value={t.id}>{t.nome}</option>)}
              </Sel>
            </Fld>
          )}
          <Fld label="Messaggio">
            <textarea value={waMsg} onChange={e => setWaMsg(e.target.value)} rows={6} style={{ width: '100%', padding: '10px 12px', border: `1.5px solid ${C.brd}`, borderRadius: 10, fontSize: 13, color: C.txt, background: C.sur, boxSizing: 'border-box', resize: 'vertical', fontFamily: 'inherit' }} />
          </Fld>
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <Btn ch="Annulla" v="sec" onClick={() => setWaModal(false)} full />
            <Btn ch="Apri WhatsApp" onClick={() => {
              if (!paz.telefono) return;
              window.open(`https://wa.me/39${paz.telefono.replace(/\D/g, '')}?text=${encodeURIComponent(waMsg)}`, '_blank');
              setWaModal(false);
            }} dis={!waMsg} full />
          </div>
        </Modal>
      )}

      {appModal && (
        <Modal title="📅 Nuovo appuntamento" onClose={() => setAppModal(false)}>
          <div style={{ background: C.priL, borderRadius: 9, padding: '9px 12px', marginBottom: 12, fontWeight: 700, fontSize: 13, color: C.pri }}>
            👤 {paz.nome} {paz.cognome}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <Fld label="Data"><Inp type="date" value={appForm.data} onChange={e => setAppForm(f => ({ ...f, data: e.target.value }))} /></Fld>
            <Fld label="Ora"><Inp type="time" value={appForm.ora} onChange={e => setAppForm(f => ({ ...f, ora: e.target.value }))} /></Fld>
            <Fld label="Durata">
              <Sel value={appForm.durata} onChange={e => setAppForm(f => ({ ...f, durata: Number(e.target.value) }))}>
                {[15, 30, 45, 60, 90, 120].map(d => <option key={d} value={d}>{d} min</option>)}
              </Sel>
            </Fld>
            <Fld label="Stato">
              <Sel value={appForm.stato} onChange={e => setAppForm(f => ({ ...f, stato: e.target.value }))}>
                <option value="confermato">Confermato</option>
                <option value="da confermare">Da confermare</option>
                <option value="annullato">Annullato</option>
              </Sel>
            </Fld>
          </div>
          <Fld label="Tipo visita">
            <Inp value={appForm.tipo} onChange={e => setAppForm(f => ({ ...f, tipo: e.target.value }))} placeholder={isDentistico ? 'es. Visita di controllo, Otturazione...' : 'es. Visita di controllo, Trattamento...'} />
          </Fld>
          <Fld label="Note (opzionale)">
            <Inp value={appForm.note} onChange={e => setAppForm(f => ({ ...f, note: e.target.value }))} />
          </Fld>
          <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
            <Btn ch="Annulla" v="sec" onClick={() => setAppModal(false)} full />
            <Btn ch="Salva appuntamento" onClick={() => {
              if (setAppointments) {
                setAppointments(prev => [...prev, { ...appForm, id: Date.now(), pazienteId: paz.id, colore: '#1A4E66' }]);
              }
              setAppModal(false);
            }} full />
          </div>
        </Modal>
      )}

      {noteModalOpen && (
        <Modal title="Anamnesi / Allergie / Note generali" onClose={() => setNoteModalOpen(false)}>
          <div style={{ fontSize: 12, color: C.txm, marginBottom: 10 }}>Campo libero per anamnesi, allergie, farmaci abituali, note importanti sul paziente.</div>
          <textarea value={noteGenerale} onChange={e => setNoteGenerale(e.target.value)} rows={7} placeholder="es. Allergia alla penicillina, diabetico, in terapia con Coumadin..." style={{ width: '100%', padding: '11px 12px', border: `1.5px solid ${C.brd}`, borderRadius: 10, fontSize: 14, color: C.txt, background: C.sur, boxSizing: 'border-box', resize: 'vertical', fontFamily: 'inherit' }} />
          <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
            <Btn ch="Annulla" v="sec" onClick={() => setNoteModalOpen(false)} full />
            <Btn ch="Salva" onClick={saveNoteGenerale} full />
          </div>
        </Modal>
      )}

      {ricordaModal && (
        <Modal title="📌 Crea richiamo" onClose={() => setRicordaModal(null)}>
          <div style={{ fontSize: 12, color: C.txm, marginBottom: 12 }}>Il richiamo apparirà in dashboard fino a quando non lo segni come fatto.</div>
          <Fld label="Cosa ricordare">
            <Inp value={ricordaTesto} onChange={e => setRicordaTesto(e.target.value)} placeholder={isDentistico ? `es. Richiamare ${paz.nome} per rx dente 36` : `es. Richiamare ${paz.nome} per il controllo`} />
          </Fld>
          <Fld label="Entro quando">
            <Inp type="date" value={ricordaData} onChange={e => setRicordaData(e.target.value)} />
            <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
              {[['1 settimana', 7], ['2 settimane', 14], ['1 mese', 30]].map(([l, g]) => (
                <button key={g} onClick={() => { const d = new Date(); d.setDate(d.getDate() + g); setRicordaData(d.toISOString().slice(0,10)); }} style={{ background: C.priL, border: 'none', borderRadius: 7, padding: '5px 9px', fontSize: 11, fontWeight: 700, color: C.pri, cursor: 'pointer' }}>{l}</button>
              ))}
            </div>
          </Fld>
          <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
            <Btn ch="Annulla" v="sec" onClick={() => setRicordaModal(null)} full />
            <Btn ch="Crea richiamo" onClick={creaRichiamo} dis={!ricordaTesto.trim()} full />
          </div>
        </Modal>
      )}

      {impModal && (
        <Modal title={impEditId ? 'Modifica impianto' : 'Nuovo impianto'} onClose={() => setImpModal(false)} wide>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <Fld label="Dente"><Inp value={impForm.dente || ''} onChange={e => setImpForm(f => ({ ...f, dente: e.target.value }))} placeholder="es. 36" /></Fld>
            <Fld label="Data inserimento"><Inp type="date" value={impForm.dataInserimento || ''} onChange={e => setImpForm(f => ({ ...f, dataInserimento: e.target.value }))} /></Fld>
          </div>
          <div style={{ fontSize: 11, fontWeight: 800, color: C.pri, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8, marginTop: 4 }}>📋 Passaporto implantare</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <Fld label="Marca"><Inp value={impForm.marca || ''} onChange={e => setImpForm(f => ({ ...f, marca: e.target.value }))} placeholder="es. Nobel Biocare" /></Fld>
            <Fld label="Modello"><Inp value={impForm.modello || ''} onChange={e => setImpForm(f => ({ ...f, modello: e.target.value }))} placeholder="es. NobelActive" /></Fld>
            <Fld label="Lotto / N° serie"><Inp value={impForm.lotto || ''} onChange={e => setImpForm(f => ({ ...f, lotto: e.target.value }))} placeholder="es. LOT123456" /></Fld>
            <Fld label="Diametro"><Inp value={impForm.diametro || ''} onChange={e => setImpForm(f => ({ ...f, diametro: e.target.value }))} placeholder="es. 4.3 mm" /></Fld>
            <Fld label="Lunghezza"><Inp value={impForm.lunghezza || ''} onChange={e => setImpForm(f => ({ ...f, lunghezza: e.target.value }))} placeholder="es. 11.5 mm" /></Fld>
          </div>
          <div style={{ fontSize: 11, fontWeight: 800, color: C.pri, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8, marginTop: 4 }}>🦷 Carico / Corona</div>
          <Fld label="Data carico/corona prevista">
            <Inp type="date" value={impForm.dataCorona || ''} onChange={e => setImpForm(f => ({ ...f, dataCorona: e.target.value }))} />
            <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
              {[['3 mesi', 3], ['4 mesi', 4], ['6 mesi', 6]].map(([l, m]) => (
                <button key={m} onClick={() => { const d = new Date((impForm.dataInserimento || today()) + 'T12:00'); d.setMonth(d.getMonth() + m); setImpForm(f => ({ ...f, dataCorona: d.toISOString().slice(0, 10) })); }} style={{ background: C.priL, border: 'none', borderRadius: 7, padding: '5px 10px', fontSize: 11, fontWeight: 700, color: C.pri, cursor: 'pointer' }}>{l}</button>
              ))}
            </div>
          </Fld>
          <Fld label="Note carico/corona"><Inp value={impForm.noteCorona || ''} onChange={e => setImpForm(f => ({ ...f, noteCorona: e.target.value }))} placeholder="es. Attesa osteointegrazione, ricontrollare RX" /></Fld>
          <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
            <Btn ch="Annulla" v="sec" onClick={() => setImpModal(false)} full />
            <Btn ch="Salva impianto" onClick={() => {
              if (!setImplants) return;
              if (impEditId) {
                setImplants(prev => prev.map(x => x.id === impEditId ? { ...impForm, id: impEditId, pazienteId: paz.id } : x));
              } else {
                setImplants(prev => [...prev, { ...impForm, id: Date.now() + Math.floor(Math.random() * 9999), pazienteId: paz.id }]);
              }
              setImpModal(false);
            }} full />
          </div>
        </Modal>
      )}

      {editPianoModal && editForm && (
        <Modal title="Modifica piano" onClose={() => setEditPianoModal(null)} wide>
          <Fld label="Titolo"><Inp value={editForm.titolo} onChange={(e) => setEditForm((f) => ({ ...f, titolo: e.target.value }))} /></Fld>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <Fld label="Data"><Inp type="date" value={editForm.data} onChange={(e) => setEditForm((f) => ({ ...f, data: e.target.value }))} /></Fld>
            <Fld label="Stato">
              <Sel value={editForm.stato || 'attivo'} onChange={(e) => setEditForm((f) => ({ ...f, stato: e.target.value }))}>
                <option value="attivo">Attivo</option><option value="accettato">Accettato ✓</option><option value="rifiutato">Rifiutato ✗</option><option value="concluso">Concluso ✓</option>
              </Sel>
            </Fld>
          </div>
          <Fld label="Sconto">
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <div style={{ display: 'flex', background: C.bg, borderRadius: 8, border: `1.5px solid ${C.brd}`, overflow: 'hidden', flexShrink: 0 }}>
                <button onClick={() => setEditForm((f) => ({ ...f, scontoTipo: 'pct' }))} style={{ padding: '8px 12px', border: 'none', background: editForm.scontoTipo === 'pct' ? C.pri : C.sur, color: editForm.scontoTipo === 'pct' ? '#fff' : C.txm, fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>%</button>
                <button onClick={() => setEditForm((f) => ({ ...f, scontoTipo: 'eur' }))} style={{ padding: '8px 12px', border: 'none', background: editForm.scontoTipo === 'eur' ? C.pri : C.sur, color: editForm.scontoTipo === 'eur' ? '#fff' : C.txm, fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>€</button>
              </div>
              <Inp type="number" value={editForm.sconto || ''} placeholder="0" onChange={(e) => setEditForm((f) => ({ ...f, sconto: e.target.value }))} style={{ flex: 1 }} />
            </div>
          </Fld>
          <div style={{ fontSize: 11, fontWeight: 800, color: C.txm, textTransform: 'uppercase', marginBottom: 6 }}>Prestazioni</div>
          {editForm.voci.map((v, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 0', borderBottom: `1px solid ${C.brd}` }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{v.prestazione}{v.dente ? ` · d.${v.dente}` : ''}</div>
                <div style={{ fontSize: 11, color: C.txm }}>{fmt(v.prezzo)}</div>
              </div>
              <button onClick={() => delVoceEdit(i)} style={{ background: C.danL, border: 'none', borderRadius: 6, padding: '5px 7px', cursor: 'pointer', flexShrink: 0 }}>
                <Ic n="del" s={12} c={C.dan} />
              </button>
            </div>
          ))}
          {(() => {
            const sub = editForm.voci.reduce((s, v) => s + Number(v.prezzo), 0);
            const sc = Number(editForm.sconto) || 0;
            const scontato = editForm.scontoTipo === 'pct' ? sub * (sc / 100) : Math.min(sc, sub);
            const finale = Math.max(0, sub - scontato);
            return (
              <div style={{ background: C.priD, borderRadius: 9, padding: '10px 14px', marginTop: 10 }}>
                {scontato > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12 }}>Sconto</span>
                    <span style={{ color: '#86efac', fontWeight: 700 }}>−{fmt(scontato)}</span>
                  </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#fff', fontWeight: 800 }}>Totale</span>
                  <span style={{ color: '#fff', fontWeight: 900, fontSize: 17 }}>{fmt(finale)}</span>
                </div>
              </div>
            );
          })()}
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <Btn ch="Annulla" v="sec" onClick={() => setEditPianoModal(null)} full />
            <Btn ch="Salva modifiche" onClick={saveEdit} full />
          </div>
        </Modal>
      )}
    </div>
  );
}
