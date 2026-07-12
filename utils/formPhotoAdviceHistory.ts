import type { FormPhotoAdviceResult } from '../types';

export function addFormPhotoAdviceHistory(
  histories: FormPhotoAdviceResult[],
  result: FormPhotoAdviceResult,
) {
  return sortFormPhotoAdviceHistories([
    result,
    ...histories.filter((history) => history.id !== result.id),
  ]);
}

export function deleteFormPhotoAdviceHistory(histories: FormPhotoAdviceResult[], id: string) {
  return sortFormPhotoAdviceHistories(histories.filter((history) => history.id !== id));
}

export function sortFormPhotoAdviceHistories(histories: FormPhotoAdviceResult[]) {
  return [...histories].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}
