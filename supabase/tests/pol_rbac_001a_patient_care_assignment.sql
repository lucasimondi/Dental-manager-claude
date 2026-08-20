BEGIN;

-- POL-RBAC-001A regression: capability vs assignment separation.
-- Studio A (10000000...0001): Patient A=101, Patient B=102.
-- a1 owner/admin (non-clinical), a2 front desk, a3 physiotherapist
-- (responsible), a4 PT1 (assigned only to Patient A), a5 Massage1 (assigned
-- only to Patient B), a6 multi-role (PT+massage, unassigned), a7 suspended
-- physiotherapist, a9 PT2 (capability, no assignment at all).
-- Studio B (20000000...0002): b1 admin, b2 physiotherapist. Patient 201.

INSERT INTO public.studio_user_capabilities(studio_id,user_id,capability,granted_by) VALUES
  ('10000000-0000-4000-8000-000000000001','a0000000-0000-4000-8000-000000000002','home.front_desk','a0000000-0000-4000-8000-000000000001'),
  ('10000000-0000-4000-8000-000000000001','a0000000-0000-4000-8000-000000000003','clinical.physiotherapist','a0000000-0000-4000-8000-000000000001'),
  ('10000000-0000-4000-8000-000000000001','a0000000-0000-4000-8000-000000000004','clinical.personal_trainer','a0000000-0000-4000-8000-000000000001'),
  ('10000000-0000-4000-8000-000000000001','a0000000-0000-4000-8000-000000000005','clinical.massage_therapist','a0000000-0000-4000-8000-000000000001'),
  ('10000000-0000-4000-8000-000000000001','a0000000-0000-4000-8000-000000000006','clinical.personal_trainer','a0000000-0000-4000-8000-000000000001'),
  ('10000000-0000-4000-8000-000000000001','a0000000-0000-4000-8000-000000000006','clinical.massage_therapist','a0000000-0000-4000-8000-000000000001'),
  ('10000000-0000-4000-8000-000000000001','a0000000-0000-4000-8000-000000000007','clinical.physiotherapist','a0000000-0000-4000-8000-000000000001'),
  ('10000000-0000-4000-8000-000000000001','a0000000-0000-4000-8000-000000000009','clinical.personal_trainer','a0000000-0000-4000-8000-000000000001'),
  ('10000000-0000-4000-8000-000000000001','a0000000-0000-4000-8000-00000000000a','clinical.physiotherapist','a0000000-0000-4000-8000-000000000001'),
  ('20000000-0000-4000-8000-000000000002','b0000000-0000-4000-8000-000000000002','clinical.physiotherapist','b0000000-0000-4000-8000-000000000001');

CREATE OR REPLACE FUNCTION pg_temp.assert_true(condition boolean, message text)
RETURNS void LANGUAGE plpgsql AS $$ BEGIN IF NOT COALESCE(condition,false) THEN RAISE EXCEPTION 'assertion failed: %',message; END IF; END $$;

INSERT INTO public.physio_piani(studio_id,paziente_id,titolo,stato) VALUES
 ('10000000-0000-4000-8000-000000000001',101,'Piano A','attivo'),
 ('10000000-0000-4000-8000-000000000001',102,'Piano B','attivo'),
 ('20000000-0000-4000-8000-000000000002',201,'Piano Studio B','attivo');
INSERT INTO public.physio_valutazioni(studio_id,paziente_id,tipo,motivo_visita,created_by) VALUES
 ('10000000-0000-4000-8000-000000000001',101,'iniziale','Valutazione A','a0000000-0000-4000-8000-000000000003'),
 ('10000000-0000-4000-8000-000000000001',102,'iniziale','Valutazione B','a0000000-0000-4000-8000-000000000003');
INSERT INTO public.physio_obiettivi(studio_id,paziente_id,descrizione) VALUES
 ('10000000-0000-4000-8000-000000000001',101,'Obiettivo A'),
 ('10000000-0000-4000-8000-000000000001',102,'Obiettivo B');
