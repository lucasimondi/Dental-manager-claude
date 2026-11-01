import test from 'node:test';
import assert from 'node:assert/strict';
import {documentoDaPersonal,storicoPersonale,TAG_STORICO,avvisoDocumento,scadenzaIdentita} from '../personal/src/lib/portafoglio.js';
import {personaDi} from '../personal/src/lib/impostazioni.js';
import {cifraCodici,decifraCodici} from '../personal/src/lib/codiciDocumento.js';
import {condividi} from '../personal/src/lib/condividi.js';
test('wallet rejects photos even when classified identity or pinned; keeps current identity docs',()=>{
 assert.equal(documentoDaPersonal({titolo:'Fotografia formato tessera',fascicolo:'identita',tag:['portafoglio']},null),false);
 assert.equal(documentoDaPersonal({fascicolo:'foto_video'},'carta_identita'),false);
 assert.equal(documentoDaPersonal({fascicolo:'identita',tag:[TAG_STORICO]},'carta_identita'),false);
 assert.equal(documentoDaPersonal({fascicolo:'identita'},'carta_identita'),true);
 assert.equal(documentoDaPersonal({fascicolo:'clinico_pazienti'},'carta_identita'),false);
 assert.equal(storicoPersonale({tag:[TAG_STORICO]}),true);
});
test('mixed Luca/Martina scan is not attributed to the first name',()=>{
 const people=['Luca Simondi','Martina Simondi'];
 assert.equal(personaDi({titolo:'CIE Luca Simondi e Martina Simondi'},people),null);
 assert.equal(personaDi({titolo:'CIE Luca e Martina Simondi'},people),null);
 assert.equal(personaDi({titolo:'CIE Martina Simondi'},people),'Martina Simondi');
});
test('expiry alerts use renewal status without payment semantics',()=>{
 assert.equal(avvisoDocumento({dati_estratti:{scadenza_documento:'2026-11-01'}},'2026-11-01').testo,'Scade oggi');
 assert.equal(avvisoDocumento({dati_estratti:{scadenza_documento:'2023-01-23'}},'2026-11-01').stato,'scaduto');
 assert.equal(scadenzaIdentita({categoria:'rinnovo_documento'}),true);
 assert.equal(scadenzaIdentita({documento:{fascicolo:'identita'}}),true);
});
test('PIN/PUK encrypted roundtrip; wrong password and swapping document IDs fail',async()=>{
 const password='synthetic-password-2026';
 const encrypted=await cifraCodici('synthetic-a',{pin:'12345678',puk:'87654321'},password);
 assert.ok(!JSON.stringify(encrypted).includes('12345678'));
 assert.deepEqual(await decifraCodici('synthetic-a',encrypted,password),{pin:'12345678',puk:'87654321'});
 await assert.rejects(()=>decifraCodici('synthetic-a',encrypted,'wrong-password-long'));
 await assert.rejects(()=>decifraCodici('synthetic-b',encrypted,password));
 await assert.rejects(()=>cifraCodici('synthetic-a',{},'short'));
});
test('multiple attachments never degrade to a title-only message',async()=>{
 let called=false;
 const result=await condividi({titolo:'2 docs',files:[{},{}]},{canShare:()=>false,share:()=>{called=true;}});
 assert.equal(result,'non_disponibile');assert.equal(called,false);
});
