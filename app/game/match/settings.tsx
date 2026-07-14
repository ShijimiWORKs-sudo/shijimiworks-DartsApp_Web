import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

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
import { MatchActiveExistsError } from '../../../features/game/application/services';
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
    try {
      await startMatch();
    } catch (error) {
      if (error instanceof MatchActiveExistsError) {
        Alert.alert('進行中のMATCHがあります', '既存MATCHを再開してください。', [
          { text: 'キャンセル', style: 'cancel' },
          {
            text: '再開する',
            onPress: () => router.replace(`/game/match/${error.matchId}`),
          },
        ]);
        return;
      }
      Alert.alert('MATCHを開始できませんでした', getErrorMessage(error));
    } finally {
      setIsStarting(false);
    }
  }, [router, services, startMatch]);

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

      <Card>
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

      <Card>
        <SectionTitle title="相手Player" tone="card" />
        <TextInput
          value={guestName}
          onChangeText={setGuestName}
          placeholder="GUEST 1"
          placeholderTextColor={colors.textMuted}
          style={styles.input}
        />
      </Card>

      <Card>
        <SectionTitle title="GAME1先攻" tone="card" />
        <View style={styles.segmented}>
          <OptionButton
            label="PLAYER 1"
            selected={game1FirstThrow === 'owner'}
            onPress={() => setGame1FirstThrow('owner')}
          />
          <OptionButton
            label={guestName.trim() || 'GUEST 1'}
            selected={game1FirstThrow === 'guest'}
            onPress={() => setGame1FirstThrow('guest')}
          />
        </View>
        <Text style={styles.note}>GAME2はGAME1と逆のプレイヤーが先攻です。</Text>
      </Card>

      <Card>
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

      <View style={[styles.actions, isDesktopWeb && webGameStyles.desktopFooterActions]}>
        <AppButton
          label={isStarting ? '開始中...' : 'MATCH開始'}
          onPress={() => void handleStart()}
          disabled={!isAvailable || isStarting}
          variant="match"
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

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : '不明なエラーです。';
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
  actions: {
    gap: 10,
  },
  pressed: {
    opacity: 0.72,
  },
});
