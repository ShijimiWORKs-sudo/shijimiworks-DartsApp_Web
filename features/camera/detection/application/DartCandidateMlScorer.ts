import type { DetectionCandidate } from '../../lan/domain/protocol';

export type DartCandidateMlInput = {
  candidate: DetectionCandidate;
  features: Record<string, number | string | boolean | null>;
};

export type DartCandidateMlScore = {
  enabled: boolean;
  score: number | null;
  reason: string;
};

export interface DartCandidateMlScorer {
  score(input: DartCandidateMlInput): Promise<DartCandidateMlScore>;
}

export class DisabledDartCandidateMlScorer implements DartCandidateMlScorer {
  async score(_input: DartCandidateMlInput): Promise<DartCandidateMlScore> {
    return {
      enabled: false,
      score: null,
      reason: 'ML_SCORER_DISABLED_NO_MODEL_LOADED',
    };
  }
}

export const dartCandidateMlFeatureFlags = {
  enabled: false,
  allowNetworkModelDownload: false,
} as const;
