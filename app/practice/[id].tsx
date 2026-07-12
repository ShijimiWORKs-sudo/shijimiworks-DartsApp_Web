import { useLocalSearchParams, useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AppButton } from '../../components/AppButton';
import { Card } from '../../components/Card';
import { ScreenShell } from '../../components/ScreenShell';
import { SectionTitle } from '../../components/SectionTitle';
import { conditionLabels, gameLabels, machineLabels } from '../../constants/labels';
import { getKnowledgeArticlesByPracticeMenuId } from '../../constants/knowledgeBase';
import { levelLabels } from '../../constants/levels';
import { getPracticeMenuById } from '../../constants/practiceMenus';
import { colors } from '../../constants/theme';
import { useAppState } from '../../contexts/AppStateContext';
import type { PracticeRecord } from '../../types';

export default function PracticeMenuDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { getRecordsByPracticeMenuId, isFavoritePracticeMenu, toggleFavoritePracticeMenu } =
    useAppState();
  const menu = id ? getPracticeMenuById(id) : null;
  const menuRecords = menu ? getRecordsByPracticeMenuId(menu.id) : [];
  const latestRecord = menuRecords[0] ?? null;
  const relatedArticles = menu ? getKnowledgeArticlesByPracticeMenuId(menu.id) : [];

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
      <SectionTitle
        title={menu.title}
        subtitle={`${levelLabels[menu.level]} / 難易度 ${menu.difficulty}`}
      />
      <AppButton
        label={isFavoritePracticeMenu(menu.id) ? '★ 登録済み' : '☆ お気に入り'}
        onPress={() => void toggleFavoritePracticeMenu(menu.id)}
        variant="secondary"
      />

      <Card muted>
        <DetailText
          label="対応機種"
          value={menu.machineTypes.map((machine) => machineLabels[machine]).join(' / ')}
        />
        <DetailText
          label="対象ゲーム"
          value={menu.gameTypes.map((game) => gameLabels[game]).join(' / ')}
        />
        <DetailText label="目安時間" value={`${menu.durationMinutes}分`} />
        <DetailText label="対象の悩み" value={menu.targetProblems.join(' / ')} />
      </Card>

      <Card>
        <Text style={styles.cardTitle}>目的</Text>
        <Text style={styles.bodyText}>{menu.purpose}</Text>
      </Card>

      <DetailList title="手順" items={menu.steps} />
      <DetailList title="記録する項目" items={menu.recordItems} />
      <DetailList title="評価ポイント" items={menu.evaluationPoints} />

      <Card muted>
        <Text style={styles.cardTitle}>改善アドバイス</Text>
        <Text style={styles.bodyText}>{menu.adviceText}</Text>
      </Card>

      <Card>
        <Text style={styles.cardTitle}>タグ</Text>
        <View style={styles.tags}>
          {menu.tags.map((tag) => (
            <Text key={tag} style={styles.tag}>
              {tag}
            </Text>
          ))}
        </View>
      </Card>

      {relatedArticles.length ? (
        <>
          <SectionTitle title="関連資料" />
          {relatedArticles.map((article) => (
            <Pressable
              key={article.id}
              accessibilityRole="button"
              onPress={() => router.push(`/library/${article.id}`)}
              style={({ pressed }) => [styles.articleCard, pressed && styles.pressed]}
            >
              <Text style={styles.cardTitle}>{article.title}</Text>
              <Text style={styles.bodyText}>{article.summary}</Text>
            </Pressable>
          ))}
        </>
      ) : null}

      <Card muted>
        <Text style={styles.cardTitle}>この練習の記録履歴</Text>
        <View style={styles.historyStats}>
          <HistoryStat label="記録回数" value={`${menuRecords.length}回`} />
          <HistoryStat
            label="直近実施日"
            value={latestRecord ? formatShortDate(latestRecord.date) : '-'}
          />
          <HistoryStat
            label="平均スコア"
            value={
              menuRecords.length
                ? String(Math.round(average(menuRecords.map((record) => record.score))))
                : '-'
            }
          />
          <HistoryStat
            label="平均ブル数"
            value={
              menuRecords.length
                ? String(Math.round(average(menuRecords.map((record) => record.bullCount))))
                : '-'
            }
          />
        </View>
        {menuRecords.length === 0 ? (
          <Text style={styles.bodyText}>この練習の記録はまだありません。</Text>
        ) : (
          <View style={styles.recordList}>
            {menuRecords.slice(0, 3).map((record) => (
              <PracticeRecordMiniCard
                key={record.id}
                record={record}
                onPress={() => router.push(`/records/${record.id}`)}
              />
            ))}
          </View>
        )}
      </Card>

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
        label="このメニューの記録をすべて見る"
        onPress={() => router.push(`/practice/${menu.id}/records`)}
        variant="secondary"
      />
      <AppButton
        label="今日の練習へ戻る"
        onPress={() => router.push('/practice')}
        variant="secondary"
      />
    </ScreenShell>
  );
}

type HistoryStatProps = {
  label: string;
  value: string;
};

function HistoryStat({ label, value }: HistoryStatProps) {
  return (
    <View style={styles.historyStat}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.historyValue}>{value}</Text>
    </View>
  );
}

type PracticeRecordMiniCardProps = {
  record: PracticeRecord;
  onPress: () => void;
};

function PracticeRecordMiniCard({ record, onPress }: PracticeRecordMiniCardProps) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.recordMiniCard, pressed && styles.pressed]}
    >
      <Text style={styles.recordMiniTitle}>{formatShortDate(record.date)}</Text>
      <Text style={styles.bodyText}>
        スコア {record.score} / Bull {record.bullCount} / {conditionLabels[record.condition]}
      </Text>
    </Pressable>
  );
}

type DetailTextProps = {
  label: string;
  value: string;
};

function DetailText({ label, value }: DetailTextProps) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  );
}

type DetailListProps = {
  title: string;
  items: string[];
};

function DetailList({ title, items }: DetailListProps) {
  return (
    <Card>
      <Text style={styles.cardTitle}>{title}</Text>
      <View style={styles.list}>
        {items.map((item, index) => (
          <Text key={item} style={styles.bodyText}>
            {index + 1}. {item}
          </Text>
        ))}
      </View>
    </Card>
  );
}

function average(values: number[]) {
  if (values.length === 0) {
    return 0;
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function formatShortDate(date: string) {
  return new Intl.DateTimeFormat('ja-JP', {
    month: 'numeric',
    day: 'numeric',
  }).format(new Date(date));
}

const styles = StyleSheet.create({
  detailRow: {
    gap: 4,
    marginBottom: 12,
  },
  detailLabel: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '900',
  },
  detailValue: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 21,
  },
  cardTitle: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '900',
  },
  bodyText: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 22,
  },
  list: {
    gap: 8,
    marginTop: 10,
  },
  historyStats: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 14,
    marginBottom: 12,
  },
  historyStat: {
    width: '47%',
    padding: 12,
    borderRadius: 8,
    backgroundColor: colors.surface,
  },
  historyValue: {
    marginTop: 4,
    color: colors.text,
    fontSize: 18,
    fontWeight: '900',
  },
  recordList: {
    gap: 8,
  },
  recordMiniCard: {
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  articleCard: {
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  recordMiniTitle: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '900',
  },
  pressed: {
    opacity: 0.72,
  },
  tags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
  },
  tag: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    overflow: 'hidden',
    color: colors.primaryDark,
    fontSize: 12,
    fontWeight: '800',
    backgroundColor: colors.primarySoft,
  },
});
