# PRATICHE-WORKFLOW — batch 2, Codex, 2026-11-18

Branch: `ccr-30bcc810-y3n89t`. Previous agent: Claude Code.
Scope completed: esecuzione 25/2025. Banca Alpi Marittime started but NOT completely analysed. No other case marked completed.

## Esecuzione 25/2025

- Pratica `e2a67957-b6bc-4490-aa69-9c1b54910ea3`: inserted previously absent scheda, author `codex`, stato `analizzata`, verificata_il NULL. 4 source documents, 18 dated events, 7 missing-document groups, 8 actions including the two existing ones. Each timeline event references an existing document.
- Read all 3 document texts and recovered the fourth source (Gmail conversation) from the original thread. Added `documenti_testo` for `561117ff-d61c-46df-a27f-0daa4e433ae9` (previously no row), fonte `gmail-thread-codex`, 10,990 characters. Text preserves each message's date, sender and Gmail ID, omitting repeated quoted history and standard signatures where separated. Original emails untouched.
- No amounts inferred from other proceedings. No assumption of new defence mandate, notification, registration or extinction.
- Notification calculation: 60 clear days before 2027-01-14 yields 2026-11-14 (Saturday); backward deadline anticipated to Friday 2026-11-13, subject to counsel's verification of the actual notifications and procedural file. The previous “circa 14/11” and unconditional extinction wording were corrected in the existing action.
- Legal references consulted: art. 155 c.p.c., official MEF database; Agenzia Entrate circular 56/E of 24/09/2007, section 3.3 (backward Saturday deadlines); the primary basis for case-specific duties remains the 16/09/2026 order, document `5e8d047f-60a7-458c-8bb8-0c9d5afd8677`.
- 2026-11-19 reminders are organisational priorities, NOT new judicial deadlines. Comparsa 2027-01-04 and hearing 2027-01-14 11:00 come from the order/calculation and require checking subsequent orders.

## Mutation register / reversible changes

No deletion; no document reassignment; no RLS/schema changes; no third-party messages.
- Inserted scheda for pratica `e2a67957-b6bc-4490-aa69-9c1b54910ea3`. To withdraw without deleting, set stato_analisi to `da_aggiornare`, clear verificata_il and retain the text/history for correction. No previous scheda existed.
- Added source text for `561117ff-d61c-46df-a27f-0daa4e433ae9`; retain as source evidence (originals unchanged).
- Existing action `61edc4d6-767c-45d0-b1f3-7949c2fdd1cc`: scadenza 2026-11-25 → 2026-11-19; explanation/action replaced to distinguish suggested hearing substitution from mandate, correct backward deadline and require verification of any extinction.
  Previous spiegazione: “Giudizio di divisione via Piccona 36 (sub 12 e 13), udienza 14/01/2027 ore 11. Comparsa di costituzione entro 10 giorni prima (04/01/2027), pena decadenze art. 167 c.p.c.”
  Previous cosa_fare: “Conferire mandato (Avv. Dottore?) e verificare se la parte più diligente ha notificato l'ordinanza entro 60 giorni liberi prima dell'udienza (circa 14/11/2026): se nessuno l'ha fatto la procedura si estingue.”
- Existing action `28ff8e4c-2285-4d9d-b663-4396928d09f2`: date unchanged (2027-01-04); clarified precise decadenze and subsequent-order verification.
  Previous spiegazione: “Termine perentorio 10 giorni prima dell'udienza del 14/01/2027.”
  Previous cosa_fare: “Deposito dell'avvocato entro il 04/01/2027.”
- New action IDs: `767e0a5c-1c41-4cf6-9631-cb995abff379` (notifications/role); `516be06a-835c-4568-ac95-33745fb00ee1` (title/debt); `dcd7dfa1-4931-43aa-8e2e-70484d0b15fb` (mortgage); `f9645bb3-72f3-4c5e-a4b6-1ac1c2e8bbf6` (expert report/minutes); `069e8bd7-9e08-4823-8c77-6a6e7be465b9` (transcription); `3a180b7b-3d8e-4960-9883-c0eb355d6a51` (hearing).
- New BAM action `1b6265c1-16e6-4511-878c-d6ce0d9e550a`: verify sentence publication/notification, appeal and subsequent orders with counsel. Organisational date 2026-11-19.
- New reminders can be withdrawn without deleting via stato `rimosso`, noting the reason; restore existing action fields above only if deliberately rolling back (old wording is inaccurate).
- BAM document `d99014ee-980a-4b80-9c1f-bac63f45fc66`: prepended 684 characters extracted from the one-page PDF inside its ZIP + two newlines; existing 1,353-character email preserved. New length 2,039; fonte `codex-zip-pdf+email`. Original file unchanged. To reverse precisely, remove that leading 686-character prefix only after checking it still matches the recovered 26/03/2023 decree; restore original fonte only after consulting prior history (not captured in this batch).

