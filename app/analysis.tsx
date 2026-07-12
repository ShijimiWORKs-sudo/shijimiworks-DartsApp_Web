import { useMemo, useState } from 'react';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AppButton } from '../components/AppButton';
import { Card } from '../components/Card';
import { RoundIconButton } from '../components/RoundIconButton';
import { ScreenShell } from '../components/ScreenShell';
import { SectionTitle } from '../components/SectionTitle';
import { SimpleBarChart, type SimpleBarChartItem } from '../components/SimpleBarChart';
import { StatCard } from '../components/StatCard';
import { conditionLabels, gameLabels, machineLabels } from '../constants/labels';
import { getPracticeMenuById } from '../constants/practiceMenus';
import { colors } from '../constants/theme';
import { useAppState } from '../contexts/AppStateContext';
import type { AnalysisPeriod, AnalysisSummary, PracticeMenu, PracticeRecord } from '../types';
import {
  calculateAnalysisSummary,
  calculateGameTypeSummary,
  filterRecordsByPeriod,
} from '../utils/analyzePracticeRecords';

const periodOptions: { label: string; value: AnalysisPeriod }[] = [
  { label: '7日', value: 'last7Days' },
  { label: '30日', value: 'last30Days' },
  { label: '90日', value: 'last90Days' },
  { label: '全期間', value: 'all' },
];

const trendLabels: Record<AnalysisSummary['trendDirection'], string> = {
  up: '上向き',
  down: '下向き',
  flat: '横ばい',
  unknown: '判定前',
};

