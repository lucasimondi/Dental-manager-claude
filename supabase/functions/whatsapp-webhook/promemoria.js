// Promemoria automatici degli appuntamenti (POL-WA-003b).
// Chiamato ogni ora da pg_cron (vedi migration 20261004120000_pol_wa_003b_promemoria.sql):
// per gli studi con promemoria attivi, all'ora scelta dallo studio, invia il modello
// Meta approvato ai pazienti con consenso WhatsApp che hanno un appuntamento domani.
// Non dipende da Deno: riceve il client e l'invio come parametri, così è testabile.
import {
  dataDomaniStudio,
  normalizzaTelefono,
  oraAdessoStudio,
  parametriPromemoria,
  testoPromemoria,
} from './logica.js';

export async function eseguiPromemoria({ admin, inviaTemplate, adesso = new Date() }) {
  const ora = oraAdessoStudio(adesso);
  const domani = dataDomaniStudio(adesso);
  const esito = { ora, domani, studi: 0, inviati: 0, saltati: 0, errori: 0 };

  const { data: configs } = await admin.from('whatsapp_config')
    .select('studio_id, phone_number_id, promemoria_template, promemoria_lingua')
    .eq('attivo', true).eq('promemoria_attivi', true).eq('promemoria_ora', ora);

  for (const cfg of configs || []) {
    const { data: studio } = await admin.from('studios').select('nome, feature_overrides').eq('id', cfg.studio_id).maybeSingle();
    if (studio?.feature_overrides?.whatsapp_automatico !== true) continue;
    esito.studi += 1;

    const { data: apps } = await admin.from('appointments')
      .select('id, paziente_id, data, ora, stato')
      .eq('studio_id', cfg.studio_id).eq('data', domani)
      .or('stato.is.null,stato.neq.annullato');

    for (const app of apps || []) {
      if (!app.paziente_id) continue;
      const { data: paz } = await admin.from('patients')
        .select('id, nome, telefono, consenso_whatsapp')
        .eq('studio_id', cfg.studio_id).eq('id', app.paziente_id).maybeSingle();
      const telefono = normalizzaTelefono(paz?.telefono);
      if (!paz || paz.consenso_whatsapp !== true || !telefono) { esito.saltati += 1; continue; }

      // Prenotazione dell'invio: l'unicità su appuntamento_id impedisce doppi invii
      // anche se il job parte due volte o lo stesso appuntamento viene riletto.
      const { data: prenotato, error: errPren } = await admin.from('whatsapp_promemoria')
        .insert({ studio_id: cfg.studio_id, appuntamento_id: app.id, paziente_id: paz.id, telefono, stato: 'in_invio' })
        .select('id').single();
      if (errPren || !prenotato) { esito.saltati += 1; continue; }

      const parametri = parametriPromemoria({ nome: paz.nome, nomeStudio: studio.nome, data: app.data, ora: app.ora });
      const invio = await inviaTemplate({
        phoneNumberId: cfg.phone_number_id, telefono,
        template: cfg.promemoria_template, lingua: cfg.promemoria_lingua, parametri,
      });
      const waId = invio?.messages?.[0]?.id || null;
      await admin.from('whatsapp_promemoria').update({
        stato: waId ? 'inviato' : 'errore',
        wa_message_id: waId,
        errore: waId ? null : String(invio?.error?.message || 'invio non riuscito').slice(0, 500),
        inviato_il: new Date().toISOString(),
      }).eq('id', prenotato.id);

      if (waId) {
        esito.inviati += 1;
        // Nello storico, così l'assistente sa cosa ha ricevuto il paziente se risponde.
        await admin.from('whatsapp_conversazioni').upsert(
          { studio_id: cfg.studio_id, telefono, paziente_id: paz.id, ultimo_messaggio_il: new Date().toISOString() },
          { onConflict: 'studio_id,telefono' },
        );
        await admin.from('whatsapp_messages').insert({
          studio_id: cfg.studio_id, paziente_id: paz.id, telefono, direzione: 'out', origine: 'sistema',
          tipo: 'template', contenuto: testoPromemoria(parametri), wa_message_id: waId, stato: 'inviato',
        });
      } else {
        esito.errori += 1;
      }
    }
  }
  return esito;
}
