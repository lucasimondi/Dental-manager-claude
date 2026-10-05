# POL-AI-010-PWA — Poliedron sul telefono

## Product Owner direction

2026-10-05: dedicated phone icon opening the existing Poliedron conversation;
prioritize this entry before the document increment. Product Owner: “Allora vai
costruisci bene che funzioni che sia fluido”. This implementation covers the
installable entry, dictation and mobile conversation interaction. It does not
claim to deliver background push or to outperform WhatsApp's response latency.

## Entry and identity

- `/poliedron/` and `/poliedron` launch the existing `App` with `page=chat`.
- `poliedron/index.html` is a second Vite entry, sharing the existing app bundle.
  A post-transform removes the main app manifest injected by vite-plugin-pwa.
- `public/poliedron.webmanifest`: distinct `id=/poliedron/`, name Poliedron,
  standalone display, launch URL `/poliedron/`. Scope `/` keeps existing modules
  inside the installed app. Existing Poliedra identity/launch stay unchanged.
- Own 180/192/512/maskable icons derive from the approved geometric Poliedron mark.
- Vercel rewrites route the two launch paths to the dedicated HTML. Hosting remains
  Vercel; no deployment architecture change.
- The existing root service worker is shared. Workbox's navigation fallback can
  serve the root HTML even for this entry; bootstrap restores the dedicated title,
  manifest (deduplicated) and touch icon before React mounts.
- Manager patient-sheet navigation is neither restored nor overwritten by this
  dedicated entry. It opens chat on each cold launch, including after login.
- Same login, session, studio, AI gates, conversation repository, executor,
  confirmation system and activity log. No second agent or conversation.
- Hide dock/sidebar on dedicated chat. All allowed modules remain reachable;
  a dedicated return control brings the user back to the same chat.

## Interaction

- The composer clears and shows an optimistic user bubble immediately, before
  waiting for persistence/model latency. The bubble disappears when the persisted
  message arrives or the send finishes; never label a local bubble as executed.
- A synchronous ref lock prevents rapid duplicate taps. Existing controller guards
  and backend anti-replay remain authoritative.
- New text typed during a response is preserved. On rejection/exception restore
  the original only if no newer draft exists. No automatic resend or offline queue.
- Offline state disables send/retry and explains that the draft can be sent once
  connection returns. Draft is component memory, not patient content in a cache.
- Textarea grows to 120px and uses 16px text, avoiding input-focus zoom. IME
  composition does not submit on Enter. Scroll follows new messages near the bottom,
  preserving the existing older-message pagination.
- VisualViewport resize/scroll updates the dedicated shell via an animation frame.
  Pinch zoom is excluded. Without that API, `100dvh` is the fallback. Composer and
  message list stay separate; phone safe areas do not reserve space for the hidden
  manager dock.
- Read acknowledgement runs only when the document is visible.

## Dictation and installation

- User-initiated `SpeechRecognition`/`webkitSpeechRecognition`, Italian, final text
  only. The transcript becomes an editable draft and is never sent automatically.
- Permission/network/no-speech failures get actionable text. If unsupported, the
  control explains use of the phone keyboard microphone. Stop/abort on background
  and cleanup on unmount. Browser recognition may use the browser vendor's remote
  service; this is not a new Poliedra audio-storage endpoint.
- Android install prompt is used when provided by the browser; otherwise show
  explicit iPhone Safari/Android Home-screen instructions. Installed mode hides
  the prompt. No automatic permission prompts.

## Validation (2026-10-05)

- `npm test`: 909/909, including six new behaviour/manifest tests for launch path,
  viewport, dictation text, serialized send, preserving drafts and uncertain send.
- `npm run build`: PASS, both HTML entries; existing large-chunk warning remains.
- Browser: real rendered Chat component with synthetic records, Chromium 153,
  375/768/1024/1440. No horizontal overflow or clipped composer; 16px input;
  immediate bubble, no duplicate send, new draft preserved: PASS.
