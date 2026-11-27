// NAVIGAZIONE N4 (PO 2026-11-27, mockup "Navigazione · Agenda → Personale ⇄ Studio", scelta "N4"): interruttore in cima
// alle Home del telefono di Studio e di Personale. Un tocco sull'altro spazio e ci si passa; quello attivo è evidenziato.
// Stessi link che le due app usano già per passare dall'una all'altra (APP-UNICA): nessuna navigazione nuova.
import React from 'react';
import './interruttoreSpazio.css';

const DENTE = '<path d="M15 5c-6 0-9 4.7-9 11 0 8 3.8 11 5.2 19S13.4 46 17 46s3.6-11 7-11 3.4 11 7 11 4.4-3 5.8-11S42 24 42 16c0-6.3-3-11-9-11-4.4 0-6 2.5-9 2.5S19.4 5 15 5z" fill="#fff" stroke="#038387" stroke-width="2.4"/>';
const PERSONA = '<circle cx="24" cy="24" r="20" fill="#DCEBFA"/><circle cx="24" cy="19" r="7.5" fill="#0F6CBD"/><path d="M10.5 38a14 14 0 0 1 27 0A19.9 19.9 0 0 1 24 44c-5.2 0-9.9-2.2-13.5-6z" fill="#0F6CBD"/>';
const Disegno = ({ d }) => <svg viewBox="0 0 48 48" width="22" height="22" aria-hidden="true" focusable="false" style={{ fill: '#000', stroke: 'none' }} dangerouslySetInnerHTML={{ __html: d }} />;

export default function InterruttoreSpazio({ attivo, onStudio, onPersonale }) {
  const voci = [['studio', 'Studio', DENTE, onStudio], ['personale', 'Personale', PERSONA, onPersonale]];
  return (
    <div className="spz" role="group" aria-label="Spazio">
      {voci.map(([id, nome, d, fai]) => (
        <button key={id} type="button" className={`spz-voce${attivo === id ? ' spz-attivo' : ''}`} aria-pressed={attivo === id}
          aria-label={attivo === id ? `${nome}, sei qui` : `Passa a ${nome}`} onClick={() => { if (attivo !== id) fai?.(); }}>
          <Disegno d={d} /><span>{nome}</span>
        </button>
      ))}
    </div>
  );
}
