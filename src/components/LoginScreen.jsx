import React, { useState } from 'react';
import RegisterScreen from './RegisterScreen.jsx';
import Ic from './ui/Ic.jsx';
import { supabase } from '../lib/supabase.js';

export default function LoginScreen({ onLogin }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);
  const [showRegister, setShowRegister] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (!email || !password) return;
    setErr('');
    setLoading(true);
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      setErr(error.message === 'Invalid login credentials' ? 'Email o password errati.' : error.message);
      return;
    }
    onLogin(data.user);
  };

  if (showRegister) return <RegisterScreen onBack={() => setShowRegister(false)} />;

  return (
    <div style={{
      minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'linear-gradient(135deg,#124E66,#1A6B8A)', padding: 20,
    }}>
      <div style={{
        background: '#fff', borderRadius: 18, padding: '34px 26px', width: '100%',
        maxWidth: 380, boxShadow: '0 10px 40px rgba(0,0,0,0.25)',
      }}>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div style={{
            background: '#2EC4B6', borderRadius: 14, width: 54, height: 54, display: 'flex',
            alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px',
          }}>
            <Ic n="tooth" s={28} c="#fff" />
          </div>
          <div style={{ fontSize: 20, fontWeight: 800, color: '#1A202C' }}>DentalManager</div>
          <div style={{ fontSize: 12, color: '#718096', marginTop: 2 }}>Accedi al tuo studio</div>
        </div>
        <form onSubmit={submit}>
          <div style={{ marginBottom: 14 }}>
            <label style={{
              display: 'block', fontSize: 11, fontWeight: 700, color: '#4A5568', marginBottom: 5,
              textTransform: 'uppercase', letterSpacing: '0.05em',
            }}>
              Email
            </label>
            <input
              type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="username"
              style={{ width: '100%', padding: '12px 13px', border: '1.5px solid #E2E8F0', borderRadius: 10, fontSize: 16, boxSizing: 'border-box' }}
            />
          </div>
          <div style={{ marginBottom: 18 }}>
            <label style={{
              display: 'block', fontSize: 11, fontWeight: 700, color: '#4A5568', marginBottom: 5,
              textTransform: 'uppercase', letterSpacing: '0.05em',
            }}>
              Password
            </label>
            <input
              type="password" value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="current-password"
              style={{ width: '100%', padding: '12px 13px', border: '1.5px solid #E2E8F0', borderRadius: 10, fontSize: 16, boxSizing: 'border-box' }}
            />
          </div>
          {err && (
            <div style={{ background: '#FDECEA', color: '#C53030', padding: '9px 12px', borderRadius: 8, fontSize: 12, fontWeight: 600, marginBottom: 14 }}>
              {err}
            </div>
          )}
          <button
            type="submit" disabled={loading}
            style={{
              width: '100%', padding: '13px 0', background: loading ? '#999' : '#1A6B8A', color: '#fff',
              border: 'none', borderRadius: 10, fontWeight: 800, fontSize: 15, cursor: loading ? 'wait' : 'pointer',
            }}
          >
            {loading ? 'Accesso in corso…' : 'Accedi'}
          </button>
        </form>
        <div style={{ textAlign: 'center', marginTop: 16 }}>
          <button onClick={() => setShowRegister(true)} style={{ background: 'none', border: 'none', color: '#718096', fontSize: 13, cursor: 'pointer', textDecoration: 'underline' }}>
            Nuovo studio? Registrati
          </button>
        </div>
      </div>
    </div>
  );
}
