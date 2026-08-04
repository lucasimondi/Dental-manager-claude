import React from 'react';
import { C } from '../../lib/utils';
import { cercaPazienti } from '../../lib/ricercaPazienti';

/**
 * Campo di ricerca/selezione paziente riusabile, con matching tollerante
 * (ordine parole libero, refusi, accenti). Sostituisce i blocchi inline
 * duplicati in Agenda, Piani, ArchivioDocs. Mostra il paziente selezionato
 * finché non si tocca per cercarne un altro.
 */
export default function SelettorePaziente({ patients, value, onChange, search, onSearchChange, placeholder = 'Cerca per nome o cognome…', maxResults = 20, autoFocus }) {
  const sel = patients.find((p) => String(p.id) === String(value));
  const filtered = search.trim() ? cercaPazienti(patients, search) : patients;

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
            <button onClick={(e) => { e.stopPropagation(); onChange(''); onSearchChange(''); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.txl, fontSize: 18, padding: 0 }}>✕</button>
          </>
        ) : (
          <input
            autoFocus={autoFocus}
            value={search}
            onChange={(e) => { onSearchChange(e.target.value); if (!e.target.value) onChange(''); }}
            placeholder={placeholder}
            style={{ flex: 1, border: 'none', background: 'transparent', fontSize: 14, color: C.txt, outline: 'none', fontFamily: 'inherit' }}
          />
        )}
      </div>
      {(!sel || search) && filtered.length > 0 && (
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
      {search.trim() && filtered.length === 0 && (
        <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 1000, background: C.sur, border: `1.5px solid ${C.brd}`, borderRadius: 10, boxShadow: '0 8px 24px rgba(0,0,0,0.1)', marginTop: 3, padding: '14px', textAlign: 'center', color: C.txl, fontSize: 12.5 }}>
          Nessun paziente trovato
        </div>
      )}
    </div>
  );
}
