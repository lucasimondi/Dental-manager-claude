import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase.js';
import PrenotaDiretta from './PrenotaDiretta.jsx';

const C = {
  bg: '#F7F8FA', sur: '#FFFFFF',
  pri: '#185FA5', priL: '#E6F1FB', priD: '#0C447C',
  suc: '#27500A', sucL: '#EAF3DE',
  dan: '#791F1F', danL: '#FCEBEB',
  txt: '#1A2433', txm: '#5F6B7A', txl: '#8A93A0', brd: '#DCE1E6',
};

const MESI = ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno', 'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'];
const GG = ['L', 'M', 'M', 'G', 'V', 'S', 'D'];
const oggi = new Date(); oggi.setHours(0, 0, 0, 0);
const toISO = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const MAX_DATE = 3;

// Mini calendario per la scelta di più date preferite (fino a 3), senza
// alcuna dipendenza dalla griglia oraria dell'Agenda interna — qui serve
// solo scegliere giorni, non slot precisi, coerente con "richiesta" e non
// "prenotazione live" di uno slot specifico.
function MiniCalendario({ selezionate, onToggle }) {
  const [meseVisto, setMeseVisto] = useState(new Date(oggi.getFullYear(), oggi.getMonth(), 1));

  const primoDelMese = new Date(meseVisto.getFullYear(), meseVisto.getMonth(), 1);
  const giornoSettimanaPrimo = (primoDelMese.getDay() + 6) % 7; // lunedì = 0
  const giorniNelMese = new Date(meseVisto.getFullYear(), meseVisto.getMonth() + 1, 0).getDate();
  const celle = [
    ...Array(giornoSettimanaPrimo).fill(null),
    ...Array.from({ length: giorniNelMese }, (_, i) => new Date(meseVisto.getFullYear(), meseVisto.getMonth(), i + 1)),
  ];

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <button
          onClick={() => setMeseVisto(m => new Date(m.getFullYear(), m.getMonth() - 1, 1))}
          disabled={meseVisto.getFullYear() === oggi.getFullYear() && meseVisto.getMonth() === oggi.getMonth()}
          style={{ background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', color: C.pri, padding: 6, opacity: (meseVisto.getFullYear() === oggi.getFullYear() && meseVisto.getMonth() === oggi.getMonth()) ? 0.3 : 1 }}
        >‹</button>
        <span style={{ fontWeight: 700, fontSize: 14, color: C.txt }}>{MESI[meseVisto.getMonth()]} {meseVisto.getFullYear()}</span>
        <button onClick={() => setMeseVisto(m => new Date(m.getFullYear(), m.getMonth() + 1, 1))} style={{ background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', color: C.pri, padding: 6 }}>›</button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4, marginBottom: 4 }}>
        {GG.map((g, i) => <div key={i} style={{ textAlign: 'center', fontSize: 10.5, fontWeight: 700, color: C.txl }}>{g}</div>)}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4 }}>
        {celle.map((d, i) => {
          if (!d) return <div key={i} />;
          const iso = toISO(d);
          const passato = d < oggi;
          const domenica = d.getDay() === 0;
          const sel = selezionate.includes(iso);
          const disabilitato = passato || domenica;
          return (
            <button
              key={i}
              onClick={() => !disabilitato && onToggle(iso)}
              disabled={disabilitato}
              style={{
                aspectRatio: '1', borderRadius: 9, border: `1.5px solid ${sel ? C.pri : C.brd}`,
                background: sel ? C.pri : disabilitato ? C.bg : C.sur, color: sel ? '#fff' : disabilitato ? C.txl : C.txt,
                fontSize: 12.5, fontWeight: sel ? 700 : 500, cursor: disabilitato ? 'default' : 'pointer',
                opacity: disabilitato ? 0.4 : 1,
              }}
            >
              {d.getDate()}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default function PrenotaOnline({ slug }) {
  const [studio, setStudio] = useState(undefined); // undefined = caricamento, null = non trovato
  const [inviato, setInviato] = useState(false);
  const [invioInCorso, setInvioInCorso] = useState(false);
  const [errore, setErrore] = useState('');

  const [nome, setNome] = useState('');
  const [cognome, setCognome] = useState('');
  const [telefono, setTelefono] = useState('');
  const [email, setEmail] = useState('');
  const [dateSel, setDateSel] = useState([]);
  const [motivo, setMotivo] = useState('');
  const [note, setNote] = useState('');

  useEffect(() => {
    let annullato = false;
    supabase.rpc('info_studio_pubblico', { p_slug: slug }).then(({ data }) => {
      if (annullato) return;
      setStudio(data && data.length > 0 ? data[0] : null);
    });
    return () => { annullato = true; };
  }, [slug]);

  const toggleData = (iso) => setDateSel(prev => {
    if (prev.includes(iso)) return prev.filter(d => d !== iso);
    if (prev.length >= MAX_DATE) return prev; // limite raggiunto, ignora ulteriori click
    return [...prev, iso].sort();
  });

  const formValido = nome.trim() && cognome.trim() && telefono.trim().length >= 6 && dateSel.length > 0;

  const invia = async () => {
    if (!formValido || !studio) return;
    setInvioInCorso(true);
    setErrore('');
    const { error } = await supabase.from('richieste_prenotazione').insert([{
      studio_id: studio.id,
      nome: nome.trim(),
      cognome: cognome.trim(),
      telefono: telefono.trim(),
      email: email.trim() || null,
      date_preferite: dateSel,
      motivo: motivo.trim() || null,
      note: note.trim() || null,
    }]);
    setInvioInCorso(false);
    if (error) { setErrore('Non è stato possibile inviare la richiesta. Riprova tra poco.'); return; }
    setInviato(true);
  };

  if (studio === undefined) {
    return <div style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: C.bg, color: C.txl, fontFamily: 'system-ui' }}>Caricamento…</div>;
  }

  if (studio === null) {
    return (
      <div style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: C.bg, padding: 24, fontFamily: 'system-ui' }}>
        <div style={{ textAlign: 'center', color: C.txm }}>
          <div style={{ fontSize: 32, marginBottom: 10 }}>🔍</div>
          <div style={{ fontWeight: 700, fontSize: 16, color: C.txt }}>Link non valido</div>
          <div style={{ fontSize: 13, marginTop: 4 }}>Lo studio richiesto non è stato trovato.</div>
        </div>
      </div>
    );
  }

  if (inviato) {
    return (
      <div style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: C.bg, padding: 24, fontFamily: 'system-ui' }}>
        <div style={{ textAlign: 'center', maxWidth: 340 }}>
          <div style={{ fontSize: 40, marginBottom: 14 }}>✓</div>
          <div style={{ fontWeight: 800, fontSize: 19, color: C.txt, marginBottom: 8 }}>Richiesta inviata</div>
          <div style={{ fontSize: 14, color: C.txm, lineHeight: 1.5 }}>
            {studio.nome} ti contatterà al più presto per confermare data e orario dell'appuntamento.
          </div>
        </div>
      </div>
    );
  }

  // Modalità "diretta": slot reali cliccabili, prenotazione immediata.
  // Componente separato perché il flusso è sostanzialmente diverso
  // (tipo → slot → conferma, invece di form → date preferite → invio).
  if (studio.modalita_prenotazione === 'diretta') {
    return (
      <div style={{ minHeight: '100dvh', background: C.bg, fontFamily: 'system-ui, -apple-system, sans-serif', padding: '24px 16px 60px' }}>
        <div style={{ maxWidth: 460, margin: '0 auto' }}>
          <div style={{ marginBottom: 22, textAlign: 'center' }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: C.pri, textTransform: 'uppercase', letterSpacing: 1 }}>Prenota appuntamento</div>
            <div style={{ fontSize: 21, fontWeight: 800, color: C.txt, marginTop: 3 }}>{studio.nome}</div>
          </div>
          <PrenotaDiretta studio={studio} />
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100dvh', background: C.bg, fontFamily: 'system-ui, -apple-system, sans-serif', padding: '24px 16px 60px' }}>
      <div style={{ maxWidth: 460, margin: '0 auto' }}>
        <div style={{ marginBottom: 22, textAlign: 'center' }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: C.pri, textTransform: 'uppercase', letterSpacing: 1 }}>Richiesta appuntamento</div>
          <div style={{ fontSize: 21, fontWeight: 800, color: C.txt, marginTop: 3 }}>{studio.nome}</div>
        </div>

        <div style={{ background: C.sur, border: `1px solid ${C.brd}`, borderRadius: 16, padding: 18, marginBottom: 14 }}>
          <div style={{ fontSize: 12.5, fontWeight: 700, color: C.txm, marginBottom: 10 }}>I tuoi dati</div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
            <input value={nome} onChange={e => setNome(e.target.value)} placeholder="Nome" style={inputStyle} />
            <input value={cognome} onChange={e => setCognome(e.target.value)} placeholder="Cognome" style={inputStyle} />
          </div>
          <input value={telefono} onChange={e => setTelefono(e.target.value)} placeholder="Telefono" type="tel" style={{ ...inputStyle, width: '100%', marginBottom: 8 }} />
          <input value={email} onChange={e => setEmail(e.target.value)} placeholder="Email (opzionale)" type="email" style={{ ...inputStyle, width: '100%' }} />
        </div>

        <div style={{ background: C.sur, border: `1px solid ${C.brd}`, borderRadius: 16, padding: 18, marginBottom: 14 }}>
          <div style={{ fontSize: 12.5, fontWeight: 700, color: C.txm, marginBottom: 2 }}>Quando preferisci?</div>
          <div style={{ fontSize: 11.5, color: C.txl, marginBottom: 12 }}>Scegli fino a {MAX_DATE} date — lo studio ti confermerà data e orario esatti</div>
          <MiniCalendario selezionate={dateSel} onToggle={toggleData} />
          {dateSel.length > 0 && (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 12 }}>
              {dateSel.map(iso => (
                <div key={iso} style={{ background: C.priL, color: C.pri, borderRadius: 20, padding: '5px 10px', fontSize: 11.5, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
                  {new Date(iso + 'T12:00').toLocaleDateString('it-IT', { day: 'numeric', month: 'short' })}
                  <button onClick={() => toggleData(iso)} style={{ background: 'none', border: 'none', color: C.pri, cursor: 'pointer', fontWeight: 800, padding: 0, fontSize: 13 }}>✕</button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={{ background: C.sur, border: `1px solid ${C.brd}`, borderRadius: 16, padding: 18, marginBottom: 18 }}>
          <div style={{ fontSize: 12.5, fontWeight: 700, color: C.txm, marginBottom: 10 }}>Motivo della visita (opzionale)</div>
          <input value={motivo} onChange={e => setMotivo(e.target.value)} placeholder="es. Visita di controllo, dolore, pulizia..." style={{ ...inputStyle, width: '100%', marginBottom: 8 }} />
          <textarea value={note} onChange={e => setNote(e.target.value)} placeholder="Altre note per lo studio..." rows={3} style={{ ...inputStyle, width: '100%', resize: 'vertical', fontFamily: 'inherit' }} />
        </div>

        {errore && <div style={{ background: C.danL, color: C.dan, borderRadius: 10, padding: '10px 14px', fontSize: 13, marginBottom: 14, textAlign: 'center' }}>{errore}</div>}

        <button
          onClick={invia}
          disabled={!formValido || invioInCorso}
          style={{
            width: '100%', padding: '14px 0', borderRadius: 12, border: 'none',
            background: formValido ? C.pri : C.brd, color: formValido ? '#fff' : C.txl,
            fontWeight: 800, fontSize: 15, cursor: formValido ? 'pointer' : 'default',
          }}
        >
          {invioInCorso ? 'Invio in corso…' : 'Invia richiesta'}
        </button>
        <div style={{ fontSize: 11, color: C.txl, textAlign: 'center', marginTop: 10 }}>
          Questa non è una prenotazione confermata: lo studio ti ricontatterà per fissare l'appuntamento.
        </div>
      </div>
    </div>
  );
}

const inputStyle = {
  flex: 1, padding: '11px 12px', border: `1.5px solid ${C.brd}`, borderRadius: 10,
  fontSize: 15, color: C.txt, background: C.sur, boxSizing: 'border-box',
};
