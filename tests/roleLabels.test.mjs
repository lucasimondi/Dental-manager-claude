import test from 'node:test';
import assert from 'node:assert/strict';
import { getCapabilityPresentation, getOfferableCapabilities, resolveTeamCapabilities } from '../src/lib/roleLabels.js';

const PHYSIO_ONLY_LABELS = ['Fisioterapista', 'Massoterapista'];
const DENTAL_LABEL = 'Odontoiatra';

test('Dental never sees Physio-only capabilities offered', () => {
  const offered = getOfferableCapabilities('dentistico');
  assert.ok(!offered.includes('clinical.physiotherapist'));
  assert.ok(!offered.includes('clinical.massage_therapist'));
  assert.ok(!offered.includes('clinical.personal_trainer'));
});

test('Dental clinical.general resolves to the Dental label, never a Physio one', () => {
  const { label } = getCapabilityPresentation('clinical.general', 'dentistico');
  assert.equal(label, DENTAL_LABEL);
  assert.ok(!PHYSIO_ONLY_LABELS.includes(label));
});

test('Fisioterapista vertical never surfaces the Dental label for clinical.general', () => {
  const { label } = getCapabilityPresentation('clinical.general', 'fisioterapista');
  assert.notEqual(label, DENTAL_LABEL);
  assert.equal(label, 'Fisioterapista');
});

test('Physio-only capabilities are offered only to the verticals that need them', () => {
  assert.deepEqual(getOfferableCapabilities('fisioterapista'), ['home.front_desk', 'clinical.general', 'clinical.physiotherapist']);
  assert.deepEqual(getOfferableCapabilities('massaggiatore'), ['home.front_desk', 'clinical.general', 'clinical.massage_therapist']);
  assert.deepEqual(getOfferableCapabilities('personal_trainer'), ['home.front_desk', 'clinical.general', 'clinical.personal_trainer']);
  // massofisioterapista is a real dual-capability vertical, not cross-contamination
  assert.deepEqual(getOfferableCapabilities('massofisioterapista'), ['home.front_desk', 'clinical.general', 'clinical.physiotherapist', 'clinical.massage_therapist']);
});

test('universal capabilities (front desk, generic clinical) are offered to every vertical', () => {
  for (const vertical of ['dentistico', 'fisioterapista', 'psicologo', 'medico_chirurgo', 'altro', undefined]) {
    const offered = getOfferableCapabilities(vertical);
    assert.ok(offered.includes('home.front_desk'), `home.front_desk missing for ${vertical}`);
    assert.ok(offered.includes('clinical.general'), `clinical.general missing for ${vertical}`);
  }
});

test('unknown capability falls back to a safe, non-crashing presentation', () => {
  const presentation = getCapabilityPresentation('some.future.capability', 'dentistico');
  assert.equal(typeof presentation.label, 'string');
  assert.ok(presentation.label.length > 0);
});

test('unknown vertical falls back to the default label, not a crash or blank', () => {
  const { label } = getCapabilityPresentation('clinical.general', 'some_future_vertical');
  assert.equal(label, 'Collaboratore clinico');
});

test('resolveTeamCapabilities never hides an already-held capability, even out of the vertical\'s normal scope', () => {
  // Studio vertical is Dental, but the user still holds a Physio capability
  // (e.g. vertical changed after the grant) — must stay visible, not be
  // silently dropped, so the admin can see and revoke it.
  const resolved = resolveTeamCapabilities('dentistico', ['clinical.physiotherapist']);
  assert.ok(resolved.includes('clinical.physiotherapist'));
  assert.ok(resolved.includes('home.front_desk'));
});

test('resolveTeamCapabilities does not duplicate a held capability that is already offered', () => {
  const resolved = resolveTeamCapabilities('dentistico', ['clinical.general']);
  assert.equal(resolved.filter((c) => c === 'clinical.general').length, 1);
});
