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

test('POL-RBAC-001A: Team del percorso reads the data-minimized roster RPC, never selects the base table directly, and never sends created_by from the client',()=>{
  const source=fs.readFileSync('src/components/PhysioCartella.jsx','utf8');
  // Product Owner decision: a PT/massage teammate must only ever see
  // identity/role/status (id,user_id,assignment_type,active) for their
  // patient's active team, never the raw table (which also carries
  // created_by/timestamps/reason) -- so the roster read must go through
  // patient_care_team_roster_v1, and the raw table must never be selected
  // from directly anywhere in this file.
  assert.match(source,/supabase\.rpc\('patient_care_team_roster_v1', ?\{ ?p_studio_id: ?studio_id, ?p_patient_id: ?paziente_id ?\}\)/);
  assert.doesNotMatch(source,/supabase\.from\('patient_care_assignments'\)\.select/,'the roster must never be read via a raw table select -- use the data-minimized RPC');
  const insertBlock=source.match(/supabase\.from\('patient_care_assignments'\)\.insert\(\{[\s\S]*?\}\)/);
  assert.ok(insertBlock,'assignment insert call is present');
  assert.doesNotMatch(insertBlock[0],/created_by/,'created_by must be server-enforced, never client-supplied');
});

test('POL-RBAC-001A: team management actions are gated by canManageTeam, never unconditionally rendered',()=>{
  const source=fs.readFileSync('src/components/PhysioCartella.jsx','utf8');
  assert.match(source,/canManageTeam && \(/);
  assert.match(source,/Gestisci team/);
  assert.match(source,/Assegna professionista/);
});

test('POL-RBAC-001A: canManageTeam is derived from capability (physiotherapist/admin), never from assignment or patient count',()=>{
  const source=fs.readFileSync('src/components/SchedaPaz.jsx','utf8');
  if (source.includes('<PhysioCartella')) {
    assert.match(source,/const canManagePhysioTeam = physioFullAccess \|\| isStudioAdmin === true;/);
    assert.doesNotMatch(source,/canManagePhysioTeam[\s\S]{0,80}patient_care_assignments/);
  } else {
    // Production recovery deliberately suspends the Fisio mount; no hidden
    // team-management surface or alternative authorization path may remain.
    assert.doesNotMatch(source,/canManagePhysioTeam|patient_care_assignments/);
  }
});

test('POL-RBAC-001A: assignment picker only offers capability-matching, same-studio collaborators',()=>{
  const source=fs.readFileSync('src/components/PhysioCartella.jsx','utf8');
  assert.match(source,/supabase\.from\('studio_user_capabilities'\)\.select\('user_id,capability'\)\.eq\('studio_id', ?studio_id\)/);
  assert.match(source,/e\.capability === capability && !giaAssegnati\.has\(e\.user_id\)/);
});
