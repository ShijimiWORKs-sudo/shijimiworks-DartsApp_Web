import type { DetectionCandidate } from '../../lan/domain/protocol';
import type { LightingQualityReport } from './LightingQualityAnalyzer';

export type CameraDetectionTestRecord = {
  recordId: string;
  createdAt: string;
  sessionId: string;
  throwIndex: number;
  expected?: {
    segment: number;
    multiplier: number;
    label: string;
  };
  actual?: {
    segment: number;
    multiplier: number;
    label: string;
  };
  acceptedCandidate?: {
    segment: number;
    multiplier: number;
    confidence: number;
    normalizedX: number;
    normalizedY: number;
  };
  diagnostics?: {
    elongation?: number;
    averageWidth?: number;
    widthVariance?: number;
    edgeSharpness?: number;
    skeletonLength?: number;
    skeletonBranchCount?: number;
    dartLikelihood?: number;
    shadowLikelihood?: number;
    shadowDirectionPenalty?: number;
    highResolutionRoi?: { x: number; y: number; width: number; height: number };
  };
  lighting?: Pick<
    LightingQualityReport,
    'quality' | 'shadowRisk' | 'horizontalDifference' | 'verticalDifference' | 'glareRatio'
  >;
};

export class CameraDetectionTestRecorder {
  private readonly records: CameraDetectionTestRecord[] = [];

  addRecord(input: {
    sessionId: string;
    throwIndex: number;
    candidate?: DetectionCandidate | null;
    expected?: CameraDetectionTestRecord['expected'];
    actual?: CameraDetectionTestRecord['actual'];
    lighting?: CameraDetectionTestRecord['lighting'];
    now?: Date;
    random?: () => number;
  }) {
    const now = input.now ?? new Date();
    const random = input.random ?? Math.random;
    const record: CameraDetectionTestRecord = {
      recordId: `camera-test-${now.getTime()}-${Math.floor(random() * 1_000_000)}`,
      createdAt: now.toISOString(),
      sessionId: input.sessionId,
      throwIndex: input.throwIndex,
      expected: input.expected,
      actual: input.actual,
      acceptedCandidate: input.candidate
        ? {
            segment: input.candidate.segment,
            multiplier: input.candidate.multiplier,
            confidence: input.candidate.confidence,
            normalizedX: input.candidate.normalizedX,
            normalizedY: input.candidate.normalizedY,
          }
        : undefined,
      diagnostics: input.candidate?.componentDiagnostics
        ? {
            elongation: input.candidate.componentDiagnostics.elongation,
            averageWidth: input.candidate.componentDiagnostics.averageWidth,
            widthVariance: input.candidate.componentDiagnostics.widthVariance,
            edgeSharpness: input.candidate.componentDiagnostics.edgeSharpness,
            skeletonLength: input.candidate.componentDiagnostics.skeletonLength,
            skeletonBranchCount: input.candidate.componentDiagnostics.skeletonBranchCount,
            dartLikelihood: input.candidate.componentDiagnostics.dartLikelihood,
            shadowLikelihood: input.candidate.componentDiagnostics.shadowLikelihood,
            shadowDirectionPenalty:
              input.candidate.tipEvaluationDiagnostics?.[0]?.shadowDirectionPenalty,
            highResolutionRoi: input.candidate.highResolutionRoi,
          }
        : undefined,
      lighting: input.lighting,
    };
    this.records.push(record);
    return record;
  }

  clear() {
    this.records.length = 0;
  }

  list() {
    return [...this.records];
  }

  toJson() {
    return JSON.stringify({ records: this.records }, null, 2);
  }
}
