import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';

import { AppButton } from '../../../../components/AppButton';
import { Card } from '../../../../components/Card';
import { ScreenShell } from '../../../../components/ScreenShell';
import { SectionTitle } from '../../../../components/SectionTitle';
import { useDesktopWebLayout } from '../../../../components/web/useDesktopWebLayout';
import { webGameStyles } from '../../../../components/web/WebGameShell';
import { colors } from '../../../../constants/theme';
import { useGameDatabase } from '../../../../contexts/GameDatabaseContext';
import type { MatchGameMode, MatchState } from '../../../../features/game/domain/match';

export default function MatchChoiceScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ matchId: string }>();
  const matchId = Array.isArray(params.matchId) ? params.matchId[0] : params.matchId;
  const { services } = useGameDatabase();
  const isDesktopWeb = useDesktopWebLayout();
  const [match, setMatch] = useState<MatchState | null>(null);
  const [mode, setMode] = useState<MatchGameMode>('zero_one');
  const [selectedByPlayerId, setSelectedByPlayerId] = useState<string | null>(null);
  const [firstThrowPlayerId, setFirstThrowPlayerId] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let mounted = true;

      async function loadMatch() {
        if (!services || !matchId) return;
        try {
          const nextMatch = await services.match.loadMatch(matchId);
          if (nextMatch.phase !== 'choice_required') {
            router.replace(`/game/match/${nextMatch.matchId}`);
            return;
          }
          if (mounted) {
            setMatch(nextMatch);
            setSelectedByPlayerId(nextMatch.players[0]?.playerId ?? null);
            setFirstThrowPlayerId(nextMatch.players[0]?.playerId ?? null);
          }
        } catch {
          router.replace('/game');
        }
      }

      void loadMatch();
      return () => {
        mounted = false;
      };
    }, [matchId, router, services]),
  );

  const handleChoice = useCallback(async () => {
    if (!services || !match || !selectedByPlayerId || !firstThrowPlayerId) return;
    setIsBusy(true);
    try {
      const nextMatch = await services.match.chooseFinalGame(match.matchId, {
        selectedByPlayerId,
        mode,
        firstThrowPlayerId,
      });
      router.replace(`/game/match/${nextMatch.matchId}`);
    } catch (error) {
      Alert.alert('CHOICEを保存できませんでした', getErrorMessage(error));
    } finally {
      setIsBusy(false);
    }
  }, [firstThrowPlayerId, match, mode, router, selectedByPlayerId, services]);

  if (!match) {
    return (
      <ScreenShell showNav={false}>
        <SectionTitle title="CHOICEを読み込み中" />
      </ScreenShell>
    );
  }

  return (
    <ScreenShell showNav={false}>
      <SectionTitle
        title="GAME 3 CHOICE"
        subtitle="1勝1敗のため、種目と先攻を選択します。01はGAME1と同じ開始点です。"
      />

      <Card>
        <SectionTitle title="CHOICEするPlayer" tone="card" />
        <View style={styles.optionList}>
          {match.players.map((player) => (
            <ChoiceRow
              key={player.playerId}
              label={player.displayName}
              selected={selectedByPlayerId === player.playerId}
              onPress={() => setSelectedByPlayerId(player.playerId)}
            />
          ))}
        </View>
      </Card>

      <Card>
        <SectionTitle title="GAME 3種目" tone="card" />
        <View style={styles.optionList}>
          <ChoiceRow
            label={`${match.zeroOneStartScore} GAME`}
            selected={mode === 'zero_one'}
            onPress={() => setMode('zero_one')}
          />
          <ChoiceRow
            label="STANDARD CRICKET"
            selected={mode === 'cricket'}
            onPress={() => setMode('cricket')}
          />
        </View>
      </Card>

      <Card>
        <SectionTitle title="GAME 3先攻" tone="card" />
        <View style={styles.optionList}>
          {match.players.map((player) => (
            <ChoiceRow
              key={player.playerId}
              label={player.displayName}
              selected={firstThrowPlayerId === player.playerId}
              onPress={() => setFirstThrowPlayerId(player.playerId)}
            />
          ))}
        </View>
      </Card>

      <View style={[styles.actions, isDesktopWeb && webGameStyles.desktopFooterActions]}>
        <AppButton
          label="GAME 3開始"
          onPress={() => void handleChoice()}
          disabled={isBusy}
          variant="match"
          style={isDesktopWeb && webGameStyles.desktopFooterButton}
        />
        <AppButton
          label="MATCHへ戻る"
          onPress={() => router.replace(`/game/match/${match.matchId}`)}
          variant="secondary"
          style={isDesktopWeb && webGameStyles.desktopFooterButton}
        />
      </View>
    </ScreenShell>
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
        styles.option,
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
  optionList: {
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
  optionTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '900',
  },
  optionTitleSelected: {
    color: colors.primaryDark,
  },
  actions: {
    gap: 10,
  },
  pressed: {
    opacity: 0.72,
  },
});
