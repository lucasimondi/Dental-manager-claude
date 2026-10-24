import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { spawn } from 'node:child_process';
import assert from 'node:assert/strict';
const base=process.env.CONNECTOR_QA_URL||'http://127.0.0.1:4179';
const vite = process.env.CONNECTOR_QA_URL ? null : spawn(process.execPath, ['node_modules/vite/bin/vite.js','--host','127.0.0.1','--port','4179'], { stdio:'ignore' });
let ready = false;
for (let i=0;i<100;i++){try{if((await fetch(base)).ok){ready=true;break}}catch{}await new Promise(r=>setTimeout(r,100));}
if(!ready){vite?.kill();throw new Error('Vite did not start');}
const browser=await chromium.launch(process.env.CONNECTOR_CHROMIUM?{executablePath:process.env.CONNECTOR_CHROMIUM,args:['--no-sandbox','--disable-dev-shm-usage','--disable-gpu']}:{});
const folder=process.env.CONNECTOR_QA_OUTPUT||'/tmp/poliedra-connector-screens';mkdirSync(folder,{recursive:true});
try{
 for(const width of[375,768,1024,1440]){
  const page=await browser.newPage({viewport:{width,height:900}});const errors=[];page.setDefaultTimeout(8000);page.on('console',m=>{if(m.type()==='error') console.log(m.text())});page.on('response',r=>{if(r.status()>=400)console.log('HTTP '+r.status()+' '+r.url())});page.on('pageerror',e=>{errors.push(e.message);console.log('Page error: '+e.message)});
  await page.route('**/.well-known/oauth-protected-resource/api/mcp',r=>r.fulfill({json:{resource:'https://clinic.example/api/mcp'}}));
  await page.route('https://idklxdqebfceplrualgh.supabase.co/**',r=>r.abort());
  for(const scenario of['consent','review','setup','uncertain']){
   await page.goto(`${base}/tests/visual/connector.fixture.html?case=${scenario}`);await page.locator('h1').waitFor();
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,`overflow ${scenario}/${width}`);
   if(scenario==='review'||scenario==='uncertain'){
    const button=page.getByRole('button',{name:'Conferma e registra'});await button.waitFor();await page.evaluate(()=>scrollTo(0,0));await page.waitForTimeout(80);await page.screenshot({path:`${folder}/${width}-${scenario}.png`,fullPage:true});
    const size=await button.boundingBox();assert.ok(size.height>=44&&size.width>=120);
    await button.evaluate(b=>{b.click();b.click()});await page.getByText(scenario==='review'?'Registrazione completata. Puoi tornare alla chat.':'Esito da verificare nella scheda paziente. Non ripetere automaticamente.').waitFor();
    assert.equal(await page.evaluate(()=>window.__connectorCalls),1,'double tap wrote twice');assert.equal(await button.count(),0);
   }else{
    await page.getByText('ChatGPT di prova',{exact:true}).waitFor();
    await page.evaluate(()=>scrollTo(0,0));await page.waitForTimeout(80);await page.screenshot({path:`${folder}/${width}-${scenario}.png`,fullPage:true});
    if(scenario==='setup'){await page.getByRole('button',{name:'Revoca accesso'}).click();await page.getByText('Nessun accesso esterno disponibile.').waitFor();}
   }
  }
  assert.deepEqual(errors,[]);await page.close();console.log(`Connector UI ${width}: consent/review/revoke/uncertain pass`);
 }
}finally{await browser.close();vite?.kill()}
