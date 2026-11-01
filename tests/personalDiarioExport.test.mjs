import { test } from 'node:test';
import assert from 'node:assert/strict';
import { exportPageIndexes, wrapDiaryText, jpegArchive } from '../personal/src/lib/diarioExport.js';
import { quoteForPage, DIARY_QUOTES } from '../personal/src/lib/diarioQuotes.js';
test('export selects exactly current/all/chosen pages, ordered without duplicates', () => {
  assert.deepEqual(exportPageIndexes(6, 'current', 3), [3]);
  assert.deepEqual(exportPageIndexes(3, 'all', 2), [0,1,2]);
  assert.deepEqual(exportPageIndexes(6, 'selected', 0, [4,1,4]), [1,4]);
  for (const args of [[0,'all',0], [3,'selected',0,[]], [3,'selected',0,[3]], [3,'current',-1], [3,'unknown',0]]) assert.throws(() => exportPageIndexes(...args));
});
test('wrapping preserves accents, spaces, newlines and whole emoji graphemes', () => {
  const text = 'Un caffè  e un ricordo 👨‍👩‍👧‍👧.\n\nFine.';
  const lines = wrapDiaryText(text, 12, (s) => [...s].length);
  assert.equal(lines.join(''), text.replaceAll('\n', ''));
  assert(lines.includes('')); assert(lines.some((s) => s.includes('👨‍👩‍👧‍👧')));
  assert.deepEqual(wrapDiaryText('', 10, (s) => s.length), ['']);
  assert.deepEqual(wrapDiaryText('a\r\nb\rc', 10, (s) => s.length), ['a','b','c']);
});
test('quote belongs to stable page identity, independent of position or edits', () => {
  const p = {id:'page-a',blocks:[]};
  assert.equal(quoteForPage(p), quoteForPage({...p,order:300,blocks:[{text:'modificato'}]}));
  assert(DIARY_QUOTES.every((q) => q.text && q.author && q.work && q.source.startsWith('https://')));
  assert(new Set(Array.from({length:50}, (_,i) => quoteForPage({id:`page-${i}`}))).size > 5);
});
test('JPEG archive has valid directory offsets, UTF8 flags and known CRC32', async () => {
  const bytes = new TextEncoder().encode('123456789');
  const blob = jpegArchive([{name:'pagina-1.jpg',bytes},{name:'pagina-2.jpg',bytes:new Uint8Array([255,216,255,217])}]);
  assert.equal(blob.type,'application/zip');
  const data = new Uint8Array(await blob.arrayBuffer()), view = new DataView(data.buffer);
  assert.equal(view.getUint32(0,true),0x04034b50);
  assert.equal(view.getUint32(14,true),0xcbf43926);
  assert.equal(view.getUint16(6,true),0x800);
  const end = data.length - 22, directory = view.getUint32(end + 16,true);
  assert.equal(view.getUint32(end,true),0x06054b50);
  assert.equal(view.getUint16(end + 10,true),2);
  assert.equal(view.getUint32(directory,true),0x02014b50);
  assert.equal(view.getUint32(directory + 42,true),0);
  assert.equal(view.getUint32(end + 12,true),end-directory);
  assert.throws(() => jpegArchive([]));
});

test('renderer retains every line across continuation sheets and only chosen pages', async () => {
  const { renderDiarySheets } = await import('../personal/src/lib/diarioExport.js');
  const options = {
    createCanvas() {
      const drawn = [], ctx = {createLinearGradient:()=>({addColorStop(){}}),fillRect(){},strokeRect(){},beginPath(){},moveTo(){},lineTo(){},stroke(){},fillText(t){drawn.push(t)},measureText:t=>({width:t.length*16})};
      return {drawn,getContext:()=>ctx};
    },
    encode:async c=>new TextEncoder().encode(JSON.stringify(c.drawn)),
  };
  const texts=Array.from({length:80},(_,i)=>`CORPO_${i+1}`);
  const pages=[{id:'long',blocks:[{type:'text',date:'2026-11-01',text:texts.join('\n')}]},{id:'excluded',blocks:[{type:'text',date:'2026-11-01',text:'NON ESPORTARE'}]}];
  const output=[];
  for await(const sheet of renderDiarySheets(pages,[0],options)) { assert.equal(sheet.pageIndex,0); output.push(...JSON.parse(new TextDecoder().decode(sheet.bytes))); }
  assert.deepEqual(output.filter(s=>s.startsWith('CORPO_')),texts);
  assert(!output.includes('NON ESPORTARE')); assert.equal(pages[0].blocks[0].text,texts.join('\n'));
  await assert.rejects(async()=>{for await(const s of renderDiarySheets(pages,[0],{...options,cancelled:()=>true})) void s;},/annullata/);
});