INSERT INTO public.physio_esercizi(studio_id,nome) VALUES ('10000000-0000-4000-8000-000000000001','Esercizio condiviso');
INSERT INTO public.physio_prescrizioni(studio_id,paziente_id,esercizio_id)
  SELECT '10000000-0000-4000-8000-000000000001',101,id FROM public.physio_esercizi WHERE nome='Esercizio condiviso';
INSERT INTO public.physio_prescrizioni(studio_id,paziente_id,esercizio_id)
  SELECT '10000000-0000-4000-8000-000000000001',102,id FROM public.physio_esercizi WHERE nome='Esercizio condiviso';

SET ROLE authenticated;

-- ── Active assignments: PT1 -> Patient A only, Massage1 -> Patient B only ─
-- Seeded through the real authenticated/RLS-protected insert path (as the
-- admin, who holds studio.manage_members) rather than as table owner, so the
-- fixture setup itself exercises patient_care_assignments_guard_v1 and the
-- insert policy instead of bypassing them.
SELECT set_config('request.jwt.claims','{"sub":"a0000000-0000-4000-8000-000000000001"}',true);
INSERT INTO public.patient_care_assignments(studio_id,patient_id,user_id,assignment_type,created_by) VALUES
 ('10000000-0000-4000-8000-000000000001',101,'a0000000-0000-4000-8000-000000000004','personal_trainer','a0000000-0000-4000-8000-000000000001'),
 ('10000000-0000-4000-8000-000000000001',102,'a0000000-0000-4000-8000-000000000005','massage_therapist','a0000000-0000-4000-8000-000000000001'),
 ('10000000-0000-4000-8000-000000000001',101,'a0000000-0000-4000-8000-000000000003','responsible_physiotherapist','a0000000-0000-4000-8000-000000000001');

-- ── PT1 (a4): assigned only to Patient A (101) ──────────────────────────
SELECT set_config('request.jwt.claims','{"sub":"a0000000-0000-4000-8000-000000000004"}',true);
SELECT pg_temp.assert_true((SELECT count(*) FROM public.physio_piani WHERE paziente_id=101)=1,'PT1 reads Patient A operational plan');
SELECT pg_temp.assert_true((SELECT count(*) FROM public.physio_obiettivi WHERE paziente_id=101)=1,'PT1 reads Patient A goals');
SELECT pg_temp.assert_true((SELECT count(*) FROM public.physio_prescrizioni WHERE paziente_id=101)=1,'PT1 reads Patient A prescriptions');
SELECT pg_temp.assert_true((SELECT count(*) FROM public.physio_piani WHERE paziente_id=102)=0,'PT1 cannot read Patient B plan');
SELECT pg_temp.assert_true((SELECT count(*) FROM public.physio_obiettivi WHERE paziente_id=102)=0,'PT1 cannot read Patient B goals');
SELECT pg_temp.assert_true((SELECT count(*) FROM public.physio_prescrizioni WHERE paziente_id=102)=0,'PT1 cannot read Patient B prescriptions');
SELECT pg_temp.assert_true((SELECT count(*) FROM public.physio_valutazioni)=0,'PT1 cannot read full evaluation/anamnesis');
INSERT INTO public.physio_diario_sedute(studio_id,paziente_id,trattamenti_svolti,created_by)
VALUES ('10000000-0000-4000-8000-000000000001',101,'Sessione PT1 su A','a0000000-0000-4000-8000-000000000004');
SELECT pg_temp.assert_true((SELECT count(*) FROM public.physio_diario_sedute WHERE paziente_id=101)=1,'PT1 registers own activity on Patient A');
SELECT pg_temp.assert_true((SELECT count(*) FROM public.physio_diario_sedute)=1,'PT1 reads own operational history on Patient A');
DO $$ BEGIN
  INSERT INTO public.physio_diario_sedute(studio_id,paziente_id,trattamenti_svolti,created_by)
  VALUES ('10000000-0000-4000-8000-000000000001',102,'Tentativo su B','a0000000-0000-4000-8000-000000000004');
  RAISE EXCEPTION 'PT1 wrote to unassigned Patient B';
