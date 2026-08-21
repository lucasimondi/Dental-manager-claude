import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase.js';
import PadFirma from './ui/PadFirma.jsx';
import FormStoriaClinica from './ui/FormStoriaClinica.jsx';
import Ic from './ui/Ic.jsx';
import { ANAMNESI_MEDICA_STANDARD, STORIA_CLINICA_MODELLO_BASE } from '../lib/utils';

const C = {
  bg: '#F7F8FA', sur: '#FFFFFF',
  pri: '#185FA5', priL: '#E6F1FB',
  suc: '#27500A', sucL: '#EAF3DE',
  dan: '#791F1F', danL: '#FCEBEB',
  txt: '#1A2433', txm: '#5F6B7A', txl: '#8A93A0', brd: '#DCE1E6',
};

export default function StoriaClinicaRemota({ token }) {
  const [info, setInfo] = useState(undefined);
  const [errore, setErrore] = useState('');
  const [step, setStep] = useState('compila');
  const [compilata, setCompilata] = useState(null);
  const [firmatoDaNome, setFirmatoDaNome] = useState('');
  const [completato, setCompletato] = useState(false);
  const [invioInCorso, setInvioInCorso] = useState(false);

  useEffect(() => {
    supabase.rpc('info_link_storia_clinica', { p_token: token }).then(({ data }) => {
      if (data?.ok) {
        setInfo(data);
        setFirmatoDaNome(`${data.paziente_nome} ${data.paziente_cognome}`);
      } else {
        setErrore(data?.errore || 'errore_sconosciuto');
        setInfo(null);
      }
    });
  }, [token]);

  const dopoCompilazione = (dati) => { setCompilata(dati); setStep('firma'); };

  const salvaFirma = async (firmaPng) => {
    setInvioInCorso(true);
    const { data } = await supabase.rpc('completa_storia_clinica_remota', {
      p_token: token,
      p_risposte: JSON.stringify(compilata.risposte),
      p_farmaci: JSON.stringify(compilata.farmaci),
      p_allergie: JSON.stringify(compilata.allergie),
      p_firma_png: firmaPng, p_firmato_da_nome: firmatoDaNome,
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
    link_gia_usato: 'Questo link è già stato utilizzato.',
    link_scaduto: 'Questo link è scaduto. Chiedi allo studio di generarne uno nuovo.',
    invio_fallito: 'Non è stato possibile salvare. Riprova.',
  };

  if (info === null && !completato) {
    return (
      <div style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: C.bg, padding: 24, fontFamily: 'system-ui' }}>
        <div style={{ textAlign: 'center', color: C.txm, maxWidth: 320 }}>
          <div style={{ marginBottom: 10, display: 'flex', justifyContent: 'center' }}><Ic n="warn" s={32} c={C.dan} /></div>
          <div style={{ fontWeight: 700, fontSize: 15, color: C.txt }}>{MESSAGGI_ERRORE[errore] || 'Si è verificato un errore.'}</div>
        </div>
      </div>
    );
  }

  if (completato) {
    return (
      <div style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: C.bg, padding: 24, fontFamily: 'system-ui' }}>
        <div style={{ textAlign: 'center', maxWidth: 320 }}>
          <div style={{ marginBottom: 14, display: 'flex', justifyContent: 'center' }}><Ic n="okc" s={40} c={C.suc} /></div>
          <div style={{ fontWeight: 800, fontSize: 19, color: C.txt, marginBottom: 8 }}>Grazie</div>
          <div style={{ fontSize: 14, color: C.txm, lineHeight: 1.5 }}>La compilazione è stata inviata a {info.studio_nome}.</div>
        </div>
      </div>
    );
  }

  const usaAnamnesiMedicaStandard = !info.vertical || info.vertical === 'dentistico' || info.vertical === 'medico_chirurgo';
  const voci = usaAnamnesiMedicaStandard ? ANAMNESI_MEDICA_STANDARD : STORIA_CLINICA_MODELLO_BASE;

  return (
    <div style={{ minHeight: '100dvh', background: C.bg, fontFamily: 'system-ui, -apple-system, sans-serif', padding: '24px 16px 60px' }}>
      <div style={{ maxWidth: 460, margin: '0 auto' }}>
        <div style={{ marginBottom: 18, textAlign: 'center' }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: C.pri, textTransform: 'uppercase', letterSpacing: 1 }}>{usaAnamnesiMedicaStandard ? 'Anamnesi medica' : 'Storia clinica'}</div>
          <div style={{ fontSize: 19, fontWeight: 800, color: C.txt, marginTop: 3 }}>{info.studio_nome}</div>
        </div>

        {step === 'compila' && (
          <div style={{ background: C.sur, border: `1px solid ${C.brd}`, borderRadius: 16, padding: 18 }}>
            <div style={{ fontSize: 12.5, color: C.txm, marginBottom: 14 }}>Compila con sincerità: aiuta {info.studio_nome} a curarti in sicurezza.</div>
            <FormStoriaClinica voci={voci} onCompilato={dopoCompilazione} C={C} testoBottone="Avanti alla firma" />
          </div>
        )}

        {step === 'firma' && (
          <div style={{ background: C.sur, border: `1px solid ${C.brd}`, borderRadius: 16, padding: 18 }}>
            <div style={{ fontSize: 12.5, fontWeight: 700, color: C.txm, marginBottom: 4 }}>Firma per conferma</div>
            <div style={{ fontSize: 11, color: C.txl, marginBottom: 10 }}>Confermo che le informazioni fornite sono complete e veritiere.</div>
            <input
              value={firmatoDaNome}
              onChange={(e) => setFirmatoDaNome(e.target.value)}
              placeholder="Nome di chi firma"
              style={{ width: '100%', padding: '10px 12px', border: `1.5px solid ${C.brd}`, borderRadius: 10, fontSize: 14, color: C.txt, boxSizing: 'border-box', marginBottom: 14 }}
            />
            <PadFirma onFirmata={salvaFirma} C={C} />
            {invioInCorso && <div style={{ textAlign: 'center', fontSize: 12, color: C.txl, marginTop: 10 }}>Salvataggio…</div>}
            {errore === 'invio_fallito' && <div style={{ textAlign: 'center', fontSize: 12, color: C.dan, marginTop: 10 }}>{MESSAGGI_ERRORE.invio_fallito}</div>}
            <button onClick={() => setStep('compila')} style={{ background: 'none', border: 'none', color: C.txl, fontSize: 12, cursor: 'pointer', marginTop: 12, width: '100%', textAlign: 'center' }}>‹ Torna alla compilazione</button>
          </div>
        )}
      </div>
    </div>
  );
}
