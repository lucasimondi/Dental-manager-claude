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
const STANDBY_TRATTAMENTO_GIORNI = 10;

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

// Un appuntamento attivo (non annullato) e non nel passato conta come "il
// paziente è già stato ripreso in carico" per la regola 5 — non serve che
// combaci con una data/trattamento specifico, basta che qualcosa sia
// effettivamente in agenda.
const hasAppuntamentoAttivoFuturo = (appointments, pazienteId) => {
  const t = today();
  return appointments.some((a) => String(a.pazienteId) === String(pazienteId) && a.stato !== 'annullato' && a.data >= t);
};

/**
 * Motore del bot Richiami: confronta pazienti, piani di cura, pagamenti e
 * agenda e produce due liste:
 * - proposte: nuovi richiami da creare (non ancora presenti, per chiaveBot)
 * - daRimuovere: id di richiami bot aperti ('da_fare') la cui condizione non
 *   è più vera (coperti da un appuntamento, saldati, fatturati, piano
 *   deciso) e vanno tolti da soli, invece di restare segnalati per sempre
 *
 * Pura, senza side effect: chi la chiama decide se e come applicare il
 * risultato allo stato/DB (vedi App.jsx e Richiami.jsx).
 *
 * Product Owner: "c'è capraro con incasso in standby, ma non è in standby,
 * e sono due capraro, poi Lauretti anche doppio ... dovrebbe essere un solo
 * Lauretti". Causa reale confermata sui dati di produzione: la regola
 * "eseguita ma non incassata" (sotto, #4) generava UN richiamo PER OGNI
 * VOCE del piano invece che uno per piano (due estrazioni identiche sullo
 * stesso piano di Capraro → due righe identiche), e nessuna delle regole
 * 2/3/4 aveva mai una chiusura automatica come la #1 — una volta creato, un
 * richiamo restava "da_fare" per sempre anche dopo che il pagamento veniva
 * saldato o la prestazione fatturata (le voci di Capraro erano già tutte
 * `incassata:true`, ma i richiami erano ancora aperti). Risolto
 * consolidando la #4 per piano (non per voce) e aggiungendo una chiusura
 * automatica generica per le regole 2/3/4/5 in fondo alla funzione.
 */
