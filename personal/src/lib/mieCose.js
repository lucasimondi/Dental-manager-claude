// APP-AUTO-CASA-SALUTE (PO 2026-11-25): tre app di Personal, anche installabili a parte sulla Home del telefono:
// «Auto e motori» (veicoli con foto, assicurazione, bollo, revisione, tagliandi), «Casa» (immobili con utenze,
// catasto, assicurazione, manutenzioni) e «Salute» (persone con medico, tessera, allergie, controlli periodici).
// Una scheda per cosa (un'auto, una casa, una persona) nella tabella `mie_cose`; i campi sono un elenco libero
// (si aggiungono senza cambiare il database), le date con «avviso» diventano scadenze. Qui solo dati e testo,
// senza React: l'app e i test usano le stesse funzioni.
const esito = ({ data, error }) => { if (error) throw new Error(error.message); return data; };
const pulito = (s) => String(s ?? '').replace(/\s+/g, ' ').trim();

export const COLORI = ['blu', 'ambra', 'verde', 'viola', 'cielo', 'rosa'];
export const TIPI_CAMPO = [['testo', 'Testo'], ['data', 'Data'], ['numero', 'Numero']];
export const CAMPI_CONTATTO = [['ruolo', 'Ruolo'], ['nome', 'Nome'], ['telefono', 'Telefono'], ['email', 'Email'], ['indirizzo', 'Indirizzo'], ['note', 'Note']];

// t = testo (predefinito), d = data, da = data con avviso (scadenza), n = numero
const C = (gruppo, etichetta, t = '') => ({ gruppo, etichetta, tipo: t.startsWith('d') ? 'data' : t === 'n' ? 'numero' : 'testo', avviso: t === 'da' });

const VEICOLO = [
  C('veicolo', 'Marca e modello'), C('veicolo', 'Targa'), C('veicolo', 'Telaio (VIN)'), C('veicolo', 'Immatricolazione', 'd'), C('veicolo', 'Alimentazione'), C('veicolo', 'Km attuali', 'n'),
  C('assicurazione', 'Compagnia'), C('assicurazione', 'Numero polizza'), C('assicurazione', 'Agenzia / agente'), C('assicurazione', 'Scadenza assicurazione', 'da'),
  C('scadenze', 'Scadenza bollo', 'da'), C('scadenze', 'Prossima revisione', 'da'),
  C('manutenzione', 'Ultimo tagliando', 'd'), C('manutenzione', 'Km ultimo tagliando', 'n'), C('manutenzione', 'Prossimo tagliando', 'da'), C('manutenzione', 'Prossimo tagliando a km', 'n'),
  C('manutenzione', 'Gomme montate'), C('manutenzione', 'Cambio gomme', 'da'),
];

