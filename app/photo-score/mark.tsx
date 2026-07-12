import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AppButton } from '../../components/AppButton';
import { Card } from '../../components/Card';
import { PhotoBoardCanvas } from '../../components/PhotoBoardCanvas';
import { ScreenShell } from '../../components/ScreenShell';
import { SectionTitle } from '../../components/SectionTitle';
import { dartHitAreaLabels } from '../../constants/photoScore';
import { colors } from '../../constants/theme';
import { useAppState } from '../../contexts/AppStateContext';
import type {
  BoardCalibration,
  DifferenceDetectionResult,
  DartHitResult,
  NormalizedPoint,
  PhotoScoreCandidate,
  PhotoScoreDetectionMode,
} from '../../types';
import { adjustPhotoScoreHit, nudgePhotoScoreHit } from '../../utils/adjustPhotoScoreHit';
import { calculatePhotoScoreSummary } from '../../utils/calculateDartScore';
import { detectDartCandidatesFromDifference } from '../../utils/detectDartCandidatesFromDifference';
import { detectDartCandidatesFromImage } from '../../utils/detectDartCandidatesFromImage';
import {
  buildPhotoScoreHit,
  generateCalibrationBasedCandidates,
  mergePhotoScoreCandidates,
} from '../../utils/photoScoreCandidates';

