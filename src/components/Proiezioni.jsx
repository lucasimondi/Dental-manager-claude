import React, { useState, useEffect, useCallback } from 'react';
import { Crd, Btn } from './ui';
import { C, fmt } from '../lib/utils';
import { supabase } from '../lib/supabase.js';
import { loadCanonicalFinancialSnapshot } from '../lib/canonicalFinancialSelectors';

const MESI = ['Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu', 'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic'];

const SectionLabel = ({ children }) => (
  <div style={{ fontSize: 11, fontWeight: 800, color: C.txm, textTransform: 'uppercase', letterSpacing: '0.06em', marginTop: 4, marginBottom: 8 }}>{children}</div>
);

// Input numerico compatto, editing "libero" (stringa in stato locale finché non esce dal focus)
const NumCell = ({ value, onChange }) => (
  <input
    type="number"
    inputMode="decimal"
    value={value}
    onChange={(e) => onChange(e.target.value)}
    placeholder="0"
    style={{
      width: '100%', padding: '7px 6px', border: `1.5px solid ${C.brd}`, borderRadius: 8,
      fontSize: 13, color: C.txt, background: C.sur, boxSizing: 'border-box', textAlign: 'right',
    }}
  />
);

const MeseCard = ({ label, dirty, mese, riga, realeMese, onChange, aperto, onToggle }) => {
  const inc = Number(riga.incassato_target) || 0;
  const fissi = Number(riga.costi_fissi_target) || 0;
  const varr = Number(riga.costi_variabili_target) || 0;
  const haTarget = riga.incassato_target !== '' || riga.costi_fissi_target !== '' || riga.costi_variabili_target !== '';
  const margineTarget = haTarget ? inc - fissi - varr : null;
  const margineReale = realeMese?.ebitda_operativo_gestionale;
  const haReale = margineReale !== undefined && margineReale !== null;

  return (
    <Crd style={{ padding: 0, overflow: 'hidden' }}>
      <button onClick={onToggle} style={{
        width: '100%', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left',
        padding: '11px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 13.5, fontWeight: 800, color: C.txt }}>{label}</span>
          {dirty && <span style={{ color: C.war, fontSize: 14 }}>●</span>}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 9, color: C.txl, textTransform: 'uppercase', fontWeight: 700 }}>Scenario cassa</div>
            <div style={{ fontSize: 13, fontWeight: 800, color: margineTarget == null ? C.txl : (margineTarget >= 0 ? C.suc : C.dan) }}>{margineTarget == null ? '—' : fmt(margineTarget)}</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 9, color: C.txl, textTransform: 'uppercase', fontWeight: 700 }}>EBITDA reale</div>
            <div style={{ fontSize: 13, fontWeight: 800, color: !haReale ? C.txl : (margineReale >= 0 ? C.suc : C.dan) }}>{haReale ? fmt(margineReale) : '—'}</div>
          </div>
          <span style={{ fontSize: 11, color: C.txl }}>{aperto ? '▲' : '▼'}</span>
        </div>
      </button>

      {aperto && (
        <div style={{ borderTop: `1px solid ${C.brd}`, padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div>
            <div style={{ fontSize: 10, color: C.txl, marginBottom: 3, fontWeight: 700 }}>Incassato target €</div>
            <NumCell value={riga.incassato_target} onChange={(v) => onChange(mese, 'incassato_target', v)} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <div>
              <div style={{ fontSize: 10, color: C.txl, marginBottom: 3, fontWeight: 700 }}>Costi fissi target €</div>
              <NumCell value={riga.costi_fissi_target} onChange={(v) => onChange(mese, 'costi_fissi_target', v)} />
            </div>
            <div>
              <div style={{ fontSize: 10, color: C.txl, marginBottom: 3, fontWeight: 700 }}>Costi variabili target €</div>
              <NumCell value={riga.costi_variabili_target} onChange={(v) => onChange(mese, 'costi_variabili_target', v)} />
            </div>
          </div>
        </div>
      )}
    </Crd>
  );
};

