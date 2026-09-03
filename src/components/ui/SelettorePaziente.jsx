import React, { useState, useRef, useEffect } from 'react';
import { C } from '../../lib/utils';
import { cercaPazienti } from '../../lib/ricercaPazienti';
import Ic from './Ic.jsx';

// Riquadro "nessun risultato" con creazione rapida: precompila nome/cognome
// dal testo cercato (prima parola = nome, resto = cognome), l'utente può
// correggerli prima di confermare.
function CreaPazienteInline({ testoIniziale, onCrea }) {
  const parti = testoIniziale.trim().split(/\s+/);
  const [nome, setNome] = useState(parti[0] || '');
  const [cognome, setCognome] = useState(parti.slice(1).join(' ') || '');
  const puoCreare = nome.trim() && cognome.trim();
  return (
    <div style={{ padding: 12 }}>
      <div style={{ fontSize: 11.5, color: C.txl, marginBottom: 8 }}>Nessun paziente trovato — crea un nuovo paziente:</div>
      <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
        <input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Nome" style={{ flex: 1, minWidth: 0, border: `1px solid ${C.brd}`, borderRadius: 8, padding: '7px 9px', fontSize: 12.5, fontFamily: 'inherit', color: C.txt, background: C.bg }} />
        <input value={cognome} onChange={(e) => setCognome(e.target.value)} placeholder="Cognome" style={{ flex: 1, minWidth: 0, border: `1px solid ${C.brd}`, borderRadius: 8, padding: '7px 9px', fontSize: 12.5, fontFamily: 'inherit', color: C.txt, background: C.bg }} />
      </div>
      <button
        disabled={!puoCreare}
        onClick={() => onCrea(nome.trim(), cognome.trim())}
        style={{ width: '100%', background: puoCreare ? C.pri : C.bg, color: puoCreare ? '#fff' : C.txl, border: 'none', borderRadius: 8, padding: '9px 0', fontWeight: 700, fontSize: 12.5, cursor: puoCreare ? 'pointer' : 'not-allowed' }}
      >
        + Crea paziente
      </button>
    </div>
  );
}

/**
 * Campo di ricerca/selezione paziente riusabile, con matching tollerante
 * (ordine parole libero, refusi, accenti). Sostituisce i blocchi inline
 * duplicati in Agenda, Piani, ArchivioDocs. Mostra il paziente selezionato
 * finché non si tocca per cercarne un altro.
 *
 * onCreaPaziente (opzionale): se passato, quando la ricerca non trova nessun
 * paziente mostra un mini-form "Nome/Cognome" per crearne uno al volo invece
 * del semplice messaggio "Nessun paziente trovato". Riceve (nome, cognome) e
 * deve restituire l'id del paziente creato (sincrono).
 */
export default function SelettorePaziente({ patients, value, onChange, search, onSearchChange, placeholder = 'Cerca per nome o cognome…', maxResults = 20, autoFocus, onCreaPaziente }) {
  const sel = patients.find((p) => String(p.id) === String(value));
  const filtered = search.trim() ? cercaPazienti(patients, search) : patients;
  // Il campo, appena montato senza un paziente già selezionato, mostrava
  // subito l'elenco completo — su mobile, dentro un modale, copriva i
  // campi sotto senza un modo per chiuderlo senza scegliere qualcuno
  // (Product Owner: "deve essere anche tolto senza selezionare alcun
  // paziente perché copre altro"). L'elenco ora si apre solo quando il
  // campo ha davvero il focus (o si sta digitando), e si chiude toccando
  // altrove — il timeout lascia il tempo al click su una voce/sul
  // pulsante "crea paziente" di registrarsi prima che il blur lo nasconda.
  const [focused, setFocused] = useState(false);
  const blurTimeoutRef = useRef(null);
  const handleFocus = () => { clearTimeout(blurTimeoutRef.current); setFocused(true); };
  const handleBlur = () => { blurTimeoutRef.current = setTimeout(() => setFocused(false), 150); };
  useEffect(() => () => clearTimeout(blurTimeoutRef.current), []);
  const showDropdown = focused && (!sel || search);

  return (
    <div style={{ position: 'relative' }}>
      <div
        style={{ display: 'flex', alignItems: 'center', gap: 8, border: `1.5px solid ${sel && !search ? C.suc : C.brd}`, borderRadius: 10, padding: '10px 12px', background: C.sur, cursor: sel && !search ? 'default' : 'text' }}
        onClick={() => { if (sel && !search) onSearchChange(''); }}
      >
        {sel && !search ? (
          <>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: 14 }}>{sel.nome} {sel.cognome}</div>
              {sel.telefono && <div style={{ fontSize: 11, color: C.txl }}>{sel.telefono}</div>}
            </div>
            <button onClick={(e) => { e.stopPropagation(); onChange(''); onSearchChange(''); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.txl, padding: 0, display: 'flex' }}><Ic n="x" s={15} c={C.txl} /></button>
          </>
        ) : (
          <input
            autoFocus={autoFocus}
            value={search}
            onChange={(e) => { onSearchChange(e.target.value); if (!e.target.value) onChange(''); }}
            onFocus={handleFocus}
            onBlur={handleBlur}
            placeholder={placeholder}
            style={{ flex: 1, border: 'none', background: 'transparent', fontSize: 14, color: C.txt, outline: 'none', fontFamily: 'inherit' }}
          />
        )}
      </div>
      {showDropdown && filtered.length > 0 && (
        <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 1000, background: C.sur, border: `1.5px solid ${C.pri}`, borderRadius: 10, boxShadow: '0 8px 24px rgba(0,0,0,0.15)', marginTop: 3, maxHeight: 220, overflowY: 'auto' }}>
          {filtered.slice(0, maxResults).map((p) => (
            <div
              key={p.id}
              onClick={() => { onChange(String(p.id)); onSearchChange(''); }}
              style={{ padding: '10px 14px', cursor: 'pointer', borderBottom: `1px solid ${C.brd}` }}
              onMouseEnter={(e) => { e.currentTarget.style.background = C.priL; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
            >
              <div style={{ fontWeight: 700, fontSize: 13 }}>{p.nome} {p.cognome}</div>
              {p.telefono && <div style={{ fontSize: 11, color: C.txl }}>{p.telefono}</div>}
            </div>
          ))}
        </div>
      )}
      {focused && search.trim() && filtered.length === 0 && (
        <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 1000, background: C.sur, border: `1.5px solid ${C.brd}`, borderRadius: 10, boxShadow: '0 8px 24px rgba(0,0,0,0.1)', marginTop: 3 }}>
          {onCreaPaziente ? (
            <CreaPazienteInline
              testoIniziale={search}
              onCrea={(nome, cognome) => {
                const id = onCreaPaziente(nome, cognome);
                if (id != null) { onChange(String(id)); onSearchChange(''); }
              }}
            />
          ) : (
            <div style={{ padding: '14px', textAlign: 'center', color: C.txl, fontSize: 12.5 }}>Nessun paziente trovato</div>
          )}
        </div>
      )}
    </div>
  );
}
