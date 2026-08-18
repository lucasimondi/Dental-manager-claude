import { createClient } from '@supabase/supabase-js';

const { SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY } = process.env;
if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error('Local Supabase environment variables are required');
}

const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const studioA = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const studioB = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const password = 'Synthetic-POL-002B-Only!42';
const createdUsers = [];
const objectA = '1001/legacy_LABEL_xray.txt';

const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

async function createUser(label, studioId, membership = 'attivo') {
  const email = `pol002b-${label}@example.invalid`;
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    app_metadata: studioId === undefined ? {} : { studio_id: studioId },
  });
  if (error) throw error;
  createdUsers.push(data.user.id);
  if (membership) {
    const { error: membershipError } = await admin.from('studio_users').insert({
      user_id: data.user.id,
      studio_id: studioId || studioA,
      stato: membership,
    });
    if (membershipError) throw membershipError;
  }
  const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: false } });
  const { error: signInError } = await client.auth.signInWithPassword({ email, password });
  if (signInError) throw signInError;
  return client;
}

async function deniedSignedUrl(client, path, label) {
  const { data, error } = await client.storage.from('patient-files').createSignedUrl(path, 300);
  assert(error || !data?.signedUrl, `${label}: signed URL unexpectedly allowed`);
}

async function run() {
  const { error: patientError } = await admin.from('patients').insert([
    { id: 1001, studio_id: studioA },
    { id: 2001, studio_id: studioB },
  ]);
  if (patientError) throw patientError;

  const [a1, a2, b1, inactive, missingMembership, missingClaim, invalidClaim] = await Promise.all([
    createUser('a1', studioA),
    createUser('a2', studioA),
    createUser('b1', studioB),
    createUser('inactive', studioA, 'inattivo'),
    createUser('missing-membership', studioA, null),
    createUser('missing-claim', undefined, null),
    createUser('invalid-claim', 'not-a-uuid', null),
  ]);

  const payload = new Blob(['synthetic patient file'], { type: 'text/plain' });
  const { error: uploadError } = await a1.storage.from('patient-files').upload(objectA, payload);
  assert(!uploadError, `Studio A upload failed: ${uploadError?.message}`);

  const { data: listA1, error: listA1Error } = await a1.storage.from('patient-files').list('1001');
  assert(!listA1Error && listA1.some((item) => item.name === 'legacy_LABEL_xray.txt'), 'Studio A uploader cannot list file');

  const { data: signedA2, error: signedA2Error } = await a2.storage.from('patient-files').createSignedUrl(objectA, 300);
  assert(!signedA2Error && signedA2?.signedUrl, 'Second Studio A member cannot sign file');
  const signedResponse = await fetch(signedA2.signedUrl);
  assert(signedResponse.ok && await signedResponse.text() === 'synthetic patient file', 'Signed URL download failed');

  const { data: listB, error: listBError } = await b1.storage.from('patient-files').list('1001');
  assert(!listBError && listB.length === 0, 'Studio B can list Studio A files');
  await deniedSignedUrl(b1, objectA, 'Studio B');
  for (const [client, label] of [[inactive, 'inactive member'], [missingMembership, 'missing membership'], [missingClaim, 'missing claim'], [invalidClaim, 'invalid claim']]) {
    await deniedSignedUrl(client, objectA, label);
  }
  await deniedSignedUrl(a1, '9999/unknown.txt', 'unknown patient');

  const anon = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: false } });
  await deniedSignedUrl(anon, objectA, 'anonymous user');

  const deniedPayload = new Blob(['denied'], { type: 'text/plain' });
  const { error: crossUploadError } = await b1.storage.from('patient-files').upload('1001/cross.txt', deniedPayload);
  assert(crossUploadError, 'Studio B can upload to Studio A path');
  const { error: crossUpdateError } = await b1.storage.from('patient-files').update(objectA, deniedPayload);
  assert(crossUpdateError, 'Studio B can update Studio A file');
  const { data: crossDeleteData, error: crossDeleteError } = await b1.storage.from('patient-files').remove([objectA]);
  assert(crossDeleteError || crossDeleteData.length === 0, 'Studio B can delete Studio A file');

  const { error: ownUploadError } = await b1.storage.from('patient-files').upload('2001/own.txt', deniedPayload);
  assert(!ownUploadError, `Studio B cannot upload to its own path: ${ownUploadError?.message}`);

  const { data: expiring, error: expiringError } = await a1.storage.from('patient-files').createSignedUrl(objectA, 1);
  assert(!expiringError && expiring?.signedUrl, 'Short signed URL was not created');
  await new Promise((resolve) => setTimeout(resolve, 1500));
  assert(!(await fetch(expiring.signedUrl)).ok, 'Expired signed URL remained usable');

  const { error: deleteAError } = await a2.storage.from('patient-files').remove([objectA]);
  assert(!deleteAError, `Second Studio A member cannot delete file: ${deleteAError?.message}`);
  const { error: deleteBError } = await b1.storage.from('patient-files').remove(['2001/own.txt']);
  assert(!deleteBError, `Studio B cannot delete own file: ${deleteBError?.message}`);

  console.log('POL-002B integration: all synthetic two-tenant checks passed');
}

try {
  await run();
} finally {
  await admin.from('studio_users').delete().in('user_id', createdUsers);
  await admin.from('patients').delete().in('id', [1001, 2001]);
  for (const userId of createdUsers) await admin.auth.admin.deleteUser(userId);
}