- Synthetic keyboard viewport 410px: composer visible; offline disables send and
  retains draft; injected speech result editable and sends zero actions; manual
  install guidance; no page JS errors: PASS.
- Built-entry login/manifest/offline shell checks recorded in the handoff.
- Visual screenshots inspected at 375px and keyboard height. Temporary harness
  removed; no real patient records, authenticated production calls or writes.

Remaining release verification: iPhone Safari and installed Home-screen app with
real keyboard/voice permissions and authenticated staging/PO smoke. Chromium
simulation is not an iOS test. End-to-end AI action correctness stays governed by
the existing POL-AI-010 backend tests and requires a real authorized smoke.

## Release and rollback

Frontend-only release via reviewed PR merge, subject to Product Owner approval.
No migrations, secrets, provider setup or Edge deployments for this increment.
After release: open the existing production origin + `/poliedron/`, log in,
install from Safari/Android, then test a synthetic/authorized appointment and log.
Rollback by reverting this frontend commit; no business data is removed.

## Next increment: background push

Not implemented or shown as enabled. True push delivery while the app is closed
needs per-user/device subscriptions, tenant-scoped storage, VAPID server secrets,
revocation/logout handling, server-originated events and service-worker handlers.
Use generic lock-screen text and fetch detail only after login. Do not replace
this with Realtime while the page is open or with browser notifications generated
from client-owned business changes. Coordinate with the existing action log and
appointment/recall sources; do not invent a second event history.


## Mobile layout revision — WhatsApp reference (2026-10-05)

Product Owner rejected the first mobile layout and requested WhatsApp as the principal reference. The dedicated entry now uses one 64px header, an overflow menu for installation/activity/allowed modules, compact message bubbles with dates and readable timestamps, a growing composer with 46px touch controls, and a latest-message button. No extra chat engine or dependency was introduced; Chatscope's MIT React chat toolkit and WhatsApp's official messaging page were consulted as references. Poliedra's existing blue palette remains.

Full App browser QA uncovered a concrete regression missed by isolated Chat QA: `CanonicalFinancialWidget.css` imports `PremiumVisualSystem.css` again, after phone styles, restoring the manager's 92px bottom dock padding. Dedicated phone selectors now have enough specificity to survive that import. The browser check requires the composer bottom to equal the viewport bottom, rather than merely remain inside it. The list uses an explicit flex chain and preserves its latest position across input/viewport resizing while allowing the reader to browse history. Invalid pinch-zoom viewport readings keep the last valid bounds.

### Reproducible browser checks

With Playwright and its Chromium installed in the development environment (optional QA tooling, no production dependency), run:

```sh
node tests/browser/poliedron-mobile.cjs
```

The runner starts its own local Vite server, renders the real App/portal/styles with `tests/fixtures/poliedron-phone-app.jsx`, substitutes synthetic session/data/model replies, and blocks every non-local request. The temporary HTML is removed on completion; screenshots go to the OS temporary directory, configurable with `POLIEDRON_QA_OUTPUT`. A custom browser can be selected with `POLIEDRON_CHROMIUM_EXECUTABLE`; serverless Chromium arguments can optionally come from `POLIEDRON_CHROMIUM_PACKAGE`. Run only one instance at a time (port 5177). No business records or production credentials are used.

Validation: Chromium 153 at 320×568, 375×812, 390×844, 430×932, 844×390, 768×1024, 1024×768 and 1440×900. Assertions cover header/composer bounds, absence of the 92px gap and horizontal overflow, long/multiline messages, menu/Escape/activity, latest-message scroll, synthetic model send/persistence and preservation of the next draft, a 330px visual viewport with the layout viewport intact, offline sending, editable simulated dictation without automatic sending, install help, module navigation/return, and separate empty/schema-error states. Phone and keyboard screenshots were visually inspected.

Limits: Chromium simulation is not an iPhone/Android hardware test or an authenticated backend smoke test. Real Safari keyboard, microphone permissions, installed safe-area behavior and provider latency still require device verification before release. Push remains a separate backend increment. Frontend release/merge still requires explicit Product Owner approval under AGENTS.md.
