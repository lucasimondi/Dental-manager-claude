import { prepareImpianti, STRUMENTO_IMPIANTI } from './impianti.js';
import { preparePiani, PIANI_TOOLS } from './piani.js';
import { preparePagamenti, PAGAMENTI_TOOLS } from './pagamenti.js';
import { prepareAgenda } from './agenda.js';
import { signProposal, verifyProposal, studioToday } from './confirmation.js';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const schema = properties => ({ type: 'object', properties, additionalProperties: false });
const patientSchema = { ...schema({ paziente_id: { type: 'integer' } }), required: ['paziente_id'] };
const DRAFTS = { prepara_impianti: ['registra_impianti_paziente','impianti'], prepara_preventivo: ['crea_piano_cura','piani'], prepara_incasso: ['registra_pagamento_paziente','pagamenti'], prepara_appuntamento: ['crea_appuntamento','agenda'] };
export function verifiedTokenClaims(header) {
  // Call ONLY after auth.getUser verified this exact bearer token.
  try { const part = header.replace(/^Bearer\s+/i,'').split('.')[1]; return JSON.parse(atob(part.replace(/-/g,'+').replace(/_/g,'/'))); } catch { return {}; }
}
async function clinical(client, studioId) {
  const { data, error } = await client.rpc('has_studio_capability_v1', { p_studio_id: studioId, p_capability: 'clinical.general' });
  if (error || data !== true) throw new Error('Questo connettore richiede accesso clinico generale.');
}
export async function authorizeConnector(client, claims, studioId) {
  if (!UUID.test(claims.client_id || '')) throw new Error('Sessione del connettore non valida.');
  const { data, error } = await client.from('poliedra_connector_clients').select('client_id, provider, resource_uri, enabled').eq('client_id', claims.client_id).eq('enabled', true).single();
  const aud = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
  if (error || !data || !aud.includes(data.resource_uri) || !aud.includes('authenticated') || claims.app_metadata?.studio_id !== studioId) throw new Error('Connettore non autorizzato o studio cambiato.');
  await clinical(client, studioId);
  return data;
}
export function connectorTools(allowedNames, tools) {
  const output = [];
  for (const name of ['cerca_pazienti','appuntamenti','disponibilita_agenda','catalogo_prestazioni']) {
    const source = tools.find(t => t.name === name);
    if (source && allowedNames.has(name)) output.push({ name, description: source.description, inputSchema: source.input_schema, annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false } });
  }
  if (allowedNames.has('scheda_paziente')) {
    for (const [name, description] of [['ultimi_appuntamenti_paziente','Ultimi dieci appuntamenti passati del paziente. Una data di agenda non prova la data di chirurgia: chiedi conferma.'],['impianti_paziente','Impianti registrati del paziente.'],['piani_paziente','Piani/preventivi reali del paziente.']]) output.push({ name, description, inputSchema: patientSchema, annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false } });
  }
  for (const [name, [action]] of Object.entries(DRAFTS)) {
    const source = [...tools, STRUMENTO_IMPIANTI, ...PIANI_TOOLS, ...PAGAMENTI_TOOLS].find(t => t.name === action);
    if (source && allowedNames.has(action)) output.push({ name, description: `Prepara un riepilogo da dati espliciti dell’utente/foto leggibile; non registra ancora. Restituisce link alla singola conferma del medico in Poliedra. Chiedi i dati mancanti; non inventare paziente, prezzo, dente o data. ${action === 'registra_impianti_paziente' ? STRUMENTO_IMPIANTI.description : ''}`, inputSchema: action === 'registra_pagamento_paziente' ? { ...source.input_schema, required: [...source.input_schema.required, 'data', 'metodo', 'stato'] } : source.input_schema, annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false } });
  }
  output.push({ name: 'stato_richiesta', description: 'Esito della richiesta. Solo done con risultato verificato significa registrato. Non ripetere automaticamente dopo esito incerto.', inputSchema: { ...schema({ richiesta_id: { type: 'string', format: 'uuid' } }), required: ['richiesta_id'] }, annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false } });
  return output.map(t => ({ ...t, securitySchemes: [{ type: 'oauth2', scopes: ['openid'] }], _meta: { securitySchemes: [{ type: 'oauth2', scopes: ['openid'] }] } }));
}
async function prepareDomain(client, name, domain, args, studioId) {
  const observed = { patients: new Set([args.paziente_id]), appointments: new Set() };
  return domain === 'impianti' ? prepareImpianti(client, args, studioId, observed)
    : domain === 'piani' ? preparePiani(client, name, args, studioId, observed)
    : domain === 'pagamenti' ? preparePagamenti(client, name, args, studioId, observed)
    : prepareAgenda(client, name, args, studioId, observed);
}
export async function runConnector({ request, client, claims, studioId, userId, allowedNames, tools, secret, read, verifyGrant }) {
  const approved = await authorizeConnector(client, claims, studioId);
  if (!await verifyGrant(claims.client_id)) throw new Error('Collegamento revocato.');
  const catalog = connectorTools(allowedNames, tools);
  if (request.operation === 'tools') return { tools: catalog };
  if (request.operation !== 'call' || !catalog.some(t => t.name === request.name)) throw new Error('Strumento non consentito.');
  const args = request.arguments;
  if (!args || Array.isArray(args) || typeof args !== 'object' || JSON.stringify(args).length > 60000) throw new Error('Argomenti non validi.');
  if (request.name === 'stato_richiesta') {
    if (!UUID.test(args.richiesta_id || '')) throw new Error('Richiesta non valida.');
    const { data, error } = await client.from('poliedra_connector_requests').select('id, status, result, expires_at').eq('id', args.richiesta_id).eq('studio_id', studioId).eq('user_id', userId).eq('client_id', claims.client_id).single();
    if (error || !data) throw new Error('Richiesta non disponibile.');
    return { id: data.id, result: data.result, expires_at: data.expires_at, status: data.status === 'pending' && Date.parse(data.expires_at) <= Date.now() ? 'expired' : data.status };
  }
  const draft = DRAFTS[request.name];
  const patientRead = ['ultimi_appuntamenti_paziente','impianti_paziente','piani_paziente'].includes(request.name);
  if (!draft && !patientRead) {
    if (request.name === 'cerca_pazienti' && (typeof args.query !== 'string' || args.query.trim().length < 2 || args.query.length > 80)) throw new Error('Indica almeno due caratteri del nome.');
    return read(request.name, args);
  }
  if (!Number.isSafeInteger(args.paziente_id) || args.paziente_id <= 0) throw new Error('Scegli il paziente trovato nel gestionale.');
  const { data: patient, error } = await client.from('patients').select('id, nome, cognome').eq('studio_id', studioId).eq('id', args.paziente_id).single();
  if (error || !patient) throw new Error('Paziente non disponibile nello studio.');
  if (patientRead) {
    if (request.name === 'piani_paziente') return read('storico_paziente', args);
    const implants = request.name === 'impianti_paziente';
    let query = client.from(implants ? 'implants' : 'appointments').select(implants ? 'id, dente, data_inserimento, marca, modello, lotto, diametro, lunghezza' : 'id, data, ora, durata, tipo, stato').eq('studio_id', studioId).eq('paziente_id', patient.id);
    if (!implants) query = query.lte('data', studioToday());
    const out = await query.order(implants ? 'data_inserimento' : 'data', { ascending: false }).limit(implants ? 100 : 10);
    if (out.error) throw new Error('Lettura non disponibile.');
    return { paziente: patient, risultati: out.data || [] };
  }
  const [name, domain] = draft;
  if (domain === 'pagamenti' && (!args.data || !args.metodo || !args.stato)) throw new Error('Indica data, metodo e se il pagamento è stato ricevuto.');
  if (domain === 'agenda' && args.forza_sovrapposizione) throw new Error('Scegli uno slot libero, nessuna sovrapposizione forzata dal connettore.');
  const prepared = await prepareDomain(client, name, domain, args, studioId);
  const id = crypto.randomUUID(), expiresAt = Date.now() + 10 * 60 * 1000;
  const proposal = { id, userId, studioId, name, [domain]: prepared, expiresAt, connectorClientId: claims.client_id, connectorInput: args };
  const token = await signProposal(proposal, secret);
  if (token.length > 32000 || prepared.summary.length > 16000) throw new Error('Troppi dati: dividi la richiesta.');
  const { error: saveError } = await client.from('poliedra_connector_requests').insert({ id, studio_id: studioId, user_id: userId, client_id: claims.client_id, proposal_token: token, summary: prepared.summary, expires_at: new Date(expiresAt).toISOString() });
  if (saveError) throw new Error('Riepilogo non confermato. Controlla Richieste assistenti prima di riprovare.');
  const review = new URL('/connector/review', approved.resource_uri); review.searchParams.set('id', id);
  return { richiesta_id: id, status: 'pending', summary: prepared.summary, review_url: review.href, expires_at: new Date(expiresAt).toISOString(), message: 'Dati preparati. Apri il link, controlla e premi Conferma. Nessun dato clinico ancora registrato.' };
}
export async function connectorReview(client, id, claims, userId, studioId, secret, allowedNames, verifyGrant, cancelled = false) {
  if (claims.client_id || !UUID.test(id || '')) throw new Error('Apri il riepilogo dal tuo accesso personale a Poliedra.');
  await clinical(client, studioId);
  const { data, error } = await client.from('poliedra_connector_requests').select('id, client_id, proposal_token, status, expires_at').eq('id', id).eq('studio_id', studioId).eq('user_id', userId).single();
  if (error || !data || data.status !== 'pending' || Date.parse(data.expires_at) <= Date.now()) throw new Error('Richiesta scaduta, già gestita o non disponibile.');
  const active = await client.from('poliedra_connector_clients').select('client_id').eq('client_id', data.client_id).eq('enabled', true).single();
  if (active.error || !active.data || !await verifyGrant(data.client_id)) throw new Error('Collegamento revocato.');
  const proposal = await verifyProposal(data.proposal_token, secret, { userId, studioId, allowedNames });
  if (proposal.id !== id || proposal.connectorClientId !== data.client_id) throw new Error('Riepilogo non valido.');
  const domain = Object.values(DRAFTS).find(([action]) => action === proposal.name)?.[1];
  if (!domain || !proposal.connectorInput) throw new Error('Riepilogo non valido.');
  if (cancelled) return data;
  const fresh = await prepareDomain(client, proposal.name, domain, proposal.connectorInput, studioId);
  if (JSON.stringify(fresh) !== JSON.stringify(proposal[domain])) throw new Error('I dati sono cambiati dopo il riepilogo: aggiorna la richiesta dalla chat prima di registrare.');
  return data;
}
