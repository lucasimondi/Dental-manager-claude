import React, { useState, useRef, useEffect } from 'react';
import { supabase } from '../lib/supabase.js';
import { C } from '../lib/utils';
import { Ic } from './ui';
import { generaRicettaPdf } from '../lib/pdfDocs.js';
import { MOBILE_FLOAT_BOTTOM } from './MobileDock.jsx';

// Etichette leggibili per le azioni che richiedono conferma — mostrate nella
// scheda di conferma invece del nome tecnico del tool.
const AZIONI_LABEL = {
  crea_appuntamento: 'Creare un nuovo appuntamento',
  modifica_appuntamento: 'Modificare un appuntamento',
  elimina_appuntamento: 'Eliminare un appuntamento',
  registra_pagamento: 'Registrare un pagamento',
  crea_paziente: 'Creare un nuovo paziente',
};

const campoLabel = (k) => ({
  paziente_id: 'Paziente (ID)', appuntamento_id: 'Appuntamento (ID)', data: 'Data', ora: 'Ora',
  durata: 'Durata (min)', tipo: 'Tipo', note: 'Note', nota: 'Nota', stato: 'Stato',
  importo: 'Importo', metodo: 'Metodo', nome: 'Nome', cognome: 'Cognome',
  telefono: 'Telefono', email: 'Email',
}[k] || k);

