import type { CameraAnalysisFrame } from './CameraFrameSource';

export type LightingQuality = 'good' | 'acceptable' | 'poor';

export type LightingQualityReport = {
  averageBrightness: number;
  brightnessVariance: number;
  clippedDarkRatio: number;
  clippedBrightRatio: number;
  glareRatio: number;
  leftAverage: number;
  rightAverage: number;
  topAverage: number;
  bottomAverage: number;
  horizontalDifference: number;
  verticalDifference: number;
  flickerScore: number;
  edgeNoise: number;
  shadowRisk: number;
  quality: LightingQuality;
  recommendation: string;
};

export function analyzeLightingQuality(frames: CameraAnalysisFrame[]): LightingQualityReport {
  if (frames.length === 0) {
    return createEmptyReport('poor', '照明診断用のフレームがありません。');
  }

  const first = frames[0];
  const frameReports = frames.map(analyzeSingleFrame);
  const averageBrightness = average(frameReports.map((report) => report.averageBrightness));
  const brightnessVariance = average(frameReports.map((report) => report.brightnessVariance));
  const clippedDarkRatio = average(frameReports.map((report) => report.clippedDarkRatio));
  const clippedBrightRatio = average(frameReports.map((report) => report.clippedBrightRatio));
  const glareRatio = average(frameReports.map((report) => report.glareRatio));
  const leftAverage = average(frameReports.map((report) => report.leftAverage));
  const rightAverage = average(frameReports.map((report) => report.rightAverage));
  const topAverage = average(frameReports.map((report) => report.topAverage));
  const bottomAverage = average(frameReports.map((report) => report.bottomAverage));
  const horizontalDifference = Math.abs(leftAverage - rightAverage);
  const verticalDifference = Math.abs(topAverage - bottomAverage);
  const flickerScore = calculateFlicker(frames);
  const edgeNoise = average(frameReports.map((report) => report.edgeNoise));
  const shadowRisk = clamp01(
    horizontalDifference / 95 +
      verticalDifference / 110 +
      glareRatio * 1.2 +
      clippedDarkRatio * 0.8 +
      flickerScore / 80 +
      edgeNoise / 120,
  );
  const quality: LightingQuality =
    shadowRisk < 0.28 && clippedBrightRatio < 0.02
      ? 'good'
      : shadowRisk < 0.5 && clippedBrightRatio < 0.06
        ? 'acceptable'
        : 'poor';

  return {
    averageBrightness,
    brightnessVariance,
    clippedDarkRatio,
    clippedBrightRatio,
    glareRatio,
    leftAverage,
    rightAverage,
    topAverage,
    bottomAverage,
    horizontalDifference,
    verticalDifference,
    flickerScore,
    edgeNoise,
    shadowRisk,
    quality,
    recommendation:
      quality === 'good'
        ? '照明は自動判定に適しています。'
        : quality === 'acceptable'
          ? '影が出やすい可能性があります。左右または上下の明るさを近づけてください。'
          : '強い影または白飛びがあります。盤面正面の拡散光を増やしてください。',
  };

  function analyzeSingleFrame(frame: CameraAnalysisFrame) {
    const quadrants = splitBrightness(frame);
    const values = Array.from(frame.grayPixels);
    const avg = average(values);
    return {
      averageBrightness: avg,
      brightnessVariance: variance(values, avg),
      clippedDarkRatio: values.filter((value) => value <= 8).length / values.length,
      clippedBrightRatio: values.filter((value) => value >= 248).length / values.length,
      glareRatio: values.filter((value) => value >= 238).length / values.length,
      leftAverage: quadrants.left,
      rightAverage: quadrants.right,
      topAverage: quadrants.top,
      bottomAverage: quadrants.bottom,
      edgeNoise: calculateEdgeNoise(frame),
    };
  }

  function calculateFlicker(inputFrames: CameraAnalysisFrame[]) {
    const sameSizeFrames = inputFrames.filter(
      (frame) =>
        frame.width === first.width &&
        frame.height === first.height &&
        frame.grayPixels.length === first.grayPixels.length,
    );
    if (sameSizeFrames.length < 2) {
      return 0;
    }
    const means = sameSizeFrames.map((frame) => average(Array.from(frame.grayPixels)));
    return Math.sqrt(variance(means, average(means)));
  }
}

export function serializeLightingReport(report: LightingQualityReport) {
  return JSON.stringify(
    {
      ...report,
      averageBrightness: round(report.averageBrightness),
      brightnessVariance: round(report.brightnessVariance),
      horizontalDifference: round(report.horizontalDifference),
      verticalDifference: round(report.verticalDifference),
      flickerScore: round(report.flickerScore),
      edgeNoise: round(report.edgeNoise),
      shadowRisk: round(report.shadowRisk),
    },
    null,
    2,
  );
}

function splitBrightness(frame: CameraAnalysisFrame) {
  let left = 0;
  let leftCount = 0;
  let right = 0;
  let rightCount = 0;
  let top = 0;
  let topCount = 0;
  let bottom = 0;
  let bottomCount = 0;
  for (let y = 0; y < frame.height; y += 1) {
    for (let x = 0; x < frame.width; x += 1) {
      const value = frame.grayPixels[y * frame.width + x];
      if (x < frame.width / 2) {
        left += value;
        leftCount += 1;
      } else {
        right += value;
        rightCount += 1;
      }
      if (y < frame.height / 2) {
        top += value;
        topCount += 1;
      } else {
        bottom += value;
        bottomCount += 1;
      }
    }
  }
  return {
    left: left / Math.max(1, leftCount),
    right: right / Math.max(1, rightCount),
    top: top / Math.max(1, topCount),
    bottom: bottom / Math.max(1, bottomCount),
  };
}

function calculateEdgeNoise(frame: CameraAnalysisFrame) {
  let total = 0;
  let count = 0;
  for (let y = 1; y < frame.height - 1; y += 1) {
    for (let x = 1; x < frame.width - 1; x += 1) {
      const left = frame.grayPixels[y * frame.width + x - 1];
      const right = frame.grayPixels[y * frame.width + x + 1];
      const top = frame.grayPixels[(y - 1) * frame.width + x];
      const bottom = frame.grayPixels[(y + 1) * frame.width + x];
      total += Math.sqrt((right - left) ** 2 + (bottom - top) ** 2);
      count += 1;
    }
  }
  return total / Math.max(1, count);
}

function createEmptyReport(
  quality: LightingQuality,
  recommendation: string,
): LightingQualityReport {
  return {
    averageBrightness: 0,
    brightnessVariance: 0,
    clippedDarkRatio: 0,
    clippedBrightRatio: 0,
    glareRatio: 0,
    leftAverage: 0,
    rightAverage: 0,
    topAverage: 0,
    bottomAverage: 0,
    horizontalDifference: 0,
    verticalDifference: 0,
    flickerScore: 0,
    edgeNoise: 0,
    shadowRisk: 1,
    quality,
    recommendation,
  };
}

function average(values: number[]) {
  if (values.length === 0) {
    return 0;
  }
  return values.reduce((total, value) => total + value, 0) / values.length;
}

function variance(values: number[], mean: number) {
  if (values.length === 0) {
    return 0;
  }
  return values.reduce((total, value) => total + (value - mean) ** 2, 0) / values.length;
}

function clamp01(value: number) {
  return Math.min(1, Math.max(0, value));
}

function round(value: number) {
  return Math.round(value * 1000) / 1000;
}
