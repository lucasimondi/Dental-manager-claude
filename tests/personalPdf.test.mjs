import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PDFDocument, degrees } from 'pdf-lib';
import { readFileSync } from 'node:fs';
import { schermoPdf, pdfSchermo, posizioneFirma, limitaFirma, unisciPdf, organizzaPdf, riordina, incorporaFirme, condividiCopia, validaFile } from '../personal/src/pdf/operazioni.js';
import { ambitoPersonal } from '../personal/src/pdf/ingresso.js';
const near = (a,b) => assert.ok(Math.abs(a-b)<1e-8, `${a} ≈ ${b}`);
async function fixture(widths=[300,400]) { const d=await PDFDocument.create(); widths.forEach(w=>d.addPage([w,600])); return d.save(); }
test('PDF coordinates roundtrip: crop offsets, scale and every rotation', () => {
 for(const matrix of [[2,0,0,-2,-20,1200],[0,2,2,0,-40,-20],[-2,0,0,2,900,-40],[0,-2,-2,0,1200,900]]) {
  const p={x:123.25,y:289.5};const r=schermoPdf(pdfSchermo(p,matrix),matrix);near(r.x,p.x);near(r.y,p.y);
 }
 assert.throws(()=>schermoPdf({x:0,y:0},[0,0,0,0,0,0]));
});
test('signature placement preserves bottom-left, dimensions and rotation', () => {
 const r={x:.1,y:.2,width:.3,height:.1};
 const p=posizioneFirma(r,{width:600,height:1200,transform:[2,0,0,-2,0,1200]});near(p.x,30);near(p.y,420);near(p.width,90);near(p.height,60);near(p.rotation,0);
 const rotated=posizioneFirma(r,{width:1200,height:600,transform:[0,2,2,0,0,0]});near(rotated.rotation,90);near(rotated.width,180);near(rotated.height,30);
 const bounded=limitaFirma({x:2,y:-1,width:.4,height:.2});assert.equal(bounded.x,.6);assert.equal(bounded.y,0);
});
test('merge and page reorder keep size/order, rotation, original bytes and filled fields',async()=>{
 const original=await fixture();const before=original.slice();
 const merged=await PDFDocument.load(await unisciPdf([original,await fixture([500])]));assert.deepEqual(merged.getPages().map(p=>p.getWidth()),[300,400,500]);
 const ordered=await PDFDocument.load(await organizzaPdf(original,[{index:1,rotation:90},{index:0,rotation:0}]));assert.equal(ordered.getPage(0).getWidth(),400);assert.equal(ordered.getPage(0).getRotation().angle,90);assert.deepEqual(original,before);
 const d=await PDFDocument.create();const p=d.addPage([300,400]);const field=d.getForm().createTextField('nome');field.setText('TEST FITTIZIO');field.addToPage(p,{x:10,y:10,width:180,height:24});
 const fixed=await PDFDocument.load(await unisciPdf([await d.save()]));assert.equal(fixed.getForm().getFields().length,0);assert.ok(fixed.getPage(0).node.Contents());
 await assert.rejects(organizzaPdf(original,[]));await assert.rejects(organizzaPdf(original,[{index:2,rotation:0}]));await assert.rejects(organizzaPdf(original,[{index:0,rotation:45}]));
 assert.deepEqual(riordina([0,1,2],2,0),[2,0,1]);assert.throws(()=>riordina([0],0,1));
});
test('signature embeds only in requested page and leaves input untouched',async()=>{
 const bytes=await fixture(),copy=bytes.slice();
 const png='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';
 const d=await PDFDocument.load(await incorporaFirme(bytes,[{page:2,png,position:{x:20,y:20,width:60,height:20,rotation:0}}]));
 assert.ok(d.getPage(1).node.Contents());assert.equal(d.getPage(0).node.Contents(),undefined);assert.deepEqual(bytes,copy);
});
test('share is file-only and distinguishes cancellation, unavailable and success',async()=>{
 const file=new File(['%PDF-test'],'synthetic.pdf',{type:'application/pdf'});let actual;
 assert.equal(await condividiCopia(file,{canShare:()=>true,share:async x=>{actual=x;}}),'condiviso');assert.deepEqual(actual,{files:[file]});
 assert.equal(await condividiCopia(file,{}),'non_disponibile');assert.equal(await condividiCopia(file,{canShare:()=>true,share:async()=>{throw new DOMException('Cancelled','AbortError');}}),'annullato');
 assert.throws(()=>validaFile(new File(['x'],'bad.exe',{type:'application/octet-stream'})));
});
test('both Android manifests have scoped POST share target and Personal-only workers',()=>{
 for(const [name,scope] of [['personal','/poliedron/personal/'],['personal-dominio','/personal/']]) {
  const m=JSON.parse(readFileSync(`public/${name}.webmanifest`));assert.equal(m.share_target.action,scope+'?receive-pdf=1');assert.equal(m.share_target.method,'POST');assert.equal(m.share_target.enctype,'multipart/form-data');assert.deepEqual(m.share_target.params.files[0].accept,['application/pdf','image/*']);
 }
 assert.equal(ambitoPersonal('/poliedron/personal/'),'/poliedron/personal/');assert.equal(ambitoPersonal('/personal/'),'/personal/');
 const upload=readFileSync('personal/src/sezioni/documenti/Carica.jsx','utf8');assert.match(upload,/nonAnalizzare: opzioni.soloArchiviazione \|\| nonAnalizzare/);
 const route=readFileSync('personal/src/pdf/PaginaPdf.jsx','utf8');assert.match(route,/soloArchiviazione: true, nonAnalizzare: true/);
});
