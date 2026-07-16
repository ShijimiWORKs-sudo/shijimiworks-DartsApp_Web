import { useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';

import { AppButton } from '../../../components/AppButton';
import { Card } from '../../../components/Card';
import { ScreenShell } from '../../../components/ScreenShell';
import { SectionTitle } from '../../../components/SectionTitle';
import { colors } from '../../../constants/theme';
import { useGameDatabase } from '../../../contexts/GameDatabaseContext';
import type {
  MatchDiagnosticReport,
  MatchDiagnosticSummary,
  MatchRepairResult,
} from '../../../features/game/application/services';

type ClipboardNavigator = {
  clipboard?: {
    writeText(text: string): Promise<void>;
  };
};

export default function MatchDiagnosticsScreen() {
  const params = useLocalSearchParams<{ matchId: string }>();
  const matchId = Array.isArray(params.matchId) ? params.matchId[0] : params.matchId;
  const { isAvailable, services } = useGameDatabase();
  const [report, setReport] = useState<MatchDiagnosticReport | null>(null);
  const [repairResult, setRepairResult] = useState<MatchRepairResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isRepairing, setIsRepairing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const isAllowed = __DEV__;

  const diagnosticJson = useMemo(
    () =>
      JSON.stringify(
        {
          report,
          repairResult,
          error: message,
        },
        null,
        2,
      ),
    [message, repairResult, report],
  );

  const loadDiagnostics = useCallback(async () => {
    if (!services || !matchId || !isAvailable) return null;
    setIsLoading(true);
    setMessage(null);
    try {
      const nextReport = await services.match.getMatchDiagnostics(matchId);
      setReport(nextReport);
      return nextReport;
    } catch (error) {
      console.warn('Failed to load MATCH diagnostics.', error);
      setMessage('診断データを読み込めませんでした。Consoleの詳細を確認してください。');
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [isAvailable, matchId, services]);

  useEffect(() => {
    void loadDiagnostics();
  }, [loadDiagnostics]);

  const handleCopyJson = useCallback(async () => {
    try {
      const clipboard = (globalThis.navigator as ClipboardNavigator | undefined)?.clipboard;
      if (!clipboard) {
        setMessage(
          'この環境ではクリップボードコピーを利用できません。画面下部のJSONを確認してください。',
        );
        return;
      }
      await clipboard.writeText(diagnosticJson);
      setMessage('診断JSONをコピーしました。');
    } catch (error) {
      console.warn('Failed to copy MATCH diagnostic JSON.', error);
      setMessage('診断JSONをコピーできませんでした。画面下部のJSONを確認してください。');
    }
  }, [diagnosticJson]);

  const handleRepair = useCallback(async () => {
    if (!services || !matchId) return;
    setIsRepairing(true);
    setMessage(null);
    try {
      const repair = await services.match.ensureRatingEvaluationCurrent(matchId);
      if (repair.recalculationRequired && repair.evaluationId) {
        await services.rating.recalculateFromEvaluation(repair.evaluationId);
      } else {
        await services.rating.processPending();
      }
      const afterReport = await services.match.getMatchDiagnostics(matchId);
      const finalMismatches = [
        ...afterReport.summary.mismatches,
        ...afterReport.summary.expectedMismatches,
      ];
      const nextRepair = {
        ...repair,
        after: afterReport.summary,
        mismatchesAfter: finalMismatches,
      };
      setRepairResult(nextRepair);
      setReport(afterReport);
      if (finalMismatches.length > 0) {
        setMessage(`修復に失敗しました。\n不一致箇所: ${finalMismatches.join(', ')}`);
        return;
      }
      setMessage('MATCH診断修復が完了しました。');
    } catch (error) {
      console.warn('Failed to repair MATCH diagnostics.', error);
      setMessage('修復を完了できませんでした。Consoleの詳細を確認してください。');
    } finally {
      setIsRepairing(false);
    }
  }, [matchId, services]);

  if (!isAllowed) {
    return (
      <ScreenShell>
        <SectionTitle title="MATCH診断" subtitle="この診断画面は開発環境専用です。" />
      </ScreenShell>
    );
  }

  return (
    <ScreenShell>
      <SectionTitle
        title="MATCH Rating診断"
        subtitle="/dev/match-diagnostics/[matchId] は実ブラウザのWeb SQLiteを確認する開発用画面です。"
      />

      <Card>
        <Text style={styles.matchId}>MATCH ID: {matchId ?? '-'}</Text>
        <Text style={styles.meta}>
          {Platform.OS === 'web'
            ? 'Web SQLite接続から直接読み込んでいます。'
            : 'Expo GoのSQLite接続から直接読み込んでいます。'}
        </Text>
        <View style={styles.actions}>
          <AppButton
            label={isLoading ? '再読込中...' : '診断を再読込'}
            onPress={() => void loadDiagnostics()}
            disabled={isLoading || isRepairing}
            variant="secondary"
          />
          <AppButton
            label="診断JSONをコピー"
            onPress={() => void handleCopyJson()}
            disabled={!report || isRepairing}
            variant="secondary"
          />
          <AppButton
            label={isRepairing ? '修復中...' : 'このMATCHを修復する'}
            onPress={() => void handleRepair()}
            disabled={!report || isRepairing}
            variant="danger"
          />
        </View>
        {message ? <Text style={styles.message}>{message}</Text> : null}
      </Card>

      {report ? (
        <>
          <SummaryCard summary={report.summary} />
          {repairResult ? <RepairCard result={repairResult} /> : null}
          <RowsCard title="MATCH基本情報" rows={report.match ? [report.match] : []} />
          <RowsCard title="全GAME" rows={report.games} />
          <RowsCard title="OWNERの全TURN" rows={report.ownerTurns} />
          <RowsCard title="全DART行" rows={report.darts} />
          <RowsCard title="game_player_results" rows={report.saved.gamePlayerResults} />
          <RowsCard title="match_player_results" rows={report.saved.matchPlayerResults} />
          <RowsCard title="rating_evaluations全revision" rows={report.saved.ratingEvaluations} />
          <RowsCard title="rating_evaluation_games" rows={report.saved.ratingEvaluationGames} />
          <RowsCard title="rating_snapshots" rows={report.saved.ratingSnapshots} />
          <RowsCard title="rating_profiles" rows={report.saved.ratingProfiles} />
          <RowsCard
            title="診断JSON"
            rows={[JSON.parse(diagnosticJson) as Record<string, unknown>]}
          />
        </>
      ) : (
        <Card>
          <Text style={styles.meta}>
            {isLoading ? 'MATCH診断を読み込んでいます。' : '診断データはまだありません。'}
          </Text>
        </Card>
      )}
    </ScreenShell>
  );
}

function SummaryCard({ summary }: { summary: MatchDiagnosticSummary }) {
  return (
    <Card>
      <SectionTitle title="診断サマリー" tone="card" />
      <View style={styles.summaryGrid}>
        <SummaryItem label="01 raw effective score" value={summary.zeroOneRawEffectiveScore} />
        <SummaryItem
          label="01 canonical Rating darts"
          value={summary.zeroOneCanonicalRatingDarts}
        />
        <SummaryItem label="01 calculated PPD" value={formatNumber(summary.zeroOneCalculatedPpd)} />
        <SummaryItem
          label="01 calculated 3DA"
          value={formatNumber(summary.zeroOneCalculatedThreeDartAverage)}
        />
        <SummaryItem label="CRICKET marks" value={summary.cricketMarks} />
        <SummaryItem label="CRICKET turns" value={summary.cricketTurns} />
        <SummaryItem label="CRICKET MPR" value={formatNumber(summary.cricketMpr)} />
        <SummaryItem label="OWNER canonical total darts" value={summary.ownerCanonicalTotalDarts} />
        <SummaryItem label="保存済みPPD" value={summary.savedPpdMilli ?? '-'} />
        <SummaryItem label="保存済み3DA" value={summary.savedThreeDartAverageMilli ?? '-'} />
        <SummaryItem label="保存済みtotalDarts" value={summary.savedTotalDarts ?? '-'} />
        <SummaryItem label="source revision" value={summary.latestSourceRevision ?? '-'} />
      </View>
      <Text style={styles.listTitle}>不一致箇所</Text>
      <Text style={styles.mono}>
        {[...summary.mismatches, ...summary.expectedMismatches].join('\n') || 'なし'}
      </Text>
      <Text style={styles.listTitle}>原因判定</Text>
      <Text style={styles.mono}>{summary.causeFindings.join('\n') || '-'}</Text>
    </Card>
  );
}

function RepairCard({ result }: { result: MatchRepairResult }) {
  return (
    <Card>
      <SectionTitle title="修復結果" tone="card" />
      <Text style={styles.meta}>repaired: {String(result.repaired)}</Text>
      <Text style={styles.meta}>recalculationRequired: {String(result.recalculationRequired)}</Text>
      <Text style={styles.meta}>evaluationId: {result.evaluationId ?? '-'}</Text>
      <Text style={styles.listTitle}>before</Text>
      <Text style={styles.mono}>{JSON.stringify(result.before, null, 2)}</Text>
      <Text style={styles.listTitle}>after</Text>
      <Text style={styles.mono}>{JSON.stringify(result.after, null, 2)}</Text>
    </Card>
  );
}

function RowsCard({ title, rows }: { title: string; rows: unknown[] }) {
  return (
    <Card>
      <SectionTitle title={title} tone="card" />
      <Text selectable style={styles.mono}>
        {JSON.stringify(rows, null, 2)}
      </Text>
    </Card>
  );
}

function SummaryItem({ label, value }: { label: string; value: string | number }) {
  return (
    <View style={styles.summaryItem}>
      <Text style={styles.summaryValue}>{value}</Text>
      <Text style={styles.summaryLabel}>{label}</Text>
    </View>
  );
}

function formatNumber(value: number | null) {
  return value === null ? '-' : value.toFixed(3);
}

const styles = StyleSheet.create({
  matchId: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '900',
  },
  meta: {
    marginTop: 8,
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '700',
  },
  actions: {
    marginTop: 14,
    gap: 10,
  },
  message: {
    marginTop: 12,
    color: colors.primaryDark,
    fontSize: 14,
    fontWeight: '800',
    lineHeight: 20,
  },
  summaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  summaryItem: {
    minWidth: 180,
    flexGrow: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: 10,
  },
  summaryValue: {
    color: colors.primaryDark,
    fontSize: 18,
    fontWeight: '900',
  },
  summaryLabel: {
    marginTop: 4,
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '800',
  },
  listTitle: {
    marginTop: 14,
    color: colors.text,
    fontSize: 14,
    fontWeight: '900',
  },
  mono: {
    marginTop: 8,
    color: colors.text,
    fontFamily: Platform.select({ web: 'monospace', default: undefined }),
    fontSize: 12,
    lineHeight: 18,
  },
});
