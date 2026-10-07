# Poliedron Academy

Versioned training/evaluation assets for Poliedron specialist intelligence.

- `schema/`: machine-readable contracts.
- `datasets/synthetic/`: fictional training examples.
- `datasets/exam/`: holdout examples; never train on these.
- `scripts/`: validators/generators.
- `tests/`: repository tests remain under root `tests/`.

Never place production patient chats, clinical notes, documents, prescriptions, direct identifiers or secrets in this directory.

## Synthetic Training Factory v1

Generate the deterministic Italian dental corpus:

`node academy/scripts/generate-dental-it-v1.mjs`

Then validate every Academy dataset, including train/exam leakage:

`node academy/scripts/validate-dataset.mjs`

The factory intentionally uses fictional identities and deterministic combinatorics. Future LLM-assisted augmentation must write to a separate candidate dataset and pass validation/review before promotion into training.
