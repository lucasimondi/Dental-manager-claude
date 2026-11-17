// COMPILA-CAMPI (PO 2026-11-17): "Il gestore PDF deve anche poter completare i campi, in modo automatico
// dove si può e se servono dati io li compilo e poi vengono trasferiti nel campo giusto".
// Dal nome del campo del modulo (o dalla sua descrizione) si capisce che dato chiede; i valori vengono
// dai dati ricordati sul telefono, dalla carta d'identità in archivio e dalla data di oggi. Funzioni pure.

// Dati che un modulo chiede più spesso, con le parole che li riconoscono (sul nome già normalizzato).
// L'ordine conta: prima i più specifici (es. «data di nascita» prima di «data»).
export const DATI = [
  { k: 'codice_fiscale', nome: 'Codice fiscale', re: /codice ?fiscale|cod ?fisc|\bc ?f\b|\bcf\b|fiscal ?code|tax ?code/ },
  { k: 'data_nascita', nome: 'Data di nascita', re: /data (di )?nascita|nat[oa] il|data nasc|birth ?date|date of birth/ },
  { k: 'luogo_nascita', nome: 'Luogo di nascita', re: /luogo (di )?nascita|comune (di )?nascita|nat[oa] a\b|nat[oa] in|place of birth|birth ?place/ },
  { k: 'nominativo', nome: 'Nome e cognome', re: /nome e cognome|cognome e nome|nominativo|sottoscritt[oa]|full ?name|\bnome completo/ },
  { k: 'cognome', nome: 'Cognome', re: /cognome|surname|last ?name|family ?name/ },
  { k: 'nome', nome: 'Nome', re: /^nome\b|\bnome$|first ?name|given ?name|^name$/ },
  { k: 'iban', nome: 'IBAN', re: /\biban\b/ },
  { k: 'pec', nome: 'PEC', re: /\bpec\b|posta certificata/ },
  { k: 'email', nome: 'Email', re: /e ?mail|posta elettronica/ },
  { k: 'telefono', nome: 'Telefono', re: /telefono|\btel\b|cellulare|\bcell\b|phone|mobile/ },
  { k: 'cap', nome: 'CAP', re: /\bcap\b|postal ?code|zip/ },
  { k: 'provincia', nome: 'Provincia', re: /provincia|\bprov\b/ },
  { k: 'indirizzo', nome: 'Indirizzo', re: /indirizzo|\bvia\b|residente in via|address|street/ },
  { k: 'comune', nome: 'Comune di residenza', re: /comune|citt[aà]|residente a|localit[aà]|\bcity\b|\btown\b/ },
  { k: 'luogo_data', nome: 'Luogo e data', re: /luogo e data|luogo data/ },
  { k: 'data', nome: 'Data', re: /^data\b|\bdata$|\bdate\b|^il$/ },
  { k: 'luogo', nome: 'Luogo', re: /^luogo$|^place$/ },
];
export const CHIAVI_PROFILO = ['nome', 'cognome', 'codice_fiscale', 'data_nascita', 'luogo_nascita', 'indirizzo', 'cap', 'comune', 'provincia', 'telefono', 'email', 'pec', 'iban'];
const NON_COMPILARE = /firma|signature|sigla/;

// "txtCodFiscale_1" → "txt cod fiscale" ; accenti tolti, minuscolo, cifre e simboli via.
export function normalizzaNome(s) {
  return String(s || '')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/\[\d+\]|\d+/g, ' ').replace(/[^a-z]+/g, ' ')
    .replace(/\b(txt|text|campo|field|fld|tx)\b/g, ' ').replace(/\s+/g, ' ').trim();
}

// Che dato chiede il campo? null se non si capisce o se è una firma.
export function chiaveCampo(...nomi) {
  for (const n of nomi) {
    const s = normalizzaNome(n);
    if (!s) continue;
    if (NON_COMPILARE.test(s)) return 'firma';
    const d = DATI.find((x) => x.re.test(s));
    if (d) return d.k;
  }
  return null;
}

