# DartsApp PC Web QA Checklist

## Environment

- [ ] Windows 11
- [ ] Google Chrome stable
- [ ] Microsoft Edge stable
- [ ] Resolution: 1280x720
- [ ] Resolution: 1920x1080
- [ ] Mouse operation
- [ ] Keyboard does not block basic operation

## Startup

- [ ] `npm.cmd run web -- --port 8104 --clear`
- [ ] No white screen
- [ ] No `wa-sqlite.wasm` resolve error
- [ ] Worker starts
- [ ] `window.crossOriginIsolated === true`
- [ ] `typeof SharedArrayBuffer !== 'undefined'`
- [ ] COEP header is `credentialless`
- [ ] COOP header is `same-origin`

## SQLite

- [ ] DB initializes
- [ ] migration 001 -> 002 -> 003 applies
- [ ] `PRAGMA user_version = 3`
- [ ] `PRAGMA foreign_key_check` returns no rows
- [ ] Account can be created
- [ ] Account profile reloads
- [ ] Account restores after browser reload
- [ ] Browser site data deletion creates a fresh database

## Game Routes

- [ ] Game Hub displays
- [ ] Web top navigation displays HOME / GAME / ACCOUNT at 1024px and wider
- [ ] Support BottomNav is not shown as the primary navigation at 1280x720 Web
- [ ] Expo Go / narrow Web keeps the existing BottomNav
- [ ] COUNT-UP button displays
- [ ] 01 GAME button displays
- [ ] STANDARD CRICKET button displays
- [ ] MATCH button displays
- [ ] COUNT-UP can start and save one dart
- [ ] COUNT-UP pause / resume works
- [ ] 01 settings route loads
- [ ] CRICKET settings route loads
- [ ] MATCH settings route loads
- [ ] MATCH active route loads when a MATCH exists

## PC Landscape UI

- [ ] 1280x720: Home primary content is readable without horizontal overflow
- [ ] 1280x720: Game Hub mode buttons are visible in a two-column layout
- [ ] 1280x720: COUNT-UP play shows score/status left and dart input/actions right
- [ ] 1280x720: 01 play shows remaining score/status left and dart input/actions right
- [ ] 1280x720: STANDARD CRICKET play shows targets/status left and dart input/actions right
- [ ] 1280x720: MATCH play shows game/player status left and input/actions right
- [ ] 1280x720: COUNT-UP / 01 / CRICKET / MATCH result screens use a bounded card grid
- [ ] 1920x1080: content remains bounded and is not overstretched
- [ ] Mobile fallback: narrow Web returns to stacked layout

## Export

- [ ] `npx.cmd expo export --platform web`
- [ ] Export completes
- [ ] Export output includes the SQLite WASM asset
- [ ] Export output references the WASM through a valid URL
- [ ] Export output runs over HTTP with COEP / COOP headers

## Deferred

- Rating calculation body is not implemented in Phase 7.
- Award sound/video playback is not implemented in Phase 7.
- USB camera and realtime scoring are not implemented in Phase 7.
