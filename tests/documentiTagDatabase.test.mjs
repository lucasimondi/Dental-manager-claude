import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';

// DOCUMENTI-TAG (PO 2026-11-10): tag, tipi liberi e altri formati nei documenti dello studio.
// Stesso motore isolato di documentiStudioDatabase.test.mjs; mai un account remoto.
test('documenti_studio: tag, tipo libero e Word/Excel; la ricerca trova i tag; i vincoli restano', async () => {
  const db = new PGlite();
  const A = '11111111-1111-1111-1111-111111111111', B = '22222222-2222-2222-2222-222222222222';
  const U1 = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', U2 = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
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
    const mig = (f) => readFileSync(new URL(`../supabase/migrations/${f}`, import.meta.url), 'utf8');
    await db.exec(mig('20261108130000_documenti_studio.sql'));
    // Una riga di prima della migrazione resta valida e senza tag.
    await db.exec(`insert into documenti_studio(studio_id,user_id,titolo,tipo,file_path,mime,dimensione) values('${A}','${U1}','Vecchio','referto','${A}/00000001-0000-0000-0000-000000000000.pdf','application/pdf',10)`);
    await db.exec(mig('20261110190000_documenti_studio_tag_tipi.sql'));
    await db.exec(mig('20261110190000_documenti_studio_tag_tipi.sql')); // idempotente
    const as = async (sub, studio) => { await db.exec('reset role'); await db.query("select set_config('request.jwt.claims',$1,false)", [JSON.stringify({ sub, app_metadata: { studio_id: studio } })]); await db.exec('set role authenticated'); };
    assert.deepEqual((await db.query("select tag from documenti_studio where titolo='Vecchio'")).rows[0].tag, []);
    await as(U1, A);
    await db.query(`insert into documenti_studio(studio_id,titolo,tipo,file_path,mime,dimensione,tag,paziente_id) values($1,'Relazione','Radiografia',$2,'application/vnd.openxmlformats-officedocument.wordprocessingml.document',100,$3,1)`, [A, `${A}/00000002-0000-0000-0000-000000000000.docx`, ['impianto', 'rx 2026']]);
    const cerca = async (q) => (await db.query('select titolo, tipo from public.cerca_documenti_studio($1)', [q])).rows;
    assert.deepEqual(await cerca('impianto'), [{ titolo: 'Relazione', tipo: 'Radiografia' }]);
    assert.deepEqual(await cerca('rx 2026 rossi'), [{ titolo: 'Relazione', tipo: 'Radiografia' }]);
    await db.query("update documenti_studio set tag = array['controllo'] where titolo = 'Relazione'");
    assert.equal((await cerca('controllo')).length, 1);
    await assert.rejects(db.query(`insert into documenti_studio(studio_id,titolo,tipo,file_path,mime,dimensione) values($1,'x','',$2,'application/pdf',1)`, [A, `${A}/00000003-0000-0000-0000-000000000000.pdf`]), /tipo_check/);
    await assert.rejects(db.query(`insert into documenti_studio(studio_id,titolo,file_path,mime,dimensione,tag) values($1,'x',$2,'application/pdf',1,$3)`, [A, `${A}/00000004-0000-0000-0000-000000000000.pdf`, Array.from({ length: 21 }, (_, i) => `t${i}`)]), /tag_check/);
    await assert.rejects(db.query(`insert into documenti_studio(studio_id,titolo,file_path,mime,dimensione) values($1,'x',$2,'application/x-msdownload',1)`, [A, `${A}/00000005-0000-0000-0000-000000000000.exe`]), /mime_check/);
    // Un altro studio non vede né trova i documenti (RLS invariata).
    await as(U2, B);
    assert.deepEqual(await cerca('impianto'), []);
    await db.exec('reset role');
    const bucket = (await db.query("select allowed_mime_types from storage.buckets where id='documenti-studio'")).rows[0].allowed_mime_types;
    assert.ok(bucket.includes('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet') && bucket.includes('application/pdf'));
  } finally { await db.close(); }
});
