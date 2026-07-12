import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { AppButton } from '../components/AppButton';
import { Card } from '../components/Card';
import { ScreenShell } from '../components/ScreenShell';
import { SectionTitle } from '../components/SectionTitle';
import { machineLabels } from '../constants/labels';
import { getLevelFromRating, levelLabels } from '../constants/levels';
import { concerns } from '../constants/mockData';
import { backgroundThemeOptions, colors } from '../constants/theme';
import { useAppState } from '../contexts/AppStateContext';
import type { BackgroundTheme, DartMachine, UiTheme, UserProfile } from '../types';

const machines: DartMachine[] = ['DARTSLIVE', 'PHOENIX', 'BOTH'];
const uiThemeOptions: { id: UiTheme; label: string }[] = [
  { id: 'gray', label: 'グレー系' },
  { id: 'light', label: '白系' },
];
const legalLinks = [
  { label: 'プライバシーポリシー', href: '/legal/privacy' },
  { label: '利用規約', href: '/legal/terms' },
  { label: 'クレジット', href: '/legal/credits' },
] as const;

export default function SettingsScreen() {
  const { backgroundTheme, isLoading, profile, uiTheme } = useAppState();

  if (isLoading) {
    return (
      <ScreenShell>
        <SectionTitle title="設定を読み込み中" subtitle="保存済みプロフィールを確認しています。" />
      </ScreenShell>
    );
  }

  return (
    <SettingsForm
      key={`${profileKey(profile)}-${uiTheme}-${backgroundTheme}`}
      backgroundTheme={backgroundTheme}
      profile={profile}
      uiTheme={uiTheme}
    />
  );
}

type SettingsFormProps = {
  backgroundTheme: BackgroundTheme;
  profile: UserProfile | null;
  uiTheme: UiTheme;
};

function SettingsForm({ backgroundTheme, profile, uiTheme }: SettingsFormProps) {
  const router = useRouter();
  const { saveProfileAndDisplaySettings } = useAppState();
  const [ratingText, setRatingText] = useState(profile ? String(profile.rating) : '7');
  const [machine, setMachine] = useState<DartMachine>(profile?.machineType ?? 'DARTSLIVE');
  const [selectedUiTheme, setSelectedUiTheme] = useState<UiTheme>(uiTheme);
  const [selectedBackgroundTheme, setSelectedBackgroundTheme] =
    useState<BackgroundTheme>(backgroundTheme);
  const [selectedConcerns, setSelectedConcerns] = useState<string[]>(
    profile?.mainProblems.length ? profile.mainProblems : [concerns[1]],
  );
  const [error, setError] = useState('');

  const rating = Number(ratingText);
  const level = useMemo(() => getLevelFromRating(rating), [rating]);

  const handleSave = async () => {
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
    await saveProfileAndDisplaySettings(
      {
        rating: normalizedRating,
        machineType: machine,
        mainProblems: selectedConcerns,
      },
      selectedUiTheme,
      selectedBackgroundTheme,
    );
    router.replace('/home');
  };

  return (
    <ScreenShell>
      <SectionTitle
        title="設定を編集"
        subtitle="プロフィールを更新するとホームと練習メニューに反映されます。"
      />

      <Card>
        <SectionTitle
          title="レーティング"
          subtitle="変更するとレベルを自動再判定します。"
          tone="card"
        />
        <TextInput
          value={ratingText}
          onChangeText={(value) => setRatingText(value.replace(/[^\d.]/g, ''))}
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
              key={item}
              label={machineLabels[item]}
              selected={machine === item}
              onPress={() => setMachine(item)}
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

      <Card>
        <SectionTitle title="表示テーマ" subtitle="実機確認しやすい配色を選べます。" tone="card" />
        <View style={styles.chipGrid}>
          {uiThemeOptions.map((item) => (
            <ChoiceChip
              key={item.id}
              label={item.label}
              selected={selectedUiTheme === item.id}
              onPress={() => setSelectedUiTheme(item.id)}
            />
          ))}
        </View>
      </Card>

      <Card>
        <SectionTitle title="背景色" subtitle="アプリ全体の背景に反映されます。" tone="card" />
        <View style={styles.backgroundGrid}>
          {backgroundThemeOptions.map((item) => (
            <Pressable
              key={item.id}
              accessibilityRole="button"
              accessibilityLabel={`背景色を${item.label}にする`}
              onPress={() => setSelectedBackgroundTheme(item.id)}
              style={({ pressed }) => [
                styles.backgroundOption,
                selectedBackgroundTheme === item.id && styles.backgroundOptionSelected,
                pressed && styles.pressed,
              ]}
            >
              <View
                style={[
                  styles.colorSwatch,
                  {
                    backgroundColor: item.hex,
                    borderColor: item.id === 'white' ? colors.border : item.hex,
                  },
                ]}
              />
              <View style={styles.backgroundTextBox}>
                <Text style={styles.backgroundLabel}>{item.label}</Text>
                <Text style={styles.backgroundValue}>{item.hex}</Text>
              </View>
            </Pressable>
          ))}
        </View>
      </Card>

      <Card>
        <SectionTitle
          title="公開前情報"
          subtitle="TestFlight提出前に確認するページです。"
          tone="card"
        />
        <View style={styles.legalList}>
          {legalLinks.map((item) => (
            <Pressable
              key={item.href}
              accessibilityRole="button"
              accessibilityLabel={`${item.label}を開く`}
              onPress={() => router.push(item.href)}
              style={({ pressed }) => [styles.legalLink, pressed && styles.pressed]}
            >
              <Text style={styles.legalLabel}>{item.label}</Text>
              <Text style={styles.legalArrow}>▶</Text>
            </Pressable>
          ))}
        </View>
      </Card>

      <AppButton label="保存してホームへ" onPress={handleSave} />
      <AppButton label="キャンセル" onPress={() => router.push('/home')} variant="secondary" />
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

function profileKey(profile: UserProfile | null) {
  if (!profile) {
    return 'empty-profile';
  }

  return `${profile.rating}-${profile.level}-${profile.machineType}-${profile.mainProblems.join('-')}`;
}

const styles = StyleSheet.create({
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
  errorText: {
    marginTop: 10,
    color: colors.danger,
    fontSize: 13,
    fontWeight: '800',
  },
  backgroundGrid: {
    gap: 10,
    marginTop: 14,
  },
  backgroundOption: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  backgroundOptionSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
  },
  colorSwatch: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
  },
  backgroundTextBox: {
    flex: 1,
    gap: 2,
  },
  backgroundLabel: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '900',
  },
  backgroundValue: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '700',
  },
  legalList: {
    gap: 10,
    marginTop: 14,
  },
  legalLink: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceMuted,
  },
  legalLabel: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '800',
  },
  legalArrow: {
    color: colors.primaryDark,
    fontSize: 13,
    fontWeight: '900',
  },
  pressed: {
    opacity: 0.74,
  },
});
