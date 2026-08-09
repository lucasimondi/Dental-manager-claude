import React, { useState, useEffect, useCallback } from 'react';
import { Crd, Btn } from './ui';
import { C, fmt } from '../lib/utils';
import { supabase } from '../lib/supabase.js';

const MESI = ['Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu', 'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic'];

const SectionLabel = ({ children }) => (
  <div style={{ fontSize: 11, fontWeight: 800, color: C.txm, textTransform: 'uppercase', letterSpacing: '0.06em', marginTop: 4, marginBottom: 8 }}>{children}</div>
);

// Input numerico compatto, editing "libero" (stringa in stato locale finché non esce dal focus)
const NumCell = ({ value, onChange, placeholder }) => (
  <input
    type="number"
    inputMode="decimal"
    value={value}
    onChange={(e) => onChange(e.target.value)}
    placeholder={placeholder || '0'}
    style={{
      width: '100%', padding: '7px 6px', border: `1.5px solid ${C.brd}`, borderRadius: 8,
      fontSize: 13, color: C.txt, background: C.sur, boxSizing: 'border-box', textAlign: 'right',
    }}
  />
);

export default function Proiezioni({ studioId }) {
  const [anno, setAnno] = useState(new Date().getFullYear());
  const [righe, setRighe] = useState({}); // { mese: { incassato_target, costi_fissi_target, costi_variabili_target } }
  const [reale, setReale] = useState({}); // { mese: { incassato, costi_fissi, costi_variabili, margine } }
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const [dirty, setDirty] = useState({}); // { mese: true } — righe modificate non ancora salvate

  const vuota = () => ({ incassato_target: '', costi_fissi_target: '', costi_variabili_target: '' });

  const load = useCallback(async () => {
    setLoading(true);
    setMsg('');

    // Target salvati per l'anno selezionato
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

    // Reale mese per mese, per il confronto — una chiamata per mese (12 al massimo, va bene)
    const promesse = [];
    for (let m = 1; m <= 12; m++) {
      const da = `${anno}-${String(m).padStart(2, '0')}-01`;
      const ultimoGiorno = new Date(anno, m, 0).getDate();
      const a = `${anno}-${String(m).padStart(2, '0')}-${ultimoGiorno}`;
      promesse.push(
        supabase.rpc('get_kpi_periodo', { p_studio_id: studioId, p_data_inizio: da, p_data_fine: a })
          .then(({ data }) => ({ mese: m, data }))
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

  const margineTarget = (mese) => {
    const r = righe[mese];
    if (!r) return null;
    const inc = Number(r.incassato_target) || 0;
    const fissi = Number(r.costi_fissi_target) || 0;
    const var_ = Number(r.costi_variabili_target) || 0;
    if (r.incassato_target === '' && r.costi_fissi_target === '' && r.costi_variabili_target === '') return null;
    return inc - fissi - var_;
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

  const totaleAnno = (campo) => {
    return Object.values(righe).reduce((s, r) => s + (Number(r[campo]) || 0), 0);
  };

  return (
    <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 18 }}>

      <div style={{ background: `linear-gradient(135deg, ${C.priD}, ${C.pri})`, borderRadius: 16, padding: '16px 16px 14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: '#fff' }}>Budget & Proiezioni</div>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <button onClick={() => setAnno((a) => a - 1)} style={{ background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: 6, color: '#fff', width: 26, height: 26, cursor: 'pointer', fontWeight: 800 }}>‹</button>
            <div style={{ color: '#fff', fontWeight: 800, fontSize: 14, minWidth: 40, textAlign: 'center' }}>{anno}</div>
            <button onClick={() => setAnno((a) => a + 1)} style={{ background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: 6, color: '#fff', width: 26, height: 26, cursor: 'pointer', fontWeight: 800 }}>›</button>
          </div>
        </div>
        <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.75)', lineHeight: 1.5 }}>
          Imposta gli obiettivi mese per mese. Sono numeri ipotetici che non toccano le Spese reali — servono a fissare un target e, in futuro, a fare simulazioni.
        </div>
      </div>

      <div>
        <SectionLabel>🎯 Budget mensile {anno}</SectionLabel>
        {loading ? (
          <div style={{ color: C.txl, fontSize: 13, padding: '20px 0', textAlign: 'center' }}>Caricamento…</div>
        ) : (
          <Crd style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 560 }}>
                <thead>
                  <tr style={{ background: C.bg }}>
                    <th style={{ textAlign: 'left', padding: '8px 10px', fontSize: 10, color: C.txl, fontWeight: 800, textTransform: 'uppercase' }}>Mese</th>
                    <th style={{ textAlign: 'right', padding: '8px 6px', fontSize: 10, color: C.txl, fontWeight: 800, textTransform: 'uppercase' }}>Incassato €</th>
                    <th style={{ textAlign: 'right', padding: '8px 6px', fontSize: 10, color: C.txl, fontWeight: 800, textTransform: 'uppercase' }}>Costi fissi €</th>
                    <th style={{ textAlign: 'right', padding: '8px 6px', fontSize: 10, color: C.txl, fontWeight: 800, textTransform: 'uppercase' }}>Costi var. €</th>
                    <th style={{ textAlign: 'right', padding: '8px 10px', fontSize: 10, color: C.txl, fontWeight: 800, textTransform: 'uppercase' }}>Margine</th>
                  </tr>
                </thead>
                <tbody>
                  {MESI.map((label, i) => {
                    const m = i + 1;
                    const mt = margineTarget(m);
                    const r = righe[m] || vuota();
                    return (
                      <tr key={m} style={{ borderTop: `1px solid ${C.brd}` }}>
                        <td style={{ padding: '6px 10px', fontSize: 12.5, fontWeight: 700, color: C.txt, whiteSpace: 'nowrap' }}>
                          {label}
                          {dirty[m] && <span style={{ color: C.war, marginLeft: 4 }}>●</span>}
                        </td>
                        <td style={{ padding: '4px 4px' }}><NumCell value={r.incassato_target} onChange={(v) => aggiorna(m, 'incassato_target', v)} /></td>
                        <td style={{ padding: '4px 4px' }}><NumCell value={r.costi_fissi_target} onChange={(v) => aggiorna(m, 'costi_fissi_target', v)} /></td>
                        <td style={{ padding: '4px 4px' }}><NumCell value={r.costi_variabili_target} onChange={(v) => aggiorna(m, 'costi_variabili_target', v)} /></td>
                        <td style={{ padding: '4px 10px', textAlign: 'right', fontSize: 13, fontWeight: 800, color: mt == null ? C.txl : (mt >= 0 ? C.suc : C.dan) }}>
                          {mt == null ? '—' : fmt(mt)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr style={{ borderTop: `2px solid ${C.brd}`, background: C.bg }}>
                    <td style={{ padding: '8px 10px', fontSize: 11.5, fontWeight: 800, color: C.txt }}>Totale anno</td>
                    <td style={{ padding: '8px 4px', textAlign: 'right', fontSize: 12, fontWeight: 800, color: C.txt }}>{fmt(totaleAnno('incassato_target'))}</td>
                    <td style={{ padding: '8px 4px', textAlign: 'right', fontSize: 12, fontWeight: 800, color: C.txt }}>{fmt(totaleAnno('costi_fissi_target'))}</td>
                    <td style={{ padding: '8px 4px', textAlign: 'right', fontSize: 12, fontWeight: 800, color: C.txt }}>{fmt(totaleAnno('costi_variabili_target'))}</td>
                    <td style={{ padding: '8px 10px', textAlign: 'right', fontSize: 13, fontWeight: 900, color: C.pri }}>
                      {fmt(totaleAnno('incassato_target') - totaleAnno('costi_fissi_target') - totaleAnno('costi_variabili_target'))}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
            <div style={{ padding: 10, display: 'flex', alignItems: 'center', gap: 10, borderTop: `1px solid ${C.brd}` }}>
              <Btn ch={saving ? 'Salvo…' : `Salva${Object.keys(dirty).length ? ` (${Object.keys(dirty).length})` : ''}`} onClick={salvaTutto} dis={saving || Object.keys(dirty).length === 0} sz="sm" />
              {msg && <span style={{ fontSize: 12, color: msg.startsWith('Errore') ? C.dan : C.suc, fontWeight: 700 }}>{msg}</span>}
            </div>
          </Crd>
        )}
      </div>

      {!loading && (
        <div>
          <SectionLabel>📊 Target vs reale — {anno}</SectionLabel>
          <Crd style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 480 }}>
                <thead>
                  <tr style={{ background: C.bg }}>
                    <th style={{ textAlign: 'left', padding: '8px 10px', fontSize: 10, color: C.txl, fontWeight: 800, textTransform: 'uppercase' }}>Mese</th>
                    <th style={{ textAlign: 'right', padding: '8px 6px', fontSize: 10, color: C.txl, fontWeight: 800, textTransform: 'uppercase' }}>Margine target</th>
                    <th style={{ textAlign: 'right', padding: '8px 6px', fontSize: 10, color: C.txl, fontWeight: 800, textTransform: 'uppercase' }}>Margine reale</th>
                    <th style={{ textAlign: 'right', padding: '8px 10px', fontSize: 10, color: C.txl, fontWeight: 800, textTransform: 'uppercase' }}>Diff</th>
                  </tr>
                </thead>
                <tbody>
                  {MESI.map((label, i) => {
                    const m = i + 1;
                    const mt = margineTarget(m);
                    const mr = reale[m]?.margine;
                    const haReale = mr !== undefined && mr !== null;
                    const diff = mt != null && haReale ? mr - mt : null;
                    return (
                      <tr key={m} style={{ borderTop: `1px solid ${C.brd}` }}>
                        <td style={{ padding: '6px 10px', fontSize: 12.5, fontWeight: 700, color: C.txt }}>{label}</td>
                        <td style={{ padding: '6px 6px', textAlign: 'right', fontSize: 12.5, color: C.txm }}>{mt == null ? '—' : fmt(mt)}</td>
                        <td style={{ padding: '6px 6px', textAlign: 'right', fontSize: 12.5, fontWeight: 700, color: haReale ? (mr >= 0 ? C.suc : C.dan) : C.txl }}>{haReale ? fmt(mr) : '—'}</td>
                        <td style={{ padding: '6px 10px', textAlign: 'right', fontSize: 12, fontWeight: 700, color: diff == null ? C.txl : (diff >= 0 ? C.suc : C.dan) }}>
                          {diff == null ? '—' : `${diff >= 0 ? '+' : ''}${fmt(diff)}`}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Crd>
          <div style={{ fontSize: 10, color: C.txl, textAlign: 'center', marginTop: 8 }}>
            Il margine reale usa gli stessi dati del Controllo di Gestione (incassi registrati, costi da Spese, ricorrenti incluse).
          </div>
        </div>
      )}
    </div>
  );
}
