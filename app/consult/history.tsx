import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AppButton } from '../../components/AppButton';
import { Card } from '../../components/Card';
import { ScreenShell } from '../../components/ScreenShell';
import { SectionTitle } from '../../components/SectionTitle';
import { consultCategoryLabels } from '../../constants/consultAdvice';
import { colors } from '../../constants/theme';
import { useAppState } from '../../contexts/AppStateContext';
import type { ConsultHistory } from '../../types';

export default function ConsultHistoryScreen() {
  const router = useRouter();
  const { consultHistories } = useAppState();

  return (
    <ScreenShell>
      <SectionTitle title="相談履歴" subtitle="過去の相談内容と回答を新しい順に表示します。" />
      <AppButton label="フォーム相談へ戻る" onPress={() => router.push('/consult')} />

      {consultHistories.length === 0 ? (
        <Card muted>
          <Text style={styles.emptyTitle}>相談履歴はまだありません</Text>
          <Text style={styles.bodyText}>フォーム相談で回答を生成すると、ここに保存されます。</Text>
        </Card>
      ) : (
        <View style={styles.list}>
          {consultHistories.map((history) => (
            <ConsultHistoryCard
              key={history.id}
              history={history}
              onPress={() => router.push(`/consult/history/${history.id}`)}
            />
          ))}
        </View>
      )}
    </ScreenShell>
  );
}

type ConsultHistoryCardProps = {
  history: ConsultHistory;
  onPress: () => void;
};

function ConsultHistoryCard({ history, onPress }: ConsultHistoryCardProps) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.historyCard, pressed && styles.pressed]}
    >
      <View style={styles.cardHeader}>
        <Text style={styles.categoryText}>{consultCategoryLabels[history.category]}</Text>
        <Text style={styles.dateText}>{formatDate(history.date)}</Text>
      </View>
      <Text numberOfLines={2} style={styles.userText}>
        {history.userText}
      </Text>
      <Text numberOfLines={1} style={styles.adviceText}>
        {history.mainAdvice}
      </Text>
      {history.cautionText ? <Text style={styles.cautionText}>注意文あり</Text> : null}
    </Pressable>
  );
}

function formatDate(date: string) {
  return new Intl.DateTimeFormat('ja-JP', {
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
    minHeight: 132,
    justifyContent: 'center',
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  categoryText: {
    color: colors.primaryDark,
    fontSize: 13,
    fontWeight: '900',
  },
  dateText: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '800',
  },
  userText: {
    marginTop: 10,
    color: colors.text,
    fontSize: 15,
    fontWeight: '800',
    lineHeight: 22,
  },
  adviceText: {
    marginTop: 8,
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '700',
  },
  cautionText: {
    marginTop: 8,
    color: colors.danger,
    fontSize: 12,
    fontWeight: '800',
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
  pressed: {
    opacity: 0.72,
  },
});