export const AMBITI = {
  auto: {
    id: 'auto', nome: 'Auto e motori', breve: 'Auto', colore: '#C46A1B', cosa: 'veicolo',
    sotto: 'Foto, assicurazione, bollo, revisione, tagliandi',
    gruppi: [['veicolo', 'Veicolo'], ['assicurazione', 'Assicurazione'], ['scadenze', 'Bollo e revisione'], ['manutenzione', 'Tagliandi e gomme'], ['altro', 'Altro']],
    tipi: [['auto', 'Auto'], ['moto', 'Moto'], ['barca', 'Barca'], ['altro', 'Altro']],
    base: {
      auto: VEICOLO,
      moto: VEICOLO,
      barca: [C('veicolo', 'Modello'), C('veicolo', 'Nome'), C('veicolo', 'Sigla iscrizione'), C('veicolo', 'Motori'), C('veicolo', 'Ore motore', 'n'), C('veicolo', 'Posto barca'),
        C('assicurazione', 'Compagnia'), C('assicurazione', 'Numero polizza'), C('assicurazione', 'Scadenza assicurazione', 'da'),
        C('scadenze', 'Certificato di sicurezza', 'da'), C('manutenzione', 'Ultimo tagliando motori', 'd'), C('manutenzione', 'Prossimo tagliando', 'da')],
      altro: [C('veicolo', 'Descrizione'), C('veicolo', 'Targa / matricola'), C('assicurazione', 'Scadenza assicurazione', 'da')],
    },
    registro: { titolo: 'Tagliandi e interventi', voci: ['Tagliando', 'Cambio gomme', 'Revisione', 'Riparazione', 'Carrozzeria', 'Bollo', 'Assicurazione', 'Altro'], km: true, aggiungi: 'tagliando o intervento' },
    contatti: { titolo: 'Officina e contatti', ruoli: ['Meccanico', 'Gommista', 'Carrozziere', 'Assicurazione', 'Concessionario', 'Soccorso stradale'] },
    nuovo: 'Nuovo veicolo',
  },
  casa: {
    id: 'casa', nome: 'Casa', breve: 'Casa', colore: '#2B6FD6', cosa: 'immobile',
    sotto: 'Utenze, catasto, assicurazione, manutenzioni',
    gruppi: [['immobile', 'Immobile'], ['catasto', 'Catasto'], ['utenze', 'Utenze'], ['assicurazione', 'Assicurazione'], ['manutenzione', 'Manutenzioni e scadenze'], ['altro', 'Altro']],
    tipi: [['casa', 'Casa'], ['ufficio', 'Studio / ufficio'], ['box', 'Box / cantina'], ['terreno', 'Terreno'], ['altro', 'Altro']],
    base: {
      casa: [C('immobile', 'Indirizzo'), C('immobile', 'Titolo (proprietà, affitto…)'), C('immobile', 'Intestatario'),
        C('catasto', 'Foglio'), C('catasto', 'Particella'), C('catasto', 'Subalterno'), C('catasto', 'Categoria'), C('catasto', 'Rendita'),
        C('utenze', 'Luce: fornitore'), C('utenze', 'POD'), C('utenze', 'Gas: fornitore'), C('utenze', 'PDR'), C('utenze', 'Acqua: gestore'), C('utenze', 'Codice utenza acqua'), C('utenze', 'Internet'),
        C('assicurazione', 'Compagnia'), C('assicurazione', 'Numero polizza'), C('assicurazione', 'Scadenza assicurazione', 'da'),
        C('manutenzione', 'Revisione caldaia', 'da'), C('manutenzione', 'Controllo fumi (bollino)', 'da'), C('manutenzione', 'Pulizia canna fumaria', 'da'), C('manutenzione', 'Pulizia condizionatori', 'da')],
      ufficio: null, box: null,
      terreno: [C('immobile', 'Località'), C('immobile', 'Intestatario'), C('catasto', 'Foglio'), C('catasto', 'Particella'), C('catasto', 'Qualità / classe'), C('catasto', 'Reddito dominicale')],
      altro: [C('immobile', 'Descrizione'), C('immobile', 'Indirizzo')],
    },
    registro: { titolo: 'Lavori e manutenzioni', voci: ['Caldaia', 'Idraulico', 'Elettricista', 'Condizionatori', 'Lavori', 'Pulizie', 'Altro'], km: false, aggiungi: 'lavoro' },
    contatti: { titolo: 'Contatti', ruoli: ['Amministratore', 'Idraulico', 'Elettricista', 'Caldaista', 'Tecnico', 'Proprietario', 'Inquilino'] },
    nuovo: 'Nuovo immobile',
  },
  salute: {
    id: 'salute', nome: 'Salute', breve: 'Salute', colore: '#B4235A', cosa: 'persona',
    sotto: 'Medico, tessera, allergie, controlli, esami',
    gruppi: [['persona', 'Dati'], ['medico', 'Medico e tessera'], ['clinica', 'Allergie e terapie'], ['controlli', 'Controlli periodici'], ['altro', 'Altro']],
    tipi: [['persona', 'Persona'], ['animale', 'Animale'], ['altro', 'Altro']],
    base: {
      persona: [C('persona', 'Nome e cognome'), C('persona', 'Data di nascita', 'd'), C('persona', 'Gruppo sanguigno'), C('persona', 'Codice fiscale'),
        C('medico', 'Medico di base'), C('medico', 'Telefono medico'), C('medico', 'Tessera sanitaria: scadenza', 'da'), C('medico', 'Esenzioni'),
        C('clinica', 'Allergie'), C('clinica', 'Patologie'), C('clinica', 'Farmaci abituali'),
        C('controlli', 'Analisi del sangue', 'da'), C('controlli', 'Controllo dentista', 'da'), C('controlli', 'Visita oculistica', 'da'), C('controlli', 'Prossimo vaccino', 'da')],
      animale: [C('persona', 'Nome'), C('persona', 'Specie e razza'), C('persona', 'Microchip'), C('medico', 'Veterinario'), C('controlli', 'Prossimo vaccino', 'da'), C('controlli', 'Antiparassitario', 'da')],
      altro: [C('persona', 'Descrizione')],
    },
    registro: { titolo: 'Visite ed esami', voci: ['Visita', 'Esame del sangue', 'Esame strumentale', 'Vaccino', 'Dentista', 'Ricovero', 'Altro'], km: false, aggiungi: 'visita o esame' },
    contatti: { titolo: 'Medici e specialisti', ruoli: ['Medico di base', 'Dentista', 'Specialista', 'Farmacia', 'Ospedale'] },
    nuovo: 'Nuova persona',
  },
};
AMBITI.casa.base.ufficio = AMBITI.casa.base.casa;
AMBITI.casa.base.box = AMBITI.casa.base.casa.filter((c) => !['utenze', 'manutenzione'].includes(c.gruppo));
export const ambito = (id) => AMBITI[id] || null;
export const ID_AMBITI = Object.keys(AMBITI);

