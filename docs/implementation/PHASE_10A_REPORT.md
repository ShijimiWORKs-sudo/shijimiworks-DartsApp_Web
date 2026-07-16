# Phase 10A Report: Camera Capture Foundation

## Scope

- Web / iPhone Expo Go向けの静止画撮影基盤を追加
- `expo-camera` の `CameraView` と `useCameraPermissions` を使用
- Game Hubから `/camera` へ遷移し、撮影、レビュー、採用確認までを実装
- Webではbase64画像、Nativeではcache URIを画面セッション内だけで扱う

## Public API

- `CameraPermissionState`
- `CameraFacing`
- `CameraRuntimePlatform`
- `CapturedBoardImage`
- `CameraAvailabilityState`
- `checkCameraAvailability`
- `resolveCameraPermissionState`
- `createCameraPictureOptions`
- `createCapturedBoardImage`
- `useCameraSession`

## Routes

- `/camera`
- `/camera/capture`
- `/camera/review`
- `/camera/accepted`

## Lifecycle

- 初期カメラはback
- `onCameraReady` 前は撮影不可
- 前面/背面切替後はreadyをfalseに戻し、再度readyを待つ
- `CameraView`は撮影画面で1つだけmount
- 画面離脱時はfocus cleanupによりready/capturingを初期化し、CameraViewをunmount

## Explicit Non-Goals

- スコア判定
- 画像認識
- OpenCV / ML
- 音声 / 動画録画
- 撮影画像のDB保存
- 撮影画像のクラウド送信
- Rating関連変更
- migration追加

## Database

- migration追加なし
- `PRAGMA user_version = 3` を維持
- 撮影画像、base64、cache URIはSQLiteへ保存しない
