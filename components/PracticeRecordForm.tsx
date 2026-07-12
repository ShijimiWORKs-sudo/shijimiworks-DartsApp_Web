import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { conditionLabels, gameLabels, machineLabels } from '../constants/labels';
import { levelLabels } from '../constants/levels';
import { matchesMachine, practiceMenus } from '../constants/practiceMenus';
import { colors } from '../constants/theme';
import { useAppState } from '../contexts/AppStateContext';
import type {
  Condition,
  DartMachine,
  PracticeGame,
  PracticeMenu,
  PracticeRecord,
  PracticeRecordInput,
  SkillLevelId,
} from '../types';
import { AppButton } from './AppButton';
import { Card } from './Card';

const machines: Exclude<DartMachine, 'BOTH'>[] = ['DARTSLIVE', 'PHOENIX'];
const games: PracticeGame[] = ['COUNT-UP', '01', 'CRICKET', 'OTHER'];
const levelFilters: (SkillLevelId | 'all')[] = ['all', 'beginner', 'intermediate', 'advanced'];
const gameFilters: (PracticeGame | 'all')[] = ['all', 'COUNT-UP', '01', 'CRICKET', 'OTHER'];
const machineFilters: (DartMachine | 'all')[] = ['all', 'DARTSLIVE', 'PHOENIX', 'BOTH'];
const conditions: { label: string; value: Condition }[] = [
  { label: conditionLabels.good, value: 'good' },
  { label: conditionLabels.normal, value: 'normal' },
  { label: conditionLabels.bad, value: 'bad' },
];

type PracticeRecordFormProps = {
  initialRecord?: PracticeRecord;
  initialPracticeMenu?: PracticeMenu | null;
  submitLabel: string;
  onSubmit: (record: PracticeRecordInput) => Promise<void>;
  onCancel?: () => void;
};