export function nuovaCosa(idAmbito, tipo, nome = '', ordine = 0) {
  const a = ambito(idAmbito); if (!a) throw new Error('Ambito sconosciuto');
  const t = a.tipi.some(([x]) => x === tipo) ? tipo : a.tipi[0][0];
  const base = a.base[t] || a.base[a.tipi[0][0]];
  return {
    ambito: a.id, tipo: t, nome: pulito(nome) || (t === 'altro' ? 'Nuova scheda' : a.nuovo), descrizione: '', colore: COLORI[ordine % COLORI.length], ordine,
    campi: base.map((c) => ({ ...c, valore: '' })), registro: [], persone: [], foto: null, note: '',
  };
}

export const gruppiDi = (idAmbito) => ambito(idAmbito)?.gruppi || [['altro', 'Altro']];
export const campiDi = (s, gruppo) => {
  const validi = gruppiDi(s.ambito).map(([g]) => g);
  return (s.campi || []).map((c, i) => ({ ...c, i })).filter((c) => (validi.includes(c.gruppo) ? c.gruppo : 'altro') === gruppo);
};
export const daCompilare = (s) => (s.campi || []).filter((c) => !pulito(c.valore)).length;

/* ---------- date e scadenze ---------- */

const ISO = /^(\d{4})-(\d{2})-(\d{2})$/;
const IT = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/;
// Una data scritta a mano («12/03/2027») o dal selettore («2027-03-12») → «2027-03-12»; altrimenti null.
export function dataIso(v) {
  const s = pulito(v);
  let m = s.match(ISO); if (m) return s;
  m = s.match(IT); if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  return null;
}
const oggiIso = (oggi = new Date()) => new Date(oggi.getTime() - oggi.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
export const giorniTra = (da, a) => Math.round((Date.UTC(...a.split('-').map((x, i) => Number(x) - (i === 1 ? 1 : 0))) - Date.UTC(...da.split('-').map((x, i) => Number(x) - (i === 1 ? 1 : 0)))) / 86400000);
export const dataBreve = (iso) => { const [a, m, g] = String(iso).split('-'); return `${g}/${m}/${a}`; };
export const numero = (v) => { const n = Number(String(v ?? '').replace(/\./g, '').replace(',', '.').replace(/[^\d.-]/g, '')); return Number.isFinite(n) && String(v ?? '').trim() ? n : null; };

// 'scaduta' (passata), 'presto' (entro 30 giorni), 'ok'.
export const statoGiorni = (g) => (g < 0 ? 'scaduta' : g <= 30 ? 'presto' : 'ok');
export const quando = (g) => (g < -1 ? `scaduta da ${-g} giorni` : g === -1 ? 'scaduta ieri' : g === 0 ? 'oggi' : g === 1 ? 'domani' : g <= 60 ? `tra ${g} giorni` : `tra ${Math.round(g / 30)} mesi`);

// Le scadenze di una scheda: le date con avviso, più il tagliando a km se i km attuali ci sono quasi.
export function scadenzeDi(s, oggi = new Date()) {
  const o = oggiIso(oggi);
  const out = [];
  for (const c of s.campi || []) {
    if (!c.avviso) continue;
    const d = dataIso(c.valore); if (!d) continue;
    const g = giorniTra(o, d);
    out.push({ cosa: s.id, nome: s.nome, voce: pulito(c.etichetta), data: d, giorni: g, stato: statoGiorni(g) });
  }
  const val = (re) => numero((s.campi || []).find((c) => re.test(pulito(c.etichetta)))?.valore);
  const km = val(/^km attuali$/i), prossimi = val(/^prossimo tagliando a km$/i);
  if (km != null && prossimi != null && prossimi - km <= 1500) {
    const mancano = prossimi - km;
    out.push({ cosa: s.id, nome: s.nome, voce: 'Tagliando', km: true, data: null, giorni: mancano < 0 ? -1 : 0, stato: mancano < 0 ? 'scaduta' : 'presto',
      testo: mancano < 0 ? `superato di ${(-mancano).toLocaleString('it-IT')} km` : `tra ${mancano.toLocaleString('it-IT')} km` });
  }
  return out.sort((a, b) => a.giorni - b.giorni);
}
export const scadenzeTutte = (schede, oggi = new Date()) => schede.flatMap((s) => scadenzeDi(s, oggi)).sort((a, b) => a.giorni - b.giorni);
export const testoScadenza = (x) => x.testo || `${dataBreve(x.data)} · ${quando(x.giorni)}`;
export const daGuardare = (schede, oggi = new Date()) => scadenzeTutte(schede, oggi).filter((x) => x.stato !== 'ok').length;

/* ---------- registro (tagliandi, lavori, visite) ---------- */

export function ordinaRegistro(r = []) {
  return [...r].sort((a, b) => String(dataIso(b.data) || '').localeCompare(String(dataIso(a.data) || '')));
}
export function totaleRegistro(r = [], anno = null) {
  return r.filter((x) => !anno || String(dataIso(x.data) || '').startsWith(String(anno))).reduce((t, x) => t + (numero(x.importo) || 0), 0);
}
export const euro = (n) => n.toLocaleString('it-IT', { style: 'currency', currency: 'EUR' });

/* ---------- testo da copiare e ricerca ---------- */

export function testoCosa(s) {
  const parti = [pulito(s.nome)];
  for (const [g, titolo] of gruppiDi(s.ambito)) {
    const r = campiDi(s, g).filter((c) => pulito(c.valore));
    if (r.length) parti.push('', titolo.toUpperCase(), ...r.map((c) => `${pulito(c.etichetta)}: ${c.tipo === 'data' && dataIso(c.valore) ? dataBreve(dataIso(c.valore)) : pulito(c.valore)}`));
  }
  if (s.persone?.length) parti.push('', 'CONTATTI', ...s.persone.map(testoContatto));
  return parti.join('\n');
}
export const testoContatto = (p) => [p.ruolo && `${pulito(p.ruolo)}:`, pulito(p.nome), p.telefono && `tel. ${pulito(p.telefono)}`, p.email && pulito(p.email), p.indirizzo && `(${pulito(p.indirizzo)})`].filter(Boolean).join(' ');

const norm = (t) => String(t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
export function filtra(schede, q) {
  const t = norm(q).trim();
  if (!t) return schede;
  const testo = (s) => norm([s.nome, s.descrizione, s.note, ...(s.campi || []).flatMap((c) => [c.etichetta, c.valore]), ...(s.registro || []).flatMap((r) => [r.voce, r.note]), ...(s.persone || []).flatMap((p) => Object.values(p))].join(' '));
  return schede.filter((s) => t.split(/\s+/).every((p) => testo(s).includes(p)));
}

/* ---------- foto ---------- */

export const FOTO_MASSIMA = 600000; // caratteri del data URL (circa 450 KB): una foto per scheda, nel database
// Lato più lungo e qualità per stare sotto il limite: si prova a scendere finché ci sta.
export const PASSI_FOTO = [[1280, 0.8], [1280, 0.65], [1024, 0.6], [800, 0.55], [640, 0.5]];

/* ---------- salvataggio ---------- */

// Prima di salvare: niente spazi doppi, gruppi e tipi validi, righe vuote tolte.
export function campiCosa(s, idAmbito = s.ambito) {
  const a = ambito(idAmbito);
  const gruppi = gruppiDi(idAmbito).map(([g]) => g);
  const out = {};
  if ('ambito' in s) { if (!ambito(s.ambito)) throw new Error('Ambito sconosciuto'); out.ambito = s.ambito; }
  if ('nome' in s) { out.nome = pulito(s.nome); if (!out.nome) throw new Error('Scrivi il nome'); }
  if ('descrizione' in s) out.descrizione = pulito(s.descrizione) || null;
  if ('note' in s) out.note = String(s.note ?? '').trim() || null;
  if ('tipo' in s) out.tipo = a?.tipi.some(([t]) => t === s.tipo) ? s.tipo : 'altro';
  if ('colore' in s) out.colore = COLORI.includes(s.colore) ? s.colore : COLORI[0];
  if ('ordine' in s) out.ordine = Number(s.ordine) || 0;
  if ('foto' in s) {
    const f = s.foto || null;
    if (f && (!/^data:image\/(jpeg|png|webp);base64,/.test(f) || f.length > FOTO_MASSIMA)) throw new Error('Foto troppo grande o non valida');
    out.foto = f;
  }
  if ('campi' in s) {
    out.campi = (s.campi || []).map((c) => {
      const tipo = TIPI_CAMPO.some(([t]) => t === c.tipo) ? c.tipo : 'testo';
      const valore = tipo === 'data' ? (dataIso(c.valore) || pulito(c.valore)) : pulito(c.valore);
      return { gruppo: gruppi.includes(c.gruppo) ? c.gruppo : 'altro', etichetta: pulito(c.etichetta) || 'Campo', valore, tipo, avviso: tipo === 'data' && Boolean(c.avviso) };
    });
  }
  if ('registro' in s) {
    out.registro = (s.registro || []).map((r) => ({ data: dataIso(r.data) || '', voce: pulito(r.voce), km: pulito(r.km), importo: pulito(r.importo), note: pulito(r.note) }))
      .filter((r) => r.data || r.voce || r.note || r.importo)
      .map((r) => Object.fromEntries(Object.entries(r).filter(([, v]) => v)));
  }
  if ('persone' in s) {
    out.persone = (s.persone || []).map((p) => Object.fromEntries(CAMPI_CONTATTO.map(([k]) => [k, pulito(p[k])]).filter(([, v]) => v)))
      .filter((p) => Object.keys(p).some((k) => k !== 'ruolo'));
  }
  return out;
}

const COLONNE = 'id, ambito, tipo, nome, descrizione, colore, ordine, foto, campi, registro, persone, note, creato_il, modificato_il';
export async function caricaCose(db, idAmbito) {
  return esito(await db.from('mie_cose').select(COLONNE).eq('ambito', idAmbito).is('archiviata_il', null).order('ordine').order('creato_il'));
}
export async function salvaCosa(db, id, campi, idAmbito) {
  return esito(await db.from('mie_cose').update(campiCosa(campi, idAmbito)).eq('id', id).select('id, modificato_il').single());
}
export async function creaCosa(db, cosa) {
  return esito(await db.from('mie_cose').insert(campiCosa(cosa)).select(COLONNE).single());
}
// Mai cancellazioni: la scheda si archivia.
export async function archiviaCosa(db, id) {
  return esito(await db.from('mie_cose').update({ archiviata_il: new Date().toISOString() }).eq('id', id).select('id').single());
}
// Scadenze di tutte le app per la Home: una sola lettura leggera (senza foto).
export async function scadenzeHome(db, oggi = new Date()) {
  const righe = esito(await db.from('mie_cose').select('id, ambito, nome, campi').is('archiviata_il', null));
  const per = Object.fromEntries(ID_AMBITI.map((id) => [id, { n: 0, guardare: 0, prossima: null }]));
  for (const s of righe) {
    const p = per[s.ambito]; if (!p) continue;
    p.n += 1;
    const sc = scadenzeDi(s, oggi);
    p.guardare += sc.filter((x) => x.stato !== 'ok').length;
    if (sc[0] && (!p.prossima || sc[0].giorni < p.prossima.giorni)) p.prossima = sc[0];
  }
  return per;
}
