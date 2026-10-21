import {createRequire} from 'node:module';
const {chromium,webkit}=createRequire(import.meta.url)('playwright');
import {mkdir} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import assert from 'node:assert/strict';
const out='tests/visual/results-appointment-workspace';await mkdir(out,{recursive:true});
const server=spawn(process.execPath,['node_modules/vite/bin/vite.js','--host','127.0.0.1','--port','5173','--strictPort'],{stdio:'ignore'});
try{
 for(let i=0;i<80;i++){try{if((await fetch('http://127.0.0.1:5173')).ok)break}catch{}await new Promise(r=>setTimeout(r,100))}
 for(const engine of ['chromium','webkit']){
  const browser=await({chromium,webkit}[engine]).launch();
  for(const width of [375,768,1024,1440]){
   const context=await browser.newContext({viewport:{width,height:900},timezoneId:'Europe/Rome'}),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
   await page.emulateMedia({reducedMotion:'reduce'});
   await page.clock.install({time:new Date('2026-10-21T06:00:00Z')});
   await page.route('**/*',route=>new URL(route.request().url()).hostname==='127.0.0.1'?route.continue():route.fulfill({json:[],headers:{'access-control-allow-origin':'*'}}));
   const open=async(suffix='')=>{
    await page.goto('http://127.0.0.1:5173/tests/visual/appointment-workspace.html?agenda=1&agendaDate=2026-10-23&agendaView=giorno'+suffix);
    const card=page.locator('[data-appointment-id="3"]');await card.evaluate(el=>el.scrollIntoView({block:'center'}));await card.click();await page.getByRole('navigation',{name:'Operazioni appuntamento'}).waitFor();
    assert.equal(await page.getByRole('button',{name:'Chiudi appuntamento',exact:true}).evaluate(el=>{const b=el.getBoundingClientRect();return el.contains(document.elementFromPoint(b.x+b.width/2,b.y+b.height/2))}),true,'agenda overlays cannot cover the sheet');
   };
   await open();
   const ws=page.getByRole('region',{name:'Scheda appuntamento'}),nav=ws.getByRole('navigation');
   const choose=label=>nav.getByRole('button',{name:label,exact:true}).click();
   const editor=ws.locator('.plan-inline-editor');
   await editor.getByPlaceholder('Descrizione prestazione').fill('Manuale 85');await editor.locator('input[type="number"]').fill('85');
   await choose('Incasso');const pay=ws.getByRole('region',{name:'Registra incasso'});await pay.locator('input[type="number"]').fill('25');
   await choose('Prestazioni');assert.equal(await editor.getByPlaceholder('Descrizione prestazione').inputValue(),'Manuale 85');
   await editor.getByRole('button',{name:'Aggiungi',exact:true}).click();
   let row=await page.evaluate(()=>window.__plans[0].voci[0]);assert.equal(row.prezzo,85);assert.equal(row.eseguita,false);assert.equal(row.incassata,false);
   await choose('Incasso');assert.equal(await pay.locator('input[type="number"]').inputValue(),'25');await pay.getByRole('button',{name:'Salva',exact:true}).click();
   assert.deepEqual(await page.evaluate(()=>window.__payments.map(p=>[p.pazienteId,p.importo])),[[7,25]]);
   await choose('Ricetta');const drug=page.getByPlaceholder('es. Amoxicillina 875mg, Ibuprofene 600mg...');await drug.fill('Farmaco sintetico');
   await choose('Preventivo');const quote=ws.getByRole('region',{name:'Nuovo piano di cura'});await quote.getByPlaceholder('es. Piano conservativa').fill('Preventivo prova');await quote.getByPlaceholder('Digita nome prestazione…').fill('Voce manuale');
   await quote.locator('input[type="number"]').first().fill('90');await quote.getByRole('button',{name:'+ Aggiungi',exact:true}).click();
   await quote.locator('select').filter({has:page.locator('option',{hasText:'Scegli dal listino…'})}).selectOption('Prestazione listino');await quote.getByRole('button',{name:'+ Aggiungi',exact:true}).click();
   await choose('Ricetta');assert.equal(await drug.inputValue(),'Farmaco sintetico');
   await choose('Preventivo');assert.equal(await quote.getByPlaceholder('es. Piano conservativa').inputValue(),'Preventivo prova');
   await quote.getByRole('button',{name:'Salva piano',exact:true}).click();
   const plan=await page.evaluate(()=>window.__plans[1]);assert.equal(plan.pazienteId,7);assert.equal(plan.voci.length,2);assert.equal(plan.voci[0].prezzo,90);assert.equal(plan.voci[1].prezzo,120);assert.equal(plan.voci.every(v=>!v.eseguita&&!v.incassata),true);
   await choose('Documenti');await page.getByRole('button',{name:/Richiesta esami diagnostici/}).click();await page.getByText('Quesito clinico / motivazione (opzionale)',{exact:true}).waitFor();
   assert.equal(await page.locator('.appointment-document-editor').evaluate(el=>getComputedStyle(el).position),'relative');assert.equal(await page.getByText('Scheda paziente richiesta',{exact:true}).count(),0);
   await page.screenshot({path:`${out}/${engine}-${width}-documenti.png`});
   await choose('Prestazioni');await page.getByText('Altre azioni appuntamento',{exact:true}).click();for(const label of ['WhatsApp','Email','Modifica','Sposta','Elimina'])assert.equal(await page.locator('.agenda-appointment-menu-actions > details').getByRole('button',{name:label,exact:true}).isVisible(),true);
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
   const box=await page.locator('.appointment-workspace-sheet').boundingBox();assert.ok(box.width>=(width < 768 ? width - 1 : Math.min(width - 40, 1000) - 1),JSON.stringify(box));
   await page.screenshot({path:`${out}/${engine}-${width}-prestazioni.png`});await page.getByRole('button',{name:'Chiudi appuntamento',exact:true}).click();assert.equal(await page.locator('.appointment-workspace-sheet').count(),0);assert.notEqual(await page.evaluate(()=>document.body.style.overflow),'hidden');
   // A patient without a plan creates one explicitly, in the same sheet.
   await open('&empty=1');await ws.getByRole('button',{name:'Crea piano e inserisci prestazioni'}).click();await quote.getByPlaceholder('es. Piano conservativa').fill('Primo piano');await quote.getByPlaceholder('Digita nome prestazione…').fill('Prima voce');await quote.locator('input[type="number"]').first().fill('50');await quote.getByRole('button',{name:'+ Aggiungi',exact:true}).click();await quote.getByRole('button',{name:'Salva piano',exact:true}).click();assert.equal(await page.evaluate(()=>window.__plans.length),1);
   await open('&vertical=fisioterapista');assert.equal(await nav.getByRole('button',{name:'Ricetta',exact:true}).isDisabled(),true);
   assert.deepEqual(errors,[]);await context.close();console.log(`${engine}/${width}: embedded operations, drafts, quote, old actions, close and vertical gate OK`);
  }await browser.close();
 }
}finally{server.kill()}