export const oggiIt = (d = new Date()) => `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
const dataIt = (v) => { const m = String(v || '').match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? `${m[3]}/${m[2]}/${m[1]}` : String(v || ''); };

// Valore proposto per una chiave, dal profilo (dati ricordati + identità) e dalla data di oggi.
export function valorePer(k, profilo = {}, oggi = new Date()) {
  const p = profilo || {};
  if (k === 'nominativo') return [p.nome, p.cognome].filter(Boolean).join(' ');
  if (k === 'data') return oggiIt(oggi);
  if (k === 'luogo') return p.comune || '';
  if (k === 'luogo_data') return [p.comune, oggiIt(oggi)].filter(Boolean).join(', ');
  if (k === 'data_nascita') return dataIt(p.data_nascita);
  return p[k] ? String(p[k]) : '';
}

// Campi del modulo → righe del foglio: [{ id, etichetta, chiave, valore, automatico }]. Le firme e i campi
// non di testo restano fuori; i campi con lo stesso nome (ripetuti su più pagine) diventano una riga.
export function proposte(campi, profilo, oggi = new Date()) {
  const viste = new Map();
  for (const c of campi || []) {
    if (c.tipo !== 'testo' || c.solaLettura) continue;
    const chiave = chiaveCampo(c.descrizione, c.nome);
    if (chiave === 'firma') continue;
    const gruppo = c.nome || c.id;
    if (viste.has(gruppo)) { viste.get(gruppo).ids.push(c.id); continue; }
    const valore = c.valore ? String(c.valore) : valorePer(chiave, profilo, oggi);
    viste.set(gruppo, {
      id: c.id, ids: [c.id], chiave,
      etichetta: c.descrizione || DATI.find((d) => d.k === chiave)?.nome || leggibile(c.nome) || 'Campo',
      valore, automatico: Boolean(!c.valore && valore), giaCompilato: Boolean(c.valore),
    });
  }
  return [...viste.values()];
}
const leggibile = (s) => { const n = normalizzaNome(s); return n ? n[0].toUpperCase() + n.slice(1) : ''; };

// Dal carta d'identità in archivio (dati_estratti, chiavi varie) ai dati del profilo.
export function profiloDaIdentita(dati = {}) {
  const d = Object.fromEntries(Object.entries(dati || {}).map(([k, v]) => [normalizzaNome(k).replace(/ /g, '_'), v]));
  const primo = (...ks) => { for (const k of ks) if (d[k] && typeof d[k] !== 'object') return String(d[k]); return ''; };
  return Object.fromEntries(Object.entries({
    nome: primo('nome', 'first_name'), cognome: primo('cognome', 'last_name'),
    codice_fiscale: primo('codice_fiscale', 'cf'), data_nascita: primo('data_nascita', 'data_di_nascita'),
    luogo_nascita: primo('luogo_nascita', 'luogo_di_nascita', 'comune_nascita'),
    indirizzo: primo('indirizzo', 'residenza_indirizzo', 'via'), comune: primo('comune_residenza', 'residenza', 'comune'),
  }).filter(([, v]) => v));
}

// Valori scritti da Luca → dati da ricordare (solo le chiavi del profilo, niente date di oggi).
export function daRicordare(righe) {
  const fuori = {};
  for (const r of righe) if (CHIAVI_PROFILO.includes(r.chiave) && String(r.valore || '').trim()) fuori[r.chiave] = String(r.valore).trim();
  const nominativo = righe.find((r) => r.chiave === 'nominativo' && r.valore)?.valore;
  if (nominativo && !fuori.nome && !fuori.cognome) {
    const parti = String(nominativo).trim().split(/\s+/);
    if (parti.length >= 2) { fuori.cognome = parti.pop(); fuori.nome = parti.join(' '); }
  }
  return fuori;
}
