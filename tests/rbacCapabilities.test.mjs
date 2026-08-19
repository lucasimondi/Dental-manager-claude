import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { buildHomePermissions, createRolePresetLayout, normalizeHomeRole } from '../src/lib/homeDashboardModel.js';

const active = (capabilities) => ({ ruolo:'utente',stato:'attivo',capabilities });

test('authoritative capabilities select presets without role or vertical inference',()=>{
  assert.equal(normalizeHomeRole(['home.owner']),'owner');
  assert.equal(normalizeHomeRole(['home.front_desk']),'front_desk');
  assert.equal(normalizeHomeRole(['clinical.physiotherapist']),'clinician_fisio');
  assert.equal(normalizeHomeRole([]),null);
  assert.equal(createRolePresetLayout([]),null);
  const source=fs.readFileSync('src/lib/homeDashboardModel.js','utf8');
  assert.doesNotMatch(source,/ruolo\s*===|vertical.*fisioterapista/);
});

test('owner is management-enabled but not clinical without explicit capability',()=>{
  const permissions=buildHomePermissions({membership:active(['home.owner','finance.management.read']),features:{controllo_gestione:true},vertical:'fisioterapista'});
  assert.equal(permissions.managementControl,true);
  assert.equal(permissions.clinicalContent,false);
  assert.equal(permissions.physioFullAccess,false);
});

test('front desk has no clinical or financial access',()=>{
  const permissions=buildHomePermissions({membership:active(['home.front_desk']),features:{controllo_gestione:true},vertical:'fisioterapista'});
  assert.equal(permissions.managementControl,false);
  assert.equal(permissions.clinicalContent,false);
});

test('physiotherapist, PT and massage therapist receive only their explicit access tier',()=>{
  const physio=buildHomePermissions({membership:active(['clinical.physiotherapist']),features:{},vertical:'fisioterapista'});
  const pt=buildHomePermissions({membership:active(['clinical.personal_trainer']),features:{},vertical:'fisioterapista'});
  const massage=buildHomePermissions({membership:active(['clinical.massage_therapist']),features:{},vertical:'fisioterapista'});
  assert.equal(physio.physioFullAccess,true);
  assert.equal(pt.physioFullAccess,false); assert.equal(pt.physioOperationalAccess,true);
  assert.equal(massage.physioFullAccess,false); assert.equal(massage.physioOperationalAccess,true);
});

test('multi-role combinations are additive and suspended membership is fail closed',()=>{
  const multi=buildHomePermissions({membership:active(['home.front_desk','clinical.personal_trainer','clinical.massage_therapist']),features:{},vertical:'fisioterapista'});
  assert.equal(multi.physioOperationalAccess,true);
  assert.equal(normalizeHomeRole(multi.capabilities),'clinician_fisio');
  const suspended=buildHomePermissions({membership:{stato:'sospeso',capabilities:['clinical.physiotherapist','finance.management.read']},features:{controllo_gestione:true},vertical:'fisioterapista'});
  assert.equal(suspended.physioFullAccess,false); assert.equal(suspended.managementControl,false);
});

test('operational Fisio UI never queries evaluations or mounts plan editors',()=>{
  const source=fs.readFileSync('src/components/PhysioCartella.jsx','utf8');
  assert.match(source,/fullAccess \? supabase\.from\('physio_valutazioni'\)/);
  assert.match(source,/!fullAccess && sub === 'percorso'/);
  assert.match(source,/fullAccess && sub === 'obiettivi'/);
  assert.match(source,/fullAccess && sub === 'domiciliare'/);
});
