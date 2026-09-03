import React, { useState } from 'react';
import { Btn, Fld, Inp, Sel, Modal, Ic, SelettorePaziente } from './ui';
import { C, fmt, fmtD, today } from '../lib/utils';
import { supabase } from '../lib/supabase.js';

const FREQUENZE = ['Mensile', 'Bimestrale', 'Trimestrale', 'Semestrale', 'Annuale'];

/* POL-UI-020: Product Owner — la nuova azione veloce "Spesa" nella scheda
   paziente "deve aggiornare sezione spese... il popup nuova spesa è lo
   stesso di spese va aggiornato se si vuole opzionalmente associarla ad
   un paziente". Estratto dal modale che prima viveva solo dentro
   Spese.jsx (stessa identica logica, invariata) così sia la pagina Spese
   sia le azioni veloci del paziente aprono LO STESSO componente — mai una
   seconda implementazione del form. L'associazione paziente è facoltativa
   (riusa SelettorePaziente, che offre già la "X" per rimuoverla). */
export default function SpesaModal({ editItem, initialPazienteId = null, patients = [], categorie, onClose, onSalvato }) {
  const [form, setForm] = useState(() => editItem ? {
    titolo: editItem.titolo, importo: String(editItem.importo), data: editItem.data, categoria: editItem.categoria || 'Altro',
    note: editItem.note || '', ricorrente: editItem.ricorrente || false, frequenza: editItem.frequenza || 'Mensile', tipo_costo: editItem.tipo_costo || 'variabile',
    haTermine: !!editItem.data_fine, n_rate: editItem.n_rate != null ? String(editItem.n_rate) : '', data_fine: editItem.data_fine || '',
    pazienteId: editItem.paziente_id != null ? String(editItem.paziente_id) : '',
  } : {
    titolo: '', importo: '', data: today(), categoria: 'Altro', note: '', ricorrente: false, frequenza: 'Mensile', tipo_costo: 'variabile',
    haTermine: false, n_rate: '', data_fine: '', pazienteId: initialPazienteId != null ? String(initialPazienteId) : '',
  });
  const F = (f) => setForm((p) => ({ ...p, ...f }));
  const [pazSearch, setPazSearch] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Calcola la data di fine a partire dal numero di rate e dalla frequenza, se n_rate è impostato
  // (l'utente può comunque sovrascrivere manualmente data_fine dopo).
  const calcolaDataFineDaRate = (dataInizio, frequenza, nRate) => {
    if (!dataInizio || !nRate || Number(nRate) <= 0) return '';
    const mesiPerRata = { Mensile: 1, Bimestrale: 2, Trimestrale: 3, Semestrale: 6, Annuale: 12 }[frequenza] || 1;
    const d = new Date(dataInizio + 'T12:00');
    d.setMonth(d.getMonth() + mesiPerRata * (Number(nRate) - 1));
    return d.toISOString().slice(0, 10);
  };

  const save = async () => {
    if (!form.titolo || !form.importo) return;
    setSaving(true); setError('');
    const record = {
      titolo: form.titolo,
      importo: Number(form.importo),
      data: form.data,
      categoria: form.categoria,
      note: form.note || '',
      ricorrente: form.ricorrente,
      frequenza: form.frequenza,
      tipo_costo: form.tipo_costo,
      data_fine: form.ricorrente && form.haTermine ? (form.data_fine || calcolaDataFineDaRate(form.data, form.frequenza, form.n_rate) || null) : null,
      n_rate: form.ricorrente && form.haTermine && form.n_rate ? Number(form.n_rate) : null,
      paziente_id: form.pazienteId ? Number(form.pazienteId) : null,
    };
    const { error: dbError } = editItem
      ? await supabase.from('spese').update(record).eq('id', editItem.id)
      : await supabase.from('spese').insert([{ ...record, id: Date.now() }]);
    setSaving(false);
    if (dbError) { setError(dbError.message); return; }
    onSalvato?.();
  };

  return (
    <Modal title={editItem ? 'Modifica spesa' : '+ Nuova spesa'} onClose={onClose}>
      <Fld label="Titolo spesa">
        <Inp value={form.titolo} onChange={e => F({ titolo: e.target.value })} placeholder="es. Materiale composito, Affitto studio..." autoFocus />
      </Fld>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <Fld label="Importo €">
          <Inp type="number" inputMode="decimal" value={form.importo} onChange={e => F({ importo: e.target.value })} placeholder="0.00" />
        </Fld>
        <Fld label="Data">
          <Inp type="date" value={form.data} onChange={e => F({ data: e.target.value })} />
        </Fld>
      </div>
      <Fld label="Categoria">
        <Sel value={form.categoria} onChange={e => {
          const cat = e.target.value;
          const categorieFisse = ['Affitto', 'Personale', 'Utenze', 'Assicurazioni', 'Software'];
          F({ categoria: cat, tipo_costo: categorieFisse.includes(cat) ? 'fisso' : 'variabile' });
        }}>
          {categorie.map(c => <option key={c}>{c}</option>)}
        </Sel>
      </Fld>

      <Fld label="Paziente (opzionale)">
        <SelettorePaziente patients={patients} value={form.pazienteId} onChange={(id) => F({ pazienteId: id })} search={pazSearch} onSearchChange={setPazSearch} placeholder="Associa a un paziente…" />
      </Fld>

      <Fld label="Tipo di costo (per il Controllo di Gestione)">
        <div style={{ display: 'flex', gap: 8 }}>
          <button type="button" onClick={() => F({ tipo_costo: 'fisso' })} style={{
            flex: 1, padding: '9px 0', borderRadius: 9, border: `1.5px solid ${form.tipo_costo === 'fisso' ? C.pri : C.brd}`,
            background: form.tipo_costo === 'fisso' ? C.priL : '#fff', color: form.tipo_costo === 'fisso' ? C.pri : C.txm,
            fontWeight: 700, fontSize: 12, cursor: 'pointer',
          }}>Fisso</button>
          <button type="button" onClick={() => F({ tipo_costo: 'variabile' })} style={{
            flex: 1, padding: '9px 0', borderRadius: 9, border: `1.5px solid ${form.tipo_costo === 'variabile' ? C.pri : C.brd}`,
            background: form.tipo_costo === 'variabile' ? C.priL : '#fff', color: form.tipo_costo === 'variabile' ? C.pri : C.txm,
            fontWeight: 700, fontSize: 12, cursor: 'pointer',
          }}>Variabile</button>
        </div>
        <div style={{ fontSize: 10, color: C.txl, marginTop: 4, lineHeight: 1.5 }}>
          <b>Fisso</b>: lo paghi comunque, indipendentemente da quanti pazienti curi (affitto, personale, utenze, assicurazioni, software, rate di macchinari). <b>Variabile</b>: dipende da quanto lavori (materiali, laboratorio esterno, provvigioni). Distinguerli bene serve a calcolare correttamente margine ed EBITDA in Controllo di Gestione.
        </div>
      </Fld>

      {/* Toggle ricorrente */}
      <div style={{ background: form.ricorrente ? '#FEF3E2' : C.bg, borderRadius: 10, padding: 12, marginBottom: 10, border: `1px solid ${form.ricorrente ? C.war : C.brd}` }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: form.ricorrente ? 10 : 0 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: form.ricorrente ? C.war : C.txt, display: 'flex', alignItems: 'center', gap: 6 }}><Ic n="refresh" s={12} c={form.ricorrente ? C.war : C.txt} />Spesa ricorrente/fissa</span>
          <button onClick={() => F({ ricorrente: !form.ricorrente })} style={{ width: 44, height: 24, borderRadius: 12, background: form.ricorrente ? C.war : C.brd, border: 'none', cursor: 'pointer', position: 'relative' }}>
            <div style={{ width: 18, height: 18, borderRadius: '50%', background: '#fff', position: 'absolute', top: 3, left: form.ricorrente ? 23 : 3, transition: 'left 0.2s' }} />
          </button>
        </div>
        {form.ricorrente && (
          <>
            <Fld label="Frequenza">
              <Sel value={form.frequenza} onChange={e => F({ frequenza: e.target.value })}>
                {FREQUENZE.map(f => <option key={f}>{f}</option>)}
              </Sel>
            </Fld>

            <div style={{ display: 'flex', gap: 6, marginBottom: form.haTermine ? 10 : 0 }}>
              <button type="button" onClick={() => F({ haTermine: false, n_rate: '', data_fine: '' })} style={{
                flex: 1, padding: '8px 0', borderRadius: 8, border: `1.5px solid ${!form.haTermine ? C.war : C.brd}`,
                background: !form.haTermine ? '#fff' : 'transparent', color: !form.haTermine ? C.war : C.txm,
                fontWeight: 700, fontSize: 12, cursor: 'pointer',
              }}>Senza fine</button>
              <button type="button" onClick={() => F({ haTermine: true })} style={{
                flex: 1, padding: '8px 0', borderRadius: 8, border: `1.5px solid ${form.haTermine ? C.war : C.brd}`,
                background: form.haTermine ? '#fff' : 'transparent', color: form.haTermine ? C.war : C.txm,
                fontWeight: 700, fontSize: 12, cursor: 'pointer',
              }}>A termine (rate)</button>
            </div>

            {form.haTermine && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <Fld label="Numero di rate">
                  <Inp type="number" inputMode="numeric" value={form.n_rate}
                    onChange={e => F({ n_rate: e.target.value, data_fine: calcolaDataFineDaRate(form.data, form.frequenza, e.target.value) })}
                    placeholder="es. 12" />
                </Fld>
                <Fld label="Data fine (calcolata, modificabile)">
                  <Inp type="date" value={form.data_fine} onChange={e => F({ data_fine: e.target.value })} />
                </Fld>
                {form.data_fine && (
                  <div style={{ fontSize: 11, color: C.txl }}>Ultima rata proiettata: {fmtD(form.data_fine)}</div>
                )}
              </div>
            )}
          </>
        )}
      </div>

      <Fld label="Note (opzionale)">
        <Inp value={form.note} onChange={e => F({ note: e.target.value })} placeholder="es. Fattura n.123, fornitore X..." />
      </Fld>

      {form.importo && form.ricorrente && (
        <div style={{ background: C.danL, borderRadius: 9, padding: '8px 12px', marginBottom: 10 }}>
          <div style={{ fontSize: 12, color: C.dan, fontWeight: 700 }}>
            Proiezione annuale: {fmt(Number(form.importo) * ({ Mensile: 12, Bimestrale: 6, Trimestrale: 4, Semestrale: 2, Annuale: 1 }[form.frequenza] || 12))}
          </div>
        </div>
      )}

      {error && <div role="alert" style={{ color: C.dan, fontSize: 12, marginBottom: 8 }}>Errore: {error}</div>}

      <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
        <Btn ch="Annulla" v="sec" onClick={onClose} full />
        <Btn ch={saving ? 'Salvataggio…' : (editItem ? 'Aggiorna' : 'Salva')} onClick={save} dis={!form.titolo || !form.importo || saving} full />
      </div>
    </Modal>
  );
}
