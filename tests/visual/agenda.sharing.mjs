import { chromium, webkit } from 'playwright';
import { spawn } from 'node:child_process';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js','--host','127.0.0.1','--port','5173','--strictPort'],{stdio:'ignore'});
for(let i=0;i<60;i++){try{if((await fetch('http://127.0.0.1:5173')).ok)break;}catch{}await new Promise(r=>setTimeout(r,100));}
await mkdir('tests/visual/results-sharing',{recursive:true});
try {
 for(const [engine, launcher] of [['chromium',chromium],['webkit',webkit]]){
  const browser=await launcher.launch();
  try{
   for(const mode of ['studio','personal']){
    for(const excluded of [false,true]){
     const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,timezoneId:'Europe/Rome',locale:'it-IT'});
     const page=await context.newPage(),errors=[];
     page.on('pageerror',e=>errors.push(e.message));
     await page.clock.install({time:new Date('2026-10-16T05:00:00Z')});
     await page.route('**/*',route=>new URL(route.request().url()).hostname==='127.0.0.1'
       ?route.continue():route.fulfill({json:[],headers:{'access-control-allow-origin':'*'}}));
     await page.goto(`http://127.0.0.1:5173/tests/visual/agenda.html?mode=${mode}&agenda=1&agendaDate=2026-10-16&agendaView=settimana_lavoro&configured=1&sharing=1${excluded?'&excluded=1':''}`);
     await page.locator('.agenda-mobile-page').waitFor();
     await page.waitForTimeout(200);
     assert.equal(await page.locator('.agenda-grid-day').count(),excluded?5:6,`${engine} ${mode} occupied Sunday`);
     if(excluded){
      assert.equal(await page.locator('[data-appointment-id="18"]').count(),0);
      await page.locator('button').filter({has:page.locator('.agenda-view-picker')}).click();
      await page.getByRole('button',{name:'Mostra eventi esclusi da questa agenda',exact:true}).click();
      await page.waitForFunction(()=>document.querySelectorAll('.agenda-grid-day').length===6);
     }
     assert.equal(await page.locator('[data-appointment-id="18"]').count(),1);
     assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
     await page.screenshot({path:`tests/visual/results-sharing/${engine}-${mode}-${excluded?'excluded':'shared'}.png`});
     if(mode==='personal'){
      await page.locator('[data-appointment-id="18"]').click();
      const choices=page.getByRole('group',{name:'Mostra nelle agende'});
      await choices.waitFor();
      const studio=choices.getByRole('checkbox',{name:'Studio',exact:true});
      const personal=choices.getByRole('checkbox',{name:'Personal',exact:true});
      // Normal events open with both choices selected.
      if(!excluded){assert.equal(await studio.isChecked(),true);assert.equal(await personal.isChecked(),true);}
     }
     assert.deepEqual(errors,[]);
     await context.close();
    }
   }
  }finally{await browser.close();}
 }
 console.log('Occupied Sundays, excluded-entry recovery and shared visibility editor: Chromium/WebKit OK');
} finally {server.kill();}
