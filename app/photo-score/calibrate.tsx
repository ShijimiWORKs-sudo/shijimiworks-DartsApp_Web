import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { AppButton } from '../../components/AppButton';
import { Card } from '../../components/Card';
import { PhotoBoardCanvas } from '../../components/PhotoBoardCanvas';
import { ScreenShell } from '../../components/ScreenShell';
import { SectionTitle } from '../../components/SectionTitle';
import { boardTypeLabels } from '../../constants/photoScore';
import { colors } from '../../constants/theme';
import type { BoardCalibration, BoardType, NormalizedPoint } from '../../types';
import { getDistance } from '../../utils/calculateDartScore';

const steps = [
  {
    shortTitle: '中心',
    title: 'ボード中心をタップ',
    helper: 'ブルの中心をタップしてください。',
  },
  {
    shortTitle: '20方向',
    title: '20の方向をタップ',
    helper: '20の中心方向、または20セクターの真ん中をタップしてください。',
  },
  {
    shortTitle: '外周',
    title: '外周をタップ',
    helper: 'ダブル外側の外周位置をタップしてください。',
  },
] as const;

export default function PhotoScoreCalibrateScreen() {
  const router = useRouter();
  const { boardType, imageUri } = useLocalSearchParams<{
    boardType?: BoardType;
    imageUri?: string;
  }>();
  const [points, setPoints] = useState<NormalizedPoint[]>([]);
  const [isExpanded, setIsExpanded] = useState(false);
  const [tapMessage, setTapMessage] = useState('');
  const currentStep = steps[Math.min(points.length, steps.length - 1)];
  const normalizedBoardType = boardType ?? 'OTHER';
  const normalizedImageUri = imageUri ?? '';
  const calibration = useMemo<BoardCalibration | null>(() => {
    if (points.length < 3) {
      return null;
    }

    return {
      boardType: normalizedBoardType,
      center: points[0],
      topNumberPoint: points[1],
      outerPoint: points[2],
      outerRadius: getDistance(points[0], points[2]),
      ringPreset: 'soft',
    };
  }, [normalizedBoardType, points]);

  const markers = points.map((point, index) => ({
    id: `calibration-${index}`,
    point,
    label: index === 0 ? '中心' : index === 1 ? '20' : '外',
    color: index === 0 ? colors.primary : index === 1 ? colors.info : colors.warning,
  }));

  const handlePoint = (point: NormalizedPoint) => {
    if (points.length >= 3) {
      return;
    }

    setTapMessage('');
    setPoints((currentPoints) => [...currentPoints, point]);
  };

  const goNext = () => {
    if (!calibration) {
      return;
    }

    router.push({
      pathname: '/photo-score/mark',
      params: {
        imageUri: normalizedImageUri,
        calibration: JSON.stringify(calibration),
      },
    });
  };

  if (!normalizedImageUri) {
    return (
      <ScreenShell>
        <SectionTitle
          title="写真がありません"
          subtitle="写真スコア記録を最初からやり直してください。"
        />
        <AppButton label="写真選択へ戻る" onPress={() => router.replace('/photo-score')} />
      </ScreenShell>
    );
  }

  return (
    <ScreenShell>
      <SectionTitle
        title="ボード設定"
        subtitle={`${boardTypeLabels[normalizedBoardType]} / ${points.length}/3 点を設定`}
      />

      <Card muted>
        <Text style={styles.stepProgress}>Step {Math.min(points.length + 1, 3)} / 3</Text>
        <Text style={styles.currentStepTitle}>
          {points.length >= 3 ? '中心・20方向・外周の設定が完了しました' : currentStep.title}
        </Text>
        <Text style={styles.bodyText}>
          {points.length >= 3 ? '次へ進んで3本の刺さり位置を選びます。' : currentStep.helper}
        </Text>
        <View style={styles.checkList}>
          {steps.map((step, index) => (
            <Text key={step.shortTitle} style={styles.checkText}>
              {points[index] ? '✓' : '○'} {step.shortTitle}
            </Text>
          ))}
        </View>
      </Card>

      <Card>
        <View style={styles.stepHeader}>
          <Text style={styles.stepTitle}>
            {points.length >= 3 ? '設定完了' : `${points.length + 1}. ${currentStep.title}`}
          </Text>
          <Text style={styles.stepCount}>{points.length}/3</Text>
        </View>
        <Text style={styles.bodyText}>1. 中心をタップ / 2. 20方向をタップ / 3. 外周をタップ</Text>
        <View style={styles.legendRow}>
          <LegendDot color={colors.primary} label="中心" />
          <LegendDot color={colors.info} label="20方向" />
          <LegendDot color={colors.warning} label="外周" />
        </View>
        <PhotoBoardCanvas
          imageUri={normalizedImageUri}
          markers={markers}
          calibration={calibration}
          onPressPoint={handlePoint}
          onInvalidPress={() => setTapMessage('写真の上をタップしてください。')}
          helperText={currentStep.helper}
          isExpanded={isExpanded}
        />
        {tapMessage ? <Text style={styles.warningText}>{tapMessage}</Text> : null}
      </Card>

      <Card muted>
        <Text style={styles.bodyText}>
          タップを間違えた場合は「1つ戻す」で修正できます。外周半径は中心から外周タップ位置までの距離で計算します。
        </Text>
      </Card>

      <View style={styles.actionStack}>
        <AppButton
          label={isExpanded ? '通常表示に戻す' : '大きく表示'}
          onPress={() => setIsExpanded((currentValue) => !currentValue)}
          variant="secondary"
        />
        <AppButton
          label="1つ戻す"
          onPress={() => {
            setTapMessage('');
            setPoints((currentPoints) => currentPoints.slice(0, -1));
          }}
          variant="secondary"
          disabled={points.length === 0}
        />
        <AppButton
          label="リセット"
          onPress={() => {
            setTapMessage('');
            setPoints([]);
          }}
          variant="secondary"
          disabled={points.length === 0}
        />
        <AppButton label="3本の位置をタップへ" onPress={goNext} disabled={!calibration} />
        {!calibration ? (
          <Text style={styles.warningText}>中心・20方向・外周をすべて設定してください。</Text>
        ) : null}
        <AppButton
          label="写真選択へ戻る"
          onPress={() => router.replace('/photo-score')}
          variant="secondary"
        />
      </View>
    </ScreenShell>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <View style={styles.legendItem}>
      <View style={[styles.legendDot, { backgroundColor: color }]} />
      <Text style={styles.legendLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  stepProgress: {
    color: colors.primaryDark,
    fontSize: 13,
    fontWeight: '900',
  },
  currentStepTitle: {
    marginTop: 6,
    color: colors.text,
    fontSize: 20,
    fontWeight: '900',
  },
  checkList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
  },
  checkText: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '900',
  },
  stepHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 8,
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
  bodyText: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 20,
  },
  legendRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 12,
    marginBottom: 10,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  legendLabel: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '800',
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
