import React, { useState } from 'react';
import { Crd } from './ui';
import { C, fmt, today } from '../lib/utils';
import { useIsMobile } from '../lib/useIsMobile';
import { useControlloDati } from '../lib/useControlloDati';
import { useCockpitDati } from '../lib/useCockpitDati';

// ─────────────────────────────────────────────────────────────────
// Tab "Cockpit" di Controllo di Gestione — vista aggiuntiva, non
// sostituisce nulla di "Panoramica": stessa fonte dati (useControlloDati +
// RPC get_kpi_periodo/get_costo_orario), stile scoped qui dentro, usa i
// token colore di useTheme.js/utils.js (C.*) così light/dark funzionano
// automaticamente senza una seconda palette. Nessuna scrittura su
// Supabase in questa tab: Punteggio Salute Studio e Previsione di cassa
// sono sola lettura, il Simulatore what-if è puro calcolo client-side.
// ─────────────────────────────────────────────────────────────────

const ymd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const aggiungiGiorni = (dataYMD, n) => { const d = new Date(dataYMD + 'T12:00'); d.setDate(d.getDate() + n); return ymd(d); };

const FATTORE_COLORE = { ebitda: C.pri, breakeven: C.suc, accettazione: C.pur, occupazione: C.acc, dso: C.war };

function Gauge({ punteggio }) {
  const r = 62, c = 2 * Math.PI * r;
  const pct = punteggio == null ? 0 : Math.max(0, Math.min(100, punteggio)) / 100;
  const colore = punteggio == null ? C.txl : punteggio >= 70 ? C.suc : punteggio >= 45 ? C.war : C.dan;
  return (
    <div style={{ position: 'relative', width: 150, height: 150, margin: '4px 0 8px' }}>
      <svg width={150} height={150} viewBox="0 0 150 150" style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={75} cy={75} r={r} fill="none" stroke={C.bg} strokeWidth={13} />
        <circle cx={75} cy={75} r={r} fill="none" stroke={colore} strokeWidth={13} strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c * (1 - pct)} style={{ transition: 'stroke-dashoffset 0.4s' }} />
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ fontSize: 40, fontWeight: 900, color: colore, lineHeight: 1 }}>{punteggio ?? '—'}</div>
        <div style={{ fontSize: 10, color: C.txl, textTransform: 'uppercase', letterSpacing: '0.06em', marginTop: 4, fontWeight: 700 }}>su 100</div>
      </div>
    </div>
  );
}

