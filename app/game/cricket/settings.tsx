import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';

import { AppButton } from '../../../components/AppButton';
import { Card } from '../../../components/Card';
import { AccountLocalNotice } from '../../../components/account/AccountLocalNotice';
import { ScreenShell } from '../../../components/ScreenShell';
import { SectionTitle } from '../../../components/SectionTitle';
import { useDesktopWebLayout } from '../../../components/web/useDesktopWebLayout';
import { webGameStyles } from '../../../components/web/WebGameShell';
import { colors } from '../../../constants/theme';
import { useAppState } from '../../../contexts/AppStateContext';
import { useGameDatabase } from '../../../contexts/GameDatabaseContext';
import type { AccountOverview } from '../../../features/account/domain';
import { CricketActiveGameExistsError } from '../../../features/game/application/services';
import type { BullRule } from '../../../features/game/domain/types';

const bullRuleOptions: { value: BullRule; label: string; helper: string }[] = [
  { value: 'fat_bull', label: 'Fat Bull', helper: 'Outer Bull / Inner Bull ともに2マーク' },
  {
    value: 'separate_bull',
    label: 'Separate Bull',
    helper: 'Outer Bull 1マーク、Inner Bull 2マーク',
  },
];

export default function CricketSettingsScreen() {
  const router = useRouter();
  const { activeAccountId, profile } = useAppState();
  const { services, isAvailable } = useGameDatabase();
  const isDesktopWeb = useDesktopWebLayout();
  const [bullRule, setBullRule] = useState<BullRule>('fat_bull');
  const [accountOverview, setAccountOverview] = useState<AccountOverview | null>(null);
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
    router.replace(`/game/cricket/${game.gameId}`);
  }, [bullRule, profile, router, services]);

  const handleStart = useCallback(async () => {
    if (!services) {
      return;
    }

    setIsStarting(true);
    try {
      await startCricket();
    } catch (error) {
      if (error instanceof CricketActiveGameExistsError) {
        const [activeCricket, activeZeroOne, activeCountUp] = await Promise.all([
          services.cricket.getActiveGame(),
          services.zeroOne.getActiveGame(),
          services.countUp.getActiveGame(),
        ]);
        const activeRoute = activeCricket
          ? `/game/cricket/${activeCricket.gameId}`
          : activeZeroOne
            ? `/game/01/${activeZeroOne.gameId}`
            : activeCountUp
              ? `/game/count-up/${activeCountUp.gameId}`
              : '/game';

        Alert.alert(
          '進行中のゲームがあります',
          '再開するか、途中終了してCRICKET設定を続けられます。',
          [
            { text: 'キャンセル', style: 'cancel' },
            { text: '再開する', onPress: () => router.replace(activeRoute) },
            {
              text: '途中終了して新規設定へ',
              style: 'destructive',
              onPress: () => {
                void (async () => {
                  try {
                    if (activeCricket) {
                      await services.cricket.abortGame(activeCricket.gameId);
                    } else if (activeZeroOne) {
                      await services.zeroOne.abortGame(activeZeroOne.gameId);
                    } else if (activeCountUp) {
                      await services.countUp.abortGame(activeCountUp.gameId);
                    }
                    await startCricket();
                  } catch (nextError) {
                    Alert.alert('CRICKETを開始できませんでした', getErrorMessage(nextError));
                  }
                })();
              },
            },
          ],
        );
        return;
      }
      Alert.alert('CRICKETを開始できませんでした', getErrorMessage(error));
    } finally {
      setIsStarting(false);
    }
  }, [router, services, startCricket]);

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

      <View style={[styles.actions, isDesktopWeb && webGameStyles.desktopFooterActions]}>
        <AppButton
          label={isStarting ? '開始中...' : 'STANDARD CRICKET開始'}
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
