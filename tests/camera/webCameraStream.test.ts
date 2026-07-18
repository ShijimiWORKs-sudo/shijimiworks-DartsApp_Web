import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  createWebVideoConstraints,
  mergeWebVideoMetrics,
  openPreferredWebCameraStream,
} from '../../features/camera/ui/WebCameraStream';

test('web camera constraints prefer 1920x1080 at 30fps', () => {
  assert.deepEqual(createWebVideoConstraints({ width: 1920, height: 1080 }, 'back'), {
    video: {
      width: { ideal: 1920 },
      height: { ideal: 1080 },
      frameRate: { ideal: 30, max: 30 },
      facingMode: { ideal: 'environment' },
    },
    audio: false,
  });
});

test('web camera stream falls back through 1920, 1280, then 640 without treating 640 as fatal', async () => {
  const calls: MediaStreamConstraints[] = [];
  const stream = createMockStream({ width: 640, height: 480, frameRate: 30 });
  const mediaDevices = {
    getUserMedia: async (constraints: MediaStreamConstraints) => {
      calls.push(constraints);
      if (calls.length < 3) {
        throw new DOMException('denied by device', 'OverconstrainedError');
      }
      return stream;
    },
  };

  const result = await openPreferredWebCameraStream({ facing: 'back', mediaDevices });

  assert.equal(calls.length, 3);
  assert.deepEqual((calls[0].video as MediaTrackConstraints).width, { ideal: 1920 });
  assert.deepEqual((calls[1].video as MediaTrackConstraints).width, { ideal: 1280 });
  assert.deepEqual((calls[2].video as MediaTrackConstraints).width, { ideal: 640 });
  assert.equal(result.stream, stream);
  assert.equal(result.diagnostics.requestedResolution, '640×480');
  assert.equal(result.diagnostics.trackWidth, 640);
  assert.equal(result.diagnostics.trackHeight, 480);
  assert.match(result.diagnostics.fallbackReason ?? '', /1920×1080/);
});

test('web camera diagnostics records actual video dimensions when track settings are unavailable', () => {
  const diagnostics = mergeWebVideoMetrics(
    {
      requestedResolution: '1920×1080',
      actualVideoWidth: null,
      actualVideoHeight: null,
      trackWidth: null,
      trackHeight: null,
      frameRate: null,
      frameSource: 'web-media-stream',
      fallbackReason: null,
    },
    { videoWidth: 1920, videoHeight: 1080, frameRate: 30 },
  );

  assert.equal(diagnostics.actualVideoWidth, 1920);
  assert.equal(diagnostics.actualVideoHeight, 1080);
  assert.equal(diagnostics.frameRate, 30);
  assert.equal(diagnostics.fallbackReason, null);
});

test('web camera diagnostics reports browser fallback when video is lower than requested', () => {
  const diagnostics = mergeWebVideoMetrics(
    {
      requestedResolution: '1920×1080',
      actualVideoWidth: null,
      actualVideoHeight: null,
      trackWidth: null,
      trackHeight: null,
      frameRate: null,
      frameSource: 'web-media-stream',
      fallbackReason: null,
    },
    { videoWidth: 640, videoHeight: 480 },
  );

  assert.equal(diagnostics.actualVideoWidth, 640);
  assert.equal(diagnostics.actualVideoHeight, 480);
  assert.match(diagnostics.fallbackReason ?? '', /requested 1920×1080 but video reported 640×480/);
});

function createMockStream(input: { width?: number; height?: number; frameRate?: number }) {
  return {
    getVideoTracks: () => [
      {
        getSettings: () => input,
        stop: () => undefined,
      },
    ],
  } as unknown as MediaStream;
}
