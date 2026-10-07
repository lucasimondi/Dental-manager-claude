# Teacher Layer

Provider-neutral layer for GPT/Claude/Gemini or future models.

Flow:
1. Build jobs from certified synthetic examples.
2. Send each job plus `system-prompt-v1.md` to a configured teacher provider.
3. Store outputs only under `academy/datasets/candidate/`.
4. Run structural validation and semantic checks.
5. Promote accepted candidates into a new versioned training dataset.
6. Never read from `datasets/exam/` when generating teacher jobs.

No API key belongs in the repository. Provider adapters are deliberately separated from the dataset contract so Poliedron Academy is not locked to one model vendor.
