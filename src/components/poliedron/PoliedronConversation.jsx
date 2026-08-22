import React from 'react';
import { C } from '../../lib/utils';
import { Ic } from '../ui';

/* POL-AI-001 §5 — the extended-conversation surface only appears when an
   ANALYZE/ASK answer exists; it is never the primary/first thing shown
   (the command bar + grouped results are — see PoliedronPanel). */
export default function PoliedronConversation({ query, answer, loading }) {
  return (
    <div style={{ padding: '4px 2px' }}>
      <div style={{ alignSelf: 'flex-end', background: C.pri, color: '#fff', borderRadius: 12, padding: '8px 12px', fontSize: 13, marginBottom: 10, display: 'inline-block', maxWidth: '85%' }}>
        {query}
      </div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
        <div style={{ width: 24, height: 24, borderRadius: 8, background: C.priL, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 2 }}>
          <Ic n="spark" s={13} c={C.pri} />
        </div>
        {loading ? (
          <span style={{ fontSize: 13, color: C.txl }}>Sto verificando…</span>
        ) : (
          <span style={{ fontSize: 13.5, color: C.txt, lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{answer}</span>
        )}
      </div>
    </div>
  );
}
