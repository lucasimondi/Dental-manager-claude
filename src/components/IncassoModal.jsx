import React, { useState } from 'react';
import { Btn, Fld, Inp, Modal, Sel, SelettorePaziente } from './ui';
import { uid } from '../lib/utils';
import { planAssignmentForPatient } from '../lib/domain/incassiActions.js';

const today = () => new Date().toISOString().slice(0, 10);

/* POL-FIN-007: the exact "Registra incasso" flow already shipped in
   Incassi.jsx (POL-FIN-004/005), extracted so the Piani/SchedaPaz "Piano
   di cura" buttons can open the SAME modal — prefilled with a plan's or a
   prestazione's own amount, editable — instead of a second, parallel
   incasso form. Incassi.jsx itself now renders this component too; nothing
   about the resulting payments row (piano_id, stato:'pagato') changed. */
export default function IncassoModal({ prefill, patients = [], plans = [], setPayments, onClose, onSaved }) {
  const [state, setState] = useState(() => ({ pazienteId: '', pianoId: '', lockedPianoId: null, data: today(), importo: '', metodo: 'Contanti', nota: '', ...prefill }));
  const [error, setError] = useState('');
  const [pazSearch, setPazSearch] = useState('');

  const update = (patch) => setState((current) => ({ ...current, ...patch }));
  const assignment = state.pazienteId ? planAssignmentForPatient(plans, state.pazienteId) : { mode: 'none' };
  const needsPlanChoice = !state.lockedPianoId && assignment.mode === 'choose';

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
