import type {
  FormAdviceCategory,
  FormPhotoAdviceResult,
  FormPhotoEntry,
  FormSelfCheck,
  PhotoScoreGroupingAnalysis,
  PracticeRecord,
  ThrowingHand,
} from '../types';
import { getPracticeMenuById } from '../constants/practiceMenus';

export type GenerateFormPhotoAdviceInput = {
  throwingHand: ThrowingHand;
  photos: FormPhotoEntry[];
  selfCheck: FormSelfCheck;
  linkedPracticeRecord?: PracticeRecord | null;
};

export function generateFormPhotoAdvice({
  throwingHand,
  photos,
  selfCheck,
  linkedPracticeRecord,
}: GenerateFormPhotoAdviceInput): FormPhotoAdviceResult {
  const analysis = linkedPracticeRecord?.photoScore?.groupingAnalysis;
  const categories = new Set<FormAdviceCategory>();
  const adviceTexts: string[] = [];
  const checkPoints: string[] = [];
  const recommendedPracticeMenuIds = new Set<string>();

  addPhotoCoverageAdvice(photos, checkPoints, adviceTexts, categories);
  addSelfCheckAdvice(selfCheck, adviceTexts, checkPoints, categories, recommendedPracticeMenuIds);
  addPhotoScoreAdvice(analysis, adviceTexts, checkPoints, categories, recommendedPracticeMenuIds);

  if (adviceTexts.length === 0) {
    categories.add('practicePlan');
    recommendedPracticeMenuIds.add('beginner-routine-one-breath');
    adviceTexts.push(
      '大きな不安定要素は少なめです。写真の同じ角度で比較しながら、1つの確認項目だけを決めて練習しましょう。',
    );
    checkPoints.push('次回も同じ位置と角度で写真を撮り、構えの再現性だけを比較する');
  }

  const linkedSummary = linkedPracticeRecord
    ? summarizeLinkedPhotoScore(linkedPracticeRecord)
    : undefined;

  return {
    id: `form-photo-${Date.now()}`,
    date: new Date().toISOString(),
    throwingHand,
    photos: photos.map((photo) => ({
      type: photo.type,
      imageUri: photo.imageUri,
      note: photo.note,
    })),
    selfCheck,
    linkedPracticeRecordId: linkedPracticeRecord?.id,
    linkedPhotoScoreSummary: linkedSummary,
    adviceCategories: Array.from(categories),
    summaryText: buildSummaryText(categories, analysis, throwingHand),
    adviceTexts: unique(adviceTexts),
    checkPoints: unique(checkPoints),
    recommendedPracticeMenuIds: Array.from(recommendedPracticeMenuIds)
      .filter((menuId) => getPracticeMenuById(menuId) !== null)
      .slice(0, 4),
  };
}

export function getLatestPhotoScoreRecord(records: PracticeRecord[]) {
  return (
    [...records]
      .filter((record) => record.photoScore)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0] ?? null
  );
}

function addPhotoCoverageAdvice(
  photos: FormPhotoEntry[],
  checkPoints: string[],
  adviceTexts: string[],
  categories: Set<FormAdviceCategory>,
) {
  const availableTypes = new Set(
    photos.filter((photo) => photo.imageUri).map((photo) => photo.type),
  );

  if (availableTypes.size < 3) {
    categories.add('practicePlan');
    adviceTexts.push(
      '写真が足りない角度があります。正面・横・リリース後の3枚が揃うと、自己チェックと照らし合わせやすくなります。',
    );
    checkPoints.push('次回は同じ明るさと距離で、正面・横・リリース後の3枚を揃える');
  }
}

