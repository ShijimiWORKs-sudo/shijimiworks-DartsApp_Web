import type {
  FormAdviceCategory,
  FormPhotoType,
  FormSelfCheckAnswer,
  ThrowingHand,
} from '../types';

export const formPhotoTypeLabels: Record<FormPhotoType, string> = {
  front: '正面',
  side: '横',
  releaseAfter: 'リリース後',
};

export const throwingHandLabels: Record<ThrowingHand, string> = {
  right: '右投げ',
  left: '左投げ',
};

export const formSelfCheckAnswerLabels: Record<FormSelfCheckAnswer, string> = {
  yes: 'はい',
  no: 'いいえ',
  unknown: '不明',
};

export const formAdviceCategoryLabels: Record<FormAdviceCategory, string> = {
  stance: 'スタンス',
  shoulderLine: '肩ライン',
  elbow: '肘',
  release: 'リリース',
  followThrough: 'フォロースルー',
  grip: 'グリップ',
  rhythm: 'リズム',
  aiming: '狙い',
  practicePlan: '練習計画',
};
