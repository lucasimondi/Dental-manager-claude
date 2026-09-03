-- POL-FIN-007d: Product Owner — "li io ci metto anche attività da svolgere
-- oltre i dati mancanti ... deve essere più chiaro e facile il fatto che
-- siano attività e dati mancanti da completare". The Home "Attività"
-- widget mixes manually-added user tasks with Poliedron's auto-generated
-- data-health findings (dataHealthActivities.js) in one flat list, with no
-- explicit signal distinguishing the two — paziente_id alone is not a
-- reliable marker of origin (it is only ever set today by the auto-scan,
-- but nothing prevents a future manual todo from also referencing a
-- patient). An explicit column removes the ambiguity.
--
-- Additive, backfillable, reversible: no RLS change needed. todos_studio's
-- single ALL-command policy already scopes every SELECT/INSERT/UPDATE/
-- DELETE by studio_id alone (unchanged since POL-FIN-007b), so a new
-- NOT NULL column with a default requires no new policy.
ALTER TABLE public.todos ADD COLUMN IF NOT EXISTS origine text NOT NULL DEFAULT 'manuale' CHECK (origine IN ('manuale', 'controllo_dati'));

-- Backfill: verified directly against production before applying (rolled
-- back transaction) that every existing row with paziente_id set was
-- created exclusively by the auto-scan effect in Dashboard.jsx — the
-- manual addTodo() path has never written paziente_id, only embedded the
-- patient's name as text. Safe, exact reclassification, not a guess.
UPDATE public.todos SET origine = 'controllo_dati' WHERE paziente_id IS NOT NULL;
