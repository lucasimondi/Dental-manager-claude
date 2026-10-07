# Poliedron Learning Engine

Status: PRODUCT OWNER APPROVED — foundation / roadmap
Date: 2026-10-07

## Goal
Poliedron uses a general LLM now, while building proprietary intelligence about how healthcare practices communicate and operate.

Rule:
- understood + verified → execute
- understood but not verified → retrieve/check
- multiple plausible interpretations → ask one targeted question
- not understood → ask
- dangerous/destructive → explicit confirmation
- safe reversible → execute + Undo when supported

Confidence is not the LLM saying it is confident. Execution confidence comes from authoritative evidence.

## Architecture
1. General LLM: language, reasoning, novel requests.
2. Resolver: maps proposed intent/entities to authoritative tenant data.
3. Confidence Engine: deterministic evidence gate using uniqueness, required fields, authoritative matches, contradictions, duplicates, risk and permissions.
4. Action Engine: domain validation + RLS + execution.
5. Learning Event Pipeline: structured outcomes/corrections for evaluation and future training.
6. Future Poliedron ML: specialist intent/entity/routing/ambiguity models; initially not an LLM replacement.
7. Future Poliedron Model: optional fine-tuned/open-weight specialist model when dataset quality, scale and economics justify it.

## Planned learning event
Privacy-minimized fields: event id/time; vertical; pseudonymous tenant-scoped actor/session; normalized intent/action; entity TYPES and match counts; required fields present/missing; resolution unique/multiple/none/conflict; confidence factors/gate decision; risk class; executed/clarified/blocked/confirmed; success/failure category; structured correction; model/provider/version; tool-contract version; useful latency/cost metadata.

Do NOT collect by default as training data: patient names/direct identifiers, raw clinical notes/diagnoses/documents/images/prescriptions, raw health-data chat, secrets/tokens, unnecessary tenant identifiers. Operational/audit data and training extraction are separate contracts.

## Confidence Engine v1
Deterministic and inspectable. Gate on: allowed tool; valid required args; authoritative current-request observation; exactly one target where required; target belongs to patient/tenant; authoritative catalog price or explicit allowed price; duplicate/conflict checks; permission/RLS; risk class.

Outcomes: HIGH=execute; NEEDS_DATA=retrieve; AMBIGUOUS=targeted question; BLOCKED=do not act; PROTECTED=explicit confirmation. Numeric LLM self-confidence is never the safety gate.

## Correction loop
Corrections such as “no, intendevo l'altro Rossi” become structured supervised feedback: rejected interpretation → accepted resolution. One correction never becomes a global rule automatically.

Learning scopes: conversation → appropriate user/studio preference memory → governed aggregated product learning → curated de-identified offline training/evaluation.

## ML roadmap
A. Instrument + evaluate: events, corrections, Confidence Engine, benchmark.
B. Small specialist ML: intent/routing/entity ranking/ambiguity prediction, shadow mode first.
C. Studio terminology/workflow personalization without tenant leakage.
D. Fine-tuned specialist language model if justified.
E. Optional Poliedron Model; deterministic domain engine remains authoritative.

## Non-negotiable
Tenant/RLS authoritative. No silent reuse of healthcare raw data for training. Define lawful/governed basis, minimization, retention/deletion before training. No cross-tenant data leakage. Clinical guardrails remain. Benchmark every model version. ML never bypasses deterministic financial/clinical/permission/tenancy rules.

## Metrics
Resolution rate; clarification rate; correction rate; false-execution rate (primary safety metric); duplicate prevention; autonomous-success rate; undo rate; latency; cost. Increase autonomy only while false-execution stays within approved safety threshold.

## Immediate sequence
1. Finish Safe Autonomy without destructive actions.
2. Add versioned shared Confidence Engine contract.
3. Add privacy-minimized learning-event storage + RLS + retention policy.
4. Capture corrections/clarifications.
5. Build offline evaluation dataset/replay harness.
6. Run future ML in shadow mode before it influences execution.
