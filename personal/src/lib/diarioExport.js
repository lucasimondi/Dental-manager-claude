import { dateLabel } from './diario.js';
import { quoteForPage } from './diarioQuotes.js';

export function exportPageIndexes(count, scope, current, selected = []) {
  if (!Number.isInteger(count) || count < 1) throw new Error('Il diario non contiene pagine.');
  if (!['current', 'all', 'selected'].includes(scope)) throw new Error('Scegli quali pagine esportare.');
  const indexes = scope === 'all' ? Array.from({ length: count }, (_, i) => i) : scope === 'current' ? [current] : [...new Set(selected)].sort((a, b) => a - b);
  if (!indexes.length) throw new Error('Seleziona almeno una pagina.');
  if (indexes.some((i) => !Number.isInteger(i) || i < 0 || i >= count)) throw new Error('Una pagina selezionata non è disponibile. Riapri Esporta.');
  return indexes;
}

// Preserve hard breaks, whitespace and graphemes; soft wraps never discard content.
export function wrapDiaryText(text, width, measure) {
  const segmenter = typeof Intl.Segmenter === 'function' ? new Intl.Segmenter('it', { granularity: 'grapheme' }) : null;
  const lines = [];
  for (const paragraph of String(text).replace(/\r\n?/g, '\n').split('\n')) {
    let line = '';
    const chars = segmenter ? [...segmenter.segment(paragraph)].map((s) => s.segment) : [...paragraph];
    for (const char of chars) {
      if (line && measure(line + char) > width) {
        const at = Math.max(line.lastIndexOf(' '), line.lastIndexOf('\t'));
        if (at > line.length / 2) { lines.push(line.slice(0, at + 1)); line = line.slice(at + 1); }
        else { lines.push(line); line = ''; }
      }
      line += char;
    }
    lines.push(line);
  }
  return lines;
}

const WIDTH = 1240, HEIGHT = 1754, LEFT = 110, RIGHT = 1130, BOTTOM = 1600;
const canvasDefault = () => Object.assign(document.createElement('canvas'), { width: WIDTH, height: HEIGHT });
const encodeDefault = (canvas) => new Promise((resolve, reject) => canvas.toBlob((blob) => {
  if (!blob) reject(new Error('Impossibile creare l’immagine.'));
  else blob.arrayBuffer().then((buffer) => new Uint8Array(buffer)).then(resolve, reject);
}, 'image/jpeg', .92));
async function imageDefault(src) {
  if (!/^data:image\/(jpeg|png|webp|gif|avif);base64,/i.test(src)) throw new Error('Una foto non è esportabile: scegli una copia leggibile nel diario.');
  const img = new Image(); img.src = src;
  await img.decode().catch(() => { throw new Error('Una foto del diario non è leggibile. Esportazione interrotta.'); });
  return img;
}
const yieldUI = () => new Promise((resolve) => setTimeout(resolve, 0));