export function PracticeRecordForm({
  initialRecord,
  initialPracticeMenu,
  submitLabel,
  onSubmit,
  onCancel,
}: PracticeRecordFormProps) {
  const { profile } = useAppState();
  const defaultMenu =
    initialPracticeMenu ??
    practiceMenus.find((menu) => menu.level === profile?.level) ??
    practiceMenus.find((menu) => menu.level === 'intermediate') ??
    practiceMenus[0];
  const defaultMachine = profile?.machineType === 'PHOENIX' ? 'PHOENIX' : 'DARTSLIVE';
  const [practiceMenuName, setPracticeMenuName] = useState(
    initialRecord?.practiceMenuName ?? defaultMenu.title,
  );
  const [selectedPracticeMenuId, setSelectedPracticeMenuId] = useState(
    initialRecord?.practiceMenuId ?? defaultMenu.id,
  );
  const [machine, setMachine] = useState<Exclude<DartMachine, 'BOTH'>>(
    initialRecord?.machineType ?? defaultMachine,
  );
  const [game, setGame] = useState<PracticeGame>(
    initialRecord?.gameType ?? defaultMenu.gameTypes[0] ?? 'COUNT-UP',
  );
  const [condition, setCondition] = useState<Condition>(initialRecord?.condition ?? 'normal');
  const [score, setScore] = useState(initialRecord ? String(initialRecord.score) : '');
  const [bullCount, setBullCount] = useState(initialRecord ? String(initialRecord.bullCount) : '');
  const [cricketMarks, setCricketMarks] = useState(
    initialRecord ? String(initialRecord.cricketMarks) : '',
  );
  const [memo, setMemo] = useState(initialRecord?.memo ?? '');
  const [isMenuSelectorOpen, setIsMenuSelectorOpen] = useState(!initialRecord);
  const [menuSearchText, setMenuSearchText] = useState('');
  const [levelFilter, setLevelFilter] = useState<SkillLevelId | 'all'>('all');
  const [gameFilter, setGameFilter] = useState<PracticeGame | 'all'>('all');
  const [machineFilter, setMachineFilter] = useState<DartMachine | 'all'>('all');
  const [error, setError] = useState('');
  const filteredMenus = useMemo(
    () =>
      practiceMenus
        .filter((menu) => {
          const searchText = menuSearchText.trim().toLowerCase();
          const searchTarget = [
            menu.title,
            menu.level,
            ...menu.tags,
            ...menu.gameTypes,
            ...menu.targetProblems,
          ]
            .join(' ')
            .toLowerCase();

          return (
            (!searchText || searchTarget.includes(searchText)) &&
            (levelFilter === 'all' || menu.level === levelFilter) &&
            (gameFilter === 'all' || menu.gameTypes.includes(gameFilter)) &&
            (machineFilter === 'all' || matchesMachine(menu.machineTypes, machineFilter))
          );
        })
        .slice(0, 10),
    [gameFilter, levelFilter, machineFilter, menuSearchText],
  );

  const handleSelectMenu = (menu: PracticeMenu) => {
    setSelectedPracticeMenuId(menu.id);
    setPracticeMenuName(menu.title);
    setGame(menu.gameTypes[0] ?? 'COUNT-UP');

    if (!matchesMachine(menu.machineTypes, machine)) {
      setMachine(menu.machineTypes.includes('PHOENIX') ? 'PHOENIX' : 'DARTSLIVE');
    }
  };

  const handleSubmit = async () => {
    if (!practiceMenuName.trim()) {
      setError('練習メニュー名を入力してください。');
      return;
    }

    if (!score || !bullCount || !cricketMarks) {
      setError('スコア、ブル数、クリケットマーク数を入力してください。');
      return;
    }

    const numericScore = Number(score);
    const numericBullCount = Number(bullCount);
    const numericCricketMarks = Number(cricketMarks);

    if ([numericScore, numericBullCount, numericCricketMarks].some((value) => value < 0)) {
      setError('数値は0以上で入力してください。');
      return;
    }

    const matchedMenu =
      practiceMenus.find((menu) => menu.id === selectedPracticeMenuId) ??
      practiceMenus.find((menu) => menu.title === practiceMenuName.trim()) ??
      initialPracticeMenu;

    setError('');
    await onSubmit({
      practiceMenuId: matchedMenu?.id ?? initialRecord?.practiceMenuId ?? 'custom-practice',
      practiceMenuName: practiceMenuName.trim(),
      machineType: machine,
      gameType: game,
      score: numericScore,
      bullCount: numericBullCount,
      cricketMarks: numericCricketMarks,
      condition,
      memo: memo.trim(),
      inputMethod: initialRecord?.inputMethod ?? 'manual',
      photoScore: initialRecord?.photoScore,
    });
  };

  return (
    <>
      <Card muted>
        <View style={styles.selectorHeader}>
          <View style={styles.selectorHeaderText}>
            <Text style={styles.selectorTitle}>練習メニューを選択</Text>
            <Text style={styles.selectorBody}>現在: {practiceMenuName}</Text>
          </View>
          <Pressable
            accessibilityRole="button"
            onPress={() => setIsMenuSelectorOpen((current) => !current)}
            style={styles.toggleButton}
          >
            <Text style={styles.toggleText}>{isMenuSelectorOpen ? '閉じる' : '開く'}</Text>
          </Pressable>
        </View>

        {isMenuSelectorOpen ? (
          <>
            <Text style={styles.selectorBody}>
              メニュー名、タグ、ゲーム種別、レベルで検索できます。手入力での記録もできます。
            </Text>
            <TextInput
              value={menuSearchText}
              onChangeText={setMenuSearchText}
              placeholder="例: ブル / CRICKET / release"
              placeholderTextColor={colors.textMuted}
              style={styles.input}
            />
            <ChoiceGroup
              title="レベル"
              items={levelFilters}
              value={levelFilter}
              getLabel={(item) => (item === 'all' ? 'すべて' : levelLabels[item])}
              onChange={setLevelFilter}
            />
            <ChoiceGroup
              title="ゲーム"
              items={gameFilters}
              value={gameFilter}
              getLabel={(item) => (item === 'all' ? 'すべて' : gameLabels[item])}
              onChange={setGameFilter}
            />
            <ChoiceGroup
              title="機種"
              items={machineFilters}
              value={machineFilter}
              getLabel={(item) => (item === 'all' ? 'すべて' : machineLabels[item])}
              onChange={setMachineFilter}
            />
            <View style={styles.menuList}>
              {filteredMenus.map((menu) => (
                <Pressable
                  key={menu.id}
                  accessibilityRole="button"
                  onPress={() => handleSelectMenu(menu)}
                  style={[
                    styles.menuOption,
                    selectedPracticeMenuId === menu.id && styles.menuOptionSelected,
                  ]}
                >
                  <Text style={styles.menuOptionTitle}>{menu.title}</Text>
                  <Text style={styles.menuOptionMeta}>
                    {levelLabels[menu.level]} /{' '}
                    {menu.gameTypes.map((item) => gameLabels[item]).join('・')} /{' '}
                    {menu.durationMinutes}分
                  </Text>
                </Pressable>
              ))}
            </View>
          </>
        ) : null}
      </Card>

      <Card>
        <TextInputField
          label="練習メニュー名"
          placeholder="例: 19カバードリル"
          value={practiceMenuName}
          onChangeText={(value) => {
            setPracticeMenuName(value);
            setSelectedPracticeMenuId('custom-practice');
          }}
        />
        <ChoiceGroup title="機種" items={machines} value={machine} onChange={setMachine} />
        <ChoiceGroup title="ゲーム種別" items={games} value={game} onChange={setGame} />
        <TextInputField
          label="スコア入力"
          placeholder="例: 560"
          value={score}
          onChangeText={(value) => setScore(toNumericText(value))}
          keyboardType="number-pad"
        />
        <TextInputField
          label="ブル数"
          placeholder="例: 12"
          value={bullCount}
          onChangeText={(value) => setBullCount(toNumericText(value))}
          keyboardType="number-pad"
        />
        <TextInputField
          label="クリケットマーク数"
          placeholder="例: 43"
          value={cricketMarks}
          onChangeText={(value) => setCricketMarks(toNumericText(value))}
          keyboardType="number-pad"
        />
        <TextInputField
          label="主観メモ"
          placeholder="2ラウンド目から力みが出た"
          value={memo}
          onChangeText={setMemo}
          multiline
        />
        <ChoiceGroup
          title="調子"
          items={conditions.map((item) => item.value)}
          value={condition}
          getLabel={(item) =>
            conditions.find((conditionItem) => conditionItem.value === item)?.label ?? item
          }
          onChange={setCondition}
        />
        {error ? <Text style={styles.errorText}>{error}</Text> : null}
      </Card>
      <AppButton label={submitLabel} onPress={handleSubmit} />
      {onCancel ? <AppButton label="キャンセル" onPress={onCancel} variant="secondary" /> : null}
    </>
  );
}

