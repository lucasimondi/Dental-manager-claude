import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase.js';
import PadFirma from './ui/PadFirma.jsx';

const C = {
  bg: '#F7F8FA', sur: '#FFFFFF',
  pri: '#185FA5', priL: '#E6F1FB',
  suc: '#27500A', sucL: '#EAF3DE',
  dan: '#791F1F', danL: '#FCEBEB',
  txt: '#1A2433', txm: '#5F6B7A', txl: '#8A93A0', brd: '#DCE1E6',
};

/**
 * Pagina pubblica per firmare un consenso a distanza: il link (con token
 * monouso) arriva al paziente via WhatsApp/email/SMS, apre questa pagina
 * senza bisogno di login, mostra il testo del consenso e raccoglie la
 * firma col dito — stesso pattern già collaudato per /prenota/:slug.
 */
export default function FirmaConsenso({ token }) {
  const [info, setInfo] = useState(undefined); // undefined = caricamento, null = non valido
  const [errore, setErrore] = useState('');
  const [firmatoDaNome, setFirmatoDaNome] = useState('');
  const [completato, setCompletato] = useState(false);
  const [invioInCorso, setInvioInCorso] = useState(false);

  useEffect(() => {
    supabase.rpc('info_link_firma_consenso', { p_token: token }).then(({ data }) => {
      if (data?.ok) {
        setInfo(data);
        setFirmatoDaNome(`${data.paziente_nome} ${data.paziente_cognome}`);
      } else {
        setErrore(data?.errore || 'errore_sconosciuto');
        setInfo(null);
      }
    });
  }, [token]);

  const salvaFirma = async (firmaPng) => {
    setInvioInCorso(true);
    const { data } = await supabase.rpc('registra_firma_consenso', {
      p_studio_id: info.studio_id, p_paziente_id: info.paziente_id,
      p_titolo: info.titolo, p_testo: info.testo, p_firma_png: firmaPng,
      p_canale: 'remoto', p_firmato_da_nome: firmatoDaNome,
      p_piano_id: info.piano_id, p_voce_indice: info.voce_indice,
      p_modello_id: info.modello_id, p_token_link: token,
    });
    setInvioInCorso(false);
    if (data?.ok) setCompletato(true);
    else setErrore('invio_fallito');
  };

  if (info === undefined) {
    return <div style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: C.bg, color: C.txl, fontFamily: 'system-ui' }}>Caricamento…</div>;
  }

  const MESSAGGI_ERRORE = {
    link_non_trovato: 'Questo link non è valido.',
    link_gia_usato: 'Questo link è già stato utilizzato per firmare.',
    link_scaduto: 'Questo link è scaduto. Chiedi allo studio di generarne uno nuovo.',
    invio_fallito: 'Non è stato possibile salvare la firma. Riprova.',
  };

  if (info === null && !completato) {
    return (
      <div style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: C.bg, padding: 24, fontFamily: 'system-ui' }}>
        <div style={{ textAlign: 'center', color: C.txm, maxWidth: 320 }}>
          <div style={{ fontSize: 32, marginBottom: 10 }}>⚠️</div>
          <div style={{ fontWeight: 700, fontSize: 15, color: C.txt }}>{MESSAGGI_ERRORE[errore] || 'Si è verificato un errore.'}</div>
        </div>
      </div>
    );
  }

  if (completato) {
    return (
      <div style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: C.bg, padding: 24, fontFamily: 'system-ui' }}>
        <div style={{ textAlign: 'center', maxWidth: 320 }}>
          <div style={{ fontSize: 40, marginBottom: 14 }}>✓</div>
          <div style={{ fontWeight: 800, fontSize: 19, color: C.txt, marginBottom: 8 }}>Consenso firmato</div>
          <div style={{ fontSize: 14, color: C.txm, lineHeight: 1.5 }}>Grazie, la firma è stata registrata da {info.studio_nome}.</div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100dvh', background: C.bg, fontFamily: 'system-ui, -apple-system, sans-serif', padding: '24px 16px 60px' }}>
      <div style={{ maxWidth: 460, margin: '0 auto' }}>
        <div style={{ marginBottom: 18, textAlign: 'center' }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: C.pri, textTransform: 'uppercase', letterSpacing: 1 }}>Consenso informato</div>
          <div style={{ fontSize: 19, fontWeight: 800, color: C.txt, marginTop: 3 }}>{info.studio_nome}</div>
        </div>

        <div style={{ background: C.sur, border: `1px solid ${C.brd}`, borderRadius: 16, padding: 18, marginBottom: 14 }}>
          <div style={{ fontWeight: 800, fontSize: 16, color: C.txt, marginBottom: 10 }}>{info.titolo}</div>
          <div style={{ fontSize: 13.5, color: C.txt, lineHeight: 1.65, whiteSpace: 'pre-wrap', maxHeight: 340, overflowY: 'auto' }}>
            {info.testo}
          </div>
        </div>

        <div style={{ background: C.sur, border: `1px solid ${C.brd}`, borderRadius: 16, padding: 18 }}>
          <div style={{ fontSize: 12.5, fontWeight: 700, color: C.txm, marginBottom: 4 }}>Firma per conferma</div>
          <div style={{ fontSize: 11, color: C.txl, marginBottom: 10 }}>Confermo di aver letto e compreso quanto sopra.</div>
          <input
            value={firmatoDaNome}
            onChange={(e) => setFirmatoDaNome(e.target.value)}
            placeholder="Nome di chi firma"
            style={{ width: '100%', padding: '10px 12px', border: `1.5px solid ${C.brd}`, borderRadius: 10, fontSize: 14, color: C.txt, boxSizing: 'border-box', marginBottom: 14 }}
          />
          <PadFirma onFirmata={salvaFirma} C={C} />
          {invioInCorso && <div style={{ textAlign: 'center', fontSize: 12, color: C.txl, marginTop: 10 }}>Salvataggio…</div>}
          {errore === 'invio_fallito' && <div style={{ textAlign: 'center', fontSize: 12, color: C.dan, marginTop: 10 }}>{MESSAGGI_ERRORE.invio_fallito}</div>}
        </div>
      </div>
    </div>
  );
}
