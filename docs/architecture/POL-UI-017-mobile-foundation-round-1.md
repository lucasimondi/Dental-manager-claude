# POL-UI-017 — Round 1 mobile foundation and shell

## Scope

Round 1 establishes the shared mobile foundation only. It does not redesign product pages, change domain logic, alter database contracts, or replace the specialized Agenda and Chat mobile shells.

## Mobile shell rule

The application uses viewport capability, never user-agent detection:

- portrait and narrow layouts are mobile below 720 CSS pixels;
- short landscape layouts are mobile when the primary pointer is coarse, width is at most 1024 CSS pixels, and height is at most 600 CSS pixels;
- all other layouts retain the desktop shell.

Normal mobile pages must reserve physical space for the bottom dock, including the safe-area inset. Specialized full-screen surfaces such as Agenda and Chat own their scrolling and dock relationship and are excluded from the normal-page reservation rule.

## Shared contracts

- Interactive controls have a minimum 44 by 44 CSS pixel target.
- Page chrome exposes a back action, one primary action, and an overflow area for secondary actions.
- Shared loading, empty, and error states use accessible live/status semantics.
- Mobile dialogs support `standard`, `bottom-sheet`, and `fullscreen` variants, dynamic viewport units, safe-area padding, and keyboard inset accommodation.
- Shared spacing uses the 4, 8, 12, 16, 24, and 32 CSS pixel scale.
- Semantic corner radii are 10 pixels for controls, 14 pixels for cards, and 20 pixels for sheets.

## Round 1 exclusions

- No page-by-page mobile redesign.
- No changes to Agenda or Chat specialized mobile layouts.
- No Patient Workspace integration.
- No database, migration, authentication, or authorization changes.
- No production deployment.
