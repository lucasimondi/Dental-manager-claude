// Private Personal archive only. Existing owner-only RLS; no Studio client or AI.
export const diaryId = () => typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : '10000000-1000-4000-8000-100000000000'.replace(/[018]/g, (c) => (Number(c) ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> Number(c) / 4).toString(16));
export const PREFIX = 'diario:amor-fati:pagina:';
export const PAGE_LENGTH = 1800;
export const today = (now = new Date()) => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Rome', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
export const dateLabel = (date) => new Date(`${date}T12:00:00`).toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
export const newPage = (order = 0) => ({ id: diaryId(), order, blocks: [] });
export const pageText = (page) => page.blocks.map((b) => b.text || b.caption || '').join('\n');
export const orderPages = (pages) => [...pages].sort((a, b) => a.order - b.order || a.id.localeCompare(b.id));
export function searchDiary(pages, query, date = '') {
  const needle = query.trim().toLocaleLowerCase('it');
  if (!needle && !date) return [];
  return pages.flatMap((page, index) => page.blocks.flatMap((block) => {
    const text = block.text || block.caption || '';
    const offset = text.toLocaleLowerCase('it').indexOf(needle);
    return (!date || block.date === date) && (!needle || offset >= 0)
      ? [{ page: index, blockId: block.id, date: block.date, offset: Math.max(0, offset), length: needle.length, excerpt: text.slice(Math.max(0, offset - 45), Math.max(0, offset) + 130) || 'Fotografia' }] : [];
  }));
}
// A date heading is continued across a page boundary, including skipped blank pages.
export function previousDate(pages, pageIndex, blockIndex) {
  for (let p = pageIndex; p >= 0; p--) {
    const blocks = pages[p].blocks;
    for (let b = p === pageIndex ? blockIndex - 1 : blocks.length - 1; b >= 0; b--) if (blocks[b].date) return blocks[b].date;
  }
  return null;
}
export function splitText(text, limit = PAGE_LENGTH) {
  if (text.length <= limit) return [text, ''];
  const boundary = Math.max(text.lastIndexOf('\n', limit), text.lastIndexOf(' ', limit));
  const at = boundary > limit / 2 ? boundary + 1 : limit;
  return [text.slice(0, at), text.slice(at)];
}
export async function loadDiary(db) {
  const pages = [];
  for (let from = 0; ; from += 30) {
    const { data, error } = await db.from('impostazioni_app').select('chiave,valore,aggiornato_il').like('chiave', `${PREFIX}%`).order('chiave').range(from, from + 29);
    if (error) throw new Error(error.message);
    for (const row of data || []) {
      if (!row.valore?.id || !Array.isArray(row.valore.blocks) || row.chiave !== PREFIX + row.valore.id) throw new Error('Una pagina del diario non è leggibile. Nessun dato è stato sovrascritto.');
      pages.push({ ...row.valore, revision: row.aggiornato_il });
    }
    if (!data || data.length < 30) break;
  }
  return orderPages(pages);
}
export async function savePage(db, page) {
  const { revision, ...valore } = page;
  const row = { chiave: PREFIX + page.id, valore, aggiornato_il: new Date().toISOString() };
  // Compare-and-swap: never silently overwrite another device's edits.
  const request = revision
    ? db.from('impostazioni_app').update(row).eq('chiave', row.chiave).eq('aggiornato_il', revision)
    : db.from('impostazioni_app').insert(row);
  const { data, error } = await request.select('aggiornato_il').maybeSingle();
  if (error) throw new Error(error.code === '23505' ? 'Pagina già modificata su un altro dispositivo. Esporta la tua copia prima di ricaricare.' : error.message);
  if (!data) throw new Error('Pagina modificata su un altro dispositivo. Esporta la tua copia prima di ricaricare.');
  return data.aggiornato_il;
}
export async function prepareImage(file) {
  if (!/^image\/(jpeg|png|webp|gif|avif|heic|heif)$/i.test(file.type)) throw new Error('Scegli una foto o uno screenshot (JPG, PNG, WebP).');
  if (file.size > 25 * 1024 * 1024) throw new Error('Questa immagine supera 25 MB. Scegli una copia più piccola.');
  const url = URL.createObjectURL(file);
  try {
    const img = new Image(); img.src = url;
    await img.decode().catch(() => { throw new Error('Immagine non leggibile. Prova a incollarla come screenshot o JPG.'); });
    const scale = Math.min(1, 1600 / Math.max(img.naturalWidth, img.naturalHeight));
    const canvas = document.createElement('canvas'); canvas.width = Math.max(1, Math.round(img.naturalWidth * scale)); canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
    const ctx = canvas.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, canvas.width, canvas.height); ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', 0.8);
  } finally { URL.revokeObjectURL(url); }
}
