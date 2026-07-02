import React, { useState } from 'react';
import { supabase } from '../lib/supabase.js';
import { C } from '../lib/utils';

export default function Login({ onLogin }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const login = async () => {
    if (!email || !password) return;
    setLoading(true);
    setError('');
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) { setError(error.message); setLoading(false); return; }
    onLogin(data.session);
    setLoading(false);
  };

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #0F2940 0%, #1A4E66 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ width: '100%', maxWidth: 380 }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ fontSize: 40, marginBottom: 8 }}>🦷</div>
          <div style={{ fontSize: 28, fontWeight: 900, color: '#fff', letterSpacing: '-0.5px' }}>DentalManager</div>
          <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', marginTop: 4 }}>Gestione studio dentistico</div>
        </div>

        {/* Card */}
        <div style={{ background: '#fff', borderRadius: 20, padding: 28, boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
          <div style={{ fontSize: 18, fontWeight: 800, color: C.txt, marginBottom: 20 }}>Accedi al tuo studio</div>

          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: C.txm, marginBottom: 5 }}>Email</div>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && login()}
              placeholder="email@studio.it"
              style={{ width: '100%', padding: '12px 14px', border: `1.5px solid ${C.brd}`, borderRadius: 10, fontSize: 14, color: C.txt, background: C.bg, boxSizing: 'border-box', outline: 'none', fontFamily: 'inherit' }}
            />
          </div>

          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: C.txm, marginBottom: 5 }}>Password</div>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && login()}
              placeholder="••••••••"
              style={{ width: '100%', padding: '12px 14px', border: `1.5px solid ${C.brd}`, borderRadius: 10, fontSize: 14, color: C.txt, background: C.bg, boxSizing: 'border-box', outline: 'none', fontFamily: 'inherit' }}
            />
          </div>

          {error && (
            <div style={{ background: '#FDECEA', border: '1px solid #E63946', borderRadius: 8, padding: '10px 12px', marginBottom: 14, fontSize: 12, color: '#E63946', fontWeight: 600 }}>
              {error === 'Invalid login credentials' ? 'Email o password errati' : error}
            </div>
          )}

          <button onClick={login} disabled={loading || !email || !password} style={{ width: '100%', padding: '13px', background: loading ? C.txl : C.pri, border: 'none', borderRadius: 12, color: '#fff', fontWeight: 800, fontSize: 15, cursor: loading ? 'not-allowed' : 'pointer' }}>
            {loading ? '⏳ Accesso...' : 'Accedi →'}
          </button>
        </div>

        <div style={{ textAlign: 'center', marginTop: 16, fontSize: 11, color: 'rgba(255,255,255,0.3)' }}>
          DentalManager © 2025 · Dott. Luca Simondi
        </div>
      </div>
    </div>
  );
}
