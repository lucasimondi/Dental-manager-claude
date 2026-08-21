import React, { useState, useEffect } from 'react';
import { Btn, Modal, Ic } from './ui';
import { C } from '../lib/utils';

export default function DupModal({ patients, setPatients, onClose }) {
  const chiaveDup = (p) => `${(p.nome || '').trim().toLowerCase()}|${(p.cognome || '').trim().toLowerCase()}`;
  const gruppi = (() => {
    const mappa = {};
    patients.forEach((p) => {
      const k = chiaveDup(p);
      if (!k.trim() || k === '|') return;
      if (!mappa[k]) mappa[k] = [];
      mappa[k].push(p);
    });
    return Object.values(mappa).filter((g) => g.length > 1);
  })();

  const [daEliminare, setDaEliminare] = useState(new Set());
  const toggleElimina = (id) => setDaEliminare((prev) => {
    const s = new Set(prev);
    s.has(id) ? s.delete(id) : s.add(id);
    return s;
  });

  useEffect(() => {
    const auto = new Set();
    gruppi.forEach((g) => {
      const ordinati = [...g].sort((a, b) => a.id - b.id);
      ordinati.slice(1).forEach((p) => auto.add(p.id));
    });
    setDaEliminare(auto);
  }, []);

  const confermaElimina = () => {
    if (daEliminare.size === 0) return;
    if (!confirm(`Eliminare ${daEliminare.size} pazienti duplicati selezionati? L'operazione non è reversibile.`)) return;
    setPatients((prev) => prev.filter((p) => !daEliminare.has(p.id)));
    onClose();
  };

  return (
    <Modal title="Pazienti duplicati" icon="warn" iconColor={C.war} onClose={onClose} wide>
      <div style={{ fontSize: 12, color: C.txm, marginBottom: 14, lineHeight: 1.5 }}>
        Trovati <b>{gruppi.length}</b> gruppi di pazienti con nome e cognome uguali. Sono preselezionate le copie da eliminare (viene tenuta quella inserita per prima). Controlla e modifica la selezione se necessario.
      </div>
      {gruppi.map((g, gi) => (
        <div key={gi} style={{ marginBottom: 14, border: `1px solid ${C.brd}`, borderRadius: 10, overflow: 'hidden' }}>
          <div style={{ background: C.bg, padding: '8px 12px', fontSize: 12, fontWeight: 800, color: C.txt }}>
            {g[0].nome} {g[0].cognome} <span style={{ fontWeight: 500, color: C.txl }}>({g.length} copie)</span>
          </div>
          {[...g].sort((a, b) => a.id - b.id).map((p, pi) => {
            const sel = daEliminare.has(p.id);
            return (
              <div key={p.id} onClick={() => toggleElimina(p.id)} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', borderTop: `1px solid ${C.brd}`, cursor: 'pointer', background: sel ? C.danL : '#fff' }}>
                <div style={{ width: 20, height: 20, borderRadius: 5, border: `2px solid ${sel ? C.dan : C.brd}`, background: sel ? C.dan : '#fff', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {sel && <Ic n="ok" s={11} c="#fff" />}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 5 }}>{pi === 0 && <Ic n="medal" s={11} c={C.war} />}{pi === 0 ? 'Primo inserito' : `Copia ${pi + 1}`} {sel ? '— verrà eliminato' : '— verrà mantenuto'}</div>
                  <div style={{ fontSize: 11, color: C.txl }}>{p.telefono || '—'}{p.cf ? ' · ' + p.cf : ''}{p.email ? ' · ' + p.email : ''}</div>
                </div>
              </div>
            );
          })}
        </div>
      ))}
      <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
        <Btn ch="Annulla" v="sec" onClick={onClose} full />
        <Btn ch={`Elimina ${daEliminare.size} duplicati`} v="dan" onClick={confermaElimina} dis={daEliminare.size === 0} full />
      </div>
    </Modal>
  );
}
