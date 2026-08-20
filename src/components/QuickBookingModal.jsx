import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase.js';
import { Modal, Fld, Btn } from './ui';
import { Inp, Sel, Txt } from './ui/inputs.jsx';
import { C, uid, today, DEF_AGENDA_SETTINGS } from '../lib/utils';
import { computeFreeSlots } from '../lib/agendaSlots.js';

/* POL-UX-001 — Quick Booking: opens directly from Home ("+ Nuovo
   appuntamento") instead of forcing a detour through Agenda. Writes through
   the SAME `setAppointments` sync setter Agenda.jsx uses (App.jsx's
   makeSyncSetter), so this is one more entry point into the existing
   agenda data, not a second agenda. Free slots come only from
   computeFreeSlots (real appointments/impegni/agenda_settings) — never
   invented. */
export default function QuickBookingModal({ patients, appTypes, appointments, impegni = [], si, features, setAppointments, onClose, initialPazienteId = null, onBooked }) {
  const agSet = { ...DEF_AGENDA_SETTINGS, ...(si?.agenda_settings || {}) };
  const [query, setQuery] = useState('');
  const [pazienteId, setPazienteId] = useState(initialPazienteId ? String(initialPazienteId) : '');
  const [tipoId, setTipoId] = useState(appTypes?.[0]?.id ? String(appTypes[0].id) : '');
  const [data, setData] = useState(today());
  const [durata, setDurata] = useState(agSet.durataDefault);
  const [ora, setOra] = useState('');
  const [operatoreId, setOperatoreId] = useState('');
  const [poltronaId, setPoltronaId] = useState('');
  const [note, setNote] = useState('');
  const [operatori, setOperatori] = useState([]);
  const [poltrone, setPoltrone] = useState([]);
  const [saving, setSaving] = useState(false);
  const [errore, setErrore] = useState('');

  useEffect(() => {
    if (!features?.multi_operatore || !si?.studio_id) return;
    supabase.from('operatori').select('*').eq('studio_id', si.studio_id).eq('attivo', true).order('created_at').then(({ data: rows }) => setOperatori(rows || []));
    supabase.from('poltrone').select('*').eq('studio_id', si.studio_id).eq('attivo', true).order('created_at').then(({ data: rows }) => setPoltrone(rows || []));
  }, [features?.multi_operatore, si?.studio_id]);

  const selectedPaziente = useMemo(() => patients.find((p) => String(p.id) === pazienteId), [patients, pazienteId]);
  const risultatiRicerca = useMemo(() => {
    if (!query.trim() || selectedPaziente) return [];
    const q = query.trim().toLowerCase();
    return patients.filter((p) => `${p.nome} ${p.cognome}`.toLowerCase().includes(q)).slice(0, 8);
  }, [query, patients, selectedPaziente]);

  const freeSlots = useMemo(() => computeFreeSlots({
    data, durata, operatoreId: operatoreId || null, appointments, impegni, agendaSettings: agSet,
  }), [data, durata, operatoreId, appointments, impegni, agSet]);

  useEffect(() => {
    if (ora && !freeSlots.some((s) => s.ora === ora)) setOra('');
    if (!ora && freeSlots.length) setOra(freeSlots[0].ora);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [freeSlots]);

  const tipo = appTypes.find((t) => String(t.id) === tipoId);

  const salva = async () => {
    if (!pazienteId) { setErrore('Seleziona un paziente'); return; }
    if (!ora) { setErrore('Nessuno slot libero selezionato'); return; }
    setSaving(true); setErrore('');
    try {
      const nuovo = {
        id: uid(),
        pazienteId: Number(pazienteId),
        data, ora, durata: Number(durata),
        tipo: tipo?.nome || 'Appuntamento',
        colore: tipo?.colore || C.pri,
        note, stato: 'confermato',
        operatoreId: operatoreId ? Number(operatoreId) : null,
        poltronaId: poltronaId ? Number(poltronaId) : null,
      };
      setAppointments((prev) => [...prev, nuovo]);
      onBooked && onBooked(nuovo);
      onClose();
    } catch (e) {
      setErrore(e?.message || 'Salvataggio non riuscito');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title={<>📅 Nuovo appuntamento</>} onClose={onClose}>
      <Fld label="Paziente">
        {selectedPaziente ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '9px 12px', border: `1px solid ${C.brd}`, borderRadius: 9, background: C.bg }}>
            <span style={{ fontWeight: 700, fontSize: 13 }}>{selectedPaziente.nome} {selectedPaziente.cognome}</span>
            <button type="button" onClick={() => { setPazienteId(''); setQuery(''); }} style={{ background: 'none', border: 'none', color: C.pri, fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>Cambia</button>
          </div>
        ) : (
          <>
            <Inp value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Cerca per nome o cognome…" autoFocus />
            {risultatiRicerca.length > 0 && (
              <div style={{ marginTop: 6, border: `1px solid ${C.brd}`, borderRadius: 9, overflow: 'hidden' }}>
                {risultatiRicerca.map((p) => (
                  <div key={p.id} onClick={() => { setPazienteId(String(p.id)); setQuery(''); }} style={{ padding: '9px 12px', cursor: 'pointer', fontSize: 13, borderBottom: `1px solid ${C.brd}`, minHeight: 44, display: 'flex', alignItems: 'center' }}>
                    {p.nome} {p.cognome}
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </Fld>

      <Fld label="Prestazione">
        <Sel value={tipoId} onChange={(e) => setTipoId(e.target.value)}>
          {appTypes.map((t) => <option key={t.id} value={t.id}>{t.nome}</option>)}
        </Sel>
      </Fld>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <Fld label="Data">
          <Inp type="date" value={data} min={today()} onChange={(e) => setData(e.target.value)} />
        </Fld>
        <Fld label="Durata (min)">
          <Inp type="number" min={agSet.slotMin} step={agSet.slotMin} value={durata} onChange={(e) => setDurata(e.target.value)} />
        </Fld>
      </div>

      {features?.multi_operatore && operatori.length > 0 && (
        <Fld label="Operatore">
          <Sel value={operatoreId} onChange={(e) => setOperatoreId(e.target.value)}>
            <option value="">Chiunque sia libero</option>
            {operatori.map((o) => <option key={o.id} value={o.id}>{o.nome}</option>)}
          </Sel>
        </Fld>
      )}
      {features?.multi_operatore && poltrone.length > 0 && (
        <Fld label="Poltrona / stanza">
          <Sel value={poltronaId} onChange={(e) => setPoltronaId(e.target.value)}>
            <option value="">Nessuna preferenza</option>
            {poltrone.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
          </Sel>
        </Fld>
      )}

      <Fld label={`Orario — ${freeSlots.length} slot liberi`}>
        {freeSlots.length === 0 ? (
          <div style={{ fontSize: 12, color: C.txl, padding: '9px 0' }}>Nessuno slot libero per questa data. Prova un altro giorno o riduci la durata.</div>
        ) : (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, maxHeight: 160, overflowY: 'auto' }}>
            {freeSlots.map((s) => (
              <button key={s.ora} type="button" onClick={() => setOra(s.ora)}
                style={{ minWidth: 64, minHeight: 44, padding: '0 10px', borderRadius: 9, border: `1px solid ${ora === s.ora ? C.pri : C.brd}`, background: ora === s.ora ? C.pri : '#fff', color: ora === s.ora ? '#fff' : C.txt, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
                {s.ora}
              </button>
            ))}
          </div>
        )}
      </Fld>

      <Fld label="Note">
        <Txt value={note} onChange={(e) => setNote(e.target.value)} placeholder="Facoltativo" />
      </Fld>

      {errore && <div role="alert" style={{ color: C.dan, fontSize: 12, fontWeight: 700, marginBottom: 10 }}>{errore}</div>}

      <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
        <Btn ch="Annulla" v="sec" onClick={onClose} full />
        <Btn ch={saving ? 'Salvataggio…' : 'Conferma appuntamento'} onClick={salva} dis={saving || !pazienteId || !ora} full />
      </div>
    </Modal>
  );
}
