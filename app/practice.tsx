import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AppButton } from '../components/AppButton';
import { PracticeMenuCard } from '../components/PracticeMenuCard';
import { ScreenShell } from '../components/ScreenShell';
import { SectionTitle } from '../components/SectionTitle';
import { gameLabels, machineLabels } from '../constants/labels';
import { levelLabels } from '../constants/levels';
import { concerns } from '../constants/mockData';
import { matchesMachine, practiceMenus } from '../constants/practiceMenus';
import { colors } from '../constants/theme';
import { useAppState } from '../contexts/AppStateContext';
import type {
  DartMachine,
  PracticeFilterState,
  PracticeGame,
  PracticeMenu,
  SkillLevelId,
} from '../types';
import { recommendPracticeMenus } from '../utils/recommendPracticeMenus';

type LevelFilter = SkillLevelId | 'all';
type MachineFilter = DartMachine | 'all';
type GameFilter = PracticeGame | 'all';

const levelFilters: { label: string; value: LevelFilter }[] = [
  { label: 'すべて', value: 'all' },
  { label: levelLabels.beginner, value: 'beginner' },
  { label: levelLabels.intermediate, value: 'intermediate' },
  { label: levelLabels.advanced, value: 'advanced' },
];

const machineFilters: { label: string; value: MachineFilter }[] = [
  { label: 'すべて', value: 'all' },
  { label: machineLabels.DARTSLIVE, value: 'DARTSLIVE' },
  { label: machineLabels.PHOENIX, value: 'PHOENIX' },
  { label: machineLabels.BOTH, value: 'BOTH' },
];

const gameFilters: { label: string; value: GameFilter }[] = [
  { label: 'すべて', value: 'all' },
  { label: gameLabels['COUNT-UP'], value: 'COUNT-UP' },
  { label: gameLabels['01'], value: '01' },
  { label: gameLabels.CRICKET, value: 'CRICKET' },
  { label: gameLabels.OTHER, value: 'OTHER' },
];

export default function PracticeScreen() {
  const router = useRouter();
  const {
    profile,
    records,
    practiceFilterState,
    savePracticeFilterState,
    resetPracticeFilterState,
    isFavoritePracticeMenu,
    toggleFavoritePracticeMenu,
    theme,
  } = useAppState();
  const recommendation = recommendPracticeMenus(profile, records);
  const levelFilter = practiceFilterState.level ?? 'all';
  const machineFilter = practiceFilterState.machineType ?? 'all';
  const gameFilter = practiceFilterState.gameType ?? 'all';
  const problemFilter = practiceFilterState.problemTag ?? 'all';

  const filteredMenus = useMemo(
    () =>
      practiceMenus.filter((menu) => {
        const matchesLevel = levelFilter === 'all' || menu.level === levelFilter;
        const matchesSelectedMachine =
          machineFilter === 'all' || matchesMachine(menu.machineTypes, machineFilter);
        const matchesGame = gameFilter === 'all' || menu.gameTypes.includes(gameFilter);
        const matchesProblem =
          problemFilter === 'all' || menu.targetProblems.includes(problemFilter);

        return matchesLevel && matchesSelectedMachine && matchesGame && matchesProblem;
      }),
    [gameFilter, levelFilter, machineFilter, problemFilter],
  );

  const goToDetail = (menu: PracticeMenu) => router.push(`/practice/${menu.id}`);
  const goToRecord = (menu: PracticeMenu) =>
    router.push({ pathname: '/record', params: { practiceMenuId: menu.id } });
  const updateFilter = (nextFilterState: PracticeFilterState) =>
    void savePracticeFilterState({
      ...practiceFilterState,
      ...nextFilterState,
    });

  return (
    <ScreenShell>
      <SectionTitle title="今日の練習" subtitle={recommendation.reasonText} />

      <SectionTitle title="今日のおすすめ練習" />
      {recommendation.todayMenus.map(({ menu, reason }) => (
        <PracticeMenuCard
          key={menu.id}
          menu={menu}
          reason={reason}
          isFavorite={isFavoritePracticeMenu(menu.id)}
          onViewDetails={() => goToDetail(menu)}
          onRecord={() => goToRecord(menu)}
          onToggleFavorite={() => void toggleFavoritePracticeMenu(menu.id)}
        />
      ))}

      <SectionTitle title="補助練習" subtitle="メイン練習の前後に足せるメニューです。" />
      {recommendation.supportMenus.map(({ menu, reason }) => (
        <PracticeMenuCard
          key={menu.id}
          menu={menu}
          reason={reason}
          isFavorite={isFavoritePracticeMenu(menu.id)}
          onViewDetails={() => goToDetail(menu)}
          onRecord={() => goToRecord(menu)}
          onToggleFavorite={() => void toggleFavoritePracticeMenu(menu.id)}
        />
      ))}

      <SectionTitle title="練習メニューDB" subtitle="条件で絞り込んで詳細を確認できます。" />
      <FilterGroup
        title="レベル"
        items={levelFilters}
        value={levelFilter}
        onChange={(level) => updateFilter({ level })}
      />
      <FilterGroup
        title="機種"
        items={machineFilters}
        value={machineFilter}
        onChange={(machineType) => updateFilter({ machineType })}
      />
      <FilterGroup
        title="ゲーム"
        items={gameFilters}
        value={gameFilter}
        onChange={(gameType) => updateFilter({ gameType })}
      />
      <FilterGroup
        title="悩み"
        items={[
          { label: 'すべて', value: 'all' },
          ...concerns.map((concern) => ({ label: concern, value: concern })),
        ]}
        value={problemFilter}
        onChange={(problemTag) =>
          updateFilter({ problemTag: problemTag === 'all' ? null : problemTag })
        }
      />
      <AppButton
        label="フィルタをリセット"
        onPress={() => void resetPracticeFilterState()}
        variant="secondary"
      />

      <View style={styles.resultHeader}>
        <Text style={[styles.resultText, { color: theme.onBackgroundMuted }]}>
          {filteredMenus.length}件
        </Text>
      </View>
      {filteredMenus.map((menu) => (
        <PracticeMenuCard
          key={menu.id}
          menu={menu}
          isFavorite={isFavoritePracticeMenu(menu.id)}
          onViewDetails={() => goToDetail(menu)}
          onRecord={() => goToRecord(menu)}
          onToggleFavorite={() => void toggleFavoritePracticeMenu(menu.id)}
        />
      ))}
    </ScreenShell>
  );
}

type FilterGroupProps<T extends string> = {
  title: string;
  items: { label: string; value: T }[];
  value: T;
  onChange: (value: T) => void;
};

function FilterGroup<T extends string>({ title, items, value, onChange }: FilterGroupProps<T>) {
  const { theme } = useAppState();

  return (
    <View style={styles.filterGroup}>
      <Text style={[styles.filterTitle, { color: theme.onBackground }]}>{title}</Text>
      <View style={styles.chipGrid}>
        {items.map((item) => {
          const selected = item.value === value;

          return (
            <Pressable
              key={item.value}
              accessibilityRole="button"
              onPress={() => onChange(item.value)}
              style={[styles.chip, selected && styles.chipSelected]}
            >
              <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
                {item.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  filterGroup: {
    gap: 8,
  },
  filterTitle: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '900',
  },
  chipGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
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
  resultHeader: {
    alignItems: 'flex-end',
  },
  resultText: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '800',
  },
});
