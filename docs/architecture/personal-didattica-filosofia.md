# PERSONAL-DIDATTICA-FILOSOFIA

PO requested a philosophy teaching section starting with an index and the first developed chapters. Location: Poliedron Personal → Biblioteca → Filosofia; Home card next to Amor fati plus header bookshelf icon. The main dock is unchanged.

## Implementation

`personal/src/sezioni/didattica/index.jsx` registers a deferred read-only reader. Its original Italian curriculum/content lives in `filosofia.js`: 40 indexed chapters, seven parts, five developed lessons (introduction, myth/reason, India/China, Milesians, Pythagoreans). Unwritten chapters explicitly say Da sviluppare and have no active reading control. Predominantly Western historical spine, explicitly disclosed, with introductions to other traditions. External reading references, primary works and scholarly commentary; historical uncertainty and editorial modern examples are distinguished. Corrected an unresolvable Upanishads reference to the verified IEP entry.

Search filters chapter titles and period; chapter navigation only visits written lessons. Focus moves to heading on chapter changes. Native document scrolling; no fixed viewport, gesture interception or editor. Large text toggle, mobile layout, source links with noopener, direct diary link for reflection. No user notes or saved reading progress in this first version. No new dependency, database write, Auth, RLS, schema, Studio behavior or deployment architecture change. The reader/content bundle loads only on entry. Shared Home-card style is in Personal CSS.

## Verification and release

Full existing Node suite and both production entry builds required. Section registry test updated for the new section. Browser attempt reached preview host check; subsequent observation was rejected by browser URL policy. No alternative browser path used. Synthetic temporary fixture and allowedHosts override removed; no visual/mobile/touch claim. No production user or archive content read or mutated.

Dedicated PR, WAITING_PRODUCT_OWNER; merge only with approval under AGENTS.md. Rollback: revert PR. Diary records and immutable stable checkpoints remain unchanged.
