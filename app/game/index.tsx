import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AppButton } from '../../components/AppButton';
import { Card } from '../../components/Card';
import { ScreenShell } from '../../components/ScreenShell';
import { SectionTitle } from '../../components/SectionTitle';
import { colors } from '../../constants/theme';
import { useGameDatabase } from '../../contexts/GameDatabaseContext';
import type { CountUpGameState } from '../../features/game/domain/countUp';

export default function GameHubScreen() {
  const router = useRouter();
  const { services, isAvailable } = useGameDatabase();
  const [activeGame, setActiveGame] = useState<CountUpGameState | null>(null);
  const [recentResults, setRecentResults] = useState<CountUpGameState[]>([]);

  const loadGames = useCallback(async () => {
    if (!services) {
      return;
    }

    const [active, recent] = await Promise.all([
      services.countUp.getActiveGame(),
      services.countUp.listRecentResults(5),
    ]);
    setActiveGame(active);
    setRecentResults(recent);
  }, [services]);

  useFocusEffect(
    useCallback(() => {
      void loadGames();
    }, [loadGames]),
  );

  return (
    <ScreenShell>
      <SectionTitle
        title="ゲーム"
        subtitle="Phase 2ではCOUNT-UPの開始、再開、結果確認に対応しています。"
      />

      {activeGame ? (
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push(`/game/count-up/${activeGame.gameId}`)}
          style={({ pressed }) => pressed && styles.pressed}
        >
          <Card muted>
            <SectionTitle
              title={activeGame.status === 'paused' ? '一時停止中のCOUNT-UP' : '進行中のCOUNT-UP'}
              subtitle={`Round ${activeGame.currentRoundNo} / 8、現在 ${activeGame.totalScore} 点`}
              tone="card"
            />
            <View style={styles.cardAction}>
              <AppButton
                label={activeGame.status === 'paused' ? '再開する' : 'ゲームへ戻る'}
                onPress={() => router.push(`/game/count-up/${activeGame.gameId}`)}
              />
            </View>
          </Card>
        </Pressable>
      ) : null}

      <Card>
        <SectionTitle title="ゲームモード" subtitle="まずはCOUNT-UPを記録できます。" tone="card" />
        <View style={styles.modeList}>
          <AppButton
            label="COUNT-UPを始める"
            onPress={() => router.push('/game/count-up/settings')}
            disabled={!isAvailable}
          />
          <View style={styles.disabledMode}>
            <Text style={styles.disabledModeTitle}>01 GAME</Text>
            <Text style={styles.disabledModeText}>Phase 3以降で実装予定</Text>
          </View>
          <View style={styles.disabledMode}>
            <Text style={styles.disabledModeTitle}>CRICKET</Text>
            <Text style={styles.disabledModeText}>Phase 3以降で実装予定</Text>
          </View>
        </View>
      </Card>

      <Card>
        <SectionTitle title="最近のCOUNT-UP" subtitle="完了済みゲームを表示します。" tone="card" />
        {recentResults.length > 0 ? (
          <View style={styles.resultList}>
            {recentResults.map((game) => (
              <Pressable
                key={game.gameId}
                accessibilityRole="button"
                onPress={() => router.push(`/game/count-up/${game.gameId}/result`)}
                style={({ pressed }) => [styles.resultRow, pressed && styles.pressed]}
              >
                <Text style={styles.resultScore}>
                  {game.result?.totalScore ?? game.totalScore} 点
                </Text>
                <Text style={styles.resultMeta}>
                  Bull {game.result?.bullCount ?? 0} / {game.bullRule}
                </Text>
              </Pressable>
            ))}
          </View>
        ) : (
          <Text style={styles.emptyText}>まだ完了したCOUNT-UPはありません。</Text>
        )}
      </Card>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  cardAction: {
    marginTop: 14,
  },
  modeList: {
    gap: 10,
    marginTop: 14,
  },
  disabledMode: {
    minHeight: 58,
    justifyContent: 'center',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 14,
    backgroundColor: colors.surfaceMuted,
  },
  disabledModeTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '900',
  },
  disabledModeText: {
    marginTop: 3,
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '700',
  },
  resultList: {
    gap: 8,
    marginTop: 12,
  },
  resultRow: {
    minHeight: 56,
    justifyContent: 'center',
    borderRadius: 8,
    paddingHorizontal: 12,
    backgroundColor: colors.surfaceMuted,
  },
  resultScore: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '900',
  },
  resultMeta: {
    marginTop: 2,
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '700',
  },
  emptyText: {
    marginTop: 12,
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 20,
  },
  pressed: {
    opacity: 0.72,
  },
});
