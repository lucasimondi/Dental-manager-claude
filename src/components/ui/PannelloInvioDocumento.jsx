import React, { Suspense, lazy, useState } from 'react';
import { C } from '../../lib/utils';
import Btn from './Btn.jsx';
import Ic from './Ic.jsx';
import { condividiPdf, scaricaPdf, copiaNumero } from '../../lib/condivisionePdf';

const PdfViewerModal = lazy(() => import('./PdfViewerModal.jsx'));

/**
 * Pannello azioni dopo la generazione di un documento: un pulsante unico
 * "Invia documento" apre un piccolo menu con le destinazioni disponibili.
 * Oggi copre "il paziente" (se ha un telefono) e "altro contatto/email".
 * È il punto pensato per crescere in futuro con una vera rubrica di
 * destinatari (altri medici, curanti, ecc.) — quel giorno basterà aggiungere
 * altre righe al menu, senza toccare il resto del pannello.
 *
 * Limite di piattaforma da tenere presente: non esiste un modo per aprire
 * la chat WhatsApp di un contatto specifico CON il file già allegato — né
 * qui né altrove nel web. In entrambi i casi il click apre lo stesso picker
 * di condivisione nativo del telefono; scegliendo "il paziente" copiamo
 * prima il suo numero negli appunti, così nel picker di WhatsApp può
 * incollarlo nella ricerca contatti invece di scorrere la rubrica.
 */
export default function PannelloInvioDocumento({ pronto, paziente, archiviato, onChiudi, onNuovoDocumento }) {
  const [menuAperto, setMenuAperto] = useState(false);
  const [stato, setStato] = useState('');
  const [anteprimaAperta, setAnteprimaAperta] = useState(false);

  const condividi = async (messaggioSuccesso) => {
    setMenuAperto(false);
    setStato('Apertura condivisione…');
    const ok = await condividiPdf(pronto.dataUrl, pronto.filename);
    setStato(ok ? messaggioSuccesso || '' : 'Condivisione non disponibile su questo dispositivo — usa Scarica qui sotto.');
  };

  const inviaPaziente = async () => {
    const copiato = await copiaNumero(paziente.telefono);
    await condividi(copiato
      ? `Numero di ${paziente.nome} copiato (${paziente.telefono}) — scegli WhatsApp e incollalo nella ricerca contatti.`
      : `Cerca ${paziente.nome} ${paziente.cognome} (${paziente.telefono}) tra i contatti WhatsApp.`);
  };

  const scarica = () => {
    try {
      scaricaPdf(pronto.dataUrl, pronto.filename);
      setStato('PDF scaricato.');
    } catch {
      setStato('Download non riuscito. Riprova o usa la condivisione.');
    }
  };

  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ background: C.sucL, border: `1px solid ${C.suc}`, borderRadius: 10, padding: '11px 14px', marginBottom: 12, textAlign: 'center' }}>
        <div style={{ fontWeight: 700, color: C.suc, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}><Ic n="okc" s={13} c={C.suc} />{pronto.titolo} pronto</div>
        {archiviato && <div style={{ fontSize: 11, color: C.txm, marginTop: 3 }}>Salvato anche in archivio, scheda paziente</div>}
      </div>

      <div style={{ marginBottom: 8 }}>
        <Btn ch="Apri anteprima" ic="eye" onClick={() => setAnteprimaAperta(true)} full />
      </div>

      <div style={{ position: 'relative' }}>
        <Btn ch="Invia documento" ic="send" onClick={() => setMenuAperto((v) => !v)} full />
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
                  <Ic n="phone2" s={17} c={C.pri} />
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 13.5, color: C.txt }}>{paziente.nome} {paziente.cognome}</div>
                    <div style={{ fontSize: 11, color: C.txl }}>Copia il numero e apre la condivisione</div>
                  </div>
                </button>
              )}
              <button
                onClick={() => condividi('')}
                style={{ width: '100%', textAlign: 'left', padding: '13px 16px', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10 }}
              >
                <Ic n="mail" s={17} c={C.txm} />
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
        <Btn ch="Scarica" ic="download" v="sec" onClick={scarica} full />
      </div>

      {stato && (
        <div style={{ fontSize: 11.5, color: C.txm, marginTop: 8, textAlign: 'center' }}>{stato}</div>
      )}

      <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
        <Btn ch="Chiudi" v="sec" onClick={onChiudi} full />
        <Btn ch="Genera un altro documento" ic="refresh" v="sec" onClick={onNuovoDocumento} full />
      </div>

      {anteprimaAperta && (
        <Suspense fallback={null}>
          <PdfViewerModal titolo={pronto.titolo} dataUrl={pronto.dataUrl} filename={pronto.filename} onClose={() => setAnteprimaAperta(false)} />
        </Suspense>
      )}
    </div>
  );
}
