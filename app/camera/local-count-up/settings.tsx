import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AppButton } from '../../../components/AppButton';
import { Card } from '../../../components/Card';
import { ScreenShell } from '../../../components/ScreenShell';
import { SectionTitle } from '../../../components/SectionTitle';
import { colors } from '../../../constants/theme';
import { useGameDatabase } from '../../../contexts/GameDatabaseContext';
import { CameraLocalCountUpAdapter } from '../../../features/camera/detection/application/CameraLocalCountUpAdapter';
import type { BullRule } from '../../../features/game/domain/types';

const bullRuleOptions: { value: BullRule; label: string }[] = [
  { value: 'fat_bull', label: 'Fat Bull' },
  { value: 'separate_bull', label: 'Separate Bull' },
];

export default function CameraLocalCountUpSettingsScreen() {
  const router = useRouter();
  const { services, isAvailable } = useGameDatabase();
  const [bullRule, setBullRule] = useState<BullRule>('fat_bull');
  const [autoDetection, setAutoDetection] = useState(true);
  const [awardsEnabled, setAwardsEnabled] = useState(true);
  const [isStarting, setIsStarting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

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

  const startGame = useCallback(async () => {
    if (!services || isStarting) {
      return;
    }

    setIsStarting(true);
    setErrorMessage(null);
    try {
      const adapter = new CameraLocalCountUpAdapter(services.countUp);
      const activeSession = await services.activeSession.findActiveSession();
      if (activeSession) {
        setErrorMessage('進行中のゲームがあります。ゲームハブから再開または終了してください。');
        return;
      }
      const game = await adapter.startGame({ bullRule, ownerName: 'CAMERA PLAYER' });
      router.replace({
        pathname: '/camera/local-count-up/[gameId]',
        params: {
          gameId: game.gameId,
          autoDetection: autoDetection ? '1' : '0',
          awardsEnabled: awardsEnabled ? '1' : '0',
        },
      });
    } catch (error) {
      console.warn('Camera COUNT-UP start failed', error);
      setErrorMessage('COUNT-UPを開始できませんでした。少し待ってからもう一度お試しください。');
    } finally {
      setIsStarting(false);
    }
  }, [autoDetection, awardsEnabled, bullRule, isStarting, router, services]);

  return (
    <ScreenShell>
      <SectionTitle
        title="カメラCOUNT-UP設定"
        subtitle="LANペアリングなしで8ラウンドのCOUNT-UPを開始します。"
      />

      <Card>
        <SectionTitle title="Bull設定" tone="card" />
        <View style={styles.optionGrid}>
          {bullRuleOptions.map((option) => (
            <Pressable
              key={option.value}
              accessibilityRole="radio"
              accessibilityState={{ selected: option.value === bullRule }}
              onPress={() => setBullRule(option.value)}
              style={({ pressed }) => [
                styles.option,
                option.value === bullRule && styles.optionSelected,
                pressed && styles.pressed,
              ]}
            >
              <Text
                style={[styles.optionText, option.value === bullRule && styles.optionTextSelected]}
              >
                {option.label}
              </Text>
            </Pressable>
          ))}
        </View>
      </Card>

      <Card>
        <SectionTitle
          title="動作"
          subtitle="自動判定に失敗しても手動入力で進行できます。"
          tone="card"
        />
        <View style={styles.optionGrid}>
          <ToggleOption
            label={`自動判定${autoDetection ? 'ON' : 'OFF'}`}
            selected={autoDetection}
            onPress={() => setAutoDetection((current) => !current)}
          />
          <ToggleOption
            label={`音声・演出${awardsEnabled ? 'ON' : 'OFF'}`}
            selected={awardsEnabled}
            onPress={() => setAwardsEnabled((current) => !current)}
          />
        </View>
      </Card>

      {errorMessage ? (
        <Card muted>
          <Text style={styles.error}>{errorMessage}</Text>
        </Card>
      ) : null}

      <View style={styles.actions}>
        <AppButton
          label={isStarting ? '開始中...' : 'COUNT-UP開始'}
          onPress={() => void startGame()}
          disabled={!isAvailable || isStarting}
        />
        <AppButton
          label="戻る"
          onPress={() => router.replace('/camera/home')}
          variant="secondary"
        />
      </View>
    </ScreenShell>
  );
}

function ToggleOption({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityState={{ checked: selected }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.option,
        selected && styles.optionSelected,
        pressed && styles.pressed,
      ]}
    >
      <Text style={[styles.optionText, selected && styles.optionTextSelected]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  optionGrid: {
    gap: 10,
    marginTop: 14,
  },
  option: {
    minHeight: 54,
    justifyContent: 'center',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 14,
    backgroundColor: colors.surfaceMuted,
  },
  optionSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
  },
  optionText: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '900',
  },
  optionTextSelected: {
    color: colors.primaryDark,
  },
  actions: {
    gap: 10,
  },
  error: {
    color: colors.danger,
    fontSize: 14,
    fontWeight: '800',
    lineHeight: 20,
  },
  pressed: {
    opacity: 0.72,
  },
});
