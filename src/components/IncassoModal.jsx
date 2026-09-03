import React, { useState } from 'react';
import { Btn, Fld, Inp, Modal, Sel, SelettorePaziente } from './ui';
import { fmt, uid } from '../lib/utils';
import { planAssignmentForPatient } from '../lib/domain/incassiActions.js';

const today = () => new Date().toISOString().slice(0, 10);

/* POL-FIN-007: the exact "Registra incasso" flow already shipped in
   Incassi.jsx (POL-FIN-004/005), extracted so the Piani/SchedaPaz "Piano
   di cura" buttons can open the SAME modal — prefilled with a plan's or a
   prestazione's own amount, editable — instead of a second, parallel
   incasso form. Incassi.jsx itself now renders this component too; nothing
   about the resulting payments row (piano_id, stato:'pagato') changed. */
export default function IncassoModal({ prefill, patients = [], plans = [], setPayments, onClose, onSaved }) {
  // POL-FIN-007e: pianoContext is informational only (atteso/già pagato on
  // the locked plan, computed by the caller) — kept out of editable form
  // state so it can't be silently sent as a payment field.
  const { pianoContext, ...formPrefill } = prefill || {};
  const [state, setState] = useState(() => ({ pazienteId: '', pianoId: '', lockedPianoId: null, data: today(), importo: '', metodo: 'Contanti', nota: '', ...formPrefill }));
  const [error, setError] = useState('');
  const [pazSearch, setPazSearch] = useState('');

  const update = (patch) => setState((current) => ({ ...current, ...patch }));
  const assignment = state.pazienteId ? planAssignmentForPatient(plans, state.pazienteId) : { mode: 'none' };
  const needsPlanChoice = !state.lockedPianoId && assignment.mode === 'choose';

  // POL-UI-020: Product Owner — in Pagamenti del paziente, "Registra
  // pagamento" deve offrire l'opzione di associarlo a prestazione E piano.
  // Il piano è già gestito sopra (bloccato, auto-assegnato, o scelto qui);
  // una volta noto, se ha prestazioni si può opzionalmente indicare
  // quale — riusa lo stesso pattern già in PianoDrillDown (nota = nome
  // della prestazione), non una seconda associazione strutturata.
  const resolvedPianoId = state.lockedPianoId != null ? state.lockedPianoId
    : assignment.mode === 'auto' ? assignment.pianoId
    : assignment.mode === 'choose' && state.pianoId ? Number(state.pianoId) : null;
  const resolvedPlan = resolvedPianoId != null ? plans.find((p) => String(p.id) === String(resolvedPianoId)) : null;

  const save = () => {
    const amount = Number(state.importo);
    if (!state.pazienteId || !Number.isFinite(amount) || amount <= 0) {
      setError('Seleziona il paziente e inserisci un importo valido.'); return;
    }
    if (needsPlanChoice && !state.pianoId) { setError('Seleziona il piano a cui collegare l’incasso.'); return; }
    const pianoId = state.lockedPianoId != null ? state.lockedPianoId
      : assignment.mode === 'auto' ? assignment.pianoId
      : assignment.mode === 'choose' ? Number(state.pianoId) : undefined;
    setPayments?.((current) => [...current, {
      id: uid(), pazienteId: Number(state.pazienteId), data: state.data || today(),
      importo: amount, metodo: state.metodo, nota: state.nota || undefined, stato: 'pagato',
      ...(pianoId !== undefined && pianoId !== null ? { pianoId } : {}),
    }]);
    onSaved?.();
    onClose?.();
  };

  return (
    <Modal title="Registra incasso" icon="eur" onClose={onClose} mobileVariant="sheet">
      {!state.lockedPianoId && (
        <Fld label="Paziente"><SelettorePaziente patients={patients} value={state.pazienteId} onChange={(pazienteId) => update({ pazienteId, pianoId: '' })} search={pazSearch} onSearchChange={setPazSearch} autoFocus /></Fld>
      )}
      {needsPlanChoice && (
        <Fld label="Piano">
          <Sel value={state.pianoId} onChange={(event) => update({ pianoId: event.target.value })}>
            <option value="">Seleziona piano…</option>
            {assignment.options.map((plan) => <option key={plan.id} value={plan.id}>{plan.titolo}</option>)}
          </Sel>
        </Fld>
      )}
      {resolvedPlan?.voci?.length > 0 && (
        <Fld label="Prestazione (opzionale)">
          <Sel value={state.prestazioneIndex ?? ''} onChange={(event) => {
            const idx = event.target.value;
            if (idx === '') { update({ prestazioneIndex: idx }); return; }
            const voce = resolvedPlan.voci[Number(idx)];
            update({ prestazioneIndex: idx, nota: voce.prestazione, importo: state.importo || String(voce.prezzo || '') });
          }}>
            <option value="">Nessuna specifica — incasso generico sul piano</option>
            {resolvedPlan.voci.map((v, i) => <option key={i} value={i}>{v.prestazione}{v.dente ? ` (d.${v.dente})` : ''} — {fmt(v.prezzo)}</option>)}
          </Sel>
        </Fld>
      )}
      {pianoContext && (() => {
        const residuo = pianoContext.atteso - pianoContext.giaPagato;
        const saldato = residuo <= 0;
        return (
          <div style={{ background: saldato ? '#FEF3C7' : '#F1F5F9', border: `1px solid ${saldato ? '#F59E0B' : '#E2E8F0'}`, borderRadius: 8, padding: '8px 10px', marginBottom: 10, fontSize: 12 }}>
            <div style={{ color: '#334155' }}>Piano: atteso {fmt(pianoContext.atteso)} · già incassato {fmt(pianoContext.giaPagato)}{!saldato && <> · residuo {fmt(residuo)}</>}</div>
            {saldato && (
              <div style={{ color: '#92400E', fontWeight: 700, marginTop: 3 }}>
                ⚠️ Il piano risulta già saldato{residuo < 0 ? ` (in credito di ${fmt(-residuo)})` : ''} — registrando questo incasso andrà ulteriormente in credito.
              </div>
            )}
          </div>
        );
      })()}
      <div className="incassi-form-grid">
        <Fld label="Data"><Inp type="date" value={state.data} onChange={(event) => update({ data: event.target.value })} /></Fld>
        <Fld label="Importo €"><Inp type="number" min="0" step="0.01" inputMode="decimal" value={state.importo} onChange={(event) => update({ importo: event.target.value })} /></Fld>
        <Fld label="Metodo">
          <Sel value={state.metodo} onChange={(event) => update({ metodo: event.target.value })}>
            {['Contanti', 'Carta', 'Bonifico', 'POS', 'Assegno'].map((method) => <option key={method}>{method}</option>)}
          </Sel>
        </Fld>
        <Fld label="Nota"><Inp value={state.nota} onChange={(event) => update({ nota: event.target.value })} /></Fld>
      </div>
      {error && <p className="incassi-form-error" role="alert">{error}</p>}
      <div className="incassi-form-actions"><Btn ch="Annulla" v="sec" onClick={onClose} full /><Btn ch="Salva" onClick={save} full /></div>
    </Modal>
  );
}
