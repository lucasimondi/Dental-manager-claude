// PRATICHE-CONSULENTI (PO 2026-11-19): chi segue la pratica, con i contatti, e le email della pratica.
// I consulenti non si cancellano: «Togli» mette tolto_il. Le email vengono dall'archivio (RPC email_pratica):
// conversazioni dei documenti della pratica e quelle con un consulente come mittente, mai i pazienti.
const esito = ({ data, error }) => { if (error) throw new Error(error.message); return data; };

export const RUOLI_CONSULENTE = ['Avvocato', 'Commercialista', 'Consulente del lavoro', 'Notaio', 'Perito / CTP', 'Geometra', 'Ingegnere / Architetto', 'Agente assicurativo', 'Banca', 'Altro'];
const CAMPI = 'id, pratica_id, nome, ruolo, studio, email, pec, telefono, note, creato_il';
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function campiConsulente(c) {
  const t = (x, n) => String(x ?? '').trim().replace(/\s+/g, ' ').slice(0, n);
  const nome = t(c.nome, 120);
  if (!nome) throw new Error('Inserisci il nome');
  const email = t(c.email, 200).toLowerCase(), pec = t(c.pec, 200).toLowerCase();
  if (email && !EMAIL.test(email)) throw new Error('Email non valida');
  if (pec && !EMAIL.test(pec)) throw new Error('PEC non valida');
  const telefono = t(c.telefono, 40);
  if (telefono && telefono.replace(/\D/g, '').length < 6) throw new Error('Telefono non valido');
  return { nome, ruolo: t(c.ruolo, 60) || null, studio: t(c.studio, 160) || null, email: email || null, pec: pec || null, telefono: telefono || null, note: String(c.note ?? '').trim().slice(0, 2000) || null };
}

export async function caricaConsulenti(db, praticaId) {
  return esito(await db.from('pratiche_consulenti').select(CAMPI).eq('pratica_id', praticaId).is('tolto_il', null).order('creato_il'));
}
export async function salvaConsulente(db, praticaId, c) {
  const riga = campiConsulente(c);
  const q = c.id
    ? db.from('pratiche_consulenti').update(riga).eq('id', c.id)
    : db.from('pratiche_consulenti').insert({ ...riga, pratica_id: praticaId });
  return esito(await q.select(CAMPI).single());
}
export async function togliConsulente(db, id) {
  return esito(await db.from('pratiche_consulenti').update({ tolto_il: new Date().toISOString() }).eq('id', id).select('id').single());
}
export async function emailPratica(db, praticaId) {
  return esito(await db.rpc('email_pratica', { p_pratica: praticaId })) || [];
}

// Persone della scheda che sembrano consulenti e non sono ancora nell'elenco (per aggiungerle con un tocco).
const RUOLO_CONSULENTE = /avvocat|legale|difensor|commercialist|consulent|notai|perit|ctp|ctu|geometr|ingegner|architett|agente|assicurat/i;
export function consulentiSuggeriti(parti, consulenti) {
  const presenti = new Set((consulenti || []).map((c) => norm(c.nome)));
  const visti = new Set();
  return (Array.isArray(parti) ? parti : [])
    .filter((x) => x && x.nome && RUOLO_CONSULENTE.test(String(x.ruolo || '')))
    .filter((x) => { const k = norm(x.nome); if (presenti.has(k) || visti.has(k)) return false; visti.add(k); return true; })
    .map((x) => ({ nome: String(x.nome).trim(), ruolo: ruoloDa(x.ruolo) }));
}
const norm = (s) => String(s || '').toLowerCase().replace(/^(avv|dott|dr|geom|ing|arch|rag|not)\.?\s+/, '').replace(/[^a-zà-ù0-9]+/g, ' ').trim();
function ruoloDa(r) {
  const s = String(r || '');
  if (/avvocat|legale|difensor/i.test(s)) return 'Avvocato';
  if (/commercialist/i.test(s)) return 'Commercialista';
  if (/notai/i.test(s)) return 'Notaio';
  if (/perit|ctp|ctu/i.test(s)) return 'Perito / CTP';
  if (/geometr/i.test(s)) return 'Geometra';
  return s.trim().slice(0, 60) || null;
}

// Collegamenti dei contatti (non parte nulla: si aprono telefono, WhatsApp o una email nuova).
export const linkTelefono = (tel) => `tel:${String(tel).replace(/[^\d+]/g, '')}`;
export function linkWhatsAppA(tel) {
  let n = String(tel).replace(/\D/g, '');
  if (n.startsWith('00')) n = n.slice(2);
  else if (!String(tel).trim().startsWith('+') && n.length <= 10) n = `39${n}`;
  return `https://wa.me/${n}`;
}
export const linkScrivi = (indirizzo, oggetto = '') => `mailto:${encodeURIComponent(indirizzo)}${oggetto ? `?subject=${encodeURIComponent(oggetto)}` : ''}`;
export const linkConversazione = (threadId) => `https://mail.google.com/mail/u/0/#all/${encodeURIComponent(threadId)}`;
// Tutte le email scambiate con i consulenti, cercate direttamente in Gmail (anche quelle non in archivio).
export function linkGmailConsulenti(consulenti) {
  const ind = [...new Set((consulenti || []).flatMap((c) => [c.email, c.pec]).filter(Boolean))];
  if (!ind.length) return null;
  const q = ind.map((a) => `from:${a} OR to:${a}`).join(' OR ');
  return `https://mail.google.com/mail/u/0/#search/${encodeURIComponent(q)}`;
}
export const nomeMittente = (m) => String(m || '').replace(/<[^>]*>/g, '').replace(/"/g, '').trim() || String(m || '');
