// Automatismi reversibili (PO 2026-10-18: "dobbiamo rendere anche gli automatismi reversibili: si crea
// un pagamento automatico ma ho la possibilità di cancellarlo chiudendo ogni dubbio").
// "Pagato" crea da solo la spesa nei Conti e, per i fissi, il pagamento successivo: qui si tiene
// traccia di cosa è stato creato in quel momento, così Annulla toglie esattamente quello e niente altro.
import { segnaScadenza, eliminaScadenza, prossimoPagamentoFisso, prossimaData } from './archivio.js';
import { spesaDaScadenza, annullaSpesaDaScadenza } from './conti.js';

const esito = ({ data, error }) => {
  if (error) throw new Error(error.message || 'Operazione non riuscita');
  return data;
};

const giornoBreve = (iso) => new Date(`${iso}T12:00:00`).toLocaleDateString('it-IT', { day: 'numeric', month: 'short' });

/**
 * Segna pagato e registra gli automatismi. Restituisce il messaggio e `annulla`: gli id creati ora
 * (la spesa e il prossimo pagamento fisso), da passare a annullaPagato.
 */
export async function segnaPagato(db, s) {
  await segnaScadenza(db, s.id, true);
  const spesa = await spesaDaScadenza(db, s).catch(() => null);
  const prossimo = s.ricorrenza ? await prossimoPagamentoFisso(db, s).catch(() => null) : null;
  const messaggio = [spesa ? 'Pagato e registrato tra le spese' : 'Segnato come pagato', prossimo ? `prossimo il ${giornoBreve(prossimo.data)}` : null].filter(Boolean).join(' · ');
  return {
    messaggio,
    annulla: { scadenzaId: s.id, spesaId: spesa?.nuova ? spesa.id : null, prossimoId: prossimo?.nuovo ? prossimo.id : null },
  };
}

// Annulla subito dopo il Pagato: di nuovo da pagare, via la spesa e il pagamento successivo creati.
export async function annullaPagato(db, { scadenzaId, spesaId, prossimoId }) {
  await segnaScadenza(db, scadenzaId, false);
  if (spesaId) esito(await db.from('movimenti').delete().eq('id', spesaId).select('id'));
  // Solo se è ancora da pagare: se nel frattempo è stato pagato non si tocca.
  if (prossimoId) esito(await db.from('scadenze').delete().eq('id', prossimoId).eq('completata', false).select('id'));
  return 'Annullato: di nuovo da pagare';
}

// Il pagamento successivo creato in automatico da un fisso: stessa descrizione, data successiva, senza documento.
async function successiviAutomatici(db, s, { soloIlProssimo }) {
  let q = db.from('scadenze').select('id, data').eq('descrizione', s.descrizione).eq('completata', false).eq('storica', false)
    .is('documento_id', null).not('ricorrenza', 'is', null);
  if (soloIlProssimo) {
    const data = prossimaData(s.data, s.ricorrenza);
    if (!data) return [];
    q = q.eq('data', data);
  } else {
    q = q.gt('data', s.data);
  }
  return esito(await q.limit(60));
}

/**
 * "Segna da pagare" più tardi, dalla scheda del pagamento: via la spesa automatica e, per un fisso,
 * il pagamento successivo creato da quel Pagato (se è ancora da pagare).
 */
export async function rimettiDaPagare(db, s) {
  await segnaScadenza(db, s.id, false);
  await annullaSpesaDaScadenza(db, s.id).catch(() => null);
  let tolti = 0;
  if (s.ricorrenza) {
    const ids = (await successiviAutomatici(db, s, { soloIlProssimo: true })).map((x) => x.id);
    if (ids.length) tolti = esito(await db.from('scadenze').delete().in('id', ids).select('id')).length;
  }
  return tolti ? 'Di nuovo da pagare · tolto anche il pagamento successivo' : 'Segnato da pagare';
}

// Eliminare un pagamento toglie anche la spesa registrata in automatico (prima restava nei Conti).
export async function eliminaPagamento(db, s) {
  const spese = await annullaSpesaDaScadenza(db, s.id).catch(() => []);
  await eliminaScadenza(db, s.id);
  return spese?.length ? 'Pagamento eliminato, con la sua spesa nei Conti' : 'Pagamento eliminato';
}

/**
 * "Non si ripete più" (es. un finanziamento finito): niente più ripetizione su questo pagamento e
 * via i successivi creati in automatico ancora da pagare. Quelli già pagati restano.
 */
export async function interrompiRicorrenza(db, s) {
  esito(await db.from('scadenze').update({ ricorrenza: null }).eq('id', s.id).select('id'));
  const ids = (await successiviAutomatici(db, s, { soloIlProssimo: false })).map((x) => x.id);
  const tolti = ids.length ? esito(await db.from('scadenze').delete().in('id', ids).select('id')).length : 0;
  return tolti ? `Non si ripete più · ${tolti === 1 ? 'tolto il pagamento successivo' : `tolti ${tolti} pagamenti successivi`}` : 'Non si ripete più';
}