export default function PhotoScoreMarkScreen() {
  const router = useRouter();
  const { getBoardReferenceImageByBoardType } = useAppState();
  const {
    calibration,
    hits: hitsParam,
    imageUri,
  } = useLocalSearchParams<{
    calibration?: string;
    hits?: string;
    imageUri?: string;
  }>();
  const normalizedImageUri = imageUri ?? '';
  const parsedCalibration = useMemo(() => parseCalibration(calibration), [calibration]);
  const initialHits = useMemo(() => parseHits(hitsParam), [hitsParam]);
  const [hits, setHits] = useState<DartHitResult[]>(initialHits);
  const [isExpanded, setIsExpanded] = useState(false);
  const [tapMessage, setTapMessage] = useState('');
  const [detectionMode, setDetectionMode] = useState<PhotoScoreDetectionMode>('manual');
  const [activeHitId, setActiveHitId] = useState<string | null>(null);
  const [imageCandidates, setImageCandidates] = useState<PhotoScoreCandidate[]>([]);
  const [isDetectingCandidates, setIsDetectingCandidates] = useState(false);
  const [isDetectingReferenceCandidates, setIsDetectingReferenceCandidates] = useState(false);
  const [candidateMessage, setCandidateMessage] = useState('');
  const [differenceDetectionResult, setDifferenceDetectionResult] =
    useState<DifferenceDetectionResult | null>(null);
  const [isLargeNudge, setIsLargeNudge] = useState(false);
  const summary = calculatePhotoScoreSummary(hits);
  const referenceImage = parsedCalibration
    ? getBoardReferenceImageByBoardType(parsedCalibration.boardType)
    : null;
  const activeHit = hits.find((hit) => hit.id === activeHitId) ?? null;
  const selectedCandidateIds = hits
    .map((hit) => hit.candidateId)
    .filter((candidateId): candidateId is string => Boolean(candidateId));
  const calibrationCandidates = useMemo(
    () =>
      parsedCalibration
        ? generateCalibrationBasedCandidates(parsedCalibration, selectedCandidateIds)
        : [],
    [parsedCalibration, selectedCandidateIds],
  );
  const candidates = useMemo(
    () =>
      mergePhotoScoreCandidates(imageCandidates, calibrationCandidates, {
        maxCandidates: 6,
        selectedCandidateIds,
      }),
    [calibrationCandidates, imageCandidates, selectedCandidateIds],
  );
  const markers = hits.map((hit, index) => ({
    id: hit.id,
    point: hit.point,
    label: String(index + 1),
    selected: hit.id === activeHitId,
    color: getHitMarkerColor(hit),
  }));
  const candidateMarkers =
    detectionMode === 'semiAuto'
      ? candidates.map((candidate, index) => ({
          id: candidate.id,
          point: candidate.point,
          label: `候補${index + 1}`,
          selected: candidate.selected,
          color: candidate.source === 'imageAnalysisCandidate' ? '#A64A97' : colors.info,
        }))
      : [];

  const handlePoint = (point: NormalizedPoint) => {
    if (!parsedCalibration || hits.length >= 3) {
      return;
    }

    const nextId = `dart-${hits.length + 1}`;
    const nextHit = buildPhotoScoreHit(parsedCalibration, point, nextId, 'manualTap');
    setTapMessage('');
    setActiveHitId(nextId);
    setHits((currentHits) => [...currentHits, nextHit]);
  };

  const selectCandidate = (candidate: PhotoScoreCandidate) => {
    if (!parsedCalibration || hits.length >= 3 || candidate.selected) {
      return;
    }

    const nextId = `dart-${hits.length + 1}`;
    const nextHit = buildPhotoScoreHit(
      parsedCalibration,
      candidate.point,
      nextId,
      candidate.source ?? 'autoCandidate',
      candidate,
    );

    setTapMessage('');
    setActiveHitId(nextId);
    setHits((currentHits) => [...currentHits, nextHit]);
  };

  const detectImageCandidates = async () => {
    if (!parsedCalibration || isDetectingCandidates) {
      return;
    }

    setIsDetectingCandidates(true);
    setDetectionMode('semiAuto');
    setCandidateMessage('候補生成中...');

    const detectedCandidates = await detectDartCandidatesFromImage(
      normalizedImageUri,
      parsedCalibration,
      {
        maxCandidates: 5,
        minConfidence: 0.45,
        enableHeuristicFallback: true,
      },
    );

    setImageCandidates(detectedCandidates);
    setIsDetectingCandidates(false);

    if (detectedCandidates.length === 0) {
      setCandidateMessage(
        '画像から候補を検出できませんでした。キャリブレーション候補または手動追加を使ってください。',
      );
      return;
    }

    setCandidateMessage(
      '自動候補βを表示しました。候補が違う場合は使わず、手動追加またはドラッグ調整してください。',
    );
  };

  const detectReferenceCandidates = async () => {
    if (!parsedCalibration || isDetectingReferenceCandidates) {
      return;
    }

    setIsDetectingReferenceCandidates(true);
    setDetectionMode('semiAuto');
    setCandidateMessage('基準画像との一致度を確認しています...');

    const result = await detectDartCandidatesFromDifference({
      referenceImage,
      currentImageUri: normalizedImageUri,
      currentCalibration: parsedCalibration,
      maxCandidates: 5,
    });

    setDifferenceDetectionResult(result);
    setImageCandidates(result.candidates);
    setIsDetectingReferenceCandidates(false);

    if (result.candidates.length === 0) {
      setCandidateMessage(
        '基準画像から候補を作れませんでした。手動追加または補助候補を使ってください。',
      );
      return;
    }

    if (result.detectionMethod === 'referenceDifference') {
      setCandidateMessage('基準画像との比較候補を表示しました。正しい候補だけを選んでください。');
      return;
    }

    if (result.detectionMethod === 'singleImageHeuristic') {
      setCandidateMessage(
        '基準画像の一致度を確認しました。現時点では単一画像の自動候補βへフォールバックしています。',
      );
      return;
    }

    setCandidateMessage(
      'キャリブレーション位置から補助候補を表示しています。手動確認してください。',
    );
  };

  const adjustActiveHit = (point: NormalizedPoint) => {
    if (!parsedCalibration || !activeHitId) {
      return;
    }

    setHits((currentHits) =>
      currentHits.map((hit) => {
        if (hit.id !== activeHitId) {
          return hit;
        }

        return adjustPhotoScoreHit(parsedCalibration, hit, point);
      }),
    );
  };

  const nudgeActiveHit = (delta: NormalizedPoint) => {
    if (!parsedCalibration || !activeHitId) {
      setTapMessage('選択済み点をタップすると微調整できます。');
      return;
    }

    setHits((currentHits) =>
      currentHits.map((hit) =>
        hit.id === activeHitId ? nudgePhotoScoreHit(parsedCalibration, hit, delta) : hit,
      ),
    );
    setTapMessage('微調整しました。スコアを再判定しています。');
  };

  const goResult = () => {
    if (!parsedCalibration || hits.length !== 3) {
      return;
    }

    router.push({
      pathname: '/photo-score/result',
      params: {
        imageUri: normalizedImageUri,
        calibration: JSON.stringify(parsedCalibration),
        hits: JSON.stringify(hits),
      },
    });
  };

  if (!normalizedImageUri || !parsedCalibration) {
    return (
      <ScreenShell>
        <SectionTitle
          title="設定がありません"
          subtitle="写真スコア記録を最初からやり直してください。"
        />
        <AppButton label="写真選択へ戻る" onPress={() => router.replace('/photo-score')} />
      </ScreenShell>
    );
  }

  return (
    <ScreenShell>
      <SectionTitle
        title="刺さった位置を選択"
        subtitle="まず手動で先端位置を指定し、必要に応じて自動候補βや微調整を使います。"
      />

      <Card muted>
        <Text style={styles.progressTitle}>{hits.length} / 3本 選択済み</Text>
        <Text style={styles.modeHelper}>
          {hits.length < 3
            ? '3本選択すると結果へ進めます。候補が違う場合は手動で写真上をタップしてください。'
            : '3本揃いました。必要なら点を選んでドラッグ調整してから結果へ進みます。'}
        </Text>
      </Card>

      <Card>
        <Text style={styles.summaryTitle}>入力モード</Text>
        <View style={styles.modeRow}>
          <ModeChip
            label="手動で1本追加"
            selected={detectionMode === 'manual'}
            onPress={() => {
              setDetectionMode('manual');
              setActiveHitId(null);
              setTapMessage('写真上の刺さった先端付近をタップしてください。');
            }}
          />
          <ModeChip
            label="自動候補βを試す"
            selected={detectionMode === 'semiAuto'}
            onPress={() => setDetectionMode('semiAuto')}
          />
          <ModeChip
            label="選択点を調整"
            selected={Boolean(activeHitId)}
            onPress={() => {
              const latestHit = hits[hits.length - 1];
              if (latestHit) {
                setActiveHitId(latestHit.id);
              }
            }}
          />
        </View>
        <Text style={styles.modeHelper}>
          画像候補はβ機能です。候補がズレる場合は、手動追加またはドラッグ調整してください。最終的な判定は、ユーザーが選択・調整した位置で行います。
        </Text>
        <AppButton
          label="手動で1本追加"
          onPress={() => {
            setDetectionMode('manual');
            setActiveHitId(null);
            setTapMessage('写真上の刺さった先端付近をタップしてください。');
          }}
          disabled={hits.length >= 3}
        />
        <Text style={styles.modeHelper}>
          ダーツのフライトやシャフトではなく、ボードに刺さっている先端付近を指定してください。
        </Text>
        <View style={styles.detectActions}>
          <AppButton
            label={
              isDetectingReferenceCandidates
                ? '基準画像と確認中...'
                : '基準画像と比較して候補を探す'
            }
            onPress={() => void detectReferenceCandidates()}
            variant="secondary"
            disabled={isDetectingReferenceCandidates || !referenceImage}
          />
          <AppButton
            label={isDetectingCandidates ? '候補生成中...' : '画像候補βを試す'}
            onPress={() => void detectImageCandidates()}
            variant="secondary"
            disabled={isDetectingCandidates}
          />
          <AppButton
            label="候補をリセット"
            onPress={() => {
              setImageCandidates([]);
              setDifferenceDetectionResult(null);
              setCandidateMessage(
                '画像候補βをリセットしました。補助候補または手動追加を使ってください。',
              );
            }}
            variant="secondary"
            disabled={imageCandidates.length === 0}
          />
        </View>
        {candidateMessage ? <Text style={styles.modeHelper}>{candidateMessage}</Text> : null}
        {!referenceImage ? (
          <Text style={styles.modeHelper}>
            このボード種別の基準画像は未登録です。先に登録すると、撮影ズレを確認してから候補を探せます。
          </Text>
        ) : null}
        {differenceDetectionResult ? (
          <DetectionQualityBox result={differenceDetectionResult} />
        ) : null}
        <Text style={styles.betaNote}>
          候補が実際の刺さり位置と違う場合は、候補を使わず手動で追加してください。先端位置を合わせると判定が安定します。
        </Text>
      </Card>

      <Card>
        <View style={styles.stepHeader}>
          <Text style={styles.stepTitle}>
            {hits.length >= 3 ? '3本のタップ完了' : `${hits.length + 1}本目をタップしてください`}
          </Text>
          <Text style={styles.stepCount}>{hits.length}/3</Text>
        </View>
        <PhotoBoardCanvas
          imageUri={normalizedImageUri}
          markers={markers}
          candidateMarkers={candidateMarkers}
          calibration={parsedCalibration}
          onPressPoint={handlePoint}
          onDragActiveMarker={adjustActiveHit}
          onInvalidPress={() => setTapMessage('写真の上をタップしてください。')}
          helperText={
            activeHitId
              ? 'ドラッグで調整できます。動かすと再判定され、微調整済みとして表示します。'
              : '候補を選ぶか、ダーツが刺さった先端位置をタップしてください。'
          }
          isExpanded={isExpanded}
        />
        {tapMessage ? <Text style={styles.warningText}>{tapMessage}</Text> : null}
      </Card>

      {detectionMode === 'semiAuto' ? (
        <Card muted>
          <Text style={styles.summaryTitle}>自動候補β / 補助候補</Text>
          <Text style={styles.modeHelper}>
            候補は自動確定ではありません。正しい候補だけを選び、違う場合は手動で先端位置を追加してください。
          </Text>
          <View style={styles.candidateList}>
            {candidates.length === 0 ? (
              <Text style={styles.warningText}>
                候補を検出できませんでした。手動で位置を追加してください。
              </Text>
            ) : (
              candidates.map((candidate, index) => (
                <Pressable
                  key={candidate.id}
                  accessibilityRole="button"
                  disabled={candidate.selected || hits.length >= 3}
                  onPress={() => selectCandidate(candidate)}
                  style={[styles.candidateRow, candidate.selected && styles.candidateRowSelected]}
                >
                  <View style={styles.candidateMain}>
                    <Text style={styles.candidateTitle}>
                      {candidate.source === 'imageAnalysisCandidate' ? '自動候補β' : '補助候補'}
                      {index + 1}
                    </Text>
                    <Text style={styles.candidateReason}>{candidate.reason}</Text>
                  </View>
                  <Text style={styles.candidateConfidence}>
                    {candidate.selected
                      ? '選択済み'
                      : candidate.source === 'imageAnalysisCandidate'
                        ? '要確認'
                        : '候補目安'}
                  </Text>
                </Pressable>
              ))
            )}
          </View>
          {candidates.length >= 3 ? (
            <Text style={styles.modeHelper}>
              正しい3本を選び、必要ならドラッグで位置を調整してください。
            </Text>
          ) : null}
        </Card>
      ) : null}

      <Card>
        <Text style={styles.summaryTitle}>十字微調整</Text>
        <Text style={styles.modeHelper}>
          {activeHit
            ? `調整中：${formatHit(activeHit)}。矢印で少しずつ動かすと、スコアを再判定します。`
            : '選択済み点をタップすると、ここで細かく調整できます。'}
        </Text>
        <View style={styles.nudgeModeRow}>
          <ModeChip
            label="少し動かす"
            selected={!isLargeNudge}
            onPress={() => setIsLargeNudge(false)}
          />
          <ModeChip
            label="大きく動かす"
            selected={isLargeNudge}
            onPress={() => setIsLargeNudge(true)}
          />
        </View>
        <View style={styles.nudgePad}>
          <View style={styles.nudgePadRow}>
            <NudgeButton
              label="↑"
              disabled={!activeHit}
              onPress={() => nudgeActiveHit({ x: 0, y: -(isLargeNudge ? 0.01 : 0.003) })}
            />
          </View>
          <View style={styles.nudgePadRow}>
            <NudgeButton
              label="←"
              disabled={!activeHit}
              onPress={() => nudgeActiveHit({ x: -(isLargeNudge ? 0.01 : 0.003), y: 0 })}
            />
            <NudgeButton
              label="↓"
              disabled={!activeHit}
              onPress={() => nudgeActiveHit({ x: 0, y: isLargeNudge ? 0.01 : 0.003 })}
            />
            <NudgeButton
              label="→"
              disabled={!activeHit}
              onPress={() => nudgeActiveHit({ x: isLargeNudge ? 0.01 : 0.003, y: 0 })}
            />
          </View>
        </View>
      </Card>

      <Card muted>
        <Text style={styles.summaryTitle}>選択済みの3本</Text>
        <Text style={styles.summaryText}>
          合計 {summary.totalScore} / Bull {summary.bullCount} / Triple {summary.tripleCount} /
          Double {summary.doubleCount}
        </Text>
        <View style={styles.hitList}>
          {hits.length === 0 ? (
            <Text style={styles.hitText}>まだ選択されていません。</Text>
          ) : (
            hits.map((hit, index) => (
              <Pressable
                key={hit.id}
                accessibilityRole="button"
                onPress={() => setActiveHitId(hit.id)}
                style={[styles.hitRow, activeHitId === hit.id && styles.hitRowSelected]}
              >
                <Text style={styles.hitText}>
                  {index + 1}本目：{formatHit(hit)}
                </Text>
                <Text style={styles.hitSource}>{formatSource(hit)}</Text>
              </Pressable>
            ))
          )}
        </View>
      </Card>

      <View style={styles.actionStack}>
        <AppButton
          label={isExpanded ? '通常表示に戻す' : '大きく表示'}
          onPress={() => setIsExpanded((currentValue) => !currentValue)}
          variant="secondary"
        />
        <AppButton
          label="1本戻す"
          onPress={() => {
            setTapMessage('');
            setHits((currentHits) => currentHits.slice(0, -1));
            setActiveHitId(null);
          }}
          variant="secondary"
          disabled={hits.length === 0}
        />
        <AppButton
          label="リセット"
          onPress={() => {
            setTapMessage('');
            setHits([]);
            setActiveHitId(null);
          }}
          variant="secondary"
          disabled={hits.length === 0}
        />
        <AppButton label="結果を見る" onPress={goResult} disabled={hits.length !== 3} />
        {hits.length !== 3 ? (
          <Text style={styles.warningText}>3本選択すると結果へ進めます。</Text>
        ) : null}
        <AppButton
          label="キャリブレーションへ戻る"
          onPress={() => router.replace('/photo-score')}
          variant="secondary"
        />
      </View>
    </ScreenShell>
  );
}

