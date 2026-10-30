// Deterministic, offline proposal only. No file is uploaded or modified.
export const FASCICOLI = Object.freeze([
  'identita','immobili','successione','conti','fiscale','previdenza',
  'utenze','riscaldamento','studio_fornitori','studio_fatture_emesse',
  'legale','assicurazioni','veicoli','famiglia_scuola','sanitario_famiglia',
  'servizi','acquisti','formazione','personale_studio','corrispondenza',
  'foto_video','pubblicita','altro'
]);
const rules = [
  ['identita', /\b(carta.identit[aà]|passaporto|patente|c.i.e.)\b/i],
  ['fiscale', /\b(730|f24|dichiarazione.redditi|agenzia.entrate|iva)\b/i],
  ['utenze', /\b(bolletta|energia.elettrica|gas|acqua|edison|enel)\b/i],
  ['assicurazioni', /\b(polizza|assicurazione|rc.auto)\b/i],
  ['veicoli', /\b(auto|automobile|bollo.auto|revisione|libretto)\b/i],
  ['legale', /\b(tribunale|avvocato|pignoramento|sentenza|diffida)\b/i],
  ['immobili', /\b(catasto|visura.catastale|rogito|mutuo)\b/i],
  ['previdenza', /\b(inps|pensione|contributi)\b/i],
  ['formazione', /\b(diploma|laurea|master|corso|certificato)\b/i],
  ['famiglia_scuola', /\b(scuola|mensa|pagella|iscrizione.scolastica)\b/i]
];
export function prepareArchive({filename,description='',fascicolo}={}) {
  if(typeof filename!=='string'||!filename.trim()||filename.length>255) throw Error('Invalid filename');
  if(/[/\\\x00-\x1f]/.test(filename)) throw Error('Unsafe filename');
  if(fascicolo==='clinico_pazienti') throw Error('Clinical documents are not allowed');
  if(fascicolo&&!FASCICOLI.includes(fascicolo)) throw Error('Unknown category');
  const sample=(filename+' '+String(description).slice(0,500)).normalize('NFKC');
  const suggested=fascicolo||rules.find(([,pattern])=>pattern.test(sample))?.[0]||'altro';
  return {filename,fascicolo:suggested,requires_confirmation:true,uploaded:false,registered:false};
}
