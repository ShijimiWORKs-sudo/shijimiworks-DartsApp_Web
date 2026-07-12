import { useLocalSearchParams, useRouter } from 'expo-router';
import { Alert, Image, StyleSheet, Text, View } from 'react-native';

import { AppButton } from '../../../../components/AppButton';
import { Card } from '../../../../components/Card';
import { ScreenShell } from '../../../../components/ScreenShell';
import { SectionTitle } from '../../../../components/SectionTitle';
import {
  formAdviceCategoryLabels,
  formPhotoTypeLabels,
  formSelfCheckAnswerLabels,
  throwingHandLabels,
} from '../../../../constants/formPhoto';
import { getPracticeMenuById } from '../../../../constants/practiceMenus';
import { colors } from '../../../../constants/theme';
import { useAppState } from '../../../../contexts/AppStateContext';
import type { FormPhotoEntry, FormSelfCheck } from '../../../../types';

const selfCheckLabels: Record<keyof FormSelfCheck, string> = {
  stanceFeelsStable: 'スタンスは安定している',
  shoulderLineFeelsAligned: '肩ラインが狙いに向いている',
  elbowHeightFeelsStable: '肘の高さが安定している',
  releaseFeelsClean: 'リリースが抜ける',
  followThroughGoesToTarget: 'フォロースルーが狙い方向へ出る',
  bodyOpensEarly: '体が早く開く感覚がある',
  gripFeelsTooStrong: 'グリップが強すぎる感覚がある',
  feelsRushed: '投げ急いでいる感覚がある',
};

export default function FormPhotoAdviceHistoryDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { deleteFormPhotoAdviceResult, getFormPhotoAdviceResultById } = useAppState();
  const history = id ? getFormPhotoAdviceResultById(id) : null;

  if (!history) {
    return (
      <ScreenShell>
        <SectionTitle
          title="フォーム写真相談履歴が見つかりません"
          subtitle="一覧からもう一度選択してください。"
        />
        <AppButton
          label="履歴一覧へ戻る"
          onPress={() => router.replace('/consult/form-photo/history')}
        />
      </ScreenShell>
    );
  }

  const relatedMenus = history.recommendedPracticeMenuIds
    .map((practiceMenuId) => getPracticeMenuById(practiceMenuId))
    .filter((menu): menu is NonNullable<typeof menu> => menu !== null);

  const handleDelete = () => {
    Alert.alert(
      'フォーム写真相談履歴を削除しますか？',
      '練習記録や写真スコア記録には影響しません。',
      [
        { text: 'キャンセル', style: 'cancel' },
        {
          text: '削除',
          style: 'destructive',
          onPress: () => {
            void deleteFormPhotoAdviceResult(history.id).then(() =>
              router.replace('/consult/form-photo/history'),
            );
          },
        },
      ],
    );
  };

  return (
    <ScreenShell>
      <SectionTitle title="フォーム写真相談履歴詳細" subtitle={formatDate(history.date)} />

      <Card muted>
        <DetailText label="相談日時" value={formatDate(history.date)} />
        <DetailText label="利き手" value={throwingHandLabels[history.throwingHand]} />
        {history.linkedPhotoScoreSummary ? (
          <DetailText label="写真スコア連携" value={history.linkedPhotoScoreSummary} />
        ) : (
          <DetailText label="写真スコア連携" value="連携なし" />
        )}
      </Card>

      <SectionTitle title="フォーム写真" />
      <View style={styles.photoGrid}>
        {history.photos.map((photo) => (
          <PhotoPreview key={photo.type} photo={photo} />
        ))}
      </View>

      <Card>
        <Text style={styles.cardTitle}>まとめ</Text>
        <Text style={styles.bodyText}>{history.summaryText}</Text>
        <View style={styles.categoryRow}>
          {history.adviceCategories.map((category) => (
            <Text key={category} style={styles.categoryPill}>
              {formAdviceCategoryLabels[category]}
            </Text>
          ))}
        </View>
      </Card>

      <DetailList title="アドバイス" items={history.adviceTexts} />
      <DetailList title="確認ポイント" items={history.checkPoints} />

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

      <Card muted>
        <Text style={styles.cardTitle}>自己チェック内容</Text>
        <View style={styles.selfCheckList}>
          {(
            Object.entries(history.selfCheck) as [
              keyof FormSelfCheck,
              FormSelfCheck[keyof FormSelfCheck],
            ][]
          ).map(([key, value]) => (
            <DetailText
              key={key}
              label={selfCheckLabels[key]}
              value={formSelfCheckAnswerLabels[value]}
            />
          ))}
        </View>
      </Card>

      <AppButton
        label="同じ内容で再相談"
        onPress={() => router.push('/consult/form-photo')}
        variant="secondary"
      />
      <AppButton
        label="新しくフォーム写真相談"
        onPress={() => router.push('/consult/form-photo')}
      />
      <AppButton
        label="履歴一覧へ戻る"
        onPress={() => router.push('/consult/form-photo/history')}
        variant="secondary"
      />
      <AppButton label="この履歴を削除" onPress={handleDelete} variant="danger" />
    </ScreenShell>
  );
}

function PhotoPreview({ photo }: { photo: FormPhotoEntry }) {
  return (
    <Card>
      <Text style={styles.cardTitle}>{formPhotoTypeLabels[photo.type]}</Text>
      {photo.imageUri ? (
        <Image source={{ uri: photo.imageUri }} resizeMode="contain" style={styles.photo} />
      ) : (
        <Text style={styles.missingPhotoText}>未登録</Text>
      )}
      {photo.note ? <Text style={styles.bodyText}>{photo.note}</Text> : null}
    </Card>
  );
}

function DetailText({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  );
}

function DetailList({ title, items }: { title: string; items: string[] }) {
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
  photoGrid: {
    gap: 10,
  },
  photo: {
    width: '100%',
    height: 180,
    marginTop: 12,
    borderRadius: 8,
    backgroundColor: colors.surfaceMuted,
  },
  missingPhotoText: {
    marginTop: 12,
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '800',
  },
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
  categoryRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 12,
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
  selfCheckList: {
    marginTop: 12,
  },
  actionStack: {
    gap: 10,
    marginTop: 14,
  },
});
