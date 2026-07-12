import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AppButton } from '../components/AppButton';
import { Card } from '../components/Card';
import { ScreenShell } from '../components/ScreenShell';
import { SectionTitle } from '../components/SectionTitle';
import { conditionLabels, gameLabels, machineLabels } from '../constants/labels';
import { colors } from '../constants/theme';
import { useAppState } from '../contexts/AppStateContext';
import type { PracticeRecord } from '../types';
import { filterRecordsByPeriod } from '../utils/analyzePracticeRecords';

export default function RecordsScreen() {
  const router = useRouter();
  const { records } = useAppState();
  const last30DaysRecords = filterRecordsByPeriod(records, 'last30Days');
  const countUpRecords = records.filter((record) => record.gameType === 'COUNT-UP');
  const cricketRecords = records.filter((record) => record.gameType === 'CRICKET');

  return (
    <ScreenShell>
      <SectionTitle title="練習記録一覧" subtitle="保存済み記録を新しい順に表示します。" />
      <AppButton label="今日の練習を記録する" onPress={() => router.push('/record')} />

      <Card muted>
        <Text style={styles.photoTitle}>写真からスコア記録</Text>
        <Text style={styles.bodyText}>
          ボード写真を使って、刺さった位置をタップして記録します。
        </Text>
        <View style={styles.photoAction}>
          <AppButton label="写真からスコア記録" onPress={() => router.push('/photo-score')} />
        </View>
      </Card>

      <Card muted>
        <Text style={styles.summaryTitle}>記録サマリー</Text>
        <View style={styles.summaryGrid}>
          <SummaryItem label="全記録" value={`${records.length}件`} />
          <SummaryItem label="直近30日" value={`${last30DaysRecords.length}件`} />
          <SummaryItem label="COUNT-UP" value={`${countUpRecords.length}件`} />
          <SummaryItem label="CRICKET" value={`${cricketRecords.length}件`} />
        </View>
      </Card>

      {records.length === 0 ? (
        <Card muted>
          <Text style={styles.emptyTitle}>まだ練習記録がありません</Text>
          <Text style={styles.bodyText}>1件保存すると、ここから詳細・編集・削除ができます。</Text>
        </Card>
      ) : (
        <View style={styles.list}>
          {records.map((record) => (
            <RecordListCard
              key={record.id}
              record={record}
              onPress={() => router.push(`/records/${record.id}`)}
            />
          ))}
        </View>
      )}
    </ScreenShell>
  );
}

type SummaryItemProps = {
  label: string;
  value: string;
};

function SummaryItem({ label, value }: SummaryItemProps) {
  return (
    <View style={styles.summaryItem}>
      <Text style={styles.summaryValue}>{value}</Text>
      <Text style={styles.summaryLabel}>{label}</Text>
    </View>
  );
}

type RecordListCardProps = {
  record: PracticeRecord;
  onPress: () => void;
};

function RecordListCard({ record, onPress }: RecordListCardProps) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.recordCard, pressed && styles.pressed]}
    >
      <View style={styles.recordHeader}>
        <Text style={styles.recordTitle}>{record.practiceMenuName}</Text>
        <Text style={styles.dateText}>{formatDate(record.date)}</Text>
      </View>
      <Text style={styles.metaText}>
        {machineLabels[record.machineType]} / {gameLabels[record.gameType]}
      </Text>
      <View style={styles.statRow}>
        <Text style={styles.statText}>スコア {record.score}</Text>
        <Text style={styles.statText}>Bull {record.bullCount}</Text>
        <Text style={styles.statText}>{conditionLabels[record.condition]}</Text>
      </View>
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
  summaryTitle: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '900',
  },
  summaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 12,
  },
  summaryItem: {
    width: '47%',
    minHeight: 70,
    justifyContent: 'center',
    padding: 12,
    borderRadius: 8,
    backgroundColor: colors.surface,
  },
  summaryValue: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '900',
  },
  summaryLabel: {
    marginTop: 4,
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '800',
  },
  recordCard: {
    minHeight: 118,
    justifyContent: 'center',
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  recordHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  recordTitle: {
    flex: 1,
    color: colors.text,
    fontSize: 17,
    fontWeight: '900',
  },
  dateText: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '800',
  },
  metaText: {
    marginTop: 8,
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '700',
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
  photoTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '900',
  },
  photoAction: {
    marginTop: 14,
  },
  pressed: {
    opacity: 0.72,
  },
});
