// PR #337 §8 — Centro notifiche stile Windows 11 e UNICA fonte dei pallini rossi (dock, Start, cartelle di
// Esplora): scadenze, pratiche aperte, documenti nuovi. Quando un'azione cambia qualcosa (Segna come fatto,
// Posticipa) si ricarica qui e tutti i pallini si aggiornano insieme. Mai i documenti dei pazienti.
// «Posticipa» non cambia la scadenza: nasconde la notifica fino al giorno scelto (su questo dispositivo).
import { documentiDaGestire, CLINICO } from './esplora.js';
import { scadenzaDaGestire, oggiRoma, limiteAvviso } from './revisioneArchivio.js';

const esito = ({ data, error }) => { if (error) throw new Error(error.message); return data; };
export const GRUPPI_NOTIFICHE = [['scadenze', 'Scadenze'], ['pratiche', 'Pratiche aperte'], ['nuovi', 'Documenti nuovi']];
const DOC = 'id, titolo, fascicolo, tipo_documento, riassunto, email_oggetto, tag, analisi_contenuto, ente, mime_type, nome_file_originale, drive_file_id, creato_il';

/* ---------- archivio in memoria con ascoltatori ---------- */
let stato = { pronto: false, scadenze: [], azioni: [], pratiche: [], nuovi: [], caricato: 0 };
const ascoltatori = new Set();
export const statoCentro = () => stato;
export function ascoltaCentro(f) { ascoltatori.add(f); return () => ascoltatori.delete(f); }
const avvisa = () => ascoltatori.forEach((f) => f());
export function impostaCentro(nuovo) { stato = { ...stato, ...nuovo, pronto: true, caricato: Date.now() }; avvisa(); }

let inCorso = null;
export function aggiornaCentro(db, { adesso = Date.now() } = {}) {
  if (inCorso) return inCorso;
  const settimana = new Date(adesso - 7 * 86400000).toISOString();
  inCorso = Promise.all([
    db.from('scadenze').select(`id, data, descrizione, importo, completata, storica, documento_id, pratica_id, documento:documenti(${DOC})`)
      .eq('completata', false).eq('storica', false).limit(5000).then(esito),
    db.from('documenti').select('id, fascicolo, azione_richiesta').eq('azione_richiesta', true).neq('fascicolo', CLINICO).limit(5000).then(esito),
    db.from('v_pratiche').select('id, titolo, fascicolo, stato, urgenza, n_documenti, prossima_scadenza, ultima_attivita').in('stato', ['aperta', 'in_corso']).neq('fascicolo', CLINICO)
      .order('prossima_scadenza', { ascending: true, nullsFirst: false }).limit(60).then(esito).catch(() => []),
    db.from('documenti').select(DOC).gte('creato_il', settimana).neq('fascicolo', CLINICO).order('creato_il', { ascending: false }).limit(30).then(esito).catch(() => []),
  ]).then(([scadenze, azioni, pratiche, nuovi]) => {
    impostaCentro({ scadenze: (scadenze || []).filter((s) => s.documento?.fascicolo !== CLINICO), azioni: azioni || [], pratiche: pratiche || [], nuovi: (nuovi || []).filter((d) => !(d.tag || []).includes('cestino')) });
    return stato;
  }).finally(() => { inCorso = null; });
  return inCorso;
}

/* ---------- posticipate e viste (per dispositivo, localStorage dentro try/catch) ---------- */
const CHIAVE_POST = 'poliedron-notifiche-posticipate';
const CHIAVE_VISTE = 'poliedron-notifiche-viste';
const leggi = (k, s) => { try { const v = JSON.parse(s?.getItem(k) || 'null'); return v && typeof v === 'object' ? v : null; } catch { return null; } };
const scrivi = (k, v, s) => { try { s?.setItem(k, JSON.stringify(v)); } catch { /* facoltativo */ } return v; };
export const leggiPosticipate = (s = globalThis.localStorage) => leggi(CHIAVE_POST, s) || {};
export function posticipa(chiave, giorni, s = globalThis.localStorage, oggi = oggiRoma()) {
  const fino = new Date(Date.parse(`${oggi}T12:00:00Z`) + giorni * 86400000).toISOString().slice(0, 10);
  const v = scrivi(CHIAVE_POST, { ...leggiPosticipate(s), [chiave]: fino }, s);
  stato = { ...stato }; avvisa(); // i pallini si aggiornano subito
  return v;
}
export const posticipata = (post, chiave, oggi = oggiRoma()) => !!post?.[chiave] && post[chiave] > oggi;
export const leggiViste = (s = globalThis.localStorage) => leggi(CHIAVE_VISTE, s);
export const salvaViste = (chiavi, s = globalThis.localStorage) => scrivi(CHIAVE_VISTE, { chiavi: [...chiavi].slice(-500) }, s);
// Notifiche nuove rispetto all'ultima volta (la prima volta nessuna: niente valanga di avvisi).
export function nuoveDaAvvisare(notifiche, viste) {
  if (!viste) return [];
  const prima = new Set(viste.chiavi || []);
  return notifiche.filter((n) => !prima.has(n.chiave));
}

