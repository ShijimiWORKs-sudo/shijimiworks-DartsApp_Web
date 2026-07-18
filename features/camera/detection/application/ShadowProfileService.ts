export type ShadowProfile = {
  directionDeg: number | null;
  confidence: number;
  averageOffsetPx: number;
  averageWidthPx: number;
  sampleCount: number;
  updatedAt: string | null;
};

export type ShadowProfileLearningState = 'unlearned' | 'learning' | 'effective';

export type ShadowCorrectionSample = {
  detected: { x: number; y: number };
  corrected: { x: number; y: number };
  componentWidthPx?: number;
  capturedAt: string;
};

export const emptyShadowProfile: ShadowProfile = {
  directionDeg: null,
  confidence: 0,
  averageOffsetPx: 0,
  averageWidthPx: 0,
  sampleCount: 0,
  updatedAt: null,
};

export class ShadowProfileService {
  private readonly samples: ShadowCorrectionSample[] = [];

  addCorrectionSample(sample: ShadowCorrectionSample) {
    const offset = distance(sample.detected, sample.corrected);
    if (offset < 0.005 || offset > 0.35) {
      return this.getProfile();
    }
    this.samples.push(sample);
    if (this.samples.length > 40) {
      this.samples.shift();
    }
    return this.getProfile();
  }

  reset() {
    this.samples.length = 0;
    return this.getProfile();
  }

  getProfile(): ShadowProfile {
    const usable = this.samples.filter(
      (sample) => distance(sample.detected, sample.corrected) >= 0.005,
    );
    if (usable.length < 3) {
      return {
        ...emptyShadowProfile,
        sampleCount: usable.length,
        updatedAt: usable.at(-1)?.capturedAt ?? null,
      };
    }

    const vectors = usable.map((sample) => ({
      x: sample.detected.x - sample.corrected.x,
      y: sample.detected.y - sample.corrected.y,
      offset: distance(sample.detected, sample.corrected),
      width: sample.componentWidthPx ?? 0,
      capturedAt: sample.capturedAt,
    }));
    const medianOffset = median(vectors.map((vector) => vector.offset));
    const filtered = vectors.filter((vector) => Math.abs(vector.offset - medianOffset) <= 0.12);
    const sin = average(filtered.map((vector) => Math.sin(Math.atan2(vector.y, vector.x))));
    const cos = average(filtered.map((vector) => Math.cos(Math.atan2(vector.y, vector.x))));
    const directionDeg = normalizeDeg(Math.atan2(sin, cos) * (180 / Math.PI));
    const concentration = Math.sqrt(sin ** 2 + cos ** 2);
    return {
      directionDeg,
      confidence: clamp01(((filtered.length - 2) / 8) * concentration),
      averageOffsetPx: average(filtered.map((vector) => vector.offset)),
      averageWidthPx: average(filtered.map((vector) => vector.width)),
      sampleCount: filtered.length,
      updatedAt: filtered.at(-1)?.capturedAt ?? usable.at(-1)?.capturedAt ?? null,
    };
  }

  getLearningState(): ShadowProfileLearningState {
    const profile = this.getProfile();
    if (profile.sampleCount < 3) {
      return profile.sampleCount === 0 ? 'unlearned' : 'learning';
    }
    return profile.confidence >= 0.35 ? 'effective' : 'learning';
  }
}

export function getShadowDirectionPenalty(input: {
  profile: ShadowProfile;
  candidateDirectionDeg: number;
}) {
  if (input.profile.directionDeg == null || input.profile.confidence <= 0) {
    return 0;
  }
  const diff = Math.abs(shortestAngleDiff(input.candidateDirectionDeg, input.profile.directionDeg));
  return clamp01((35 - diff) / 35) * input.profile.confidence;
}

function normalizeDeg(value: number) {
  return ((value % 360) + 360) % 360;
}

function shortestAngleDiff(a: number, b: number) {
  return ((((a - b) % 360) + 540) % 360) - 180;
}

function distance(a: { x: number; y: number }, b: { x: number; y: number }) {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
}

function average(values: number[]) {
  if (values.length === 0) {
    return 0;
  }
  return values.reduce((total, value) => total + value, 0) / values.length;
}

function median(values: number[]) {
  if (values.length === 0) {
    return 0;
  }
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}

function clamp01(value: number) {
  return Math.min(1, Math.max(0, value));
}
