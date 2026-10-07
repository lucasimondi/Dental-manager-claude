# Poliedron Academy v1

Status: PRODUCT OWNER APPROVED — 2026-10-07

## Mission
Teach Poliedron the real operational language of Italian healthcare practices without weakening deterministic safety gates.

## Separation of concerns
- General LLM: fluent language, reasoning and novel requests.
- Academy-trained specialist ML/model: intent, entity extraction/ranking, ambiguity, terminology and routing.
- Resolver + Confidence Engine: authoritative data verification.
- Action Engine: permissions, RLS, domain constraints and writes.
The learned model may propose; it never bypasses the deterministic gate.

## Curriculum
1. Italian conversational variants: formal, colloquial, terse, typos, dictation noise.
2. Dental terminology: synonyms, abbreviations, teeth, procedures, plans, payments, agenda.
3. Operational language: front desk, clinician, owner/manager.
4. Context and coreference: “spostamelo”, “quello delle 11”, follow-up turns.
5. Ambiguity: missing target, multiple patients/plans, unclear amount/action/date.
6. Tool calling: map language to supported intent + structured entities.
7. Corrections: rejected interpretation -> accepted interpretation.
8. Safety: protected/destructive actions and cases that must not execute.

## Dataset classes
TRAIN_SYNTHETIC: generated/curated examples; no production patient data.
TRAIN_GOVERNED: future de-identified, approved real signals under explicit governance.
EVAL_DEV: development benchmark, never mixed into training.
EXAM_HOLDOUT: locked evaluation set, never used for training or prompt examples.

## Canonical example schema
Each JSONL example contains: schema_version, id, split, source, vertical, locale, utterance, context, expected intent, entities, missing_fields, ambiguity, expected_decision, expected_clarification, tags.
Synthetic examples must use fictional identities and values.

## Labels
Decision labels align with Confidence Engine: HIGH, NEEDS_DATA, AMBIGUOUS, BLOCKED, PROTECTED.
Intent labels are versioned and must map to actual supported product actions before they can influence execution.

## Generation factory
Generation is template + LLM assisted, but every generated record must pass:
- schema validation;
- allowed-intent validation;
- no forbidden/raw production data;
- duplicate detection;
- train/exam leakage detection;
- semantic spot review.
LLM generation alone is never considered ground truth.

## Poliedron Exam
Primary metric: wrong autonomous action rate.
Also measure intent accuracy, entity exact match, ambiguity recall, unnecessary clarification rate, autonomous success rate and protected-action recall.
A model cannot graduate from shadow mode if it improves convenience by increasing unsafe execution.

## First vertical
Dental Italian. Then Fisio, medicine, aesthetics and other approved verticals.
