import { useRouter } from 'expo-router';
import { Alert, Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { AppButton } from '../../../components/AppButton';
import { Card } from '../../../components/Card';
import { ScreenShell } from '../../../components/ScreenShell';
import { SectionTitle } from '../../../components/SectionTitle';
import { boardTypeLabels } from '../../../constants/photoScore';
import { colors } from '../../../constants/theme';
import { useAppState } from '../../../contexts/AppStateContext';
import type { BoardReferenceImage } from '../../../types';

export default function PhotoScoreReferenceScreen() {
  const router = useRouter();
  const { boardReferenceImages, deleteBoardReferenceImage } = useAppState();

  const confirmDelete = (referenceImage: BoardReferenceImage) => {
    Alert.alert('基準画像を削除しますか？', '写真スコア記録や練習記録は削除されません。', [
      { text: 'キャンセル', style: 'cancel' },
      {
        text: '削除',
        style: 'destructive',
        onPress: () => void deleteBoardReferenceImage(referenceImage.id),
      },
    ]);
  };

  return (
    <ScreenShell>
      <SectionTitle
        title="基準ボード画像"
        subtitle="空のボード写真を登録しておくと、現在の写真とのズレを確認しながら候補を探せます。"
      />

      <Card muted>
        <Text style={styles.cardTitle}>基準画像の使い方</Text>
        <Text style={styles.bodyText}>
          ダーツが刺さっていない状態で、普段と同じ距離・角度から撮影してください。MVPでは画像差分の本格解析は未実装ですが、基準画像との位置ズレを評価し、候補表示の精度改善に使います。
        </Text>
      </Card>

      <AppButton
        label="基準画像を登録"
        onPress={() => router.push('/photo-score/reference/register')}
      />

      {boardReferenceImages.length === 0 ? (
        <Card>
          <Text style={styles.emptyTitle}>基準画像はまだありません</Text>
          <Text style={styles.bodyText}>
            先に空のボード写真を登録しておくと、写真スコア記録で「基準画像と比較して候補を探す」を使えます。
          </Text>
        </Card>
      ) : (
        boardReferenceImages.map((referenceImage) => (
          <Card key={referenceImage.id}>
            <View style={styles.referenceHeader}>
              <View style={styles.referenceText}>
                <Text style={styles.cardTitle}>{boardTypeLabels[referenceImage.boardType]}</Text>
                <Text style={styles.bodyText}>{formatDate(referenceImage.createdAt)}</Text>
                {referenceImage.note ? (
                  <Text style={styles.bodyText}>{referenceImage.note}</Text>
                ) : null}
              </View>
              <Image
                source={{ uri: referenceImage.imageUri }}
                resizeMode="cover"
                style={styles.thumbnail}
              />
            </View>
            <View style={styles.actionRow}>
              <Pressable
                accessibilityRole="button"
                onPress={() => router.push('/photo-score/reference/register')}
                style={styles.textButton}
              >
                <Text style={styles.textButtonLabel}>撮り直す</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                onPress={() => confirmDelete(referenceImage)}
                style={[styles.textButton, styles.dangerButton]}
              >
                <Text style={[styles.textButtonLabel, styles.dangerLabel]}>削除</Text>
              </Pressable>
            </View>
          </Card>
        ))
      )}

      <AppButton label="写真スコア記録へ戻る" onPress={() => router.push('/photo-score')} />
    </ScreenShell>
  );
}

function formatDate(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return '登録日不明';
  }

  return `${date.getFullYear()}/${date.getMonth() + 1}/${date.getDate()} 登録`;
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
  emptyTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '900',
  },
  referenceHeader: {
    flexDirection: 'row',
    gap: 12,
  },
  referenceText: {
    flex: 1,
  },
  thumbnail: {
    width: 84,
    height: 84,
    borderRadius: 8,
    backgroundColor: colors.surfaceMuted,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 14,
  },
  textButton: {
    minHeight: 42,
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  dangerButton: {
    borderColor: colors.danger,
  },
  textButtonLabel: {
    color: colors.primaryDark,
    fontSize: 13,
    fontWeight: '900',
  },
  dangerLabel: {
    color: colors.danger,
  },
});
