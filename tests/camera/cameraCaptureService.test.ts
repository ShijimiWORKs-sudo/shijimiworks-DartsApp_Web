import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  checkCameraAvailability,
  createCameraPictureOptions,
  createCapturedBoardImage,
  getCameraRuntimePlatform,
  getNextCameraFacing,
  resolveCameraPermissionState,
} from '../../features/camera/application/CameraCaptureService';

test('camera permission state separates loading, granted, denied, blocked, unavailable, and error', () => {
  assert.equal(resolveCameraPermissionState(null, 'checking'), 'loading');
  assert.equal(resolveCameraPermissionState(null, 'unavailable'), 'unavailable');
  assert.equal(resolveCameraPermissionState(null, 'error'), 'error');
  assert.equal(
    resolveCameraPermissionState({ granted: true, canAskAgain: false }, 'available'),
    'granted',
  );
  assert.equal(
    resolveCameraPermissionState({ granted: false, canAskAgain: true }, 'available'),
    'denied',
  );
  assert.equal(
    resolveCameraPermissionState({ granted: false, canAskAgain: false }, 'available'),
    'blocked',
  );
});

test('camera availability checker converts platform failures into error state', async () => {
  assert.equal(await checkCameraAvailability(async () => true), 'available');
  assert.equal(await checkCameraAvailability(async () => false), 'unavailable');
  const originalWarn = console.warn;
  console.warn = () => undefined;
  try {
    assert.equal(
      await checkCameraAvailability(async () => {
        throw new Error('camera unavailable');
      }),
      'error',
    );
  } finally {
    console.warn = originalWarn;
  }
});

test('camera capture starts with back camera and switches between front and back', () => {
  assert.equal(getNextCameraFacing('back'), 'front');
  assert.equal(getNextCameraFacing('front'), 'back');
});

test('web capture requests base64 while native capture uses cache URI only', () => {
  assert.equal(createCameraPictureOptions('web').base64, true);
  assert.equal(createCameraPictureOptions('ios').base64, false);
  assert.equal(createCameraPictureOptions('android').base64, false);
});

test('captured board image keeps web base64 in memory metadata and never marks native cache URI as base64', () => {
  const webImage = createCapturedBoardImage({
    picture: {
      uri: 'data:image/jpeg;base64,abc',
      width: 1280,
      height: 720,
      base64: 'abc',
      format: 'jpg',
    },
    facing: 'back',
    platform: 'web',
    now: new Date('2026-07-16T00:00:00.000Z'),
    id: 'image-1',
  });

  assert.equal(webImage.base64Included, true);
  assert.equal(webImage.platform, 'web');
  assert.equal(webImage.facing, 'back');

  const nativeImage = createCapturedBoardImage({
    picture: {
      uri: 'file:///cache/camera.jpg',
      width: 1080,
      height: 1440,
      format: 'jpg',
    },
    facing: 'front',
    platform: 'ios',
    now: new Date('2026-07-16T00:00:00.000Z'),
    id: 'image-2',
  });

  assert.equal(nativeImage.base64Included, false);
  assert.equal(nativeImage.uri, 'file:///cache/camera.jpg');
});

test('runtime platform is limited to supported camera targets', () => {
  assert.equal(getCameraRuntimePlatform('ios'), 'ios');
  assert.equal(getCameraRuntimePlatform('android'), 'android');
  assert.equal(getCameraRuntimePlatform('web'), 'web');
  assert.equal(getCameraRuntimePlatform('windows'), 'web');
});
