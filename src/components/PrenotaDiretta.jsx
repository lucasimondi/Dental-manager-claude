import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase.js';
import { slotLiberiRange } from '../lib/slotPrenotazione';
import Ic from './ui/Ic.jsx';

const C = {
  bg: '#F7F8FA', sur: '#FFFFFF',
  pri: '#185FA5', priL: '#E6F1FB', priD: '#0C447C',
  suc: '#27500A', sucL: '#EAF3DE',
  dan: '#791F1F', danL: '#FCEBEB',
  txt: '#1A2433', txm: '#5F6B7A', txl: '#8A93A0', brd: '#DCE1E6',
};

const GIORNI_AVANTI = 21; // 3 settimane di orizzonte di prenotazione

const inputStyle = {
  width: '100%', padding: '11px 12px', border: `1.5px solid ${C.brd}`, borderRadius: 10,
  fontSize: 15, color: C.txt, background: C.sur, boxSizing: 'border-box',
};

export default function PrenotaDiretta({ studio }) {
  const [tipi, setTipi] = useState(undefined); // undefined = caricamento
  const [tipoSel, setTipoSel] = useState(null);
  const [slotPerData, setSlotPerData] = useState({});
  const [caricandoSlot, setCaricandoSlot] = useState(false);
  const [slotSel, setSlotSel] = useState(null); // { data, ora }

  const [nome, setNome] = useState('');
  const [cognome, setCognome] = useState('');
  const [telefono, setTelefono] = useState('');
  const [email, setEmail] = useState('');

  const [invioInCorso, setInvioInCorso] = useState(false);
  const [errore, setErrore] = useState('');
  const [confermato, setConfermato] = useState(false);

  useEffect(() => {
    supabase.rpc('tipi_prenotabili_online', { p_studio_id: studio.id }).then(({ data }) => {
      setTipi(data || []);
      if (data && data.length === 1) setTipoSel(data[0]); // se c'è un solo tipo, saltiamo la scelta
    });
  }, [studio.id]);

  useEffect(() => {
    if (!tipoSel) return;
    setCaricandoSlot(true);
    setSlotSel(null);
    const oggi = new Date(); oggi.setHours(0, 0, 0, 0);
    const domani = new Date(oggi); domani.setDate(domani.getDate() + 1);
    const fine = new Date(oggi); fine.setDate(fine.getDate() + GIORNI_AVANTI);
    const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

    supabase.rpc('slot_occupati_pubblico', { p_studio_id: studio.id, p_data_da: iso(domani), p_data_a: iso(fine) }).then(({ data }) => {
      const occupatiPerData = {};
      (data || []).forEach(o => {
        if (!occupatiPerData[o.data]) occupatiPerData[o.data] = [];
        occupatiPerData[o.data].push({ ora: o.ora, durata: o.durata });
      });
      const risultato = slotLiberiRange(tipoSel, domani, GIORNI_AVANTI, occupatiPerData);
      setSlotPerData(risultato);
      setCaricandoSlot(false);
    });
  }, [tipoSel, studio.id]);

  const formValido = nome.trim() && cognome.trim() && telefono.trim().length >= 6 && slotSel;

  const conferma = async () => {
    if (!formValido) return;
    setInvioInCorso(true);
    setErrore('');
    const { data, error } = await supabase.rpc('prenota_slot_pubblico', {
      p_studio_id: studio.id,
      p_nome: nome.trim(),
      p_cognome: cognome.trim(),
      p_telefono: telefono.trim(),
      p_email: email.trim() || null,
      p_data: slotSel.data,
      p_ora: slotSel.ora,
      p_tipo: tipoSel.nome,
      p_durata: tipoSel.durata || 30,
      p_colore: tipoSel.colore || '#185FA5',
    });
    setInvioInCorso(false);
    if (error || !data?.ok) {
      if (data?.errore === 'slot_occupato') {
        setErrore('Questo orario è appena stato prenotato da qualcun altro. Scegline un altro.');
        setSlotSel(null);
        setTipoSel(t => ({ ...t }));
      } else {
        setErrore('Non è stato possibile completare la prenotazione. Riprova tra poco.');
      }
      return;
    }
    setConfermato(true);
  };

  if (tipi === undefined) {
    return <div style={{ textAlign: 'center', color: C.txl, padding: 60, fontSize: 13 }}>Caricamento…</div>;
  }

  if (tipi.length === 0) {
    return (
      <div style={{ textAlign: 'center', color: C.txm, padding: '40px 20px' }}>
        <div style={{ marginBottom: 10, display: 'flex', justifyContent: 'center' }}><Ic n="cal" s={32} c={C.txl} /></div>
        <div style={{ fontWeight: 700, fontSize: 15, color: C.txt }}>Prenotazione diretta non disponibile</div>
        <div style={{ fontSize: 13, marginTop: 4 }}>Contatta lo studio direttamente per fissare un appuntamento.</div>
      </div>
    );
  }

  if (confermato) {
    return (
      <div style={{ textAlign: 'center', maxWidth: 340, margin: '40px auto' }}>
        <div style={{ fontSize: 40, marginBottom: 14 }}>✓</div>
        <div style={{ fontWeight: 800, fontSize: 19, color: C.txt, marginBottom: 8 }}>Appuntamento confermato</div>
        <div style={{ fontSize: 14, color: C.txm, lineHeight: 1.5 }}>
          {tipoSel.nome} — {new Date(slotSel.data + 'T12:00').toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' })} alle {slotSel.ora}
        </div>
        <div style={{ fontSize: 12.5, color: C.txl, marginTop: 10 }}>Riceverai un promemoria da {studio.nome} prima dell'appuntamento.</div>
      </div>
    );
  }

  return (
    <div>
      {tipi.length > 1 && !tipoSel && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ fontSize: 12.5, fontWeight: 700, color: C.txm, marginBottom: 2 }}>Che tipo di appuntamento ti serve?</div>
          {tipi.map(t => (
            <button
              key={t.id}
              onClick={() => setTipoSel(t)}
              style={{ display: 'flex', alignItems: 'center', gap: 10, textAlign: 'left', background: C.sur, border: `1.5px solid ${C.brd}`, borderRadius: 12, padding: '14px 16px', cursor: 'pointer' }}
            >
              <div style={{ width: 10, height: 10, borderRadius: '50%', background: t.colore || C.pri, flexShrink: 0 }} />
              <span style={{ fontWeight: 700, fontSize: 14, color: C.txt }}>{t.nome}</span>
            </button>
          ))}
        </div>
      )}

      {tipoSel && !slotSel && (
        <div>
          {tipi.length > 1 && (
            <button onClick={() => setTipoSel(null)} style={{ background: 'none', border: 'none', color: C.pri, fontSize: 12.5, fontWeight: 700, cursor: 'pointer', padding: 0, marginBottom: 14 }}>‹ Cambia tipo</button>
          )}
          <div style={{ fontSize: 12.5, fontWeight: 700, color: C.txm, marginBottom: 12 }}>Scegli data e orario — {tipoSel.nome}</div>
          {caricandoSlot && <div style={{ textAlign: 'center', color: C.txl, padding: 30, fontSize: 13 }}>Ricerca orari disponibili…</div>}
          {!caricandoSlot && Object.keys(slotPerData).length === 0 && (
            <div style={{ textAlign: 'center', color: C.txl, padding: 30, fontSize: 13 }}>Nessun orario disponibile nelle prossime {GIORNI_AVANTI} giorni. Contatta lo studio direttamente.</div>
          )}
          {!caricandoSlot && Object.entries(slotPerData).map(([data, orari]) => (
            <div key={data} style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: C.txt, marginBottom: 8, textTransform: 'capitalize' }}>
                {new Date(data + 'T12:00').toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' })}
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {orari.map(ora => (
                  <button
                    key={ora}
                    onClick={() => setSlotSel({ data, ora })}
                    style={{ padding: '9px 14px', borderRadius: 9, border: `1.5px solid ${C.brd}`, background: C.sur, color: C.txt, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}
                  >
                    {ora}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {slotSel && (
        <div>
          <button onClick={() => setSlotSel(null)} style={{ background: 'none', border: 'none', color: C.pri, fontSize: 12.5, fontWeight: 700, cursor: 'pointer', padding: 0, marginBottom: 14 }}>‹ Cambia orario</button>

          <div style={{ background: C.priL, borderRadius: 12, padding: 14, marginBottom: 16 }}>
            <div style={{ fontWeight: 800, fontSize: 15, color: C.pri }}>{tipoSel.nome}</div>
            <div style={{ fontSize: 13, color: C.priD, marginTop: 2, textTransform: 'capitalize' }}>
              {new Date(slotSel.data + 'T12:00').toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' })} alle {slotSel.ora}
            </div>
          </div>

          <div style={{ fontSize: 12.5, fontWeight: 700, color: C.txm, marginBottom: 10 }}>I tuoi dati</div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
            <input value={nome} onChange={e => setNome(e.target.value)} placeholder="Nome" style={inputStyle} />
            <input value={cognome} onChange={e => setCognome(e.target.value)} placeholder="Cognome" style={inputStyle} />
          </div>
          <input value={telefono} onChange={e => setTelefono(e.target.value)} placeholder="Telefono" type="tel" style={{ ...inputStyle, marginBottom: 8 }} />
          <input value={email} onChange={e => setEmail(e.target.value)} placeholder="Email (opzionale)" type="email" style={{ ...inputStyle, marginBottom: 16 }} />

          {errore && <div style={{ background: C.danL, color: C.dan, borderRadius: 10, padding: '10px 14px', fontSize: 13, marginBottom: 14, textAlign: 'center' }}>{errore}</div>}

          <button
            onClick={conferma}
            disabled={!formValido || invioInCorso}
            style={{
              width: '100%', padding: '14px 0', borderRadius: 12, border: 'none',
              background: formValido ? C.pri : C.brd, color: formValido ? '#fff' : C.txl,
              fontWeight: 800, fontSize: 15, cursor: formValido ? 'pointer' : 'default',
            }}
          >
            {invioInCorso ? 'Conferma in corso…' : 'Conferma appuntamento'}
          </button>
        </div>
      )}
    </div>
  );
}
