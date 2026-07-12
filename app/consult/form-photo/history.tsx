import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AppButton } from '../../../components/AppButton';
import { Card } from '../../../components/Card';
import { ScreenShell } from '../../../components/ScreenShell';
import { SectionTitle } from '../../../components/SectionTitle';
import { formAdviceCategoryLabels } from '../../../constants/formPhoto';
import { colors } from '../../../constants/theme';
import { useAppState } from '../../../contexts/AppStateContext';
import type { FormPhotoAdviceResult } from '../../../types';

export default function FormPhotoAdviceHistoryScreen() {
  const router = useRouter();
  const { formPhotoAdviceResults } = useAppState();

  return (
    <ScreenShell>
      <SectionTitle
        title="フォーム写真相談履歴"
        subtitle="保存したフォーム写真相談を新しい順に表示します。"
      />
      <AppButton label="新しく相談する" onPress={() => router.push('/consult/form-photo')} />

      {formPhotoAdviceResults.length === 0 ? (
        <Card muted>
          <Text style={styles.emptyTitle}>フォーム写真相談履歴はまだありません</Text>
          <Text style={styles.bodyText}>
            フォーム写真3枚相談でアドバイスを生成すると、ここに保存されます。
          </Text>
          <View style={styles.actionStack}>
            <AppButton
              label="フォーム写真相談を始める"
              onPress={() => router.push('/consult/form-photo')}
            />
          </View>
        </Card>
      ) : (
        <View style={styles.list}>
          {formPhotoAdviceResults.map((history) => (
            <FormPhotoAdviceHistoryCard
              key={history.id}
              history={history}
              onPress={() => router.push(`/consult/form-photo/history/${history.id}`)}
            />
          ))}
        </View>
      )}
    </ScreenShell>
  );
}

function FormPhotoAdviceHistoryCard({
  history,
  onPress,
}: {
  history: FormPhotoAdviceResult;
  onPress: () => void;
}) {
  const hasPhoto = history.photos.some((photo) => Boolean(photo.imageUri));

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.historyCard, pressed && styles.pressed]}
    >
      <View style={styles.cardHeader}>
        <Text style={styles.dateText}>{formatDate(history.date)}</Text>
        <Text style={[styles.photoBadge, hasPhoto ? styles.photoBadgeOn : styles.photoBadgeOff]}>
          {hasPhoto ? '写真あり' : '写真なし'}
        </Text>
      </View>
      <Text numberOfLines={2} style={styles.summaryText}>
        {history.summaryText}
      </Text>
      <View style={styles.categoryRow}>
        {history.adviceCategories.slice(0, 4).map((category) => (
          <Text key={category} style={styles.categoryPill}>
            {formAdviceCategoryLabels[category]}
          </Text>
        ))}
      </View>
      {history.linkedPhotoScoreSummary ? (
        <Text numberOfLines={2} style={styles.linkedText}>
          {history.linkedPhotoScoreSummary}
        </Text>
      ) : null}
    </Pressable>
  );
}

function formatDate(date: string) {
  return new Intl.DateTimeFormat('ja-JP', {
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(date));
}

const styles = StyleSheet.create({
  list: {
    gap: 10,
  },
  historyCard: {
    minHeight: 148,
    justifyContent: 'center',
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  dateText: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '800',
  },
  photoBadge: {
    overflow: 'hidden',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    fontSize: 12,
    fontWeight: '900',
  },
  photoBadgeOn: {
    color: colors.primaryDark,
    backgroundColor: colors.primarySoft,
  },
  photoBadgeOff: {
    color: colors.textMuted,
    backgroundColor: colors.surfaceMuted,
  },
  summaryText: {
    marginTop: 10,
    color: colors.text,
    fontSize: 15,
    fontWeight: '800',
    lineHeight: 22,
  },
  linkedText: {
    marginTop: 8,
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 18,
  },
  categoryRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 10,
  },
  categoryPill: {
    overflow: 'hidden',
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 999,
    color: colors.primaryDark,
    backgroundColor: colors.primarySoft,
    fontSize: 11,
    fontWeight: '900',
  },
  emptyTitle: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '900',
  },
  bodyText: {
    marginTop: 10,
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 22,
  },
  actionStack: {
    gap: 10,
    marginTop: 14,
  },
  pressed: {
    opacity: 0.72,
  },
});