EXCEPTION WHEN insufficient_privilege OR check_violation THEN NULL; END $$;
DO $$ BEGIN
  UPDATE public.physio_piani SET titolo='Escalation PT1' WHERE paziente_id=101;
  IF FOUND THEN RAISE EXCEPTION 'PT1 modified the physiotherapy plan'; END IF;
END $$;

SELECT set_config('request.jwt.claims','{"sub":"a0000000-0000-4000-8000-000000000005"}',true);
INSERT INTO public.physio_diario_sedute(studio_id,paziente_id,trattamenti_svolti,created_by)
VALUES ('10000000-0000-4000-8000-000000000001',102,'Intervento massaggio su B','a0000000-0000-4000-8000-000000000005');
SELECT set_config('request.jwt.claims','{"sub":"a0000000-0000-4000-8000-000000000004"}',true);
DO $$ BEGIN
  UPDATE public.physio_diario_sedute SET note='modificato da PT1' WHERE trattamenti_svolti='Intervento massaggio su B';
  IF FOUND THEN RAISE EXCEPTION 'PT1 modified another professional''s activity'; END IF;
END $$;

-- ── Massage1 (a5): assigned only to Patient B (102) ─────────────────────
SELECT set_config('request.jwt.claims','{"sub":"a0000000-0000-4000-8000-000000000005"}',true);
SELECT pg_temp.assert_true((SELECT count(*) FROM public.physio_piani WHERE paziente_id=102)=1,'Massage1 reads Patient B operational plan');
SELECT pg_temp.assert_true((SELECT count(*) FROM public.physio_piani WHERE paziente_id=101)=0,'Massage1 cannot read Patient A plan');
DO $$ BEGIN
  UPDATE public.physio_piani SET titolo='Escalation massage' WHERE paziente_id=102;
  IF FOUND THEN RAISE EXCEPTION 'Massage1 modified the physiotherapy plan'; END IF;
END $$;
DO $$ BEGIN
  UPDATE public.physio_diario_sedute SET note='modificato da massage' WHERE trattamenti_svolti='Sessione PT1 su A';
  IF FOUND THEN RAISE EXCEPTION 'Massage1 modified another professional''s activity'; END IF;
END $$;

-- ── PT2 (a9): same studio, capability, never assigned ───────────────────
SELECT set_config('request.jwt.claims','{"sub":"a0000000-0000-4000-8000-000000000009"}',true);
SELECT pg_temp.assert_true((SELECT count(*) FROM public.physio_piani)=0,'unassigned PT2 has no clinical access to Patient A or B');

-- ── Front desk (a2): no clinical access at all ───────────────────────────
SELECT set_config('request.jwt.claims','{"sub":"a0000000-0000-4000-8000-000000000002"}',true);
SELECT pg_temp.assert_true((SELECT count(*) FROM public.physio_piani)=0,'front desk has no clinical content access');

-- ── Non-clinical owner (a1): no automatic clinical access ────────────────
SELECT set_config('request.jwt.claims','{"sub":"a0000000-0000-4000-8000-000000000001"}',true);
SELECT pg_temp.assert_true((SELECT count(*) FROM public.physio_piani)=0,'non-clinical owner has no automatic clinical access');

-- ── Physiotherapist (a3): unrestricted within tenant, per preserved contract
SELECT set_config('request.jwt.claims','{"sub":"a0000000-0000-4000-8000-000000000003"}',true);
SELECT pg_temp.assert_true((SELECT count(*) FROM public.physio_piani)=2,'physiotherapist keeps unrestricted tenant-wide access to both patients');
SELECT pg_temp.assert_true((SELECT count(*) FROM public.physio_valutazioni)=2,'physiotherapist reads full evaluations for both patients');

-- ── Multi-role (a6, PT+massage), unassigned: no escalation from stacking ─
SELECT set_config('request.jwt.claims','{"sub":"a0000000-0000-4000-8000-000000000006"}',true);
SELECT pg_temp.assert_true((SELECT count(*) FROM public.physio_piani)=0,'multi-role capability alone grants no access without an assignment');

SELECT set_config('request.jwt.claims','{"sub":"a0000000-0000-4000-8000-000000000001"}',true);
INSERT INTO public.patient_care_assignments(studio_id,patient_id,user_id,assignment_type,created_by) VALUES
 ('10000000-0000-4000-8000-000000000001',101,'a0000000-0000-4000-8000-000000000006','massage_therapist','a0000000-0000-4000-8000-000000000001');