// Stream one physical sheet at a time, including continuations for long text/captions.
export async function* renderDiarySheets(pages, indexes, options = {}) {
  const { createCanvas = canvasDefault, encode = encodeDefault, loadImage = imageDefault, cover = false, onProgress = () => {}, cancelled = () => false } = options;
  const check = () => { if (cancelled()) throw new Error('Esportazione annullata.'); };
  const base = () => {
    const canvas = createCanvas(); canvas.width = WIDTH; canvas.height = HEIGHT;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Il dispositivo non riesce a creare la pagina.');
    const bg = ctx.createLinearGradient(0, 0, WIDTH, 0); bg.addColorStop(0, '#d2bd94'); bg.addColorStop(.035, '#f8eed9'); bg.addColorStop(.8, '#f4e8cd'); bg.addColorStop(1, '#e7d5b1');
    ctx.fillStyle = bg; ctx.fillRect(0, 0, WIDTH, HEIGHT);
    ctx.fillStyle = '#71583a'; ctx.fillRect(0, 0, 12, HEIGHT);
    ctx.strokeStyle = '#b8a17a55'; ctx.lineWidth = 1;
    for (let y = 340; y < BOTTOM; y += 42) { ctx.beginPath(); ctx.moveTo(LEFT, y); ctx.lineTo(RIGHT, y); ctx.stroke(); }
    return { canvas, ctx };
  };
  if (cover) {
    check(); const { canvas, ctx } = base();
    ctx.fillStyle = '#35271d'; ctx.fillRect(0, 0, WIDTH, HEIGHT);
    ctx.strokeStyle = '#ad915b'; ctx.lineWidth = 2; ctx.strokeRect(70, 70, WIDTH - 140, HEIGHT - 140);
    ctx.textAlign = 'center'; ctx.fillStyle = '#d7bd83'; ctx.font = '24px sans-serif'; ctx.fillText('PENSIERI · RICORDI · VITA', WIDTH / 2, 280);
    ctx.font = 'italic 144px Georgia, serif'; ctx.fillText('amor fati', WIDTH / 2, 820);
    ctx.font = 'italic 32px Georgia, serif'; ctx.fillText('Accogli ogni pagina della tua vita.', WIDTH / 2, 920);
    ctx.font = '22px sans-serif'; ctx.fillText('DIARIO PERSONALE', WIDTH / 2, 1460);
    yield { bytes: await encode(canvas), name: 'amor-fati-copertina.jpg', pageIndex: null, part: 1 };
    canvas.width = canvas.height = 1;
  }
  for (let n = 0; n < indexes.length; n++) {
    check(); const pageIndex = indexes[n], page = pages[pageIndex], quote = quoteForPage(page);
    onProgress(`Preparo pagina ${n + 1} di ${indexes.length}…`);
    let sheet, part = 0, y;
    const start = () => {
      sheet = base(); part++; const ctx = sheet.ctx;
      ctx.fillStyle = '#806943'; ctx.font = 'italic 27px Georgia, serif'; ctx.textAlign = 'left'; ctx.fillText('amor fati', LEFT, 90);
      ctx.font = '21px sans-serif'; ctx.textAlign = 'right'; ctx.fillText(`Pagina ${pageIndex + 1}${part > 1 ? ` · continua ${part}` : ''}`, RIGHT, 90); ctx.textAlign = 'left';
      ctx.font = 'italic 27px Georgia, serif'; ctx.fillStyle = '#7d6747'; let qy = 168;
      for (const line of wrapDiaryText(`“${quote.text}”`, RIGHT - LEFT - 60, (s) => ctx.measureText(s).width)) { ctx.fillText(line, LEFT + 30, qy); qy += 36; }
      ctx.font = '19px Georgia, serif'; ctx.fillText(`${quote.author} · ${quote.work}`, LEFT + 30, qy + 12);
      ctx.strokeStyle = '#b8a17a88'; ctx.beginPath(); ctx.moveTo(LEFT, qy + 44); ctx.lineTo(RIGHT, qy + 44); ctx.stroke();
      y = Math.max(326, qy + 92);
    };
    const finish = async () => {
      const { ctx, canvas } = sheet; ctx.fillStyle = '#907954'; ctx.font = 'italic 20px Georgia, serif'; ctx.fillText('Ogni giorno, una storia.', LEFT, HEIGHT - 70);
      ctx.textAlign = 'right'; ctx.font = '19px Georgia, serif'; ctx.fillText(`${pageIndex + 1}${part > 1 ? ` / ${part}` : ''}`, RIGHT, HEIGHT - 70);
      const bytes = await encode(canvas); canvas.width = canvas.height = 1;
      return { bytes, name: `amor-fati-pagina-${String(pageIndex + 1).padStart(4, '0')}${part > 1 ? `-${part}` : ''}.jpg`, pageIndex, part };
    };
    start(); let lastDate = null;
    for (const block of page.blocks) {
      check();
      if (block.date && block.date !== lastDate) {
        if (y + 86 > BOTTOM) { yield await finish(); start(); }
        sheet.ctx.font = '22px Georgia, serif'; sheet.ctx.fillStyle = '#8a704d'; sheet.ctx.fillText(dateLabel(block.date), LEFT, y); y += 64; lastDate = block.date;
      }
      if (block.type === 'image') {
        const img = await loadImage(block.src); check();
        const iw = img.naturalWidth || img.width, ih = img.naturalHeight || img.height;
        if (!iw || !ih) throw new Error('Una foto non ha dimensioni valide.');
        const scale = Math.min((RIGHT - LEFT - 24) / iw, 640 / ih), w = iw * scale, h = ih * scale;
        if (y + h + 38 > BOTTOM) { yield await finish(); start(); }
        const ctx = sheet.ctx, x = LEFT + (RIGHT - LEFT - w) / 2;
        ctx.fillStyle = '#fffdf4'; ctx.shadowColor = '#4c381d40'; ctx.shadowBlur = 10; ctx.fillRect(x - 12, y - 12, w + 24, h + 24); ctx.shadowBlur = 0;
        ctx.drawImage(img, x, y, w, h); y += h + 36;
      }
      const text = block.type === 'image' ? (block.caption || '') : (block.text || '');
      const font = block.type === 'image' ? 'italic 27px Georgia, serif' : '32px Georgia, serif';
      sheet.ctx.font = font;
      const lines = wrapDiaryText(text, RIGHT - LEFT, (s) => sheet.ctx.measureText(s).width);
      for (const line of lines) {
        if (y + 16 > BOTTOM) { yield await finish(); start(); }
        const ctx = sheet.ctx; ctx.font = font; ctx.fillStyle = '#443626'; ctx.fillText(line, LEFT, y); y += 42;
      }
      y += 22; await yieldUI();
    }
    yield await finish(); await yieldUI();
  }
}