export default function AssistenteAI({ isMobile = false }) {
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState([]); // messaggi mostrati in chat: { role, display, apiContent }
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [pending, setPending] = useState(null); // { tool_use_id, name, input, convoSoFar }
  const [errore, setErrore] = useState('');
  const scrollRef = useRef(null);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [msgs, pending, loading]);

  const chiamaAgente = async (apiMessages, confirm) => {
    const { data, error } = await supabase.functions.invoke('agente-assistente', {
      body: { messages: apiMessages, confirm },
    });
    if (error) throw error;
    return data;
  };

  const invia = async (testoLibero) => {
    const testo = (testoLibero ?? input).trim();
    if (!testo || loading) return;
    setInput('');
    setErrore('');
    const nuoviMsgs = [...msgs, { role: 'user', display: testo, apiContent: testo }];
    setMsgs(nuoviMsgs);
    setLoading(true);
    try {
      const apiMessages = nuoviMsgs.map(m => ({ role: m.role, content: m.apiContent }));
      const risposta = await chiamaAgente(apiMessages);
      gestisciRisposta(risposta);
    } catch (e) {
      setErrore('Non sono riuscito a contattare l\'assistente. Riprova tra poco.');
    } finally {
      setLoading(false);
    }
  };

  // Cerca nei messaggi della conversazione un tool_result di compila_ricetta_medica
  // che contenga i dati pronti per il PDF, e lo scarica subito — nessun passaggio manuale.
  const scaricaRicetteSePresenti = (messages) => {
    if (!Array.isArray(messages)) return;
    for (const m of messages) {
      if (m.role !== 'user' || !Array.isArray(m.content)) continue;
      for (const block of m.content) {
        if (block.type !== 'tool_result' || typeof block.content !== 'string') continue;
        let parsed;
        try { parsed = JSON.parse(block.content); } catch { continue; }
        if (parsed && parsed.pdf_data) {
          try {
            const nomeFile = generaRicettaPdf(parsed.pdf_data);
            setMsgs(m2 => [...m2, { role: 'system', display: `📄 Ricetta generata: ${nomeFile}` }]);
          } catch (e) {
            setMsgs(m2 => [...m2, { role: 'system', display: '⚠️ Ricetta compilata ma il PDF non si è generato correttamente. Riprova o usa Documenti Medici.' }]);
          }
        }
      }
    }
  };

  const gestisciRisposta = (risposta) => {
    if (risposta.error) {
      setErrore(risposta.error);
      return;
    }
    scaricaRicetteSePresenti(risposta.messages);
    if (risposta.needsConfirmation) {
      if (risposta.text) {
        setMsgs(m => [...m, { role: 'assistant', display: risposta.text, apiContent: risposta.text }]);
      }
      setPending({ ...risposta.needsConfirmation, convoSoFar: risposta.messages });
      return;
    }
    setMsgs(m => [...m, { role: 'assistant', display: risposta.text, apiContent: risposta.text }]);
  };

  const rispondiConferma = async (accettato) => {
    if (!pending) return;
    const p = pending;
    setPending(null);
    setLoading(true);
    setErrore('');
    setMsgs(m => [...m, { role: 'system', display: accettato ? '✓ Azione confermata' : '✕ Azione annullata' }]);
    try {
      const confirm = { tool_use_id: p.tool_use_id, cancelled: !accettato };
      const risposta = await chiamaAgente(p.convoSoFar, confirm);
      gestisciRisposta(risposta);
    } catch (e) {
      setErrore('Non sono riuscito a completare l\'azione. Riprova tra poco.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* POL-UI-009: su mobile allineato alla stessa baseline verticale del
          poliedro (MOBILE_FLOAT_BOTTOM), basso destra — desktop invariato. */}
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          position: 'fixed',
          bottom: isMobile ? MOBILE_FLOAT_BOTTOM : 74,
          right: isMobile ? 'max(18px, env(safe-area-inset-right, 0px))' : 16,
          width: isMobile ? 58 : 50, height: isMobile ? 58 : 50, borderRadius: '50%',
          background: C.pri, border: 'none', boxShadow: '0 4px 16px rgba(0,0,0,0.25)', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
        }}
        title="Assistente"
      >
        <Ic n={open ? 'x' : 'bot'} s={isMobile ? 24 : 22} c="#fff" />
      </button>

      {open && (
        <div style={{
          position: 'fixed',
          bottom: isMobile ? 'calc(88px + env(safe-area-inset-bottom, 0px))' : 132,
          right: isMobile ? 'max(18px, env(safe-area-inset-right, 0px))' : 16,
          width: 360, maxWidth: 'calc(100vw - 32px)',
          height: 500, maxHeight: 'calc(100vh - 200px)', background: C.sur, border: `1px solid ${C.brd}`,
          borderRadius: 16, boxShadow: '0 8px 32px rgba(0,0,0,0.25)', display: 'flex', flexDirection: 'column',
          overflow: 'hidden', zIndex: 999,
        }}>
          <div style={{ padding: '12px 14px', borderBottom: `1px solid ${C.brd}`, background: C.bg, display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 30, height: 30, borderRadius: 9, background: C.priL, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Ic n="bot" s={16} c={C.pri} />
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 13, color: C.txt }}>Assistente Poliedra</div>
              <div style={{ fontSize: 10, color: C.txl }}>Chiedimi pazienti, agenda, incassi, richiami…</div>
            </div>
          </div>

          <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {msgs.length === 0 && (
              <div style={{ fontSize: 12, color: C.txl, textAlign: 'center', marginTop: 30, padding: '0 10px' }}>
                Prova a chiedermi ad esempio: <br />"chi ho in agenda domani?" <br />"quanto ho incassato questo mese?" <br />"cerca il paziente Rossi"
              </div>
            )}
            {msgs.map((m, i) => (
              <div key={i} style={{
                alignSelf: m.role === 'user' ? 'flex-end' : m.role === 'system' ? 'center' : 'flex-start',
                background: m.role === 'user' ? C.pri : m.role === 'system' ? 'transparent' : C.bg,
                color: m.role === 'user' ? '#fff' : m.role === 'system' ? C.txl : C.txt,
                borderRadius: m.role === 'system' ? 0 : 12,
                padding: m.role === 'system' ? '2px 8px' : '8px 11px',
                fontSize: m.role === 'system' ? 11 : 13,
                maxWidth: '85%', whiteSpace: 'pre-wrap', lineHeight: 1.4,
              }}>
                {m.display}
              </div>
            ))}

            {pending && (
              <div style={{ background: C.warL || C.priL, border: `1px solid ${C.war}50`, borderRadius: 12, padding: 11, fontSize: 12 }}>
                <div style={{ fontWeight: 700, marginBottom: 6, color: C.txt, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Ic n="warn" s={12} c={C.war} />{AZIONI_LABEL[pending.name] || pending.name}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2, marginBottom: 10 }}>
                  {Object.entries(pending.input || {}).map(([k, v]) => (
                    <div key={k} style={{ display: 'flex', justifyContent: 'space-between', color: C.txm }}>
                      <span>{campoLabel(k)}</span><span style={{ fontWeight: 600, color: C.txt }}>{String(v)}</span>
                    </div>
                  ))}
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => rispondiConferma(false)} style={{ flex: 1, padding: '7px 0', borderRadius: 8, border: `1px solid ${C.brd}`, background: C.sur, color: C.txm, fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>Annulla</button>
                  <button onClick={() => rispondiConferma(true)} style={{ flex: 1, padding: '7px 0', borderRadius: 8, border: 'none', background: C.pri, color: '#fff', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>Conferma</button>
                </div>
              </div>
            )}

            {loading && <div style={{ fontSize: 12, color: C.txl, alignSelf: 'flex-start' }}>Sto verificando…</div>}
            {errore && <div style={{ fontSize: 12, color: C.dan, background: C.danL, borderRadius: 8, padding: '6px 10px' }}>{errore}</div>}
          </div>

          <div style={{ padding: 10, borderTop: `1px solid ${C.brd}`, display: 'flex', gap: 8 }}>
            <input
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); invia(); } }}
              placeholder="Scrivi una domanda…"
              disabled={loading || !!pending}
              style={{ flex: 1, border: `1px solid ${C.brd}`, borderRadius: 9, padding: '8px 11px', fontSize: 13, background: C.bg, color: C.txt, outline: 'none' }}
            />
            <button
              onClick={() => invia()}
              disabled={loading || !!pending || !input.trim()}
              style={{ background: C.pri, border: 'none', borderRadius: 9, width: 38, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', opacity: (loading || !!pending || !input.trim()) ? 0.5 : 1 }}
            >
              <Ic n="send" s={16} c="#fff" />
            </button>
          </div>
        </div>
      )}
    </>
  );
}
