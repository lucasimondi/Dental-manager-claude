import test from 'node:test';
import assert from 'node:assert/strict';
import {fetchOriginal,contentBlocks} from './document-content.mjs';
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=','base64');
const row={id:'c092682e-59fc-4a90-a320-a751183ade65',fascicolo:'altro',drive_file_id:'synthetic_drive_id_123'};
function pdfFixture(stream) {
 const objects=['<< /Type /Catalog /Pages 2 0 R >>','<< /Type /Pages /Kids [3 0 R] /Count 1 >>','<< /Type /Page /Parent 2 0 R /MediaBox [0 0 600 800] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>','<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',`<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`];
 let file='%PDF-1.4\n';const offsets=[0];for(let i=0;i<objects.length;i++){offsets.push(Buffer.byteLength(file));file+=`${i+1} 0 obj\n${objects[i]}\nendobj\n`;}
 const xref=Buffer.byteLength(file);file+=`xref\n0 6\n0000000000 65535 f \n`+offsets.slice(1).map(n=>String(n).padStart(10,'0')+' 00000 n \n').join('')+`trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
 return Buffer.from(file);
}
export {pdfFixture};
test('retrieves only authorized row original through fixed archive action',async()=>{
 let called=false;
 const file=await fetchOriginal(row,'synthetic-token',{endpoint:'https://archive.example/exec',fetchImpl:async(url,init)=>{called=true;const body=JSON.parse(init.body);assert.deepEqual(body,{token:'synthetic-token',azione:'file',drive_file_id:row.drive_file_id});return Response.json({ok:true,nome:'test.png',mime:'image/png',dati:png.toString('base64')});}});
 assert.equal(called,true);assert.deepEqual(file.bytes,png);
 const result=await contentBlocks(file);assert.equal(result.blocks[0].type,'image');assert.equal(result.blocks[0].data,png.toString('base64'));
});
test('denies clinical/missing documents before reaching Drive',async()=>{
 for(const doc of [null,{...row,fascicolo:'clinico_pazienti'},{...row,drive_file_id:'invalid'}])await assert.rejects(()=>fetchOriginal(doc,'synthetic',{endpoint:'https://archive.example',fetchImpl:()=>{assert.fail('must not call');}}));
});
test('rejects upstream denial, invalid base64 and oversized originals',async()=>{
 for(const response of [{ok:false},{ok:true,mime:'image/png',dati:'@@'},{ok:true,mime:'image/png',dati:Buffer.alloc(10*1024*1024+1).toString('base64')}]) await assert.rejects(()=>fetchOriginal(row,'synthetic',{endpoint:'https://archive.example',fetchImpl:async()=>Response.json(response)}));
});
test('rejects mislabeled image and unsupported files',async()=>{
 await assert.rejects(()=>contentBlocks({bytes:Buffer.from('bad'),mime:'image/png'}));
 await assert.rejects(()=>contentBlocks({bytes:png,mime:'application/octet-stream'}));
});
test('extracts actual PDF text with page cursor and rejects out-of-range pages',async()=>{
 const file={bytes:pdfFixture('BT /F1 14 Tf 15 150 Td (POLIEDRON SYNTHETIC PDF 20261031) Tj ET'),mime:'application/pdf'};
 const result=await contentBlocks(file);assert.match(result.blocks[0].text,/POLIEDRON SYNTHETIC PDF 20261031/);assert.equal(result.summary.next_page,null);
 await assert.rejects(()=>contentBlocks(file,{start_page:2}));
});
test('renders a scanned/no-text PDF page as an image for vision',async()=>{
 const result=await contentBlocks({bytes:pdfFixture('0 0 1 rg 20 20 80 80 re f'),mime:'application/pdf'});
 assert.deepEqual(result.summary.scanned_pages,[1]);assert.equal(result.blocks[1].type,'image');assert.ok(result.blocks[1].data.length>100);
});
