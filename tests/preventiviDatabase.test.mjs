import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';

// Isolated PostgreSQL engine, minimal inspected baseline; never a remote account.
test('preventivi migration: two-tenant RLS, patient-plan binding, immutable PDF, archive and idempotent insert',async()=>{
 const db=new PGlite();
 try {
 await db.exec(`create role anon;create role authenticated;create schema auth;
 create function auth.jwt() returns jsonb language sql stable as $$select current_setting('request.jwt.claims',true)::jsonb$$;
 create function auth.uid() returns uuid language sql stable as $$select (auth.jwt()->>'sub')::uuid$$;
 grant usage on schema auth to authenticated,anon;
 create table public.patients(id bigint primary key,studio_id uuid not null);
 create table public.plans(id bigint primary key,studio_id uuid not null,paziente_id bigint not null);
 alter table patients enable row level security;alter table plans enable row level security;
 create policy patients_studio on patients using(studio_id=(auth.jwt()->'app_metadata'->>'studio_id')::uuid) with check(studio_id=(auth.jwt()->'app_metadata'->>'studio_id')::uuid);
 create policy plans_studio on plans using(studio_id=(auth.jwt()->'app_metadata'->>'studio_id')::uuid) with check(studio_id=(auth.jwt()->'app_metadata'->>'studio_id')::uuid);
 grant select on patients,plans to authenticated;
 insert into patients values(1,'11111111-1111-1111-1111-111111111111'),(2,'22222222-2222-2222-2222-222222222222'),(3,'11111111-1111-1111-1111-111111111111');
 insert into plans values(10,'11111111-1111-1111-1111-111111111111',1),(20,'22222222-2222-2222-2222-222222222222',2);`);
 await db.exec(readFileSync(new URL('../supabase/migrations/20261103152923_preventivi_rapidi.sql',import.meta.url),'utf8'));
 const jwt=async(studio='11111111-1111-1111-1111-111111111111')=>db.query("select set_config('request.jwt.claims',$1,false)",[JSON.stringify({sub:'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',app_metadata:{studio_id:studio}})]);
 await jwt();await db.exec('set role authenticated');
 const insert=`insert into preventivi(id,studio_id,piano_id,paziente_id,paziente_nome,titolo,data,numero,plan_snapshot,pdf_base64) values($1,$2,$3,$4,'Synthetic','Test','2026-11-03',$5,'{}','data:application/pdf;base64,JVBERi0xLjQ=')`;
 const id='aaaaaaaa-0000-0000-0000-000000000001',tenant='11111111-1111-1111-1111-111111111111';
 await db.query(insert,[id,tenant,10,1,'A1']);
 await db.query(insert+' on conflict(id) do nothing',[id,tenant,10,1,'A1']);
 assert.equal((await db.query('select count(*)::int n from preventivi')).rows[0].n,1);
 await assert.rejects(()=>db.query(insert,['aaaaaaaa-0000-0000-0000-000000000002',tenant,10,3,'A2']),/row-level security/);
 await assert.rejects(()=>db.query(insert,['aaaaaaaa-0000-0000-0000-000000000003',tenant,20,2,'A3']),/row-level security/);
 await assert.rejects(()=>db.exec("update preventivi set pdf_base64='replaced'"),/permission denied/);
 await assert.rejects(()=>db.exec("update preventivi set studio_id='22222222-2222-2222-2222-222222222222'"),/permission denied/);
 await db.exec('update preventivi set archiviato=true');assert.equal((await db.query('select archiviato from preventivi')).rows[0].archiviato,true);
 await jwt('22222222-2222-2222-2222-222222222222');assert.equal((await db.query('select count(*)::int n from preventivi')).rows[0].n,0);
 assert.equal((await db.query('update preventivi set archiviato=false returning id')).rows.length,0);
 await jwt();await db.exec('set role anon');await assert.rejects(()=>db.exec('select * from preventivi'),/permission denied/);
 await db.exec('reset role');
 await db.exec('delete from plans where id=10');
 assert.equal((await db.query('select piano_id from preventivi')).rows[0].piano_id,null);
 await db.exec('set role authenticated');assert.equal((await db.query('select count(*)::int n from preventivi')).rows[0].n,1);await db.exec('reset role');
 await db.exec('delete from patients where id=1');assert.equal((await db.query('select count(*)::int n from preventivi')).rows[0].n,0);
 assert.equal((await db.query("select relrowsecurity from pg_class where oid='public.preventivi'::regclass")).rows[0].relrowsecurity,true);
 } finally {await db.close();}
});
