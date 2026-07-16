import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  acceptPendingCapturedImage,
  clearAcceptedCapturedImage,
  clearPendingCapturedImage,
  getAcceptedCapturedImage,
  getPendingCapturedImage,
  setPendingCapturedImage,
} from '../../features/camera/application/cameraSession';
import type { CapturedBoardImage } from '../../features/camera/domain/types';

test('camera session keeps pending and accepted images in screen memory only', () => {
  clearPendingCapturedImage();
  clearAcceptedCapturedImage();

  const image: CapturedBoardImage = {
    id: 'image-1',
    uri: 'data:image/jpeg;base64,abc',
    width: 1280,
    height: 720,
    capturedAt: '2026-07-16T00:00:00.000Z',
    platform: 'web',
    facing: 'back',
    mimeType: 'image/jpeg',
    base64Included: true,
  };

  setPendingCapturedImage(image);
  assert.equal(getPendingCapturedImage()?.id, 'image-1');
  assert.equal(getAcceptedCapturedImage(), null);

  const accepted = acceptPendingCapturedImage();
  assert.equal(accepted?.id, 'image-1');
  assert.equal(getPendingCapturedImage(), null);
  assert.equal(getAcceptedCapturedImage()?.id, 'image-1');

  clearAcceptedCapturedImage();
  assert.equal(getAcceptedCapturedImage(), null);
});
