import { useLocalSearchParams, useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AppButton } from '../../../components/AppButton';
import { Card } from '../../../components/Card';
import { ScreenShell } from '../../../components/ScreenShell';
import { SectionTitle } from '../../../components/SectionTitle';
import { conditionLabels } from '../../../constants/labels';
import { getPracticeMenuById } from '../../../constants/practiceMenus';
import { colors } from '../../../constants/theme';
import { useAppState } from '../../../contexts/AppStateContext';
import type { PracticeRecord } from '../../../types';

export default function PracticeMenuRecordsScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { getRecordsByPracticeMenuId } = useAppState();
  const menu = id ? getPracticeMenuById(id) : null;
  const records = menu ? getRecordsByPracticeMenuId(menu.id) : [];

  if (!menu) {
    return (
      <ScreenShell>
        <SectionTitle
          title="練習メニューが見つかりません"
          subtitle="今日の練習からもう一度選択してください。"
        />
        <AppButton label="今日の練習へ戻る" onPress={() => router.replace('/practice')} />
      </ScreenShell>
    );
  }

  return (
    <ScreenShell>
      <SectionTitle title={`${menu.title} の記録`} subtitle={`${records.length}件の保存済み記録`} />

      {records.length === 0 ? (
        <Card muted>
          <Text style={styles.emptyTitle}>このメニューの記録はまだありません</Text>
          <Text style={styles.bodyText}>
            練習詳細から「この練習を記録する」を押して保存できます。
          </Text>
        </Card>
      ) : (
        <View style={styles.list}>
          {records.map((record) => (
            <MenuRecordCard
              key={record.id}
              record={record}
              onPress={() => router.push(`/records/${record.id}`)}
            />
          ))}
        </View>
      )}

      <AppButton
        label="この練習を記録する"
        onPress={() =>
          router.push({
            pathname: '/record',
            params: { practiceMenuId: menu.id },
          })
        }
      />
      <AppButton
        label="練習詳細へ戻る"
        onPress={() => router.push(`/practice/${menu.id}`)}
        variant="secondary"
      />
    </ScreenShell>
  );
}

type MenuRecordCardProps = {
  record: PracticeRecord;
  onPress: () => void;
};

function MenuRecordCard({ record, onPress }: MenuRecordCardProps) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.recordCard, pressed && styles.pressed]}
    >
      <Text style={styles.recordTitle}>{formatDate(record.date)}</Text>
      <View style={styles.statRow}>
        <Text style={styles.statText}>スコア {record.score}</Text>
        <Text style={styles.statText}>Bull {record.bullCount}</Text>
        <Text style={styles.statText}>Cricket {record.cricketMarks}</Text>
        <Text style={styles.statText}>{conditionLabels[record.condition]}</Text>
      </View>
      <Text style={styles.memoText}>{record.memo || 'メモはありません。'}</Text>
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
  recordCard: {
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  recordTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '900',
  },
  statRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
  },
  statText: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    overflow: 'hidden',
    color: colors.primaryDark,
    fontSize: 12,
    fontWeight: '800',
    backgroundColor: colors.primarySoft,
  },
  memoText: {
    marginTop: 10,
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 20,
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
