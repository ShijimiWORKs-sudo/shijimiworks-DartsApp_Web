import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AppButton } from '../../../components/AppButton';
import { Card } from '../../../components/Card';
import { AccountLocalNotice } from '../../../components/account/AccountLocalNotice';
import { ActiveSessionConflictDialog } from '../../../components/game/ActiveSessionConflictDialog';
import { ScreenShell } from '../../../components/ScreenShell';
import { SectionTitle } from '../../../components/SectionTitle';
import { useDesktopWebLayout } from '../../../components/web/useDesktopWebLayout';
import {
  WebGameSettingsShell,
  webGameSettingsStyles,
  WebSettingsSummaryCard,
  WebSettingsSummaryRow,
} from '../../../components/web/WebGameSettingsShell';
import { colors } from '../../../constants/theme';
import { useAppState } from '../../../contexts/AppStateContext';
import { useGameDatabase } from '../../../contexts/GameDatabaseContext';
import type { AccountOverview } from '../../../features/account/domain';
import type { ActiveSessionInfo } from '../../../features/game/application/services';
import type { BullRule } from '../../../features/game/domain/types';

const bullRuleOptions: { value: BullRule; label: string; helper: string }[] = [
  { value: 'fat_bull', label: 'Fat Bull', helper: 'Outer Bull / Inner Bull ともに2マーク' },
  {
    value: 'separate_bull',
    label: 'Separate Bull',
    helper: 'Outer Bull 1マーク、Inner Bull 2マーク',
  },
];
const genericStartError =
  'ゲームを開始できませんでした。進行中のゲームを確認して、もう一度お試しください。';

