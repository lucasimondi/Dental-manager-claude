import React, { useRef, useState } from 'react';
import { C, uid } from '../lib/utils';
import { SelettorePaziente, Toast } from './ui';

const DocMedico = React.lazy(() => import('./DocMedico.jsx'));

/* POLIEDRON-RICETTA (PO 2026-11-11: "il tasto ricetta crea deve essere immediato e completo …
   dobbiamo aprire con il tasto ricetta il form per la ricetta"). La ricetta completa (DocMedico,
   tab Ricetta) si apre subito, con in testa la card «Paziente»: ricerca tra i pazienti dello
   studio, oppure creazione al volo con nome e cognome + «Salva paziente». Stesso schema della
   Home (Dashboard), estratto qui per usarlo anche dal tasto Ricetta di Poliedron. */
export default function RicettaConRicerca({
  patients = [], setPatients, si, features, onClose,
  initialPazienteId = '', onPazienteChange, initialPrefill, requestId, onToast,
}) {
  const [search, setSearch] = useState('');
  const [pazienteId, setPazienteIdState] = useState(initialPazienteId ? String(initialPazienteId) : '');
  const [toast, setToast] = useState('');
  const mostra = (msg) => (onToast ? onToast(msg) : setToast(msg));
  // SelettorePaziente chiama onChange(id) subito dopo onCreaPaziente, prima che il nuovo
  // paziente sia arrivato in `patients`: lo teniamo qui per usarlo subito.
  const appenaCreato = useRef(null);
  const setPazienteId = (id) => {
    const v = id ? String(id) : '';
    setPazienteIdState(v);
    onPazienteChange?.(v);
  };
  const limitePazienti = features?.max_pazienti ?? null;
  const creaPaziente = (nome, cognome) => {
    if (!setPatients) return null;
    if (limitePazienti != null && patients.length >= limitePazienti) {
      mostra(`Hai raggiunto il limite di ${limitePazienti} pazienti del tuo piano.`);
      return null;
    }
    const id = uid();
    const nuovo = { nome, cognome, dataNascita: '', telefono: '', email: '', cf: '', indirizzo: '', cap: '', comune: '', provincia: '', opposizione_sts: false, note: '', id };
    appenaCreato.current = nuovo;
    setPatients((p) => [...p, nuovo]);
    mostra(`Paziente ${nome} ${cognome} creato ✓`);
    return id;
  };
  const paz = !pazienteId ? null
    : (patients.find((p) => String(p.id) === String(pazienteId))
      || (appenaCreato.current && String(appenaCreato.current.id) === String(pazienteId) ? appenaCreato.current : null));

  return (
    <>
      <React.Suspense fallback={<div role="status" style={{ position: 'fixed', inset: 0, zIndex: 9999, background: C.bg, padding: 24 }}>Caricamento editor ricetta…</div>}>
        <DocMedico
          paz={paz}
          si={si}
          initialType="ricetta"
          initialPrefill={initialPrefill}
          requestId={requestId}
          onClose={() => { appenaCreato.current = null; onClose?.(); }}
          pazienteSelector={(
            <SelettorePaziente
              patients={patients}
              value={pazienteId}
              onChange={setPazienteId}
              search={search}
              onSearchChange={setSearch}
              placeholder="Cerca paziente, o scrivi nome e cognome per crearne uno nuovo…"
              onCreaPaziente={setPatients ? creaPaziente : undefined}
              creaLabel="Salva paziente"
            />
          )}
        />
      </React.Suspense>
      {!onToast && toast && <Toast msg={toast} onDone={() => setToast('')} />}
    </>
  );
}
