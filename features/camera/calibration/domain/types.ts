export type CalibrationStatus = 'unset' | 'editing' | 'saved' | 'invalid';

export type CalibrationProjectionMode = 'circle' | 'perspective';

export type CalibrationRingKey =
  | 'outer'
  | 'double_outer'
  | 'double_inner'
  | 'triple_outer'
  | 'triple_inner'
  | 'outer_bull'
  | 'inner_bull';

export type NormalizedPoint = {
  x: number;
  y: number;
};

export type BoardPoint = {
  x: number;
  y: number;
  radius: number;
  angleDeg: number;
};

export type BoardCalibrationProfile = {
  version: 2;
  profileId: string;
  cameraDeviceId?: string;
  projectionMode: CalibrationProjectionMode;
  previewMirrored: boolean;
  centerX: number;
  centerY: number;
  outerRadius: number;
  rotationDeg: number;
  doubleOuterRatio: number;
  doubleInnerRatio: number;
  tripleOuterRatio: number;
  tripleInnerRatio: number;
  outerBullRatio: number;
  innerBullRatio: number;
  createdAt: string;
  updatedAt: string;
};

export type CalibrationViewportDimensions = {
  containerWidth: number;
  containerHeight: number;
};

export type CalibrationViewportTransform = CalibrationViewportDimensions & {
  projectionMode: CalibrationProjectionMode;
  baseSize: number;
  centerXPx: number;
  centerYPx: number;
  outerRadiusPx: number;
  canonicalCenterXPx: number;
  canonicalCenterYPx: number;
  screenToCanonical: (point: NormalizedPoint) => NormalizedPoint;
  canonicalToScreen: (point: NormalizedPoint) => NormalizedPoint;
  screenToBoard: (point: NormalizedPoint) => BoardPoint;
  boardToScreen: (point: BoardPoint) => NormalizedPoint;
};

export type CalibrationValidationResult = {
  valid: boolean;
  reasons: string[];
};

export type ScoreArea = 'single' | 'double' | 'triple' | 'outer_bull' | 'inner_bull' | 'miss';

export type BoardScoreResult = {
  area: ScoreArea;
  segmentNumber: number | null;
  multiplier: 0 | 1 | 2 | 3;
  score: number;
  normalizedX: number;
  normalizedY: number;
  alternateCandidates: {
    area: ScoreArea;
    segmentNumber: number | null;
    multiplier: 0 | 1 | 2 | 3;
    score: number;
  }[];
};

export type CalibrationEditorState = {
  profile: BoardCalibrationProfile;
  savedProfile: BoardCalibrationProfile;
  status: CalibrationStatus;
  selectedRing: CalibrationRingKey;
  validation: CalibrationValidationResult;
  dirty: boolean;
};
