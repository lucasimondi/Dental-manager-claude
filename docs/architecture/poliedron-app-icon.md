# POL-AI-010-ICON — approved phone icon

PO approved the blue/turquoise faceted gem proposal on 2026-10-06: “Ok, produci”.
This is an exact mechanical export of that raster, not a new logo generation.

## Assets and identity

- `public/poliedron-v2-180.png`: iPhone apple-touch icon.
- `public/poliedron-v2-192.png`: Android small icon and dedicated favicon.
- `public/poliedron-v2-512.png`: Android large icon.
- `public/poliedron-v2-maskable-512.png`: same full-bleed opaque artwork, maskable purpose.
- Dedicated HTML, manifest and offline bootstrap use the same v2 assets.
- Root Poliedra brand, manifest, PWA ID/start URL/scope and backend are unchanged.
- Old icons remain available; versioned URLs avoid reusing old asset-cache keys.

The faceted symbol stays within the central 80%-diameter safe circle. No rounded
corners or OS mask are baked into the PNG. Visual QA at 60px, circular and rounded
masks preserves the gem. This does not substitute for physical-device testing.

## Provenance and reproduction

Approved source: 1254×1254 PNG, opaque blue gradient background and turquoise gem.
Source SHA-256: `79debcb8fbea607c5be9d474cda2fc6938ca91826ab6e9b1055274a0d8e182c2`.
The approved original is the image delivered in the conversation; it is not
bundled in the app. Re-export using ImageMagick 6:

```sh
bash scripts/export-poliedron-icon.sh /absolute/path/to/approved-square.png
```

Lanczos resize, sRGB, opaque RGB8 PNG; metadata removed. No crop or redesign.
512px and maskable SHA-256:
`d25b8829b9c52c93db85d6fa69568f07c1412fd1178fdfe930c0fe9a2eba7c10`.

## Verification and release

`npm test`: 939/939 PASS, including two icon regression checks.
`npm run build`: PASS with existing bundle-size warning.
All four v2 icons are present in `dist` and Workbox precache.
`git diff --check`: PASS. No physical installation/live authenticated smoke claimed.

Merge requires PO approval. After release, check a fresh Home-screen install on
iPhone and Android; existing installed-icon refresh is OS-dependent and not
verified here. Revert this frontend commit to restore old references: no data
rollback, migration, Edge deploy, permission or financial change required.
