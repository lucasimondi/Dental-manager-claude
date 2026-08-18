import React, { useState, useEffect } from 'react';
import { Crd } from './ui';
import { C, fmt } from '../lib/utils';
import { supabase } from '../lib/supabase.js';

// Cruscotto marginalità: per ogni prestazione del Listino, quanto costa
// davvero produrla (materiali + macchinari + tempo poltrona) rispetto a
// quanto viene fatturata — non solo l'incasso totale già mostrato in
// Panoramica, ma il margine di CIASCUNA prestazione, per capire dove il
// prezzo di listino non copre più i costi o dove c'è margine da difendere.
const costoUsoMateriale = (m) => Number(m.costo) / Math.max(1, Number(m.resa));
const costoUsoMacchinario = (m) => {
  if (!m.utilizzi_stimati_anno) return null;
  return (Number(m.costo_acquisto) / Math.max(1, Number(m.anni_ammortamento))) / Number(m.utilizzi_stimati_anno) + Number(m.costo_consumabile_uso || 0);
};

const SOGLIA_OK = 40;
const SOGLIA_ATTENZIONE = 20;
const coloreMargine = (pct) => pct >= SOGLIA_OK ? C.suc : pct >= SOGLIA_ATTENZIONE ? C.war : C.dan;

export default function MarginalitaPrestazioni({ studioId, pricelist = [], isDentistico = true }) {
  const labelTempoPostazione = isDentistico ? 'Tempo poltrona' : 'Tempo postazione';
  const [materiali, setMateriali] = useState([]);
  const [macchinari, setMacchinari] = useState([]);
  const [collegatiMat, setCollegatiMat] = useState([]);
  const [collegatiMacc, setCollegatiMacc] = useState([]);
  const [costoOrario, setCostoOrario] = useState(null);
  const [loading, setLoading] = useState(true);
  const [espansa, setEspansa] = useState(null);

  useEffect(() => {
    if (!studioId) return;
    setLoading(true);
    Promise.all([
      supabase.from('materiali').select('*'),
      supabase.from('macchinari').select('*'),
      supabase.from('prestazione_materiali').select('*'),
      supabase.from('prestazione_macchinari').select('*'),
      supabase.rpc('get_costo_orario', { p_studio_id: studioId }),
    ]).then(([mat, macc, cm, cmc, co]) => {
      setMateriali(mat.data || []);
      setMacchinari(macc.data || []);
      setCollegatiMat(cm.data || []);
      setCollegatiMacc(cmc.data || []);
      setCostoOrario(co.data?.costo_orario ?? null);
      setLoading(false);
    });
  }, [studioId]);

  if (loading) return <div style={{ textAlign: 'center', color: C.txl, padding: 30, fontSize: 13 }}>Calcolo marginalità…</div>;

  const righe = pricelist.map((p) => {
    const matCollegati = collegatiMat.filter((c) => c.pricelist_id === p.id);
    const maccCollegati = collegatiMacc.filter((c) => c.pricelist_id === p.id);
    const costoMateriali = matCollegati.reduce((s, c) => { const m = materiali.find((x) => x.id === c.materiale_id); return m ? s + costoUsoMateriale(m) * Number(c.quantita) : s; }, 0);
    const costoMacchinari = maccCollegati.reduce((s, c) => { const m = macchinari.find((x) => x.id === c.macchinario_id); const cu = m ? costoUsoMacchinario(m) : null; return cu != null ? s + cu * Number(c.quantita) : s; }, 0);
    const costoTempo = (p.durataMinuti && costoOrario != null) ? (Number(p.durataMinuti) / 60) * costoOrario : 0;
    const costoTotale = costoMateriali + costoMacchinari + costoTempo;
    const configurata = matCollegati.length > 0 || maccCollegati.length > 0;
    const margine = Number(p.prezzo || 0) - costoTotale;
    const marginePct = Number(p.prezzo) > 0 ? (margine / Number(p.prezzo)) * 100 : 0;
    return { p, matCollegati, maccCollegati, costoMateriali, costoMacchinari, costoTempo, costoTotale, configurata, margine, marginePct };
  });

  const configurate = righe.filter((r) => r.configurata).sort((a, b) => a.marginePct - b.marginePct);
  const nonConfigurate = righe.filter((r) => !r.configurata);
  const margineMedio = configurate.length > 0 ? configurate.reduce((s, r) => s + r.marginePct, 0) / configurate.length : null;
  const sottoSoglia = configurate.filter((r) => r.marginePct < SOGLIA_ATTENZIONE).length;

  return (
    <div style={{ padding: 14 }}>
      {materiali.length === 0 && macchinari.length === 0 ? (
        <Crd style={{ textAlign: 'center', padding: 24 }}>
          <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 6 }}>Nessun costo configurato</div>
          <div style={{ fontSize: 12.5, color: C.txm }}>
            Aggiungi materiali e macchinari in <b>Controllo → Costi</b>, poi collegali alle prestazioni aprendole dal <b>Listino</b> per vedere qui la marginalità.
          </div>
        </Crd>
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
            <Crd style={{ padding: 12 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: C.txl, textTransform: 'uppercase' }}>Margine medio</div>
              <div style={{ fontSize: 22, fontWeight: 900, color: margineMedio != null ? coloreMargine(margineMedio) : C.txt, marginTop: 3 }}>
                {margineMedio != null ? `${Math.round(margineMedio)}%` : '—'}
              </div>
              <div style={{ fontSize: 10.5, color: C.txm, marginTop: 1 }}>{configurate.length} prestazion{configurate.length === 1 ? 'e' : 'i'} con costi configurati</div>
            </Crd>
            <Crd style={{ padding: 12, border: sottoSoglia > 0 ? `1px solid ${C.dan}40` : undefined }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: C.txl, textTransform: 'uppercase' }}>Sotto {SOGLIA_ATTENZIONE}% margine</div>
              <div style={{ fontSize: 22, fontWeight: 900, color: sottoSoglia > 0 ? C.dan : C.txt, marginTop: 3 }}>{sottoSoglia}</div>
              <div style={{ fontSize: 10.5, color: C.txm, marginTop: 1 }}>da rivedere: prezzo o costi</div>
            </Crd>
          </div>

          {costoOrario == null && (
            <div style={{ fontSize: 11, color: C.txl, marginBottom: 12 }}>Il costo del {labelTempoPostazione.toLowerCase()} non è incluso: configura le ore dello studio in Controllo → Costi per aggiungerlo.</div>
          )}

          {configurate.length === 0 ? (
            <Crd style={{ textAlign: 'center', padding: 24 }}>
              <div style={{ fontSize: 12.5, color: C.txm }}>Hai materiali/macchinari in libreria ma nessuno è ancora collegato a una prestazione. Apri una voce del Listino e collega i costi usati.</div>
            </Crd>
          ) : (
            <Crd style={{ padding: 0, overflow: 'hidden', marginBottom: 14 }}>
              {configurate.map((r, i) => {
                const aperta = espansa === r.p.id;
                return (
                  <div key={r.p.id}>
                    <div onClick={() => setEspansa(aperta ? null : r.p.id)} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 13px', borderBottom: i < configurate.length - 1 || aperta ? `1px solid ${C.brd}` : 'none', cursor: 'pointer' }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 700, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.p.nome}</div>
                        <div style={{ fontSize: 11, color: C.txm }}>{fmt(r.p.prezzo)} · costi {fmt(r.costoTotale)}</div>
                      </div>
                      <div style={{ background: coloreMargine(r.marginePct) + '20', color: coloreMargine(r.marginePct), fontWeight: 800, fontSize: 12.5, padding: '4px 10px', borderRadius: 20, flexShrink: 0 }}>
                        {Math.round(r.marginePct)}%
                      </div>
                    </div>
                    {aperta && (
                      <div style={{ padding: '4px 13px 13px', background: C.bg, borderBottom: i < configurate.length - 1 ? `1px solid ${C.brd}` : 'none' }}>
                        {r.matCollegati.map((c) => { const m = materiali.find((x) => x.id === c.materiale_id); if (!m) return null; return (
                          <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11.5, color: C.txm, padding: '3px 0' }}>
                            <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.nome} × {c.quantita}</span>
                            <span style={{ flexShrink: 0 }}>{fmt(costoUsoMateriale(m) * c.quantita)}</span>
                          </div>
                        ); })}
                        {r.maccCollegati.map((c) => { const m = macchinari.find((x) => x.id === c.macchinario_id); const cu = m ? costoUsoMacchinario(m) : null; if (!m || cu == null) return null; return (
                          <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11.5, color: C.txm, padding: '3px 0' }}>
                            <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.nome} × {c.quantita}</span>
                            <span style={{ flexShrink: 0 }}>{fmt(cu * c.quantita)}</span>
                          </div>
                        ); })}
                        {r.costoTempo > 0 && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11.5, color: C.txm, padding: '3px 0' }}>
                            <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{labelTempoPostazione} ({r.p.durataMinuti} min)</span>
                            <span style={{ flexShrink: 0 }}>{fmt(r.costoTempo)}</span>
                          </div>
                        )}
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, fontWeight: 800, color: C.txt, marginTop: 6, paddingTop: 6, borderTop: `1px solid ${C.brd}` }}>
                          <span>Margine</span><span style={{ color: coloreMargine(r.marginePct) }}>{fmt(r.margine)}</span>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </Crd>
          )}

          {nonConfigurate.length > 0 && (
            <div style={{ fontSize: 11.5, color: C.txl, textAlign: 'center' }}>
              {nonConfigurate.length} altr{nonConfigurate.length === 1 ? 'a prestazione' : 'e prestazioni'} senza costi collegati — apri{nonConfigurate.length === 1 ? 'la' : 'le'} dal Listino per aggiungerli.
            </div>
          )}
        </>
      )}
    </div>
  );
}
