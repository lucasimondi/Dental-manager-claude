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
   assert.equal(await ws.getByRole('navigation').count(),1);assert.equal(await ws.locator('.plan-drilldown,.appointment-embedded-form,.appointment-document-editor').count(),0);
   assert.equal(await page.getByLabel('Prestazione 1',{exact:true}).isVisible(),true);assert.equal(await page.getByLabel('Prezzo prestazione 1 (€)',{exact:true}).isVisible(),true);
   assert.equal(await page.getByRole('button',{name:'Chiudi appuntamento',exact:true}).evaluate(el=>{const b=el.getBoundingClientRect();return el.contains(document.elementFromPoint(b.x+b.width/2,b.y+b.height/2))}),true);
   assert.equal(await page.getByRole('navigation',{name:'Azioni paziente e appuntamento'}).getByRole('button',{name:'WhatsApp',exact:true}).isVisible(),true);
   assert.equal(await page.getByRole('button',{name:'Modifica appuntamento',exact:true}).isVisible(),true);
   assert.equal(await page.getByLabel('Incassato (€)').isVisible(),true);
   await ws.getByRole('button',{name:'+ Preventivo',exact:false}).click();
   assert.equal(await page.getByLabel('Titolo preventivo').isVisible(),true);
   await section('Preventivo').locator('summary').first().click();
   await page.locator('.agenda-appointment-menu-actions').evaluate(el=>el.scrollTop=0);
   await page.screenshot({path:`${out}/${engine}-${width}-apertura.png`});
   await page.getByLabel('Prestazione 1',{exact:true}).fill('Bozza conservata');
   const docs=ws.locator('details.appointment-document-access');await docs.locator('summary').first().click();
   await docs.getByRole('button',{name:'Apri Ricetta archiviata',exact:true}).waitFor();
   assert.equal(await page.evaluate(()=>window.__pdfReads||0),0);
   await docs.getByRole('button',{name:'Ricette',exact:true}).click();assert.equal(await docs.getByRole('button',{name:'Apri Piano test',exact:true}).count(),0);
   await docs.getByLabel('Cerca nei documenti').fill('inesistente');assert.equal(await docs.getByText('Nessun documento trovato.',{exact:true}).isVisible(),true);
   await docs.getByLabel('Cerca nei documenti').fill('');await docs.getByRole('button',{name:'Apri Ricetta archiviata',exact:true}).click();
   await page.getByRole('button',{name:'Scarica',exact:true}).waitFor();await page.getByRole('button',{name:'Chiudi anteprima documento',exact:true}).click();
   assert.equal(await page.getByLabel('Prestazione 1',{exact:true}).isVisible(),true);
   await docs.getByRole('button',{name:'Preventivi',exact:true}).click();await docs.getByRole('button',{name:'Apri Piano test',exact:true}).click();await page.getByRole('button',{name:'Scarica',exact:true}).waitFor();await page.getByRole('button',{name:'Chiudi anteprima documento',exact:true}).click();
   assert.equal(await page.getByLabel('Prestazione 1',{exact:true}).inputValue(),'Bozza conservata');
   await page.screenshot({path:`${out}/${engine}-${width}-documenti.png`});await docs.locator('summary').first().click();

   await page.getByLabel('Prestazione 1',{exact:true}).fill('Igiene manuale');await page.getByLabel('Prezzo prestazione 1 (€)',{exact:true}).fill('85');
   const pay=section('Incasso');await pay.getByLabel('Incassato (€)').fill('25');await pay.getByLabel('Metodo',{exact:true}).selectOption('Carta');await pay.locator('summary').first().click();
   const quote=section('Preventivo');await quote.locator('summary').first().click();await quote.getByLabel('Titolo preventivo').fill('Preventivo prova');await quote.getByLabel('Voce preventivo 1',{exact:true}).fill('Voce manuale');await quote.getByLabel('Prezzo voce preventivo 1 (€)',{exact:true}).fill('90');await quote.getByRole('button',{name:'+ Altra voce preventivo',exact:true}).click();await quote.getByLabel('Voce preventivo 2',{exact:true}).fill('Prestazione listino');assert.equal(await quote.getByLabel('Prezzo voce preventivo 2 (€)',{exact:true}).inputValue(),'120');await quote.locator('summary').first().click();
   const med=section('Ricetta e documenti');await med.locator('summary').first().click();await med.getByLabel('Farmaco 1',{exact:true}).fill('Farmaco sintetico');await med.getByLabel('Posologia 1').fill('Posologia di prova');await med.locator('summary').first().click();await med.locator('summary').first().click();assert.equal(await med.getByLabel('Farmaco 1',{exact:true}).inputValue(),'Farmaco sintetico');
   await med.getByRole('button',{name:'Genera PDF',exact:true}).click();await med.getByRole('button',{name:'Apri anteprima',exact:true}).waitFor();
   await med.getByLabel('Tipo documento').selectOption('diagnostica');await med.getByLabel('Esami richiesti').fill('Ecografia di prova');await med.getByLabel('Quesito clinico',{exact:true}).fill('Quesito sintetico');await med.getByRole('button',{name:'Genera PDF',exact:true}).click();await med.getByRole('button',{name:'Apri anteprima',exact:true}).waitFor();
   await page.screenshot({path:`${out}/${engine}-${width}-campi-documento.png`});await med.locator('summary').first().click();
   assert.equal(await page.getByLabel('Prestazione 1',{exact:true}).inputValue(),'Igiene manuale');await pay.locator('summary').first().click();assert.equal(await pay.getByLabel('Incassato (€)').inputValue(),'25');
   assert.equal(await page.evaluate(()=>window.__payments.length),0);await page.screenshot({path:`${out}/${engine}-${width}-compilazione.png`});
   await ws.getByRole('button',{name:'Salva e chiudi',exact:true}).evaluate(el=>{el.click();el.click()});await page.locator('.appointment-workspace-sheet').waitFor({state:'detached'});
   const saved=await page.evaluate(()=>({plans:window.__plans,payments:window.__payments,calls:window.__saveCalls}));assert.equal(saved.calls,1);assert.equal(saved.plans[0].voci[0].prezzo,85);assert.equal(saved.plans[0].voci[0].eseguita,false);assert.equal(saved.plans[0].voci[0].incassata,false);assert.equal(saved.plans[1].voci.length,2);assert.equal(saved.payments[0].pianoId,20);assert.equal(saved.payments[0].metodo,'Carta');assert.notEqual(await page.evaluate(()=>document.body.style.overflow),'hidden');
   const savedCard=page.locator('[data-appointment-id="3"]');await savedCard.evaluate(el=>el.scrollIntoView({block:'center'}));await savedCard.click();await ws.locator('.appointment-document-access > summary').click();await ws.getByRole('button',{name:'Apri Preventivo prova',exact:true}).waitFor();await page.getByRole('button',{name:'Chiudi appuntamento',exact:true}).click();
   await open('&empty=1');await page.getByLabel('Prestazione 1',{exact:true}).fill('Prestazione listino');assert.equal(await page.getByLabel('Prezzo prestazione 1 (€)',{exact:true}).inputValue(),'120');await page.getByLabel('Incassato (€)').fill('10');await ws.getByRole('button',{name:'Salva e chiudi'}).click();await page.locator('.appointment-workspace-sheet').waitFor({state:'detached'});assert.equal(await page.evaluate(()=>window.__payments[0].pianoId===window.__plans[0].id),true);
   await open('&empty=1');await section('Preventivo').locator('summary').first().click();await page.getByLabel('Voce preventivo 1',{exact:true}).fill('Solo preventivo');await page.getByLabel('Prezzo voce preventivo 1 (€)',{exact:true}).fill('200');await page.getByLabel('Incassato (€)').fill('20');await page.getByLabel('Collega incasso').selectOption('quote');await ws.getByRole('button',{name:'Salva e chiudi'}).click();await page.locator('.appointment-workspace-sheet').waitFor({state:'detached'});assert.equal(await page.evaluate(()=>window.__plans.length===1&&window.__payments[0].pianoId===window.__plans[0].id),true);
   await open('&empty=1');
   await page.getByLabel('Prestazione 1',{exact:true}).fill('Impianto');await page.getByLabel('Totale impianto 1 (€)',{exact:true}).fill('1800.99');
   const tooth=ws.locator('.appointment-tooth-picker').first();await tooth.locator('summary').click();await tooth.getByRole('button',{name:'Dente 16',exact:true}).click();assert.equal(await page.getByLabel('Dente prestazione 1 (facoltativo)',{exact:true}).inputValue(),'16');await tooth.locator('summary').click();
   assert.equal(await ws.getByText('Corona composito ceramica',{exact:true}).isVisible(),true);assert.equal((await ws.locator('.appointment-implant-preview > div').filter({hasText:'Corona composito ceramica'}).locator('b').textContent()).replace(/[^0-9]/g,''),'115099');
   await ws.getByRole('button',{name:'Duplica prestazione 1',exact:true}).click();assert.equal(await page.getByLabel('Totale impianto 2 (€)',{exact:true}).inputValue(),'1800.99');await page.getByLabel('Dente prestazione 2 (facoltativo)',{exact:true}).fill('26');assert.equal(await page.getByLabel('Dente prestazione 1 (facoltativo)',{exact:true}).inputValue(),'16');
   await page.getByLabel('Incassato (€)').fill('100');await page.screenshot({path:`${out}/${engine}-${width}-impianto.png`});
   await ws.getByRole('button',{name:'Salva e chiudi',exact:true}).click();await page.locator('.appointment-workspace-sheet').waitFor({state:'detached'});
   const implants=await page.evaluate(()=>({plans:window.__plans,payments:window.__payments}));assert.equal(implants.plans.length,1);assert.equal(implants.plans[0].voci.length,6);assert.equal(implants.plans[0].voci[2].prezzo,1150.99);assert.equal(implants.plans[0].voci[5].dente,'26');assert.equal(implants.payments[0].pianoId,implants.plans[0].id);
   await open('&empty=1');await section('Ricetta e documenti').locator('summary').first().click();const favorites=ws.locator('.appointment-drug-favorites');await favorites.locator('summary').click();await favorites.getByRole('button',{name:'Amoxicillina 1 g',exact:true}).click();assert.equal(await page.getByLabel('Farmaco 1',{exact:true}).inputValue(),'Amoxicillina 1 g');assert.equal(await page.getByLabel('Posologia 1',{exact:true}).inputValue(),'1 compressa ogni 8 ore');await page.getByLabel('Farmaco 1',{exact:true}).fill('Paracetamolo 1000 mg');assert.equal(await page.getByLabel('Posologia 1',{exact:true}).inputValue(),'1 compressa ogni 8 ore, al bisogno');await page.screenshot({path:`${out}/${engine}-${width}-farmaci.png`});
   await open('&fail=1');await page.getByLabel('Prestazione 1',{exact:true}).fill('Resta qui');await page.getByLabel('Prezzo prestazione 1 (€)',{exact:true}).fill('30');await ws.getByRole('button',{name:'Salva e chiudi'}).click();await ws.getByRole('alert').waitFor();assert.equal(await page.getByLabel('Prestazione 1',{exact:true}).inputValue(),'Resta qui');assert.equal(await page.locator('.appointment-workspace-sheet').isVisible(),true);
   await open('&vertical=fisioterapista');await section('Ricetta e documenti').locator('summary').first().click();assert.equal(await page.getByLabel('Tipo documento').locator('option[value="ricetta"]').count(),0);assert.equal(await page.getByLabel('Tipo documento').locator('option[value="diagnostica"]').count(),0);
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);for(const label of ['WhatsApp','Modifica appuntamento','Sposta','Scheda'])assert.equal(await page.getByRole('navigation',{name:'Azioni paziente e appuntamento'}).getByRole('button',{name:label,exact:true}).isVisible(),true);
   assert.equal(await page.locator('.agenda-appointment-menu-header').getByRole('button',{name:'Chiama',exact:true}).isVisible(),true);
   await page.getByRole('button',{name:'Chiudi appuntamento',exact:true}).click();
   await page.getByRole('button',{name:'Nuovo',exact:true}).click();
   await page.getByRole('button',{name:'Appuntamento',exact:true}).click();
   const booking=page.getByRole('dialog',{name:'Nuovo appuntamento',exact:true});
   await booking.waitFor();
   const geometry=await booking.evaluate(el=>({top:el.getBoundingClientRect().top,animation:getComputedStyle(el).animationName,focused:el.contains(document.activeElement)}));
   assert.ok(geometry.top<=25,'booking opens near the top');assert.equal(geometry.animation,'none');assert.equal(geometry.focused,false,'keyboard is not opened automatically');
   await booking.getByRole('button',{name:'+ Nuovo paziente',exact:true}).click();
   await booking.getByLabel('Nome nuovo paziente').fill('Nuovo');await booking.getByLabel('Cognome nuovo paziente').fill('Sintetico');await booking.getByLabel('Telefono nuovo paziente').fill('3331112233');
   await booking.getByRole('button',{name:'Crea e seleziona',exact:true}).click();
   assert.equal(await booking.getByText('Nuovo Sintetico',{exact:true}).isVisible(),true);
   assert.equal(await page.evaluate(()=>window.__patients.filter(p=>p.nome==='Nuovo'&&p.cognome==='Sintetico'&&p.telefono==='3331112233').length),1);
   await booking.getByRole('button',{name:'Chiudi',exact:true}).click();
   assert.deepEqual(errors,[]);await context.close();console.log(`${engine}/${width}: immediate fields, collapsible drafts, PDFs, single save, actual plan ID, error retention and vertical gate OK`);
  }await browser.close();
 }
}finally{server.kill()}
