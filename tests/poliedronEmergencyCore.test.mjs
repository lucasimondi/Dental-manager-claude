import test from 'node:test';import assert from 'node:assert/strict';import { emergencyIntent,emergencyMessage } from '../supabase/functions/agente-assistente/emergency.js';
test('emergency core blocks writes',()=>{assert.equal(emergencyIntent('crea appuntamento domani alle 15').kind,'blocked_write')});
test('agenda today is deterministic read',()=>{assert.deepEqual(emergencyIntent('agenda oggi').tool,'appuntamenti');assert.equal(emergencyIntent('agenda oggi').input.relative_day,0)});
test('agenda tomorrow is deterministic read',()=>{assert.equal(emergencyIntent('fammi vedere gli appuntamenti domani').input.relative_day,1)});
test('patient search is read only',()=>{const x=emergencyIntent('cerca paziente Mario Rossi');assert.equal(x.tool,'cerca_pazienti');assert.equal(x.input.query,'mario rossi')});
test('economic query uses canonical KPI tool',()=>{assert.equal(emergencyIntent('qual è il fatturato questo mese').tool,'kpi_controllo_gestione')});
test('unknown language does not guess',()=>{assert.equal(emergencyIntent('organizza meglio la giornata'),null);assert.match(emergencyMessage(null),/temporaneamente indisponibili/)});