export function generaRichiamiBot({ patients, plans, payments, appointments, richiami }) {
  const proposte = [];
  const daRimuovere = [];
  const chiaviEsistenti = new Set(richiami.map((r) => r.chiaveBot).filter(Boolean));
  const pazienteEsiste = (id) => patients.some((p) => String(p.id) === String(id));
  const planById = new Map(plans.map((pl) => [String(pl.id), pl]));
  const paymentById = new Map(payments.map((p) => [String(p.id), p]));

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

  // 4) Prestazioni eseguite ma non ancora incassate da troppo tempo — UN
  //    richiamo per PIANO (somma di tutte le voci in questa condizione),
  //    non uno per voce: due estrazioni identiche sullo stesso piano non
  //    devono produrre due righe identiche. Categoria propria ("da
  //    fatturare", non "incasso in standby"): non è un pagamento bloccato,
  //    solo lavoro eseguito ancora da fatturare — etichette diverse per
  //    situazioni diverse.
  plans.forEach((pl) => {
    if (!pazienteEsiste(pl.pazienteId)) return;
    const daIncassare = (pl.voci || []).filter((v) => v.eseguita && !v.incassata);
    if (daIncassare.length === 0) return;
    const piuVecchia = daIncassare.reduce((min, v) => (min === null || (v.dataEsec || '') < (min.dataEsec || '') ? v : min), null);
    if (giorniDa(piuVecchia?.dataEsec) < STANDBY_ESEGUITA_GIORNI) return;
    const chiave = `plan_incasso:${pl.id}`;
    if (chiaviEsistenti.has(chiave)) return;
    const totale = daIncassare.reduce((s, v) => s + Number(v.prezzo || 0), 0);
    const elenco = daIncassare.length > 1 ? `${daIncassare.length} prestazioni eseguite non ancora fatturate` : `"${daIncassare[0].prestazione}" eseguita il ${fmtD(daIncassare[0].dataEsec)} e non ancora fatturata`;
    proposte.push({
      pazienteId: pl.pazienteId, categoria: 'da_fatturare',
      motivo: `${fmt(totale)} da fatturare — ${elenco}`,
      dataScadenza: today(), origine: 'bot', stato: 'da_fare', chiaveBot: chiave,
    });
  });

  // 5) Trattamento accettato ma senza nulla in agenda — Product Owner: "ho
  //    annullato appuntamento di fabio distefano, non ha generato un
  //    richiamo che dica che deve fare otturazione". Due modi per "annullare"
  //    in Agenda.jsx: cambiare lo stato in "Annullato" (traccia resta, la
  //    rileviamo subito) oppure eliminare l'appuntamento (nessuna traccia
  //    possibile — cancellato dal DB). Per coprire ANCHE il secondo caso, la
  //    regola scatta se: il piano è accettato, la prestazione non è ancora
  //    eseguita, il paziente non ha nulla di attivo in agenda da oggi in
  //    poi, e (c'è un appuntamento "Annullato" tracciato — scatta subito —
  //    OPPURE sono passati più di STANDBY_TRATTAMENTO_GIORNI giorni dalla
  //    creazione del piano senza che nulla sia mai stato prenotato — copre
  //    anche l'eliminazione, che non lascia traccia). Un solo richiamo per
  //    (piano, voce), non uno per appuntamento annullato.
  plans.forEach((pl) => {
    if (pl.stato !== 'accettato' || !pazienteEsiste(pl.pazienteId)) return;
    if (hasAppuntamentoAttivoFuturo(appointments, pl.pazienteId)) return;
    const pazAppuntamenti = appointments.filter((a) => String(a.pazienteId) === String(pl.pazienteId));
    const haAnnullato = pazAppuntamenti.some((a) => a.stato === 'annullato');
    if (!haAnnullato && giorniDa(pl.data) < STANDBY_TRATTAMENTO_GIORNI) return;
    (pl.voci || []).forEach((v, i) => {
      if (v.eseguita) return;
      const chiave = `appt_cancel_pending:${pl.id}:${i}`;
      if (chiaviEsistenti.has(chiave)) return;
      proposte.push({
        pazienteId: pl.pazienteId, categoria: 'clinico',
        motivo: `"${v.prestazione || 'Trattamento'}" ancora da fare, nulla in agenda${haAnnullato ? ' (appuntamento annullato)' : ''}`,
        dataScadenza: today(), origine: 'bot', stato: 'da_fare', chiaveBot: chiave,
      });
    });
  });

  // Chiusura automatica generica per le regole 2/3/4/5: un richiamo bot
  // 'da_fare' la cui condizione non è più vera (piano deciso, pagamento
  // saldato, voce fatturata, prestazione eseguita o paziente ripreso in
  // agenda) va rimosso invece di restare segnalato per sempre. La regola 1
  // ha già la propria chiusura sopra (copertura da appuntamento vicino).
  richiami.forEach((r) => {
    if (r.stato !== 'da_fare' || r.origine !== 'bot' || !r.chiaveBot || daRimuovere.includes(r.id)) return;
    if (r.chiaveBot.startsWith('plan_voce:')) return; // già gestita sopra
    if (r.chiaveBot.startsWith('plan_voce_incasso:')) {
      // Formato legacy pre-consolidamento (un richiamo per VOCE invece che
      // per piano — causa diretta dei "due Capraro"/"Lauretti doppio"
      // segnalati). Sempre chiuso qui: la regola #4 sopra propone già, con
      // la nuova chiave "plan_incasso:{planId}", l'eventuale richiamo
      // consolidato se quel piano ha ancora qualcosa da fatturare.
      daRimuovere.push(r.id);
    } else if (r.chiaveBot.startsWith('plan_standby:')) {
      const pl = planById.get(r.chiaveBot.slice('plan_standby:'.length));
      if (!pl || (pl.stato || 'attivo') !== 'attivo') daRimuovere.push(r.id);
    } else if (r.chiaveBot.startsWith('payment_standby:')) {
      const p = paymentById.get(r.chiaveBot.slice('payment_standby:'.length));
      if (!p || p.stato !== 'sospeso') daRimuovere.push(r.id);
    } else if (r.chiaveBot.startsWith('plan_incasso:')) {
      const pl = planById.get(r.chiaveBot.slice('plan_incasso:'.length));
      const restaDaIncassare = pl ? (pl.voci || []).some((v) => v.eseguita && !v.incassata) : false;
      if (!restaDaIncassare) daRimuovere.push(r.id);
    } else if (r.chiaveBot.startsWith('appt_cancel_pending:')) {
      const [planIdStr, iStr] = r.chiaveBot.slice('appt_cancel_pending:'.length).split(':');
      const pl = planById.get(planIdStr);
      const v = pl?.voci?.[Number(iStr)];
      if (!pl || pl.stato !== 'accettato' || !v || v.eseguita || hasAppuntamentoAttivoFuturo(appointments, r.pazienteId)) daRimuovere.push(r.id);
    }
  });

  return { proposte, daRimuovere };
}
