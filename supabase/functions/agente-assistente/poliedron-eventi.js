// POL-AI-011 — one structured row per Poliedron answer, for the dashboard
// "Come risponde Poliedron" (how much the Core closes without the model).
// Learning Engine rule: never the chat text, never patient names or ids — only
// route, recognised intent, outcome, the names of the tools the model called,
// provider and duration. Best effort: a failed write never changes the answer.

const TOOL_NAME = /^[a-z0-9_]{1,60}$/;
const INTENT = /^[A-Z_]{1,40}$/;

/** Tool name as stored: studio-defined custom actions keep only their category. */
export const nomeAzione = (name) => (String(name || '').startsWith('azione_') ? 'azione_personalizzata' : TOOL_NAME.test(name) ? name : 'altro');

function esito(body, evento) {
  if (evento.annullata) return 'non_eseguito';
  if (body.needsConfirmation) return 'conferma';
  if (body.uncertain) return 'non_eseguito';
  if (body.changed?.length || /^Fatto\./.test(body.text || '')) return 'eseguito';
  if (/\?\s*$/.test(String(body.text || '').trim())) return 'chiarimento';
  return 'risposta';
}

/** The row for an answer body, or null when there is nothing to record (input errors). */
export function rigaEvento(body, evento, durataMs) {
  if (!body || typeof body !== 'object' || body.error || !evento?.studioId || !evento?.userId) return null;
  const percorso = evento.conferma ? 'conferma' : body.core_mode ? 'core' : body.emergency_mode ? 'essenziale' : 'modello';
  const azioni = [...new Set((evento.azioni || []).map(nomeAzione))].slice(0, 12);
  return {
    studio_id: evento.studioId,
    user_id: evento.userId,
    percorso,
    intento: INTENT.test(evento.intento || '') ? evento.intento : null,
    esito: esito(body, evento),
    azioni: percorso === 'modello' ? azioni : [],
    provider: percorso === 'modello' && ['openai', 'anthropic'].includes(evento.provider) ? evento.provider : null,
    durata_ms: Number.isFinite(durataMs) ? Math.min(Math.max(Math.round(durataMs), 0), 600000) : null,
  };
}

export async function registraEvento(client, riga) {
  try {
    const { error } = await client.from('poliedron_eventi').insert(riga);
    if (error) console.error('poliedron_eventi', error.message);
  } catch (error) {
    console.error('poliedron_eventi', error?.message || String(error));
  }
}
