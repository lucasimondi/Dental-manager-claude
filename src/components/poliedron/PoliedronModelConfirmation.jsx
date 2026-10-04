import React, { useState } from 'react';

export default function PoliedronModelConfirmation({ pending, busy, onDecision }) {
  const [used, setUsed] = useState(false);
  const expired = Date.now() >= pending.expiresAt;
  const decide = (cancelled) => {
    if (used || busy || expired) return;
    setUsed(true);
    onDecision?.(pending, cancelled);
  };
  return <section aria-label="Conferma operazione agenda" style={{ padding: 16, border: '1px solid #c7d2fe', borderRadius: 16, background: '#f5f7ff', overflowWrap: 'anywhere' }}>
    <h3 style={{ marginTop: 0 }}>Controlla l’appuntamento</h3>
    <p style={{ whiteSpace: 'pre-wrap' }}>{pending.summary}</p>
    <p>Nessuna modifica finché non confermi.</p>
    {expired && <p role="status">Conferma scaduta. Ripeti la richiesta.</p>}
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
      <button type="button" disabled={busy || used || expired} onClick={() => decide(false)} style={{ minHeight: 44, padding: '10px 18px', background: '#4338ca', color: 'white', border: 0, borderRadius: 10 }}>Conferma</button>
      <button type="button" disabled={busy || used || expired} onClick={() => decide(true)} style={{ minHeight: 44, padding: '10px 18px', borderRadius: 10 }}>Non procedere</button>
    </div>
  </section>;
}
