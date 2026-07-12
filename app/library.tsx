import { useMemo, useState } from 'react';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { AppButton } from '../components/AppButton';
import { Card } from '../components/Card';
import { ScreenShell } from '../components/ScreenShell';
import { SectionTitle } from '../components/SectionTitle';
import { knowledgeBase } from '../constants/knowledgeBase';
import { practiceMenus } from '../constants/practiceMenus';
import { colors } from '../constants/theme';
import {
  defaultKnowledgeSearchFilters,
  getKnowledgeTags,
  searchKnowledgeBase,
  type KnowledgeSearchFilters,
  type RelatedPracticeFilter,
} from '../utils/searchKnowledgeBase';

const categoryLabels: Record<string, string> = {
  all: 'すべて',
  stance: 'スタンス',
  grip: 'グリップ',
  release: 'リリース',
  mental: 'メンタル',
  yips: 'イップス',
  countUp: 'COUNT-UP',
  cricket: 'CRICKET',
  zeroOne: '01',
  routine: 'ルーティン',
  practicePlan: '練習計画',
};

const relatedPracticeFilters: { value: RelatedPracticeFilter; label: string }[] = [
  { value: 'all', label: 'すべて' },
  { value: 'withRelatedPractice', label: '練習あり' },
  { value: 'withoutRelatedPractice', label: '練習なし' },
];

export default function LibraryScreen() {
  const router = useRouter();
  const categories = useMemo(
    () => ['all', ...Array.from(new Set(knowledgeBase.map((article) => article.category)))],
    [],
  );
  const tags = useMemo(() => getKnowledgeTags(), []);
  const [filters, setFilters] = useState<KnowledgeSearchFilters>(defaultKnowledgeSearchFilters);
  const selectedArticles = useMemo(() => searchKnowledgeBase(filters), [filters]);

  const updateFilters = (nextFilters: Partial<KnowledgeSearchFilters>) => {
    setFilters((currentFilters) => ({
      ...currentFilters,
      ...nextFilters,
    }));
  };

  return (
    <ScreenShell>
      <SectionTitle
        title="資料ライブラリ"
        subtitle="フォーム相談と練習メニューに紐づく基礎資料です。"
      />

      <Card muted>
        <Text style={styles.searchTitle}>資料を検索</Text>
        <TextInput
          value={filters.query}
          onChangeText={(query) => updateFilters({ query })}
          placeholder="例: リリース / ブル / メンタル"
          placeholderTextColor={colors.textMuted}
          style={styles.input}
        />

        <Text style={styles.filterLabel}>カテゴリ</Text>
        <View style={styles.categoryGrid}>
          {categories.map((category) => (
            <FilterChip
              key={category}
              label={categoryLabels[category] ?? category}
              selected={filters.category === category}
              onPress={() => updateFilters({ category })}
            />
          ))}
        </View>

        <Text style={styles.filterLabel}>タグ</Text>
        <View style={styles.categoryGrid}>
          <FilterChip
            label="すべて"
            selected={filters.tag === null}
            onPress={() => updateFilters({ tag: null })}
          />
          {tags.slice(0, 16).map((tag) => (
            <FilterChip
              key={tag}
              label={tag}
              selected={filters.tag === tag}
              onPress={() => updateFilters({ tag })}
            />
          ))}
        </View>

        <Text style={styles.filterLabel}>関連練習メニュー</Text>
        <View style={styles.categoryGrid}>
          {relatedPracticeFilters.map((item) => (
            <FilterChip
              key={item.value}
              label={item.label}
              selected={filters.relatedPractice === item.value}
              onPress={() => updateFilters({ relatedPractice: item.value })}
            />
          ))}
        </View>

        <View style={styles.resetAction}>
          <AppButton
            label="条件をリセット"
            onPress={() => setFilters(defaultKnowledgeSearchFilters)}
            variant="secondary"
          />
        </View>
      </Card>

      <SectionTitle title="検索結果" subtitle={`${selectedArticles.length}件の記事`} />
      {selectedArticles.length === 0 ? (
        <Card>
          <Text style={styles.articleSummary}>条件に合う資料はありません。</Text>
        </Card>
      ) : (
        selectedArticles.map((article) => (
          <Card key={article.id}>
            <Text style={styles.articleTitle}>{article.title}</Text>
            <Text style={styles.articleSummary}>{article.summary}</Text>
            <View style={styles.tags}>
              {article.tags.slice(0, 4).map((tag) => (
                <Text key={tag} style={styles.tag}>
                  {tag}
                </Text>
              ))}
            </View>
            <View style={styles.cardAction}>
              <AppButton
                label="記事を読む"
                onPress={() => router.push(`/library/${article.id}`)}
                variant="secondary"
              />
            </View>
          </Card>
        ))
      )}

      <SectionTitle
        title="練習メニューから探す"
        subtitle="資料と練習メニューの連携準備用一覧です。"
      />
      {practiceMenus.slice(0, 8).map((menu) => (
        <Pressable
          key={menu.id}
          accessibilityRole="button"
          onPress={() => router.push(`/practice/${menu.id}`)}
          style={({ pressed }) => [styles.practiceMenuRow, pressed && styles.pressed]}
        >
          <Text style={styles.practiceMenuTitle}>{menu.title}</Text>
          <Text style={styles.practiceMenuSummary}>
            {menu.tags.slice(0, 3).join(' / ')} / {menu.durationMinutes}分
          </Text>
        </Pressable>
      ))}
    </ScreenShell>
  );
}

type FilterChipProps = {
  label: string;
  selected: boolean;
  onPress: () => void;
};

function FilterChip({ label, selected, onPress }: FilterChipProps) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={[styles.categoryButton, selected && styles.categoryButtonSelected]}
    >
      <Text style={[styles.categoryText, selected && styles.categoryTextSelected]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  searchTitle: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '900',
  },
  input: {
    minHeight: 48,
    marginTop: 12,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.text,
    fontSize: 15,
    backgroundColor: colors.background,
  },
  filterLabel: {
    marginTop: 16,
    color: colors.text,
    fontSize: 13,
    fontWeight: '900',
  },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 10,
  },
  categoryButton: {
    minHeight: 40,
    justifyContent: 'center',
    paddingHorizontal: 13,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  categoryButtonSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
  },
  categoryText: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '800',
  },
  categoryTextSelected: {
    color: colors.primaryDark,
  },
  resetAction: {
    marginTop: 16,
  },
  articleTitle: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '900',
  },
  articleSummary: {
    marginTop: 8,
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 21,
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
  cardAction: {
    marginTop: 14,
  },
  practiceMenuRow: {
    minHeight: 68,
    justifyContent: 'center',
    padding: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  practiceMenuTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '900',
  },
  practiceMenuSummary: {
    marginTop: 6,
    color: colors.textMuted,
    fontSize: 13,
  },
  pressed: {
    opacity: 0.72,
  },
});
