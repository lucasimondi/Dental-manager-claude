// ETICHETTE-PREMIUM (PO 2026-11-21): «Come potremmo mettere le impostazioni in più delle etichette per
// essere ancora più premium» → mockup «Poliedra · Etichette premium» → «Mi piace vai».
// Primo passo: Tempi (preparazione prima, sanificazione dopo) e Promemoria WhatsApp per tipo di appuntamento.
// Salvati in studio_info.agenda_settings.tipi_extra[<id del tipo>] (jsonb già esistente, niente migrazione,
// niente colonne nuove su app_types). Funzioni pure, usate da Impostazioni e Agenda dello Studio.

export const MINUTI_TEMPI = Object.freeze([0, 5, 10, 15, 20, 30, 45, 60]);
export const CONFERMA_TESTO = 'Risponda SÌ per confermare.';
const MAX_TESTO = 1000;

const testo = (s) => String(s ?? '').replace(/\r\n/g, '\n').trim().slice(0, MAX_TESTO);
const minuti = (v) => {
  const n = Math.round(Number(v) / 5) * 5;
  return Number.isFinite(n) ? Math.min(120, Math.max(0, n)) : 0;
};

/** Impostazioni in più di un tipo, sempre complete e pulite. */
export function normalizzaExtra(x) {
  const e = x && typeof x === 'object' ? x : {};
  return { prima: minuti(e.prima), dopo: minuti(e.dopo), testo: testo(e.testo), istruzioni: testo(e.istruzioni), conferma: e.conferma === true };
}

const vuoto = (e) => !e.prima && !e.dopo && !e.testo && !e.istruzioni && !e.conferma;

/** Impostazioni in più del tipo (per id; se manca l'id, per nome tra i tipi dati). */
export function extraTipo(agendaSettings, tipo, tipi = []) {
  const mappa = agendaSettings?.tipi_extra;
  if (!mappa || typeof mappa !== 'object' || !tipo) return normalizzaExtra(null);
  const id = typeof tipo === 'object' ? tipo.id : tipi.find((t) => t?.nome === tipo)?.id;
  return normalizzaExtra(id != null ? mappa[String(id)] : null);
}

/** Nuova mappa tipi_extra con le impostazioni del tipo id (tolte se tornano vuote). Non tocca le altre. */
export function conExtraTipo(agendaSettings, id, extra) {
  const prima = agendaSettings?.tipi_extra && typeof agendaSettings.tipi_extra === 'object' ? agendaSettings.tipi_extra : {};
  const out = { ...prima };
  const e = normalizzaExtra(extra);
  if (id == null || id === '') return out;
  if (vuoto(e)) delete out[String(id)]; else out[String(id)] = e;
  return out;
}

/** Durata in minuti suggerita dal tipo, oppure null. */
export function durataTipo(tipo) {
  const n = Number(tipo?.durata);
  return Number.isFinite(n) && n > 0 ? Math.round(n) : null;
}

/** Minuti occupati in agenda: preparazione + appuntamento + sanificazione. */
export function minutiOccupati(durata, extra) {
  const e = normalizzaExtra(extra);
  return e.prima + (Number(durata) || 0) + e.dopo;
}

const sostituisci = (t, v) => t
  .replace(/\{nome\}/g, v.nome).replace(/\{data\}/g, v.data).replace(/\{ora\}/g, v.ora)
  .replace(/\{tipo\}/g, v.tipo).replace(/\{studio\}/g, v.studio);

/**
 * Messaggio WhatsApp di promemoria per un appuntamento. Senza testo del tipo usa `predefinito`
 * (il messaggio di sempre); poi aggiunge le istruzioni del tipo e, se chiesto, la riga di conferma.
 */
export function messaggioPromemoria({ extra, predefinito = '', nome = '', data = '', ora = '', tipo = '', studio = '' }) {
  const e = normalizzaExtra(extra);
  const v = { nome: String(nome), data: String(data), ora: String(ora), tipo: String(tipo), studio: String(studio) };
  const parti = [e.testo ? sostituisci(e.testo, v) : String(predefinito)];
  if (e.istruzioni) parti.push(sostituisci(e.istruzioni, v));
  if (e.conferma && !parti.join('\n').includes(CONFERMA_TESTO)) parti.push(CONFERMA_TESTO);
  return parti.filter(Boolean).join('\n\n');
}
