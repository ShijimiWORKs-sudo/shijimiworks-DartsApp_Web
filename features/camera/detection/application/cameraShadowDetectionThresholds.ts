export const cameraShadowDetectionThresholds = {
  elongationReject: 2.2,
  elongationLowConfidence: 3,
  elongationNormal: 4,
  dartLikelihoodMinimum: 0.45,
  strongDartLikelihood: 0.65,
  shadowLikelihoodMaximum: 0.6,
  strongShadowLikelihoodMaximum: 0.35,
  broadShadowWidth: 7,
  lowEdgeSharpness: 42,
  nearCandidateDistance: 0.045,
  sameComponentDistance: 0.12,
  sourceTipMaxSize: 640,
} as const;
