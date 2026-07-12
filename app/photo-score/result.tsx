import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { AppButton } from '../../components/AppButton';
import { Card } from '../../components/Card';
import { PhotoBoardCanvas } from '../../components/PhotoBoardCanvas';
import { ScreenShell } from '../../components/ScreenShell';
import { SectionTitle } from '../../components/SectionTitle';
import { boardTypeLabels, dartHitAreaLabels } from '../../constants/photoScore';
import { getPracticeMenuById } from '../../constants/practiceMenus';
import { colors } from '../../constants/theme';
import { useAppState } from '../../contexts/AppStateContext';
import type {
  BoardCalibration,
  DartHitResult,
  PracticeMenu,
  PracticeRecordInput,
} from '../../types';
import { analyzePhotoScoreGrouping } from '../../utils/analyzePhotoScoreGrouping';
import { calculatePhotoScoreSummary } from '../../utils/calculateDartScore';
import { formatPhotoScoreSource } from '../../utils/formatPhotoScoreSource';

export default function PhotoScoreResultScreen() {
  const router = useRouter();
  const { addPracticeRecord, profile } = useAppState();
  const { calibration, hits, imageUri } = useLocalSearchParams<{
    calibration?: string;
    hits?: string;
    imageUri?: string;
  }>();
  const parsedCalibration = useMemo(() => parseJson<BoardCalibration>(calibration), [calibration]);
  const parsedHits = useMemo(() => parseJson<DartHitResult[]>(hits) ?? [], [hits]);
  const summary = calculatePhotoScoreSummary(parsedHits);
  const groupingAnalysis = useMemo(
    () => (parsedCalibration ? analyzePhotoScoreGrouping(parsedHits, parsedCalibration) : null),
    [parsedCalibration, parsedHits],
  );
  const recommendedMenus = useMemo(
    () =>
      groupingAnalysis
        ? groupingAnalysis.recommendedPracticeMenuIds
            .map((menuId) => getPracticeMenuById(menuId))
            .filter((menu): menu is PracticeMenu => menu !== null)
        : [],
    [groupingAnalysis],
  );
  const [isSaving, setIsSaving] = useState(false);
  const normalizedImageUri = imageUri ?? '';
  const markers = parsedHits.map((hit, index) => ({
    id: hit.id,
    point: hit.point,
    label: String(index + 1),
    color:
      hit.area === 'out' ? colors.danger : hit.area === 'triple' ? colors.warning : colors.primary,
  }));

  const saveRecord = async () => {
    if (!parsedCalibration || parsedHits.length !== 3 || isSaving) {
      return;
    }

    setIsSaving(true);

    const record: PracticeRecordInput = {
      practiceMenuId: 'photo-score-round',
      practiceMenuName: '写真スコア記録',
      machineType: profile?.machineType === 'PHOENIX' ? 'PHOENIX' : 'DARTSLIVE',
      gameType: 'COUNT-UP',
      score: summary.totalScore,
      bullCount: summary.bullCount,
      cricketMarks: 0,
      condition: 'normal',
      memo: `写真スコア記録: ${parsedHits.map(formatHitShort).join(' / ')}`,
      inputMethod: 'photoTap',
      photoScore: {
        boardType: parsedCalibration.boardType,
        calibration: parsedCalibration,
        hits: parsedHits,
        totalScore: summary.totalScore,
        bullCount: summary.bullCount,
        tripleCount: summary.tripleCount,
        doubleCount: summary.doubleCount,
        groupingAnalysis: groupingAnalysis ?? undefined,
      },
    };

    await addPracticeRecord(record);
    router.replace('/analysis');
  };

  if (!parsedCalibration || parsedHits.length !== 3) {
    return (
      <ScreenShell>
        <SectionTitle
          title="判定結果がありません"
          subtitle="写真スコア記録を最初からやり直してください。"
        />
        <AppButton label="写真選択へ戻る" onPress={() => router.replace('/photo-score')} />
      </ScreenShell>
    );
  }

  return (
    <ScreenShell>
      <SectionTitle
        title="写真スコア結果"
        subtitle={`${boardTypeLabels[parsedCalibration.boardType]} / 3本の判定結果`}
      />

      {normalizedImageUri ? (
        <Card>
          <PhotoBoardCanvas
            imageUri={normalizedImageUri}
            markers={markers}
            calibration={parsedCalibration}
            helperText="保存時には画像そのものではなく、座標と判定結果を練習記録へ保存します。"
            isExpanded
          />
        </Card>
      ) : (
        <Card muted>
          <Text style={styles.cardTitle}>写真を表示できませんでした</Text>
          <Text style={styles.hitText}>
            座標と判定結果は確認できます。写真を使う場合は最初からやり直してください。
          </Text>
        </Card>
      )}

      <View style={styles.statsRow}>
        <ResultStat label="合計" value={`${summary.totalScore}`} />
        <ResultStat label="Bull" value={`${summary.bullCount}`} />
      </View>
      <View style={styles.statsRow}>
        <ResultStat label="Triple" value={`${summary.tripleCount}`} />
        <ResultStat label="Double" value={`${summary.doubleCount}`} />
      </View>

      <Card>
        <Text style={styles.cardTitle}>1本ごとの判定</Text>
        <View style={styles.hitList}>
          {parsedHits.map((hit, index) => (
            <View key={hit.id} style={styles.hitCard}>
              <Text style={styles.hitTitle}>
                {index + 1}本目：{formatHit(hit)}
              </Text>
              <Text style={styles.hitText}>{formatPhotoScoreSource(hit)}</Text>
            </View>
          ))}
        </View>
      </Card>

      {groupingAnalysis ? (
        <Card muted>
          <Text style={styles.cardTitle}>グルーピング分析</Text>
          <Text style={styles.analysisSummary}>{groupingAnalysis.summaryText}</Text>
          <View style={styles.analysisRows}>
            <Text style={styles.hitText}>
              評価: {formatGroupingQuality(groupingAnalysis.groupingQuality)}
            </Text>
            <Text style={styles.hitText}>
              傾向: {formatVerticalBias(groupingAnalysis.verticalBias)} /{' '}
              {formatHorizontalBias(groupingAnalysis.horizontalBias)}
            </Text>
            <Text style={styles.hitText}>
              散り方: {formatSpreadPattern(groupingAnalysis.spreadPattern)}
            </Text>
            <Text style={styles.hitText}>
              中心からの平均距離: {groupingAnalysis.averageDistanceFromBoardCenter}
            </Text>
            <Text style={styles.hitText}>まとまり半径: {groupingAnalysis.spreadRadius}</Text>
          </View>
        </Card>
      ) : null}

      {groupingAnalysis ? (
        <Card>
          <Text style={styles.cardTitle}>アドバイス</Text>
          <View style={styles.hitList}>
            {groupingAnalysis.adviceTexts.map((adviceText, index) => (
              <Text key={`${adviceText}-${index}`} style={styles.hitText}>
                {index + 1}. {adviceText}
              </Text>
            ))}
          </View>
        </Card>
      ) : null}

      {recommendedMenus.length > 0 ? (
        <Card muted>
          <Text style={styles.cardTitle}>おすすめ練習</Text>
          <View style={styles.hitList}>
            {recommendedMenus.map((menu) => (
              <Text key={menu.id} style={styles.hitText}>
                ・{menu.title}
              </Text>
            ))}
          </View>
        </Card>
      ) : null}

      <AppButton
        label={isSaving ? '保存中...' : 'この内容で保存する'}
        onPress={() => void saveRecord()}
        disabled={isSaving}
      />
      <AppButton
        label="位置を修正する"
        onPress={() =>
          router.push({
            pathname: '/photo-score/mark',
            params: {
              imageUri: normalizedImageUri,
              calibration: JSON.stringify(parsedCalibration),
              hits: JSON.stringify(parsedHits),
            },
          })
        }
        variant="secondary"
      />
      <AppButton
        label="最初からやり直す"
        onPress={() => router.replace('/photo-score')}
        variant="secondary"
      />
    </ScreenShell>
  );
}

