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

## Export

- [ ] `npx.cmd expo export --platform web`
- [ ] Export completes
- [ ] Export output includes the SQLite WASM asset
- [ ] Export output references the WASM through a valid URL
- [ ] Export output runs over HTTP with COEP / COOP headers

## Deferred

- PC landscape polish is not a Phase 7 pass/fail item.
- Rating calculation body is not implemented in Phase 7.
- Award sound/video playback is not implemented in Phase 7.
- USB camera and realtime scoring are not implemented in Phase 7.
