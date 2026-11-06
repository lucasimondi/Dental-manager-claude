import {createRequire} from 'node:module';
const {chromium}=createRequire(import.meta.url)('playwright');
import {mkdir} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import assert from 'node:assert/strict';
// HOME-AGENDA-CENTRIC — verifica visiva della Home "Oggi" con dati sintetici.
const out='tests/visual/results-home';await mkdir(out,{recursive:true});
const server=spawn(process.execPath,['node_modules/vite/bin/vite.js','--host','127.0.0.1','--port','5174','--strictPort'],{stdio:'ignore'});
try{
 for(let i=0;i<100;i++){try{if((await fetch('http://127.0.0.1:5174')).ok)break}catch{}await new Promise(r=>setTimeout(r,100))}
 const browser=await chromium.launch(process.env.PW_CHROMIUM?{executablePath:process.env.PW_CHROMIUM}:{});
 for(const theme of ['light','dark'])for(const width of [375,768,1024,1440]){
  const context=await browser.newContext({viewport:{width,height:900},timezoneId:'Europe/Rome',deviceScaleFactor:1}),page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));await page.emulateMedia({reducedMotion:'reduce'});
  await page.clock.install({time:new Date('2026-11-06T09:40:00Z')});
  await page.route('**/*',route=>new URL(route.request().url()).hostname==='127.0.0.1'?route.continue():route.fulfill({json:[],headers:{'access-control-allow-origin':'*'}}));
  await page.goto(`http://127.0.0.1:5174/tests/visual/home.html?theme=${theme}`);
  const agenda=page.getByRole('region',{name:'Agenda di oggi'});await agenda.waitFor();
  assert.equal(await agenda.locator('.home-oggi__ev').count(),9);
  assert.equal(await page.locator('.home-oggi__ev--now').count(),1,'one appointment is in progress at 10:40');
  const now=page.getByRole('region',{name:'In poltrona ora'});
  assert.equal(await now.getByText('Maria Rossa').isVisible(),true);
  for(const label of ['Prestazione','Ricetta','Documenti','Incasso'])assert.equal(await now.getByRole('button',{name:label,exact:true}).isVisible(),true);
  await now.getByRole('button',{name:'Ricetta',exact:true}).click();
  await page.getByRole('button',{name:'Agenda',exact:true}).click();
  await page.getByRole('button',{name:/Cerca con Poliedron/}).click();
  const actions=await page.evaluate(()=>window.__actions);
  assert.deepEqual(actions.slice(-3),[['action',2,101,'prescription'],['agenda'],['search']]);
  assert.equal(await page.locator('[data-widget-id="quick_actions"],[data-widget-id="agenda"],[data-widget-id^="fin_"]').count(),0,'no replaced or financial widgets on Home');
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);
  assert.ok(overflow<=0,`no horizontal overflow at ${width} (${overflow}px)`);
  assert.deepEqual(errors,[]);
  await page.screenshot({path:`${out}/home-${theme}-${width}.png`});
  await context.close();
 }
 const context=await browser.newContext({viewport:{width:1440,height:900},timezoneId:'Europe/Rome'}),page=await context.newPage();
 await page.clock.install({time:new Date('2026-11-06T09:40:00Z')});
 await page.route('**/*',route=>new URL(route.request().url()).hostname==='127.0.0.1'?route.continue():route.fulfill({json:[],headers:{'access-control-allow-origin':'*'}}));
 await page.goto('http://127.0.0.1:5174/tests/visual/home.html?empty=1');
 await page.getByText('La giornata è libera.').waitFor();
 await page.screenshot({path:`${out}/home-empty-1440.png`});
 await browser.close();
 console.log('home visual: ok');
}finally{server.kill()}
