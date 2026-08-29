import { today, fmt, fmtD } from './utils.js';

// Un richiamo "clinico" già coperto da un appuntamento prenotato entro questa
// finestra (in giorni, prima o dopo la data target) non deve essere riproposto:
// il paziente è già stato ripreso in carico, anche se la data non è esatta al giorno.
const FINESTRA_MATCH_GIORNI = 20;

// Soglie di "fermo da troppo tempo" per considerare preventivi/incassi in
// standby: sotto questa soglia il caso è normale amministrazione, non ancora
// un richiamo da gestire.
const STANDBY_PREVENTIVO_GIORNI = 14;
const STANDBY_INCASSO_GIORNI = 7;
const STANDBY_ESEGUITA_GIORNI = 30;

const giorniDa = (dataStr) => {
  if (!dataStr) return 0;
  return Math.floor((Date.now() - new Date(dataStr + 'T12:00').getTime()) / 86400000);
};

const hasAppuntamentoVicino = (appointments, pazienteId, dataTarget) => {
  const target = new Date(dataTarget + 'T12:00').getTime();
  return appointments.some((a) => {
    if (String(a.pazienteId) !== String(pazienteId)) return false;
    if (a.stato === 'annullato' || !a.data) return false;
    const diffGiorni = Math.abs((new Date(a.data + 'T12:00').getTime() - target) / 86400000);
    return diffGiorni <= FINESTRA_MATCH_GIORNI;
  });
};

/**
 * Motore del bot Richiami: confronta pazienti, piani di cura, pagamenti e
 * agenda e produce due liste:
 * - proposte: nuovi richiami da creare (non ancora presenti, per chiaveBot)
 * - daRimuovere: id di richiami bot aperti ('da_fare') che nel frattempo
 *   sono stati coperti da un appuntamento in agenda e vanno tolti da soli
 *
 * Pura, senza side effect: chi la chiama decide se e come applicare il
 * risultato allo stato/DB (vedi App.jsx e Richiami.jsx).
 */
export function generaRichiamiBot({ patients, plans, payments, appointments, richiami, saldiAperti = [] }) {
  const proposte = [];
  const daRimuovere = [];
  const chiaviEsistenti = new Set(richiami.map((r) => r.chiaveBot).filter(Boolean));
  const pazienteEsiste = (id) => patients.some((p) => String(p.id) === String(id));
  // POL-FIN-002 follow-up (Product Owner audit): whether a plan still has
  // "eseguito non incassato" must come from the canonical
  // get_saldi_aperti_studio RPC (eseguito_non_pagato), never from the
  // legacy manual "incassata" flag — same source as Dashboard/Incassi/
  // SchedaPaz, so this reminder never disagrees with what those show.
  const pianiEseguitoNonPagato = new Set((saldiAperti || []).filter((r) => Number(r.eseguito_non_pagato) > 0).map((r) => String(r.piano_id)));

  // 1) Richiami clinici: voci di piano eseguite con richiamo impostato
  //    (rilevato/impostato in SchedaPaz — qui si controlla solo se è già
  //    coperto da un appuntamento oppure va segnalato in Richiami)
  plans.forEach((pl) => {
    (pl.voci || []).forEach((v, i) => {
      if (!v.eseguita || !v.richiamoData || !pazienteEsiste(pl.pazienteId)) return;
      const chiave = `plan_voce:${pl.id}:${i}`;
      const coperto = hasAppuntamentoVicino(appointments, pl.pazienteId, v.richiamoData);
      if (coperto) {
        const esistente = richiami.find((r) => r.chiaveBot === chiave && r.stato === 'da_fare');
        if (esistente) daRimuovere.push(esistente.id);
        return;
      }
      if (chiaviEsistenti.has(chiave)) return;
      proposte.push({
        pazienteId: pl.pazienteId, categoria: 'clinico',
        motivo: v.richiamoTipo || 'Controllo', dataScadenza: v.richiamoData,
        origine: 'bot', stato: 'da_fare', chiaveBot: chiave,
      });
    });
  });

  // 2) Preventivi fermi in attesa di risposta da troppo tempo
  plans.forEach((pl) => {
    if ((pl.stato || 'attivo') !== 'attivo') return;
    if (!pazienteEsiste(pl.pazienteId)) return;
    if (giorniDa(pl.data) < STANDBY_PREVENTIVO_GIORNI) return;
    const chiave = `plan_standby:${pl.id}`;
    if (chiaviEsistenti.has(chiave)) return;
    proposte.push({
      pazienteId: pl.pazienteId, categoria: 'preventivo',
      motivo: `Preventivo "${pl.titolo || 'senza titolo'}" in attesa da oltre ${STANDBY_PREVENTIVO_GIORNI} giorni`,
      dataScadenza: today(), origine: 'bot', stato: 'da_fare', chiaveBot: chiave,
    });
  });

  // 3) Pagamenti sospesi da troppo tempo
  payments.forEach((p) => {
    if (p.stato !== 'sospeso') return;
    if (!pazienteEsiste(p.pazienteId)) return;
    if (giorniDa(p.data) < STANDBY_INCASSO_GIORNI) return;
    const chiave = `payment_standby:${p.id}`;
    if (chiaviEsistenti.has(chiave)) return;
    proposte.push({
      pazienteId: p.pazienteId, categoria: 'incasso',
      motivo: `Pagamento sospeso di ${fmt(p.importo)} in attesa da oltre ${STANDBY_INCASSO_GIORNI} giorni`,
      dataScadenza: today(), origine: 'bot', stato: 'da_fare', chiaveBot: chiave,
    });
  });

  // 4) Prestazioni eseguite ma il piano ha ancora eseguito non incassato da troppo tempo
  plans.forEach((pl) => {
    (pl.voci || []).forEach((v, i) => {
      if (!v.eseguita || !pianiEseguitoNonPagato.has(String(pl.id)) || !pazienteEsiste(pl.pazienteId)) return;
      if (giorniDa(v.dataEsec) < STANDBY_ESEGUITA_GIORNI) return;
      const chiave = `plan_voce_incasso:${pl.id}:${i}`;
      if (chiaviEsistenti.has(chiave)) return;
      proposte.push({
        pazienteId: pl.pazienteId, categoria: 'incasso',
        motivo: `"${v.prestazione}" eseguita il ${fmtD(v.dataEsec)} e non ancora incassata`,
        dataScadenza: today(), origine: 'bot', stato: 'da_fare', chiaveBot: chiave,
      });
    });
  });

  return { proposte, daRimuovere };
}
