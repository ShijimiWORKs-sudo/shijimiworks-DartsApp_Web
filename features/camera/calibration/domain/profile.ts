import type {
  BoardCalibrationProfile,
  CalibrationRingKey,
  CalibrationValidationResult,
} from './types';

const minGap = 0.005;

export const defaultCalibrationProfile: BoardCalibrationProfile = {
  version: 2,
  profileId: 'default-local-count-up-board',
  projectionMode: 'circle',
  previewMirrored: false,
  centerX: 0.5,
  centerY: 0.5,
  outerRadius: 0.3,
  rotationDeg: 0,
  doubleOuterRatio: 1,
  doubleInnerRatio: 0.9,
  tripleOuterRatio: 0.62,
  tripleInnerRatio: 0.54,
  outerBullRatio: 0.085,
  innerBullRatio: 0.035,
  createdAt: '2026-07-17T00:00:00.000Z',
  updatedAt: '2026-07-17T00:00:00.000Z',
};

export const calibrationRingKeys: CalibrationRingKey[] = [
  'outer',
  'double_outer',
  'double_inner',
  'triple_outer',
  'triple_inner',
  'outer_bull',
  'inner_bull',
];

export function createDefaultCalibrationProfile(now = new Date()): BoardCalibrationProfile {
  const timestamp = now.toISOString();
  return {
    ...defaultCalibrationProfile,
    profileId: `local-count-up-board:${timestamp}`,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

export function clampCalibrationProfile(
  input: Partial<BoardCalibrationProfile> | null | undefined,
  now = new Date(),
): BoardCalibrationProfile {
  const base = createDefaultCalibrationProfile(now);
  const projectionMode: BoardCalibrationProfile['projectionMode'] =
    input?.projectionMode === 'perspective' ? 'perspective' : 'circle';
  const merged = {
    ...base,
    ...(input ?? {}),
    version: 2 as const,
    projectionMode,
  };
  const centerX = clamp01(merged.centerX);
  const centerY = clamp01(merged.centerY);
  const outerRadius = clamp(merged.outerRadius, 0.12, 0.49);
  const sorted = sortRingRatios({
    innerBullRatio: clamp(merged.innerBullRatio, 0.01, 0.2),
    outerBullRatio: clamp(merged.outerBullRatio, 0.02, 0.24),
    tripleInnerRatio: clamp(merged.tripleInnerRatio, 0.25, 0.78),
    tripleOuterRatio: clamp(merged.tripleOuterRatio, 0.3, 0.84),
    doubleInnerRatio: clamp(merged.doubleInnerRatio, 0.7, 0.98),
    doubleOuterRatio: clamp(merged.doubleOuterRatio, 0.75, 1),
  });

  return {
    ...merged,
    centerX,
    centerY,
    outerRadius,
    rotationDeg: normalizeRotationDeg(merged.rotationDeg),
    innerBullRatio: sorted.innerBullRatio,
    outerBullRatio: sorted.outerBullRatio,
    tripleInnerRatio: sorted.tripleInnerRatio,
    tripleOuterRatio: sorted.tripleOuterRatio,
    doubleInnerRatio: sorted.doubleInnerRatio,
    doubleOuterRatio: sorted.doubleOuterRatio,
    projectionMode,
    previewMirrored: Boolean(merged.previewMirrored),
    updatedAt: now.toISOString(),
  };
}

export function validateCalibrationProfile(
  profile: BoardCalibrationProfile,
): CalibrationValidationResult {
  const reasons: string[] = [];
  if (profile.version !== 2) {
    reasons.push('INVALID_VERSION');
  }
  if (!isInRange(profile.centerX, 0, 1) || !isInRange(profile.centerY, 0, 1)) {
    reasons.push('CENTER_OUT_OF_RANGE');
  }
  if (!isInRange(profile.outerRadius, 0.12, 0.49)) {
    reasons.push('OUTER_RADIUS_OUT_OF_RANGE');
  }
  if (profile.projectionMode !== 'circle' && profile.projectionMode !== 'perspective') {
    reasons.push('PROJECTION_MODE_INVALID');
  }
  if (!(
    0 < profile.innerBullRatio &&
    profile.innerBullRatio < profile.outerBullRatio &&
    profile.outerBullRatio < profile.tripleInnerRatio &&
    profile.tripleInnerRatio < profile.tripleOuterRatio &&
    profile.tripleOuterRatio < profile.doubleInnerRatio &&
    profile.doubleInnerRatio < profile.doubleOuterRatio &&
    profile.doubleOuterRatio <= 1
  )) {
    reasons.push('RING_RATIO_ORDER_INVALID');
  }
  return {
    valid: reasons.length === 0,
    reasons,
  };
}

export function updateCalibrationRingRatio(
  profile: BoardCalibrationProfile,
  ring: CalibrationRingKey,
  delta: number,
): BoardCalibrationProfile {
  if (ring === 'outer') {
    return clampCalibrationProfile({
      ...profile,
      outerRadius: profile.outerRadius + delta,
    });
  }

  const field = ringToField(ring);
  return clampCalibrationProfile({
    ...profile,
    [field]: profile[field] + delta,
  });
}

export function ringToField(
  ring: Exclude<CalibrationRingKey, 'outer'>,
): Exclude<
  keyof BoardCalibrationProfile,
  | 'version'
  | 'profileId'
  | 'cameraDeviceId'
  | 'projectionMode'
  | 'previewMirrored'
  | 'centerX'
  | 'centerY'
  | 'outerRadius'
  | 'rotationDeg'
  | 'createdAt'
  | 'updatedAt'
> {
  switch (ring) {
    case 'double_outer':
      return 'doubleOuterRatio';
    case 'double_inner':
      return 'doubleInnerRatio';
    case 'triple_outer':
      return 'tripleOuterRatio';
    case 'triple_inner':
      return 'tripleInnerRatio';
    case 'outer_bull':
      return 'outerBullRatio';
    case 'inner_bull':
      return 'innerBullRatio';
  }
}

export function normalizeRotationDeg(value: number) {
  return ((value % 360) + 360) % 360;
}

function sortRingRatios(ratios: {
  innerBullRatio: number;
  outerBullRatio: number;
  tripleInnerRatio: number;
  tripleOuterRatio: number;
  doubleInnerRatio: number;
  doubleOuterRatio: number;
}) {
  const values = [
    ratios.innerBullRatio,
    ratios.outerBullRatio,
    ratios.tripleInnerRatio,
    ratios.tripleOuterRatio,
    ratios.doubleInnerRatio,
    ratios.doubleOuterRatio,
  ];

  for (let index = 1; index < values.length; index += 1) {
    if (values[index] <= values[index - 1] + minGap) {
      values[index] = values[index - 1] + minGap;
    }
  }

  if (values[5] > 1) {
    values[5] = 1;
    for (let index = 4; index >= 0; index -= 1) {
      if (values[index] >= values[index + 1] - minGap) {
        values[index] = values[index + 1] - minGap;
      }
    }
  }

  return {
    innerBullRatio: clamp(values[0], 0.005, 0.995),
    outerBullRatio: clamp(values[1], 0.01, 0.996),
    tripleInnerRatio: clamp(values[2], 0.02, 0.997),
    tripleOuterRatio: clamp(values[3], 0.03, 0.998),
    doubleInnerRatio: clamp(values[4], 0.04, 0.999),
    doubleOuterRatio: clamp(values[5], 0.05, 1),
  };
}

function clamp01(value: number) {
  return clamp(value, 0, 1);
}

function clamp(value: number, min: number, max: number) {
  if (!Number.isFinite(value)) {
    return min;
  }
  return Math.min(max, Math.max(min, value));
}

function isInRange(value: number, min: number, max: number) {
  return Number.isFinite(value) && value >= min && value <= max;
}
