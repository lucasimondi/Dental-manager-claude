import { chromium, devices } from 'playwright';
import { PDFDocument, StandardFonts } from 'pdf-lib';
import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
const out='tests/visual/results-personal-pdf';await mkdir(out,{recursive:true});
const d=await PDFDocument.create(),font=await d.embedFont(StandardFonts.Helvetica);
for(let i=0;i<12;i++){const p=d.addPage([595,842]);p.drawText(`PDF FITTIZIO - pagina ${i+1}`,{x:40,y:780,font,size:18});}
const field=d.getForm().createTextField('Nome test');field.addToPage(d.getPage(0),{x:40,y:680,width:250,height:32});
const input=Buffer.from(await d.save());
const server=spawn(process.execPath,['node_modules/vite/bin/vite.js','--host','127.0.0.1','--port','5175','--strictPort'],{stdio:'ignore'});
let browser;
try{
 for(let i=0;i<100;i++){try{if((await fetch('http://127.0.0.1:5175')).ok)break;}catch{}await new Promise(r=>setTimeout(r,100));}
 browser=await chromium.launch({...(process.env.CHROMIUM_EXECUTABLE?{executablePath:process.env.CHROMIUM_EXECUTABLE}:{}),args:['--no-sandbox','--disable-dev-shm-usage']});
 const context=await browser.newContext({...devices['Pixel 7'],acceptDownloads:true});const page=await context.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error') console.error('BROWSER',m.text());});
 await page.route('**/*',route=>new URL(route.request().url()).hostname==='127.0.0.1'?route.continue():route.abort());
 await page.goto('http://127.0.0.1:5175/tests/visual/personal-pdf.html');
 await page.locator('input[type=file]').first().setInputFiles({name:'test-fittizio.pdf',mimeType:'application/pdf',buffer:input});
 await page.getByRole('button',{name:'Salva copia',exact:true}).waitFor();
 await page.waitForFunction(()=>!document.querySelector('.pdf-primary').disabled);
 await page.locator('.pdfViewer .page[data-page-number="1"] canvas').waitFor();
 await page.locator('input[name="Nome test"]').fill('LUCA TEST FITTIZIO');
 await page.getByRole('button',{name:'Firma',exact:true}).click();
 const pad=await page.getByLabel('Spazio firma').boundingBox();assert.ok(pad);
 await page.mouse.move(pad.x+20,pad.y+80);await page.mouse.down();for(let i=0;i<8;i++)await page.mouse.move(pad.x+20+i*22,pad.y+80+(i%2?30:-20));await page.mouse.up();
 await page.getByRole('button',{name:'Usa questa firma'}).click();await page.locator('.pdf-signature').waitFor();
 const sig=await page.locator('.pdf-signature').boundingBox();await page.mouse.move(sig.x+20,sig.y+20);await page.mouse.down();await page.mouse.move(sig.x+45,sig.y+65,{steps:5});await page.mouse.up();
 await page.getByLabel('Numero pagina').fill('12');await page.locator('.pdfViewer .page[data-page-number="12"] canvas').waitFor();
 await page.getByRole('button',{name:'Salva copia',exact:true}).click();await page.getByRole('button',{name:'Condividi PDF',exact:true}).click();
 await page.waitForFunction(()=>window.pdfTest.shares.length===1);
 const shared=await page.evaluate(()=>window.pdfTest.shares[0]);const result=await PDFDocument.load(Uint8Array.from(shared.bytes));assert.equal(result.getPageCount(),12);assert.equal(result.getForm().getTextField('Nome test').getText(),'LUCA TEST FITTIZIO');assert.ok(result.getPage(0).node.Resources().toString().includes('XObject'));
 const downloadPromise=page.waitForEvent('download');await page.getByRole('button',{name:'Scarica PDF',exact:true}).click();const download=await downloadPromise;assert.equal(download.suggestedFilename(),'test-fittizio - modificato.pdf');
 await page.getByRole('button',{name:'Salva nell’archivio come nuovo file'}).click();await page.waitForFunction(()=>window.pdfTest.archived);assert.deepEqual(await page.evaluate(()=>window.pdfTest.archived),shared.bytes);
 await page.getByRole('button',{name:'Torna al documento'}).click();await page.getByRole('button',{name:'Pagine',exact:true}).click();await page.getByLabel('Ruota pagina 1', {exact:true}).click();await page.getByLabel('Elimina pagina 12 dalla copia',{exact:true}).click();await page.getByRole('button',{name:'Applica alla copia'}).click();
 await page.waitForFunction(()=>document.querySelector('input[aria-label="Numero pagina"]')?.max==='11');
 await page.getByRole('button',{name:'Salva copia',exact:true}).click();await page.getByRole('button',{name:'Condividi PDF',exact:true}).click();await page.waitForFunction(()=>window.pdfTest.shares.length===2);
 const after=await PDFDocument.load(Uint8Array.from(await page.evaluate(()=>window.pdfTest.shares[1].bytes)));assert.equal(after.getPageCount(),11);assert.equal(after.getPage(0).getRotation().angle,90);
 await page.getByRole('button',{name:'Torna al documento'}).click();await page.screenshot({path:`${out}/pixel7.png`});
 assert.deepEqual(errors,[]);await writeFile(`${out}/result.json`,JSON.stringify({device:'Pixel 7',pages:12,form:true,signature:true,share:'mocked native file boundary',download:true,archive:'callback bytes verified; no real Drive upload',pageOperations:true,errors},null,2));
 console.log('PASS Pixel 7: open 12 pages, form, signature, export/share/download/archive bytes, rotate/delete. Native share mocked.');
}finally{await browser?.close();server.kill();}
