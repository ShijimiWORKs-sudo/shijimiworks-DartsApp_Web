import { useMemo, useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';

import { AppButton } from '../../components/AppButton';
import { Card } from '../../components/Card';
import { ScreenShell } from '../../components/ScreenShell';
import { SectionTitle } from '../../components/SectionTitle';
import { colors } from '../../constants/theme';
import {
  LAN_CAMERA_RELAY_PORT,
  createLanCameraSessionId,
  createPairingCode,
  createPairingExpiry,
} from '../../features/camera/lan/domain/protocol';
import { useLanCameraPeer } from '../../features/camera/lan/ui/useLanCameraPeer';

export default function LanCameraHostScreen() {
  const [sessionId] = useState(() => createLanCameraSessionId());
  const [pairingCode, setPairingCode] = useState(() => createPairingCode());
  const [pairingExpiresAt, setPairingExpiresAt] = useState(() => createPairingExpiry());
  const [relayUrl, setRelayUrl] = useState(`ws://localhost:${LAN_CAMERA_RELAY_PORT}`);
  const [enabled, setEnabled] = useState(false);
  const peer = useLanCameraPeer({
    role: 'game_pc',
    relayUrl,
    sessionId,
    pairingCode,
    pairingExpiresAt,
    enabled,
  });
  const latestCandidate = peer.candidateLog.find((entry) => entry.status === 'pending');
  const lanIpHints = useMemo(
    () => ['localhost', '127.0.0.1', 'ipconfigで確認したこのPCのIPv4'],
    [],
  );

  const startWaiting = () => {
    setEnabled(true);
    peer.connect();
  };

  const rotatePairingCode = () => {
    peer.disconnect();
    setEnabled(false);
    setPairingCode(createPairingCode());
    setPairingExpiresAt(createPairingExpiry());
  };

  return (
    <ScreenShell>
      <SectionTitle
        title="LAN Camera 接続"
        subtitle="ゲーム操作PCでRelayを待ち受け、同じWi-Fi上のCamera Nodeをpairingします。"
      />

      <Card>
        <SectionTitle
          title="Relay設定"
          subtitle="ゲームPC側で起動するWebSocket relayです。"
          tone="card"
        />
        <Text style={styles.label}>Relay URL</Text>
        <TextInput
          value={relayUrl}
          onChangeText={setRelayUrl}
          autoCapitalize="none"
          autoCorrect={false}
          style={styles.input}
        />
        <Text style={styles.meta}>Relay port: {LAN_CAMERA_RELAY_PORT}</Text>
        <Text style={styles.meta}>LAN IP候補: {lanIpHints.join(' / ')}</Text>
        <Text style={styles.warning}>
          Windows Firewallはプライベートネットワークだけ許可してください。
        </Text>
      </Card>

      <Card>
        <SectionTitle title="Pairing" subtitle="Camera Nodeへ6桁コードを入力します。" tone="card" />
        <Text style={styles.pairingCode}>{pairingCode}</Text>
        <Text style={styles.meta}>sessionId: {sessionId}</Text>
        <Text style={styles.meta}>有効期限: {formatDateTime(pairingExpiresAt)}</Text>
        <View style={styles.actionRow}>
          <AppButton
            label="接続待受開始"
            onPress={startWaiting}
            disabled={peer.status === 'paired'}
          />
          <AppButton label="コード更新" onPress={rotatePairingCode} variant="secondary" />
        </View>
      </Card>

      <Card>
        <SectionTitle
          title="接続状態"
          subtitle="1ゲームにつき有効Camera Nodeは1台です。"
          tone="card"
        />
        <InfoRow label="状態" value={peer.status} />
        <InfoRow label="接続済みCamera Node" value={peer.pairedNodeName ?? '-'} />
        <InfoRow label="接続時間" value={formatDateTime(peer.connectedAt)} />
        <InfoRow label="Pairing完了" value={formatDateTime(peer.pairedAt)} />
        <InfoRow label="最終heartbeat" value={formatDateTime(peer.lastHeartbeatAt)} />
        <InfoRow label="推定latency" value={peer.latencyMs == null ? '-' : `${peer.latencyMs}ms`} />
        <Text style={styles.warning}>
          複数Node接続時は自動選択しません。開発段階では2台目を拒否します。
        </Text>
        {peer.lastError ? <Text style={styles.errorText}>{peer.lastError}</Text> : null}
        <View style={styles.actionRow}>
          <AppButton label="切断" onPress={peer.disconnect} variant="danger" />
        </View>
      </Card>

      <Card>
        <SectionTitle
          title="候補受信"
          subtitle="Phase 10Bでは確定してもゲーム入力へ自動反映しません。"
          tone="card"
        />
        {latestCandidate ? (
          <>
            <Text style={styles.candidateText}>
              カメラ判定: {formatCandidate(latestCandidate.candidate)}
            </Text>
            <Text style={styles.meta}>
              信頼度: {(latestCandidate.candidate.confidence * 100).toFixed(0)}%
            </Text>
            <View style={styles.actionRow}>
              <AppButton
                label="確定"
                onPress={() => peer.acceptCandidate(latestCandidate.candidate.candidateId)}
              />
              <AppButton
                label="拒否"
                onPress={() =>
                  peer.rejectCandidate(latestCandidate.candidate.candidateId, 'rejected')
                }
                variant="secondary"
              />
              <AppButton
                label="手動修正"
                onPress={() =>
                  peer.rejectCandidate(latestCandidate.candidate.candidateId, 'manual_correction')
                }
                variant="secondary"
              />
            </View>
          </>
        ) : (
          <Text style={styles.meta}>まだ候補はありません。</Text>
        )}
      </Card>
    </ScreenShell>
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

function formatDateTime(value: string | null) {
  if (!value) {
    return '-';
  }
  return new Date(value).toLocaleString();
}

function formatCandidate(candidate: { segment: number; multiplier: number; score: number }) {
  if (candidate.segment === 25 && candidate.multiplier === 2) {
    return 'Inner Bull';
  }
  if (candidate.multiplier === 3) {
    return `T${candidate.segment}`;
  }
  if (candidate.multiplier === 2) {
    return `D${candidate.segment}`;
  }
  if (candidate.multiplier === 1) {
    return `S${candidate.segment}`;
  }
  return `MISS (${candidate.score})`;
}

const styles = StyleSheet.create({
  label: {
    marginTop: 12,
    color: colors.text,
    fontSize: 13,
    fontWeight: '900',
  },
  input: {
    minHeight: 44,
    marginTop: 6,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    color: colors.text,
    backgroundColor: colors.surfaceMuted,
    fontSize: 14,
    fontWeight: '800',
  },
  pairingCode: {
    marginTop: 10,
    color: colors.text,
    fontSize: 42,
    fontWeight: '900',
    letterSpacing: 0,
  },
  meta: {
    marginTop: 8,
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 19,
  },
  warning: {
    marginTop: 10,
    color: colors.warning,
    fontSize: 13,
    fontWeight: '800',
    lineHeight: 19,
  },
  errorText: {
    marginTop: 10,
    color: colors.danger,
    fontSize: 13,
    fontWeight: '800',
    lineHeight: 19,
  },
  actionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 14,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    marginTop: 8,
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
  candidateText: {
    marginTop: 10,
    color: colors.text,
    fontSize: 24,
    fontWeight: '900',
  },
});
