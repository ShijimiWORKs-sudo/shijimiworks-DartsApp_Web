import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

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
import type { MatchZeroOneStartScore } from '../../../features/game/domain/match';
import type { BullRule } from '../../../features/game/domain/types';
import type { ZeroOneOutRule } from '../../../features/game/domain/zeroOne';

const startScoreOptions: MatchZeroOneStartScore[] = [501, 701];
const outRuleOptions: { value: Exclude<ZeroOneOutRule, 'double_out'>; label: string }[] = [
  { value: 'single_out', label: 'Single Out' },
  { value: 'master_out', label: 'Master Out' },
];
const bullRuleOptions: { value: BullRule; label: string }[] = [
  { value: 'fat_bull', label: 'Fat Bull' },
  { value: 'separate_bull', label: 'Separate Bull' },
];
const genericStartError =
  'ゲームを開始できませんでした。進行中のゲームを確認して、もう一度お試しください。';

export default function MatchSettingsScreen() {
  const router = useRouter();
  const { activeAccountId, profile } = useAppState();
  const { services, repositories, isAvailable } = useGameDatabase();
  const isDesktopWeb = useDesktopWebLayout();
  const [zeroOneStartScore, setZeroOneStartScore] = useState<MatchZeroOneStartScore>(501);
  const [outRule, setOutRule] = useState<Exclude<ZeroOneOutRule, 'double_out'>>('single_out');
  const [bullRule, setBullRule] = useState<BullRule>('fat_bull');
  const [guestName, setGuestName] = useState('GUEST 1');
  const [game1FirstThrow, setGame1FirstThrow] = useState<'owner' | 'guest'>('owner');
  const [accountOverview, setAccountOverview] = useState<AccountOverview | null>(null);
  const [conflictSession, setConflictSession] = useState<ActiveSessionInfo | null>(null);
  const [startError, setStartError] = useState<string | null>(null);
  const [isConflictProcessing, setIsConflictProcessing] = useState(false);
  const [isStarting, setIsStarting] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let mounted = true;

      async function loadDefault() {
        if (!services) return;
        const [settings, account] = await Promise.all([
          services.match.getLastSettings(),
          services.account.getActiveAccount(activeAccountId),
        ]);
        if (mounted) {
          setZeroOneStartScore(settings.zeroOneStartScore);
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

  const startMatch = useCallback(async () => {
    if (!services || !repositories) return;

    const owner = await repositories.players.getOrCreateOwner({
      displayName: profile ? `RT ${profile.rating}` : 'PLAYER 1',
    });
    const guest = await repositories.players.createGuest({
      displayName: guestName.trim() || 'GUEST 1',
    });
    const game1FirstThrowPlayerId = game1FirstThrow === 'owner' ? owner.id : guest.id;

    const match = await services.match.startMatch({
      zeroOneStartScore,
      outRule,
      bullRule,
      player1Id: owner.id,
      player2Id: guest.id,
      game1FirstThrowPlayerId,
    });
    setStartError(null);
    router.replace(`/game/match/${match.matchId}`);
  }, [
    bullRule,
    game1FirstThrow,
    guestName,
    outRule,
    profile,
    repositories,
    router,
    services,
    zeroOneStartScore,
  ]);

  const handleStart = useCallback(async () => {
    if (!services) return;
    setIsStarting(true);
    setStartError(null);
    try {
      const activeSession = await services.activeSession.findActiveSession();
      if (activeSession) {
        setConflictSession(activeSession);
        return;
      }
      await startMatch();
    } catch (error) {
      console.warn('MATCH start failed', error);
      setStartError(genericStartError);
    } finally {
      setIsStarting(false);
    }
  }, [services, startMatch]);

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
      await startMatch();
    } catch (error) {
      console.warn('MATCH conflict resolution failed', error);
      setStartError(genericStartError);
    } finally {
      setIsConflictProcessing(false);
      setIsStarting(false);
    }
  }, [conflictSession, isConflictProcessing, services, startMatch]);

  const guestDisplayName = guestName.trim() || 'GUEST 1';
  const game1FirstThrowLabel = game1FirstThrow === 'owner' ? 'PLAYER 1' : guestDisplayName;
  const ratingStatus = accountOverview ? 'OWNER Playerのみ候補' : '対象外';

  const conflictDialog = (
    <ActiveSessionConflictDialog
      visible={conflictSession !== null}
      activeMode={conflictSession?.mode ?? 'match'}
      activeLabel={conflictSession?.label ?? 'MATCH'}
      activeStatus={conflictSession?.status}
      onResume={handleResumeConflict}
      onAbortAndStart={() => void handleAbortConflictAndStart()}
      onCancel={() => setConflictSession(null)}
      isProcessing={isConflictProcessing}
    />
  );

  const gameOneCard = (
    <Card style={isDesktopWeb && webGameSettingsStyles.settingsGridCard}>
      <SectionTitle title="GAME1 / CHOICE 01" subtitle="開始点は501または701です。" tone="card" />
      <View style={styles.segmented}>
        {startScoreOptions.map((option) => (
          <OptionButton
            key={option}
            label={`${option}`}
            selected={option === zeroOneStartScore}
            onPress={() => setZeroOneStartScore(option)}
          />
        ))}
      </View>
    </Card>
  );

  const guestCard = (
    <Card style={isDesktopWeb && webGameSettingsStyles.settingsGridCard}>
      <SectionTitle title="相手Player" tone="card" />
      <TextInput
        value={guestName}
        onChangeText={setGuestName}
        placeholder="GUEST 1"
        placeholderTextColor={colors.textMuted}
        style={styles.input}
      />
    </Card>
  );

  const firstThrowCard = (
    <Card style={isDesktopWeb && webGameSettingsStyles.settingsGridCard}>
      <SectionTitle title="GAME1先攻" tone="card" />
      <View style={styles.segmented}>
        <OptionButton
          label="PLAYER 1"
          selected={game1FirstThrow === 'owner'}
          onPress={() => setGame1FirstThrow('owner')}
        />
        <OptionButton
          label={guestDisplayName}
          selected={game1FirstThrow === 'guest'}
          onPress={() => setGame1FirstThrow('guest')}
        />
      </View>
      <Text style={styles.note}>GAME2はGAME1と逆のプレイヤーが先攻です。</Text>
    </Card>
  );

  const outBullCard = (
    <Card style={isDesktopWeb && webGameSettingsStyles.settingsGridCard}>
      <SectionTitle title="Out / Bull" tone="card" />
      <View style={styles.optionList}>
        {outRuleOptions.map((option) => (
          <ChoiceRow
            key={option.value}
            label={option.label}
            selected={outRule === option.value}
            onPress={() => setOutRule(option.value)}
          />
        ))}
        {bullRuleOptions.map((option) => (
          <ChoiceRow
            key={option.value}
            label={option.label}
            selected={bullRule === option.value}
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
          title="MATCH設定"
          subtitle="GAME1は01、GAME2はSTANDARD CRICKET、1-1時のみCHOICEへ進みます。"
        />
        <WebGameSettingsShell
          settings={
            <View style={webGameSettingsStyles.settingsGrid}>
              {gameOneCard}
              {guestCard}
              {firstThrowCard}
              {outBullCard}
            </View>
          }
          summary={
            <WebSettingsSummaryCard
              title="MATCH"
              actions={
                <>
                  <AppButton
                    label={isStarting ? '開始中...' : 'MATCH開始'}
                    onPress={() => void handleStart()}
                    disabled={!isAvailable || isStarting}
                    variant="match"
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
              <WebSettingsSummaryRow label="対戦" value={`PLAYER 1 vs ${guestDisplayName}`} />
              <WebSettingsSummaryRow label="GAME1" value={`${zeroOneStartScore}`} />
              <WebSettingsSummaryRow label="GAME2" value="STANDARD CRICKET" />
              <WebSettingsSummaryRow label="Out" value={getOutRuleLabel(outRule)} />
              <WebSettingsSummaryRow label="Bull" value={getBullRuleLabel(bullRule)} />
              <WebSettingsSummaryRow label="GAME1先攻" value={game1FirstThrowLabel} />
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
        title="MATCH設定"
        subtitle="GAME1は01、GAME2はSTANDARD CRICKET、1-1時のみCHOICEへ進みます。"
      />

      {accountOverview ? (
        <Card muted>
          <SectionTitle
            title="Rating候補"
            subtitle="MATCHは初回Rating確定前でも候補として保存されます。計算本体は未実装です。"
            tone="card"
          />
          <Text style={styles.ratingStatus}>OWNER Playerのみ評価候補</Text>
        </Card>
      ) : (
        <>
          <AccountLocalNotice />
          <Card muted>
            <SectionTitle
              title="Rating候補外"
              subtitle="ローカルAccount登録後、OWNER PlayerのMATCHが候補として保存されます。"
              tone="card"
            />
          </Card>
        </>
      )}

      {gameOneCard}

      {guestCard}

      {firstThrowCard}

      {outBullCard}

      {startError ? (
        <Card muted>
          <Text style={styles.startError}>{startError}</Text>
        </Card>
      ) : null}

      <View style={styles.actions}>
        <AppButton
          label={isStarting ? '開始中...' : 'MATCH開始'}
          onPress={() => void handleStart()}
          disabled={!isAvailable || isStarting}
          variant="match"
        />
        <AppButton label="戻る" onPress={() => router.replace('/game')} variant="secondary" />
      </View>
      {conflictDialog}
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
        styles.option,
        selected && styles.optionSelected,
        pressed && styles.pressed,
      ]}
    >
      <Text style={[styles.optionTitle, selected && styles.optionTitleSelected]}>{label}</Text>
    </Pressable>
  );
}

function ChoiceRow({
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
        styles.choiceRow,
        selected && styles.optionSelected,
        pressed && styles.pressed,
      ]}
    >
      <Text style={[styles.optionTitle, selected && styles.optionTitleSelected]}>{label}</Text>
    </Pressable>
  );
}