/* ---------- notifiche ---------- */
const fmtData = (iso) => new Date(`${iso}T12:00:00Z`).toLocaleDateString('it-IT', { day: 'numeric', month: 'short', timeZone: 'UTC' });
const euro = (n) => (n == null ? '' : Number(n).toLocaleString('it-IT', { style: 'currency', currency: 'EUR' }));

// [{ chiave, gruppo, titolo, testo, data, documento_id?, scadenza_id?, pratica_id?, urgente }]
export function notificheDa(st = stato, { posticipate = {}, oggi = oggiRoma() } = {}) {
  const entro = limiteAvviso(oggi);
  const fuori = [];
  for (const s of [...st.scadenze].sort((a, b) => String(a.data).localeCompare(String(b.data)))) {
    if (!scadenzaDaGestire(s, oggi, entro)) continue;
    const chiave = `scadenza:${s.id}`;
    if (posticipata(posticipate, chiave, oggi)) continue;
    const scaduta = s.data < oggi;
    fuori.push({ chiave, gruppo: 'scadenze', titolo: s.descrizione || s.documento?.titolo || 'Scadenza', testo: [scaduta ? `Scaduta il ${fmtData(s.data)}` : s.data === oggi ? 'Scade oggi' : `Scade il ${fmtData(s.data)}`, euro(s.importo), s.documento?.titolo && s.descrizione ? s.documento.titolo : null].filter(Boolean).join(' · '), data: s.data, documento_id: s.documento_id, scadenza_id: s.id, urgente: s.data <= oggi });
  }
  for (const p of st.pratiche) {
    if (!(p.urgenza === 'alta' || (p.prossima_scadenza && p.prossima_scadenza <= entro))) continue;
    const chiave = `pratica:${p.id}`;
    if (posticipata(posticipate, chiave, oggi)) continue;
    fuori.push({ chiave, gruppo: 'pratiche', titolo: `Pratica ${p.titolo}`, testo: [p.stato === 'in_corso' ? 'In corso' : 'Aperta', p.prossima_scadenza ? `prossima scadenza ${fmtData(p.prossima_scadenza)}` : null, p.n_documenti ? `${p.n_documenti} documenti` : null].filter(Boolean).join(' · '), data: p.prossima_scadenza || null, pratica_id: p.id, pratica: p, urgente: p.urgenza === 'alta' });
  }
  for (const d of st.nuovi) {
    const chiave = `nuovo:${d.id}`;
    if (posticipata(posticipate, chiave, oggi)) continue;
    fuori.push({ chiave, gruppo: 'nuovi', titolo: d.titolo || d.nome_file_originale || 'Documento', testo: [d.ente, `arrivato il ${fmtData(String(d.creato_il).slice(0, 10))}`].filter(Boolean).join(' · '), data: String(d.creato_il).slice(0, 10), documento_id: d.id, urgente: false });
  }
  return fuori;
}
export const raggruppaNotifiche = (lista) => GRUPPI_NOTIFICHE.map(([id, nome]) => ({ id, nome, voci: lista.filter((n) => n.gruppo === id) })).filter((g) => g.voci.length);

// Pallini: Esplora = documenti da gestire (stessa regola di prima), dock = scadenze da gestire, campanella = tutte.
export const daGestireDa = (st = stato, oggi = oggiRoma()) => documentiDaGestire({ scadenze: st.scadenze, azioni: st.azioni, oggi });
export function conteggiCentro(st = stato, { posticipate = {}, oggi = oggiRoma() } = {}) {
  const n = notificheDa(st, { posticipate, oggi });
  return { notifiche: n.length, scadenze: n.filter((x) => x.gruppo === 'scadenze').length, esplora: daGestireDa(st, oggi).size };
}

/* ---------- calendario del mese ---------- */
// Settimane (lunedì → domenica) del mese: [[{ giorno: 'YYYY-MM-DD', numero, fuori }]].
export function calendarioMese(anno, mese) {
  const primo = new Date(Date.UTC(anno, mese, 1));
  const inizio = new Date(primo.getTime() - ((primo.getUTCDay() + 6) % 7) * 86400000);
  const settimane = [];
  for (let w = 0; w < 6; w += 1) {
    const sett = [];
    for (let g = 0; g < 7; g += 1) {
      const d = new Date(inizio.getTime() + (w * 7 + g) * 86400000);
      sett.push({ giorno: d.toISOString().slice(0, 10), numero: d.getUTCDate(), fuori: d.getUTCMonth() !== mese });
    }
    if (w >= 4 && sett.every((x) => x.fuori)) break;
    settimane.push(sett);
  }
  return settimane;
}
export const giorniConScadenze = (scadenze = []) => {
  const m = new Map();
  for (const s of scadenze) if (s?.data && !s.completata && !s.storica) m.set(s.data, (m.get(s.data) || 0) + 1);
  return m;
};
export const nomeMese = (anno, mese) => new Date(Date.UTC(anno, mese, 1)).toLocaleDateString('it-IT', { month: 'long', year: 'numeric', timeZone: 'UTC' });