function ResultStat({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
    </Card>
  );
}

function parseJson<T>(value: string | undefined): T | null {
  if (!value) {
    return null;
  }

  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

function formatHit(hit: DartHitResult) {
  if (hit.area === 'singleBull' || hit.area === 'doubleBull' || hit.area === 'out') {
    return `${dartHitAreaLabels[hit.area]} / ${hit.score}点`;
  }

  return `${hit.number} ${dartHitAreaLabels[hit.area]} / ${hit.score}点`;
}

function formatHitShort(hit: DartHitResult) {
  if (hit.area === 'singleBull') {
    return 'SBULL';
  }

  if (hit.area === 'doubleBull') {
    return 'DBULL';
  }

  if (hit.area === 'out') {
    return 'OUT';
  }

  return `${hit.number} ${dartHitAreaLabels[hit.area]}`;
}

function formatGroupingQuality(
  value: NonNullable<ReturnType<typeof analyzePhotoScoreGrouping>>['groupingQuality'],
) {
  const labels = {
    good: '良い',
    normal: '普通',
    needsWork: '要改善',
    unknown: '不明',
  };

  return labels[value];
}

function formatVerticalBias(
  value: NonNullable<ReturnType<typeof analyzePhotoScoreGrouping>>['verticalBias'],
) {
  const labels = {
    high: '上寄り',
    low: '下寄り',
    centered: '上下中央寄り',
    unknown: '上下不明',
  };

  return labels[value];
}

function formatHorizontalBias(
  value: NonNullable<ReturnType<typeof analyzePhotoScoreGrouping>>['horizontalBias'],
) {
  const labels = {
    left: '左寄り',
    right: '右寄り',
    centered: '左右中央寄り',
    unknown: '左右不明',
  };

  return labels[value];
}

function formatSpreadPattern(
  value: NonNullable<ReturnType<typeof analyzePhotoScoreGrouping>>['spreadPattern'],
) {
  const labels = {
    tight: 'まとまり',
    vertical: '縦散り',
    horizontal: '横散り',
    wide: '広がり',
    unknown: '不明',
  };

  return labels[value];
}

const styles = StyleSheet.create({
  statsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  statLabel: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '800',
  },
  statValue: {
    marginTop: 6,
    color: colors.text,
    fontSize: 28,
    fontWeight: '900',
  },
  cardTitle: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '900',
  },
  hitList: {
    gap: 8,
    marginTop: 12,
  },
  hitText: {
    color: colors.textMuted,
    fontSize: 14,
    fontWeight: '800',
    lineHeight: 21,
  },
  hitCard: {
    gap: 4,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  hitTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '900',
  },
  analysisSummary: {
    marginTop: 10,
    color: colors.primaryDark,
    fontSize: 15,
    fontWeight: '900',
    lineHeight: 22,
  },
  analysisRows: {
    gap: 6,
    marginTop: 12,
  },
});