SELECT set_config('request.jwt.claims','{"sub":"a0000000-0000-4000-8000-000000000006"}',true);
SELECT pg_temp.assert_true((SELECT count(*) FROM public.physio_piani WHERE paziente_id=101)=1,'multi-role assignment grants access only through the granted responsibility');
SELECT pg_temp.assert_true((SELECT count(*) FROM public.physio_piani WHERE paziente_id=102)=0,'multi-role user still unassigned on Patient B');

-- ── Cross-tenant (b2, Studio B physiotherapist): no Studio A access ──────
SELECT set_config('request.jwt.claims','{"sub":"b0000000-0000-4000-8000-000000000002"}',true);
SELECT pg_temp.assert_true((SELECT count(*) FROM public.physio_piani WHERE paziente_id IN (101,102))=0,'Studio B physiotherapist has no Studio A access');
SELECT pg_temp.assert_true((SELECT count(*) FROM public.physio_piani WHERE paziente_id=201)=1,'Studio B physiotherapist reads own tenant only');

-- ── Suspended membership overrides capability + assignment ──────────────
-- a7 was granted an active assignment while active, then later suspended —
-- the realistic lifecycle the mission describes, not an assignment created
-- while already suspended (which target-eligibility would itself reject).
RESET ROLE;
UPDATE public.studio_users SET stato='attivo' WHERE user_id='a0000000-0000-4000-8000-000000000007';
SET ROLE authenticated;
SELECT set_config('request.jwt.claims','{"sub":"a0000000-0000-4000-8000-000000000001"}',true);
INSERT INTO public.patient_care_assignments(studio_id,patient_id,user_id,assignment_type,created_by) VALUES
 ('10000000-0000-4000-8000-000000000001',101,'a0000000-0000-4000-8000-000000000007','physiotherapist','a0000000-0000-4000-8000-000000000001');
RESET ROLE;
UPDATE public.studio_users SET stato='sospeso' WHERE user_id='a0000000-0000-4000-8000-000000000007';
SET ROLE authenticated;
SELECT set_config('request.jwt.claims','{"sub":"a0000000-0000-4000-8000-000000000007"}',true);
SELECT pg_temp.assert_true((SELECT count(*) FROM public.physio_piani)=0,'suspended membership denies access even with capability and an active assignment');

-- ── Assignment revocation is immediately effective ───────────────────────
SELECT set_config('request.jwt.claims','{"sub":"a0000000-0000-4000-8000-000000000001"}',true);
UPDATE public.patient_care_assignments SET active=false, reason='fine percorso'
  WHERE studio_id='10000000-0000-4000-8000-000000000001' AND patient_id=101
    AND user_id='a0000000-0000-4000-8000-000000000004' AND assignment_type='personal_trainer';
SELECT pg_temp.assert_true(
  (SELECT ended_by='a0000000-0000-4000-8000-000000000001'::uuid AND ended_at IS NOT NULL
   FROM public.patient_care_assignments
   WHERE patient_id=101 AND user_id='a0000000-0000-4000-8000-000000000004' AND assignment_type='personal_trainer'),
  'termination records ended_by/ended_at server-side'
);
SELECT set_config('request.jwt.claims','{"sub":"a0000000-0000-4000-8000-000000000004"}',true);
SELECT pg_temp.assert_true((SELECT count(*) FROM public.physio_piani)=0,'PT1 loses access immediately once the assignment is deactivated');

