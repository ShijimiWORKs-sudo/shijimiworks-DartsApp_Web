import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  checkCameraAvailability,
  createCameraPictureOptions,
  createCapturedBoardImage,
  getCameraRuntimePlatform,
  getNextCameraFacing,
  normalizeCapturedImageSource,
  parseDataUri,
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

test('captured board image keeps web image source metadata and never marks native cache URI as base64', () => {
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
  assert.equal(webImage.mimeType, 'image/jpeg');
  assert.equal(webImage.sourceKind, 'data-uri');
  assert.equal(webImage.dataUri, 'data:image/jpeg;base64,abc');
  assert.equal(webImage.rawBase64, 'abc');
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
  assert.equal(nativeImage.sourceKind, 'file-uri');
});

test('runtime platform is limited to supported camera targets', () => {
  assert.equal(getCameraRuntimePlatform('ios'), 'ios');
  assert.equal(getCameraRuntimePlatform('android'), 'android');
  assert.equal(getCameraRuntimePlatform('web'), 'web');
  assert.equal(getCameraRuntimePlatform('windows'), 'web');
});

test('captured image source normalization preserves data URI and MIME without double prefix', () => {
  const jpegFromUri = createCapturedBoardImage({
    picture: {
      uri: 'data:image/jpeg;base64,/9j/abc',
      width: 1280,
      height: 720,
      format: 'jpg',
    },
    facing: 'back',
    platform: 'web',
    now: new Date('2026-07-16T00:00:00.000Z'),
    id: 'jpeg-uri',
  });
  const normalizedJpeg = normalizeCapturedImageSource(jpegFromUri);
  assert.equal(normalizedJpeg.src, 'data:image/jpeg;base64,/9j/abc');
  assert.equal(normalizedJpeg.mimeType, 'image/jpeg');
  assert.equal(normalizedJpeg.encoding, 'data-uri');

  const pngFromUri = createCapturedBoardImage({
    picture: {
      uri: 'data:image/png;base64,iVBORw0KGgoAAA',
      width: 640,
      height: 480,
      format: 'png',
    },
    facing: 'back',
    platform: 'web',
    now: new Date('2026-07-16T00:00:00.000Z'),
    id: 'png-uri',
  });
  const normalizedPng = normalizeCapturedImageSource(pngFromUri);
  assert.equal(normalizedPng.src, 'data:image/png;base64,iVBORw0KGgoAAA');
  assert.equal(normalizedPng.mimeType, 'image/png');
  assert.equal(normalizedPng.encoding, 'data-uri');
});

test('captured image source normalization handles raw JPEG, raw PNG, data-uri base64, and blob URLs', () => {
  const rawJpeg = normalizeCapturedImageSource(
    createCapturedBoardImage({
      picture: {
        uri: 'blob:http://localhost/image-1',
        width: 320,
        height: 240,
        base64: '/9j/rawjpeg',
        format: 'jpg',
      },
      facing: 'back',
      platform: 'web',
      now: new Date('2026-07-16T00:00:00.000Z'),
      id: 'raw-jpeg',
    }),
  );
  assert.equal(rawJpeg.src, 'data:image/jpeg;base64,/9j/rawjpeg');
  assert.equal(rawJpeg.encoding, 'raw-base64');

  const rawPng = normalizeCapturedImageSource(
    createCapturedBoardImage({
      picture: {
        uri: 'blob:http://localhost/image-2',
        width: 320,
        height: 240,
        base64: 'iVBORw0KGgoRAWPNG',
        format: 'png',
      },
      facing: 'back',
      platform: 'web',
      now: new Date('2026-07-16T00:00:00.000Z'),
      id: 'raw-png',
    }),
  );
  assert.equal(rawPng.src, 'data:image/png;base64,iVBORw0KGgoRAWPNG');
  assert.equal(rawPng.mimeType, 'image/png');

  const dataUriBase64 = normalizeCapturedImageSource(
    createCapturedBoardImage({
      picture: {
        uri: 'blob:http://localhost/image-3',
        width: 320,
        height: 240,
        base64: 'data:image/png;base64,iVBORw0KGgoDATAURI',
        format: 'jpg',
      },
      facing: 'back',
      platform: 'web',
      now: new Date('2026-07-16T00:00:00.000Z'),
      id: 'data-uri-base64',
    }),
  );
  assert.equal(dataUriBase64.src, 'data:image/png;base64,iVBORw0KGgoDATAURI');
  assert.equal(dataUriBase64.mimeType, 'image/png');

  const blobOnly = normalizeCapturedImageSource(
    createCapturedBoardImage({
      picture: {
        uri: 'blob:http://localhost/image-4',
        width: 320,
        height: 240,
        format: 'png',
      },
      facing: 'back',
      platform: 'web',
      now: new Date('2026-07-16T00:00:00.000Z'),
      id: 'blob-only',
    }),
  );
  assert.equal(blobOnly.src, 'blob:http://localhost/image-4');
  assert.equal(blobOnly.encoding, 'blob-url');
});

test('data URI parser rejects empty and malformed image sources', () => {
  assert.deepEqual(parseDataUri('data:image/png;base64,iVBORw0KGgo'), {
    mimeType: 'image/png',
    encoding: 'base64',
    payload: 'iVBORw0KGgo',
  });
  assert.throws(() => parseDataUri('data:image/png,iVBORw0KGgo'), /WEB_IMAGE_DATA_URI_INVALID/);
  assert.throws(() => parseDataUri('data:image/png;base64,'), /WEB_IMAGE_SOURCE_EMPTY/);
  assert.throws(() => parseDataUri('data:text/plain;base64,abc'), /WEB_IMAGE_MIME_UNSUPPORTED/);
});
