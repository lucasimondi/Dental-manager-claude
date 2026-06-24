import React, { useState } from 'react';
import { Crd, Bdg, Modal, Ic } from './ui';
import { C, fmt, fmtD, today } from '../lib/utils';

export default function Dashboard({ patients, appointments, payments, plans, onOpenPaz }) {
  const t = today();
  const anno = t.slice(0, 4);
  const [detailModal, setDetailModal] = useState(null);

  const todayApps = appointments.filter((a) => a.data === t);
  const mInc = payments.filter((p) => p.data && p.data.startsWith(t.slice(0, 7))).reduce((s, p) => s + Number(p.importo), 0);
  const upcoming = [...appointments].filter((a) => a.data >= t).sort((a, b) => a.data.localeCompare(b.data) || a.ora.localeCompare(b.ora)).slice(0, 6);

  const saldoPerPaz = patients.map((paz) => {
    const patPlans = plans.filter((pl) => pl.pazienteId === paz.id);
    const vociDaInc = patPlans.flatMap((pl) => pl.voci.filter((v) => v.eseguita && !v.incassata).map((v) => ({ ...v, pianoTitolo: pl.titolo, pianoId: pl.id })));
    const vociIncAnno = patPlans.flatMap((pl) => pl.voci.filter((v) => v.incassata && v.dataEsec && v.dataEsec.startsWith(anno)).map((v) => ({ ...v, pianoTitolo: pl.titolo })));
    const totDaInc = vociDaInc.reduce((s, v) => s + Number(v.prezzo), 0);
    const totIncAnno = vociIncAnno.reduce((s, v) => s + Number(v.prezzo), 0);
    return { paz, vociDaInc, vociIncAnno, totDaInc, totIncAnno };
  }).filter((x) => x.totDaInc > 0 || x.totIncAnno > 0);

  const totDaInc = saldoPerPaz.reduce((s, x) => s + x.totDaInc, 0);
  const totIncAnno = saldoPerPaz.reduce((s, x) => s + x.totIncAnno, 0);
  const nPazDaInc = saldoPerPaz.filter((x) => x.totDaInc > 0).length;
  const nPazInc = saldoPerPaz.filter((x) => x.totIncAnno > 0).length;
  const righeDAInc = saldoPerPaz.filter((x) => x.totDaInc > 0).sort((a, b) => b.totDaInc - a.totDaInc);
  const righeInc = saldoPerPaz.filter((x) => x.totIncAnno > 0).sort((a, b) => b.totIncAnno - a.totIncAnno);

  // PREVENTIVI
  const preventiviAttesa = plans.filter((pl) => (pl.stato || 'attivo') === 'attivo').map((pl) => ({ pl, paz: patients.find((x) => x.id === pl.pazienteId) })).filter((x) => x.paz);
  const preventiviRifiutati = plans.filter((pl) => pl.stato === 'rifiutato').map((pl) => ({ pl, paz: patients.find((x) => x.id === pl.pazienteId) })).filter((x) => x.paz);

  // RICHIAMI
  const oggiD = new Date(t + 'T12:00');
  const tra30 = new Date(oggiD); tra30.setDate(tra30.getDate() + 30);
  const richiamiTutti = plans.flatMap((pl) => {
    const paz = patients.find((x) => x.id === pl.pazienteId);
    if (!paz) return [];
    return pl.voci.filter((v) => v.richiamoData).map((v) => ({ paz, pl, v, data: v.richiamoData }));
  });
  const richiamiScaduti = richiamiTutti.filter((r) => new Date(r.data + 'T12:00') < oggiD).sort((a, b) => a.data.localeCompare(b.data));
  const richiamiProssimi = richiamiTutti.filter((r) => { const d = new Date(r.data + 'T12:00'); return d >= oggiD && d <= tra30; }).sort((a, b) => a.data.localeCompare(b.data));
  const richiamiTotali = richiamiScaduti.length + richiamiProssimi.length;

  // SCADENZE PAGAMENTO
  const scadenzePagamento = plans.map((pl) => {
    const paz = patients.find((x) => x.id === pl.pazienteId);
    if (!paz || !pl.scadenzaPagamento) return null;
    const sub = pl.voci.reduce((s, v) => s + Number(v.prezzo), 0);
    const sc = Number(pl.sconto) || 0;
    const scontato = pl.scontoTipo === 'pct' ? sub * (sc / 100) : Math.min(sc, sub);
    const totPiano = Math.max(0, sub - scontato);
    const pagatoPaz = payments.filter((p) => p.pazienteId === paz.id).reduce((s, p) => s + Number(p.importo), 0);
    const dovutoPaz = plans.filter((pp) => pp.pazienteId === paz.id).reduce((s, pp) => {
      const sub2 = pp.voci.reduce((a, v) => a + Number(v.prezzo), 0);
      const sc2 = Number(pp.sconto) || 0;
      const scontato2 = pp.scontoTipo === 'pct' ? sub2 * (sc2 / 100) : Math.min(sc2, sub2);
      return s + Math.max(0, sub2 - scontato2);
    }, 0);
    const residuoStimato = Math.min(totPiano, Math.max(0, dovutoPaz - pagatoPaz));
    if (residuoStimato <= 0) return null;
    return { pl, paz, scadenza: pl.scadenzaPagamento, importo: residuoStimato };
  }).filter(Boolean).sort((a, b) => a.scadenza.localeCompare(b.scadenza));
  const scadenzeScadute = scadenzePagamento.filter((s) => new Date(s.scadenza + 'T12:00') < oggiD);
  const scadenzeProssime = scadenzePagamento.filter((s) => { const d = new Date(s.scadenza + 'T12:00'); return d >= oggiD && d <= tra30; });

  // PREVISIONALE
  const previsionaleMesi = (() => {
    const mesi = {};
    scadenzePagamento.forEach((s) => { const k = s.scadenza.slice(0, 7); mesi[k] = (mesi[k] || 0) + s.importo; });
    return Object.entries(mesi).sort((a, b) => a[0].localeCompare(b[0])).slice(0, 6);
  })();
  const MESI_NOMI = ['Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu', 'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic'];

  return (
    <div>
      {detailModal === 'prevent' && (
        <Modal title="📋 Preventivi da gestire" onClose={() => setDetailModal(null)} wide>
          {preventiviAttesa.length === 0 && preventiviRifiutati.length === 0 && <div style={{ textAlign: 'center', color: C.txl, padding: 30 }}>Nessun preventivo in sospeso 🎉</div>}
          {preventiviAttesa.length > 0 && (
            <>
              <div style={{ fontSize: 11, fontWeight: 800, color: C.war, textTransform: 'uppercase', marginBottom: 8 }}>⏳ In attesa di accettazione ({preventiviAttesa.length})</div>
              {preventiviAttesa.map(({ pl, paz }) => {
                const sub = pl.voci.reduce((s, v) => s + Number(v.prezzo), 0);
                return (
                  <Crd key={pl.id} style={{ marginBottom: 8, borderLeft: `3px solid ${C.war}` }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                      <div>
                        <div onClick={() => { setDetailModal(null); onOpenPaz(paz, 'piani'); }} style={{ fontWeight: 700, fontSize: 13, color: C.pri, cursor: 'pointer' }}>{paz.nome} {paz.cognome} ›</div>
                        <div style={{ fontSize: 11, color: C.txm }}>{pl.titolo} · {fmtD(pl.data)}</div>
                      </div>
                      <span style={{ fontWeight: 800, color: C.war, fontSize: 14 }}>{fmt(sub)}</span>
                    </div>
                  </Crd>
                );
              })}
            </>
          )}
          {preventiviRifiutati.length > 0 && (
            <>
              <div style={{ fontSize: 11, fontWeight: 800, color: C.dan, textTransform: 'uppercase', margin: '14px 0 8px' }}>✗ Rifiutati ({preventiviRifiutati.length})</div>
              {preventiviRifiutati.map(({ pl, paz }) => (
                <Crd key={pl.id} style={{ marginBottom: 8, borderLeft: `3px solid ${C.dan}` }}>
                  <div onClick={() => { setDetailModal(null); onOpenPaz(paz, 'piani'); }} style={{ fontWeight: 700, fontSize: 13, color: C.pri, cursor: 'pointer' }}>{paz.nome} {paz.cognome} ›</div>
                  <div style={{ fontSize: 11, color: C.txm }}>{pl.titolo} · {fmtD(pl.data)}</div>
                </Crd>
              ))}
            </>
          )}
        </Modal>
      )}

      {detailModal === 'richiami' && (
        <Modal title="🔔 Richiami clinici" onClose={() => setDetailModal(null)} wide>
          {richiamiTotali === 0 && <div style={{ textAlign: 'center', color: C.txl, padding: 30 }}>Nessun richiamo in scadenza 🎉</div>}
          {richiamiScaduti.length > 0 && (
            <>
              <div style={{ fontSize: 11, fontWeight: 800, color: C.dan, textTransform: 'uppercase', marginBottom: 8 }}>⚠️ Scaduti ({richiamiScaduti.length})</div>
              {richiamiScaduti.map((r, i) => (
                <Crd key={i} style={{ marginBottom: 8, borderLeft: `3px solid ${C.dan}` }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                    <div>
                      <div onClick={() => { setDetailModal(null); onOpenPaz(r.paz, 'paga'); }} style={{ fontWeight: 700, fontSize: 13, color: C.pri, cursor: 'pointer' }}>{r.paz.nome} {r.paz.cognome} ›</div>
                      <div style={{ fontSize: 11, color: C.txm }}>{r.v.richiamoTipo || 'Controllo'}{r.paz.telefono ? ' · 📞 ' + r.paz.telefono : ''}</div>
                    </div>
                    <span style={{ fontWeight: 800, color: C.dan, fontSize: 12 }}>{fmtD(r.data)}</span>
                  </div>
                </Crd>
              ))}
            </>
          )}
          {richiamiProssimi.length > 0 && (
            <>
              <div style={{ fontSize: 11, fontWeight: 800, color: C.pur, textTransform: 'uppercase', margin: '14px 0 8px' }}>📅 Prossimi 30 giorni ({richiamiProssimi.length})</div>
              {richiamiProssimi.map((r, i) => (
                <Crd key={i} style={{ marginBottom: 8, borderLeft: `3px solid ${C.pur}` }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                    <div>
                      <div onClick={() => { setDetailModal(null); onOpenPaz(r.paz, 'paga'); }} style={{ fontWeight: 700, fontSize: 13, color: C.pri, cursor: 'pointer' }}>{r.paz.nome} {r.paz.cognome} ›</div>
                      <div style={{ fontSize: 11, color: C.txm }}>{r.v.richiamoTipo || 'Controllo'}{r.paz.telefono ? ' · 📞 ' + r.paz.telefono : ''}</div>
                    </div>
                    <span style={{ fontWeight: 800, color: C.pur, fontSize: 12 }}>{fmtD(r.data)}</span>
                  </div>
                </Crd>
              ))}
            </>
          )}
        </Modal>
      )}

      {detailModal === 'scadenze' && (
        <Modal title="📆 Scadenze pagamento" onClose={() => setDetailModal(null)} wide>
          {scadenzePagamento.length === 0 && <div style={{ textAlign: 'center', color: C.txl, padding: 30 }}>Nessuna scadenza impostata</div>}
          {scadenzeScadute.length > 0 && (
            <>
              <div style={{ fontSize: 11, fontWeight: 800, color: C.dan, textTransform: 'uppercase', marginBottom: 8 }}>⚠️ Scadute ({scadenzeScadute.length})</div>
              {scadenzeScadute.map((s, i) => (
                <Crd key={i} style={{ marginBottom: 8, borderLeft: `3px solid ${C.dan}` }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                    <div>
                      <div onClick={() => { setDetailModal(null); onOpenPaz(s.paz, 'paga'); }} style={{ fontWeight: 700, fontSize: 13, color: C.pri, cursor: 'pointer' }}>{s.paz.nome} {s.paz.cognome} ›</div>
                      <div style={{ fontSize: 11, color: C.txm }}>{s.pl.titolo} · scadenza {fmtD(s.scadenza)}</div>
                    </div>
                    <span style={{ fontWeight: 800, color: C.dan, fontSize: 14 }}>{fmt(s.importo)}</span>
                  </div>
                </Crd>
              ))}
            </>
          )}
          {scadenzeProssime.length > 0 && (
            <>
              <div style={{ fontSize: 11, fontWeight: 800, color: C.war, textTransform: 'uppercase', margin: '14px 0 8px' }}>📅 Prossimi 30 giorni ({scadenzeProssime.length})</div>
              {scadenzeProssime.map((s, i) => (
                <Crd key={i} style={{ marginBottom: 8, borderLeft: `3px solid ${C.war}` }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                    <div>
                      <div onClick={() => { setDetailModal(null); onOpenPaz(s.paz, 'paga'); }} style={{ fontWeight: 700, fontSize: 13, color: C.pri, cursor: 'pointer' }}>{s.paz.nome} {s.paz.cognome} ›</div>
                      <div style={{ fontSize: 11, color: C.txm }}>{s.pl.titolo} · scadenza {fmtD(s.scadenza)}</div>
                    </div>
                    <span style={{ fontWeight: 800, color: C.war, fontSize: 14 }}>{fmt(s.importo)}</span>
                  </div>
                </Crd>
              ))}
            </>
          )}
        </Modal>
      )}

      {detailModal === 'prev' && (
        <Modal title="📈 Previsionale incassi" onClose={() => setDetailModal(null)} wide>
          <div style={{ fontSize: 12, color: C.txm, marginBottom: 14, lineHeight: 1.5 }}>Stima basata sulle scadenze di pagamento impostate sui piani di cura.</div>
          {previsionaleMesi.length === 0 && <div style={{ textAlign: 'center', color: C.txl, padding: 30 }}>Nessuna scadenza impostata per il previsionale</div>}
          {previsionaleMesi.map(([mese, importo]) => {
            const [yy, mm] = mese.split('-');
            const max = Math.max(...previsionaleMesi.map((x) => x[1]));
            const pct = max > 0 ? Math.round((importo / max) * 100) : 0;
            return (
              <div key={mese} style={{ marginBottom: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: C.txt }}>{MESI_NOMI[Number(mm) - 1]} {yy}</span>
                  <span style={{ fontSize: 13, fontWeight: 800, color: C.pri }}>{fmt(importo)}</span>
                </div>
                <div style={{ background: C.bg, borderRadius: 5, height: 8, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${pct}%`, background: C.pri, borderRadius: 5 }} />
                </div>
              </div>
            );
          })}
          {previsionaleMesi.length > 0 && (
            <div style={{ marginTop: 14, paddingTop: 12, borderTop: `1px solid ${C.brd}`, display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 13, fontWeight: 800 }}>Totale previsto</span>
              <span style={{ fontSize: 16, fontWeight: 900, color: C.pri }}>{fmt(previsionaleMesi.reduce((s, x) => s + x[1], 0))}</span>
            </div>
          )}
        </Modal>
      )}

      {detailModal === 'daInc' && (
        <Modal title="⚠️ Da incassare — tutti i pazienti" onClose={() => setDetailModal(null)} wide>
          <div style={{ background: C.danL, borderRadius: 10, padding: '10px 14px', marginBottom: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: C.dan }}>Totale da incassare</span>
            <span style={{ fontSize: 20, fontWeight: 900, color: C.dan }}>{fmt(totDaInc)}</span>
          </div>
          {righeDAInc.length === 0 && <div style={{ textAlign: 'center', color: C.txl, padding: 30 }}>Nessun residuo 🎉</div>}
          {righeDAInc.map(({ paz, totDaInc: tot, vociDaInc }) => (
            <Crd key={paz.id} style={{ marginBottom: 10, borderLeft: `3px solid ${C.dan}` }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 8 }}>
                <div>
                  <div onClick={() => { setDetailModal(null); onOpenPaz(paz, 'paga'); }} style={{ fontWeight: 700, fontSize: 14, color: C.pri, cursor: 'pointer', textDecoration: 'underline', textDecorationColor: C.pri + '60' }}>{paz.nome} {paz.cognome} ›</div>
                  {paz.telefono && <div style={{ fontSize: 11, color: C.txm }}>📞 {paz.telefono}</div>}
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 18, fontWeight: 900, color: C.dan }}>{fmt(tot)}</div>
                  <div style={{ fontSize: 10, color: C.txm }}>{vociDaInc.length} prestazion{vociDaInc.length === 1 ? 'e' : 'i'}</div>
                </div>
              </div>
              {vociDaInc.map((v, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '6px 0', borderTop: `1px solid ${C.brd}`, fontSize: 12, gap: 8 }}>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontWeight: 600 }}>{v.prestazione}{v.dente ? ` · d.${v.dente}` : ''}</div>
                    <div style={{ fontSize: 10, color: C.txl }}>{v.pianoTitolo}{v.dataEsec ? ` · eseguita ${fmtD(v.dataEsec)}` : ''}</div>
                  </div>
                  <span style={{ fontWeight: 800, color: C.dan, flexShrink: 0 }}>{fmt(v.prezzo)}</span>
                </div>
              ))}
            </Crd>
          ))}
        </Modal>
      )}

      {detailModal === 'inc' && (
        <Modal title={`✓ Incassate ${anno} — tutti i pazienti`} onClose={() => setDetailModal(null)} wide>
          <div style={{ background: C.sucL, borderRadius: 10, padding: '10px 14px', marginBottom: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: C.suc }}>Totale incassato {anno}</span>
            <span style={{ fontSize: 20, fontWeight: 900, color: C.suc }}>{fmt(totIncAnno)}</span>
          </div>
          {righeInc.length === 0 && <div style={{ textAlign: 'center', color: C.txl, padding: 30 }}>Nessun incasso registrato</div>}
          {righeInc.map(({ paz, totIncAnno: tot, vociIncAnno }) => (
            <Crd key={paz.id} style={{ marginBottom: 10, borderLeft: `3px solid ${C.suc}` }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 6 }}>
                <div>
                  <div onClick={() => { setDetailModal(null); onOpenPaz(paz, 'paga'); }} style={{ fontWeight: 700, fontSize: 14, color: C.pri, cursor: 'pointer', textDecoration: 'underline', textDecorationColor: C.pri + '60' }}>{paz.nome} {paz.cognome} ›</div>
                  {paz.telefono && <div style={{ fontSize: 11, color: C.txm }}>📞 {paz.telefono}</div>}
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 18, fontWeight: 900, color: C.suc }}>{fmt(tot)}</div>
                  <div style={{ fontSize: 10, color: C.txm }}>{vociIncAnno.length} prestazion{vociIncAnno.length === 1 ? 'e' : 'i'}</div>
                </div>
              </div>
              {vociIncAnno.map((v, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '6px 0', borderTop: `1px solid ${C.brd}`, fontSize: 12, gap: 8 }}>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontWeight: 600 }}>{v.prestazione}{v.dente ? ` · d.${v.dente}` : ''}</div>
                    <div style={{ fontSize: 10, color: C.txl }}>{v.pianoTitolo}{v.dataEsec ? ` · ${fmtD(v.dataEsec)}` : ''}</div>
                  </div>
                  <span style={{ fontWeight: 800, color: C.suc, flexShrink: 0 }}>{fmt(v.prezzo)}</span>
                </div>
              ))}
            </Crd>
          ))}
        </Modal>
      )}

      <div style={{ marginBottom: 18 }}>
        <div style={{ fontSize: 20, fontWeight: 800, color: C.txt }}>Buongiorno 👋</div>
        <div style={{ fontSize: 13, color: C.txl, marginTop: 2 }}>{fmtD(t)}</div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
        <Crd style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 12 }}>
          <div style={{ background: C.priL, borderRadius: 10, padding: 9 }}><Ic n="pz" s={20} c={C.pri} /></div>
          <div><div style={{ fontSize: 19, fontWeight: 800 }}>{patients.length}</div><div style={{ fontSize: 11, color: C.txm, fontWeight: 600 }}>Pazienti</div></div>
        </Crd>
        <Crd style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 12 }}>
          <div style={{ background: '#E8FAF9', borderRadius: 10, padding: 9 }}><Ic n="cal" s={20} c={C.acc} /></div>
          <div><div style={{ fontSize: 19, fontWeight: 800 }}>{todayApps.length}</div><div style={{ fontSize: 11, color: C.txm, fontWeight: 600 }}>Oggi</div></div>
        </Crd>
        <Crd style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 12 }}>
          <div style={{ background: C.sucL, borderRadius: 10, padding: 9 }}><Ic n="eur" s={20} c={C.suc} /></div>
          <div><div style={{ fontSize: 17, fontWeight: 800 }}>{fmt(mInc)}</div><div style={{ fontSize: 11, color: C.txm, fontWeight: 600 }}>Incasso mese</div></div>
        </Crd>
        <Crd style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 12 }}>
          <div style={{ background: '#FEF3E2', borderRadius: 10, padding: 9 }}><Ic n="plan" s={20} c={C.war} /></div>
          <div><div style={{ fontSize: 19, fontWeight: 800 }}>{plans.flatMap((pl) => pl.voci.filter((v) => !v.eseguita)).length}</div><div style={{ fontSize: 11, color: C.txm, fontWeight: 600 }}>Da eseguire</div></div>
        </Crd>
      </div>

      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 11, fontWeight: 800, color: C.txm, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>🎛️ Controllo studio</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <div onClick={() => setDetailModal('prevent')} style={{ background: C.purL, borderRadius: 12, padding: 14, border: `1px solid ${C.pur}40`, cursor: 'pointer', position: 'relative' }}>
            <div style={{ position: 'absolute', top: 10, right: 10, fontSize: 14, opacity: 0.5 }}>›</div>
            <div style={{ fontSize: 10, fontWeight: 800, color: C.pur, textTransform: 'uppercase', letterSpacing: '0.06em' }}>📋 Preventivi</div>
            <div style={{ fontSize: 22, fontWeight: 900, color: C.pur, marginTop: 4 }}>{preventiviAttesa.length + preventiviRifiutati.length}</div>
            <div style={{ fontSize: 11, color: C.pur + 'BB', marginTop: 2 }}>{preventiviAttesa.length} in attesa · {preventiviRifiutati.length} rifiutati</div>
          </div>
          <div onClick={() => setDetailModal('richiami')} style={{ background: richiamiScaduti.length > 0 ? C.danL : '#FEF3E2', borderRadius: 12, padding: 14, border: `1px solid ${richiamiScaduti.length > 0 ? C.dan : C.war}40`, cursor: 'pointer', position: 'relative' }}>
            <div style={{ position: 'absolute', top: 10, right: 10, fontSize: 14, opacity: 0.5 }}>›</div>
            <div style={{ fontSize: 10, fontWeight: 800, color: richiamiScaduti.length > 0 ? C.dan : C.war, textTransform: 'uppercase', letterSpacing: '0.06em' }}>🔔 Richiami</div>
            <div style={{ fontSize: 22, fontWeight: 900, color: richiamiScaduti.length > 0 ? C.dan : C.war, marginTop: 4 }}>{richiamiTotali}</div>
            <div style={{ fontSize: 11, color: (richiamiScaduti.length > 0 ? C.dan : C.war) + 'BB', marginTop: 2 }}>{richiamiScaduti.length} scaduti · {richiamiProssimi.length} prossimi</div>
          </div>
          <div onClick={() => setDetailModal('scadenze')} style={{ background: scadenzeScadute.length > 0 ? C.danL : C.priL, borderRadius: 12, padding: 14, border: `1px solid ${scadenzeScadute.length > 0 ? C.dan : C.pri}40`, cursor: 'pointer', position: 'relative' }}>
            <div style={{ position: 'absolute', top: 10, right: 10, fontSize: 14, opacity: 0.5 }}>›</div>
            <div style={{ fontSize: 10, fontWeight: 800, color: scadenzeScadute.length > 0 ? C.dan : C.pri, textTransform: 'uppercase', letterSpacing: '0.06em' }}>📆 Scadenze</div>
            <div style={{ fontSize: 22, fontWeight: 900, color: scadenzeScadute.length > 0 ? C.dan : C.pri, marginTop: 4 }}>{fmt(scadenzePagamento.reduce((s, x) => s + x.importo, 0))}</div>
            <div style={{ fontSize: 11, color: (scadenzeScadute.length > 0 ? C.dan : C.pri) + 'BB', marginTop: 2 }}>{scadenzeScadute.length} scadute · {scadenzeProssime.length} prossime</div>
          </div>
          <div onClick={() => setDetailModal('prev')} style={{ background: C.sucL, borderRadius: 12, padding: 14, border: `1px solid ${C.suc}40`, cursor: 'pointer', position: 'relative' }}>
            <div style={{ position: 'absolute', top: 10, right: 10, fontSize: 14, opacity: 0.5 }}>›</div>
            <div style={{ fontSize: 10, fontWeight: 800, color: C.suc, textTransform: 'uppercase', letterSpacing: '0.06em' }}>📈 Previsionale</div>
            <div style={{ fontSize: 22, fontWeight: 900, color: C.suc, marginTop: 4 }}>{fmt(previsionaleMesi.reduce((s, x) => s + x[1], 0))}</div>
            <div style={{ fontSize: 11, color: C.suc + 'BB', marginTop: 2 }}>prossimi 6 mesi</div>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
        <div onClick={() => setDetailModal('daInc')} style={{ background: C.danL, borderRadius: 12, padding: 14, border: `1px solid ${C.dan}40`, cursor: 'pointer', position: 'relative', userSelect: 'none' }}>
          <div style={{ position: 'absolute', top: 10, right: 10, fontSize: 14, opacity: 0.5 }}>›</div>
          <div style={{ fontSize: 10, fontWeight: 800, color: C.dan, textTransform: 'uppercase', letterSpacing: '0.06em' }}>⚠️ Da incassare</div>
          <div style={{ fontSize: 22, fontWeight: 900, color: C.dan, marginTop: 4 }}>{fmt(totDaInc)}</div>
          <div style={{ fontSize: 11, color: C.dan + 'BB', marginTop: 2 }}>{nPazDaInc} pazienti · tocca per dettagli</div>
        </div>
        <div onClick={() => setDetailModal('inc')} style={{ background: C.sucL, borderRadius: 12, padding: 14, border: `1px solid ${C.suc}40`, cursor: 'pointer', position: 'relative', userSelect: 'none' }}>
          <div style={{ position: 'absolute', top: 10, right: 10, fontSize: 14, opacity: 0.5 }}>›</div>
          <div style={{ fontSize: 10, fontWeight: 800, color: C.suc, textTransform: 'uppercase', letterSpacing: '0.06em' }}>✓ Incassate {anno}</div>
          <div style={{ fontSize: 22, fontWeight: 900, color: C.suc, marginTop: 4 }}>{fmt(totIncAnno)}</div>
          <div style={{ fontSize: 11, color: C.suc + 'BB', marginTop: 2 }}>{nPazInc} pazienti · tocca per dettagli</div>
        </div>
      </div>

      <Crd>
        <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 10 }}>Prossimi appuntamenti</div>
        {upcoming.length === 0 && <div style={{ color: C.txl, fontSize: 13, textAlign: 'center', padding: '14px 0' }}>Nessun appuntamento</div>}
        {upcoming.map((a) => {
          const p = patients.find((x) => x.id === a.pazienteId);
          return (
            <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 0', borderBottom: `1px solid ${C.brd}` }}>
              <div style={{ background: C.priL, borderRadius: 8, padding: '5px 7px', textAlign: 'center', minWidth: 40, flexShrink: 0 }}>
                <div style={{ fontSize: 10, color: C.pri, fontWeight: 700 }}>{a.data.slice(8)}/{a.data.slice(5, 7)}</div>
                <div style={{ fontSize: 12, color: C.priD, fontWeight: 800 }}>{a.ora}</div>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p ? `${p.nome} ${p.cognome}` : '—'}</div>
                <div style={{ fontSize: 12, color: C.txm }}>{a.tipo}</div>
              </div>
              <Bdg ch={a.stato} co={a.stato === 'confermato' ? C.suc : C.war} />
            </div>
          );
        })}
      </Crd>
    </div>
  );
}
