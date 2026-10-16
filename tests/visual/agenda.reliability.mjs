// Real Personal page shell, form and Supabase adapter; synthetic durable server across browser contexts.
import { chromium, webkit } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
const out = process.env.AGENDA_SCREENSHOTS || 'tests/visual/results-reliability';
await mkdir(out,{recursive:true});
const server=spawn(process.execPath,['node_modules/vite/bin/vite.js','--host','127.0.0.1','--port','5173','--strictPort'],{stdio:'ignore'});
for(let i=0;i<50;i++){try{if((await fetch('http://127.0.0.1:5173')).ok)break;}catch{}await new Promise(r=>setTimeout(r,100));}
const results=[];
try {
for(const engine of ['chromium','webkit']) {
 const browser=await ({chromium,webkit}[engine]).launch(engine==='chromium'&&process.env.CHROMIUM_EXECUTABLE?{executablePath:process.env.CHROMIUM_EXECUTABLE,args:['--no-sandbox','--disable-dev-shm-usage','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']}:{});
 for(const width of [375,390,430]) {
  const height=width===375?812:width===390?844:932;
  let rows=[],writes=0,fail=false;
  const errors=[];
  const open=async()=>{
   const context=await browser.newContext({viewport:{width,height},isMobile:true,hasTouch:true,deviceScaleFactor:1,locale:'it-IT',timezoneId:'Europe/Rome'});
   await context.route('**/*',async route=>{
    const req=route.request(),url=new URL(req.url());
    if(url.hostname==='127.0.0.1')return route.continue();
    if(req.method()==='OPTIONS')return route.fulfill({status:200,headers:{'access-control-allow-origin':'*','access-control-allow-headers':'*','access-control-allow-methods':'GET,POST,PATCH,DELETE'}});
    if(url.pathname.includes('impegni_personali')) {
     if(req.method()==='POST') {
      writes++; const row=req.postDataJSON();
      if(fail)return route.fulfill({status:503,json:{message:'Salvataggio non disponibile'},headers:{'access-control-allow-origin':'*'}});
      if(!Number.isSafeInteger(row.id))return route.fulfill({status:400,json:{message:'null value in column id violates not-null constraint'},headers:{'access-control-allow-origin':'*'}});
      assert.equal(row.studio_id,'fixture-studio');assert.equal(row.user_id,'fixture-user');
      rows.push(row);return route.fulfill({json:row,headers:{'access-control-allow-origin':'*'}});
     }
     return route.fulfill({json:rows,headers:{'access-control-allow-origin':'*'}});
    }
    return route.fulfill({json:[],headers:{'access-control-allow-origin':'*'}});
   });
   const page=await context.newPage();page.setDefaultTimeout(10000);page.on('pageerror',e=>{errors.push(e.message);console.log('PAGE ERROR',e.message);});
   await page.goto('http://127.0.0.1:5173/tests/visual/agenda.html?mode=personal&reliability=1&agendaView=giorno');
   await page.locator('.agenda-time-grid').waitFor();
   return {context,page};
  };
  let {context,page}=await open();
  // Range, midnight, late-night slots and a top link that can receive pointer events.
  const scroller=page.locator('.agenda-mobile-calendar-scroller');
  const hours=await page.locator('.agenda-time-gutter').innerText();
  for(let h=0;h<24;h++)assert.ok(hours.includes(`${String(h).padStart(2,'0')}:00`),`missing hour ${h}`);
  await scroller.evaluate(el=>el.scrollTop=el.scrollHeight);
  assert.ok(await scroller.evaluate(el=>el.scrollTop>0));
  await page.screenshot({animations:'disabled',path:`${out}/${engine}-${width}-24h.png`});
  const link=page.getByRole('link',{name:/Vai a Studio/});
  assert.ok((await link.boundingBox()).y<200);
  assert.equal(await link.evaluate(el=>{const r=el.getBoundingClientRect();return document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)===el||el.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2));}),true);
  // Scroll a clinic appointment into view and open the production shell, not a fake modal.
  await scroller.evaluate(el=>el.scrollTop=400);
  await page.locator('[data-appointment-id="10"]').click();
  await page.locator('.pp-pagina').waitFor();
  const detail=await page.evaluate(()=>{
   const p=document.querySelector('.pp-pagina'),body=p.querySelector('.pp-pagina-corpo'),dock=document.querySelector('.pp-schede');
   const r=p.getBoundingClientRect(),d=dock.getBoundingClientRect();body.scrollTop=body.scrollHeight;
   return {bottom:r.bottom,dockTop:d.top,scroll:body.scrollTop,scrollable:body.scrollHeight>body.clientHeight,topElement:document.elementFromPoint(innerWidth-50,100)?.closest('.pp-pagina')===p};
  });
  assert.ok(detail.bottom<=detail.dockTop);assert.ok(detail.scrollable&&detail.scroll>0);assert.ok(detail.topElement);
  await page.screenshot({animations:'disabled',path:`${out}/${engine}-${width}-detail.png`});
  const oldStyle=await page.addStyleTag({content:'.pp-pagina {z-index:8;bottom:calc(var(--pp-dock) + env(safe-area-inset-bottom));}'});
  await page.screenshot({animations:'disabled',path:`${out}/${engine}-${width}-detail-before.png`});
  await oldStyle.evaluate(el=>el.remove());
  await page.getByRole('button',{name:'Chiudi',exact:true}).click();
  // Late slot must end at 23:59 rather than wrapping to 00:30 on the same date.
  await scroller.evaluate(el=>el.scrollTop=el.scrollHeight);
  const rect=await page.locator('.agenda-grid-day').boundingBox();
  await page.mouse.click(rect.x+rect.width/2,rect.y+rect.height-12);
  await page.locator('input[type="time"]').first().waitFor();
  assert.equal(await page.locator('input[type="time"]').last().inputValue(),'23:59');
  await page.getByPlaceholder('Es. Calcetto, cena, dentista Giulia').fill('Evento serale persistente');
  // Failed server save keeps the form and entered title, never a success toast.
  fail=true;await page.getByRole('button',{name:"Aggiungi all'agenda",exact:true}).click();
  await page.waitForFunction(()=>window.__saveError);
  assert.equal(await page.locator('.pp-pagina').count(),1);assert.equal(await page.evaluate(()=>window.__message),undefined);
  fail=false;await page.getByRole('button',{name:"Aggiungi all'agenda",exact:true}).click();
  await page.waitForFunction(()=>window.__message==="Evento aggiunto all'agenda");
  assert.equal(rows.length,1);assert.equal(writes,2);
  await context.close(); // erase all React state; server rows remain.
  ({context,page}=await open());
  await page.waitForFunction(()=>window.__state.events.some(e=>e.titolo==='Evento serale persistente'));
  await page.locator('.agenda-mobile-calendar-scroller').evaluate(el=>el.scrollTop=el.scrollHeight);
  await page.getByText('Evento serale persistente',{exact:false}).waitFor({state:'visible'});
  await page.screenshot({animations:'disabled',path:`${out}/${engine}-${width}-reopened.png`});
  assert.deepEqual(errors,[]);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  results.push({engine,width,height,detail,persistedId:rows[0].id,writes,serverRows:rows.length});
  await context.close();console.log(`${engine} ${width}: detail scroll, 24h, failed save and close/reopen OK`);
 }
 await browser.close();
}
await writeFile(`${out}/metrics.json`,JSON.stringify(results,null,2));
} finally{server.kill();}
