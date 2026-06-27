import React, { useState } from 'react';
import { Btn, Crd, Fld, Inp, Txt, Modal, Toast, Ic } from './ui';
import { C, uid, fmtD, today } from '../lib/utils';
import ImportCsvModal from './ImportCsvModal.jsx';
import DupModal from './DupModal.jsx';
import SchedaPaz from './SchedaPaz.jsx';

export default function Pazienti({ patients, setPatients, plans, setPlans, payments, appointments, setAppointments, si, onNuovoPiano, implants, setImplants }) {
  const [modal, setModal] = useState(false);
  const [importModal, setImportModal] = useState(false);
  const [dupModal, setDupModal] = useState(false);
  const [form, setForm] = useState({});
  const [scheda, setScheda] = useState(null);
  const [search, setSearch] = useState('');
  const [toast, setToast] = useState('');
  const [confirmDelId, setConfirmDelId] = useState(null);
  const F = (f) => setForm((p) => ({ ...p, ...f }));

  const openEdit = (p) => { setForm(p || { nome: '', cognome: '', dataNascita: '', telefono: '', email: '', cf: '', indirizzo: '', note: '' }); setModal(true); };
  const save = () => {
    if (!form.nome || !form.cognome) return;
    if (form.id) setPatients((p) => p.map((x) => (x.id === form.id ? form : x)));
    else setPatients((p) => [...p, { ...form, id: uid() }]);
    setModal(false);
    setToast('Salvato ✓');
  };
  const del = (id) => {
    setPatients((p) => p.filter((x) => x.id !== id));
    setPlans((p) => p.filter((x) => x.pazienteId !== id));
    setToast('Paziente eliminato');
  };

  const chiaveDup = (p) => `${(p.nome || '').trim().toLowerCase()}|${(p.cognome || '').trim().toLowerCase()}`;
  const handleImport = (nuoviPazienti) => {
    const esistenti = new Set(patients.map(chiaveDup));
    const daImportare = nuoviPazienti.filter((p) => !esistenti.has(chiaveDup(p)));
    const scartati = nuoviPazienti.length - daImportare.length;
    setPatients((prev) => [...prev, ...daImportare.map((p) => ({ ...p, id: uid() }))]);
    setImportModal(false);
    setToast(scartati > 0 ? `${daImportare.length} importati, ${scartati} scartati (già esistenti)` : `${daImportare.length} pazienti importati ✓`);
  };

  const gruppiDuplicati = (() => {
    const mappa = {};
    patients.forEach((p) => {
      const k = chiaveDup(p);
      if (!k.trim() || k === '|') return;
      if (!mappa[k]) mappa[k] = [];
      mappa[k].push(p);
    });
    return Object.values(mappa).filter((g) => g.length > 1);
  })();

  const filtered = patients.filter((p) => `${p.nome} ${p.cognome} ${p.cf || ''} ${p.telefono || ''}`.toLowerCase().includes(search.toLowerCase()));

  if (scheda) {
    return (
      <SchedaPaz
        paz={scheda} plans={plans} setPlans={setPlans} payments={payments} appointments={appointments}
        si={si} implants={implants} setImplants={setImplants}
        onClose={() => setScheda(null)}
        onEdit={(p) => { setScheda(null); openEdit(p); }}
        onNuovoPiano={(id) => { setScheda(null); onNuovoPiano(id); }}
        setPatients={setPatients}
        setAppointments={setAppointments}
      />
    );
  }

  // STATISTICHE
  const oggi = today();
  const meseCorrente = oggi.slice(0, 7);
  const annoCorrente = oggi.slice(0, 4);
  const dataCreazione = (p) => {
    const tms = Number(p.id);
    if (!tms || isNaN(tms)) return null;
    return new Date(tms).toISOString().slice(0, 10);
  };
  const nuoviMese = patients.filter((p) => { const d = dataCreazione(p); return d && d.startsWith(meseCorrente); }).length;
  const nuoviAnno = patients.filter((p) => { const d = dataCreazione(p); return d && d.startsWith(annoCorrente); }).length;
  const preventiviAccettati = plans.filter((pl) => pl.stato === 'accettato' || pl.stato === 'concluso').length;
  const preventiviNonAccettati = plans.filter((pl) => pl.stato === 'rifiutato').length;
  const preventiviAttesa = plans.filter((pl) => (pl.stato || 'attivo') === 'attivo').length;
  const contaPrestazioni = {};
  plans.forEach((pl) => pl.voci.forEach((v) => {
    if (!v.eseguita) return;
    const k = v.prestazione || '—';
    contaPrestazioni[k] = (contaPrestazioni[k] || 0) + 1;
  }));
  const topPrestazioni = Object.entries(contaPrestazioni).sort((a, b) => b[1] - a[1]).slice(0, 5);

  return (
    <div>
      {toast && <Toast msg={toast} onDone={() => setToast('')} />}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, gap: 8 }}>
        <div style={{ fontSize: 20, fontWeight: 800 }}>Pazienti</div>
        <div style={{ display: 'flex', gap: 6 }}>
          {gruppiDuplicati.length > 0 && (
            <button onClick={() => setDupModal(true)} style={{ background: C.danL, border: 'none', borderRadius: 10, padding: '10px 13px', color: C.dan, fontWeight: 700, fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}>
              ⚠️ {gruppiDuplicati.length} dup.
            </button>
          )}
          <button onClick={() => setImportModal(true)} style={{ background: C.priL, border: 'none', borderRadius: 10, padding: '10px 13px', color: C.pri, fontWeight: 700, fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}>
            📥 CSV
          </button>
          <Btn ch="Nuovo" ic="plus" onClick={() => openEdit()} />
        </div>
      </div>

      <div style={{ position: 'relative', marginBottom: 14 }}>
        <div style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)' }}><Ic n="srch" s={15} c={C.txl} /></div>
        <Inp placeholder="Cerca nome, CF, telefono…" value={search} onChange={(e) => setSearch(e.target.value)} style={{ paddingLeft: 36 }} />
      </div>

      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 11, fontWeight: 800, color: C.txm, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>📊 Andamento studio</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 9, marginBottom: 9 }}>
          <Crd style={{ padding: 12, display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ background: C.priL, borderRadius: 9, padding: 8, flexShrink: 0 }}><Ic n="pz" s={17} c={C.pri} /></div>
            <div><div style={{ fontSize: 18, fontWeight: 800 }}>{nuoviMese}</div><div style={{ fontSize: 10, color: C.txm, fontWeight: 600 }}>Nuovi questo mese</div></div>
          </Crd>
          <Crd style={{ padding: 12, display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ background: '#E8FAF9', borderRadius: 9, padding: 8, flexShrink: 0 }}><Ic n="pz" s={17} c={C.acc} /></div>
            <div><div style={{ fontSize: 18, fontWeight: 800 }}>{nuoviAnno}</div><div style={{ fontSize: 10, color: C.txm, fontWeight: 600 }}>Nuovi quest'anno</div></div>
          </Crd>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 9 }}>
          <Crd style={{ padding: '10px 8px', textAlign: 'center' }}>
            <div style={{ fontSize: 17, fontWeight: 800, color: C.suc }}>{preventiviAccettati}</div>
            <div style={{ fontSize: 9, color: C.txm, fontWeight: 600, marginTop: 2 }}>Preventivi accettati</div>
          </Crd>
          <Crd style={{ padding: '10px 8px', textAlign: 'center' }}>
            <div style={{ fontSize: 17, fontWeight: 800, color: C.war }}>{preventiviAttesa}</div>
            <div style={{ fontSize: 9, color: C.txm, fontWeight: 600, marginTop: 2 }}>In attesa</div>
          </Crd>
          <Crd style={{ padding: '10px 8px', textAlign: 'center' }}>
            <div style={{ fontSize: 17, fontWeight: 800, color: C.dan }}>{preventiviNonAccettati}</div>
            <div style={{ fontSize: 9, color: C.txm, fontWeight: 600, marginTop: 2 }}>Rifiutati</div>
          </Crd>
        </div>
        {topPrestazioni.length > 0 && (
          <Crd style={{ padding: 12 }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: C.txm, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 9 }}>🏆 Prestazioni più eseguite</div>
            {topPrestazioni.map(([nome, n], i) => {
              const max = topPrestazioni[0][1];
              const pct = Math.round((n / max) * 100);
              return (
                <div key={nome} style={{ marginBottom: i < topPrestazioni.length - 1 ? 7 : 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: C.txt }}>{i + 1}. {nome}</span>
                    <span style={{ fontSize: 12, fontWeight: 800, color: C.pri }}>{n}</span>
                  </div>
                  <div style={{ background: C.bg, borderRadius: 4, height: 5, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${pct}%`, background: C.pri, borderRadius: 4 }} />
                  </div>
                </div>
              );
            })}
          </Crd>
        )}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
        {filtered.map((p) => {
          const confirming = confirmDelId === p.id;
          return (
            <Crd key={p.id} style={{ padding: 0, overflow: 'hidden' }}>
              <div onClick={() => setScheda(p)} style={{ display: 'flex', alignItems: 'center', gap: 11, padding: 14, cursor: 'pointer' }}>
                <div style={{ background: C.priL, borderRadius: 12, width: 42, height: 42, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <span style={{ fontSize: 14, fontWeight: 800, color: C.pri }}>{(p.nome[0] || '') + (p.cognome[0] || '')}</span>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>{p.nome} {p.cognome}</div>
                  <div style={{ display: 'flex', gap: 10, marginTop: 2, flexWrap: 'wrap' }}>
                    {p.telefono && <span style={{ fontSize: 11, color: C.txm }}>📞 {p.telefono}</span>}
                    {p.dataNascita && <span style={{ fontSize: 11, color: C.txm }}>🎂 {fmtD(p.dataNascita)}</span>}
                  </div>
                  {p.note && <div style={{ fontSize: 10, color: C.war, marginTop: 2 }}>⚠️ {p.note.slice(0, 50)}{p.note.length > 50 ? '…' : ''}</div>}
                </div>
                <button onClick={(e) => { e.stopPropagation(); setConfirmDelId(confirming ? null : p.id); }} style={{ background: C.danL, border: 'none', borderRadius: 8, padding: 8, cursor: 'pointer', display: 'flex', flexShrink: 0 }}>
                  <Ic n="del" s={15} c={C.dan} />
                </button>
                <div style={{ color: C.txl }}>›</div>
              </div>
              {confirming && (
                <div style={{ background: C.danL, padding: '9px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, borderTop: `1px solid ${C.dan}30` }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: C.dan }}>Eliminare {p.nome} {p.cognome}? Verranno rimossi anche piani e pagamenti associati.</span>
                  <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                    <button onClick={() => setConfirmDelId(null)} style={{ background: '#fff', border: `1px solid ${C.brd}`, borderRadius: 7, padding: '5px 10px', fontSize: 11, fontWeight: 700, cursor: 'pointer', color: C.txm }}>No</button>
                    <button onClick={() => { del(p.id); setConfirmDelId(null); }} style={{ background: C.dan, border: 'none', borderRadius: 7, padding: '5px 10px', fontSize: 11, fontWeight: 700, cursor: 'pointer', color: '#fff' }}>Sì, elimina</button>
                  </div>
                </div>
              )}
            </Crd>
          );
        })}
        {filtered.length === 0 && <div style={{ textAlign: 'center', color: C.txl, padding: 40 }}>Nessun paziente</div>}
      </div>

      {modal && (
        <Modal title={form.id ? 'Modifica paziente' : 'Nuovo paziente'} onClose={() => setModal(false)} wide>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <Fld label="Nome"><Inp value={form.nome || ''} onChange={(e) => F({ nome: e.target.value })} /></Fld>
            <Fld label="Cognome"><Inp value={form.cognome || ''} onChange={(e) => F({ cognome: e.target.value })} /></Fld>
            <Fld label="Data nascita"><Inp type="date" value={form.dataNascita || ''} onChange={(e) => F({ dataNascita: e.target.value })} /></Fld>
            <Fld label="Codice fiscale"><Inp value={form.cf || ''} onChange={(e) => F({ cf: e.target.value.toUpperCase() })} /></Fld>
            <Fld label="Telefono"><Inp type="tel" value={form.telefono || ''} onChange={(e) => F({ telefono: e.target.value })} /></Fld>
            <Fld label="Email"><Inp type="email" value={form.email || ''} onChange={(e) => F({ email: e.target.value })} /></Fld>
          </div>
          <Fld label="Indirizzo"><Inp value={form.indirizzo || ''} onChange={(e) => F({ indirizzo: e.target.value })} /></Fld>
          <Fld label="Note cliniche"><Txt value={form.note || ''} onChange={(e) => F({ note: e.target.value })} /></Fld>
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <Btn ch="Annulla" v="sec" onClick={() => setModal(false)} full />
            <Btn ch="Salva" onClick={save} full />
          </div>
        </Modal>
      )}
      {importModal && <ImportCsvModal onClose={() => setImportModal(false)} onImport={handleImport} />}
      {dupModal && <DupModal patients={patients} setPatients={setPatients} onClose={() => setDupModal(false)} />}
    </div>
  );
}
