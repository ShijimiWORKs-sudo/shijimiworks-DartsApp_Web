import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';

import { AppButton } from '../../../components/AppButton';
import { Card } from '../../../components/Card';
import { ScreenShell } from '../../../components/ScreenShell';
import { SectionTitle } from '../../../components/SectionTitle';
import { colors } from '../../../constants/theme';
import { useAppState } from '../../../contexts/AppStateContext';
import { useGameDatabase } from '../../../contexts/GameDatabaseContext';
import { ActiveGameExistsError } from '../../../features/game/application/services/CountUpGameService';
import type { BullRule } from '../../../features/game/domain/types';

const bullRuleOptions: { value: BullRule; label: string; helper: string }[] = [
  { value: 'fat_bull', label: 'Fat Bull', helper: 'Outer Bull / Inner Bull ともに50点' },
  { value: 'separate_bull', label: 'Separate Bull', helper: 'Outer Bull 25点、Inner Bull 50点' },
];

export default function CountUpSettingsScreen() {
  const router = useRouter();
  const { profile } = useAppState();
  const { services, isAvailable } = useGameDatabase();
  const [bullRule, setBullRule] = useState<BullRule>('fat_bull');
  const [isStarting, setIsStarting] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let mounted = true;

      async function loadDefault() {
        if (!services) {
          return;
        }

        const lastRule = await services.countUp.getLastCountUpBullRule();
        if (mounted) {
          setBullRule(lastRule);
        }
      }

      void loadDefault();
      return () => {
        mounted = false;
      };
    }, [services]),
  );

  const handleStart = useCallback(async () => {
    if (!services) {
      return;
    }

    setIsStarting(true);
    try {
      const game = await services.countUp.startGame({
        bullRule,
        ownerName: profile ? `RT ${profile.rating}` : 'PLAYER 1',
      });
      router.replace(`/game/count-up/${game.gameId}`);
    } catch (error) {
      if (error instanceof ActiveGameExistsError) {
        Alert.alert(
          '進行中のゲームがあります',
          '先に進行中または一時停止中のゲームを再開してください。',
          [
            { text: 'キャンセル', style: 'cancel' },
            {
              text: '再開する',
              onPress: () => router.replace(`/game/count-up/${error.gameId}`),
            },
          ],
        );
        return;
      }
      Alert.alert('COUNT-UPを開始できませんでした', getErrorMessage(error));
    } finally {
      setIsStarting(false);
    }
  }, [bullRule, profile, router, services]);

  return (
    <ScreenShell showNav={false}>
      <SectionTitle title="COUNT-UP設定" subtitle="8ラウンドの単独練習を開始します。" />

      <Card>
        <SectionTitle
          title="Bull設定"
          subtitle="前回のCOUNT-UP設定を初期値にします。"
          tone="card"
        />
        <View style={styles.optionList}>
          {bullRuleOptions.map((option) => {
            const selected = option.value === bullRule;
            return (
              <Pressable
                key={option.value}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
                onPress={() => setBullRule(option.value)}
                style={({ pressed }) => [
                  styles.option,
                  selected && styles.optionSelected,
                  pressed && styles.pressed,
                ]}
              >
                <Text style={[styles.optionTitle, selected && styles.optionTitleSelected]}>
                  {option.label}
                </Text>
                <Text style={styles.optionHelper}>{option.helper}</Text>
              </Pressable>
            );
          })}
        </View>
      </Card>

      <View style={styles.actions}>
        <AppButton
          label={isStarting ? '開始中...' : 'COUNT-UP開始'}
          onPress={() => void handleStart()}
          disabled={!isAvailable || isStarting}
        />
        <AppButton label="戻る" onPress={() => router.replace('/game')} variant="secondary" />
      </View>
    </ScreenShell>
  );
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : '不明なエラーです。';
}

const styles = StyleSheet.create({
  optionList: {
    gap: 10,
    marginTop: 14,
  },
  option: {
    minHeight: 74,
    justifyContent: 'center',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    backgroundColor: colors.surfaceMuted,
  },
  optionSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
  },
  optionTitle: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '900',
  },
  optionTitleSelected: {
    color: colors.primaryDark,
  },
  optionHelper: {
    marginTop: 4,
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 19,
  },
  actions: {
    gap: 10,
  },
  pressed: {
    opacity: 0.72,
  },
});
