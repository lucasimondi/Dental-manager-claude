import { createRequire } from 'node:module';
const { chromium, webkit } = createRequire(import.meta.url)('playwright');
import { mkdir } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import assert from 'node:assert/strict';
const out = 'tests/visual/results-patient-agenda';
await mkdir(out, { recursive: true });
const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', '5173', '--strictPort'], { stdio: 'ignore' });
try {
  for (let i=0;i<80;i++) { try { if ((await fetch('http://127.0.0.1:5173')).ok) break; } catch {} await new Promise(r=>setTimeout(r,100)); }
  for (const engine of (process.env.AGENDA_ENGINES?.split(',') || ['chromium', 'webkit'])) {
    const browser = await ({ chromium, webkit }[engine]).launch(engine === 'chromium' && process.env.CHROMIUM_EXECUTABLE ? { executablePath: process.env.CHROMIUM_EXECUTABLE, args: ['--no-sandbox', '--disable-dev-shm-usage', '--single-process', '--no-zygote', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] } : {});
    for (const width of [375,768,1024,1440]) {
      const context=await browser.newContext({viewport:{width,height:900},timezoneId:'Europe/Rome'}), page=await context.newPage(), errors=[];
      page.on('pageerror',e=>errors.push(e.message));
      await page.clock.install({ time: new Date('2026-10-21T06:00:00Z') });
      await page.route('**/*',route=>new URL(route.request().url()).hostname==='127.0.0.1'?route.continue():route.fulfill({json:[],headers:{'access-control-allow-origin':'*'}}));
      await page.goto('http://127.0.0.1:5173/tests/visual/patient-agenda.html?agenda=1&agendaDate=2026-10-23&agendaView=giorno');
      const record=page.locator('[data-patient-workspace-preserved]');
      await record.getByRole('button',{name:'Anagrafica',exact:true}).click();
      await record.getByText('test@example.invalid',{exact:true}).waitFor();
      await record.evaluate(el=>window.__originalRecord=el.firstElementChild);
      await record.getByRole('button',{name:'Fissa prossimo nell’agenda',exact:true}).click();
      await page.locator('.patient-agenda-booking').waitFor({state:'visible'});
      assert.equal(await record.isVisible(),false);
      assert.equal(await page.locator('.agenda-time-grid').isVisible(),true);
      await page.getByRole('button',{name:'Riapri scheda',exact:true}).first().click();
      await record.getByText('test@example.invalid',{exact:true}).waitFor();
      assert.equal(await record.evaluate(el=>el.firstElementChild===window.__originalRecord),true,'same patient component mounted');
      await record.getByRole('button',{name:'Fissa prossimo nell’agenda',exact:true}).click();
      // Pick a real free cell in the existing production grid.
      const slot=page.locator('[data-agenda-date="2026-10-23"][data-agenda-slot="11:00"]');
      await slot.evaluate(el=>el.scrollIntoView({block:'center'}));
      await page.screenshot({path:`${out}/${engine}-${width}-agenda-compressed.png`});
      await page.evaluate(()=>window.__failSave=true);
      await slot.click();
      await page.getByText('Salvataggio di prova rifiutato',{exact:true}).waitFor();
      assert.equal(await record.isVisible(),false,'failure keeps agenda and draft');
      await page.evaluate(()=>window.__failSave=false);
      await slot.click();
      await record.getByText('test@example.invalid',{exact:true}).waitFor();
      assert.equal(await record.evaluate(el=>el.firstElementChild===window.__originalRecord),true);
      assert.equal(await page.evaluate(()=>window.__appointments.filter(a=>a.id===99).length),1);
      assert.equal(await page.evaluate(()=>window.__writes),2);
      assert.equal(await page.getByText('Salvataggio di prova rifiutato',{exact:true}).count(),0);
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
      assert.deepEqual(errors,[]);
      await page.screenshot({path:`${out}/${engine}-${width}-restored.png`});
      await context.close();console.log(`${engine}/${width}: real agenda, retained patient state, failed save and automatic return OK`);
    }
    await browser.close();
  }
} finally { server.kill(); }
