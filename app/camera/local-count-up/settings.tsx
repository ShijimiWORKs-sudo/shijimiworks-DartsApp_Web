import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { AppButton } from '../../../components/AppButton';
import { Card } from '../../../components/Card';
import { ScreenShell } from '../../../components/ScreenShell';
import { SectionTitle } from '../../../components/SectionTitle';
import { colors } from '../../../constants/theme';
import { useGameDatabase } from '../../../contexts/GameDatabaseContext';
import { CameraLocalCountUpAdapter } from '../../../features/camera/detection/application/CameraLocalCountUpAdapter';
import type { ActiveSessionInfo, GameServices } from '../../../features/game/application/services';
import type { MatchGameState } from '../../../features/game/domain/match';
import type { BullRule } from '../../../features/game/domain/types';

const bullRuleOptions: { value: BullRule; label: string }[] = [
  { value: 'fat_bull', label: 'Fat Bull' },
  { value: 'separate_bull', label: 'Separate Bull' },
];
const cameraPlayerName = 'CAMERA PLAYER';

type CameraActiveSessionSummary = {
  session: ActiveSessionInfo;
  modeLabel: string;
  roundLabel: string;
  currentScoreLabel: string;
  startedAtLabel: string;
  resumeRoute: string;
};

export default function CameraLocalCountUpSettingsScreen() {
  const router = useRouter();
  const { services, isAvailable } = useGameDatabase();
  const [bullRule, setBullRule] = useState<BullRule>('fat_bull');
  const [autoDetection, setAutoDetection] = useState(true);
  const [awardsEnabled, setAwardsEnabled] = useState(true);
  const [isStarting, setIsStarting] = useState(false);
  const [activeSessionSummary, setActiveSessionSummary] =
    useState<CameraActiveSessionSummary | null>(null);
  const [isAbortDialogVisible, setIsAbortDialogVisible] = useState(false);
  const [isAbortProcessing, setIsAbortProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const refreshActiveSession = useCallback(async () => {
    if (!services) {
      return;
    }

    const activeSession = await services.activeSession.findActiveSession();
    setActiveSessionSummary(
      activeSession ? await buildCameraActiveSessionSummary(services, activeSession) : null,
    );
  }, [services]);

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
        await refreshActiveSession();
      }
      void loadDefault();
      return () => {
        mounted = false;
      };
    }, [refreshActiveSession, services]),
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
        setActiveSessionSummary(await buildCameraActiveSessionSummary(services, activeSession));
        return;
      }
      const game = await adapter.startGame({ bullRule, ownerName: cameraPlayerName });
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

  const resumeActiveSession = useCallback(() => {
    if (!activeSessionSummary || isAbortProcessing) {
      return;
    }
    router.replace(activeSessionSummary.resumeRoute);
  }, [activeSessionSummary, isAbortProcessing, router]);

  const confirmAbortActiveSession = useCallback(async () => {
    if (!services || !activeSessionSummary || isAbortProcessing) {
      return;
    }

    setIsAbortProcessing(true);
    setErrorMessage(null);
    try {
      await services.activeSession.abortActiveSession(activeSessionSummary.session);
      setIsAbortDialogVisible(false);
      setActiveSessionSummary(null);
      await refreshActiveSession();
    } catch (error) {
      console.warn('Camera COUNT-UP active session abort failed', error);
      setErrorMessage('進行中ゲームを終了できませんでした。少し待ってからもう一度お試しください。');
    } finally {
      setIsAbortProcessing(false);
    }
  }, [activeSessionSummary, isAbortProcessing, refreshActiveSession, services]);

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

      {activeSessionSummary ? (
        <Card>
          <SectionTitle
            title="進行中ゲームがあります"
            subtitle="再開するか、確認後に途中終了してから新しいカメラCOUNT-UPを開始できます。"
            tone="card"
          />
          <View style={styles.infoList}>
            <InfoRow label="ゲームモード" value={activeSessionSummary.modeLabel} />
            <InfoRow label="Round" value={activeSessionSummary.roundLabel} />
            <InfoRow label="現在点" value={activeSessionSummary.currentScoreLabel} />
            <InfoRow label="開始日時" value={activeSessionSummary.startedAtLabel} />
          </View>
          <View style={styles.conflictActions}>
            <AppButton
              label="進行中ゲームを再開"
              onPress={resumeActiveSession}
              disabled={isAbortProcessing}
            />
            <AppButton
              label="進行中ゲームを終了"
              onPress={() => setIsAbortDialogVisible(true)}
              disabled={isAbortProcessing}
              variant="danger"
            />
            <AppButton
              label="ゲームハブを開く"
              onPress={() => router.replace('/game')}
              disabled={isAbortProcessing}
              variant="secondary"
            />
          </View>
        </Card>
      ) : null}

      <View style={styles.actions}>
        <AppButton
          label={isStarting ? '開始中...' : 'COUNT-UP開始'}
          onPress={() => void startGame()}
          disabled={!isAvailable || isStarting || activeSessionSummary !== null}
        />
        <AppButton
          label="戻る"
          onPress={() => router.replace('/camera/home')}
          variant="secondary"
        />
        <AppButton
          label="キャリブレーション"
          onPress={() => router.push('/camera/calibration')}
          variant="secondary"
        />
      </View>
      <Modal
        transparent
        visible={isAbortDialogVisible}
        animationType="fade"
        onRequestClose={() => {
          if (!isAbortProcessing) {
            setIsAbortDialogVisible(false);
          }
        }}
        statusBarTranslucent
      >
        <View style={styles.modalBackdrop}>
          <View accessibilityRole="alert" style={styles.modalCard}>
            <Text style={styles.modalTitle}>進行中ゲームを終了しますか？</Text>
            <Text style={styles.modalMessage}>
              確定するまでDBのstatusは変更しません。途中終了として保存すると、新しいカメラCOUNT-UPを開始できます。
            </Text>
            <View style={styles.conflictActions}>
              <AppButton
                label={isAbortProcessing ? '終了中...' : '途中終了を確定'}
                onPress={() => void confirmAbortActiveSession()}
                disabled={isAbortProcessing}
                variant="danger"
              />
              <AppButton
                label="キャンセル"
                onPress={() => setIsAbortDialogVisible(false)}
                disabled={isAbortProcessing}
                variant="secondary"
              />
            </View>
          </View>
        </View>
      </Modal>
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

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

