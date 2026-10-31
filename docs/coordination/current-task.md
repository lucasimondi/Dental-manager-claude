# Current task — PERSONAL-DIARIO-NATIVE-SCROLL (2026-10-31)
- OWNER: Codex; branch codex/diario-native-scroll from master a49a79f.
- AUTHORIZATION: PO reports diary still does not scroll/freezes after full-screen release. Correct scrolling/editor/turn recovery.
- SCOPE: native document scroll and touch-gesture cancellation; keep full-screen appearance, 3D turns, dates, photos, search and existing persistence. No schema or data mutation.
- STATUS: WAITING_PRODUCT_OWNER. Node tests1479/1479, Personal/Studio builds and diff check pass. Synthetic browser long-page scroll/rendering/write/search checked; no physical-device claim. Separate merge approval required.
- ROLLBACK: revert dedicated PR, preserve diary rows.
