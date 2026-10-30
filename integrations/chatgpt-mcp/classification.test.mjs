import test from 'node:test';
import assert from 'node:assert/strict';
import {prepareArchive} from './classification.mjs';
test('utility bill classification',()=>assert.equal(prepareArchive({filename:'bolletta_edison.pdf'}).fascicolo,'utenze'));
test('explicit category',()=>assert.equal(prepareArchive({filename:'documento.pdf',fascicolo:'legale'}).fascicolo,'legale'));
test('unknown category rejected',()=>assert.throws(()=>prepareArchive({filename:'doc.pdf',fascicolo:'unknown'})));
test('clinical document rejected',()=>assert.throws(()=>prepareArchive({filename:'doc.pdf',fascicolo:'clinico_pazienti'})));
test('unsafe filename rejected',()=>assert.throws(()=>prepareArchive({filename:'../secret.pdf'})));
test('proposal never claims upload',()=>assert.equal(prepareArchive({filename:'documento.pdf'}).uploaded,false));