function DetectionQualityBox({ result }: { result: DifferenceDetectionResult }) {
  const methodLabel =
    result.detectionMethod === 'referenceDifference'
      ? '基準画像比較'
      : result.detectionMethod === 'singleImageHeuristic'
        ? '単一画像候補β'
        : '補助候補';

  return (
    <View style={styles.qualityBox}>
      <Text style={styles.qualityTitle}>
        {methodLabel} / {result.quality.isUsable ? '撮影ズレは許容範囲' : '撮影ズレに注意'}
      </Text>
      <Text style={styles.qualityText}>
        中心差 {formatMetric(result.quality.centerDistance)} / 大きさ差{' '}
        {Math.round(result.quality.radiusDifference * 100)}% / 回転差{' '}
        {Math.round(result.quality.rotationDifferenceDegrees)}°
      </Text>
      {result.warnings.length > 0 ? (
        <View style={styles.warningList}>
          {result.warnings.map((warning) => (
            <Text key={warning} style={styles.qualityWarning}>
              ・{warning}
            </Text>
          ))}
        </View>
      ) : (
        <Text style={styles.qualityText}>大きなズレ警告はありません。</Text>
      )}
    </View>
  );
}

function parseCalibration(value: string | undefined): BoardCalibration | null {
  if (!value) {
    return null;
  }

  try {
    return JSON.parse(value) as BoardCalibration;
  } catch {
    return null;
  }
}

