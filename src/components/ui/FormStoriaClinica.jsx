import React, { useState } from 'react';

/**
 * Form di compilazione anamnesi/storia clinica: voci con Sì/No/Non so +
 * note, più liste separate per farmaci e allergie. Riusato sia nel flusso
 * in studio (dentro SchedaPaz) sia nella pagina pubblica di firma remota —
 * stesso componente, cambia solo chi lo inquadra e cosa succede al submit.
 */
export default function FormStoriaClinica({ voci, onCompilato, C, testoBottone = 'Avanti' }) {
  const [risposte, setRisposte] = useState(() => voci.map(v => ({ chiave: v.chiave, titolo: v.titolo, valore: '', note: '' })));
  const [farmaci, setFarmaci] = useState([]);
  const [allergie, setAllergie] = useState([]);
  const [nuovoFarmaco, setNuovoFarmaco] = useState('');
  const [nuovaAllergia, setNuovaAllergia] = useState('');

  const setValore = (chiave, valore) => setRisposte(prev => prev.map(r => r.chiave === chiave ? { ...r, valore } : r));
  const setNota = (chiave, note) => setRisposte(prev => prev.map(r => r.chiave === chiave ? { ...r, note } : r));

  const aggiungiFarmaco = () => {
    if (!nuovoFarmaco.trim()) return;
    setFarmaci(prev => [...prev, { nome: nuovoFarmaco.trim() }]);
    setNuovoFarmaco('');
  };
  const aggiungiAllergia = () => {
    if (!nuovaAllergia.trim()) return;
    setAllergie(prev => [...prev, { sostanza: nuovaAllergia.trim() }]);
    setNuovaAllergia('');
  };

  const tutteRisposte = risposte.every(r => r.valore);

  return (
    <div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
        {risposte.map((r) => (
          <div key={r.chiave} style={{ border: `1px solid ${C.brd}`, borderRadius: 10, padding: 11 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: C.txt, marginBottom: 8 }}>{r.titolo}</div>
            <div style={{ display: 'flex', gap: 6, marginBottom: r.valore === 'si' ? 8 : 0 }}>
              {[['si', 'Sì'], ['no', 'No'], ['non_so', 'Non so']].map(([val, lbl]) => (
                <button
                  key={val}
                  onClick={() => setValore(r.chiave, val)}
                  style={{ flex: 1, padding: '8px 0', borderRadius: 8, border: `1.5px solid ${r.valore === val ? C.pri : C.brd}`, background: r.valore === val ? C.priL : '#fff', color: r.valore === val ? C.pri : C.txm, fontWeight: 700, fontSize: 12.5, cursor: 'pointer' }}
                >
                  {lbl}
                </button>
              ))}
            </div>
            {r.valore === 'si' && (
              <input
                value={r.note}
                onChange={(e) => setNota(r.chiave, e.target.value)}
                placeholder="Dettagli (opzionale)"
                style={{ width: '100%', padding: '8px 10px', border: `1.5px solid ${C.brd}`, borderRadius: 8, fontSize: 12.5, color: C.txt, boxSizing: 'border-box' }}
              />
            )}
          </div>
        ))}
      </div>

      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 12.5, fontWeight: 700, color: C.txm, marginBottom: 8 }}>Farmaci assunti</div>
        {farmaci.map((f, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, background: C.bg, borderRadius: 8, padding: '7px 10px', marginBottom: 6 }}>
            <span style={{ flex: 1, fontSize: 12.5, color: C.txt }}>{f.nome}</span>
            <button onClick={() => setFarmaci(prev => prev.filter((_, j) => j !== i))} style={{ background: 'none', border: 'none', color: C.txl, cursor: 'pointer', fontSize: 14 }}>✕</button>
          </div>
        ))}
        <div style={{ display: 'flex', gap: 8 }}>
          <input value={nuovoFarmaco} onChange={(e) => setNuovoFarmaco(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && aggiungiFarmaco()} placeholder="Nome farmaco" style={{ flex: 1, padding: '9px 11px', border: `1.5px solid ${C.brd}`, borderRadius: 9, fontSize: 13, boxSizing: 'border-box' }} />
          <button onClick={aggiungiFarmaco} style={{ background: C.pri, border: 'none', borderRadius: 9, padding: '0 16px', color: '#fff', fontWeight: 700, cursor: 'pointer' }}>+</button>
        </div>
      </div>

      <div style={{ marginBottom: 18 }}>
        <div style={{ fontSize: 12.5, fontWeight: 700, color: C.txm, marginBottom: 8 }}>Allergie</div>
        {allergie.map((a, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, background: C.bg, borderRadius: 8, padding: '7px 10px', marginBottom: 6 }}>
            <span style={{ flex: 1, fontSize: 12.5, color: C.txt }}>{a.sostanza}</span>
            <button onClick={() => setAllergie(prev => prev.filter((_, j) => j !== i))} style={{ background: 'none', border: 'none', color: C.txl, cursor: 'pointer', fontSize: 14 }}>✕</button>
          </div>
        ))}
        <div style={{ display: 'flex', gap: 8 }}>
          <input value={nuovaAllergia} onChange={(e) => setNuovaAllergia(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && aggiungiAllergia()} placeholder="Sostanza" style={{ flex: 1, padding: '9px 11px', border: `1.5px solid ${C.brd}`, borderRadius: 9, fontSize: 13, boxSizing: 'border-box' }} />
          <button onClick={aggiungiAllergia} style={{ background: C.pri, border: 'none', borderRadius: 9, padding: '0 16px', color: '#fff', fontWeight: 700, cursor: 'pointer' }}>+</button>
        </div>
      </div>

      <button
        onClick={() => onCompilato({ risposte, farmaci, allergie })}
        disabled={!tutteRisposte}
        style={{ width: '100%', padding: '13px 0', borderRadius: 12, border: 'none', background: tutteRisposte ? C.pri : C.brd, color: tutteRisposte ? '#fff' : C.txl, fontWeight: 800, fontSize: 14.5, cursor: tutteRisposte ? 'pointer' : 'default' }}
      >
        {testoBottone}
      </button>
      {!tutteRisposte && <div style={{ fontSize: 11, color: C.txl, textAlign: 'center', marginTop: 8 }}>Rispondi a tutte le voci per continuare</div>}
    </div>
  );
}