-- ── Roster data minimization (Product Owner decision) ────────────────────
-- A6 is still actively assigned to Patient A as massage_therapist. Direct
-- base-table access must now return ONLY their own row (PT1's just-ended
-- row, and anyone else's, must be invisible) — the raw table grants full
-- columns (created_by/timestamps/reason), which a PT/massage teammate must
-- never read, per Product Owner decision.
SELECT set_config('request.jwt.claims','{"sub":"a0000000-0000-4000-8000-000000000006"}',true);
SELECT pg_temp.assert_true(
  (SELECT count(*) FROM public.patient_care_assignments WHERE patient_id=101)=1,
  'a PT/massage teammate has no raw table access to other professionals'' rows, only their own'
);
SELECT pg_temp.assert_true(
  (SELECT count(*) FROM public.patient_care_assignments WHERE patient_id=101 AND user_id='a0000000-0000-4000-8000-000000000004')=0,
  'an active teammate cannot see another professional''s ended assignment or its reason/ended_by via the base table'
);

-- The data-minimized roster function is the correct read path instead: it
-- returns the active team (a3 responsible_physiotherapist + a6 themselves;
-- PT1/a4 excluded, ended) with exactly id/user_id/assignment_type/active —
-- identity, role, status — nothing else.
SELECT pg_temp.assert_true(
  (SELECT count(*) FROM public.patient_care_team_roster_v1('10000000-0000-4000-8000-000000000001',101))=2,
  'roster function returns the active team (responsible physiotherapist + self), excluding the ended PT1 row'
);
SELECT pg_temp.assert_true(
  (SELECT bool_and(active) FROM public.patient_care_team_roster_v1('10000000-0000-4000-8000-000000000001',101)),
  'roster function never returns inactive/ended rows'
);
SELECT pg_temp.assert_true(
  (SELECT count(*) FROM public.patient_care_team_roster_v1('10000000-0000-4000-8000-000000000001',102))=0,
  'roster function returns nothing for a patient the teammate is not assigned to'
);

-- Unauthorized callers (front desk, capability-only unassigned PT) get an
-- empty roster too, even for a patient that does have an active team. The
-- non-clinical owner is deliberately NOT tested as "denied" here: they hold
-- studio.manage_members like any active admin and are meant to see the
-- roster (same tier as the physiotherapist) — that is correct, unrestricted
-- access, not a gap this decision addresses.
SELECT set_config('request.jwt.claims','{"sub":"a0000000-0000-4000-8000-000000000002"}',true);
SELECT pg_temp.assert_true(
  (SELECT count(*) FROM public.patient_care_team_roster_v1('10000000-0000-4000-8000-000000000001',101))=0,
  'front desk cannot read the team roster'
);
SELECT set_config('request.jwt.claims','{"sub":"a0000000-0000-4000-8000-000000000009"}',true);
SELECT pg_temp.assert_true(
  (SELECT count(*) FROM public.patient_care_team_roster_v1('10000000-0000-4000-8000-000000000001',101))=0,
  'an unassigned PT (capability only) cannot read another patient''s team roster'
);
SELECT set_config('request.jwt.claims','{"sub":"a0000000-0000-4000-8000-000000000001"}',true);
SELECT pg_temp.assert_true(
  (SELECT count(*) FROM public.patient_care_team_roster_v1('10000000-0000-4000-8000-000000000001',101))=2,
  'non-clinical owner (studio.manage_members) reads the roster same as physiotherapist -- admin tier, not a PT/massage restriction'
);

-- Physiotherapist keeps the full contractual view: same active-team count
-- via the roster function, AND full-row access to the base table (audit
-- fields included) that a PT/massage teammate no longer has.
SELECT set_config('request.jwt.claims','{"sub":"a0000000-0000-4000-8000-000000000003"}',true);
SELECT pg_temp.assert_true(
  (SELECT count(*) FROM public.patient_care_team_roster_v1('10000000-0000-4000-8000-000000000001',101))=2,
  'physiotherapist reads the same active roster via the function'
);
SELECT pg_temp.assert_true(
  (SELECT count(*) FROM public.patient_care_assignments WHERE patient_id=101)>=3,
  'physiotherapist retains full-row base-table access, including the ended PT1 row'
);

-- ── Suspension re-check on the roster's own authorization helper ─────────
-- A6's own studio_users membership is now suspended (their assignment row
-- stays active=true, untouched) — caller_has_active_patient_assignment_v1
-- must independently fail closed on the caller's membership, not just the
-- assignment row's active flag.
RESET ROLE;
UPDATE public.studio_users SET stato='sospeso' WHERE user_id='a0000000-0000-4000-8000-000000000006';
SET ROLE authenticated;
SELECT set_config('request.jwt.claims','{"sub":"a0000000-0000-4000-8000-000000000006"}',true);
SELECT pg_temp.assert_true(
  (SELECT count(*) FROM public.patient_care_team_roster_v1('10000000-0000-4000-8000-000000000001',101))=0,
  'a suspended user cannot use a still-active assignment row to read the team roster'
);