async function buildCameraActiveSessionSummary(
  services: GameServices,
  session: ActiveSessionInfo,
): Promise<CameraActiveSessionSummary> {
  if (session.mode === 'count_up') {
    const game = await services.countUp.loadGame(session.id);
    const isCameraCountUp = game.playerName === cameraPlayerName;
    return {
      session,
      modeLabel: isCameraCountUp ? 'カメラCOUNT-UP' : 'COUNT-UP',
      roundLabel: `${game.currentRoundNo}/8`,
      currentScoreLabel: `${game.totalScore}`,
      startedAtLabel: formatDateTime(game.startedAt),
      resumeRoute: isCameraCountUp ? `/camera/local-count-up/${game.gameId}` : session.route,
    };
  }

  if (session.mode === 'zero_one') {
    const game = await services.zeroOne.loadGame(session.id);
    return {
      session,
      modeLabel: '01 GAME',
      roundLabel: `${game.currentRoundNo}/15`,
      currentScoreLabel: `${game.currentRemainingScore}`,
      startedAtLabel: formatDateTime(game.startedAt),
      resumeRoute: session.route,
    };
  }

  if (session.mode === 'cricket') {
    const game = await services.cricket.loadGame(session.id);
    return {
      session,
      modeLabel: 'STANDARD CRICKET',
      roundLabel: `${game.currentRoundNo}/15`,
      currentScoreLabel: `${game.currentCricketScore}`,
      startedAtLabel: formatDateTime(game.startedAt),
      resumeRoute: session.route,
    };
  }

  const match = await services.match.loadMatch(session.id);
  const activeGame = match.activeGame;
  return {
    session,
    modeLabel: 'MATCH',
    roundLabel: activeGame ? `GAME ${activeGame.gameNo} / R${activeGame.currentRoundNo}` : '-',
    currentScoreLabel: formatMatchScore(activeGame),
    startedAtLabel: formatDateTime(match.startedAt),
    resumeRoute: session.route,
  };
}

function formatMatchScore(activeGame: MatchGameState | null) {
  if (!activeGame) {
    return '-';
  }
  return activeGame.players
    .map((player) =>
      activeGame.mode === 'zero_one'
        ? `${player.displayName}: ${player.currentRemainingScore ?? '-'}`
        : `${player.displayName}: ${player.currentCricketScore}`,
    )
    .join(' / ');
}

function formatDateTime(value: string | null) {
  return value ? new Date(value).toLocaleString('ja-JP') : '-';
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
  conflictActions: {
    gap: 10,
    marginTop: 14,
  },
  infoList: {
    marginTop: 10,
    gap: 8,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
  },
  infoLabel: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '800',
  },
  infoValue: {
    flex: 1,
    color: colors.text,
    fontSize: 13,
    fontWeight: '900',
    textAlign: 'right',
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
  modalBackdrop: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 18,
    backgroundColor: 'rgba(17, 24, 39, 0.58)',
  },
  modalCard: {
    width: '100%',
    maxWidth: 460,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 18,
    backgroundColor: colors.surface,
  },
  modalTitle: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '900',
  },
  modalMessage: {
    marginTop: 10,
    color: colors.textMuted,
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 21,
  },
});
