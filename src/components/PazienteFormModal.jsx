import React, { useState } from 'react';
import { Btn, Fld, Inp, Txt, Modal } from './ui';
import { C } from '../lib/utils';

const emptyPatient = { nome: '', cognome: '', dataNascita: '', telefono: '', email: '', cf: '', indirizzo: '', cap: '', comune: '', provincia: '', opposizione_sts: false, note: '' };

/* POL-UI-042 — extracted verbatim from Pazienti.jsx's own inline
   "Nuovo/Modifica paziente" modal (same fields, same layout, same
   validation) so a second entry point (the patient record's own
   "Modifica" button, previously wired to nothing but closing the
   overlay — see App.jsx) can open the SAME real edit form instead of
   inventing a second, different one. `patient` is the record being
   edited, or null/undefined for a brand-new one; `onSave` receives the
   plain form object (id present only when editing) and owns writing it
   into `patients` — this component never touches that array itself. */
export default function PazienteFormModal({ patient, si, onSave, onClose }) {
  const [form, setForm] = useState(() => (patient ? { ...patient } : { ...emptyPatient }));
  const F = (f) => setForm((p) => ({ ...p, ...f }));
  const save = () => {
    if (!form.nome || !form.cognome) return;
    onSave(form);
  };
  return (
    <Modal title={form.id ? 'Modifica paziente' : 'Nuovo paziente'} icon="pz" onClose={onClose} wide>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <Fld label="Nome"><Inp value={form.nome || ''} onChange={(e) => F({ nome: e.target.value })} /></Fld>
        <Fld label="Cognome"><Inp value={form.cognome || ''} onChange={(e) => F({ cognome: e.target.value })} /></Fld>
        <Fld label="Data nascita"><Inp type="date" value={form.dataNascita || ''} onChange={(e) => F({ dataNascita: e.target.value })} /></Fld>
        <Fld label="Codice fiscale"><Inp value={form.cf || ''} onChange={(e) => F({ cf: e.target.value.toUpperCase() })} /></Fld>
        <Fld label="Telefono"><Inp type="tel" value={form.telefono || ''} onChange={(e) => F({ telefono: e.target.value })} /></Fld>
        <Fld label="Email"><Inp type="email" value={form.email || ''} onChange={(e) => F({ email: e.target.value })} /></Fld>
      </div>
      <Fld label="Indirizzo"><Inp value={form.indirizzo || ''} onChange={(e) => F({ indirizzo: e.target.value })} /></Fld>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
        <Fld label="CAP"><Inp value={form.cap || ''} onChange={(e) => F({ cap: e.target.value })} /></Fld>
        <Fld label="Comune"><Inp value={form.comune || ''} onChange={(e) => F({ comune: e.target.value })} /></Fld>
        <Fld label="Provincia"><Inp value={form.provincia || ''} onChange={(e) => F({ provincia: e.target.value.toUpperCase().slice(0, 2) })} placeholder="es. MI" /></Fld>
      </div>
      {(!si?.regime_fiscale || si.regime_fiscale === 'sanitario_esente_art10') && (
        <div onClick={() => F({ opposizione_sts: !form.opposizione_sts })} style={{ display: 'flex', alignItems: 'center', gap: 10, background: form.opposizione_sts ? C.warL : C.bg, borderRadius: 10, padding: 10, marginTop: 8, marginBottom: 8, cursor: 'pointer' }}>
          <input type="checkbox" checked={!!form.opposizione_sts} onChange={() => {}} style={{ width: 16, height: 16 }} />
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: C.txt }}>Si oppone all'invio dei dati al Sistema Tessera Sanitaria</div>
            <div style={{ fontSize: 10, color: C.txl }}>Diritto del paziente — se attivo, questa prestazione non verrà inclusa nella trasmissione STS</div>
          </div>
        </div>
      )}
      <Fld label="Note cliniche"><Txt value={form.note || ''} onChange={(e) => F({ note: e.target.value })} /></Fld>
      <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
        <Btn ch="Annulla" v="sec" onClick={onClose} full />
        <Btn ch="Salva" onClick={save} full />
      </div>
    </Modal>
  );
}