function addSelfCheckAdvice(
  selfCheck: FormSelfCheck,
  adviceTexts: string[],
  checkPoints: string[],
  categories: Set<FormAdviceCategory>,
  recommendedPracticeMenuIds: Set<string>,
) {
  if (selfCheck.stanceFeelsStable === 'no') {
    categories.add('stance');
    recommendedPracticeMenuIds.add('beginner-stance-three-sets');
    adviceTexts.push(
      '足位置と重心が毎回変わると、腕の修正点が増えます。まず立ち位置を固定しましょう。',
    );
    checkPoints.push('足先、重心、肩の向きが1投目から3投目まで変わりすぎていないか見る');
  }

  if (selfCheck.shoulderLineFeelsAligned === 'no' || selfCheck.bodyOpensEarly === 'yes') {
    categories.add('shoulderLine');
    categories.add('aiming');
    recommendedPracticeMenuIds.add('advanced-form-reset-eight');
    adviceTexts.push(
      '肩や体の開きが早い感覚がある日は、狙いを直す前に構えた向きと投げ終わりの向きを確認します。',
    );
    checkPoints.push('横写真で、リリース前に肩がターゲット方向から大きく外れていないか確認する');
  }

  if (selfCheck.elbowHeightFeelsStable === 'no') {
    categories.add('elbow');
    recommendedPracticeMenuIds.add('advanced-form-reset-eight');
    adviceTexts.push(
      '肘の高さが変わるとリリース位置も変わりやすくなります。高さを固定しすぎず、毎回同じ軌道に戻す意識にします。',
    );
    checkPoints.push('構えた時とリリース後で肘が急に落ちていないか見る');
  }

  if (selfCheck.releaseFeelsClean === 'no') {
    categories.add('release');
    recommendedPracticeMenuIds.add('beginner-release-short-check');
    recommendedPracticeMenuIds.add('intermediate-release-line');
    adviceTexts.push(
      '抜けや引っかかりがある日は、強く投げ込まず、指離れと腕の出る方向を短時間で確認しましょう。',
    );
    checkPoints.push('ダーツが離れた直後に手首や指が残りすぎていないか見る');
  }

  if (selfCheck.followThroughGoesToTarget === 'no') {
    categories.add('followThrough');
    recommendedPracticeMenuIds.add('intermediate-release-line');
    adviceTexts.push(
      'フォロースルーが狙い方向へ残らない日は、最後の手の位置をターゲットへ置く感覚で確認します。',
    );
    checkPoints.push('投げ終わりの手がターゲット方向に残っているか、下や横へ流れていないか見る');
  }

  if (selfCheck.gripFeelsTooStrong === 'yes') {
    categories.add('grip');
    recommendedPracticeMenuIds.add('beginner-release-short-check');
    adviceTexts.push(
      '握り込みが強い感覚がある時は、握りを変えすぎず、力を入れる時間を短くする方向で調整します。',
    );
    checkPoints.push('構えてから離すまで、指先の力が入り続けていないか確認する');
  }

  if (selfCheck.feelsRushed === 'yes') {
    categories.add('rhythm');
    categories.add('practicePlan');
    recommendedPracticeMenuIds.add('beginner-routine-one-breath');
    adviceTexts.push(
      '急ぎ感がある日は、フォームを増やして直すより、投げる前の一呼吸を固定する方が安定しやすいです。',
    );
    checkPoints.push('1投ごとに同じ呼吸と構え直しが入っているか見る');
  }
}

function addPhotoScoreAdvice(
  analysis: PhotoScoreGroupingAnalysis | undefined,
  adviceTexts: string[],
  checkPoints: string[],
  categories: Set<FormAdviceCategory>,
  recommendedPracticeMenuIds: Set<string>,
) {
  if (!analysis) {
    categories.add('practicePlan');
    checkPoints.push(
      '写真スコア記録も1件保存すると、上下左右のズレとフォーム写真を照らし合わせられる',
    );
    return;
  }

  if (analysis.spreadPattern === 'vertical') {
    categories.add('release');
    categories.add('elbow');
    recommendedPracticeMenuIds.add('intermediate-release-line');
    adviceTexts.push(
      '写真スコアで縦散りが出ています。リリース位置や肘の高さが毎投変わっていないかを優先して見ましょう。',
    );
    checkPoints.push('横写真で、引き始めからリリースまでの高さが大きく上下していないか確認する');
  }

  if (analysis.spreadPattern === 'horizontal') {
    categories.add('stance');
    categories.add('shoulderLine');
    recommendedPracticeMenuIds.add('intermediate-stance-pressure-count-up');
    adviceTexts.push(
      '写真スコアで横散りが出ています。スタンス、肩ライン、フォロースルーの方向を先に確認します。',
    );
    checkPoints.push('正面写真で、肩や腰が左右に開きすぎていないか見る');
  }

  if (analysis.horizontalBias === 'left' || analysis.horizontalBias === 'right') {
    categories.add('aiming');
    adviceTexts.push(
      '左右どちらかへの偏りがあるため、狙いをずらす前に体の向きと手の残り方を確認しましょう。',
    );
    checkPoints.push('外れた方向と投げ終わりの手の方向が一致していないか確認する');
  }

  if (analysis.groupingQuality === 'needsWork' || analysis.spreadPattern === 'wide') {
    categories.add('practicePlan');
    recommendedPracticeMenuIds.add('beginner-routine-one-breath');
    adviceTexts.push(
      'まとまりが広い日は修正点を増やさず、写真で1項目、投げる前に1項目だけ確認します。',
    );
    checkPoints.push('同じフォーム写真を撮って、1つ前の投げ方と大きく変えていないか見る');
  }
}

function summarizeLinkedPhotoScore(record: PracticeRecord) {
  const analysis = record.photoScore?.groupingAnalysis;

  if (!record.photoScore) {
    return undefined;
  }

  const base = `写真スコア ${record.photoScore.totalScore}点 / Bull ${record.photoScore.bullCount}`;

  if (!analysis) {
    return base;
  }

  return `${base} / ${analysis.summaryText}`;
}

function buildSummaryText(
  categories: Set<FormAdviceCategory>,
  analysis: PhotoScoreGroupingAnalysis | undefined,
  throwingHand: ThrowingHand,
) {
  const handText = throwingHand === 'right' ? '右投げ' : '左投げ';
  const categoryText = Array.from(categories).slice(0, 3).join(' / ') || 'practicePlan';
  const scoreText = analysis
    ? '直近の写真スコア傾向も反映しました。'
    : '写真スコア記録があると次回さらに絞れます。';

  return `${handText}フォームの自己チェックから、${categoryText} を優先して確認します。${scoreText}`;
}

function unique(items: string[]) {
  return Array.from(new Set(items));
}
