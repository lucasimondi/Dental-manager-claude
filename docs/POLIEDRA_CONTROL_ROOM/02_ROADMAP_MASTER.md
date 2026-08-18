# Poliedra — Roadmap Master

## Fase 0 — Fondamenta squadra AI
- POL-001: repository come source of truth — COMPLETATO/MERGED.
- Sistema AGENTS/CLAUDE/handoff/coordination — OPERATIVO.

## Fase 1 — Sicurezza e riproducibilità backend
- POL-002: baseline Supabase — audit avviato/completato a livello metadata verificabile.
- POL-002A: critical security hardening — patch preparata, in attesa di test isolati e review finale.
- P0 residuo: `patient-files` pubblico → piano private bucket + signed URL.
- Inventario completo SECURITY DEFINER/grants.
- Verifica tabelle privilegiate senza policy.
- Hardening Auth e tenant-safe relationships.

## Fase 2 — Financial Source of Truth
- Unificare definizioni e fonti di fatturato, incassato, crediti residui, costi, margini, EBITDA, break-even e cash flow.
- Eliminare formule duplicate SQL/JavaScript.
- Validare lifecycle economico canonico.
- Test di regressione numerica.

## Fase 3 — Quality gates e CI/CD
- Test automatici.
- Typecheck/lint/build.
- Test Supabase/RLS/tenant isolation.
- Security checks.
- PR gate prima del merge.

## Fase 4 — Integrazioni
- Pagamenti/POS: SumUp, Satispay, Flatpay, Revolut e provider compatibili.
- Software commercialisti/contabilità.
- Software radiologici.
- Sistema Tessera Sanitaria opt-in.

## Fase 5 — Verticali
Priorità prodotto da confermare task per task:
- Fisioterapista.
- Personal trainer.
- Psicologo.
- Medico professionista.
- Naturopata.
- Dietologo.
- Massaggiatore.
- Odontoiatria/core sanitario.

## Fase 6 — Ecosistema
- App pazienti/clienti.
- Ambulatori e poliambulatori autorizzati.
- Gestione documentazione autorizzativa e procedure.
- Automazioni AI/CFO e agenti specializzati.

## Principio
Nessuna nuova feature deve aumentare debito critico su tenancy, sicurezza o financial source of truth. La roadmap viene aggiornata attraverso task numerati `POL-XXX` e decisioni esplicite del Product Owner.