const CRC_TABLE = Uint32Array.from({ length: 256 }, (_, value) => {
  for (let b = 0; b < 8; b++) value = (value >>> 1) ^ ((value & 1) ? 0xedb88320 : 0);
  return value >>> 0;
});
function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) crc = (crc >>> 8) ^ CRC_TABLE[(crc ^ byte) & 255];
  return (crc ^ 0xffffffff) >>> 0;
}

export function jpegArchive(entries) {
  if (!entries.length || entries.length > 65535) throw new Error('Numero di immagini non supportato. Esporta meno pagine.');
  const now = new Date(), dosDate = ((Math.max(1980, Math.min(2107, now.getFullYear())) - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate(), dosTime = (now.getHours() << 11) | (now.getMinutes() << 5) | Math.floor(now.getSeconds() / 2);
  const local = [], central = []; let offset = 0, centralSize = 0;
  for (const { name, bytes } of entries) {
    const filename = new TextEncoder().encode(name), crc = crc32(bytes);
    if (bytes.length > 0xffffffff || offset + bytes.length + 30 + filename.length > 0xffffffff) throw new Error('Archivio troppo grande: esporta meno pagine.');
    const header = new Uint8Array(30), h = new DataView(header.buffer);
    h.setUint32(0, 0x04034b50, true); h.setUint16(4, 20, true); h.setUint16(6, 0x800, true); h.setUint16(10, dosTime, true); h.setUint16(12, dosDate, true);
    h.setUint32(14, crc, true); h.setUint32(18, bytes.length, true); h.setUint32(22, bytes.length, true); h.setUint16(26, filename.length, true);
    local.push(header, filename, bytes);
    const directory = new Uint8Array(46), d = new DataView(directory.buffer);
    d.setUint32(0, 0x02014b50, true); d.setUint16(4, 20, true); d.setUint16(6, 20, true); d.setUint16(8, 0x800, true); d.setUint16(12, dosTime, true); d.setUint16(14, dosDate, true);
    d.setUint32(16, crc, true); d.setUint32(20, bytes.length, true); d.setUint32(24, bytes.length, true); d.setUint16(28, filename.length, true); d.setUint32(42, offset, true);
    central.push(directory, filename); centralSize += directory.length + filename.length; offset += header.length + filename.length + bytes.length;
  }
  const end = new Uint8Array(22), e = new DataView(end.buffer);
  e.setUint32(0, 0x06054b50, true); e.setUint16(8, entries.length, true); e.setUint16(10, entries.length, true); e.setUint32(12, centralSize, true); e.setUint32(16, offset, true);
  return new Blob([...local, ...central, end], { type: 'application/zip' });
}

export async function createDiaryExport(pages, indexes, format, options = {}) {
  indexes = exportPageIndexes(pages.length, 'selected', 0, indexes);
  if (!['pdf', 'jpeg'].includes(format)) throw new Error('Scegli PDF oppure JPEG.');
  let pdf; const images = [];
  if (format === 'pdf') { const { jsPDF } = await import('jspdf'); pdf = new jsPDF({ unit: 'mm', format: 'a4', compress: true }); pdf.setProperties({ title: 'amor fati', subject: 'Diario personale', creator: 'Poliedron' }); }
  let sheets = 0;
  for await (const sheet of renderDiarySheets(pages, indexes, options)) {
    if (pdf) { if (sheets) pdf.addPage(); pdf.addImage(sheet.bytes, 'JPEG', 0, 0, 210, 297); }
    else images.push(sheet);
    sheets++;
  }
  if (options.cancelled?.()) throw new Error('Esportazione annullata.');
  if (!sheets) throw new Error('Nessuna pagina da esportare.');
  if (pdf) return { blob: pdf.output('blob'), name: 'amor-fati.pdf', sheets };
  if (images.length === 1) return { blob: new Blob([images[0].bytes], { type: 'image/jpeg' }), name: images[0].name, sheets };
  return { blob: jpegArchive(images), name: 'amor-fati-jpeg.zip', sheets };
}
