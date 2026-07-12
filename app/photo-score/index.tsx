import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { AppButton } from '../../components/AppButton';
import { Card } from '../../components/Card';
import { ScreenShell } from '../../components/ScreenShell';
import { SectionTitle } from '../../components/SectionTitle';
import { boardTypeLabels, boardTypes } from '../../constants/photoScore';
import { colors } from '../../constants/theme';
import { useAppState } from '../../contexts/AppStateContext';
import type { BoardType } from '../../types';

export default function PhotoScoreStartScreen() {
  const router = useRouter();
  const { getBoardReferenceImageByBoardType } = useAppState();
  const [boardType, setBoardType] = useState<BoardType>('DARTSLIVE_ZERO');
  const [imageUri, setImageUri] = useState('');
  const [error, setError] = useState('');
  const referenceImage = getBoardReferenceImageByBoardType(boardType);

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
      setError('');
      setImageUri(result.assets[0]?.uri ?? '');
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
      setError('');
      setImageUri(result.assets[0]?.uri ?? '');
    }
  };

  const startCalibration = () => {
    if (!imageUri) {
      setError('ボード写真を撮影または選択してください。');
      return;
    }

    router.push({
      pathname: '/photo-score/calibrate',
      params: {
        boardType,
        imageUri,
      },
    });
  };

  return (
    <ScreenShell>
      <SectionTitle
        title="写真スコア記録"
        subtitle="写真上で位置を確認・調整して、スコアとグルーピング傾向を保存します。"
      />

      <Card muted>
        <Text style={styles.cardTitle}>写真スコア記録の流れ</Text>
        <View style={styles.flowList}>
          <FlowStep index={1} text="ボード写真を用意" />
          <FlowStep index={2} text="中心・20方向・外周を合わせる" />
          <FlowStep index={3} text="3本の位置を選ぶ" />
          <FlowStep index={4} text="結果とアドバイスを保存" />
        </View>
        <Text style={styles.bodyText}>
          完全自動採点ではありません。候補が外れる場合は写真上で調整できます。DARTSLIVE
          HOME以外の自宅練習ボードも、写真と手動補正で記録できます。
        </Text>
      </Card>

      <Card>
        <Text style={styles.cardTitle}>対象ボード</Text>
        <View style={styles.chipGrid}>
          {boardTypes.map((item) => (
            <Pressable
              key={item}
              accessibilityRole="button"
              onPress={() => setBoardType(item)}
              style={[styles.chip, boardType === item && styles.chipSelected]}
            >
              <Text style={[styles.chipText, boardType === item && styles.chipTextSelected]}>
                {boardTypeLabels[item]}
              </Text>
            </Pressable>
          ))}
        </View>
      </Card>

      <Card muted>
        <Text style={styles.cardTitle}>基準画像</Text>
        {referenceImage ? (
          <Text style={styles.bodyText}>
            {boardTypeLabels[boardType]}{' '}
            の基準画像が登録済みです。撮影条件が変わった場合は撮り直してください。
          </Text>
        ) : (
          <Text style={styles.bodyText}>
            このボード種別の基準画像は未登録です。手動記録はそのまま使えますが、基準画像を登録すると候補表示前にズレを確認できます。
          </Text>
        )}
        <View style={styles.actionStack}>
          <AppButton
            label={referenceImage ? '基準画像を確認・変更' : '基準画像を登録'}
            onPress={() => router.push('/photo-score/reference')}
            variant="secondary"
          />
        </View>
      </Card>

      <Card>
        <Text style={styles.cardTitle}>ボード写真</Text>
        <Text style={styles.bodyText}>
          MVPでは写真そのものを永続保存せず、タップ座標、キャリブレーション、判定結果、グルーピング分析を保存します。
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
        {error ? <Text style={styles.errorText}>{error}</Text> : null}
      </Card>

      <AppButton label="キャリブレーションへ" onPress={startCalibration} disabled={!imageUri} />
      <AppButton
        label="記録入力へ戻る"
        onPress={() => router.push('/record')}
        variant="secondary"
      />
    </ScreenShell>
  );
}

function FlowStep({ index, text }: { index: number; text: string }) {
  return (
    <View style={styles.flowStep}>
      <Text style={styles.flowIndex}>{index}</Text>
      <Text style={styles.flowText}>{text}</Text>
    </View>
  );
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
  flowList: {
    gap: 10,
    marginTop: 14,
  },
  flowStep: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  flowIndex: {
    width: 28,
    height: 28,
    borderRadius: 14,
    color: '#ffffff',
    backgroundColor: colors.primary,
    fontSize: 14,
    fontWeight: '900',
    lineHeight: 28,
    textAlign: 'center',
  },
  flowText: {
    flex: 1,
    color: colors.text,
    fontSize: 14,
    fontWeight: '800',
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
  actionStack: {
    gap: 10,
    marginTop: 14,
  },
  errorText: {
    marginTop: 10,
    color: colors.danger,
    fontSize: 13,
    fontWeight: '800',
  },
});
