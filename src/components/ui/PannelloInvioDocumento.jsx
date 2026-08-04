import React, { useState } from 'react';
import { C } from '../../lib/utils';
import Btn from './Btn.jsx';
import { condividiPdf, scaricaPdf, inviaAlPaziente } from '../../lib/condivisionePdf';

/**
 * Pannello azioni dopo la generazione di un documento: un pulsante unico
 * "Invia documento" apre un piccolo menu con le destinazioni disponibili.
 * Oggi copre "il paziente" (se ha un telefono) e "altro contatto/email"
 * (picker di sistema generico). È il punto pensato per crescere in futuro
 * con una vera rubrica di destinatari (altri medici, curanti, ecc.) — quel
 * giorno basterà aggiungere altre righe a `destinatari` sotto, senza
 * toccare il resto del pannello.
 */
export default function PannelloInvioDocumento({ pronto, paziente, archiviato, onChiudi, onNuovoDocumento }) {
  const [menuAperto, setMenuAperto] = useState(false);
  const [stato, setStato] = useState('');

  const inviaGenerico = async () => {
    setMenuAperto(false);
    setStato('Apertura condivisione…');
    const ok = await condividiPdf(pronto.dataUrl, pronto.filename);
    setStato(ok ? '' : 'Condivisione non disponibile su questo dispositivo — usa Scarica qui sotto.');
  };

  const inviaPaziente = async () => {
    setMenuAperto(false);
    setStato('Apertura chat WhatsApp…');
    const ok = await inviaAlPaziente(paziente?.telefono, pronto.dataUrl, pronto.filename);
    setStato(ok ? 'Chat aperta — allega il PDF dal picker di condivisione comparso, scegliendo WhatsApp.' : 'Il paziente non ha un numero di telefono salvato.');
  };

  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ background: C.sucL, border: `1px solid ${C.suc}`, borderRadius: 10, padding: '11px 14px', marginBottom: 12, textAlign: 'center' }}>
        <div style={{ fontWeight: 700, color: C.suc }}>✓ {pronto.titolo} pronto</div>
        {archiviato && <div style={{ fontSize: 11, color: C.txm, marginTop: 3 }}>Salvato anche in archivio, scheda paziente</div>}
      </div>

      <div style={{ position: 'relative' }}>
        <Btn ch="📤 Invia documento" onClick={() => setMenuAperto((v) => !v)} full />
        {menuAperto && (
          <>
            <div onClick={() => setMenuAperto(false)} style={{ position: 'fixed', inset: 0, zIndex: 998 }} />
            <div style={{
              position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 6, zIndex: 999,
              background: C.sur, border: `1.5px solid ${C.brd}`, borderRadius: 12, boxShadow: '0 8px 24px rgba(0,0,0,0.15)', overflow: 'hidden',
            }}>
              {paziente?.telefono && (
                <button
                  onClick={inviaPaziente}
                  style={{ width: '100%', textAlign: 'left', padding: '13px 16px', background: 'none', border: 'none', borderBottom: `1px solid ${C.brd}`, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10 }}
                >
                  <span style={{ fontSize: 18 }}>💬</span>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 13.5, color: C.txt }}>{paziente.nome} {paziente.cognome}</div>
                    <div style={{ fontSize: 11, color: C.txl }}>WhatsApp · {paziente.telefono}</div>
                  </div>
                </button>
              )}
              <button
                onClick={inviaGenerico}
                style={{ width: '100%', textAlign: 'left', padding: '13px 16px', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10 }}
              >
                <span style={{ fontSize: 18 }}>📤</span>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 13.5, color: C.txt }}>Altro contatto o email</div>
                  <div style={{ fontSize: 11, color: C.txl }}>Scegli dal menù di condivisione del telefono</div>
                </div>
              </button>
            </div>
          </>
        )}
      </div>

      <div style={{ marginTop: 8 }}>
        <Btn ch="💾 Scarica" v="sec" onClick={() => scaricaPdf(pronto.dataUrl, pronto.filename)} full />
      </div>

      {stato && (
        <div style={{ fontSize: 11.5, color: C.txm, marginTop: 8, textAlign: 'center' }}>{stato}</div>
      )}

      <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
        <Btn ch="Chiudi" v="sec" onClick={onChiudi} full />
        <Btn ch="↻ Genera un altro documento" v="sec" onClick={onNuovoDocumento} full />
      </div>
    </div>
  );
}
