import React, { useState } from 'react';
import { supabase } from '../lib/supabase.js';
import { VERTICALI_DISPONIBILI } from '../lib/utils';
import logoDental from '../assets/logo-poliedra-dental-transparent.png';
import logoSalus from '../assets/logo-poliedra-salus-transparent.png';

export default function RegisterScreen({ onBack }) {
  const [step, setStep] = useState(1); // 1=dati studio, 2=credenziali, 3=successo
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const [form, setForm] = useState({
    nomeStudio: '', email: '', password: '', confermaPassword: '',
    nomeMedico: '', telefono: '', indirizzo: '', citta: '', piva: '', vertical: 'dentistico', verticalAltro: '',
  });
  const F = (f) => setForm(p => ({ ...p, ...f }));

  const registra = async () => {
    if (form.password !== form.confermaPassword) { setErr('Le password non coincidono'); return; }
    if (form.password.length < 8) { setErr('Password minimo 8 caratteri'); return; }
    setLoading(true); setErr('');
    try {
      // 1. Crea lo studio PRIMA del signup (funzione sicura, utilizzabile anche da utente non autenticato).
      //    L'ordine è importante: il trigger che collega lo studio all'utente cerca lo studio
      //    per email al momento della creazione dell'utente Auth, quindi deve già esistere.
      const { error: studioErr } = await supabase.rpc('register_studio', {
        p_nome: form.nomeStudio,
        p_email: form.email,
        p_piano: 'base',
        p_vertical: form.vertical,
        p_vertical_altro: form.vertical === 'altro' ? form.verticalAltro : null,
      });
      if (studioErr) throw studioErr;

      // 2. Crea utente Auth — il trigger sul database collega automaticamente lo studio_id
      //    in app_metadata (sicuro, letto dalle policy RLS) e pre-crea la riga studio_info
      //    con il vertical scelto sopra.
      const { error: authErr } = await supabase.auth.signUp({
        email: form.email,
        password: form.password,
        options: { data: { nome_studio: form.nomeStudio } }
      });
      if (authErr) throw authErr;

      setStep(3);
    } catch (e) {
      setErr(e.message === 'User already registered' ? 'Email già registrata' : e.message);
    }
    setLoading(false);
  };

  const inp = (label, key, type = 'text', placeholder = '') => (
    <div style={{ marginBottom: 14 }}>
      <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#4A5568', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</label>
      <input type={type} value={form[key]} onChange={e => F({ [key]: e.target.value })} placeholder={placeholder}
        style={{ width: '100%', padding: '12px 13px', border: '1.5px solid #E2E8F0', borderRadius: 10, fontSize: 15, boxSizing: 'border-box', fontFamily: 'inherit' }} />
    </div>
  );

  return (
    <div style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg,#124E66,#1A6B8A)', padding: 20 }}>
      <div style={{ background: '#fff', borderRadius: 18, padding: '34px 26px', width: '100%', maxWidth: 420, boxShadow: '0 10px 40px rgba(0,0,0,0.25)' }}>

        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <img
            src={form.vertical === 'dentistico' ? logoDental : logoSalus}
            alt="Poliedra"
            style={{ height: 54, margin: '0 auto 12px', display: 'block' }}
          />
          <div style={{ fontSize: 12, color: '#718096', marginTop: 2 }}>Registra il tuo studio</div>
        </div>

        {/* Step indicator */}
        {step < 3 && (
          <div style={{ display: 'flex', gap: 6, marginBottom: 24 }}>
            {[1, 2].map(s => (
              <div key={s} style={{ flex: 1, height: 4, borderRadius: 2, background: s <= step ? '#1A6B8A' : '#E2E8F0' }} />
            ))}
          </div>
        )}

        {/* Step 1: Dati studio */}
        {step === 1 && (
          <>
            <div style={{ fontSize: 15, fontWeight: 800, color: '#1A202C', marginBottom: 16 }}>Dati dello studio</div>
            {inp('Nome studio / medico', 'nomeStudio', 'text', 'es. Studio Dr. Rossi')}
            {inp('Nome e cognome medico', 'nomeMedico', 'text', 'es. Mario Rossi')}
            {inp('Telefono', 'telefono', 'tel', 'es. 320 1234567')}
            {inp('Indirizzo', 'indirizzo', 'text', 'es. Via Roma 1')}
            {inp('Città', 'citta', 'text', 'es. Milano')}
            {inp('P.IVA', 'piva', 'text', 'es. 01234567890')}
            <div style={{ marginBottom: 14 }}>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#4A5568', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Tipo di studio</label>
              <select value={form.vertical} onChange={e => F({ vertical: e.target.value })}
                style={{ width: '100%', padding: '12px 13px', border: '1.5px solid #E2E8F0', borderRadius: 10, fontSize: 15, boxSizing: 'border-box', fontFamily: 'inherit', background: '#fff' }}>
                {VERTICALI_DISPONIBILI.map(v => <option key={v.id} value={v.id}>{v.label}</option>)}
              </select>
            </div>
            {form.vertical === 'altro' && (
              inp('Specifica la tua professione', 'verticalAltro', 'text', 'es. Osteopata, Logopedista...')
            )}
            <button onClick={() => { if (!form.nomeStudio || !form.nomeMedico) { setErr('Compila nome studio e medico'); return; } if (form.vertical === 'altro' && !form.verticalAltro.trim()) { setErr('Specifica la tua professione'); return; } setErr(''); setStep(2); }}
              style={{ width: '100%', padding: '13px 0', background: '#1A6B8A', color: '#fff', border: 'none', borderRadius: 10, fontWeight: 800, fontSize: 15, cursor: 'pointer' }}>
              Continua →
            </button>
          </>
        )}

        {/* Step 2: Credenziali */}
        {step === 2 && (
          <>
            <div style={{ fontSize: 15, fontWeight: 800, color: '#1A202C', marginBottom: 16 }}>Credenziali di accesso</div>
            {inp('Email', 'email', 'email', 'email@studio.it')}
            {inp('Password', 'password', 'password', 'minimo 8 caratteri')}
            {inp('Conferma password', 'confermaPassword', 'password', 'ripeti la password')}
            {err && <div style={{ background: '#FDECEA', color: '#C53030', padding: '9px 12px', borderRadius: 8, fontSize: 12, fontWeight: 600, marginBottom: 14 }}>{err}</div>}
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => { setErr(''); setStep(1); }} style={{ flex: 1, padding: '13px 0', background: '#F0F4F8', color: '#4A5568', border: 'none', borderRadius: 10, fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>← Indietro</button>
              <button onClick={registra} disabled={loading}
                style={{ flex: 2, padding: '13px 0', background: loading ? '#999' : '#1A6B8A', color: '#fff', border: 'none', borderRadius: 10, fontWeight: 800, fontSize: 15, cursor: loading ? 'wait' : 'pointer' }}>
                {loading ? 'Registrazione…' : 'Registrati'}
              </button>
            </div>
          </>
        )}

        {/* Step 3: Successo */}
        {step === 3 && (
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>✅</div>
            <div style={{ fontSize: 18, fontWeight: 800, color: '#1A202C', marginBottom: 8 }}>Studio registrato!</div>
            <div style={{ fontSize: 13, color: '#718096', marginBottom: 24, lineHeight: 1.5 }}>
              Il tuo account è stato creato. Controlla la tua email per confermare l'indirizzo, poi accedi.
            </div>
            <button onClick={onBack} style={{ width: '100%', padding: '13px 0', background: '#1A6B8A', color: '#fff', border: 'none', borderRadius: 10, fontWeight: 800, fontSize: 15, cursor: 'pointer' }}>
              Vai al login →
            </button>
          </div>
        )}

        {/* Link torna al login */}
        {step < 3 && (
          <div style={{ textAlign: 'center', marginTop: 16 }}>
            <button onClick={onBack} style={{ background: 'none', border: 'none', color: '#718096', fontSize: 13, cursor: 'pointer', textDecoration: 'underline' }}>
              Hai già un account? Accedi
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
