# PREVENTIVI-RAPIDI — 3 November 2026

Approved by PO: one-screen quote composition, two in-app taps from completed quote to native PDF/JPG sharing, dedicated persistent quote archive. Branch codex/preventivi-rapidi from cab3206a. Golden checkpoint stable/2026-08-27-full-recovery/070b28fd remains unchanged.

## Flow

Patient chart, appointment shortcut and Home new-quote action open PatientPlanEntry. Pricelist autocomplete, editable row prices/teeth, collapsed optional quadrant selector, canonical percentage/euro total discount, optional title. Selecting an existing plan copies its proposed document rows; remove undesired rows before generation. Creating from existing plan or revising an archived quote creates a document projection, never an extra clinical plan or a second financial ledger. A genuinely new quote uses existing validated patient/appointment plan persistence. Clinical execution/acceptance/payment are never inferred.

First Invia PDF/JPG tap confirms the plan write if necessary, archives the immutable PDF and prepares actual File objects. Second Condividi tap calls navigator.share({files}) before any network/render await. No wa.me text, mailto or text-only fallback. WhatsApp recipient selection and final sending remain OS/app actions. Unsupported file sharing offers actual downloads. Cancelling the share picker stays cancellation; sharing is not recorded as recipient delivery. PDF bytes, canonical total and JPG pages are derived from the same saved document. JPG uses the existing pdfjs package at scale2, sequential pages and released canvases/worker. No image-generation or new production dependency.

Quote PDF uses the configured doctor signature, omits patient acceptance signature and never prints internal patient notes. Existing Nome Cognome.pdf naming retained. Every archived quote has its own cryptographically random document number; legacy plan-based numbers are unchanged outside the archive.

## Persistence and failure handling

New public.preventivi table: tenant/author/source plan/patient, name/title/date/number, economic plan snapshot, immutable PDF data URI, archive flag and creation timestamp. No PDF payloads in list requests; file retrieval is on demand. Metadata search is server-side, scoped to studio and optional patient, paginated50. The same archive is available from main navigation, both patient record variants and appointment documents. Existing plan PDFs use the same file-delivery component. Poliedron quote cards delegate to it; prescription semantics are unchanged.

One stable UUID per document preparation makes archive retries INSERT ON CONFLICT DO NOTHING plus a verified read. UI retains a confirmed plan after archive failure; retry does not insert it again. Uncertain existing plan writes remain blocked until checked. Archive failure never falls back to unpersisted file sharing. Native user activation is preserved by separating preparation and sharing. No automatic retries and no claim of server transaction across plan and document writes. Closing during preparation/sharing is blocked by editor refs; account/network loss surfaces an error.

SELECT/INSERT and UPDATE(archiviato) only for authenticated. RLS uses authoritative app_metadata.studio_id and accessible source plan/patient, same tenant authority as inspected plans/patients policies. INSERT requires auth.uid author and matching patient/plan/studio. No SECURITY DEFINER, public links, service-role or tenant fallback. Content columns are not granted UPDATE; no client DELETE. Patient erasure cascades to quotes; deleting a source plan nulls its reference while retaining the immutable document for the existing patient. A detached document cannot be used to create a new version from that deleted plan.

## Release and rollback

Migration 20261103152923_preventivi_rapidi.sql must be applied in the controlled release before this UI is used. No backfill: old plans remain reachable and enter the document archive on preparation. Remote work so far is schema/policy metadata inspection only, never patient rows or writes. Database tests use an isolated PostgreSQL PGlite engine and synthetic schemas/records, including two tenants, no identity, wrong source, immutable content, soft archive, retry and deletion lifecycles. Local tests cannot prove live PostgREST privileges/deployment; controlled remote smoke after migration remains required.

Rollback UI by reverting the task PR; retain archive records. No destructive down migration. Do not drop the table to roll back a display change. No production deploy or merge before task-specific PO Mergia under repository workflow.

## Existing agenda CI adaptation
The appointment-workspace visual suite now asserts the approved direct quote dialog rather than its superseded inline-title shortcut. Its synthetic document client models tenant identity and immutable quote persistence, and the legacy-plan preview scenario explicitly prepares the archived document before entering/closing the PDF viewer and returning to the appointment draft. No weakening or skipping of the existing treatment/payment/medical-document/vertical scenarios.
