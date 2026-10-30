import test from 'node:test';
import assert from 'node:assert/strict';
import {validateUpload,uploadToCanonicalArchive} from './archive-upload.mjs';
const b64=Buffer.from('test').toString('base64');
const input={filename:'bolletta.pdf',mime:'application/pdf',base64:b64,fascicolo:'utenze',confirm:true};
test('reject without explicit confirmation',()=>assert.throws(()=>validateUpload({...input,confirm:false})));
test('reject clinical documents',()=>assert.throws(()=>validateUpload({...input,fascicolo:'clinico_pazienti'})));
test('reject unsupported MIME',()=>assert.throws(()=>validateUpload({...input,mime:'application/x-msdownload'})));
test('reject oversized document',()=>assert.throws(()=>validateUpload(input,1)));
test('reject invalid base64',()=>assert.throws(()=>validateUpload({...input,base64:'%bad'})));
test('upload uses canonical endpoint payload',async()=>{
 let captured;
 const fetchImpl=async(url,init)=>{captured={url,body:JSON.parse(init.body)};return {ok:true,json:async()=>({ok:true,id:'test'})}};
 const result=await uploadToCanonicalArchive({...input},{endpoint:'https://script.google.com/macros/s/example/exec',fetchImpl,token:'user-jwt'});
 assert.equal(result.uploaded,true);
 assert.equal(result.registered,true);
 assert.equal(captured.body.fascicolo,'utenze');
 assert.equal(captured.body.nome,'bolletta.pdf');
 assert.equal(captured.body.token,'user-jwt');
});
test('server rejects unsuccessful canonical response',async()=>{
 const fetchImpl=async()=>({ok:true,json:async()=>({ok:false,errore:'failed'})});
 await assert.rejects(()=>uploadToCanonicalArchive({...input},{endpoint:'https://script.google.com/macros/s/example/exec',fetchImpl,token:'user-jwt'}));
});
