import type { SkillLevelId } from '../types';

export const levelLabels: Record<SkillLevelId, string> = {
  beginner: '初級 RT1〜5',
  intermediate: '中級 RT6〜9',
  advanced: '上級 RT10以上',
};

export function getLevelFromRating(rating: number): SkillLevelId {
  if (rating >= 10) {
    return 'advanced';
  }

  if (rating >= 6) {
    return 'intermediate';
  }

  return 'beginner';
}
