import type { DartHitResult } from '../types';

export function formatPhotoScoreSource(hit: DartHitResult) {
  const confidenceText =
    typeof hit.confidence === 'number' ? ` / 目安 ${Math.round(hit.confidence * 100)}%` : '';

  if (hit.detectionSource === 'imageAnalysisCandidate') {
    return `自動候補β${confidenceText}`;
  }

  if (hit.detectionSource === 'autoCandidate') {
    return `半自動候補${confidenceText}`;
  }

  if (hit.detectionSource === 'adjusted') {
    return `微調整済み${confidenceText}`;
  }

  return '手動追加';
}
