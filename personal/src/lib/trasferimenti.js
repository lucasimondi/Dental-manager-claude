// PR #337 §9 — coda delle operazioni lunghe (caricamenti, estrazione di uno ZIP, copia di molti file),
// mostrata nel pannello «Trasferimento file» con avanzamento e Annulla. Archivio in memoria con
// ascoltatori (useSyncExternalStore). Annulla ferma la coda al prossimo elemento: ciò che è già
// arrivato su Drive resta (niente si cancella).
let lista = [];
const ascoltatori = new Set();
const avvisa = () => { lista = [...lista]; ascoltatori.forEach((f) => f()); };
let n = 0;

export const trasferimenti = () => lista;
export function ascoltaTrasferimenti(f) { ascoltatori.add(f); return () => ascoltatori.delete(f); }

export function avviaTrasferimento({ nome, totale = 0 }) {
  n += 1;
  const id = `t${n}`;
  lista = [...lista, { id, nome, totale, fatti: 0, stato: 'in_corso', errori: [], annullato: false, inizio: Date.now() }];
  avvisa();
  return id;
}
const cambia = (id, f) => { lista = lista.map((t) => (t.id === id ? f(t) : t)); avvisa(); };
export const avanzaTrasferimento = (id, parte) => cambia(id, (t) => ({ ...t, ...parte }));
export const annullaTrasferimento = (id) => cambia(id, (t) => (t.stato === 'in_corso' ? { ...t, annullato: true } : t));
export const annullato = (id) => !!lista.find((t) => t.id === id)?.annullato;
export function chiudiTrasferimento(id, { errori = [] } = {}) {
  cambia(id, (t) => ({ ...t, errori, stato: t.annullato ? 'annullato' : errori.length ? (errori.length >= t.totale ? 'errore' : 'parziale') : 'fatto', fine: Date.now() }));
}
export const togliTrasferimento = (id) => { lista = lista.filter((t) => t.id !== id); avvisa(); };
export const togliFiniti = () => { lista = lista.filter((t) => t.stato === 'in_corso'); avvisa(); };

// Esegue `fai(elemento, i)` per ogni elemento, uno alla volta, con avanzamento e Annulla.
// Restituisce { fatti: [risultati], errori: ['nome: messaggio'] }.
export async function eseguiInCoda(nome, elementi, fai, { nomeDi = (x) => x?.name || String(x) } = {}) {
  const id = avviaTrasferimento({ nome, totale: elementi.length });
  const fatti = []; const errori = [];
  for (let i = 0; i < elementi.length; i += 1) {
    if (annullato(id)) break;
    avanzaTrasferimento(id, { corrente: nomeDi(elementi[i]) });
    try { fatti.push(await fai(elementi[i], i)); } catch (e) { errori.push(`${nomeDi(elementi[i])}: ${e?.message || e}`); }
    avanzaTrasferimento(id, { fatti: i + 1 });
  }
  chiudiTrasferimento(id, { errori });
  return { id, fatti, errori, annullato: annullato(id) };
}

// Testo dell'avanzamento: «3 di 10 · 30%».
export function testoAvanzamento(t) {
  if (!t) return '';
  const p = t.totale ? Math.round((t.fatti / t.totale) * 100) : 0;
  if (t.stato === 'fatto') return `Completato · ${t.totale} ${t.totale === 1 ? 'elemento' : 'elementi'}`;
  if (t.stato === 'annullato') return `Annullato · ${t.fatti} di ${t.totale}`;
  if (t.stato === 'errore') return `Non riuscito · ${t.errori.length} ${t.errori.length === 1 ? 'errore' : 'errori'}`;
  if (t.stato === 'parziale') return `Completato con ${t.errori.length} ${t.errori.length === 1 ? 'errore' : 'errori'}`;
  return `${t.fatti} di ${t.totale} · ${p}%`;
}
