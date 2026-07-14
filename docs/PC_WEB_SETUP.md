# DartsApp PC Web Setup

## Scope

Phase 7 targets Windows 11 PC Web startup for DartsApp.

Confirmed package baseline:

- Expo SDK: `~54.0.0`
- Expo CLI: `54.0.25`
- `expo-sqlite`: `16.0.10`
- `expo-router`: `6.0.24`
- Node.js: `v24.18.0`
- npm: `11.16.0`

Do not upgrade Expo SDK or `expo-sqlite` for this phase.

## Why Web Failed Before Phase 7

`expo-sqlite` Web imports this file from its worker:

```text
node_modules/expo-sqlite/web/wa-sqlite/wa-sqlite.wasm
```

The file exists, but Expo SDK 54 default Metro config did not include `.wasm` in `resolver.assetExts`.
The Web export failed while resolving:

```text
node_modules/expo-sqlite/web/worker.ts
import wasmModule from './wa-sqlite/wa-sqlite.wasm';
```

Phase 7 fixes this by extending Expo's default Metro config instead of modifying `node_modules`.

Development startup also wraps Expo's Web dev server with a local Node proxy. The proxy keeps
`expo start --web` as the internal bundler and adds the response headers required by SQLite Web on
the public port requested by `npm.cmd run web`.

## Development Start

Use Windows PowerShell commands:

```powershell
npm.cmd run web -- --port 8104 --clear
```

Open:

```text
http://localhost:8104
```

Expected development headers:

```text
Cross-Origin-Embedder-Policy: credentialless
Cross-Origin-Opener-Policy: same-origin
```

Implementation notes:

- `scripts/start-web-with-headers.cjs` starts Expo Web on an internal nearby port.
- The requested port, for example `8104`, serves a proxy response with COEP / COOP headers.
- `metro.config.js` only extends the default resolver so `.wasm` is treated as an asset.

In the browser console:

```js
window.crossOriginIsolated === true;
typeof SharedArrayBuffer !== 'undefined';
```

## Production Export

```powershell
npx.cmd expo export --platform web
```

Evaluate export output over HTTP. Do not evaluate with `file://`.

If using a simple local static server, the server must send the same headers:

```text
Cross-Origin-Embedder-Policy: credentialless
Cross-Origin-Opener-Policy: same-origin
```

## Hosting Headers

Static files cannot set COEP / COOP by themselves. Configure the hosting server or CDN.

Example header policy:

```text
/*
  Cross-Origin-Embedder-Policy: credentialless
  Cross-Origin-Opener-Policy: same-origin
```

Phase 7 includes `public/_headers` for hosting providers that read this file during static deployment. For EAS Hosting or another provider, confirm that equivalent response headers are applied to HTML, JS, worker, and WASM assets.

## Web Database Notes

`expo-sqlite` Web support is alpha in Expo SDK 54. The database is persisted by browser storage. Clearing browser site data creates a fresh local database.

Minimum DB checks:

1. DB initializes without a white screen.
2. migration 001 -> 002 -> 003 applies.
3. `PRAGMA user_version = 3`.
4. `PRAGMA foreign_key_check` returns no rows.
5. Account can be created and restored after reload.
6. Game Hub loads and game routes can access SQLite-backed state.

## Known Limitations

- PC landscape visual optimization is deferred.
- Rating calculation body and Rating Snapshot update are deferred.
- Award sound/video playback is deferred.
- USB camera and realtime scoring are deferred.
- DartsSupportApp communication and cloud sync are not implemented.
