import type {
  BoardCalibration,
  DartHitResult,
  NormalizedPoint,
  PhotoScoreAdviceCategory,
  PhotoScoreGroupingAnalysis,
  PhotoScoreGroupingQuality,
  PhotoScoreHorizontalBias,
  PhotoScoreSpreadPattern,
  PhotoScoreVerticalBias,
} from '../types';
import { getDistance } from './calculateDartScore';

export function analyzePhotoScoreGrouping(
  hits: DartHitResult[],
  calibration: BoardCalibration,
): PhotoScoreGroupingAnalysis {
  const validHits = hits.filter((hit) => isNormalizedPoint(hit.point));

  if (validHits.length === 0 || calibration.outerRadius <= 0) {
    return buildUnknownAnalysis(calibration.center);
  }

  const centerPoint = getAveragePoint(validHits.map((hit) => hit.point));
  const distancesFromGroupCenter = validHits.map((hit) => getDistance(centerPoint, hit.point));
  const spreadRadius = Math.max(...distancesFromGroupCenter, 0);
  const averageDistanceFromBoardCenter =
    validHits.reduce((total, hit) => total + getDistance(calibration.center, hit.point), 0) /
    validHits.length;
  const offsetX = centerPoint.x - calibration.center.x;
  const offsetY = centerPoint.y - calibration.center.y;
  const horizontalBias = getHorizontalBias(offsetX, calibration.outerRadius);
  const verticalBias = getVerticalBias(offsetY, calibration.outerRadius);
  const spreadPattern = getSpreadPattern(validHits, calibration.outerRadius);
  const groupingQuality = getGroupingQuality(
    spreadRadius,
    calibration.outerRadius,
    validHits.length,
  );
  const advice = buildAdvice({
    horizontalBias,
    verticalBias,
    spreadPattern,
    groupingQuality,
  });

  return {
    centerPoint,
    spreadRadius: round(spreadRadius),
    averageDistanceFromBoardCenter: round(averageDistanceFromBoardCenter),
    verticalBias,
    horizontalBias,
    spreadPattern,
    groupingQuality,
    summaryText: buildSummaryText(groupingQuality, spreadPattern, verticalBias, horizontalBias),
    adviceTexts: advice.texts,
    adviceCategories: advice.categories,
    recommendedPracticeMenuIds: advice.practiceMenuIds,
  };
}

function buildUnknownAnalysis(centerPoint: NormalizedPoint): PhotoScoreGroupingAnalysis {
  return {
    centerPoint,
    spreadRadius: 0,
    averageDistanceFromBoardCenter: 0,
    verticalBias: 'unknown',
    horizontalBias: 'unknown',
    spreadPattern: 'unknown',
    groupingQuality: 'unknown',
    summaryText: '3本の座標が揃うと、グルーピング傾向を分析できます。',
    adviceTexts: ['まずは写真スコア記録で3本分の位置を保存してください。'],
    adviceCategories: ['practicePlan'],
    recommendedPracticeMenuIds: ['beginner-bull-count-up-12'],
  };
}

function getAveragePoint(points: NormalizedPoint[]): NormalizedPoint {
  return {
    x: round(points.reduce((total, point) => total + point.x, 0) / points.length),
    y: round(points.reduce((total, point) => total + point.y, 0) / points.length),
  };
}

function getVerticalBias(offsetY: number, outerRadius: number): PhotoScoreVerticalBias {
  const threshold = outerRadius * 0.12;

  if (Math.abs(offsetY) <= threshold) {
    return 'centered';
  }

  return offsetY < 0 ? 'high' : 'low';
}

function getHorizontalBias(offsetX: number, outerRadius: number): PhotoScoreHorizontalBias {
  const threshold = outerRadius * 0.12;

  if (Math.abs(offsetX) <= threshold) {
    return 'centered';
  }

  return offsetX < 0 ? 'left' : 'right';
}

function getSpreadPattern(hits: DartHitResult[], outerRadius: number): PhotoScoreSpreadPattern {
  if (hits.length < 2) {
    return 'unknown';
  }

  const xs = hits.map((hit) => hit.point.x);
  const ys = hits.map((hit) => hit.point.y);
  const xSpread = Math.max(...xs) - Math.min(...xs);
  const ySpread = Math.max(...ys) - Math.min(...ys);
  const tightThreshold = outerRadius * 0.18;
  const wideThreshold = outerRadius * 0.36;

  if (xSpread <= tightThreshold && ySpread <= tightThreshold) {
    return 'tight';
  }

  if (xSpread >= wideThreshold && ySpread >= wideThreshold) {
    return 'wide';
  }

  if (ySpread > xSpread * 1.35) {
    return 'vertical';
  }

  if (xSpread > ySpread * 1.35) {
    return 'horizontal';
  }

  return 'wide';
}