type TextInputFieldProps = {
  label: string;
  placeholder: string;
  value: string;
  onChangeText: (value: string) => void;
  keyboardType?: 'default' | 'number-pad';
  multiline?: boolean;
};

function TextInputField({
  label,
  placeholder,
  value,
  onChangeText,
  keyboardType = 'default',
  multiline = false,
}: TextInputFieldProps) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
        keyboardType={keyboardType}
        multiline={multiline}
        style={[styles.input, multiline && styles.memoInput]}
      />
    </View>
  );
}

type ChoiceGroupProps<T extends string> = {
  title: string;
  items: T[];
  value: T;
  getLabel?: (item: T) => string;
  onChange: (value: T) => void;
};

function ChoiceGroup<T extends string>({
  title,
  items,
  value,
  getLabel,
  onChange,
}: ChoiceGroupProps<T>) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{title}</Text>
      <View style={styles.chipRow}>
        {items.map((item) => {
          const selected = item === value;

          return (
            <Pressable
              key={item}
              accessibilityRole="button"
              onPress={() => onChange(item)}
              style={[styles.chip, selected && styles.chipSelected]}
            >
              <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
                {getLabel ? getLabel(item) : item}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function toNumericText(value: string) {
  return value.replace(/\D/g, '');
}

const styles = StyleSheet.create({
  selectorTitle: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '900',
  },
  selectorHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  selectorHeaderText: {
    flex: 1,
  },
  selectorBody: {
    marginTop: 8,
    marginBottom: 12,
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 20,
  },
  toggleButton: {
    minHeight: 38,
    justifyContent: 'center',
    paddingHorizontal: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  toggleText: {
    color: colors.primaryDark,
    fontSize: 13,
    fontWeight: '900',
  },
  menuList: {
    gap: 8,
  },
  menuOption: {
    minHeight: 72,
    justifyContent: 'center',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  menuOptionSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
  },
  menuOptionTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '900',
  },
  menuOptionMeta: {
    marginTop: 6,
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '700',
  },
  field: {
    gap: 8,
    marginBottom: 16,
  },
  fieldLabel: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '900',
  },
  input: {
    minHeight: 48,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.text,
    fontSize: 15,
    backgroundColor: colors.background,
  },
  memoInput: {
    minHeight: 92,
    paddingTop: 12,
    textAlignVertical: 'top',
  },
  chipRow: {
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
  errorText: {
    color: colors.danger,
    fontSize: 13,
    fontWeight: '800',
  },
});
