import type { AwardAsset, AwardCode } from '../domain/types';

const AWARD_CODES: AwardCode[] = [
  'LOW_TON',
  'HIGH_TON',
  'TON_80',
  'HAT_TRICK',
  'THREE_IN_THE_BLACK',
  'WHITE_HORSE',
  'IN_BULL',
  'OUT_BULL',
  'NORMAL',
  'DOUBLE',
  'TRIPLE',
  'CRICKET_DOUBLE',
  'CRICKET_TRIPLE',
];

const LABELS: Record<AwardCode, string> = {
  LOW_TON: 'LOW TON',
  HIGH_TON: 'HIGH TON',
  TON_80: 'TON 80',
  HAT_TRICK: 'HAT TRICK',
  THREE_IN_THE_BLACK: 'THREE IN THE BLACK',
  WHITE_HORSE: 'WHITE HORSE',
  IN_BULL: 'IN BULL',
  OUT_BULL: 'OUT BULL',
  NORMAL: 'NORMAL',
  DOUBLE: 'DOUBLE',
  TRIPLE: 'TRIPLE',
  CRICKET_DOUBLE: 'CRICKET DOUBLE',
  CRICKET_TRIPLE: 'CRICKET TRIPLE',
};

export class AwardRegistry {
  private readonly assets = new Map<AwardCode, AwardAsset>(
    AWARD_CODES.map((code) => [
      code,
      {
        code,
        label: LABELS[code],
        videoUri: null,
        audioUri: null,
        fallbackAnimation: `${code.toLowerCase().replaceAll('_', '-')}-pulse`,
      },
    ]),
  );

  get(code: AwardCode): AwardAsset {
    const asset = this.assets.get(code);
    if (!asset) {
      throw new Error(`Award asset is not registered: ${code}`);
    }
    return asset;
  }

  list(): AwardAsset[] {
    return [...this.assets.values()];
  }
}
