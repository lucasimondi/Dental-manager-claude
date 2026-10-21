import { chromium, webkit } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
const out='tests/visual/results-motion';
await mkdir(out,{recursive:true});
const server=spawn(process.execPath,['node_modules/vite/bin/vite.js','--host','127.0.0.1','--port','5173','--strictPort'],{stdio:'ignore'});
for(let i=0;i<60;i++){try{if((await fetch('http://127.0.0.1:5173')).ok)break;}catch{}await new Promise(r=>setTimeout(r,100));}
const metrics=[];
try {
 for(const [engine,launcher] of [['chromium',chromium],['webkit',webkit]]){
  const browser=await launcher.launch();
  try {
   for(const mode of ['studio','personal']) for(const width of [375,390,430]){
    const context=await browser.newContext({viewport:{width,height:844},isMobile:engine==='chromium',hasTouch:true,timezoneId:'Europe/Rome',locale:'it-IT'});
    const page=await context.newPage(),errors=[];
    page.on('pageerror',e=>errors.push(e.message));
    await page.route('**/*',r=>new URL(r.request().url()).hostname==='127.0.0.1'?r.continue():r.fulfill({json:[],headers:{'access-control-allow-origin':'*'}}));
    await page.goto(`http://127.0.0.1:5173/tests/visual/agenda.html?mode=${mode}&motion=1&agenda=1&agendaDate=2026-10-16&agendaView=giorno`);
    await page.locator('.agenda-time-grid').waitFor();
    await page.getByRole('button',{name:'Impegno personale tutto il giorno',exact:true}).waitFor();
    const scroller=page.locator('.agenda-mobile-calendar-scroller');
    assert.ok((await page.locator('.agenda-time-gutter').innerText()).includes('23:00'));
    const block=page.locator('[data-appointment-id="10"]');
    await block.scrollIntoViewIfNeeded();
    // A personal event at the same time must have its own visible column.
    const event=page.getByTitle('09:00 · Impegno sovrapposto',{exact:true});
    const eventBox=await event.boundingBox(),appBox=await block.boundingBox();
    assert.ok(eventBox.x+eventBox.width<=appBox.x+2 || appBox.x+appBox.width<=eventBox.x+2,'event is not hidden by appointment');
    const before=await page.evaluate(()=>JSON.stringify(window.__state.appointments));
    const content=block.locator('div').first();
    assert.equal(await content.evaluate(el=>getComputedStyle(el).touchAction),'pan-y');
    let nativeScroll=null;
    if(engine==='chromium'){
      const session=await context.newCDPSession(page);
      await scroller.evaluate(el=>el.scrollTop=300);
      await page.waitForTimeout(100);
      const rect=await block.boundingBox();
      // Put the touch on the appointment itself, away from floating chrome.
      const area=await scroller.boundingBox();
      const target=await block.evaluate(el=>{const s=el.closest('.agenda-mobile-calendar-scroller');s.scrollTop+=el.getBoundingClientRect().y-320;return true;});
      await page.waitForTimeout(100);
      const b=await block.boundingBox(),x=b.x+b.width/2,y=Math.max(250,b.y+Math.min(24,b.height/2));
      const initial=await scroller.evaluate(el=>el.scrollTop);
      await session.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y}]});
      for(let i=1;i<=10;i++){
        await session.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x,y:y-i*12}]});
        await page.waitForTimeout(16);
      }
      await session.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
      await page.waitForTimeout(250);
      nativeScroll=(await scroller.evaluate(el=>el.scrollTop))-initial;
      assert.ok(nativeScroll>40,`native touch must scroll ${mode}: ${nativeScroll}`);
    } else {
      // WebKit uses a narrow touch-capable viewport with native wheel scrolling;
      // mobile WebKit cannot inject wheel/touch gestures through Playwright.
      // Native iPhone touch injection is not claimed here.
      await scroller.evaluate(el=>el.scrollTop=300);
      await page.mouse.move(width/2,450);await page.mouse.wheel(0,150);await page.waitForTimeout(150);
      assert.ok(await scroller.evaluate(el=>el.scrollTop>350));
    }
    assert.equal(await page.evaluate(()=>JSON.stringify(window.__state.appointments)),before,'scroll never moves/writes an appointment');
    // Data refresh must not snap the timeline back to the current hour.
    const position=await scroller.evaluate(el=>el.scrollTop);
    await page.evaluate(()=>window.__fixtureSetEvents(events=>events.map(e=>({...e}))));
    await page.waitForTimeout(100);
    assert.ok(Math.abs((await scroller.evaluate(el=>el.scrollTop))-position)<2);
    await scroller.evaluate(el=>el.scrollTop=el.scrollHeight);
    await page.getByTitle('23:00 · Impegno serale',{exact:true}).waitFor();
    await page.screenshot({path:`${out}/${engine}-${mode}-${width}.png`});
    assert.deepEqual(errors,[]);
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
    metrics.push({engine,mode,width,nativeScroll});
    await context.close();
   }
  }finally{await browser.close();}
 }
 await writeFile(`${out}/metrics.json`,JSON.stringify(metrics,null,2));
 console.log('All-day events, late events, shared scroll, native Chromium touch, no appointment mutation and scroll preservation OK');
}finally{server.kill();}
