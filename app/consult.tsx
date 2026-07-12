import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { AppButton } from '../components/AppButton';
import { Card } from '../components/Card';
import { ScreenShell } from '../components/ScreenShell';
import { SectionTitle } from '../components/SectionTitle';
import { consultCategoryLabels, consultSeverityLabels } from '../constants/consultAdvice';
import { colors } from '../constants/theme';
import { useAppState } from '../contexts/AppStateContext';
import type { ConsultCategory, ConsultSeverity } from '../types';
import { createConsultHistory } from '../utils/createConsultHistory';
import { generateConsultAdvice, type ConsultAdviceResult } from '../utils/generateConsultAdvice';

const categories = Object.entries(consultCategoryLabels).map(([value, label]) => ({
  value: value as ConsultCategory,
  label,
}));

const severities = Object.entries(consultSeverityLabels).map(([value, label]) => ({
  value: value as ConsultSeverity,
  label,
}));

export default function ConsultScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ category?: string }>();
  const { addConsultHistory, profile, records } = useAppState();
  const [category, setCategory] = useState<ConsultCategory>(() =>
    normalizeCategory(params.category),
  );
  const [severity, setSeverity] = useState<ConsultSeverity>('normal');
  const [userText, setUserText] = useState('');
  const [result, setResult] = useState<ConsultAdviceResult | null>(null);
  const [error, setError] = useState('');

  const handleConsult = async () => {
    if (!userText.trim()) {
      setError('悩みを入力してください。');
      return;
    }

    setError('');
    const nextResult = generateConsultAdvice({
      category,
      severity,
      userText,
      profile,
      practiceRecords: records,
    });
    setResult(nextResult);
    await addConsultHistory(
      createConsultHistory({
        category,
        severity,
        userText,
        result: nextResult,
      }),
    );
  };

  return (
    <ScreenShell>
      <SectionTitle
        title="フォーム相談"
        subtitle="固定ロジックで原因候補と今日の練習を提案します。"
      />

      <Card>
        <Text style={styles.label}>相談カテゴリ</Text>
        <View style={styles.chipGrid}>
          {categories.map((item) => (
            <ChoiceChip
              key={item.value}
              label={item.label}
              selected={category === item.value}
              onPress={() => setCategory(item.value)}
            />
          ))}
        </View>

        <Text style={styles.label}>現在の状態</Text>
        <View style={styles.chipGrid}>
          {severities.map((item) => (
            <ChoiceChip
              key={item.value}
              label={item.label}
              selected={severity === item.value}
              onPress={() => setSeverity(item.value)}
            />
          ))}
        </View>

        <Text style={styles.label}>悩み入力</Text>
        <TextInput
          value={userText}
          onChangeText={setUserText}
          multiline
          placeholder="例: リリースで指に引っかかる / 試合になると腕が固まる"
          placeholderTextColor={colors.textMuted}
          style={styles.input}
        />
        {error ? <Text style={styles.errorText}>{error}</Text> : null}
      </Card>

      <AppButton label="相談する" onPress={() => void handleConsult()} />
      <AppButton
        label="フォーム写真3枚で相談"
        onPress={() => router.push('/consult/form-photo')}
        variant="secondary"
      />
      <AppButton
        label="フォーム写真相談履歴"
        onPress={() => router.push('/consult/form-photo/history')}
        variant="secondary"
      />
      <AppButton
        label="相談履歴を見る"
        onPress={() => router.push('/consult/history')}
        variant="secondary"
      />

      {result ? (
        <>
          <Card muted>
            <Text style={styles.answerTitle}>{result.mainAdvice[0]?.title ?? '相談結果'}</Text>
            <Text style={styles.answerBody}>
              {result.mainAdvice[0]?.adviceSummary ?? '入力内容に近い確認ポイントを表示します。'}
            </Text>
          </Card>

          <ResultList title="考えられる原因" items={result.causes} />
          <ResultList title="確認ポイント" items={result.checkPoints} />

          <Card>
            <Text style={styles.answerTitle}>今日やるべき練習</Text>
            <Text style={styles.answerBody}>{result.nextAction}</Text>
          </Card>

          <SectionTitle title="関連練習メニュー" />
          {result.recommendedPracticeMenus.map((menu) => (
            <Card key={menu.id}>
              <Text style={styles.itemTitle}>{menu.title}</Text>
              <Text style={styles.answerBody}>{menu.purpose}</Text>
              <View style={styles.actionStack}>
                <AppButton
                  label="練習詳細を開く"
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
          ))}

          <SectionTitle title="関連資料" />
          {result.relatedArticles.map((article) => (
            <Card key={article.id}>
              <Text style={styles.itemTitle}>{article.title}</Text>
              <Text style={styles.answerBody}>{article.summary}</Text>
              <View style={styles.actionStack}>
                <AppButton
                  label="関連資料を読む"
                  onPress={() => router.push(`/library/${article.id}`)}
                  variant="secondary"
                />
              </View>
            </Card>
          ))}

          <Card muted>
            <Text style={styles.cautionTitle}>注意</Text>
            <Text style={styles.cautionText}>{result.cautionText}</Text>
          </Card>
        </>
      ) : null}
    </ScreenShell>
  );
}

type ChoiceChipProps = {
  label: string;
  selected: boolean;
  onPress: () => void;
};

function ChoiceChip({ label, selected, onPress }: ChoiceChipProps) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={[styles.chip, selected && styles.chipSelected]}
    >
      <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{label}</Text>
    </Pressable>
  );
}

type ResultListProps = {
  title: string;
  items: string[];
};

function ResultList({ title, items }: ResultListProps) {
  return (
    <Card>
      <Text style={styles.answerTitle}>{title}</Text>
      <View style={styles.list}>
        {items.map((item, index) => (
          <Text key={`${item}-${index}`} style={styles.answerBody}>
            {index + 1}. {item}
          </Text>
        ))}
      </View>
    </Card>
  );
}

function normalizeCategory(category?: string): ConsultCategory {
  if (category && category in consultCategoryLabels) {
    return category as ConsultCategory;
  }

  return 'release';
}

const styles = StyleSheet.create({
  label: {
    marginTop: 4,
    color: colors.text,
    fontSize: 13,
    fontWeight: '900',
  },
  chipGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 10,
    marginBottom: 18,
  },
  chip: {
    minHeight: 38,
    justifyContent: 'center',
    paddingHorizontal: 12,
    borderRadius: 999,
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
    fontSize: 12,
    fontWeight: '800',
  },
  chipTextSelected: {
    color: colors.primaryDark,
  },
  input: {
    minHeight: 120,
    marginTop: 10,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.text,
    fontSize: 15,
    lineHeight: 21,
    textAlignVertical: 'top',
    backgroundColor: colors.background,
  },
  errorText: {
    color: colors.danger,
    fontSize: 13,
    fontWeight: '800',
  },
  answerTitle: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '900',
  },
  itemTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '900',
  },
  answerBody: {
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
  cautionTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '900',
  },
  cautionText: {
    marginTop: 8,
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 20,
  },
});