export default function AnalysisScreen() {
  const router = useRouter();
  const { profile, records } = useAppState();
  const [period, setPeriod] = useState<AnalysisPeriod>('last30Days');
  const filteredRecords = useMemo(() => filterRecordsByPeriod(records, period), [period, records]);
  const summary = useMemo(
    () => calculateAnalysisSummary(records, period, profile),
    [period, profile, records],
  );
  const gameSummaries = useMemo(() => calculateGameTypeSummary(filteredRecords), [filteredRecords]);
  const scoreChartData = useMemo(() => buildChartData(filteredRecords, 'score'), [filteredRecords]);
  const bullChartData = useMemo(
    () => buildChartData(filteredRecords, 'bullCount'),
    [filteredRecords],
  );
  const recommendedMenus = summary.recommendedPracticeMenuIds
    .map((id) => getPracticeMenuById(id))
    .filter((menu): menu is PracticeMenu => menu !== null);

  return (
    <ScreenShell>
      <SectionTitle title="分析" subtitle="保存済み練習記録から傾向と次の練習を確認します。" />

      <View style={styles.chipGrid}>
        {periodOptions.map((option) => (
          <Pressable
            key={option.value}
            accessibilityRole="button"
            onPress={() => setPeriod(option.value)}
            style={[styles.chip, period === option.value && styles.chipSelected]}
          >
            <Text style={[styles.chipText, period === option.value && styles.chipTextSelected]}>
              {option.label}
            </Text>
          </Pressable>
        ))}
      </View>

      {summary.totalPracticeCount === 0 ? (
        <Card muted>
          <Text style={styles.emptyTitle}>まだ記録がありません</Text>
          <Text style={styles.bodyText}>
            練習記録を1件保存すると、期間別の平均、グラフ、改善コメントが表示されます。
          </Text>
          <View style={styles.cardAction}>
            <AppButton label="練習記録を入力する" onPress={() => router.push('/record')} />
          </View>
        </Card>
      ) : null}

      <View style={styles.statsRow}>
        <StatCard
          label="練習回数"
          value={`${summary.totalPracticeCount}回`}
          helper={
            summary.latestPracticeDate ? `直近 ${formatShortDate(summary.latestPracticeDate)}` : '-'
          }
        />
        <StatCard
          label="COUNT-UP平均"
          value={summary.countUpAverage === null ? 'なし' : String(summary.countUpAverage)}
          helper={summary.countUpAverage === null ? 'COUNT-UP記録なし' : 'COUNT-UPのみ'}
        />
      </View>
      <View style={styles.statsRow}>
        <StatCard
          label="平均ブル数"
          value={formatNullable(summary.bullAverage)}
          helper="全記録平均"
        />
        <StatCard
          label="平均Cricket"
          value={formatNullable(summary.cricketMarksAverage)}
          helper="マーク数平均"
        />
      </View>
      <View style={styles.statsRow}>
        <StatCard
          label="ベストスコア"
          value={formatNullable(summary.bestScore)}
          helper="期間内最高"
        />
        <StatCard
          label="最近の傾向"
          value={trendLabels[summary.trendDirection]}
          helper="スコア推移"
        />
      </View>

      <Card>
        <SectionTitle
          title="スコア推移"
          subtitle="期間内の直近8件を古い順に表示します。"
          tone="card"
        />
        <SimpleBarChart data={scoreChartData} />
      </Card>

      <Card>
        <SectionTitle
          title="ブル数推移"
          subtitle="ブル数の変化を軽量なバー表示で確認します。"
          tone="card"
        />
        <SimpleBarChart data={bullChartData} maxValue={20} />
      </Card>

      <Card>
        <Text style={styles.cardTitle}>ゲーム別記録数</Text>
        <View style={styles.summaryRows}>
          {gameSummaries.map((gameSummary) => (
            <View key={gameSummary.gameType} style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>{gameLabels[gameSummary.gameType]}</Text>
              <Text style={styles.summaryValue}>
                {gameSummary.count}件 / 平均 {formatNullable(gameSummary.averageScore)}
              </Text>
            </View>
          ))}
        </View>
      </Card>

      <Card>
        <Text style={styles.cardTitle}>調子の割合</Text>
        <View style={styles.conditionGrid}>
          {(['good', 'normal', 'bad'] as const).map((condition) => (
            <View
              key={condition}
              style={[
                styles.conditionItem,
                condition === 'good' && styles.conditionGood,
                condition === 'normal' && styles.conditionNormal,
                condition === 'bad' && styles.conditionBad,
              ]}
            >
              <Text style={styles.conditionValue}>{summary.conditionCounts[condition]}</Text>
              <Text style={styles.conditionLabel}>{conditionLabels[condition]}</Text>
            </View>
          ))}
        </View>
      </Card>

      <Card muted>
        <Text style={styles.cardTitle}>改善コメント</Text>
        <View style={styles.commentList}>
          {summary.improvementComments.map((comment, index) => (
            <Text key={`${comment}-${index}`} style={styles.bodyText}>
              {index + 1}. {comment}
            </Text>
          ))}
        </View>
      </Card>

      <SectionTitle title="次にやるべき練習" />
      {recommendedMenus.map((menu) => (
        <Card key={menu.id}>
          <Text style={styles.recommendTitle}>{menu.title}</Text>
          <Text style={styles.bodyText}>{buildRecommendationReason(summary, menu)}</Text>
          <View style={styles.recommendFooter}>
            <Text style={styles.pill}>{menu.durationMinutes}分</Text>
            <Text style={styles.pill}>
              {menu.gameTypes.map((gameType) => gameLabels[gameType]).join(' / ')}
            </Text>
          </View>
          <View style={styles.actionStack}>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>詳細</Text>
              <RoundIconButton
                accessibilityLabel={`${menu.title}の詳細を開く`}
                onPress={() => router.push(`/practice/${menu.id}`)}
              />
            </View>
            <AppButton
              label="記録する"
              onPress={() =>
                router.push({
                  pathname: '/record',
                  params: { practiceMenuId: menu.id },
                })
              }
            />
          </View>
        </Card>
      ))}

      <Card>
        <Text style={styles.cardTitle}>機種別記録</Text>
        <Text style={styles.bodyText}>
          {machineLabels.DARTSLIVE}: {summary.machineTypeCounts.DARTSLIVE}件 /{' '}
          {machineLabels.PHOENIX}: {summary.machineTypeCounts.PHOENIX}件
        </Text>
      </Card>

      <AppButton
        label="記録一覧を見る"
        onPress={() => router.push('/records')}
        variant="secondary"
      />
      <AppButton
        label="相談する"
        onPress={() =>
          router.push({
            pathname: '/consult',
            params: { category: getConsultCategoryFromSummary(summary) },
          })
        }
      />
    </ScreenShell>
  );
}