-- ── Author spoofing on the new physio_esecuzioni authorship ──────────────
SELECT set_config('request.jwt.claims','{"sub":"a0000000-0000-4000-8000-000000000005"}',true);
INSERT INTO public.physio_esecuzioni(studio_id,prescrizione_id,eseguito,created_by)
  SELECT '10000000-0000-4000-8000-000000000001',id,true,'a0000000-0000-4000-8000-000000000004'
  FROM public.physio_prescrizioni WHERE paziente_id=102;
SELECT pg_temp.assert_true(
  (SELECT created_by='a0000000-0000-4000-8000-000000000005'::uuid FROM public.physio_esecuzioni ORDER BY id DESC LIMIT 1),
  'server forces execution-log author to caller even when a different user_id is supplied'
);
SELECT pg_temp.assert_true((SELECT count(*) FROM public.physio_esecuzioni)=1,'Massage1 reads own execution log on assigned Patient B');

-- ── Assignment management authorization ──────────────────────────────────
-- Physiotherapist can browse teammate capabilities to compose the team
-- (needed for the "Assegna professionista" picker); front desk cannot.
SELECT set_config('request.jwt.claims','{"sub":"a0000000-0000-4000-8000-000000000003"}',true);
SELECT pg_temp.assert_true(
  (SELECT count(*) FROM public.studio_user_capabilities WHERE studio_id='10000000-0000-4000-8000-000000000001')>1,
  'physiotherapist can browse teammate clinical capabilities to compose a care team'
);
SELECT pg_temp.assert_true(
  (SELECT count(*) FROM public.studio_user_capabilities WHERE capability NOT LIKE 'clinical.%')=0,
  'physiotherapist cannot see non-clinical capability rows (front desk, finance, admin) beyond least privilege'
);
SELECT set_config('request.jwt.claims','{"sub":"a0000000-0000-4000-8000-000000000002"}',true);
SELECT pg_temp.assert_true(
  (SELECT count(*) FROM public.studio_user_capabilities WHERE studio_id='10000000-0000-4000-8000-000000000001' AND user_id<>'a0000000-0000-4000-8000-000000000002')=0,
  'front desk cannot browse other users'' capabilities'
);

-- Physiotherapist (responsible clinician) may compose the team.
SELECT set_config('request.jwt.claims','{"sub":"a0000000-0000-4000-8000-000000000003"}',true);
INSERT INTO public.patient_care_assignments(studio_id,patient_id,user_id,assignment_type,created_by)
VALUES ('10000000-0000-4000-8000-000000000001',102,'a0000000-0000-4000-8000-000000000009','personal_trainer','a0000000-0000-4000-8000-000000000006');
SELECT pg_temp.assert_true(
  (SELECT created_by='a0000000-0000-4000-8000-000000000003'::uuid FROM public.patient_care_assignments
   WHERE patient_id=102 AND user_id='a0000000-0000-4000-8000-000000000009'),
  'server forces assignment created_by to caller regardless of client-supplied value'
);

-- Front desk cannot assign professionals.
SELECT set_config('request.jwt.claims','{"sub":"a0000000-0000-4000-8000-000000000002"}',true);
DO $$ BEGIN
  INSERT INTO public.patient_care_assignments(studio_id,patient_id,user_id,assignment_type,created_by)
  VALUES ('10000000-0000-4000-8000-000000000001',101,'a0000000-0000-4000-8000-000000000009','personal_trainer','a0000000-0000-4000-8000-000000000002');
  RAISE EXCEPTION 'front desk assigned a professional';
EXCEPTION WHEN insufficient_privilege OR check_violation THEN NULL; END $$;