function getOutRuleLabel(outRule: Exclude<ZeroOneOutRule, 'double_out'>) {
  return outRuleOptions.find((option) => option.value === outRule)?.label ?? outRule;
}

function getBullRuleLabel(bullRule: BullRule) {
  return bullRuleOptions.find((option) => option.value === bullRule)?.label ?? bullRule;
}

const styles = StyleSheet.create({
  segmented: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 14,
  },
  optionList: {
    gap: 10,
    marginTop: 14,
  },
  option: {
    minHeight: 46,
    minWidth: 108,
    justifyContent: 'center',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 14,
    backgroundColor: colors.surfaceMuted,
  },
  choiceRow: {
    minHeight: 52,
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
  optionTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '900',
    textAlign: 'center',
  },
  optionTitleSelected: {
    color: colors.primaryDark,
  },
  input: {
    marginTop: 14,
    minHeight: 52,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 14,
    color: colors.text,
    fontSize: 18,
    fontWeight: '800',
    backgroundColor: colors.background,
  },
  note: {
    marginTop: 10,
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 18,
  },
  ratingStatus: {
    marginTop: 12,
    color: colors.text,
    fontSize: 16,
    fontWeight: '900',
  },
  startError: {
    color: colors.danger,
    fontSize: 14,
    fontWeight: '800',
    lineHeight: 20,
  },
  actions: {
    gap: 10,
  },
  pressed: {
    opacity: 0.72,
  },
});