export default function ControlloCockpit({ studioId, patients = [], plans = [], payments = [], appointments = [], onOpenPaz }) {
  const [periodo, setPeriodo] = useState('mese');
  const isMobile = useIsMobile();

  const {
    kpi, kpiLoading, totEsegDaInc, totAccNonEseg, tassoAccettazione,
    scadenzePagamento, andamentoMensile, daPer, aPer,
  } = useControlloDati({ studioId, patients, plans, payments, periodo });

  const { oreOccupatePct, dsoGiorni, salute, deltaSalute } = useCockpitDati({
    studioId, kpi, kpiLoading, totEsegDaInc, tassoAccettazione, appointments, periodo, daPer, aPer,
  });

  // ── Simulatore what-if: solo client-side, nessuna scrittura, nessun legame con Proiezioni ──
  const [simPrezzo, setSimPrezzo] = useState(0);
  const [simCosto, setSimCosto] = useState(0);
  const [simGiorni, setSimGiorni] = useState(0);

  const simulazione = (() => {
    if (!kpi || !daPer || !aPer) return null;
    const giorniPeriodo = Math.max(1, Math.round((new Date(aPer + 'T12:00') - new Date(daPer + 'T12:00')) / 86400000) + 1);
    // Modello dichiarato: l'aumento prezzi si applica all'incasso attuale a parità
    // di volume; i giorni extra portano incasso aggiuntivo al ritmo medio
    // giornaliero attuale e fanno crescere proporzionalmente solo i costi
    // variabili (materiali/laboratorio), non quelli fissi.
    const incassoMedioGiorno = kpi.incassato / giorniPeriodo;
    const incassoProiettato = kpi.incassato * (1 + simPrezzo / 100) + incassoMedioGiorno * simGiorni;
    const variabiliProiettate = kpi.costi_variabili * (1 + simGiorni / giorniPeriodo);
    const costiProiettati = kpi.costi_fissi + simCosto + variabiliProiettate;
    const ebitdaProiettato = incassoProiettato - costiProiettati;
    return { incassoProiettato, costiProiettati, ebitdaProiettato, delta: ebitdaProiettato - kpi.ebitda };
  })();

  // ── Previsione di cassa 30/60/90gg ──
  // Non è un saldo di conto corrente reale (l'app non lo conosce): è la somma
  // di scadenze di pagamento già note in ciascuna finestra + l'eseguito non
  // ancora incassato (assunto in arrivo) + una proiezione lineare basata sulla
  // media mobile storica degli incassi, per il resto non ancora legato a una
  // scadenza specifica.
  const oggi = today();
  const ritmoMedioGiornaliero = andamentoMensile.length > 0 ? andamentoMensile[andamentoMensile.length - 1].media / 30 : 0;
  const previsioneCassa = [30, 60, 90].map((giorni) => {
    const fineFinestra = aggiungiGiorni(oggi, giorni);
    const daScadenze = scadenzePagamento.filter(s => s.scadenza >= oggi && s.scadenza <= fineFinestra).reduce((s, x) => s + x.importo, 0);
    return { giorni, valore: daScadenze + totEsegDaInc + ritmoMedioGiornaliero * giorni };
  });
  const cassaMax = Math.max(1, ...previsioneCassa.map(p => p.valore));

  // ── Alert proattivi, tutti da dati reali già calcolati ──
  const oggiD = new Date(oggi + 'T12:00');
  const alerts = [];
  const pazientiFermi = plans.filter(pl => pl.stato === 'accettato').map(pl => {
    const haFuturi = appointments.some(a => a.pazienteId === pl.pazienteId && a.data >= oggi);
    const giorniDaCreazione = pl.data ? Math.round((oggiD - new Date(pl.data + 'T12:00')) / 86400000) : 0;
    return { pl, haFuturi, giorniDaCreazione };
  }).filter(x => !x.haFuturi && x.giorniDaCreazione > 45);
  if (pazientiFermi.length > 0) {
    alerts.push({ livello: 'critical', titolo: `${pazientiFermi.length} piano/i accettato/i, nessun appuntamento pianificato`, testo: 'Da oltre 45 giorni dalla creazione del piano. Rischio abbandono — valuta un richiamo diretto.' });
  }
  if (kpi && kpi.margine_contribuzione_pct != null && kpi.margine_contribuzione_pct < 40) {
    alerts.push({ livello: 'warning', titolo: `Margine di contribuzione al ${kpi.margine_contribuzione_pct}%`, testo: 'Sotto la soglia del 40% sul fatturato del periodo. Controlla il mix costi variabili in "Dettaglio costi".' });
  }
  if (dsoGiorni != null && dsoGiorni > 30) {
    alerts.push({ livello: 'warning', titolo: `Incasso stimato in ${Math.round(dsoGiorni)} giorni`, testo: 'DSO stimato sopra i 30 giorni: molto eseguito è ancora da incassare rispetto al fatturato del periodo.' });
  }
  const scadenze7gg = scadenzePagamento.filter(s => s.scadenza >= oggi && s.scadenza <= aggiungiGiorni(oggi, 7));
  if (scadenze7gg.length > 0) {
    alerts.push({ livello: 'warning', titolo: `${scadenze7gg.length} scadenza/e di pagamento nei prossimi 7 giorni`, testo: `Totale ${fmt(scadenze7gg.reduce((s, x) => s + x.importo, 0))}.` });
  }

  const colWrap = (children) => isMobile
    ? <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>{children}</div>
    : <div style={{ display: 'flex', gap: 12, alignItems: 'stretch' }}>{children}</div>;

  return (
    <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
        <div style={{ fontSize: 11, color: C.txl }}>Cockpit direzionale — stessa fonte dati di ogni altro numero in app</div>
        <div style={{ display: 'flex', gap: 4, background: C.bg, border: `1px solid ${C.brd}`, borderRadius: 8, padding: 3 }}>
          {[['mese', 'Questo mese'], ['anno', "Quest'anno"]].map(([id, lbl]) => (
            <button key={id} onClick={() => setPeriodo(id)} style={{ border: 'none', borderRadius: 6, padding: '6px 12px', fontSize: 12, fontWeight: 700, cursor: 'pointer', background: periodo === id ? C.pri : 'transparent', color: periodo === id ? '#fff' : C.txt }}>{lbl}</button>
          ))}
        </div>
      </div>

      {/* HERO: Salute studio + Sommario compatto */}
      {colWrap(<>
        <Crd style={{ flex: isMobile ? 'none' : '0 0 260px', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: C.txm, textTransform: 'uppercase', letterSpacing: '0.06em', alignSelf: 'flex-start', marginBottom: 4 }}>Salute dello studio</div>
          <Gauge punteggio={salute.punteggio} />
          {deltaSalute != null && (
            <div style={{ fontSize: 12, fontWeight: 700, color: deltaSalute >= 0 ? C.suc : C.dan, marginBottom: 10 }}>
              {deltaSalute >= 0 ? '▲' : '▼'} {deltaSalute >= 0 ? '+' : ''}{deltaSalute} vs mese scorso <span style={{ color: C.txl, fontWeight: 400 }}>(solo EBITDA + break-even, gli unici storicizzati)</span>
            </div>
          )}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, justifyContent: 'center' }}>
            {salute.fattori.map(f => (
              <span key={f.id} style={{ fontSize: 10.5, padding: '4px 9px', borderRadius: 20, background: C.bg, color: C.txm, border: `1px solid ${C.brd}`, fontWeight: 600 }}>
                {f.label} <b style={{ color: FATTORE_COLORE[f.id] || C.txt }}>{f.punteggio}</b>
              </span>
            ))}
          </div>
        </Crd>

        <Crd style={{ flex: 1 }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: C.txm, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12 }}>Sommario</div>
          {kpiLoading && <div style={{ color: C.txl, fontSize: 13 }}>Calcolo in corso…</div>}
          {kpi && !kpiLoading && (
            <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: isMobile ? 10 : 0 }}>
              {[
                { lbl: 'Incassato', val: fmt(kpi.incassato), col: C.txt },
                { lbl: '− Costi', val: fmt(kpi.costi_totali), col: C.txm },
                { lbl: '= EBITDA', val: fmt(kpi.ebitda), col: kpi.ebitda >= 0 ? C.suc : C.dan },
              ].map((r, i) => (
                <div key={i} style={{ flex: 1, padding: isMobile ? 0 : '0 12px', borderLeft: !isMobile && i > 0 ? `1px solid ${C.brd}` : 'none' }}>
                  <div style={{ fontSize: 11, color: C.txm, fontWeight: 700, marginBottom: 4 }}>{r.lbl}</div>
                  <div style={{ fontSize: 22, fontWeight: 900, color: r.col }}>{r.val}</div>
                </div>
              ))}
            </div>
          )}
          {kpi && (
            <div style={{ marginTop: 14, paddingTop: 12, borderTop: `1px solid ${C.brd}`, display: 'flex', justifyContent: 'space-between', fontSize: 12, color: C.txm }}>
              <span>Break-even: {kpi.break_even != null ? <b style={{ color: C.txt }}>{fmt(kpi.break_even)}</b> : <span style={{ fontStyle: 'italic' }}>non calcolabile (metodo manuale)</span>}</span>
              {oreOccupatePct != null && <span>Agenda: <b style={{ color: C.txt }}>{Math.round(oreOccupatePct)}%</b> occupata</span>}
            </div>
          )}
        </Crd>
      </>)}

      {/* SIMULATORE WHAT-IF */}
      <Crd>
        <div style={{ fontSize: 11, fontWeight: 800, color: C.txm, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 2 }}>Simulatore what-if</div>
        <div style={{ fontSize: 11, color: C.txl, marginBottom: 14 }}>Solo su questo schermo — non salva nulla, non tocca Proiezioni</div>
        <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: isMobile ? 16 : 20 }}>
          {[
            { lbl: 'Aumento prezzi listino', v: simPrezzo, set: setSimPrezzo, min: -10, max: 20, fmt: (v) => `${v >= 0 ? '+' : ''}${v}%` },
            { lbl: 'Nuovo costo fisso mensile', v: simCosto, set: setSimCosto, min: 0, max: 2500, step: 100, fmt: (v) => fmt(v) },
            { lbl: 'Giorni apertura extra/mese', v: simGiorni, set: setSimGiorni, min: 0, max: 8, fmt: (v) => String(v) },
          ].map((s, i) => (
            <div key={i} style={{ flex: 1 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, fontWeight: 600, color: C.txm, marginBottom: 8 }}>
                <span>{s.lbl}</span><span style={{ color: C.pri, fontWeight: 700 }}>{s.fmt(s.v)}</span>
              </div>
              <input type="range" min={s.min} max={s.max} step={s.step || 1} value={s.v} onChange={(e) => s.set(Number(e.target.value))} style={{ width: '100%', accentColor: C.pri }} />
            </div>
          ))}
        </div>
        {simulazione && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, marginTop: 16, paddingTop: 14, borderTop: `1px solid ${C.brd}` }}>
            {[
              ['Incassato proiettato', fmt(simulazione.incassoProiettato), C.txt],
              ['Costi proiettati', fmt(simulazione.costiProiettati), C.txt],
              ['EBITDA proiettato', fmt(simulazione.ebitdaProiettato), simulazione.ebitdaProiettato >= 0 ? C.suc : C.dan],
              ['Variazione vs oggi', `${simulazione.delta >= 0 ? '+' : ''}${fmt(simulazione.delta)}`, simulazione.delta >= 0 ? C.suc : C.dan],
            ].map(([lbl, val, col], i) => (
              <div key={i} style={{ flex: '1 1 130px' }}>
                <div style={{ fontSize: 10.5, color: C.txl, textTransform: 'uppercase', fontWeight: 700, marginBottom: 3 }}>{lbl}</div>
                <div style={{ fontSize: 18, fontWeight: 800, color: col }}>{val}</div>
              </div>
            ))}
          </div>
        )}
      </Crd>

      {/* PREVISIONE DI CASSA */}
      <Crd>
        <div style={{ fontSize: 11, fontWeight: 800, color: C.txm, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 2 }}>Previsione di cassa</div>
        <div style={{ fontSize: 11, color: C.txl, marginBottom: 12 }}>Scadenze note + eseguito da incassare + ritmo storico d'incasso — non un saldo di conto reale</div>
        <div style={{ display: 'flex', gap: isMobile ? 8 : 16, alignItems: 'flex-end', height: 90 }}>
          {previsioneCassa.map((p) => (
            <div key={p.giorni} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: C.txt }}>{fmt(p.valore)}</div>
              <div style={{ width: '60%', height: Math.max(6, (p.valore / cassaMax) * 60), background: C.priL, borderRadius: '4px 4px 0 0', borderTop: `3px solid ${C.pri}` }} />
              <div style={{ fontSize: 10.5, color: C.txl }}>+{p.giorni}gg</div>
            </div>
          ))}
        </div>
      </Crd>

      {/* ALERT PROATTIVI */}
      <Crd>
        <div style={{ fontSize: 11, fontWeight: 800, color: C.txm, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12 }}>Alert proattivi</div>
        {alerts.length === 0 && <div style={{ textAlign: 'center', color: C.txl, padding: '12px 0', fontSize: 13 }}>Nessun segnale da evidenziare 🎉</div>}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {alerts.map((a, i) => {
            const col = a.livello === 'critical' ? C.dan : C.war;
            return (
              <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '11px 13px', borderRadius: 10, background: C.bg, border: `1px solid ${C.brd}` }}>
                <div style={{ width: 24, height: 24, borderRadius: 7, background: col + '22', color: col, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 800, flexShrink: 0 }}>{a.livello === 'critical' ? '!' : '⚠'}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: C.txt }}>{a.titolo}</div>
                  <div style={{ fontSize: 12, color: C.txm, marginTop: 2, lineHeight: 1.5 }}>{a.testo}</div>
                </div>
              </div>
            );
          })}
        </div>
      </Crd>

      <div style={{ fontSize: 10.5, color: C.txl, textAlign: 'center' }}>
        "Redditività per ora poltrona" non è ancora inclusa: richiede una durata per prestazione che oggi non esiste nel listino — proposta come task separato.
      </div>
    </div>
  );
}
