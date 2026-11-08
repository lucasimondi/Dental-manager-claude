import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';

// Motore PostgreSQL isolato; mai un account remoto. PO 2026-11-08: registro password privato.
test('password_personali migration: owner-only rows, two tenants, fixed authorship, anon denied', async () => {
  const db = new PGlite();
  try {
    await db.exec(`create role anon;create role authenticated;create schema auth;
    create function auth.jwt() returns jsonb language sql stable as $$select current_setting('request.jwt.claims',true)::jsonb$$;
    create function auth.uid() returns uuid language sql stable as $$select (auth.jwt()->>'sub')::uuid$$;
    grant usage on schema auth to authenticated,anon;`);
    await db.exec(readFileSync(new URL('../supabase/migrations/20261108120000_password_personali.sql', import.meta.url), 'utf8'));
    const A = '11111111-1111-1111-1111-111111111111', B = '22222222-2222-2222-2222-222222222222';
    const U1 = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', U2 = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
    const as = async (sub, studio) => { await db.exec('reset role'); await db.query("select set_config('request.jwt.claims',$1,false)", [JSON.stringify({ sub, app_metadata: { studio_id: studio } })]); await db.exec('set role authenticated'); };
    const count = async () => (await db.query('select count(*)::int n from password_personali')).rows[0].n;

    await as(U1, A);
    await db.query("insert into password_personali(studio_id,titolo,utente,segreto,sito) values($1,'Banca','luca','s3greta!','banca.it')", [A]);
    assert.equal(await count(), 1);
    assert.equal((await db.query('select segreto from password_personali')).rows[0].segreto, 's3greta!', 'l\'autore la vede');
    await assert.rejects(() => db.query("insert into password_personali(studio_id,titolo) values($1,'x')", [B]), /row-level security/);
    await assert.rejects(() => db.query("insert into password_personali(studio_id,user_id,titolo) values($1,$2,'x')", [A, U2]), /row-level security/);
    await assert.rejects(() => db.query("insert into password_personali(studio_id,titolo) values($1,'  ')", [A]), /check constraint/);
    await db.exec("update password_personali set segreto='nuova', updated_at=now()");
    await assert.rejects(() => db.query('update password_personali set user_id=$1', [U2]), /permission denied/);
    await assert.rejects(() => db.query('update password_personali set studio_id=$1', [B]), /permission denied/);

    // Collega dello stesso studio e altro studio: nessuna riga visibile né modificabile.
    await as(U2, A);
    assert.equal(await count(), 0);
    assert.equal((await db.query("update password_personali set segreto='x' returning id")).rows.length, 0);
    assert.equal((await db.query('delete from password_personali returning id')).rows.length, 0);
    await as(U1, B);
    assert.equal(await count(), 0);

    await as(U1, A);
    assert.equal((await db.query('select segreto from password_personali')).rows[0].segreto, 'nuova');
    assert.equal((await db.query('delete from password_personali returning id')).rows.length, 1);
    await db.exec('reset role');
    await db.exec('set role anon');
    await assert.rejects(() => db.exec('select * from password_personali'), /permission denied/);
    await db.exec('reset role');
    assert.equal((await db.query("select relrowsecurity from pg_class where oid='public.password_personali'::regclass")).rows[0].relrowsecurity, true);
  } finally { await db.close(); }
});
