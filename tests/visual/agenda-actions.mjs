import {createRequire} from 'node:module';
const {chromium,webkit}=createRequire(import.meta.url)('playwright');
import {mkdir} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import assert from 'node:assert/strict';
const out='tests/visual/results-agenda-actions';await mkdir(out,{recursive:true});
const server=spawn(process.execPath,['node_modules/vite/bin/vite.js','--host','127.0.0.1','--port','5173','--strictPort'],{stdio:'ignore'});
try{
 for(let i=0;i<80;i++){try{if((await fetch('http://127.0.0.1:5173')).ok)break}catch{}await new Promise(r=>setTimeout(r,100))}
 for(const engine of ['chromium','webkit']){
  const browser=await({chromium,webkit}[engine]).launch();
  for(const width of [375,1024])for(const action of ['Prestazione','Ricetta','Documenti','Incasso']){
   const context=await browser.newContext({viewport:{width,height:900},timezoneId:'Europe/Rome'}),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
   await page.clock.install({time:new Date('2026-10-21T06:00:00Z')});
   await page.route('**/*',route=>new URL(route.request().url()).hostname==='127.0.0.1'?route.continue():route.fulfill({json:[],headers:{'access-control-allow-origin':'*'}}));
   await page.goto('http://127.0.0.1:5173/tests/visual/agenda-actions.html?agenda=1&agendaDate=2026-10-23&agendaView=giorno');
   const card=page.locator('[data-appointment-id="3"]');await card.evaluate(el=>el.scrollIntoView({block:'center'}));await card.click();
   const menu=page.locator('.agenda-appointment-menu-sheet');await menu.waitFor();
   await page.screenshot({path:`${out}/${engine}-${width}-${action}-menu.png`});
   for(const oldAction of ['WhatsApp','Email','Modifica','Sposta','Elimina'])assert.equal(await menu.getByRole('button',{name:oldAction,exact:true}).count(),1,oldAction);
   await menu.getByRole('button',{name:action,exact:true}).click();
   if(action==='Prestazione'){
    const editor=page.locator('.plan-inline-editor');await editor.getByPlaceholder('Descrizione prestazione').fill('Prestazione manuale di prova');await editor.locator('input[type="number"]').fill('85');await editor.getByRole('button',{name:'Aggiungi',exact:true}).click();
    const row=await page.evaluate(()=>window.__plans[0].voci[0]);assert.equal(row.prezzo,85);assert.equal(row.eseguita,false);assert.equal(row.incassata,false);assert.equal(await page.evaluate(()=>window.__payments.length),0);
   }else if(action==='Ricetta'){
    const field=page.getByPlaceholder('es. Amoxicillina 875mg, Ibuprofene 600mg...');await field.fill('Farmaco di prova');assert.equal(await field.inputValue(),'Farmaco di prova');
   }else if(action==='Documenti'){
    await page.getByText('Documenti medici',{exact:true}).waitFor();await page.getByRole('button',{name:/Richiesta esami diagnostici/}).click();await page.getByText('Quesito clinico / motivazione (opzionale)',{exact:true}).waitFor();
   }else{
    const modal=page.locator('.pol-modal-sheet');await modal.getByText('Registra incasso',{exact:true}).waitFor();await modal.locator('input[type="number"]').fill('25');await modal.getByRole('button',{name:'Salva',exact:true}).click();assert.equal(await page.evaluate(()=>window.__payments[0].pazienteId),7);assert.equal(await page.evaluate(()=>window.__payments[0].importo),25);
   }
   assert.deepEqual(errors,[]);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await page.screenshot({path:`${out}/${engine}-${width}-${action}.png`});await context.close();console.log(`${engine}/${width}/${action}: patient context and existing form OK`);
  }await browser.close();
 }
}finally{server.kill()}