-- A PT cannot self-assign to a new patient (no manage_members/physiotherapist capability).
SELECT set_config('request.jwt.claims','{"sub":"a0000000-0000-4000-8000-000000000004"}',true);
DO $$ BEGIN
  INSERT INTO public.patient_care_assignments(studio_id,patient_id,user_id,assignment_type,created_by)
  VALUES ('10000000-0000-4000-8000-000000000001',102,'a0000000-0000-4000-8000-000000000004','personal_trainer','a0000000-0000-4000-8000-000000000004');
  RAISE EXCEPTION 'PT self-assigned to an unassigned patient';
EXCEPTION WHEN insufficient_privilege OR check_violation THEN NULL; END $$;

-- Assigning a target without the matching capability is rejected server-side.
SELECT set_config('request.jwt.claims','{"sub":"a0000000-0000-4000-8000-000000000003"}',true);
DO $$ BEGIN
  INSERT INTO public.patient_care_assignments(studio_id,patient_id,user_id,assignment_type,created_by)
  VALUES ('10000000-0000-4000-8000-000000000001',101,'a0000000-0000-4000-8000-000000000002','personal_trainer','a0000000-0000-4000-8000-000000000003');
  RAISE EXCEPTION 'front desk user was assigned as personal trainer without the capability';
EXCEPTION WHEN insufficient_privilege OR check_violation THEN NULL; END $$;

-- Assigning a cross-tenant user is rejected server-side.
DO $$ BEGIN
  INSERT INTO public.patient_care_assignments(studio_id,patient_id,user_id,assignment_type,created_by)
  VALUES ('10000000-0000-4000-8000-000000000001',101,'b0000000-0000-4000-8000-000000000002','physiotherapist','a0000000-0000-4000-8000-000000000003');
  RAISE EXCEPTION 'cross-tenant professional was assigned';
EXCEPTION WHEN insufficient_privilege OR check_violation THEN NULL; END $$;

-- A second active responsible_physiotherapist for the same patient is rejected
-- (a10 is an otherwise-eligible active physiotherapist, isolating this as a
-- uniqueness failure rather than a target-eligibility failure).
DO $$ BEGIN
  INSERT INTO public.patient_care_assignments(studio_id,patient_id,user_id,assignment_type,created_by)
  VALUES ('10000000-0000-4000-8000-000000000001',101,'a0000000-0000-4000-8000-00000000000a','responsible_physiotherapist','a0000000-0000-4000-8000-000000000003');
  RAISE EXCEPTION 'a second responsible physiotherapist was accepted for the same patient';
EXCEPTION WHEN unique_violation THEN NULL; END $$;

-- A PT cannot terminate a teammate's assignment (least privilege: only admin/physiotherapist manage the roster).
SELECT set_config('request.jwt.claims','{"sub":"a0000000-0000-4000-8000-000000000004"}',true);
DO $$ BEGIN
  UPDATE public.patient_care_assignments SET active=false
  WHERE patient_id=102 AND user_id='a0000000-0000-4000-8000-000000000009';
  IF FOUND THEN RAISE EXCEPTION 'PT deactivated a teammate assignment without manage authority'; END IF;
END $$;

-- Assignment identity fields are immutable once created.
SELECT set_config('request.jwt.claims','{"sub":"a0000000-0000-4000-8000-000000000003"}',true);
DO $$ BEGIN
  UPDATE public.patient_care_assignments SET user_id='a0000000-0000-4000-8000-000000000006'
  WHERE patient_id=102 AND user_id='a0000000-0000-4000-8000-000000000009';
  RAISE EXCEPTION 'assignment identity field was mutated in place';
EXCEPTION WHEN insufficient_privilege OR check_violation THEN NULL; END $$;

-- DELETE is not granted at all: even an authorized manager cannot hard-delete
-- an assignment, only close it historically via UPDATE.
DO $$ BEGIN
  DELETE FROM public.patient_care_assignments WHERE patient_id=102 AND user_id='a0000000-0000-4000-8000-000000000009';
  RAISE EXCEPTION 'assignment was hard-deleted instead of closed historically';
EXCEPTION WHEN insufficient_privilege THEN NULL; END $$;

RESET ROLE;
ROLLBACK;
