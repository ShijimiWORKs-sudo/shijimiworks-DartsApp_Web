import type { DartArea } from '../../../game/domain/types';

export function calculateManualCorrectionScore(input: {
  area: DartArea;
  segmentNumber: number | null;
  bullRule: 'fat_bull' | 'separate_bull';
}) {
  switch (input.area) {
    case 'single':
      return input.segmentNumber ?? 0;
    case 'double':
      return (input.segmentNumber ?? 0) * 2;
    case 'triple':
      return (input.segmentNumber ?? 0) * 3;
    case 'inner_bull':
      return 50;
    case 'outer_bull':
      return input.bullRule === 'fat_bull' ? 50 : 25;
    case 'miss':
      return 0;
  }
}
