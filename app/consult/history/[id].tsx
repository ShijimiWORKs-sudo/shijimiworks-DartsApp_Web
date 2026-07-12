import { useLocalSearchParams, useRouter } from 'expo-router';
import { Alert, StyleSheet, Text, View } from 'react-native';

import { AppButton } from '../../../components/AppButton';
import { Card } from '../../../components/Card';
import { ScreenShell } from '../../../components/ScreenShell';
import { SectionTitle } from '../../../components/SectionTitle';
import { consultCategoryLabels, consultSeverityLabels } from '../../../constants/consultAdvice';
import { getKnowledgeArticleById } from '../../../constants/knowledgeBase';
import { getPracticeMenuById } from '../../../constants/practiceMenus';
import { colors } from '../../../constants/theme';
import { useAppState } from '../../../contexts/AppStateContext';

export default function ConsultHistoryDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { deleteConsultHistory, getConsultHistoryById } = useAppState();
  const history = id ? getConsultHistoryById(id) : null;

  if (!history) {
    return (
      <ScreenShell>
        <SectionTitle
          title="相談履歴が見つかりません"
          subtitle="一覧からもう一度選択してください。"
        />
        <AppButton label="相談履歴へ戻る" onPress={() => router.replace('/consult/history')} />
      </ScreenShell>
    );
  }

  const relatedMenus = history.recommendedPracticeMenuIds
    .map((practiceMenuId) => getPracticeMenuById(practiceMenuId))
    .filter((menu): menu is NonNullable<typeof menu> => menu !== null);
  const relatedArticles = history.relatedKnowledgeIds
    .map((knowledgeId) => getKnowledgeArticleById(knowledgeId))
    .filter((article): article is NonNullable<typeof article> => article !== null);

  const handleDelete = () => {
    Alert.alert('相談履歴を削除しますか？', '練習記録やプロフィールには影響しません。', [
      { text: 'キャンセル', style: 'cancel' },
      {
        text: '削除',
        style: 'destructive',
        onPress: () => {
          void deleteConsultHistory(history.id).then(() => router.replace('/consult/history'));
        },
      },
    ]);
  };

  return (
    <ScreenShell>
      <SectionTitle title="相談履歴詳細" subtitle={formatDate(history.date)} />

      <Card muted>
        <DetailText label="カテゴリ" value={consultCategoryLabels[history.category]} />
        <DetailText label="現在の状態" value={consultSeverityLabels[history.severity]} />
        <DetailText label="相談内容" value={history.userText} />
      </Card>

      <Card>
        <Text style={styles.cardTitle}>回答</Text>
        <Text style={styles.bodyText}>{history.mainAdvice}</Text>
      </Card>

      <DetailList title="考えられる原因" items={history.causes} />
      <DetailList title="確認ポイント" items={history.checkPoints} />

      <Card muted>
        <Text style={styles.cardTitle}>次のアクション</Text>
        <Text style={styles.bodyText}>{history.nextAction}</Text>
      </Card>

      <SectionTitle title="関連練習メニュー" />
      {relatedMenus.length ? (
        relatedMenus.map((menu) => (
          <Card key={menu.id}>
            <Text style={styles.itemTitle}>{menu.title}</Text>
            <Text style={styles.bodyText}>{menu.purpose}</Text>
            <View style={styles.actionStack}>
              <AppButton
                label="関連練習を開く"
                onPress={() => router.push(`/practice/${menu.id}`)}
                variant="secondary"
              />
              <AppButton
                label="この練習を記録する"
                onPress={() =>
                  router.push({
                    pathname: '/record',
                    params: { practiceMenuId: menu.id },
                  })
                }
              />
            </View>
          </Card>
        ))
      ) : (
        <Card>
          <Text style={styles.bodyText}>関連練習メニューはありません。</Text>
        </Card>
      )}

      <SectionTitle title="関連資料" />
      {relatedArticles.length ? (
        relatedArticles.map((article) => (
          <Card key={article.id}>
            <Text style={styles.itemTitle}>{article.title}</Text>
            <Text style={styles.bodyText}>{article.summary}</Text>
            <View style={styles.actionStack}>
              <AppButton
                label="関連資料を読む"
                onPress={() => router.push(`/library/${article.id}`)}
                variant="secondary"
              />
            </View>
          </Card>
        ))
      ) : (
        <Card>
          <Text style={styles.bodyText}>関連資料はありません。</Text>
        </Card>
      )}

      {history.cautionText ? (
        <Card muted>
          <Text style={styles.cardTitle}>注意</Text>
          <Text style={styles.bodyText}>{history.cautionText}</Text>
        </Card>
      ) : null}

      <Card>
        <Text style={styles.cardTitle}>メモ</Text>
        <Text style={styles.bodyText}>{history.memo?.trim() || 'メモはまだありません。'}</Text>
      </Card>

      <AppButton
        label="相談画面へ戻る"
        onPress={() => router.push('/consult')}
        variant="secondary"
      />
      <AppButton label="相談履歴へ戻る" onPress={() => router.push('/consult/history')} />
      <AppButton label="この相談履歴を削除" onPress={handleDelete} variant="danger" />
    </ScreenShell>
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
          <Text key={`${item}-${index}`} style={styles.bodyText}>
            {index + 1}. {item}
          </Text>
        ))}
      </View>
    </Card>
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
  itemTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '900',
  },
  bodyText: {
    marginTop: 8,
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 22,
  },
  list: {
    gap: 6,
    marginTop: 8,
  },
  actionStack: {
    gap: 10,
    marginTop: 14,
  },
});