export default function Proiezioni({ studioId }) {
  const [anno, setAnno] = useState(new Date().getFullYear());
  const [righe, setRighe] = useState({}); // { mese: { incassato_target, costi_fissi_target, costi_variabili_target } }
  const [reale, setReale] = useState({}); // { mese: { incassato, costi_fissi, costi_variabili, margine } }
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const [dirty, setDirty] = useState({}); // { mese: true } — righe modificate non ancora salvate
  const [aperto, setAperto] = useState(null); // mese attualmente espanso, uno alla volta

  const vuota = () => ({ incassato_target: '', costi_fissi_target: '', costi_variabili_target: '' });

  const load = useCallback(async () => {
    setLoading(true);
    setMsg('');

    const { data: budgetRows } = await supabase
      .from('budget')
      .select('*')
      .eq('studio_id', studioId)
      .eq('anno', anno);

    const nuoveRighe = {};
    for (let m = 1; m <= 12; m++) nuoveRighe[m] = vuota();
    (budgetRows || []).forEach((r) => {
      nuoveRighe[r.mese] = {
        incassato_target: r.incassato_target ?? '',
        costi_fissi_target: r.costi_fissi_target ?? '',
        costi_variabili_target: r.costi_variabili_target ?? '',
      };
    });
    setRighe(nuoveRighe);
    setDirty({});

    const promesse = [];
    for (let m = 1; m <= 12; m++) {
      const da = `${anno}-${String(m).padStart(2, '0')}-01`;
      const ultimoGiorno = new Date(anno, m, 0).getDate();
      const a = `${anno}-${String(m).padStart(2, '0')}-${ultimoGiorno}`;
      promesse.push(
        loadCanonicalFinancialSnapshot(supabase, da, a, studioId)
          .then(({ snapshot }) => ({ mese: m, data: snapshot }))
      );
    }
    const risultati = await Promise.all(promesse);
    const nuovoReale = {};
    risultati.forEach(({ mese, data }) => { nuovoReale[mese] = data; });
    setReale(nuovoReale);

    setLoading(false);
  }, [studioId, anno]);

  useEffect(() => { load(); }, [load]);

  const aggiorna = (mese, campo, valore) => {
    setRighe((prev) => ({ ...prev, [mese]: { ...prev[mese], [campo]: valore } }));
    setDirty((prev) => ({ ...prev, [mese]: true }));
  };

  const salvaTutto = async () => {
    const mesiDaSalvare = Object.keys(dirty).map(Number);
    if (mesiDaSalvare.length === 0) return;
    setSaving(true);
    setMsg('');
    const righeUpsert = mesiDaSalvare.map((m) => ({
      studio_id: studioId,
      anno,
      mese: m,
      incassato_target: Number(righe[m].incassato_target) || 0,
      costi_fissi_target: Number(righe[m].costi_fissi_target) || 0,
      costi_variabili_target: Number(righe[m].costi_variabili_target) || 0,
    }));
    const { error } = await supabase.from('budget').upsert(righeUpsert, { onConflict: 'studio_id,anno,mese' });
    setSaving(false);
    if (error) { setMsg('Errore: ' + error.message); return; }
    setMsg('Salvato ✓');
    setDirty({});
    setTimeout(() => setMsg(''), 2500);
  };

  const totale = (campo) => Object.values(righe).reduce((s, r) => s + (Number(r[campo]) || 0), 0);
  const totaleMargineTarget = totale('incassato_target') - totale('costi_fissi_target') - totale('costi_variabili_target');
  const totaleMargineReale = Object.values(reale).reduce((s, r) => s + (r?.ebitda_operativo_gestionale != null ? Number(r.ebitda_operativo_gestionale) : 0), 0);

  return (
    <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 14 }}>

      <div style={{ background: `linear-gradient(135deg, ${C.priD}, ${C.pri})`, borderRadius: 16, padding: '16px 16px 14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <div style={{ fontSize: 15, fontWeight: 800, color: '#fff' }}>Budget {anno}</div>
            <span style={{ fontSize: 9, fontWeight: 800, color: 'rgba(255,255,255,0.65)', background: 'rgba(255,255,255,0.12)', padding: '2px 7px', borderRadius: 20, textTransform: 'uppercase', letterSpacing: 0.4 }}>Scenario e consuntivo</span>
          </div>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <button onClick={() => setAnno((a) => a - 1)} style={{ background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: 6, color: '#fff', width: 26, height: 26, cursor: 'pointer', fontWeight: 800 }}>‹</button>
            <div style={{ color: '#fff', fontWeight: 800, fontSize: 14, minWidth: 40, textAlign: 'center' }}>{anno}</div>
            <button onClick={() => setAnno((a) => a + 1)} style={{ background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: 6, color: '#fff', width: 26, height: 26, cursor: 'pointer', fontWeight: 800 }}>›</button>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: '8px 0', borderTop: '1px solid rgba(255,255,255,0.15)' }}>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.75)' }}>Risultato di cassa ipotetico</div>
          <div style={{ fontSize: 17, fontWeight: 800, color: '#fff' }}>{fmt(totaleMargineTarget)}</div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: '8px 0', borderTop: '1px solid rgba(255,255,255,0.15)' }}>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.75)' }}>EBITDA gestionale reale finora</div>
          <div style={{ fontSize: 17, fontWeight: 800, color: totaleMargineReale >= 0 ? '#8CFFB0' : '#FFB0B0' }}>{fmt(totaleMargineReale)}</div>
        </div>

        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)', marginTop: 8, lineHeight: 1.4 }}>
          Lo scenario di cassa è ipotetico e non viene confrontato direttamente con l’EBITDA reale. Tocca un mese per modificarlo.
        </div>
      </div>

      {loading ? (
        <div style={{ color: C.txl, fontSize: 13, padding: '20px 0', textAlign: 'center' }}>Caricamento…</div>
      ) : (
        <>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {MESI.map((label, i) => {
              const m = i + 1;
              return (
                <MeseCard
                  key={m}
                  label={label}
                  mese={m}
                  riga={righe[m] || vuota()}
                  realeMese={reale[m]}
                  dirty={!!dirty[m]}
                  aperto={aperto === m}
                  onToggle={() => setAperto(aperto === m ? null : m)}
                  onChange={aggiorna}
                />
              );
            })}
          </div>

          <div style={{ position: 'sticky', bottom: 8, display: 'flex', justifyContent: 'center' }}>
            <Crd style={{ padding: '8px 10px', display: 'flex', alignItems: 'center', gap: 10, boxShadow: '0 4px 14px rgba(0,0,0,0.15)' }}>
              <Btn ch={saving ? 'Salvo…' : `Salva${Object.keys(dirty).length ? ` (${Object.keys(dirty).length})` : ''}`} onClick={salvaTutto} dis={saving || Object.keys(dirty).length === 0} sz="sm" />
              {msg && <span style={{ fontSize: 12, color: msg.startsWith('Errore') ? C.dan : C.suc, fontWeight: 700 }}>{msg}</span>}
            </Crd>
          </div>
        </>
      )}
    </div>
  );
}
