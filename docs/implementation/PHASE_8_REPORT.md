# Phase 8: PC Landscape Game UI

## Scope

Phase 8 optimizes DartsApp PC Web game screens for landscape use without changing game rules, SQLite schema, migration version, Account persistence, Rating calculation, audio/video, or camera behavior.

## Layout Contract

- Desktop Web breakpoint: `>= 1024px`
- Compact PC target: `1280x720`
- Wide PC target: `1920x1080`
- Default desktop max content width: `1440px`
- Wide desktop max content width: `1680px`
- Web primary navigation: HOME / GAME / ACCOUNT
- Expo Go and narrow Web fallback: existing BottomNav and stacked screen layout

## Implemented

- Added `components/web/webLayout.ts` for shared breakpoint, content width, and navigation rules.
- Added `WebTopNavigation` and connected it through `ScreenShell` for desktop Web only.
- Preserved BottomNav for Expo Go and narrow Web.
- Added `WebGameShell` for PC two-column game screens.
- Updated COUNT-UP, 01, STANDARD CRICKET, and MATCH play screens to place score/status on the left and input/actions on the right.
- Updated game settings, CHOICE, and result actions for PC horizontal operation.
- Updated Game Hub mode selection to use a PC two-column layout.
- Updated Account action rows for PC Web while preserving Account save/restore flows.

## Database

- No migration 004 was added.
- Expected database version remains `PRAGMA user_version = 3`.
- Phase 7 SQLite Web WASM and transaction initialization behavior was not changed.

## Out of Scope

- Rating calculation body and Rating Snapshot updates
- Award sound/video playback
- USB camera and realtime scoring
- Keyboard shortcut/fullscreen optimization
- DartsSupportApp communication

## Validation

Final validation results are recorded in the PR completion report.
