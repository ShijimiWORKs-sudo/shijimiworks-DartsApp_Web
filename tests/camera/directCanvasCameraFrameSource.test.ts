import assert from 'node:assert/strict';
import { test } from 'node:test';

import { DirectCanvasCameraFrameSource } from '../../features/camera/detection/infrastructure/DirectCanvasCameraFrameSource.web';

test('direct canvas frame source captures from existing video without opening another stream', async () => {
  const restore = installCanvasMock();
  try {
    const video = {
      readyState: 2,
      videoWidth: 1280,
      videoHeight: 720,
    } as HTMLVideoElement;
    const source = new DirectCanvasCameraFrameSource({
      getVideoElement: () => video,
      now: () => new Date('2026-07-18T00:00:00.000Z'),
    });

    const frame = await source.captureFrame({ maxSize: 320 });

    assert.equal(frame.sourceKind, 'direct-canvas');
    assert.equal(frame.width, 320);
    assert.equal(frame.height, 180);
    assert.equal(frame.sourceFrame?.width, 640);
    assert.equal(frame.sourceFrame?.height, 360);
    assert.equal(source.diagnostics.lastSource, 'direct-canvas');
  } finally {
    restore();
  }
});

test('direct canvas frame source falls back to captured image when video is unavailable', async () => {
  const restore = installCanvasMock();
  const previousImage = (globalThis as { Image?: unknown }).Image;
  try {
    class MockImage {
      width = 4;
      height = 2;
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;

      set src(_value: string) {
        setTimeout(() => this.onload?.(), 0);
      }

      decode() {
        return Promise.resolve();
      }
    }
    (globalThis as { Image?: unknown }).Image = MockImage;
    const source = new DirectCanvasCameraFrameSource({
      getVideoElement: () => null,
      fallbackCaptureImage: async () => ({
        id: 'fallback',
        uri: 'data:image/png;base64,iVBORw0KGgo',
        capturedAt: '2026-07-18T00:00:00.000Z',
        width: 4,
        height: 2,
        platform: 'web',
        facing: 'back',
        mimeType: 'image/png',
        sourceKind: 'data-uri',
        base64Included: true,
        base64Encoding: 'data-uri',
        dataUri: 'data:image/png;base64,iVBORw0KGgo',
      }),
    });

    const frame = await source.captureFrame({ maxSize: 2 });

    assert.equal(source.diagnostics.lastSource, 'data-uri-fallback');
    assert.equal(frame.width, 2);
    assert.equal(frame.height, 1);
  } finally {
    (globalThis as { Image?: unknown }).Image = previousImage;
    restore();
  }
});

function installCanvasMock() {
  const previousDocument = (globalThis as { document?: unknown }).document;
  (globalThis as { document?: unknown }).document = {
    createElement: () => ({
      width: 0,
      height: 0,
      getContext: () => ({
        drawImage: () => undefined,
        getImageData: (_x: number, _y: number, width: number, height: number) => ({
          data: createRgba(width, height),
        }),
      }),
    }),
  };

  return () => {
    (globalThis as { document?: unknown }).document = previousDocument;
  };
}

function createRgba(width: number, height: number) {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let index = 0; index < width * height; index += 1) {
    data[index * 4] = 120;
    data[index * 4 + 1] = 120;
    data[index * 4 + 2] = 120;
    data[index * 4 + 3] = 255;
  }
  return data;
}
