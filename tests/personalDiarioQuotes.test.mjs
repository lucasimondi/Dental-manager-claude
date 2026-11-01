import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DIARY_AUTHORS, DIARY_ERAS, DIARY_QUOTES, assignDiaryQuotes, filterDiaryQuotes, quoteForPage, quoteKindLabel, quoteText, selectDiaryQuote } from '../personal/src/lib/diarioQuotes.js';
import { loadDiary, savePage, PREFIX } from '../personal/src/lib/diario.js';
const pages = (n) => Array.from({length:n},(_,i)=>({id:`p-${String(i).padStart(4,'0')}`,order:i,blocks:[]}));

test('catalogue has unique permanent IDs/texts, attributed primary works and eras', () => {
  assert(DIARY_QUOTES.length >= 160); assert(DIARY_AUTHORS.length >= 30);
  assert.equal(new Set(DIARY_QUOTES.map(q=>q.id)).size,DIARY_QUOTES.length);
  assert.equal(new Set(DIARY_QUOTES.map(q=>q.text.toLocaleLowerCase('it'))).size,DIARY_QUOTES.length);
  for(const q of DIARY_QUOTES) {
    assert(DIARY_ERAS[q.era]); assert(q.school && q.theme && q.author && q.work);
    assert.equal(new URL(q.source).protocol,'https:');
    assert(['translation','thought'].includes(q.kind));
    assert(quoteKindLabel(q));
    assert.equal(quoteText(q).startsWith('“'),q.kind==='translation');
  }
  assert.equal(new Set(DIARY_QUOTES.map(q=>q.era)).size,6);
});
test('all legacy pages receive different quotes, independent of input ordering without mutation', () => {
  const input=pages(150), before=JSON.stringify(input), result=assignDiaryQuotes(input);
  assert.equal(new Set(result.map(p=>quoteForPage(p).text)).size,150);
  assert.equal(JSON.stringify(input),before);
  const reordered=assignDiaryQuotes([...input].reverse());
  assert.deepEqual(Object.fromEntries(result.map(p=>[p.id,p.quoteId])),Object.fromEntries(reordered.map(p=>[p.id,p.quoteId])));
  assert.equal(new Set(result.slice(0,6).map(p=>quoteForPage(p).era)).size,6);
});
test('new/continuation pages and edits preserve existing pins; duplicate pins get repaired', () => {
  const original=assignDiaryQuotes(pages(40));
  const result=assignDiaryQuotes([{id:'fresh-between',blocks:[]},...original.map(p=>({...p,blocks:[{text:'modifica'}]}))]);
  for(const p of original) assert.equal(result.find(r=>r.id===p.id).quoteId,p.quoteId);
  assert.equal(new Set(result.map(p=>p.quoteId)).size,41);
  const collision=assignDiaryQuotes([{id:'a',quoteId:DIARY_QUOTES[0].id}, {id:'b',quoteId:DIARY_QUOTES[0].id}, {id:'c',quoteId:'unknown'}]);
  assert.equal(collision[0].quoteId,DIARY_QUOTES[0].id);
  assert.equal(new Set(collision.map(p=>p.quoteId)).size,3);
});
test('exhausted catalogue never cycles or invents a philosopher quote', () => {
  const result=assignDiaryQuotes(pages(1000)), assigned=result.filter(p=>p.quoteId);
  assert.equal(assigned.length,DIARY_QUOTES.length);
  assert.equal(new Set(assigned.map(p=>p.quoteId)).size,DIARY_QUOTES.length);
  assert.equal(result.filter(p=>!quoteForPage(p)).length,1000-DIARY_QUOTES.length);
});
test('manual choice cannot duplicate another page and survives JSON save/load', async () => {
  const resolved=assignDiaryQuotes(pages(2)), selected=DIARY_QUOTES.find(q=>!resolved.some(p=>p.quoteId===q.id));
  assert.throws(()=>selectDiaryQuote(resolved,resolved[1].id,resolved[0].quoteId),/già/);
  assert.throws(()=>selectDiaryQuote(resolved,'absent',selected.id),/pagina/);
  assert.throws(()=>selectDiaryQuote(resolved,resolved[0].id,'absent'),/disponibile/);
  const chosen=selectDiaryQuote(resolved,resolved[0].id,selected.id); assert.equal(resolved[0].quoteId!==selected.id,true);
  let row;
  const db={from(){return {insert(r){row=structuredClone(r);return this},select(){return this},maybeSingle:async()=>({data:{aggiornato_il:row.aggiornato_il}}),like(){return this},order(){return this},range:async()=>({data:[row]})}}};
  await savePage(db,chosen[0]); assert.equal(row.chiave,PREFIX+chosen[0].id);
  const restored=assignDiaryQuotes(await loadDiary(db));
  assert.equal(quoteForPage(restored[0]),selected);
});
test('filters intersect era/current/theme/search, tolerate accents, and preserve catalogue', () => {
  const old=JSON.stringify(DIARY_QUOTES);
  const stoics=filterDiaryQuotes({era:'antichita',school:'Stoicismo',theme:'Tempo'});
  assert(stoics.length>0); assert(stoics.every(q=>q.era==='antichita'&&q.school==='Stoicismo'&&q.theme==='Tempo'));
  assert(filterDiaryQuotes({query:'rene DESCARTES'}).every(q=>q.authorId==='descartes'));
  assert.equal(filterDiaryQuotes({query:'rene DESCARTES'}).length,5);
  assert.equal(filterDiaryQuotes({era:'novecento',school:'Stoicismo'}).length,0);
  assert.equal(filterDiaryQuotes({query:'noncorrisponde'}).length,0);
  assert.equal(JSON.stringify(DIARY_QUOTES),old);
});
test('single-page export resolves against the whole diary and honors selected quote IDs', async () => {
  const {renderDiarySheets}=await import('../personal/src/lib/diarioExport.js');
  const source=pages(3), resolved=assignDiaryQuotes(source);
  const chosen=DIARY_QUOTES.find(q=>q.id==='wittgenstein-3');
  const selected=selectDiaryQuote(resolved,resolved[1].id,chosen.id);
  const draw=async(input,indexes)=>{
    const text=[];
    for await(const sheet of renderDiarySheets(input,indexes,{
      createCanvas(){return {getContext:()=>({createLinearGradient:()=>({addColorStop(){}}),fillRect(){},beginPath(){},moveTo(){},lineTo(){},stroke(){},fillText(t){text.push(t)},measureText:t=>({width:t.length*5})})}},encode:async()=>new Uint8Array([1]),
    }))void sheet;
    return text;
  };
  const single=await draw(selected,[1]), all=await draw(selected,[0,1,2]);
  assert(single.includes(quoteText(chosen)));assert(all.includes(quoteText(chosen)));
  const legacy=await draw(source,[1]);assert(legacy.includes(quoteText(quoteForPage(resolved[1]))));
});
