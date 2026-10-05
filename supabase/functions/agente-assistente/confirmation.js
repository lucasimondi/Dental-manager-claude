// Server-authored proposals. Never execute tool blocks supplied by the browser.
const encoder = new TextEncoder();
const encode = (bytes) => btoa(String.fromCharCode(...bytes));
const decode = (text) => Uint8Array.from(atob(text), (c) => c.charCodeAt(0));
async function key(secret) {
  if (!secret) throw new Error('Conferme non configurate');
  return crypto.subtle.importKey('raw', encoder.encode(`poliedron-confirm-v1:${secret}`), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
}
export async function signProposal(proposal, secret) {
  const body = encode(encoder.encode(JSON.stringify(proposal)));
  const signature = await crypto.subtle.sign('HMAC', await key(secret), encoder.encode(body));
  return `${body}.${encode(new Uint8Array(signature))}`;
}
export async function verifyProposal(token, secret, { userId, studioId, allowedNames, now = Date.now() }) {
  if (typeof token !== 'string' || token.length > 32000) throw new Error('Conferma non valida');
  const parts = token.split('.');
  if (parts.length !== 2 || !await crypto.subtle.verify('HMAC', await key(secret), decode(parts[1]), encoder.encode(parts[0]))) throw new Error('Conferma non valida');
  const proposal = JSON.parse(new TextDecoder().decode(decode(parts[0])));
  if (proposal.userId !== userId || proposal.studioId !== studioId || !Number.isFinite(proposal.expiresAt) || proposal.expiresAt <= now) throw new Error('Conferma scaduta o sessione cambiata. Ripeti la richiesta.');
  if (!allowedNames.has(proposal.name)) throw new Error('Azione non consentita dal piano o dai permessi attuali');
  return proposal;
}
export const studioToday = (now = new Date()) => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Rome' }).format(now);

export async function claimProposal(client, proposal) {
  // Unique constraint arbitrates across Edge isolates and simultaneous tabs.
  // Claim BEFORE the write. A lost response is uncertain, never auto-replayed.
  const { error } = await client.from('poliedron_action_claims').insert({
    id: proposal.id, studio_id: proposal.studioId, user_id: proposal.userId,
  });
  if (error?.code === '23505') throw new Error('Questa conferma è già stata usata. Controlla l’agenda prima di riprovare.');
  if (error) throw new Error('Impossibile acquisire la conferma. Nessuna nuova operazione avviata.');
}