export default function CricketSettingsScreen() {
  const router = useRouter();
  const { activeAccountId, profile } = useAppState();
  const { services, isAvailable } = useGameDatabase();
  const isDesktopWeb = useDesktopWebLayout();
  const [bullRule, setBullRule] = useState<BullRule>('fat_bull');
  const [accountOverview, setAccountOverview] = useState<AccountOverview | null>(null);
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

        const [settings, account] = await Promise.all([
          services.cricket.getLastSettings(),
          services.account.getActiveAccount(activeAccountId),
        ]);
        if (mounted) {
          setBullRule(settings.bullRule);
          setAccountOverview(account);
        }
      }

      void loadDefault();
      return () => {
        mounted = false;
      };
    }, [activeAccountId, services]),
  );

  const startCricket = useCallback(async () => {
    if (!services) {
      return;
    }

    const game = await services.cricket.startGame({
      bullRule,
      ownerName: profile ? `RT ${profile.rating}` : 'PLAYER 1',
    });
    setStartError(null);
    router.replace(`/game/cricket/${game.gameId}`);
  }, [bullRule, profile, router, services]);

  const handleStart = useCallback(async () => {
    if (!services) {
      return;
    }

    setIsStarting(true);
    setStartError(null);
    try {
      const activeSession = await services.activeSession.findActiveSession();
      if (activeSession) {
        setConflictSession(activeSession);
        return;
      }
      await startCricket();
    } catch (error) {
      console.warn('CRICKET start failed', error);
      setStartError(genericStartError);
    } finally {
      setIsStarting(false);
    }
  }, [services, startCricket]);

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
      await startCricket();
    } catch (error) {
      console.warn('CRICKET conflict resolution failed', error);
      setStartError(genericStartError);
    } finally {
      setIsConflictProcessing(false);
      setIsStarting(false);
    }
  }, [conflictSession, isConflictProcessing, services, startCricket]);

  const ratingStatus = accountOverview?.ratingProfile.establishedAt ? '候補対象' : '対象外';

  const conflictDialog = (
    <ActiveSessionConflictDialog
      visible={conflictSession !== null}
      activeMode={conflictSession?.mode ?? 'cricket'}
      activeLabel={conflictSession?.label ?? 'STANDARD CRICKET'}
      activeStatus={conflictSession?.status}
      onResume={handleResumeConflict}
      onAbortAndStart={() => void handleAbortConflictAndStart()}
      onCancel={() => setConflictSession(null)}
      isProcessing={isConflictProcessing}
    />
  );

  const bullRuleCard = (
    <Card>
      <SectionTitle title="Bull設定" subtitle="前回のCRICKET設定を初期値にします。" tone="card" />
      <View style={styles.optionList}>
        {bullRuleOptions.map((option) => (
          <ChoiceRow
            key={option.value}
            label={option.label}
            helper={option.helper}
            selected={option.value === bullRule}
            onPress={() => setBullRule(option.value)}
          />
        ))}
      </View>
    </Card>
  );

  if (isDesktopWeb) {
    return (
      <ScreenShell showNav={false}>
        <SectionTitle
          title="STANDARD CRICKET設定"
          subtitle="単独STANDARD CRICKETをDBへ保存しながら開始します。"
        />
        <WebGameSettingsShell
          settings={<View style={webGameSettingsStyles.settingsStack}>{bullRuleCard}</View>}
          summary={
            <WebSettingsSummaryCard
              title="STANDARD CRICKET"
              actions={
                <>
                  <AppButton
                    label={isStarting ? '開始中...' : 'STANDARD CRICKET開始'}
                    onPress={() => void handleStart()}
                    disabled={!isAvailable || isStarting}
                    variant="cricket"
                    style={webGameSettingsStyles.summaryButton}
                  />
                  <AppButton
                    label="戻る"
                    onPress={() => router.replace('/game')}
                    variant="secondary"
                    style={webGameSettingsStyles.summaryButton}
                  />
                </>
              }
            >
              <WebSettingsSummaryRow label="対象" value="20 / 19 / 18 / 17 / 16 / 15 / BULL" />
              <WebSettingsSummaryRow label="最大ラウンド" value="15" />
              <WebSettingsSummaryRow label="0点自然終了" value="なし" />
              <WebSettingsSummaryRow label="Bull" value={getBullRuleLabel(bullRule)} />
              <WebSettingsSummaryRow label="Rating" value={ratingStatus} />
              {startError ? <Text style={styles.startError}>{startError}</Text> : null}
            </WebSettingsSummaryCard>
          }
        />
        {conflictDialog}
      </ScreenShell>
    );
  }

  return (
    <ScreenShell showNav={false}>
      <SectionTitle
        title="STANDARD CRICKET設定"
        subtitle="単独STANDARD CRICKETをDBへ保存しながら開始します。"
      />

      {accountOverview ? (
        <Card muted>
          <SectionTitle
            title="Rating対象"
            subtitle={getRatingSubtitle(accountOverview)}
            tone="card"
          />
          <Text style={styles.ratingStatus}>
            {accountOverview.ratingProfile.establishedAt ? '候補対象' : '対象外'}
          </Text>
        </Card>
      ) : (
        <>
          <AccountLocalNotice />
          <Card muted>
            <SectionTitle
              title="Rating対象外"
              subtitle="ローカルAccount登録後、初回Rating確定済みの単独CRICKETが候補になります。"
              tone="card"
            />
          </Card>
        </>
      )}

      {bullRuleCard}

      {startError ? (
        <Card muted>
          <Text style={styles.startError}>{startError}</Text>
        </Card>
      ) : null}

      <View style={styles.actions}>
        <AppButton
          label={isStarting ? '開始中...' : 'STANDARD CRICKET開始'}
          onPress={() => void handleStart()}
          disabled={!isAvailable || isStarting}
        />
        <AppButton label="戻る" onPress={() => router.replace('/game')} variant="secondary" />
      </View>
      {conflictDialog}
    </ScreenShell>
  );
}

function ChoiceRow({
  label,
  helper,
  selected,
  onPress,
}: {
  label: string;
  helper: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.option,
        selected && styles.optionSelected,
        pressed && styles.pressed,
      ]}
    >
      <Text style={[styles.optionTitle, selected && styles.optionTitleSelected]}>{label}</Text>
      <Text style={styles.optionHelper}>{helper}</Text>
    </Pressable>
  );
}

function getRatingSubtitle(accountOverview: AccountOverview) {
  return accountOverview.ratingProfile.establishedAt
    ? 'この設定で開始する単独CRICKETはRating更新候補として保存されます。'
    : '初回RatingはEligible MATCH 3件で確定します。確定前の単独CRICKETは対象外です。';
}

function getBullRuleLabel(bullRule: BullRule) {
  return bullRuleOptions.find((option) => option.value === bullRule)?.label ?? bullRule;
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
  ratingStatus: {
    marginTop: 12,
    color: colors.text,
    fontSize: 16,
    fontWeight: '900',
  },
  pressed: {
    opacity: 0.72,
  },
});
