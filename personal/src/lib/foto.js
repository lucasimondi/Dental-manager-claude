// POL-VITA-015 — Foto e video di Poliedron Personal: le foto e i video dell'archivio (fascicolo
// foto_video), catalogati per album, anno e luogo. I file restano su Drive; qui solo l'indice.
const CAMPI_FOTO = 'id, titolo, riassunto, data_documento, email_data, mime_type, nome_file_originale, drive_file_id, drive_url, album, luogo, persona, tag, fascicolo';

const esito = ({ data, error }) => {
  if (error) throw new Error(error.message || 'Errore archivio');
  return data;
};

export const DA_CATALOGARE = 'Da catalogare';
export const ALBUM_PREDEFINITI = ['Famiglia', 'Amici e feste', 'Viaggi e gite', 'Laurea e cerimonie', 'Natura e animali', 'Barche', 'Casa e lavori', 'Collezione Magic', 'Fotografia e attrezzatura', 'Video', 'Altre foto'];

export const eVideo = (f) => /^video\//.test(f?.mime_type || '') || /\.(mov|mp4|m4v|avi|3gp)$/i.test(f?.nome_file_originale || '');
export const dataFoto = (f) => String(f?.data_documento || f?.email_data || '').slice(0, 10);
export const annoFoto = (f) => dataFoto(f).slice(0, 4) || 'Senza data';

export async function fotoEVideo(db) {
  return esito(await db.from('documenti').select(CAMPI_FOTO).eq('fascicolo', 'foto_video')
    .order('data_documento', { ascending: false, nullsFirst: false }).order('email_data', { ascending: false }).limit(3000));
}

// Album con copertina (la foto più recente non video) e numero di elementi; "Da catalogare" in fondo.
export function album(foto) {
  const per = new Map();
  for (const f of foto) {
    const nome = f.album || DA_CATALOGARE;
    if (!per.has(nome)) per.set(nome, []);
    per.get(nome).push(f);
  }
  return [...per.entries()].map(([nome, elenco]) => ({
    nome, n: elenco.length, video: elenco.filter(eVideo).length,
    copertina: elenco.find((f) => !eVideo(f)) || elenco[0],
    anni: [...new Set(elenco.map(annoFoto))].filter((a) => a !== 'Senza data').sort(),
  })).sort((a, b) => (a.nome === DA_CATALOGARE) - (b.nome === DA_CATALOGARE) || b.n - a.n);
}

export function perAnno(foto) {
  const per = new Map();
  for (const f of foto) {
    const a = annoFoto(f);
    if (!per.has(a)) per.set(a, []);
    per.get(a).push(f);
  }
  return [...per.entries()].sort(([a], [b]) => (a === 'Senza data') - (b === 'Senza data') || b.localeCompare(a));
}

export const luoghi = (foto) => [...new Set(foto.map((f) => f.luogo).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'it'));

export async function catalogaFoto(db, ids, campi) {
  const riga = {};
  if ('album' in campi) riga.album = String(campi.album || '').trim().slice(0, 60) || null;
  if ('luogo' in campi) riga.luogo = String(campi.luogo || '').trim().slice(0, 60) || null;
  if ('titolo' in campi) riga.titolo = String(campi.titolo || '').trim().slice(0, 160) || 'Foto';
  if ('data_documento' in campi) riga.data_documento = /^\d{4}-\d{2}-\d{2}$/.test(campi.data_documento || '') ? campi.data_documento : null;
  const elenco = Array.isArray(ids) ? ids : [ids];
  return esito(await db.from('documenti').update(riga).in('id', elenco).eq('fascicolo', 'foto_video').select('id, album, luogo, titolo, data_documento'));
}
