import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { AppButton } from '../../../components/AppButton';
import { Card } from '../../../components/Card';
import { PhotoBoardCanvas } from '../../../components/PhotoBoardCanvas';
import { ScreenShell } from '../../../components/ScreenShell';
import { SectionTitle } from '../../../components/SectionTitle';
import { boardTypeLabels, boardTypes } from '../../../constants/photoScore';
import { colors } from '../../../constants/theme';
import { useAppState } from '../../../contexts/AppStateContext';
import type { BoardCalibration, BoardType, NormalizedPoint } from '../../../types';
import { getDistance } from '../../../utils/calculateDartScore';

const steps = [
  {
    shortTitle: '中心',
    title: 'ボード中心をタップ',
    helper: '空のボード写真で、ブルの中心をタップしてください。',
  },
  {
    shortTitle: '20方向',
    title: '20の方向をタップ',
    helper: '20セクターの中央方向をタップしてください。',
  },
  {
    shortTitle: '外周',
    title: '外周をタップ',
    helper: 'ダブル外側の外周位置をタップしてください。',
  },
] as const;

export default function PhotoScoreReferenceRegisterScreen() {
  const router = useRouter();
  const { saveBoardReferenceImage } = useAppState();
  const [boardType, setBoardType] = useState<BoardType>('DARTSLIVE_ZERO');
  const [imageUri, setImageUri] = useState('');
  const [points, setPoints] = useState<NormalizedPoint[]>([]);
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [tapMessage, setTapMessage] = useState('');
  const [isExpanded, setIsExpanded] = useState(false);
  const currentStep = steps[Math.min(points.length, steps.length - 1)];
  const calibration = useMemo<BoardCalibration | null>(() => {
    if (points.length < 3) {
      return null;
    }

    return {
      boardType,
      center: points[0],
      topNumberPoint: points[1],
      outerPoint: points[2],
      outerRadius: getDistance(points[0], points[2]),
      ringPreset: 'soft',
    };
  }, [boardType, points]);
  const markers = points.map((point, index) => ({
    id: `reference-${index}`,
    point,
    label: index === 0 ? '中心' : index === 1 ? '20' : '外',
    color: index === 0 ? colors.primary : index === 1 ? colors.info : colors.warning,
  }));

  const pickImage = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permission.granted) {
      setError('写真ライブラリへのアクセスを許可してください。');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.85,
    });

    if (!result.canceled) {
      setImageUri(result.assets[0]?.uri ?? '');
      setPoints([]);
      setError('');
    }
  };

  const takePhoto = async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();

    if (!permission.granted) {
      setError('カメラへのアクセスを許可してください。');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.85,
    });

    if (!result.canceled) {
      setImageUri(result.assets[0]?.uri ?? '');
      setPoints([]);
      setError('');
    }
  };

  const handlePoint = (point: NormalizedPoint) => {
    if (!imageUri || points.length >= 3) {
      return;
    }

    setTapMessage('');
    setPoints((currentPoints) => [...currentPoints, point]);
  };

  const saveReferenceImage = async () => {
    if (!imageUri || !calibration) {
      setError('空のボード写真と中心・20方向・外周を設定してください。');
      return;
    }

    const imageSize = await getImageSize(imageUri);
    const now = new Date().toISOString();

    await saveBoardReferenceImage({
      id: `board-reference-${boardType}-${Date.now()}`,
      boardType,
      imageUri,
      calibration,
      createdAt: now,
      note: note.trim() || undefined,
      imageWidth: imageSize?.width,
      imageHeight: imageSize?.height,
    });

    router.replace('/photo-score/reference');
  };

  return (
    <ScreenShell>
      <SectionTitle
        title="基準画像を登録"
        subtitle="ダーツが刺さっていない空のボード写真で、比較用の基準を作ります。"
      />

      <Card>
        <Text style={styles.cardTitle}>ボード種別</Text>
        <View style={styles.chipGrid}>
          {boardTypes.map((item) => (
            <Pressable
              key={item}
              accessibilityRole="button"
              onPress={() => {
                setBoardType(item);
                setPoints([]);
              }}
              style={[styles.chip, boardType === item && styles.chipSelected]}
            >
              <Text style={[styles.chipText, boardType === item && styles.chipTextSelected]}>
                {boardTypeLabels[item]}
              </Text>
            </Pressable>
          ))}
        </View>
      </Card>

      <Card>
        <Text style={styles.cardTitle}>空のボード写真</Text>
        <Text style={styles.bodyText}>
          普段の写真スコア記録と同じ距離・角度で、ダーツを抜いた状態を撮影してください。
        </Text>
        {imageUri ? (
          <Image source={{ uri: imageUri }} resizeMode="contain" style={styles.preview} />
        ) : (
          <Text style={styles.noticeText}>先に写真を選択または撮影してください。</Text>
        )}
        <View style={styles.actionStack}>
          <AppButton label="写真を選択" onPress={() => void pickImage()} />
          <AppButton label="カメラで撮影" onPress={() => void takePhoto()} />
        </View>
      </Card>

      {imageUri ? (
        <>
          <Card muted>
            <Text style={styles.stepProgress}>Step {Math.min(points.length + 1, 3)} / 3</Text>
            <Text style={styles.currentStepTitle}>
              {points.length >= 3 ? '基準位置の設定が完了しました' : currentStep.title}
            </Text>
            <Text style={styles.bodyText}>
              {points.length >= 3
                ? '保存すると、このボード種別の基準画像として使われます。'
                : currentStep.helper}
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
            <View style={styles.legendRow}>
              <LegendDot color={colors.primary} label="中心" />
              <LegendDot color={colors.info} label="20方向" />
              <LegendDot color={colors.warning} label="外周" />
            </View>
            <PhotoBoardCanvas
              imageUri={imageUri}
              markers={markers}
              calibration={calibration}
              onPressPoint={handlePoint}
              onInvalidPress={() => setTapMessage('写真の上をタップしてください。')}
              helperText={currentStep.helper}
              isExpanded={isExpanded}
            />
            {tapMessage ? <Text style={styles.warningText}>{tapMessage}</Text> : null}
          </Card>
        </>
      ) : null}

      <Card>
        <Text style={styles.cardTitle}>撮影条件メモ</Text>
        <TextInput
          accessibilityLabel="撮影条件メモ"
          value={note}
          onChangeText={setNote}
          placeholder="例：机にスマホを置いて撮影 / 部屋の照明ON"
          placeholderTextColor={colors.textMuted}
          multiline
          style={styles.input}
        />
      </Card>

      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      <View style={styles.actionStack}>
        <AppButton
          label={isExpanded ? '通常表示に戻す' : '大きく表示'}
          onPress={() => setIsExpanded((currentValue) => !currentValue)}
          variant="secondary"
          disabled={!imageUri}
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
        <AppButton
          label="基準画像を保存"
          onPress={() => void saveReferenceImage()}
          disabled={!calibration}
        />
        {!calibration ? (
          <Text style={styles.warningText}>中心・20方向・外周をすべて設定してください。</Text>
        ) : null}
        <AppButton
          label="基準画像一覧へ戻る"
          onPress={() => router.push('/photo-score/reference')}
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

function getImageSize(imageUri: string) {
  return new Promise<{ width: number; height: number } | null>((resolve) => {
    Image.getSize(
      imageUri,
      (width, height) => resolve({ width, height }),
      () => resolve(null),
    );
  });
}

const styles = StyleSheet.create({
  cardTitle: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '900',
  },
  bodyText: {
    marginTop: 8,
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 20,
  },
  noticeText: {
    marginTop: 12,
    color: colors.warning,
    fontSize: 13,
    fontWeight: '900',
  },
  chipGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 14,
  },
  chip: {
    minHeight: 40,
    justifyContent: 'center',
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  chipSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
  },
  chipText: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '800',
  },
  chipTextSelected: {
    color: colors.primaryDark,
  },
  preview: {
    width: '100%',
    height: 220,
    marginTop: 14,
    borderRadius: 8,
    backgroundColor: colors.surfaceMuted,
  },
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
  input: {
    minHeight: 96,
    marginTop: 12,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.text,
    backgroundColor: colors.surface,
    fontSize: 14,
    lineHeight: 20,
    textAlignVertical: 'top',
  },
  warningText: {
    marginTop: 10,
    color: colors.warning,
    fontSize: 13,
    fontWeight: '800',
  },
  errorText: {
    color: colors.danger,
    fontSize: 13,
    fontWeight: '800',
  },
  actionStack: {
    gap: 10,
  },
});
