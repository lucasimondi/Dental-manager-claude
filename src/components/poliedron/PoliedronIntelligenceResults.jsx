import React from 'react';
import { C } from '../../lib/utils';
import { Ic } from '../ui';

const percent = (value) => `${Math.round((value || 0) * 100)}%`;

export default function PoliedronIntelligenceResults({ intelligence, onOpenPatient }) {
  const groups = (intelligence?.groups || []).filter((group) => group.items.length);
  const contactCount = intelligence?.groups?.find((group) => group.group === 'DA CONTATTARE')?.items.length || 0;
  const qualityCount = intelligence?.groups?.find((group) => group.group === 'DATI DA COMPLETARE')?.items.length || 0;
  const health = intelligence?.studioDataHealth;

  return (
    <div className="poliedron-intelligence" aria-label="Risultati intelligence Poliedron">
      <div style={{ padding: '2px 2px 12px', color: C.txm, fontSize: 12.5, lineHeight: 1.5 }}>
        {contactCount > 0
          ? `Ho trovato ${contactCount} ${contactCount === 1 ? 'paziente da valutare' : 'pazienti da valutare'}.`
          : 'Non risultano pazienti da contattare sulla base dei dati verificabili.'}
        {qualityCount > 0 && ` ${qualityCount} ${qualityCount === 1 ? 'scheda ha' : 'schede hanno'} dati che riducono l’affidabilità dell’analisi.`}
      </div>

      {groups.map((group) => (
        <section key={group.group} style={{ marginBottom: 14 }} aria-label={group.group}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 3px 6px' }}>
            <strong style={{ fontSize: 10.5, color: C.txl, letterSpacing: '0.06em' }}>{group.group}</strong>
            <span style={{ fontSize: 10.5, fontWeight: 800, color: C.pri }}>{group.items.length}</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
            {group.items.map((result) => (
              <article
                key={`${group.group}-${result.patientId}`}
                className="poliedron-intelligence__patient"
                style={{ border: `1px solid ${C.brd}`, background: C.sur, borderRadius: 12, padding: '11px 12px', minWidth: 0 }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 9 }}>
                  <span style={{ width: 28, height: 28, borderRadius: 9, background: C.priL, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Ic n="pz" s={14} c={C.pri} />
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
                      <strong style={{ fontSize: 13.5, color: C.txt, overflowWrap: 'anywhere' }}>{result.patientName}</strong>
                      <span style={{ fontSize: 10, color: C.txl, whiteSpace: 'nowrap' }}>Priorità {result.score} · Confidenza {percent(result.confidence)}</span>
                    </div>
                    <ul style={{ margin: '7px 0 0', paddingLeft: 17, color: C.txm, fontSize: 11.5, lineHeight: 1.45 }}>
                      {result.visibleSignals.map((signal, index) => (
                        <li key={`${signal.type}-${signal.sourceId || index}`}>{signal.reason}</li>
                      ))}
                    </ul>
                    <button
                      type="button"
                      onClick={() => onOpenPatient?.({ kind: 'intelligence-patient', id: result.patientId, data: result })}
                      style={{ marginTop: 8, padding: 0, border: 'none', background: 'transparent', color: C.pri, fontSize: 11.5, fontWeight: 800, cursor: 'pointer' }}
                    >
                      Apri paziente
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>
      ))}

      {health && (
        <aside style={{ borderRadius: 12, padding: '10px 12px', background: C.bg, border: `1px solid ${C.brd}` }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'baseline' }}>
            <strong style={{ fontSize: 12, color: C.txt }}>{health.name}</strong>
            <span style={{ fontSize: 12, fontWeight: 800, color: C.pri }}>
              {health.available === false ? 'Non disponibile' : `${health.score}/100`}
            </span>
          </div>
          <div style={{ marginTop: 4, fontSize: 10.5, lineHeight: 1.45, color: C.txl }}>
            Indicatore operativo non clinico. {health.message}
          </div>
        </aside>
      )}
    </div>
  );
}
