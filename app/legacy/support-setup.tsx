import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { AppButton } from '../../components/AppButton';
import { Card } from '../../components/Card';
import { ScreenShell } from '../../components/ScreenShell';
import { SectionTitle } from '../../components/SectionTitle';
import { getLevelFromRating, levelLabels } from '../../constants/levels';
import { concerns } from '../../constants/mockData';
import { colors } from '../../constants/theme';
import { useAppState } from '../../contexts/AppStateContext';
import type { DartMachine } from '../../types';

const logo = require('../../assets/images/logo.png');

const machines: { label: string; value: DartMachine }[] = [
  { label: 'DARTSLIVE', value: 'DARTSLIVE' },
  { label: 'PHOENIX', value: 'PHOENIX' },
  { label: '両方', value: 'BOTH' },
];

export default function LegacySupportSetupScreen() {
  const router = useRouter();
  const { isLoading, saveProfile, theme } = useAppState();
  const [ratingText, setRatingText] = useState('7');
  const [machine, setMachine] = useState<DartMachine>('DARTSLIVE');
  const [selectedConcerns, setSelectedConcerns] = useState<string[]>([concerns[1]]);
  const [error, setError] = useState('');

  const rating = Number(ratingText);
  const level = useMemo(() => getLevelFromRating(rating), [rating]);

  const handleStart = async () => {
    const normalizedRating = Number(ratingText);

    if (!ratingText.trim() || !Number.isFinite(normalizedRating) || normalizedRating < 1) {
      setError('レーティングは1以上の数字で入力してください。');
      return;
    }

    if (selectedConcerns.length === 0) {
      setError('主な悩みを1つ以上選択してください。');
      return;
    }

    setError('');
    await saveProfile({
      rating: normalizedRating,
      machineType: machine,
      mainProblems: selectedConcerns,
    });
    router.replace('/home');
  };

  return (
    <ScreenShell showNav={false}>
      <View style={styles.hero}>
        <Image source={logo} resizeMode="contain" style={styles.logo} />
        <View style={styles.heroText}>
          <Text style={[styles.appName, { color: theme.onBackground }]}>旧Support初期設定</Text>
          <Text style={[styles.lead, { color: theme.onBackgroundMuted }]}>
            {isLoading
              ? '保存済み設定を確認しています。'
              : 'DartsApp通常起動では表示しない旧Support用の設定画面です。'}
          </Text>
        </View>
      </View>

      <Card>
        <SectionTitle
          title="レーティング"
          subtitle="数字を入れるとレベルを自動判定します。"
          tone="card"
        />
        <TextInput
          value={ratingText}
          onChangeText={setRatingText}
          keyboardType="decimal-pad"
          placeholder="例: 7"
          placeholderTextColor={colors.textMuted}
          style={styles.input}
        />
        <View style={styles.levelBox}>
          <Text style={styles.levelLabel}>現在レベル</Text>
          <Text style={styles.levelValue}>
            {Number.isFinite(rating) && rating >= 1 ? levelLabels[level] : '未判定'}
          </Text>
        </View>
        {error ? <Text style={styles.errorText}>{error}</Text> : null}
      </Card>

      <Card>
        <SectionTitle title="利用機種" tone="card" />
        <View style={styles.chipGrid}>
          {machines.map((item) => (
            <ChoiceChip
              key={item.value}
              label={item.label}
              selected={machine === item.value}
              onPress={() => setMachine(item.value)}
            />
          ))}
        </View>
      </Card>

      <Card>
        <SectionTitle title="主な悩み" subtitle="複数選択できます。" tone="card" />
        <View style={styles.chipGrid}>
          {concerns.map((item) => (
            <ChoiceChip
              key={item}
              label={item}
              selected={selectedConcerns.includes(item)}
              onPress={() =>
                setSelectedConcerns((currentConcerns) =>
                  currentConcerns.includes(item)
                    ? currentConcerns.filter((concern) => concern !== item)
                    : [...currentConcerns, item],
                )
              }
            />
          ))}
        </View>
      </Card>

      <AppButton label="はじめる" onPress={handleStart} />
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
      style={({ pressed }) => [
        styles.chip,
        selected && styles.chipSelected,
        pressed && styles.pressed,
      ]}
    >
      <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  hero: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  logo: {
    width: 76,
    height: 76,
  },
  heroText: {
    flex: 1,
    gap: 6,
  },
  appName: {
    color: colors.text,
    fontSize: 28,
    fontWeight: '900',
  },
  lead: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 20,
  },
  input: {
    marginTop: 14,
    minHeight: 52,
    paddingHorizontal: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.text,
    fontSize: 20,
    fontWeight: '800',
    backgroundColor: colors.background,
  },
  levelBox: {
    marginTop: 12,
    padding: 14,
    borderRadius: 8,
    backgroundColor: colors.primarySoft,
  },
  levelLabel: {
    color: colors.primaryDark,
    fontSize: 12,
    fontWeight: '800',
  },
  levelValue: {
    marginTop: 4,
    color: colors.text,
    fontSize: 18,
    fontWeight: '900',
  },
  errorText: {
    marginTop: 10,
    color: colors.danger,
    fontSize: 13,
    fontWeight: '800',
  },
  chipGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 14,
  },
  chip: {
    minHeight: 40,
    justifyContent: 'center',
    paddingHorizontal: 14,
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
    fontSize: 13,
    fontWeight: '800',
  },
  chipTextSelected: {
    color: colors.primaryDark,
  },
  pressed: {
    opacity: 0.74,
  },
});
