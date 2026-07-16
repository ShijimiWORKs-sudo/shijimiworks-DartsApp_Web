import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

const root = process.cwd();

function readRepoFile(relativePath: string) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

test('camera routes expose intro, capture, review, accepted, LAN host, Camera Node, and local camera screens', () => {
  assert.match(readRepoFile('app/camera/index.tsx'), /カメラ撮影テスト/);
  assert.match(readRepoFile('app/camera/home.tsx'), /カメラPC単体モード/);
  assert.match(readRepoFile('app/camera/capture.tsx'), /CameraView/);
  assert.match(readRepoFile('app/camera/review.tsx'), /撮影結果/);
  assert.match(readRepoFile('app/camera/accepted.tsx'), /撮影完了/);
  assert.match(readRepoFile('app/camera/lan.tsx'), /LAN Camera 接続/);
  assert.match(readRepoFile('app/camera/node.tsx'), /Camera Node/);
  assert.match(readRepoFile('app/camera/local-game/index.tsx'), /このPCでゲーム/);
  assert.match(readRepoFile('app/camera/local-count-up/settings.tsx'), /カメラCOUNT-UP設定/);
  assert.match(readRepoFile('app/camera/calibration.tsx'), /Camera Calibration/);
  assert.match(readRepoFile('app/camera/awards/index.tsx'), /Award確認/);
});

test('camera capture screen uses CameraView and useCameraPermissions through session hook', () => {
  const captureRoute = readRepoFile('app/camera/capture.tsx');
  const sessionHook = readRepoFile('features/camera/ui/useCameraSession.ts');

  assert.match(captureRoute, /<CameraView/);
  assert.match(sessionHook, /useCameraPermissions/);
  assert.match(sessionHook, /CameraView\.isAvailableAsync/);
  assert.match(sessionHook, /onCameraReady|markCameraReady/);
  assert.match(sessionHook, /setIsReady\(false\)/);
});

test('camera foundation does not persist images to sqlite or call recognition libraries', () => {
  const cameraSource = [
    readRepoFile('app/camera/index.tsx'),
    readRepoFile('app/camera/capture.tsx'),
    readRepoFile('app/camera/review.tsx'),
    readRepoFile('app/camera/accepted.tsx'),
    readRepoFile('features/camera/application/CameraCaptureService.ts'),
    readRepoFile('features/camera/application/cameraSession.ts'),
    readRepoFile('features/camera/ui/useCameraSession.ts'),
  ].join('\n');

  assert.doesNotMatch(cameraSource, /sqlite|insert|update|delete|OpenCV|TensorFlow|ML Kit/i);
  assert.doesNotMatch(cameraSource, /fetch\(|XMLHttpRequest|WebSocket|Supabase/i);
});

test('Game Hub links to camera capture test without changing game mode routes', () => {
  const gameHub = readRepoFile('app/game/index.tsx');

  assert.match(gameHub, /router\.push\('\/camera\/lan'\)/);
  assert.match(gameHub, /router\.push\('\/game\/count-up\/settings'\)/);
  assert.match(gameHub, /router\.push\('\/game\/01\/settings'\)/);
  assert.match(gameHub, /router\.push\('\/game\/cricket\/settings'\)/);
  assert.match(gameHub, /router\.push\('\/game\/match\/settings'\)/);
});

test('app config declares expo-camera plugin and camera permission copy', () => {
  const appConfig = readRepoFile('app.json');

  assert.match(appConfig, /"expo-camera"/);
  assert.match(appConfig, /"cameraPermission"/);
  assert.match(appConfig, /NSCameraUsageDescription/);
});

test('LAN camera node is the only LAN route mounting CameraView', () => {
  const lanHostRoute = readRepoFile('app/camera/lan.tsx');
  const nodeRoute = readRepoFile('app/camera/node.tsx');

  assert.doesNotMatch(lanHostRoute, /<CameraView/);
  assert.match(nodeRoute, /<CameraView/);
  assert.match(nodeRoute, /localhost/);
});

test('LAN camera scripts expose relay, camera node, and game PC web ports', () => {
  const packageJson = readRepoFile('package.json');

  assert.match(packageJson, /"camera:relay"/);
  assert.match(packageJson, /8120/);
  assert.match(packageJson, /"camera:node"/);
  assert.match(packageJson, /8110/);
  assert.match(packageJson, /"web:lan-main"/);
  assert.match(packageJson, /8112/);
});
