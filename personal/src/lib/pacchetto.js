// POL-VITA-031 CARTELLE-MIE — ZIP di cartelle e documenti, fatto sul telefono.
// Le cartelle scelte entrano con tutte le sottocartelle e la stessa struttura; i documenti scelti
// singolarmente stanno nella radice dello ZIP. Password facoltativa:
//   - «forte»: AES-256 (si apre con 7-Zip, WinRAR, Keka, app di file Android; non con Esplora
//     risorse di Windows né con l'Utility Archivio del Mac);
//   - «compatibile»: ZipCrypto (si apre quasi ovunque, protezione debole).
// La password non viene salvata né inviata: resta solo nello ZIP.
// I documenti dei pazienti non entrano (lo script non li consegna all'app).
import { discendenti, percorso, nomeFileDoc, nomeSicuro, rendiUnici, collegamenti } from './cartelleMie.js';

export const MAX_FILE_ZIP = 80;

// Pura: dai collegamenti {cartella_id, documenti} costruisce le voci dello ZIP.
export function vociPacchetto({ cartelle, cartelleScelte = [], documentiScelti = [], righe = [] }) {
  const voci = [];
  const esclusi = [];
  const cartelleVuote = [];
  const visti = new Set();
  const aggiungi = (cartellaPercorso, d) => {
    if (!d) return;
    if (d.fascicolo === 'clinico_pazienti') { esclusi.push(`${d.titolo || 'documento'} (paziente)`); return; }
    if (!d.drive_file_id) { esclusi.push(`${d.titolo || 'documento'} (senza file)`); return; }
    const k = `${cartellaPercorso}|${d.id}`;
    if (visti.has(k)) return;
    visti.add(k);
    voci.push({ percorso: cartellaPercorso ? `${cartellaPercorso}/${nomeFileDoc(d)}` : nomeFileDoc(d), doc: d });
  };
  for (const id of cartelleScelte) {
    const radice = percorso(cartelle, id);
    const quanti = radice.length - 1; // il percorso nello ZIP parte dalla cartella scelta
    for (const sub of discendenti(cartelle.filter((c) => !c.archiviata_il || c.id === id), id)) {
      const p = percorso(cartelle, sub).slice(quanti).map((x) => nomeSicuro(x.nome, 'cartella')).join('/');
      const dentro = righe.filter((r) => r.cartella_id === sub);
      if (!dentro.length) cartelleVuote.push(p);
      for (const r of dentro) aggiungi(p, r.documenti);
    }
  }
  for (const d of documentiScelti) aggiungi('', d);
  const unici = rendiUnici(voci.map((v) => v.percorso));
  voci.forEach((v, i) => { v.percorso = unici[i]; });
  return { voci, esclusi, cartelleVuote };
}

// Legge dal database i documenti delle cartelle scelte e prepara le voci.
export async function preparaVoci(db, { cartelle, cartelleScelte, documentiScelti }) {
  const tutte = new Set();
  for (const id of cartelleScelte) for (const s of discendenti(cartelle, id)) tutte.add(s);
  const righe = await collegamenti(db, [...tutte]);
  return vociPacchetto({ cartelle, cartelleScelte, documentiScelti, righe });
}

// Scarica i file (3 alla volta) con l'avanzamento.
export async function scaricaFile(voci, prendiFile, onAvanzamento = () => {}) {
  const fuori = new Array(voci.length);
  const errori = [];
  let fatti = 0;
  let prossimo = 0;
  const lavora = async () => {
    while (prossimo < voci.length) {
      const i = prossimo; prossimo += 1;
      try { fuori[i] = await prendiFile(voci[i].doc); } catch { errori.push(voci[i].percorso); }
      fatti += 1;
      onAvanzamento(fatti, voci.length);
    }
  };
  await Promise.all([lavora(), lavora(), lavora()]);
  return { file: voci.map((v, i) => (fuori[i] ? { percorso: v.percorso, file: fuori[i] } : null)).filter(Boolean), errori };
}

// Crea lo ZIP. `protezione`: 'forte' (AES-256) o 'compatibile' (ZipCrypto), solo con password.
export async function creaZip({ nome, file, cartelleVuote = [], password = '', protezione = 'forte' }) {
  const { ZipWriter, BlobWriter, BlobReader, configure } = await import('@zip.js/zip.js');
  configure({ useWebWorkers: false });
  const opzioni = password
    ? (protezione === 'compatibile' ? { password, zipCrypto: true } : { password, encryptionStrength: 3 })
    : {};
  const scrittore = new ZipWriter(new BlobWriter('application/zip'), opzioni);
  for (const p of cartelleVuote) if (p) await scrittore.add(`${p}/`, undefined, { directory: true });
  for (const f of file) await scrittore.add(f.percorso, new BlobReader(f.file));
  const blob = await scrittore.close();
  return new File([blob], `${nomeSicuro(nome, 'Documenti')}.zip`, { type: 'application/zip' });
}
