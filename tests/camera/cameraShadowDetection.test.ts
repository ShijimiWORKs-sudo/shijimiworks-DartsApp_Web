import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  analyzeLightingQuality,
  serializeLightingReport,
} from '../../features/camera/detection/application/LightingQualityAnalyzer';
import { ShadowProfileService } from '../../features/camera/detection/application/ShadowProfileService';
import {
  DisabledDartCandidateMlScorer,
  dartCandidateMlFeatureFlags,
} from '../../features/camera/detection/application/DartCandidateMlScorer';
import {
  SingleCameraFusionAdapter,
  multiCameraFeatureFlags,
} from '../../features/camera/detection/application/MultiCameraFusionPort';
import { CameraDetectionTestRecorder } from '../../features/camera/detection/application/CameraDetectionTestRecorder';
import type { CameraAnalysisFrame } from '../../features/camera/detection/application/CameraFrameSource';
import type { DetectionCandidate } from '../../features/camera/lan/domain/protocol';

test('lighting analyzer reports poor quality when one side is much brighter', () => {
  const frame = createFrame('lighting', 20, 10, 120);
  for (let y = 0; y < frame.height; y += 1) {
    for (let x = 10; x < frame.width; x += 1) {
      frame.grayPixels[y * frame.width + x] = 245;
    }
  }

  const report = analyzeLightingQuality([frame]);

  assert.equal(report.quality, 'poor');
  assert.ok(report.horizontalDifference > 80);
  assert.ok(report.shadowRisk > 0.5);
  assert.match(serializeLightingReport(report), /shadowRisk/);
});

test('shadow profile learns stable direction after manual corrections', () => {
  const service = new ShadowProfileService();

  service.addCorrectionSample({
    detected: { x: 0.62, y: 0.5 },
    corrected: { x: 0.5, y: 0.5 },
    componentWidthPx: 9,
    capturedAt: '2026-07-18T00:00:00.000Z',
  });
  service.addCorrectionSample({
    detected: { x: 0.63, y: 0.51 },
    corrected: { x: 0.51, y: 0.51 },
    componentWidthPx: 8,
    capturedAt: '2026-07-18T00:00:01.000Z',
  });
  const profile = service.addCorrectionSample({
    detected: { x: 0.61, y: 0.49 },
    corrected: { x: 0.49, y: 0.49 },
    componentWidthPx: 10,
    capturedAt: '2026-07-18T00:00:02.000Z',
  });

  assert.equal(service.getLearningState(), 'learning');
  assert.equal(profile.sampleCount, 3);
  assert.ok(profile.directionDeg != null);
  assert.ok(profile.averageOffsetPx > 0.1);
  assert.equal(service.reset().sampleCount, 0);
});

test('test recorder serializes candidate diagnostics without image data', () => {
  const recorder = new CameraDetectionTestRecorder();
  recorder.addRecord({
    sessionId: 'local-count-up',
    throwIndex: 1,
    candidate: createCandidate(),
    actual: { label: 'S11', segment: 11, multiplier: 1 },
    now: new Date('2026-07-18T00:00:00.000Z'),
    random: () => 0.1,
  });

  const json = recorder.toJson();

  assert.match(json, /camera-test/);
  assert.match(json, /shadowLikelihood/);
  assert.doesNotMatch(json, /base64|imageData|grayPixels/);
  assert.equal(recorder.list().length, 1);
  recorder.clear();
  assert.equal(recorder.list().length, 0);
});

test('future multi-camera and ml ports stay disabled by default', async () => {
  const candidate = createCandidate();
  const fusion = new SingleCameraFusionAdapter().fuse([
    {
      cameraId: 'main',
      capturedAt: '2026-07-18T00:00:00.000Z',
      candidate,
      confidence: candidate.confidence,
    },
  ]);
  const ml = await new DisabledDartCandidateMlScorer().score({
    candidate,
    features: { elongation: 4.2 },
  });

  assert.equal(multiCameraFeatureFlags.enabled, false);
  assert.equal(dartCandidateMlFeatureFlags.enabled, false);
  assert.equal(fusion.method, 'single_camera');
  assert.equal(fusion.selected?.candidateId, 'candidate-1');
  assert.equal(ml.enabled, false);
  assert.equal(ml.score, null);
});

function createFrame(
  frameId: string,
  width: number,
  height: number,
  fill: number,
): CameraAnalysisFrame {
  return {
    frameId,
    width,
    height,
    grayPixels: new Uint8Array(width * height).fill(fill),
    capturedAt: '2026-07-18T00:00:00.000Z',
  };
}

function createCandidate(): DetectionCandidate {
  return {
    type: 'detection_candidate',
    protocolVersion: 1,
    sessionId: 'session-1',
    sentAt: '2026-07-18T00:00:00.000Z',
    cameraNodeId: 'camera',
    frameId: 'frame-1',
    throwIndex: 1,
    candidateId: 'candidate-1',
    segment: 11,
    multiplier: 1,
    score: 11,
    normalizedX: 0.4,
    normalizedY: 0.5,
    confidence: 0.72,
    capturedAt: '2026-07-18T00:00:00.000Z',
    processingMs: 42,
    source: 'camera_node',
    highResolutionRoi: {
      x: 0.3,
      y: 0.4,
      width: 0.1,
      height: 0.1,
      sourceWidth: 640,
      sourceHeight: 480,
    },
    componentDiagnostics: {
      area: 40,
      width: 4,
      height: 20,
      aspectRatio: 0.2,
      majorAxisLength: 24,
      minorAxisLength: 2,
      elongation: 12,
      centroid: { x: 0.4, y: 0.5 },
      maxDelta: 220,
      averageDelta: 160,
      persistenceCount: 1,
      boardOverlapRatio: 1,
      averageWidth: 2.2,
      maxWidth: 4,
      widthVariance: 0.5,
      edgeSharpness: 75,
      edgeDensity: 0.6,
      averageGradient: 80,
      maxGradient: 140,
      localContrast: 100,
      gradientMagnitude: 80,
      brightnessVariance: 12,
      solidity: 0.5,
      compactness: 0.1,
      interiorBrightnessVariance: 12,
      boundaryBlur: 0.1,
      darkeningPolarity: 0.1,
      skeletonLength: 22,
      skeletonBranchCount: 0,
      skeletonEndpointCount: 2,
      dartLikelihood: 0.78,
      shadowLikelihood: 0.12,
      rejectionReason: null,
      tipSelectionReason: 'source 640 roi',
    },
    tipEvaluationDiagnostics: [
      {
        x: 0.4,
        y: 0.5,
        score: 0.9,
        insideBoard: true,
        insideDoubleOuter: true,
        edgeSharpness: 75,
        directionScore: 0.9,
        stabilityScore: 0.8,
        shadowDirectionPenalty: 0,
        reason: 'source-resolution-roi-tip',
      },
    ],
  };
}
