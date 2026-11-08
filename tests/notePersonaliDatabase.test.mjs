import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';

// Motore PostgreSQL isolato, baseline minima; mai un account remoto.
test('note_personali migration: two tenants, owner-only rows, patient link in the same studio, fixed authorship', async () => {
  const db = new PGlite();
  try {
    await db.exec(`create role anon;create role authenticated;create schema auth;
    create function auth.jwt() returns jsonb language sql stable as $$select current_setting('request.jwt.claims',true)::jsonb$$;
    create function auth.uid() returns uuid language sql stable as $$select (auth.jwt()->>'sub')::uuid$$;
    grant usage on schema auth to authenticated,anon;
    create table public.patients(id bigint primary key,studio_id uuid not null);
    alter table patients enable row level security;
    create policy patients_studio on patients using(studio_id=(auth.jwt()->'app_metadata'->>'studio_id')::uuid);
    grant select on patients to authenticated;
    insert into patients values(1,'11111111-1111-1111-1111-111111111111'),(2,'22222222-2222-2222-2222-222222222222');`);
    await db.exec(readFileSync(new URL('../supabase/migrations/20261107120000_note_personali.sql', import.meta.url), 'utf8'));
    const A = '11111111-1111-1111-1111-111111111111', B = '22222222-2222-2222-2222-222222222222';
    const U1 = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', U2 = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
    const as = async (sub, studio) => { await db.exec('reset role'); await db.query("select set_config('request.jwt.claims',$1,false)", [JSON.stringify({ sub, app_metadata: { studio_id: studio } })]); await db.exec('set role authenticated'); };
    const count = async () => (await db.query('select count(*)::int n from note_personali')).rows[0].n;

    await as(U1, A);
    await db.query("insert into note_personali(studio_id,testo,area) values($1,'Chiedere seconda poltrona','idee')", [A]);
    await db.query("insert into note_personali(studio_id,testo,area,paziente_id) values($1,'Preferisce la mattina','studio',1)", [A]);
    assert.equal(await count(), 2);
    // Paziente di un altro studio, studio diverso dal JWT, autore diverso: rifiutati.
    await assert.rejects(() => db.query("insert into note_personali(studio_id,testo,paziente_id) values($1,'x',2)", [A]), /row-level security/);
    await assert.rejects(() => db.query("insert into note_personali(studio_id,testo) values($1,'x')", [B]), /row-level security/);
    await assert.rejects(() => db.query("insert into note_personali(studio_id,user_id,testo) values($1,$2,'x')", [A, U2]), /row-level security/);
    await assert.rejects(() => db.query("insert into note_personali(studio_id,testo) values($1,'   ')", [A]), /check constraint/);
    await assert.rejects(() => db.query("insert into note_personali(studio_id,testo,area) values($1,'x','clinica')", [A]), /check constraint/);
    // Modifica del contenuto sì; autore e studio no.
    await db.exec("update note_personali set fissata=true, testo='Chiedere la seconda poltrona' where area='idee'");
    await assert.rejects(() => db.query('update note_personali set user_id=$1', [U2]), /permission denied/);
    await assert.rejects(() => db.query('update note_personali set studio_id=$1', [B]), /permission denied/);
    await assert.rejects(() => db.exec('update note_personali set paziente_id=2'), /row-level security/);

    // Un altro utente dello stesso studio non vede né cambia le note.
    await as(U2, A);
    assert.equal(await count(), 0);
    assert.equal((await db.query("update note_personali set testo='x' returning id")).rows.length, 0);
    assert.equal((await db.query('delete from note_personali returning id')).rows.length, 0);
    // Un altro studio neppure.
    await as(U1, B);
    assert.equal(await count(), 0);

    await as(U1, A);
    assert.equal((await db.query("delete from note_personali where area='idee' returning id")).rows.length, 1);
    assert.equal(await count(), 1);
    await db.exec('reset role');
    await db.exec('delete from patients where id=1');
    assert.equal((await db.query('select paziente_id from note_personali')).rows[0].paziente_id, null);
    await db.exec('set role anon');
    await assert.rejects(() => db.exec('select * from note_personali'), /permission denied/);
    await db.exec('reset role');
    assert.equal((await db.query("select relrowsecurity from pg_class where oid='public.note_personali'::regclass")).rows[0].relrowsecurity, true);
  } finally { await db.close(); }
});
