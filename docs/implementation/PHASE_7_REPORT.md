# Phase 7: PC Web and SQLite WASM Foundation

## Scope

Phase 7 enables the first PC Web foundation for DartsApp while keeping Expo SDK 54 and `expo-sqlite` 16.0.10.

Out of scope:

- PC landscape full redesign
- Rating calculation body
- Rating Snapshot update
- Award sound/video playback
- USB camera
- realtime scoring
- DartsSupportApp communication
- migration 004

## Investigation

Baseline versions:

- Node.js: `v24.18.0`
- npm: `11.16.0`
- Expo CLI: `54.0.25`
- Expo SDK dependency: `~54.0.0`
- `expo-sqlite`: `16.0.10`
- `expo-router`: `6.0.24`

Initial Web export failure:

```text
Unable to resolve module ./wa-sqlite/wa-sqlite.wasm
from node_modules/expo-sqlite/web/worker.ts
```

The WASM file exists at:

```text
node_modules/expo-sqlite/web/wa-sqlite/wa-sqlite.wasm
```

Root cause:

- Expo SDK 54 default Metro config did not include `.wasm` in `resolver.assetExts`.
- `expo-sqlite` Web imports the WASM from its worker, so Metro must treat it as a bundle asset.

## Implemented

- Product identity changed to DartsApp:
  - `package.json` name: `darts-app`
  - `app.json` name: `DartsApp`
  - `app.json` slug: `darts-app`
  - `app.json` scheme: `dartsapp`
- Native identifiers were intentionally preserved:
  - `ios.bundleIdentifier = com.shijimiworks.dartssupportapp`
  - `extra.eas.projectId = 7beb2425-048c-4a04-83ee-59846a446108`
  - `owner = shijimiworks`
- Web startup database error display was made explicit for Web DB initialization failures.
- Web development startup now uses a local COEP / COOP proxy:
  - `npm.cmd run web -- --port 8104 --clear`
  - Expo Web runs on an internal nearby port.
  - The requested port serves responses with `Cross-Origin-Embedder-Policy: credentialless` and
    `Cross-Origin-Opener-Policy: same-origin`.
- Static hosting headers were added via `public/_headers`.
- PC Web setup and QA docs were added.
- Web DB initialization fixes after device verification:
  - Web uses `withTransactionAsync` instead of unsupported `withExclusiveTransactionAsync`.
  - Native keeps `withExclusiveTransactionAsync`.
  - Game DB initialization is serialized by database file name so concurrent calls await the same
    Promise.
  - Failed initialization Promises are not cached permanently, allowing retry after reload.
  - SQLiteProvider `onError` state updates are deferred to the next tick to avoid React render-time
    update warnings.
  - Access Handle conflicts are mapped to user-facing guidance to close another DartsApp tab and
    reload.

Metro, Web export, browser smoke, and final validation results are recorded below.

## Web Headers

Required headers:

```text
Cross-Origin-Embedder-Policy: credentialless
Cross-Origin-Opener-Policy: same-origin
```

Development server and production hosting must both send these headers for SharedArrayBuffer-backed SQLite Web behavior.

Confirmed development responses:

- `http://localhost:8104`: `COEP=credentialless`, `COOP=same-origin`
- Entry bundle through `http://localhost:8104`: `COEP=credentialless`, `COOP=same-origin`

## Database

No migration 004 was added.

Expected database version remains:

```text
PRAGMA user_version = 3
```

Existing migration tests confirmed:

- migration 001 -> 002 -> 003
- migration idempotency
- `PRAGMA foreign_key_check` clean

## Baseline Validation

Before Phase 7 edits:

- `npm.cmd run typecheck`: PASS
- `npm.cmd run lint`: PASS
- `npm.cmd test`: PASS, 182 tests
- `npm.cmd run validate:data`: PASS

## Final Validation

- `npm.cmd run typecheck`: PASS
- `npm.cmd run lint`: PASS
- `npm.cmd run format:check`: PASS
- `npm.cmd test`: PASS, 195 tests
- `npm.cmd run validate:data`: PASS
- `npm.cmd run web -- --port 8104 --clear`: PASS
  - HTML response returned COEP / COOP headers.
  - Entry bundle response returned COEP / COOP headers.
- `npx.cmd expo export --platform web`: PASS
  - Exported `dist`.
  - Exported `expo-sqlite` WASM asset:
    `dist/assets/node_modules/expo-sqlite/web/wa-sqlite/wa-sqlite.783a2e11efab57e42036efde040ea8fd.wasm`
  - Exported worker bundle references the WASM asset URL.
- Chrome headless smoke: PASS, `<title>DartsApp</title>` confirmed.
- Edge headless smoke: PASS, `<title>DartsApp</title>` confirmed.
  - Edge emitted a Chromium renderer task-manager warning to stderr, but DOM retrieval succeeded.

## PR #9 Web DB Initialization Fix Validation

- `withExclusiveTransactionAsync is not supported on web` cause:
  - migration and write services called `withExclusiveTransactionAsync` directly.
  - Web now routes all game DB transactions through `runGameDatabaseTransaction`.
- Access Handle conflict cause:
  - Browser SQLite Web can hold a sync access handle per opened DB file.
  - Same-tab concurrent initialization is serialized in app code.
  - Another tab, reload overlap, or Chrome / Edge simultaneous open can still hit browser-level
    exclusive handle limits, so the technical error is converted to tab cleanup guidance.
- React warning cause:
  - SQLiteProvider could invoke `onError` while its own render path was active.
  - GameDatabaseProvider now defers error state updates with a microtask.

Validation after fix:

- `npm.cmd run typecheck`: PASS
- `npm.cmd run lint`: PASS
- `npm.cmd test`: PASS, 195 tests

## Known Alpha Limitations

- `expo-sqlite` Web support is alpha in Expo SDK 54.
- Browser site data deletion removes the local Web database.
- Static export output requires HTTP hosting with COEP / COOP headers.
- PC landscape UI optimization is deferred.
