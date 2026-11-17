// HOME-STUDIO (PO 2026-11-17): i conteggi della Home dello Studio. Puri: nessuna query e nessuna
// formula economica nuova (le scadenze vengono da computeScadenzePagamento, la stessa fonte di
// Controllo di gestione e della Home classica; i richiami con la stessa regola di homeAttention).
import { today } from './utils.js';
import { computeScadenzePagamento } from './domain/scadenzePagamentoService.js';

const piuGiorni = (data, n) => { const d = new Date(`${data}T12:00`); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };

export function riepilogoStudio({ appointments = [], richiami = [], plans = [], patients = [], payments = [], oggi = today(), ora = '00:00', conScadenze = false } = {}) {
  const attivi = appointments.filter((a) => a && a.stato !== 'annullato');
  const diOggi = attivi.filter((a) => a.data === oggi).sort((a, b) => String(a.ora || '').localeCompare(String(b.ora || '')));
  const prossimo = diOggi.find((a) => String(a.ora || '') >= ora) || null;
  const daConfermareOggi = diOggi.filter((a) => a.stato === 'da confermare').length;
  const fineSettimana = piuGiorni(oggi, 7);
  const daConfermare = attivi.filter((a) => a.stato === 'da confermare' && a.data > oggi && a.data <= fineSettimana).length;
  const aperti = richiami.filter((r) => r && r.stato === 'da_fare');
  const richiamiScaduti = aperti.filter((r) => String(r.dataScadenza || '') < oggi).length;
  const richiamiOggi = aperti.filter((r) => String(r.dataScadenza || '') === oggi).length;
  const pagamentiScaduti = conScadenze
    ? computeScadenzePagamento(plans, patients, payments).filter((s) => new Date(`${s.scadenza}T12:00`) < new Date(`${oggi}T12:00`)).length
    : 0;
  return { diOggi, prossimo, daConfermareOggi, daConfermare, richiamiScaduti, richiamiOggi, pagamentiScaduti, fine: diOggi.length ? diOggi[diOggi.length - 1].ora : null };
}

