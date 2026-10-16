# POL-VITA-010 — Comparative iPhone validation

Baseline: `4252c0431f7cdc0a08828d441a33d6c77d6f2e78` (original Studio agenda before extraction).

Each comparison is ordered **original Studio | shared Studio | Personal**, at the same dimensions, date, synthetic events and browser clock. Studio screenshots use its original mobile dock component. Personal uses its production shell classes and icon components. All remote requests are intercepted; no production data is used or written.

These are Playwright mobile/touch viewport tests on Chromium 153 and WebKit 26.5 (the Safari engine), not photographs or tests on a physical iPhone. Native production login and production writes are not exercised.

## Matrix

| Viewport | Views | Engines |
| --- | --- | --- |
| 375 × 812 | Day, Week, Month | Chromium, WebKit |
| 390 × 844 | Day, Week, Month | Chromium, WebKit |
| 430 × 932 | Day, Week, Month | Chromium, WebKit |
| 390 × 844, configured | Week, 07–22, 15-minute slots, hidden weekend | Chromium, WebKit |

## Assertions

- Exact page, strip, grid, time-gutter, month-surface geometry across original Studio, shared Studio and Personal.
- Pixel regression against original Studio: no changed pixels outside the newly authorized switch and its shadow (per-channel tolerance 2/255).
- Pixel equality between Studio and Personal in the day strip/timeline region or month calendar region. App-specific toolbar actions, docks, switches and clinical row actions are intentionally outside this shared-calendar comparison.
- No horizontal page overflow; no overlap between dock, FAB and application switch.
- Timeline scrolls beneath floating controls; opening the original Studio appointment menu still works.
- Personal clinical appointment opens read-only; real personal-event form saves through the existing adapter using a mocked request.
- Horizontal grid gestures move forward/back; Month → Day changes keep the scroll container measurable.
- Independent selected-day/displayed-month state and both production/preview switch destinations are covered by unit tests.

## Local checks

- `npm test`: 1,270 passed, 0 failed.
- `npm run build`: passed.
- `npm run build:personal`: passed.
- `git diff --check`: passed.
- No schema, RLS, Edge Function or production changes.

Existing duplicate-key/build-size/pdfjs warnings remain outside this extraction. PR CI separately reruns Node/build and the browser matrix. Reviewed comparisons are kept in this directory; raw screenshots and metrics are available in the CI artifact `agenda-iphone-comparisons`.

## Reviewed comparisons

- [chromium · 375 · giorno](chromium-375-giorno-comparison.png)
- [chromium · 375 · settimana](chromium-375-settimana-comparison.png)
- [chromium · 375 · mese](chromium-375-mese-comparison.png)
- [chromium · 390 · giorno](chromium-390-giorno-comparison.png)
- [chromium · 390 · settimana](chromium-390-settimana-comparison.png)
- [chromium · 390 · mese](chromium-390-mese-comparison.png)
- [chromium · 430 · giorno](chromium-430-giorno-comparison.png)
- [chromium · 430 · settimana](chromium-430-settimana-comparison.png)
- [chromium · 430 · mese](chromium-430-mese-comparison.png)
- [chromium · 390 · settimana con impostazioni studio](chromium-390-settimana-configured-comparison.png)
- [webkit · 375 · giorno](webkit-375-giorno-comparison.png)
- [webkit · 375 · settimana](webkit-375-settimana-comparison.png)
- [webkit · 375 · mese](webkit-375-mese-comparison.png)
- [webkit · 390 · giorno](webkit-390-giorno-comparison.png)
- [webkit · 390 · settimana](webkit-390-settimana-comparison.png)
- [webkit · 390 · mese](webkit-390-mese-comparison.png)
- [webkit · 430 · giorno](webkit-430-giorno-comparison.png)
- [webkit · 430 · settimana](webkit-430-settimana-comparison.png)
- [webkit · 430 · mese](webkit-430-mese-comparison.png)
- [webkit · 390 · settimana con impostazioni studio](webkit-390-settimana-configured-comparison.png)
