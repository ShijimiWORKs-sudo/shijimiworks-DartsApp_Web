import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  analyzeFrameMotion,
  throwDetectionThresholds,
  type CameraAnalysisFrame,
} from '../../features/camera/detection/application/CameraFrameSource';
import { createDefaultCalibrationProfile } from '../../features/camera/calibration/domain/profile';
import { decodeImageToGrayscaleFrame } from '../../features/camera/detection/infrastructure/WebCameraFrameSource';

test('real camera frame source contract keeps baseline frames in memory only', () => {
  const frame = createFrame('baseline', 20, 20);

  assert.equal(frame.frameId, 'baseline');
  assert.equal(frame.grayPixels.length, 400);
  assert.equal(frame.capturedAt, '2026-07-17T00:00:00.000Z');
});

test('motion analysis detects throw movement and obstruction inside calibration circle', () => {
  const profile = createDefaultCalibrationProfile();
  const baseline = createFrame('baseline', 40, 40);
  const motion = createFrame('motion', 40, 40);
  for (let y = 18; y <= 22; y += 1) {
    for (let x = 18; x <= 22; x += 1) {
      motion.grayPixels[y * 40 + x] = 255;
    }
  }

  const result = analyzeFrameMotion({
    baselineFrame: baseline,
    currentFrame: motion,
    calibration: profile,
  });

  assert.equal(result.reason, 'motion');
  assert.ok(result.changedPixelRatio >= throwDetectionThresholds.motionStartRatio);
  assert.ok(result.boundingBox);

  const obstruction = createFrame('obstruction', 40, 40, 255);
  const obstructionResult = analyzeFrameMotion({
    baselineFrame: baseline,
    currentFrame: obstruction,
    calibration: profile,
  });
  assert.equal(obstructionResult.reason, 'obstruction');
});

test('motion analysis returns stable when frame difference is below stable threshold', () => {
  const profile = createDefaultCalibrationProfile();
  const baseline = createFrame('baseline', 40, 40);
  const stable = createFrame('stable', 40, 40);

  const result = analyzeFrameMotion({
    baselineFrame: baseline,
    currentFrame: stable,
    calibration: profile,
  });

  assert.equal(result.reason, 'stable');
  assert.ok(result.changedPixelRatio <= throwDetectionThresholds.stableRatio);
});

test('web image decode converts JPEG and PNG fixtures through canvas', async () => {
  const restore = installImageDecodeMock({ mode: 'success', width: 4, height: 2 });
  try {
    const jpeg = await decodeImageToGrayscaleFrame({
      frameId: 'jpeg-frame',
      capturedAt: '2026-07-17T00:00:00.000Z',
      source: 'data:image/jpeg;base64,/9j/abc',
      sourceKind: 'data-uri',
      mimeType: 'image/jpeg',
      capturedWidth: 4,
      capturedHeight: 2,
      uriPrefixKind: 'data-uri',
      base64Kind: 'data-uri',
      maxSize: 4,
    });
    assert.equal(jpeg.mimeType, 'image/jpeg');
    assert.equal(jpeg.sourceKind, 'data-uri');
    assert.equal(jpeg.width, 4);
    assert.equal(jpeg.height, 2);
    assert.equal(jpeg.analysisWidth, 4);
    assert.equal(jpeg.analysisHeight, 2);
    assert.equal(jpeg.decodeStatus, 'success');
    assert.equal(jpeg.grayPixels.length, 8);

    const png = await decodeImageToGrayscaleFrame({
      frameId: 'png-frame',
      capturedAt: '2026-07-17T00:00:00.000Z',
      source: 'data:image/png;base64,iVBORw0KGgo',
      sourceKind: 'raw-base64',
      mimeType: 'image/png',
      maxSize: 2,
    });
    assert.equal(png.mimeType, 'image/png');
    assert.equal(png.width, 2);
    assert.equal(png.height, 1);
  } finally {
    restore();
  }
});

test('web image decode reports malformed source, load failure, and timeout with explicit codes', async () => {
  await assert.rejects(
    () =>
      decodeImageToGrayscaleFrame({
        frameId: 'empty',
        capturedAt: '2026-07-17T00:00:00.000Z',
        source: '',
      }),
    /WEB_IMAGE_SOURCE_EMPTY/,
  );

  await assert.rejects(
    () =>
      decodeImageToGrayscaleFrame({
        frameId: 'bad-data-uri',
        capturedAt: '2026-07-17T00:00:00.000Z',
        source: 'data:image/png,abc',
      }),
    /WEB_IMAGE_DATA_URI_INVALID/,
  );

  let restore = installImageDecodeMock({ mode: 'error', width: 4, height: 2 });
  try {
    await assert.rejects(
      () =>
        decodeImageToGrayscaleFrame({
          frameId: 'decode-fail',
          capturedAt: '2026-07-17T00:00:00.000Z',
          source: 'data:image/png;base64,iVBORw0KGgo',
        }),
      /WEB_IMAGE_DECODE_FAILED/,
    );
  } finally {
    restore();
  }

  restore = installImageDecodeMock({ mode: 'timeout', width: 4, height: 2 });
  try {
    await assert.rejects(
      () =>
        decodeImageToGrayscaleFrame({
          frameId: 'timeout',
          capturedAt: '2026-07-17T00:00:00.000Z',
          source: 'data:image/png;base64,iVBORw0KGgo',
          timeoutMs: 1,
        }),
      /WEB_IMAGE_DECODE_TIMEOUT/,
    );
  } finally {
    restore();
  }
});

function createFrame(
  frameId: string,
  width: number,
  height: number,
  fill = 0,
): CameraAnalysisFrame {
  return {
    frameId,
    width,
    height,
    grayPixels: new Uint8Array(width * height).fill(fill),
    capturedAt: '2026-07-17T00:00:00.000Z',
  };
}

function installImageDecodeMock(input: {
  mode: 'success' | 'error' | 'timeout';
  width: number;
  height: number;
}) {
  const previousDocument = (globalThis as { document?: unknown }).document;
  const previousImage = (globalThis as { Image?: unknown }).Image;

  (globalThis as { document?: unknown }).document = {
    createElement: () => {
      const canvas = {
        width: 0,
        height: 0,
        getContext: () => ({
          drawImage: () => undefined,
          getImageData: (_x: number, _y: number, width: number, height: number) => ({
            data: new Uint8ClampedArray(width * height * 4).fill(100),
          }),
        }),
      };
      return canvas;
    },
  };

  class MockImage {
    width = input.width;
    height = input.height;
    onload: (() => void) | null = null;
    onerror: (() => void) | null = null;

    set src(_value: string) {
      if (input.mode === 'timeout') {
        return;
      }
      setTimeout(() => {
        if (input.mode === 'error') {
          this.onerror?.();
          return;
        }
        this.onload?.();
      }, 0);
    }

    decode() {
      return input.mode === 'error'
        ? Promise.reject(new Error('decode failed'))
        : Promise.resolve();
    }
  }

  (globalThis as { Image?: unknown }).Image = MockImage;

  return () => {
    (globalThis as { document?: unknown }).document = previousDocument;
    (globalThis as { Image?: unknown }).Image = previousImage;
  };
}
