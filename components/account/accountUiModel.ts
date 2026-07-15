import type { AccountStatus, RatingMeasurementStatus } from '../../features/account/domain';

export const localAccountNotice =
  '現在はこの端末内でRating所有者を識別するための登録です。\nクラウド同期・本人確認は今後対応予定です。';

export function getAccountStatusLabel(status: AccountStatus) {
  switch (status) {
    case 'profile_incomplete':
      return 'プロフィール未完了';
    case 'local_registered':
      return 'ローカル登録';
    case 'cloud_verified':
      return '登録済み';
    case 'disabled':
      return '無効';
    case 'deleted':
      return '削除済み';
    default:
      return '不明';
  }
}

export function getRatingMeasurementLabel(status: RatingMeasurementStatus) {
  switch (status) {
    case 'unmeasured':
      return '未測定';
    case 'provisional_1_of_3':
      return 'Rating測定中 1/3';
    case 'provisional_2_of_3':
      return 'Rating測定中 2/3';
    case 'provisional':
      return '初回Rating確定済み';
    case 'standard':
      return '確定済み';
    case 'stable':
      return '安定';
    default:
      return '不明';
  }
}

export function formatRatingTenths(ratingTenths: number | null) {
  return ratingTenths === null ? '未確定' : `${(ratingTenths / 10).toFixed(1)}`;
}

export function getEligibleMatchProgress(eligibleMatchCount: number) {
  return `${Math.min(eligibleMatchCount, 3)}/3`;
}

export function formatRatingIndex(indexMilli: number | null) {
  return indexMilli === null ? '-' : `${(indexMilli / 1000).toFixed(2)}`;
}

export function formatConfidence(confidenceBp: number) {
  return `${(confidenceBp / 100).toFixed(0)}%`;
}

export function formatEvaluatedAt(value: string | null) {
  if (!value) {
    return '-';
  }
  return new Intl.DateTimeFormat('ja-JP', {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}