function getGroupingQuality(
  spreadRadius: number,
  outerRadius: number,
  hitCount: number,
): PhotoScoreGroupingQuality {
  if (hitCount < 2 || outerRadius <= 0) {
    return 'unknown';
  }

  const normalizedSpread = spreadRadius / outerRadius;

  if (normalizedSpread <= 0.18) {
    return 'good';
  }

  if (normalizedSpread <= 0.34) {
    return 'normal';
  }

  return 'needsWork';
}

function buildAdvice({
  horizontalBias,
  verticalBias,
  spreadPattern,
  groupingQuality,
}: {
  horizontalBias: PhotoScoreHorizontalBias;
  verticalBias: PhotoScoreVerticalBias;
  spreadPattern: PhotoScoreSpreadPattern;
  groupingQuality: PhotoScoreGroupingQuality;
}) {
  const texts: string[] = [];
  const categories = new Set<PhotoScoreAdviceCategory>();
  const practiceMenuIds = new Set<string>();

  if (groupingQuality === 'good') {
    texts.push('3本は比較的まとまっています。狙い位置を大きく変えず、同じテンポを維持しましょう。');
    categories.add('rhythm');
    practiceMenuIds.add('beginner-routine-one-breath');
  }

  if (groupingQuality === 'needsWork') {
    texts.push(
      '3本のまとまりが広めです。点数よりも、毎投同じ構えとリリースで出せたかを確認しましょう。',
    );
    categories.add('stance');
    categories.add('release');
    practiceMenuIds.add('beginner-stance-three-sets');
    practiceMenuIds.add('beginner-release-short-check');
  }

  if (spreadPattern === 'vertical') {
    texts.push(
      '上下に散っています。腕を振り切る高さとリリースタイミングを1つに絞って確認しましょう。',
    );
    categories.add('release');
    categories.add('followThrough');
    practiceMenuIds.add('intermediate-release-line');
  }

  if (spreadPattern === 'horizontal') {
    texts.push(
      '左右に散っています。肩の向き、足位置、狙い線が毎投変わっていないかを確認しましょう。',
    );
    categories.add('stance');
    categories.add('aiming');
    practiceMenuIds.add('intermediate-stance-pressure-count-up');
  }

  if (verticalBias === 'high') {
    texts.push('全体に高めです。狙いを下げる前に、力みで腕が浮いていないかを確認しましょう。');
    categories.add('grip');
    categories.add('followThrough');
  }

  if (verticalBias === 'low') {
    texts.push('全体に低めです。腕が止まっていないか、最後まで押し出せているかを確認しましょう。');
    categories.add('followThrough');
    categories.add('release');
  }

  if (horizontalBias === 'left') {
    texts.push('全体に左寄りです。立ち位置と肩のラインを少し確認し、同じ狙い線に戻しましょう。');
    categories.add('stance');
    categories.add('aiming');
  }

  if (horizontalBias === 'right') {
    texts.push('全体に右寄りです。リリースで外へ抜けていないか、指離れを軽く確認しましょう。');
    categories.add('release');
    categories.add('grip');
  }

  if (texts.length === 0) {
    texts.push('大きな偏りは目立ちません。Bull周辺へ集める短時間練習で再現性を確認しましょう。');
    categories.add('practicePlan');
    practiceMenuIds.add('beginner-bull-count-up-12');
  }

  practiceMenuIds.add('beginner-bull-count-up-12');

  return {
    texts: Array.from(new Set(texts)).slice(0, 4),
    categories: Array.from(categories).slice(0, 4),
    practiceMenuIds: Array.from(practiceMenuIds).slice(0, 3),
  };
}

function buildSummaryText(
  quality: PhotoScoreGroupingQuality,
  spreadPattern: PhotoScoreSpreadPattern,
  verticalBias: PhotoScoreVerticalBias,
  horizontalBias: PhotoScoreHorizontalBias,
) {
  const qualityText: Record<PhotoScoreGroupingQuality, string> = {
    good: 'まとまりは良好',
    normal: 'まとまりは標準',
    needsWork: 'まとまりに改善余地あり',
    unknown: 'まとまりは判定前',
  };
  const spreadText: Record<PhotoScoreSpreadPattern, string> = {
    tight: '密集',
    vertical: '上下散り',
    horizontal: '左右散り',
    wide: '広がりあり',
    unknown: '散らばり不明',
  };
  const verticalText: Record<PhotoScoreVerticalBias, string> = {
    high: '高め',
    low: '低め',
    centered: '上下中央',
    unknown: '上下不明',
  };
  const horizontalText: Record<PhotoScoreHorizontalBias, string> = {
    left: '左寄り',
    right: '右寄り',
    centered: '左右中央',
    unknown: '左右不明',
  };

  return `${qualityText[quality]} / ${spreadText[spreadPattern]} / ${verticalText[verticalBias]} / ${horizontalText[horizontalBias]}`;
}

function isNormalizedPoint(point: NormalizedPoint) {
  return point.x >= 0 && point.x <= 1 && point.y >= 0 && point.y <= 1;
}

function round(value: number) {
  return Math.round(value * 1000) / 1000;
}