function buildChartData(
  records: PracticeRecord[],
  key: 'score' | 'bullCount',
): SimpleBarChartItem[] {
  return [...records]
    .reverse()
    .slice(-8)
    .map((record) => ({
      label: formatShortDate(record.date),
      value: record[key],
      color: key === 'bullCount' ? colors.info : colors.primary,
    }));
}

function buildRecommendationReason(summary: AnalysisSummary, menu: PracticeMenu) {
  if (summary.bullAverage !== null && summary.bullAverage < 8 && menu.tags.includes('ブル練習')) {
    return '平均ブル数が少なめなので、ブル周辺へ集める練習を優先します。';
  }

  if (summary.gameTypeCounts.CRICKET <= 1 && menu.gameTypes.includes('CRICKET')) {
    return 'CRICKET記録が少ないため、ナンバー別の精度確認を追加します。';
  }

  if (summary.conditionCounts.bad >= 2 && menu.tags.includes('メンタル・ルーティン')) {
    return '調子が悪い記録があるため、投げ込みよりルーティン確認を優先します。';
  }

  if (summary.trendDirection === 'down') {
    return '直近傾向を立て直すため、テーマを絞って再現性を確認します。';
  }

  return '保存データをもとに、次の練習テーマとして相性がよいメニューです。';
}

function getConsultCategoryFromSummary(summary: AnalysisSummary) {
  if (summary.conditionCounts.bad >= 2) {
    return 'mental';
  }

  if (summary.bullAverage !== null && summary.bullAverage < 8) {
    return 'release';
  }

  return 'practicePlan';
}

function formatNullable(value: number | null) {
  return value === null ? '-' : String(value);
}

function formatShortDate(date: string) {
  return new Intl.DateTimeFormat('ja-JP', {
    month: 'numeric',
    day: 'numeric',
  }).format(new Date(date));
}

const styles = StyleSheet.create({
  chipGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  chip: {
    minHeight: 40,
    justifyContent: 'center',
    paddingHorizontal: 14,
    borderRadius: 8,
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
    fontSize: 13,
    fontWeight: '800',
  },
  chipTextSelected: {
    color: colors.primaryDark,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  emptyTitle: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '900',
  },
  cardTitle: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '900',
  },
  bodyText: {
    marginTop: 8,
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 22,
  },
  cardAction: {
    marginTop: 14,
  },
  summaryRows: {
    gap: 10,
    marginTop: 12,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  summaryLabel: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '900',
  },
  summaryValue: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '800',
  },
  conditionGrid: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 12,
  },
  conditionItem: {
    flex: 1,
    minHeight: 76,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    backgroundColor: colors.surface,
  },
  conditionGood: {
    backgroundColor: colors.primarySoft,
  },
  conditionNormal: {
    backgroundColor: '#dbeafe',
  },
  conditionBad: {
    backgroundColor: '#fff3d6',
  },
  conditionValue: {
    color: colors.text,
    fontSize: 24,
    fontWeight: '900',
  },
  conditionLabel: {
    marginTop: 4,
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '800',
  },
  commentList: {
    gap: 4,
  },
  recommendTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '900',
  },
  recommendFooter: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
  },
  pill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    overflow: 'hidden',
    color: colors.primaryDark,
    fontSize: 12,
    fontWeight: '800',
    backgroundColor: colors.primarySoft,
  },
  actionStack: {
    gap: 10,
    marginTop: 14,
  },
  detailRow: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  detailLabel: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '800',
  },
});
