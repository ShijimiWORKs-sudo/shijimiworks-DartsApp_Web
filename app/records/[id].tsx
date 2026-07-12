import { useLocalSearchParams, useRouter } from 'expo-router';
import { Alert, StyleSheet, Text, View } from 'react-native';

import { AppButton } from '../../components/AppButton';
import { Card } from '../../components/Card';
import { ScreenShell } from '../../components/ScreenShell';
import { SectionTitle } from '../../components/SectionTitle';
import { conditionLabels, gameLabels, machineLabels } from '../../constants/labels';
import { boardTypeLabels, dartHitAreaLabels } from '../../constants/photoScore';
import { colors } from '../../constants/theme';
import { useAppState } from '../../contexts/AppStateContext';
import type { DartHitResult } from '../../types';
import { formatPhotoScoreSource } from '../../utils/formatPhotoScoreSource';

export default function RecordDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { deletePracticeRecord, getRecordById } = useAppState();
  const record = id ? getRecordById(id) : null;

  const handleDelete = () => {
    if (!record) {
      return;
    }

    Alert.alert('練習記録を削除しますか？', 'この操作は取り消せません。', [
      { text: 'キャンセル', style: 'cancel' },
      {
        text: '削除',
        style: 'destructive',
        onPress: () => {
          void deletePracticeRecord(record.id).then(() => router.replace('/records'));
        },
      },
    ]);
  };

  if (!record) {
    return (
      <ScreenShell>
        <SectionTitle title="記録が見つかりません" subtitle="一覧からもう一度選択してください。" />
        <AppButton label="一覧へ戻る" onPress={() => router.replace('/records')} />
      </ScreenShell>
    );
  }

  return (
    <ScreenShell>
      <SectionTitle title="練習記録詳細" subtitle={formatDate(record.date)} />

      <Card>
        <Text style={styles.title}>{record.practiceMenuName}</Text>
        <DetailRow label="機種" value={machineLabels[record.machineType]} />
        <DetailRow label="ゲーム種別" value={gameLabels[record.gameType]} />
        <DetailRow label="スコア" value={String(record.score)} />
        <DetailRow label="ブル数" value={String(record.bullCount)} />
        <DetailRow label="クリケットマーク数" value={String(record.cricketMarks)} />
        <DetailRow label="調子" value={conditionLabels[record.condition]} />
        <View style={styles.memoBlock}>
          <Text style={styles.label}>メモ</Text>
          <Text style={styles.memo}>{record.memo || 'メモはありません。'}</Text>
        </View>
      </Card>

      {record.photoScore ? (
        <Card muted>
          <View style={styles.badgeRow}>
            <Text style={styles.photoBadge}>写真スコア記録</Text>
          </View>
          <Text style={styles.cardTitle}>写真スコア内訳</Text>
          <DetailRow label="ボード" value={boardTypeLabels[record.photoScore.boardType]} />
          <DetailRow label="合計" value={`${record.photoScore.totalScore}点`} />
          <DetailRow label="Bull" value={`${record.photoScore.bullCount}`} />
          <DetailRow label="Triple" value={`${record.photoScore.tripleCount}`} />
          <DetailRow label="Double" value={`${record.photoScore.doubleCount}`} />
          <View style={styles.hitList}>
            {record.photoScore.hits.map((hit, index) => (
              <Text key={hit.id} style={styles.hitText}>
                {index + 1}. {formatHit(hit)} / {formatPhotoScoreSource(hit)}
              </Text>
            ))}
          </View>
          {record.photoScore.groupingAnalysis ? (
            <View style={styles.analysisBlock}>
              <Text style={styles.cardTitle}>グルーピング分析</Text>
              <Text style={styles.analysisSummary}>
                {record.photoScore.groupingAnalysis.summaryText}
              </Text>
              <DetailRow
                label="中心からの平均距離"
                value={String(record.photoScore.groupingAnalysis.averageDistanceFromBoardCenter)}
              />
              <DetailRow
                label="まとまり半径"
                value={String(record.photoScore.groupingAnalysis.spreadRadius)}
              />
              <View style={styles.hitList}>
                {record.photoScore.groupingAnalysis.adviceTexts.map((adviceText, index) => (
                  <Text key={`${adviceText}-${index}`} style={styles.hitText}>
                    {index + 1}. {adviceText}
                  </Text>
                ))}
              </View>
            </View>
          ) : null}
          <View style={styles.photoActions}>
            <AppButton
              label="この結果について相談する"
              onPress={() =>
                router.push({
                  pathname: '/consult',
                  params: { category: 'release' },
                })
              }
              variant="secondary"
            />
            <AppButton
              label="フォーム写真3枚相談へ"
              onPress={() => router.push('/consult/form-photo')}
              variant="secondary"
            />
            <AppButton
              label="フォーム写真相談履歴を見る"
              onPress={() => router.push('/consult/form-photo/history')}
              variant="secondary"
            />
            <AppButton
              label="同じ方法で写真スコアを記録する"
              onPress={() => router.push('/photo-score')}
              variant="secondary"
            />
          </View>
        </Card>
      ) : null}

      <AppButton label="編集" onPress={() => router.push(`/records/${record.id}/edit`)} />
      <AppButton label="削除" onPress={handleDelete} variant="danger" />
      <AppButton label="分析へ戻る" onPress={() => router.push('/analysis')} variant="secondary" />
      <AppButton label="一覧へ戻る" onPress={() => router.push('/records')} variant="secondary" />
    </ScreenShell>
  );
}

type DetailRowProps = {
  label: string;
  value: string;
};

function DetailRow({ label, value }: DetailRowProps) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{value}</Text>
    </View>
  );
}

function formatHit(hit: DartHitResult) {
  if (hit.area === 'singleBull' || hit.area === 'doubleBull' || hit.area === 'out') {
    return `${dartHitAreaLabels[hit.area]} / ${hit.score}点`;
  }

  return `${hit.number} ${dartHitAreaLabels[hit.area]} / ${hit.score}点`;
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
  title: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '900',
  },
  cardTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '900',
  },
  badgeRow: {
    flexDirection: 'row',
    marginBottom: 10,
  },
  photoBadge: {
    overflow: 'hidden',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    color: colors.primaryDark,
    backgroundColor: colors.primarySoft,
    fontSize: 12,
    fontWeight: '900',
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 16,
    marginTop: 16,
  },
  label: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '800',
  },
  value: {
    flex: 1,
    color: colors.text,
    fontSize: 15,
    fontWeight: '800',
    textAlign: 'right',
  },
  memoBlock: {
    marginTop: 18,
    gap: 8,
  },
  memo: {
    color: colors.text,
    fontSize: 15,
    lineHeight: 22,
  },
  hitList: {
    gap: 8,
    marginTop: 16,
  },
  hitText: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '800',
    lineHeight: 20,
  },
  analysisBlock: {
    gap: 8,
    marginTop: 18,
  },
  analysisSummary: {
    color: colors.primaryDark,
    fontSize: 14,
    fontWeight: '900',
    lineHeight: 21,
  },
  photoActions: {
    gap: 10,
    marginTop: 18,
  },
});
