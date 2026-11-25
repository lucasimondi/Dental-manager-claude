import React, { useRef, useState } from 'react';
import { supabase } from '../lib/supabase.js';
import { preventiviEmessiPiano } from '../lib/preventivi.js';
import { giaPreventivate, messaggioGiaPreventivate, messaggioPreventiviNonValidi, preventiviResiNonValidi } from '../lib/domain/preventivoValidita.js';

/* PREVENTIVI-LINEARI (PO 2026-11-25): «se poi modifico una prestazione deve segnalarmi che è già
   stata preventivata quindi il preventivo precedente perde di validità». Prima di salvare una voce
   cambiata (o tolta, o una voce nuova) si controlla: (1) i preventivi già preparati per quel piano
   che diventerebbero non validi; (2) la stessa cura già preventivata e non eseguita. Se c'è qualcosa
   l'avviso resta nella pagina (window.confirm nell'app Android risponde sempre «no») con
   «Salva comunque» / «Annulla»; altrimenti si salva subito. */
export function useAvvisoPreventivo(client) {
  client = client || supabase;
  const [avviso, setAvviso] = useState(null);
  const turno = useRef(0);
  const chiedi = async ({ chiave = '', prima, dopo, applica, plans = [], pazienteId, nuove = [], escludi = [] }) => {
    const mio = ++turno.current;
    const messaggi = [];
    if (nuove.length) messaggi.push(messaggioGiaPreventivate(giaPreventivate(plans, pazienteId, nuove, { escludi })));
    if (prima?.id != null && dopo) {
      try { messaggi.push(messaggioPreventiviNonValidi(preventiviResiNonValidi(await preventiviEmessiPiano(client, prima.id), prima, dopo))); }
      catch { messaggi.push('Non riesco a controllare se questa voce è già in un preventivo preparato per il paziente.'); }
    }
    if (mio !== turno.current) return;
    const testo = messaggi.filter(Boolean).join('\n\n');
    if (!testo) { setAvviso(null); applica(); return; }
    setAvviso({ chiave, testo, applica });
  };
  const conferma = () => { const a = avviso; setAvviso(null); a?.applica(); };
  const annulla = () => { turno.current++; setAvviso(null); };
  return { avviso, chiedi, conferma, annulla };
}

export default function AvvisoPreventivo({ avviso, chiave, onConferma, onAnnulla }) {
  if (!avviso || (chiave !== undefined && avviso.chiave !== chiave)) return null;
  return <div role="alertdialog" aria-label="Prestazione già preventivata" style={{ margin: '8px 0', padding: '10px 12px', borderRadius: 10, background: 'var(--avviso-prev-bg, #fff4e5)', color: 'var(--avviso-prev-fg, #7a4300)', border: '1px solid var(--avviso-prev-brd, #f0c27a)', fontSize: 12.5, lineHeight: 1.4 }}>
    <div style={{ whiteSpace: 'pre-line', fontWeight: 600 }}>{avviso.testo}</div>
    <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
      <button type="button" onClick={onConferma} style={{ padding: '7px 12px', borderRadius: 8, border: 'none', background: '#b45309', color: '#fff', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>Salva comunque</button>
      <button type="button" onClick={onAnnulla} style={{ padding: '7px 12px', borderRadius: 8, border: '1px solid currentColor', background: 'transparent', color: 'inherit', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>Annulla</button>
    </div>
  </div>;
}
