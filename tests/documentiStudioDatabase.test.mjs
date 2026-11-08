import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';

// Motore PostgreSQL isolato con uno Storage minimo finto; mai un account remoto.
// PO 2026-11-08: documenti cercabili e creabili anche in Studio.
test('documenti_studio: studio-scoped rows and files, patient in the same studio, one search over all studio documents', async () => {
  const db = new PGlite();
  const A = '11111111-1111-1111-1111-111111111111', B = '22222222-2222-2222-2222-222222222222';
  const U1 = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', U2 = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
  const F = (studio, n) => `${studio}/0000000${n}-0000-0000-0000-000000000000.jpg`;
  try {
    await db.exec(`create role anon;create role authenticated;create schema auth;
    create function auth.jwt() returns jsonb language sql stable as $$select current_setting('request.jwt.claims',true)::jsonb$$;
    create function auth.uid() returns uuid language sql stable as $$select (auth.jwt()->>'sub')::uuid$$;
    grant usage on schema auth to authenticated,anon;
    create schema storage;
    create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
    create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text,owner uuid);
    alter table storage.objects enable row level security;
    create function storage.foldername(name text) returns text[] language sql immutable as $$select (string_to_array(name,'/'))[1:array_length(string_to_array(name,'/'),1)-1]$$;
    grant usage on schema storage to authenticated,anon; grant select,insert,delete on storage.objects to authenticated;
    create table public.patients(id bigint primary key,studio_id uuid not null,nome text,cognome text);
    alter table patients enable row level security;
    create policy patients_studio on patients using(studio_id=(auth.jwt()->'app_metadata'->>'studio_id')::uuid);
    grant select on patients to authenticated;
    insert into patients values(1,'${A}','Mario','Rossi'),(2,'${B}','Anna','Bianchi');
    create table public.documenti_medici(id bigint primary key,studio_id uuid not null,paziente_id bigint not null,paziente_nome text not null,tipo text not null,titolo text,data date not null,pdf_base64 text not null);
    create table public.documenti_fiscali(id bigint primary key,tipo text not null,numero text,data date not null,paziente_nome text,paziente_id bigint,importo numeric,pdf_base64 text,studio_id uuid);
    alter table documenti_medici enable row level security; alter table documenti_fiscali enable row level security;
    create policy dm on documenti_medici using(studio_id=(auth.jwt()->'app_metadata'->>'studio_id')::uuid);
    create policy df on documenti_fiscali using(studio_id=(auth.jwt()->'app_metadata'->>'studio_id')::uuid);
    grant select on documenti_medici, documenti_fiscali to authenticated;
    insert into documenti_medici values(1,'${A}',1,'Mario Rossi','ricetta','Ricetta amoxicillina','2026-11-01','x'),(2,'${B}',2,'Anna Bianchi','ricetta','Ricetta B','2026-11-01','x');
    insert into documenti_fiscali values(1,'fattura','12/2026','2026-11-02','Mario Rossi',1,100,'x','${A}'),(2,'fattura','1/2026','2026-11-02','Anna Bianchi',2,50,'x','${B}');`);
    await db.exec(readFileSync(new URL('../supabase/migrations/20261108130000_documenti_studio.sql', import.meta.url), 'utf8'));
    const as = async (sub, studio) => { await db.exec('reset role'); await db.query("select set_config('request.jwt.claims',$1,false)", [JSON.stringify({ sub, app_metadata: { studio_id: studio } })]); await db.exec('set role authenticated'); };
    const cerca = async (q) => (await db.query('select tabella, titolo from public.cerca_documenti_studio($1)', [q])).rows;

    await as(U1, A);
    // File nella cartella del proprio studio sì, in quella di un altro no.
    await db.query("insert into storage.objects(bucket_id,name) values('documenti-studio',$1)", [F(A, 1)]);
    await assert.rejects(() => db.query("insert into storage.objects(bucket_id,name) values('documenti-studio',$1)", [F(B, 2)]), /row-level security/);
    await db.query("insert into documenti_studio(studio_id,titolo,tipo,paziente_id,file_path,mime,dimensione) values($1,'Referto panoramica','referto',1,$2,'image/jpeg',1200)", [A, F(A, 1)]);
    await assert.rejects(() => db.query("insert into documenti_studio(studio_id,titolo,paziente_id,file_path,mime,dimensione) values($1,'x',2,$2,'image/jpeg',1)", [A, F(A, 3)]), /row-level security/, 'paziente di un altro studio');
    await assert.rejects(() => db.query("insert into documenti_studio(studio_id,titolo,file_path,mime,dimensione) values($1,'x',$2,'image/jpeg',1)", [A, F(B, 4)]), /check constraint/, 'file fuori dalla cartella dello studio');
    await assert.rejects(() => db.query("insert into documenti_studio(studio_id,titolo,file_path,mime,dimensione) values($1,'x',$2,'text/html',1)", [A, F(A, 5)]), /check constraint/);
    await assert.rejects(() => db.query("insert into documenti_studio(studio_id,titolo,file_path,mime,dimensione) values($1,'x',$2,'image/jpeg',1)", [B, F(B, 6)]), /row-level security/);
    await assert.rejects(() => db.query("update documenti_studio set file_path=$1", [F(A, 7)]), /permission denied/);

    assert.equal((await cerca('rossi')).length, 3, 'acquisiti, fiscali e medici dello studio');
    assert.deepEqual(await cerca('fattura 12'), [{ tabella: 'documenti_fiscali', titolo: 'Fattura n. 12/2026' }]);
    assert.deepEqual(await cerca('panoramica rossi'), [{ tabella: 'documenti_studio', titolo: 'Referto panoramica' }]);
    assert.equal((await cerca('bianchi')).length, 0, 'mai i documenti di un altro studio');

    // Collega dello stesso studio: vede e trova; un altro studio no.
    await as(U2, A);
    assert.equal((await cerca('panoramica')).length, 1);
    await as(U2, B);
    assert.equal((await db.query('select count(*)::int n from documenti_studio')).rows[0].n, 0);
    assert.equal((await db.query("select count(*)::int n from storage.objects where bucket_id='documenti-studio'")).rows[0].n, 0);
    assert.deepEqual((await cerca('')).map(r => r.titolo).sort(), ['Fattura n. 1/2026', 'Ricetta B']);

    await as(U1, A);
    assert.equal((await db.query('delete from documenti_studio returning id')).rows.length, 1);
    assert.equal((await db.query("delete from storage.objects where bucket_id='documenti-studio' returning id")).rows.length, 1);
    await db.exec('reset role');
    assert.equal((await db.query("select public from storage.buckets where id='documenti-studio'")).rows[0].public, false);
    await db.exec('set role anon');
    await assert.rejects(() => db.exec('select * from documenti_studio'), /permission denied/);
    await assert.rejects(() => db.exec("select * from public.cerca_documenti_studio('x')"), /permission denied/);
  } finally { await db.close(); }
});
