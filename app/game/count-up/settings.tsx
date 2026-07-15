import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AppButton } from '../../../components/AppButton';
import { Card } from '../../../components/Card';
import { ActiveSessionConflictDialog } from '../../../components/game/ActiveSessionConflictDialog';
import { ScreenShell } from '../../../components/ScreenShell';
import { SectionTitle } from '../../../components/SectionTitle';
import { useDesktopWebLayout } from '../../../components/web/useDesktopWebLayout';
import { webGameStyles } from '../../../components/web/WebGameShell';
import { colors } from '../../../constants/theme';
import { useAppState } from '../../../contexts/AppStateContext';
import { useGameDatabase } from '../../../contexts/GameDatabaseContext';
import type { ActiveSessionInfo } from '../../../features/game/application/services';
import type { BullRule } from '../../../features/game/domain/types';

const bullRuleOptions: { value: BullRule; label: string; helper: string }[] = [
  { value: 'fat_bull', label: 'Fat Bull', helper: 'Outer Bull / Inner Bull ともに50点' },
  { value: 'separate_bull', label: 'Separate Bull', helper: 'Outer Bull 25点、Inner Bull 50点' },
];
const genericStartError =
  'ゲームを開始できませんでした。進行中のゲームを確認して、もう一度お試しください。';

export default function CountUpSettingsScreen() {
  const router = useRouter();
  const { profile } = useAppState();
  const { services, isAvailable } = useGameDatabase();
  const isDesktopWeb = useDesktopWebLayout();
  const [bullRule, setBullRule] = useState<BullRule>('fat_bull');
  const [conflictSession, setConflictSession] = useState<ActiveSessionInfo | null>(null);
  const [startError, setStartError] = useState<string | null>(null);
  const [isConflictProcessing, setIsConflictProcessing] = useState(false);
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

  const startCountUp = useCallback(async () => {
    if (!services) {
      return;
    }

    const game = await services.countUp.startGame({
      bullRule,
      ownerName: profile ? `RT ${profile.rating}` : 'PLAYER 1',
    });
    setStartError(null);
    router.replace(`/game/count-up/${game.gameId}`);
  }, [bullRule, profile, router, services]);

  const handleStart = useCallback(async () => {
    if (!services) {
      return;
    }

    setStartError(null);
    setIsStarting(true);
    try {
      const activeSession = await services.activeSession.findActiveSession();
      if (activeSession) {
        setConflictSession(activeSession);
        return;
      }
      await startCountUp();
    } catch (error) {
      console.warn('COUNT-UP start failed', error);
      setStartError(genericStartError);
    } finally {
      setIsStarting(false);
    }
  }, [services, startCountUp]);

  const handleResumeConflict = useCallback(() => {
    if (!conflictSession || isConflictProcessing) {
      return;
    }
    setConflictSession(null);
    router.replace(conflictSession.route);
  }, [conflictSession, isConflictProcessing, router]);

  const handleAbortConflictAndStart = useCallback(async () => {
    if (!services || !conflictSession || isConflictProcessing) {
      return;
    }

    setIsConflictProcessing(true);
    setStartError(null);
    try {
      await services.activeSession.abortActiveSession(conflictSession);
      setConflictSession(null);
      await startCountUp();
    } catch (error) {
      console.warn('COUNT-UP conflict resolution failed', error);
      setStartError(genericStartError);
    } finally {
      setIsConflictProcessing(false);
      setIsStarting(false);
    }
  }, [conflictSession, isConflictProcessing, services, startCountUp]);

  const conflictDialog = (
    <ActiveSessionConflictDialog
      visible={conflictSession !== null}
      activeMode={conflictSession?.mode ?? 'count_up'}
      activeLabel={conflictSession?.label ?? 'COUNT-UP'}
      activeStatus={conflictSession?.status}
      onResume={handleResumeConflict}
      onAbortAndStart={() => void handleAbortConflictAndStart()}
      onCancel={() => setConflictSession(null)}
      isProcessing={isConflictProcessing}
    />
  );

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

      {startError ? (
        <Card muted>
          <Text style={styles.startError}>{startError}</Text>
        </Card>
      ) : null}

      <View style={[styles.actions, isDesktopWeb && webGameStyles.desktopFooterActions]}>
        <AppButton
          label={isStarting ? '開始中...' : 'COUNT-UP開始'}
          onPress={() => void handleStart()}
          disabled={!isAvailable || isStarting}
          style={isDesktopWeb && webGameStyles.desktopFooterButton}
        />
        <AppButton
          label="戻る"
          onPress={() => router.replace('/game')}
          variant="secondary"
          style={isDesktopWeb && webGameStyles.desktopFooterButton}
        />
      </View>
      {conflictDialog}
    </ScreenShell>
  );
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
  startError: {
    color: colors.danger,
    fontSize: 14,
    fontWeight: '800',
    lineHeight: 20,
  },
  pressed: {
    opacity: 0.72,
  },
});