function formatMetric(value: number) {
  return value.toFixed(3);
}

function parseHits(value: string | undefined): DartHitResult[] {
  if (!value) {
    return [];
  }

  try {
    const parsedValue = JSON.parse(value) as DartHitResult[];
    return Array.isArray(parsedValue) ? parsedValue : [];
  } catch {
    return [];
  }
}

function formatHit(hit: DartHitResult) {
  if (hit.area === 'singleBull' || hit.area === 'doubleBull' || hit.area === 'out') {
    return `${dartHitAreaLabels[hit.area]} / ${hit.score}点`;
  }

  return `${hit.number} ${dartHitAreaLabels[hit.area]} / ${hit.score}点`;
}

function formatSource(hit: DartHitResult) {
  if (hit.detectionSource === 'imageAnalysisCandidate') {
    return hit.confidence ? `自動候補β / 目安 ${Math.round(hit.confidence * 100)}%` : '自動候補β';
  }

  if (hit.detectionSource === 'autoCandidate') {
    return hit.confidence ? `補助候補 / 目安 ${Math.round(hit.confidence * 100)}%` : '補助候補';
  }

  if (hit.detectionSource === 'adjusted') {
    return `調整済み：${formatHit(hit)}`;
  }

  return '手動追加';
}

function getHitMarkerColor(hit: DartHitResult) {
  if (hit.area === 'out') {
    return colors.danger;
  }

  if (hit.detectionSource === 'adjusted') {
    return colors.warning;
  }

  if (hit.detectionSource === 'imageAnalysisCandidate') {
    return '#A64A97';
  }

  if (hit.detectionSource === 'autoCandidate') {
    return colors.info;
  }

  return colors.primary;
}

