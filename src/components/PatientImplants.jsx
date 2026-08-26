import React, { useState } from 'react';
import { Btn, Crd, Fld, Inp, Modal } from './ui';
import { C, fmtD, today } from '../lib/utils';

const emptyImplant = () => ({ dente: '', marca: '', modello: '', lotto: '', diametro: '', lunghezza: '', dataInserimento: today(), dataCorona: '', noteCorona: '' });

export default function PatientImplants({ patientId, implants = [], setImplants }) {
  const rows = implants.filter((item) => item.pazienteId === patientId).sort((a, b) => String(b.dataInserimento || '').localeCompare(String(a.dataInserimento || '')));
  const [form, setForm] = useState(null);
  const save = () => {
    if (!setImplants) return;
    setImplants((current) => form.id
      ? current.map((item) => item.id === form.id ? { ...form, pazienteId: patientId } : item)
      : [...current, { ...form, id: Date.now() + Math.floor(Math.random() * 9999), pazienteId: patientId }]);
    setForm(null);
  };
  return <div>
    <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}><Btn ch="Nuovo impianto" onClick={() => setForm(emptyImplant())} /></div>
    {rows.length === 0 && <Crd><div style={{ textAlign: 'center', color: C.txm }}>Nessun impianto registrato.</div></Crd>}
    {rows.map((item) => <Crd key={item.id} style={{ marginBottom: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}><div><strong>Dente {item.dente || '—'}</strong><div style={{ fontSize: 11, color: C.txm }}>Inserito: {fmtD(item.dataInserimento)}</div></div><div style={{ display: 'flex', gap: 6 }}><Btn ch="Modifica" v="sec" sz="sm" onClick={() => setForm({ ...item })} /><Btn ch="Elimina" v="dan" sz="sm" onClick={() => window.confirm('Eliminare questo impianto?') && setImplants?.((current) => current.filter((row) => row.id !== item.id))} /></div></div>
      <div style={{ marginTop: 10, background: C.bg, borderRadius: 8, padding: 9, fontSize: 12 }}>Marca: {item.marca || '—'} · Modello: {item.modello || '—'} · Lotto: {item.lotto || '—'}<br />Diametro: {item.diametro || '—'} · Lunghezza: {item.lunghezza || '—'}<br />Corona prevista: {fmtD(item.dataCorona) || '—'} {item.noteCorona ? `· ${item.noteCorona}` : ''}</div>
    </Crd>)}
    {form && <Modal title={form.id ? 'Modifica impianto' : 'Nuovo impianto'} onClose={() => setForm(null)} wide>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: 10 }}>
        {[['dente','Dente','text'],['dataInserimento','Data inserimento','date'],['marca','Marca','text'],['modello','Modello','text'],['lotto','Lotto / N° serie','text'],['diametro','Diametro','text'],['lunghezza','Lunghezza','text'],['dataCorona','Data corona prevista','date'],['noteCorona','Note corona','text']].map(([key,label,type]) => <Fld key={key} label={label}><Inp type={type} value={form[key] || ''} onChange={(event) => setForm((current) => ({ ...current, [key]: event.target.value }))} /></Fld>)}
      </div>
      <div style={{ display: 'flex', gap: 8, marginTop: 10 }}><Btn ch="Annulla" v="sec" onClick={() => setForm(null)} full /><Btn ch="Salva impianto" onClick={save} full /></div>
    </Modal>}
  </div>;
}
