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
import { ZeroOneActiveGameExistsError } from '../../../features/game/application/services';
import type { ZeroOneOutRule, ZeroOneStartScore } from '../../../features/game/domain/zeroOne';
import type { BullRule } from '../../../features/game/domain/types';

const startScoreOptions: ZeroOneStartScore[] = [301, 501, 701, 901];
const outRuleOptions: { value: ZeroOneOutRule; label: string; helper: string }[] = [
  { value: 'single_out', label: 'Single Out', helper: '残り0点で上がり。最後のエリア制限なし。' },
  {
    value: 'master_out',
    label: 'Master Out',
    helper: 'Double / Triple / Bullで残り0点になった場合のみ上がり。',
  },
];
const bullRuleOptions: { value: BullRule; label: string; helper: string }[] = [
  { value: 'fat_bull', label: 'Fat Bull', helper: 'Outer Bull / Inner Bull ともに50点' },
  { value: 'separate_bull', label: 'Separate Bull', helper: 'Outer Bull 25点、Inner Bull 50点' },
];

export default function ZeroOneSettingsScreen() {
  const router = useRouter();
  const { activeAccountId, profile } = useAppState();
  const { services, isAvailable } = useGameDatabase();
  const isDesktopWeb = useDesktopWebLayout();
  const [startScore, setStartScore] = useState<ZeroOneStartScore>(501);
  const [outRule, setOutRule] = useState<ZeroOneOutRule>('single_out');
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
          services.zeroOne.getLastSettings(),
          services.account.getActiveAccount(activeAccountId),
        ]);
        if (mounted) {
          setStartScore(settings.startScore);
          setOutRule(settings.outRule);
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

  const startZeroOne = useCallback(async () => {
    if (!services) {
      return;
    }

    const game = await services.zeroOne.startGame({
      startScore,
      outRule,
      bullRule,
      ownerName: profile ? `RT ${profile.rating}` : 'PLAYER 1',
    });
    router.replace(`/game/01/${game.gameId}`);
  }, [bullRule, outRule, profile, router, services, startScore]);

  const handleStart = useCallback(async () => {
    if (!services) {
      return;
    }

    setIsStarting(true);
    try {
      await startZeroOne();
    } catch (error) {
      if (error instanceof ZeroOneActiveGameExistsError) {
        const [activeZeroOne, activeCountUp] = await Promise.all([
          services.zeroOne.getActiveGame(),
          services.countUp.getActiveGame(),
        ]);
        const activeRoute = activeZeroOne
          ? `/game/01/${activeZeroOne.gameId}`
          : activeCountUp
            ? `/game/count-up/${activeCountUp.gameId}`
            : '/game';

        Alert.alert('進行中のゲームがあります', '再開するか、途中終了して01設定を続けられます。', [
          { text: 'キャンセル', style: 'cancel' },
          {
            text: '再開する',
            onPress: () => router.replace(activeRoute),
          },
          {
            text: '途中終了して新規設定へ',
            style: 'destructive',
            onPress: () => {
              void (async () => {
                try {
                  if (activeZeroOne) {
                    await services.zeroOne.abortGame(activeZeroOne.gameId);
                  } else if (activeCountUp) {
                    await services.countUp.abortGame(activeCountUp.gameId);
                  }
                  await startZeroOne();
                } catch (nextError) {
                  Alert.alert('01を開始できませんでした', getErrorMessage(nextError));
                }
              })();
            },
          },
        ]);
        return;
      }
      Alert.alert('01を開始できませんでした', getErrorMessage(error));
    } finally {
      setIsStarting(false);
    }
  }, [router, services, startZeroOne]);

  return (
    <ScreenShell showNav={false}>
      <SectionTitle title="01 GAME設定" subtitle="単独01をDBへ保存しながら開始します。" />

      {accountOverview ? (
        <Card muted>
          <SectionTitle
            title="Rating対象"
            subtitle={getZeroOneRatingSubtitle(accountOverview)}
            tone="card"
          />
          <Text style={styles.ratingStatus}>{getZeroOneRatingStatus(accountOverview)}</Text>
        </Card>
      ) : (
        <>
          <AccountLocalNotice />
          <Card muted>
            <SectionTitle
              title="Rating対象外"
              subtitle="ローカルAccount登録後、初回Rating確定済みの単独01が候補になります。"
              tone="card"
            />
          </Card>
        </>
      )}

      <Card>
        <SectionTitle title="開始点" subtitle="301 / 501 / 701 / 901から選択します。" tone="card" />
        <View style={styles.segmented}>
          {startScoreOptions.map((option) => (
            <OptionButton
              key={option}
              label={`${option}`}
              selected={option === startScore}
              onPress={() => setStartScore(option)}
            />
          ))}
        </View>
      </Card>

      <Card>
        <SectionTitle title="Out設定" subtitle="DOUBLE OUTはPhase 3では扱いません。" tone="card" />
        <View style={styles.optionList}>
          {outRuleOptions.map((option) => (
            <ChoiceRow
              key={option.value}
              label={option.label}
              helper={option.helper}
              selected={option.value === outRule}
              onPress={() => setOutRule(option.value)}
            />
          ))}
        </View>
      </Card>

      <Card>
        <SectionTitle title="Bull設定" subtitle="前回の01設定を初期値にします。" tone="card" />
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
          label={isStarting ? '開始中...' : '01 GAME開始'}
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

function OptionButton({
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
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.scoreOption,
        selected && styles.optionSelected,
        pressed && styles.pressed,
      ]}
    >
      <Text style={[styles.scoreOptionText, selected && styles.optionTitleSelected]}>{label}</Text>
    </Pressable>
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

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : '不明なエラーです。';
}

const styles = StyleSheet.create({
  segmented: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 14,
  },
  scoreOption: {
    width: '48%',
    minHeight: 58,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceMuted,
  },
  scoreOptionText: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '900',
  },
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

function getZeroOneRatingSubtitle(accountOverview: AccountOverview) {
  return accountOverview.ratingProfile.establishedAt
    ? 'この設定で開始する単独01はRating更新候補として保存されます。'
    : '初回RatingはEligible MATCH 3件で確定します。確定前の単独01は対象外です。';
}

function getZeroOneRatingStatus(accountOverview: AccountOverview) {
  return accountOverview.ratingProfile.establishedAt ? '候補対象' : '対象外';
}