## Banca Alpi Marittime — reading checkpoint, NOT full analysis

Pratica `842ffcdc-cfdd-44ab-a96c-b1d1749d7c20` currently has 50 docs (handoff said 49).
- Fully read sentence `0fa022c4-93f3-4fb8-aca7-0511b165eb6f` (61,495 chars), decided 29/06/2026, RG 872/2023: opposition rejected, D.I. 159/2023 confirmed for 97,152.10 plus accessories; awarded fees 4,925 to BAM and 2,127 to Acero plus accessories. Nicola Dottore is named as defence counsel. Acero intervened as assignee, FBS as mandatary. Publication/notification and appeal status NOT verified; do not calculate appeal deadlines from the decision date alone.
- Recovered and read decree `d99014ee-980a-4b80-9c1f-bac63f45fc66` from Drive `1CMqCgw4_2H_AKP53xqdusbHy-rnwaCAk`: ZIP containing `28550374s.pdf`, 1 page, dated 26/03/2023, postponing first hearing to 27/09/2023 11:15.
- “letto” does NOT guarantee complete attachment extraction. Seven texts initially started with “Email:” only (one now repaired); six texts stop at exactly 100,000 chars.
- Six potentially capped documents: `1e5d2f11-96ba-4dd3-bd09-d021ded6d4c3`, `323a928e-f3ef-431a-99d6-81b8912335ed`, `46b20796-763e-4e0f-864e-ca031c4b98fd`, `6c94963c-0a7b-4e0a-9990-8b02acdf19d4`, `85d5f78c-4271-4352-8a70-9c3fb3c2f69d`, `f677a03a-e6a0-4c78-9274-c7f72955a9b9`. Two are raw PEC MIME; parse MIME instead of reading encoded payload as legal prose.
- Critical missing attachment text: `c3c51f2f-c732-415e-aaf7-0936fc1ea208`, Drive `1kio2K54FNyOh8xhJJFxyekk1jxSQNw_4`. Actual file is a ZIP (11,884,336 bytes) containing `Relazione.pdf` (40 pages; 66,653 extracted chars) and 20 supporting PDFs. Several supports have no extractable text and require OCR. Existing DB text is just the accompanying email. ZIP downloaded and inspected; technical analysis/OCR NOT done, DB text NOT replaced.
- Scratch extracted text was generated only as intermediate material; original ZIP remains on Drive and must be re-fetched in a new environment. Do not use scratch paths as persistent source references.
- Other email-only source IDs requiring extraction check: `06324dd3-1094-45a7-bf76-08c854ec3ee3`, `221f6770-ffd8-4bfc-860c-dc21b86293c7`, `3cfa2c40-9ef5-4c39-90b6-d0a07001267c`, `950c7c53-2a28-4b79-8ba6-62ebec97b208`, `bb551892-a695-4c76-a182-138aa5fa642a`.
- No BAM scheda inserted and no analysis-completion count advanced.
- Other priorities unchanged: 36/2023 Mondino (98 docs, 97 text rows read by ingestion), Primo oppositions (43), Giraudo (43), then remaining legal. Their full substantive review is NOT completed in this batch.

## Script and checks

- `aggiornaSchede_` guard now protects both `claude-code` and `codex` authors. New synthetic VM tests execute the actual function, ensuring new docs flag manual cards instead of regenerating; automated-card behaviour retained.
- Tests: `node --test tests/praticheWorkflow.test.mjs tests/legalSchede.test.mjs tests/praticheSchedeAgentGuard.test.mjs`: 21/21 PASS. Initial reduced-checkout attempts failed on missing imported files; fetched unchanged dependencies from the branch, then final full targeted run passed. No failing assertion was bypassed.
- Code.gs syntax compile with Node VM: PASS.
- DB read-back: 4/4 documents with readable text, 4 sources, 18 events, 7 missing groups, 8 actions, 0 nonexistent timeline source IDs; author codex, analysed, not user-verified.
- Frontend unchanged, no new build claimed; prior agent's build remains historical only.
- Apps Script NOT pushed: neither clasp nor local Google authentication present. Do not claim protection is live. No merge, deployment or PR creation in this batch.
- Code rollback: revert these two lines and the new test file; database content is independently reversible as above.
