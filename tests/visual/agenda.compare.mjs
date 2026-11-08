import { createRequire } from 'node:module';
const { chromium, webkit } = createRequire(import.meta.url)('playwright');
const { PNG } = createRequire(import.meta.url)('pngjs');
import { mkdir, writeFile, readFile, unlink, rm } from 'node:fs/promises';
import { spawn, execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';
const out = process.env.AGENDA_SCREENSHOTS || 'tests/visual/results';
await mkdir(out, { recursive: true });
const base = process.env.AGENDA_BASE_REF || execFileSync('git', ['merge-base', 'HEAD', 'origin/master']).toString().trim();
// Temporary baseline is always removed: production keeps no copy of the original agenda.
const baseline = 'src/components/__AgendaBaseline.jsx';
const baselineShared = 'shared/__agendaBaseline';
await mkdir(baselineShared, {recursive:true});
// Freeze the shared dependencies too: the baseline must never load modified presentation/CSS.
for (const path of execFileSync('git',['ls-tree','-r','--name-only',base,'shared/agenda']).toString().trim().split('\n').filter(Boolean)) {
  await writeFile(path.replace('shared/agenda',baselineShared),execFileSync('git',['show',`${base}:${path}`]));
}
await writeFile(baseline, execFileSync('git', ['show', `${base}:src/components/Agenda.jsx`]).toString().replaceAll('../../shared/agenda/','../../shared/__agendaBaseline/'));
const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', '5173', '--strictPort'], { stdio: 'ignore' });
for (let i=0;i<50;i++) { try { if ((await fetch('http://127.0.0.1:5173')).ok) break; } catch {} await new Promise(resolve=>setTimeout(resolve,100)); }
const results = [];
const engines = process.env.AGENDA_ENGINES?.split(',') || ['chromium', 'webkit'];
try {
for (const engine of engines) {
  const browser = await ({ chromium, webkit }[engine]).launch(engine === 'chromium' && process.env.CHROMIUM_EXECUTABLE ? { executablePath: process.env.CHROMIUM_EXECUTABLE, args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] } : {});
  for (const [width, height, configured = false] of [[375,812],[390,844],[430,932],[390,844,true]]) {
    for (const view of (configured ? ['settimana'] : ['giorno','settimana','mese'])) {
      const screenshots = {}, measurements = {};
      for (const mode of ['baseline','studio','personal']) {
        const context = await browser.newContext({ viewport: {width,height}, isMobile: true, hasTouch: true, deviceScaleFactor: 1, timezoneId: 'Europe/Rome', locale: 'it-IT' });
        const page = await context.newPage(), errors = [];
        page.on('pageerror', e => errors.push(e.message));
        await page.clock.install({ time: new Date('2026-10-16T05:00:00Z') });
        await page.route('**/*', route => {
          const url = new URL(route.request().url());
          if (url.hostname === '127.0.0.1') return route.continue();
          if (url.pathname.includes('impegni_personali') && route.request().method() === 'POST') {
            const row = route.request().postDataJSON();
            return route.fulfill({ json: { id: 99, ...row }, headers: { 'access-control-allow-origin': '*' } });
          }
          return route.fulfill({ json: [], headers: { 'access-control-allow-origin': '*' } });
        });
        await page.goto(`http://127.0.0.1:5173/tests/visual/agenda.html?mode=${mode}&agenda=1&agendaDate=2026-10-16&agendaView=${view}${configured ? '&configured=1' : ''}`);
        await page.locator('.agenda-mobile-page').waitFor();
        // The merged Studio baseline supports day/view deep links.
        const picker = page.locator('button').filter({ has: page.locator('.agenda-view-picker') });
        await page.waitForTimeout(200);
        assert.deepEqual(errors, [], `${engine}/${width}/${mode}/${view} console`);
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, 'horizontal overflow');
        if (mode !== 'baseline') {
          assert.equal(await page.evaluate(() => {
            const get = selector => document.querySelector(selector)?.getBoundingClientRect();
            const overlap=(a,b) => a && b && a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
            const link=get('.agenda-app-switch'), dock=get('.pp-schede') || get('.poliedron-mobile-dock'), fab=get('.pp-fab') || get('button[aria-label="Nuovo"]');
            return !!(overlap(link,dock) || overlap(link,fab) || overlap(dock,fab));
          }),false,'dock, FAB and app switch overlap');
        }
        if (mode === 'personal') {
          const settings=page.getByRole('button',{name:'Impostazioni',exact:true});
          await settings.waitFor({state:'visible'});
          const r=await settings.boundingBox();
          assert.ok(r && r.y>=0 && r.y+r.height<=height,'settings remains reachable in viewport');
        }
        const path = `${out}/${engine}-${width}-${view}${configured ? '-configured' : ''}-${mode}.png`;
        await page.screenshot({ path, animations: 'disabled' }); screenshots[mode] = path;
        const metrics = await page.evaluate(() => {
          const box = selector => { const e=document.querySelector(selector); if (!e) return null; const r=e.getBoundingClientRect(); return { x:r.x,y:r.y,width:r.width,height:r.height }; };
          return { chrome:box('.agenda-mobile-floating-controls'), dock:box('.poliedron-mobile-dock'), orb:box('.poliedron-orb'), fab:box('button[aria-label="Nuovo"]'), switch:box('.agenda-app-switch'), page:box('.agenda-mobile-page'),strip:box('.agenda-mobile-floating-week-strip'),grid:box('.agenda-time-grid'),gutter:box('.agenda-time-gutter'),month:box('.agenda-mobile-month-surface'),columns:document.querySelectorAll('.agenda-grid-day').length, tones:[...document.querySelectorAll('[data-agenda-tone]')].map(e=>{ const r=e.getBoundingClientRect(); return { x:r.x,y:r.y,width:r.width,height:r.height }; }), blocks:[...document.querySelectorAll('.agenda-time-grid [data-appointment-id]')].map(e=>{ const r=e.getBoundingClientRect(); return { id:e.dataset.appointmentId,x:r.x,y:r.y,width:r.width,height:r.height }; }) };
        });
        measurements[mode] = metrics;
        results.push({ engine,width,height,view,configured,mode,metrics,screenshot:path });
        if (view !== 'mese') {
          await page.locator('.agenda-mobile-calendar-scroller').evaluate(el => { el.scrollTop = el.scrollHeight; });
          assert.ok(await page.locator('.agenda-mobile-calendar-scroller').evaluate(el => el.scrollTop > 0), 'timeline scrolls below dock');
        }
        if (mode === 'personal' && view === 'giorno') {
          await page.locator('.agenda-mobile-calendar-scroller').evaluate(el => el.scrollTop=400);
          await page.locator('[data-appointment-id="10"]').click();
          await page.getByText('Appuntamento dello studio',{exact:true}).waitFor(); await page.getByRole('button',{name:'Chiudi',exact:true}).click();
          await page.getByRole('button',{name:'Aggiungi',exact:true}).click();
          await page.getByPlaceholder('Es. Calcetto, cena, dentista Giulia').fill('Evento di prova');
          await page.getByRole('button',{name:"Aggiungi all'agenda",exact:true}).click();
          await page.waitForFunction(() => window.__message || window.__saveError);
          assert.equal(await page.evaluate(()=>window.__saveError),undefined);
          assert.equal(await page.evaluate(()=>window.__message),"Evento aggiunto all'agenda");
        }
        if (mode === 'personal' && view !== 'mese' && !configured) {
          const initial = await page.evaluate(() => window.__state.day);
          const gesture = async (from, to) => page.locator('.agenda-mobile-grid-surface').evaluate((el, [from,to]) => {
            for (const [name,x] of [['touchstart',from],['touchend',to]]) { const event=new Event(name,{bubbles:true}); Object.assign(event,{touches:[{clientX:x,clientY:400}],changedTouches:[{clientX:x,clientY:400}]}); el.dispatchEvent(event); }
          },[from,to]);
          await gesture(250,100);
          await page.waitForFunction(day=>window.__state.day !== day,initial);
          await gesture(100,250);
          await page.waitForFunction(day=>window.__state.day === day,initial);
          await picker.click(); await page.getByRole('button',{name:'Mese',exact:true}).click();
          await page.locator('.agenda-mobile-month-surface').waitFor();
          await picker.click(); await page.getByRole('button',{name:'Giorno',exact:true}).click();
          assert.ok(await page.locator('.agenda-mobile-calendar-scroller').evaluate(el=>el.clientHeight>0));
        }
        if ((mode === 'studio' || mode === 'baseline') && view === 'giorno') {
          // The original block reads "09:00 Esempio"; Studio now shows the full range and,
          // on its own line, the patient's full name (PR #209). Both must be rendered.
          const block = page.locator('[data-appointment-id="10"]');
          if (mode !== 'baseline') await block.getByText('Paziente Esempio',{exact:true}).waitFor();
          // The baseline is whatever master renders: the old "09:00 Esempio" or the current range.
          const content = mode === 'baseline' ? block.getByText(/^09:00(?: Esempio|–10:30)$/).first() : block.getByText('09:00–10:30',{exact:true});
          await content.click();
          await page.locator('.agenda-appointment-menu-sheet').waitFor();
          // Menu creation remains owned by Studio (no personal clinical actions).
          await page.locator('.agenda-appointment-menu-backdrop').dispatchEvent('click');
        }
        await context.close();
      }
      const geometry = m => Object.fromEntries(Object.entries(m).filter(([key])=>!['switch','tones','chrome','dock','orb','fab'].includes(key)));
      // PO 2026-10-21 explicitly replaces Studio mobile range/motion with Personal.
      // Month stays a strict regression comparison; timeline must now match Personal.
      if (view === 'mese') assert.deepEqual(geometry(measurements.baseline), geometry(measurements.studio), 'Studio month geometry changed');
      else {
        assert.equal(measurements.studio.grid.height, measurements.personal.grid.height, 'same Personal timeline height');
        assert.equal(measurements.studio.gutter.width, measurements.personal.gutter.width, 'same Personal gutter');
        for (const mode of ['studio','personal']) assert.ok(measurements[mode].grid.height >= 48 * 24, 'all 24 hours have readable slots');
      }
      // PO 2026-10-17 ("devi farmi vedere anche le domeniche"): Personal shows all 7 days even when
      // Studio hides closing days; otherwise the shared columns match.
      if (configured && view === 'settimana') assert.equal(measurements.personal.columns, 7, 'Personal week shows every day');
      else assert.equal(measurements.studio.columns, measurements.personal.columns, 'Shared day columns differ');
      // PO requests 24h in Personal with a top app switch; grid height and chrome clearance intentionally differ.
      const original = PNG.sync.read(await readFile(screenshots.baseline)), current = PNG.sync.read(await readFile(screenshots.studio));
      const link = measurements.studio.switch;
      let changed = 0;
      // PO 2026-11-07 (agenda-centrica su telefono): the floating header gained the search row and the iOS
      // month title, and the phone + button left Studio. Those regions are authorized; everything below
      // the header must match the original shifted down by exactly the header growth.
      const chromeBottom = m => (m.chrome ? Math.ceil(m.chrome.y + m.chrome.height) : 0);
      const shift = Math.max(0, chromeBottom(measurements.studio) - chromeBottom(measurements.baseline));
      const inside = (b, x, y, pad=0) => b && x >= Math.floor(b.x)-pad && x <= Math.ceil(b.x+b.width)+pad && y >= Math.floor(b.y)-pad && y <= Math.ceil(b.y+b.height)+pad;
      // Fixed-position chrome (dock, Poliedron orb, the old + button) and the old "Vai a Personal" pill do not scroll with the month.
      const fixedChrome = [measurements.studio.dock, measurements.baseline.dock, measurements.studio.orb, measurements.baseline.orb, measurements.baseline.fab, measurements.baseline.switch];
      for (let y=0;y<height;y++) for(let x=0;x<width;x++) {
        if (y < chromeBottom(measurements.studio) || y - shift < 0) continue;
        if (fixedChrome.some(b => inside(b, x, y, 20) || inside(b, x, y + shift, 20) || inside(b, x, y - shift, 20))) continue;
        // New switch is the only authorized addition to the Studio image (including its shadow).
        if (link && x >= link.x-20 && x <= link.x+link.width+20 && y >= link.y-20 && y <= link.y+link.height+20) continue;
        // PR #209: the text inside each appointment block is the other authorized change
        // ("09:00–10:30" + full name). Its boxes are asserted identical to the original above.
        if (measurements.studio.blocks.some(b => x >= Math.floor(b.x) && x <= Math.ceil(b.x+b.width) && y >= Math.floor(b.y) && y <= Math.ceil(b.y+b.height))) continue;
        // PO 2026-11-03 ("colori etichette … meno opachi, più pro"): label tone badges are the third authorized change; their box size is unchanged.
        // 1px margin: antialiasing of the badge's rounded corners.
        if ((measurements.studio.tones || []).some(b => x >= Math.floor(b.x)-1 && x <= Math.ceil(b.x+b.width)+1 && y >= Math.floor(b.y)-1 && y <= Math.ceil(b.y+b.height)+1)) continue;
        // The header grows by a fractional height, so the shifted content can sit a sub-pixel lower:
        // a pixel only counts as changed if it differs from the matching original row and its two neighbours.
        const i=(y*width+x)*4;
        const differs = (dy, dx=0) => { const oy=y-shift+dy, ox=x+dx; if (oy<0||oy>=height||ox<0||ox>=width) return true; const o=(oy*width+ox)*4; return [0,1,2].some(c=>Math.abs(original.data[o+c]-current.data[i+c])>(shift === 0 ? 2 : 32)); };
        // Moved content is re-rasterised at a sub-pixel offset (rounded corners and shadows differ by up to ~26/255):
        // when shifted, accept a match one pixel away within 32/255. Text, colour or shape changes exceed this widely.
        if (shift === 0 ? differs(0) : [-1,0,1].every(dy => [-1,0,1].every(dx => differs(dy, dx)))) changed++;
      }
      if (view === 'mese') assert.equal(changed,0,`${engine}/${width}/${view}: original Studio month pixels changed outside navigation link`);
      // Personal is reviewed alongside Studio: its 24h range and top link are intentional changes.
      const comparison = new PNG({width:width*3,height});
      for(const [index, mode] of ['baseline','studio','personal'].entries()) {
        const src=PNG.sync.read(await readFile(screenshots[mode]));
        PNG.bitblt(src,comparison,0,0,width,height,index*width,0);
      }
      await writeFile(`${out}/${engine}-${width}-${view}${configured ? '-configured' : ''}-comparison.png`,PNG.sync.write(comparison));
      console.log(`${engine} ${width} ${view}: Studio/Personal 24h timeline; month regression; interactions OK`);
    }
  }
  await browser.close();
}
await writeFile(`${out}/metrics.json`,JSON.stringify(results,null,2));
} finally { server.kill(); await unlink(baseline).catch(()=>{}); await rm(baselineShared,{recursive:true,force:true}); }