function ModeChip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={[styles.modeChip, selected && styles.modeChipSelected]}
    >
      <Text style={[styles.modeChipText, selected && styles.modeChipTextSelected]}>{label}</Text>
    </Pressable>
  );
}

function NudgeButton({
  disabled,
  label,
  onPress,
}: {
  disabled?: boolean;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={[styles.nudgeButton, disabled && styles.nudgeButtonDisabled]}
    >
      <Text style={[styles.nudgeButtonText, disabled && styles.nudgeButtonTextDisabled]}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  stepHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 10,
  },
  progressTitle: {
    color: colors.primaryDark,
    fontSize: 20,
    fontWeight: '900',
  },
  stepTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '900',
  },
  stepCount: {
    color: colors.primaryDark,
    fontSize: 14,
    fontWeight: '900',
  },
  summaryTitle: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '900',
  },
  summaryText: {
    marginTop: 8,
    color: colors.primaryDark,
    fontSize: 14,
    fontWeight: '900',
    lineHeight: 21,
  },
  modeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 12,
  },
  modeChip: {
    minHeight: 40,
    justifyContent: 'center',
    paddingHorizontal: 14,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  modeChipSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
  },
  modeChipText: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '900',
  },
  modeChipTextSelected: {
    color: colors.primaryDark,
  },
  modeHelper: {
    marginTop: 10,
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 20,
  },
  detectActions: {
    gap: 10,
    marginTop: 12,
  },
  betaNote: {
    marginTop: 10,
    color: colors.warning,
    fontSize: 12,
    fontWeight: '800',
    lineHeight: 18,
  },
  qualityBox: {
    gap: 6,
    marginTop: 12,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceMuted,
  },
  qualityTitle: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '900',
  },
  qualityText: {
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 18,
  },
  warningList: {
    gap: 4,
  },
  qualityWarning: {
    color: colors.warning,
    fontSize: 12,
    fontWeight: '800',
    lineHeight: 18,
  },
  candidateList: {
    gap: 8,
    marginTop: 12,
  },
  candidateRow: {
    minHeight: 58,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  candidateRowSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
  },
  candidateMain: {
    flex: 1,
    gap: 4,
  },
  candidateTitle: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '900',
  },
  candidateReason: {
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 17,
  },
  candidateConfidence: {
    color: colors.info,
    fontSize: 12,
    fontWeight: '900',
  },
  hitList: {
    gap: 6,
    marginTop: 12,
  },
  hitRow: {
    gap: 4,
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  hitRowSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
  },
  hitText: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '800',
  },
  hitSource: {
    color: colors.primaryDark,
    fontSize: 12,
    fontWeight: '900',
  },
  nudgeModeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 12,
  },
  nudgePad: {
    gap: 8,
    marginTop: 14,
    alignItems: 'center',
  },
  nudgePadRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 10,
  },
  nudgeButton: {
    width: 58,
    height: 46,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    backgroundColor: colors.primary,
  },
  nudgeButtonDisabled: {
    backgroundColor: colors.border,
  },
  nudgeButtonText: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: '900',
  },
  nudgeButtonTextDisabled: {
    color: colors.textMuted,
  },
  warningText: {
    marginTop: 10,
    color: colors.warning,
    fontSize: 13,
    fontWeight: '800',
  },
  actionStack: {
    gap: 10,
  },
});
