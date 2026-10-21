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
   const context=await browser.newContext({viewport:{width,height:900},timezoneId:'Europe/Rome'}),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.emulateMedia({reducedMotion:'reduce'});
   await page.clock.install({time:new Date('2026-10-21T06:00:00Z')});
   await page.route('**/*',route=>new URL(route.request().url()).hostname==='127.0.0.1'?route.continue():route.fulfill({json:[],headers:{'access-control-allow-origin':'*'}}));
   const open=async(suffix='')=>{
    await page.goto('http://127.0.0.1:5173/tests/visual/appointment-workspace.html?agenda=1&agendaDate=2026-10-23&agendaView=giorno'+suffix);
    const card=page.locator('[data-appointment-id="3"]');await card.evaluate(el=>el.scrollIntoView({block:'center'}));await card.click();await page.getByLabel('Prestazione 1',{exact:true}).waitFor();
   };
   const ws=page.getByRole('region',{name:'Scheda appuntamento'}),section=name=>ws.locator('details.appointment-form-section').filter({has:page.locator('summary > span',{hasText:name})});
   await open();
   assert.equal(await ws.getByRole('navigation').count(),0);assert.equal(await ws.locator('.plan-drilldown,.appointment-embedded-form,.appointment-document-editor').count(),0);
   assert.equal(await page.getByLabel('Prestazione 1',{exact:true}).isVisible(),true);assert.equal(await page.getByLabel('Prezzo prestazione 1 (€)',{exact:true}).isVisible(),true);
   assert.equal(await page.getByRole('button',{name:'Chiudi appuntamento',exact:true}).evaluate(el=>{const b=el.getBoundingClientRect();return el.contains(document.elementFromPoint(b.x+b.width/2,b.y+b.height/2))}),true);
   await page.screenshot({path:`${out}/${engine}-${width}-apertura.png`});
   await page.getByLabel('Prestazione 1',{exact:true}).fill('Igiene manuale');await page.getByLabel('Prezzo prestazione 1 (€)',{exact:true}).fill('85');
   const pay=section('Incasso');await pay.locator('summary').first().click();await pay.getByLabel('Incassato (€)').fill('25');await pay.getByLabel('Metodo',{exact:true}).selectOption('Carta');await pay.locator('summary').first().click();
   const quote=section('Preventivo');await quote.locator('summary').first().click();await quote.getByLabel('Titolo preventivo').fill('Preventivo prova');await quote.getByLabel('Voce preventivo 1',{exact:true}).fill('Voce manuale');await quote.getByLabel('Prezzo voce preventivo 1 (€)',{exact:true}).fill('90');await quote.getByRole('button',{name:'+ Altra voce preventivo',exact:true}).click();await quote.getByLabel('Voce preventivo 2',{exact:true}).fill('Prestazione listino');assert.equal(await quote.getByLabel('Prezzo voce preventivo 2 (€)',{exact:true}).inputValue(),'120');await quote.locator('summary').first().click();
   const med=section('Ricetta e documenti');await med.locator('summary').first().click();await med.getByLabel('Farmaco 1',{exact:true}).fill('Farmaco sintetico');await med.getByLabel('Posologia 1').fill('Posologia di prova');await med.locator('summary').first().click();await med.locator('summary').first().click();assert.equal(await med.getByLabel('Farmaco 1',{exact:true}).inputValue(),'Farmaco sintetico');
   await med.getByRole('button',{name:'Genera PDF',exact:true}).click();await med.getByRole('button',{name:'Apri anteprima',exact:true}).waitFor();
   await med.getByLabel('Tipo documento').selectOption('diagnostica');await med.getByLabel('Esami richiesti').fill('Ecografia di prova');await med.getByLabel('Quesito clinico',{exact:true}).fill('Quesito sintetico');await med.getByRole('button',{name:'Genera PDF',exact:true}).click();await med.getByRole('button',{name:'Apri anteprima',exact:true}).waitFor();
   await page.screenshot({path:`${out}/${engine}-${width}-campi-documento.png`});await med.locator('summary').first().click();
   assert.equal(await page.getByLabel('Prestazione 1',{exact:true}).inputValue(),'Igiene manuale');await pay.locator('summary').first().click();assert.equal(await pay.getByLabel('Incassato (€)').inputValue(),'25');
   assert.equal(await page.evaluate(()=>window.__payments.length),0);await page.screenshot({path:`${out}/${engine}-${width}-compilazione.png`});
   await ws.getByRole('button',{name:'Salva e chiudi',exact:true}).evaluate(el=>{el.click();el.click()});await page.locator('.appointment-workspace-sheet').waitFor({state:'detached'});
   const saved=await page.evaluate(()=>({plans:window.__plans,payments:window.__payments,calls:window.__saveCalls}));assert.equal(saved.calls,1);assert.equal(saved.plans[0].voci[0].prezzo,85);assert.equal(saved.plans[0].voci[0].eseguita,false);assert.equal(saved.plans[0].voci[0].incassata,false);assert.equal(saved.plans[1].voci.length,2);assert.equal(saved.payments[0].pianoId,20);assert.equal(saved.payments[0].metodo,'Carta');assert.notEqual(await page.evaluate(()=>document.body.style.overflow),'hidden');
   await open('&empty=1');await page.getByLabel('Prestazione 1',{exact:true}).fill('Prestazione listino');assert.equal(await page.getByLabel('Prezzo prestazione 1 (€)',{exact:true}).inputValue(),'120');await section('Incasso').locator('summary').first().click();await page.getByLabel('Incassato (€)').fill('10');await ws.getByRole('button',{name:'Salva e chiudi'}).click();await page.locator('.appointment-workspace-sheet').waitFor({state:'detached'});assert.equal(await page.evaluate(()=>window.__payments[0].pianoId===window.__plans[0].id),true);
   await open('&fail=1');await page.getByLabel('Prestazione 1',{exact:true}).fill('Resta qui');await page.getByLabel('Prezzo prestazione 1 (€)',{exact:true}).fill('30');await ws.getByRole('button',{name:'Salva e chiudi'}).click();await ws.getByRole('alert').waitFor();assert.equal(await page.getByLabel('Prestazione 1',{exact:true}).inputValue(),'Resta qui');assert.equal(await page.locator('.appointment-workspace-sheet').isVisible(),true);
   await open('&vertical=fisioterapista');await section('Ricetta e documenti').locator('summary').first().click();assert.equal(await page.getByLabel('Tipo documento').locator('option[value="ricetta"]').count(),0);assert.equal(await page.getByLabel('Tipo documento').locator('option[value="diagnostica"]').count(),0);
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await page.getByText('Altre azioni appuntamento',{exact:true}).click();for(const label of ['WhatsApp','Email','Modifica','Sposta','Elimina'])assert.equal(await page.locator('.agenda-appointment-menu-actions > details').getByRole('button',{name:label,exact:true}).isVisible(),true);
   assert.deepEqual(errors,[]);await context.close();console.log(`${engine}/${width}: immediate fields, collapsible drafts, PDFs, single save, actual plan ID, error retention and vertical gate OK`);
  }await browser.close();
 }
}finally{server.kill()}
