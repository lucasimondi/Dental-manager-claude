import test from 'node:test';
import assert from 'node:assert/strict';
import { createDefaultHomeLayout, getHomeWidgetIdFromReactKey, moveHomeWidget, normalizeHomeLayout, setHomeWidgetSize, setHomeWidgetVisibility } from '../src/lib/homeWidgetRegistry.js';
import { loadUserHomeLayout, saveUserHomeLayout } from '../src/lib/homeLayoutPersistence.js';
import { readFile } from 'node:fs/promises';

test('registry normalization rejects unknown/duplicate widgets and resets defaults', () => {
  const layout=normalizeHomeLayout([{id:'agenda',visible:false,size:'medium'},{id:'unknown'},{id:'agenda'}]);
  assert.equal(layout[0].id,'agenda'); assert.equal(layout[0].visible,false); assert.equal(layout[0].size,'medium');
  assert.equal(layout.length,createDefaultHomeLayout().length);
});

test('move, add/remove and resize change presentation only', () => {
  let layout=createDefaultHomeLayout();
  layout=moveHomeWidget(layout,'todo','agenda'); assert.equal(layout[0].id,'todo');
  layout=setHomeWidgetVisibility(layout,'economico',true); assert.equal(layout.find(x=>x.id==='economico').visible,true);
  layout=setHomeWidgetSize(layout,'agenda','medium'); assert.equal(layout.find(x=>x.id==='agenda').size,'medium');
  assert.deepEqual(Object.keys(layout[0]).sort(),['id','order','size','visible']);
});

test('workspace resolves the stable registry id from React child keys',()=>{
  assert.equal(getHomeWidgetIdFromReactKey('.$agenda'),'agenda');
  assert.equal(getHomeWidgetIdFromReactKey('todo'),'todo');
});

const fakeClient=(row=null)=>({
  written:null,
  from(){ return {
    select:()=>({eq:()=>({eq:()=>({maybeSingle:async()=>({data:row,error:null})})})}),
    upsert:async(payload)=>{ fake.written=payload; return {error:null}; },
  }; },
});
let fake;
test('persistence always filters and writes explicit studio plus user identity',async()=>{
  fake=fakeClient({layout:[{id:'agenda',visible:true,size:'wide'}]});
  const loaded=await loadUserHomeLayout(fake,'studio-a','user-a'); assert.equal(loaded[0].id,'agenda');
  await saveUserHomeLayout(fake,'studio-a','user-a',loaded);
  assert.equal(fake.written.studio_id,'studio-a'); assert.equal(fake.written.user_id,'user-a');
  assert.deepEqual(Object.keys(fake.written.layout[0]).sort(),['id','order','size','visible']);
  await assert.rejects(()=>loadUserHomeLayout(fake,null,'user-a'));
});

test('desktop and mobile previews share one layout with responsive grid rules',async()=>{
  const css=await readFile(new URL('../src/components/WidgetWorkspace.css',import.meta.url),'utf8');
  const component=await readFile(new URL('../src/components/WidgetWorkspace.jsx',import.meta.url),'utf8');
  assert.match(css,/grid-template-columns:\s*repeat\(12,/);
  assert.match(css,/home-widget-frame--small\s*\{[^}]*span 4/s);
  assert.match(css,/home-widget-frame--medium\s*\{[^}]*span 6/s);
  assert.match(css,/home-widget-frame--wide\s*\{[^}]*1 \/ -1/s);
  assert.match(css,/home-widget-preview--mobile[\s\S]*grid-template-columns:\s*minmax\(0, 1fr\)/);
  assert.match(css,/@media \(max-width:\s*760px\)[\s\S]*grid-column:\s*1 \/ -1/);
  assert.match(component,/home-widget-preview--\$\{previewMode\}/);
  assert.match(component,/data-widget-id=\{item\.id\}/);
});
