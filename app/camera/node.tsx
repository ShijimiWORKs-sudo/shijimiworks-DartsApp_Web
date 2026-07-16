import { CameraView } from 'expo-camera';
import { useEffect, useRef, useState } from 'react';
import { Platform, StyleSheet, Text, TextInput, View } from 'react-native';

import { AppButton } from '../../components/AppButton';
import { CameraPermissionCard } from '../../components/camera/CameraPermissionCard';
import { DartboardCaptureGuide } from '../../components/camera/DartboardCaptureGuide';
import { Card } from '../../components/Card';
import { ScreenShell } from '../../components/ScreenShell';
import { SectionTitle } from '../../components/SectionTitle';
import { colors } from '../../constants/theme';
import {
  defaultLanCameraNodeSettings,
  loadLanCameraNodeSettings,
  saveLanCameraNodeSettings,
} from '../../features/camera/lan/application/lanCameraSettings';
import { createLanCameraSessionId } from '../../features/camera/lan/domain/protocol';
import { useLanCameraPeer } from '../../features/camera/lan/ui/useLanCameraPeer';
import { useCameraSession } from '../../features/camera/ui/useCameraSession';

export default function LanCameraNodeScreen() {
  const cameraRef = useRef<CameraView>(null);
  const cameraSession = useCameraSession();
  const [relayHost, setRelayHost] = useState(defaultLanCameraNodeSettings.relayHost);
  const [relayPort, setRelayPort] = useState(String(defaultLanCameraNodeSettings.relayPort));
  const [pairingCode, setPairingCode] = useState('');
  const [cameraNodeName, setCameraNodeName] = useState(defaultLanCameraNodeSettings.cameraNodeName);
  const [enabled, setEnabled] = useState(false);
  const [sessionId] = useState(() => createLanCameraSessionId());
  const relayUrl = `ws://${relayHost}:${Number(relayPort) || defaultLanCameraNodeSettings.relayPort}`;
  const lanPeer = useLanCameraPeer({
    role: 'camera_node',
    relayUrl,
    sessionId,
    pairingCode,
    cameraNodeName,
    enabled,
  });
  const isLocalhost = isRunningOnLocalhost();
  const { sendCameraReady, status } = lanPeer;
  const isConnectionStarting = status === 'connecting' || status === 'reconnecting';
  const isConnectDisabled = pairingCode.length !== 6 || isConnectionStarting || status === 'paired';

  useEffect(() => {
    void loadLanCameraNodeSettings().then((settings) => {
      setRelayHost(settings.relayHost);
      setRelayPort(String(settings.relayPort));
      setCameraNodeName(settings.cameraNodeName);
    });
  }, []);

  useEffect(() => {
    if (status === 'paired') {
      sendCameraReady(cameraSession.isReady);
    }
  }, [cameraSession.isReady, sendCameraReady, status]);

  const connect = () => {
    const parsedPort = Number(relayPort);
    void saveLanCameraNodeSettings({
      relayHost,
      relayPort: Number.isFinite(parsedPort) ? parsedPort : defaultLanCameraNodeSettings.relayPort,
      cameraNodeName,
    });
    setEnabled(true);
    lanPeer.connect();
  };

  return (
    <ScreenShell>
      <SectionTitle
        title="Camera Node"
        subtitle="カメラPCのlocalhostで開き、ゲームPCのLAN relayへ候補だけを送信します。"
      />

      {!isLocalhost ? (
        <Card muted>
          <SectionTitle
            title="localhostで開いてください"
            subtitle="カメラ取得はCamera Node自身のlocalhostで実行します。ゲームPCのLAN IPからこの画面を開かないでください。"
            tone="card"
          />
        </Card>
      ) : null}

      <Card>
        <SectionTitle title="接続設定" subtitle="ゲームPC側のRelay情報を入力します。" tone="card" />
        <Text style={styles.label}>ゲームPC IPアドレス</Text>
        <TextInput
          value={relayHost}
          onChangeText={setRelayHost}
          autoCapitalize="none"
          autoCorrect={false}
          style={styles.input}
        />
        <Text style={styles.label}>port</Text>
        <TextInput
          value={relayPort}
          onChangeText={setRelayPort}
          keyboardType="number-pad"
          style={styles.input}
        />
        <Text style={styles.label}>6桁ペアリングコード</Text>
        <TextInput
          value={pairingCode}
          onChangeText={setPairingCode}
          keyboardType="number-pad"
          maxLength={6}
          style={styles.input}
        />
        <Text style={styles.label}>Camera Node名</Text>
        <TextInput value={cameraNodeName} onChangeText={setCameraNodeName} style={styles.input} />
        <View style={styles.actionRow}>
          <AppButton
            label={isConnectionStarting ? '接続中...' : '接続'}
            onPress={connect}
            disabled={isConnectDisabled}
          />
          <AppButton label="切断" onPress={lanPeer.disconnect} variant="secondary" />
          <AppButton
            label="再接続"
            onPress={connect}
            variant="secondary"
            disabled={isConnectionStarting || pairingCode.length !== 6}
          />
        </View>
      </Card>

      <Card>
        <SectionTitle
          title="Camera Node状態"
          subtitle="映像はこのPC内だけで処理します。"
          tone="card"
        />
        <InfoRow label="接続状態" value={lanPeer.status} />
        <InfoRow label="Camera Node ID" value={lanPeer.cameraNodeId} />
        <InfoRow label="使用カメラ" value={cameraSession.facing} />
        <InfoRow label="カメラready" value={cameraSession.isReady ? 'ready' : 'not ready'} />
        <InfoRow label="Detection session" value={lanPeer.detectionState} />
        <InfoRow label="送信済み候補件数" value={String(lanPeer.sentCandidateCount)} />
        <InfoRow
          label="latency"
          value={lanPeer.latencyMs == null ? '-' : `${lanPeer.latencyMs}ms`}
        />
        <InfoRow label="lastError" value={lanPeer.lastError ?? '-'} />
        {lanPeer.lastError ? <Text style={styles.errorText}>{lanPeer.lastError}</Text> : null}
      </Card>

      {cameraSession.permissionState === 'granted' ? (
        <View style={styles.cameraFrame}>
          {cameraSession.shouldMountCamera ? (
            <CameraView
              ref={cameraRef}
              style={StyleSheet.absoluteFill}
              facing={cameraSession.facing}
              onCameraReady={cameraSession.markCameraReady}
              onMountError={cameraSession.handleMountError}
            />
          ) : null}
          <DartboardCaptureGuide />
        </View>
      ) : (
        <CameraPermissionCard
          permissionState={cameraSession.permissionState}
          onRequestPermission={cameraSession.requestCameraAccess}
        />
      )}

      <Card>
        <SectionTitle
          title="テスト候補送信"
          subtitle="LAN未接続でも候補生成と履歴確認は利用できます。接続済みの場合だけゲームPCへ送信します。"
          tone="card"
        />
        <View style={styles.actionRow}>
          <AppButton
            label="S20候補を送信"
            onPress={() =>
              lanPeer.sendTestCandidate({
                segment: 20,
                multiplier: 1,
                confidence: 0.9,
                normalizedX: 0.5,
                normalizedY: 0.22,
              })
            }
          />
          <AppButton
            label="T20候補を送信"
            onPress={() =>
              lanPeer.sendTestCandidate({
                segment: 20,
                multiplier: 3,
                confidence: 0.94,
                normalizedX: 0.5,
                normalizedY: 0.18,
              })
            }
          />
          <AppButton
            label="Inner Bull候補を送信"
            onPress={() =>
              lanPeer.sendTestCandidate({
                segment: 25,
                multiplier: 2,
                confidence: 0.96,
                normalizedX: 0.5,
                normalizedY: 0.5,
              })
            }
          />
          <AppButton
            label="低信頼度候補を送信"
            onPress={() =>
              lanPeer.sendTestCandidate({
                segment: 5,
                multiplier: 1,
                confidence: 0.34,
                normalizedX: 0.72,
                normalizedY: 0.43,
              })
            }
            variant="secondary"
          />
          <AppButton label="接続切断を再現" onPress={lanPeer.disconnect} variant="danger" />
        </View>
        {lanPeer.candidateLog.length > 0 ? (
          <View style={styles.candidateList}>
            {lanPeer.candidateLog.slice(0, 5).map((entry) => (
              <Text key={`${entry.candidate.candidateId}:${entry.receivedAt}`} style={styles.meta}>
                {entry.candidate.segment === 25 ? 'BULL' : entry.candidate.segment} x
                {entry.candidate.multiplier} / {entry.status}
              </Text>
            ))}
          </View>
        ) : (
          <Text style={styles.meta}>候補履歴はまだありません。</Text>
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

function isRunningOnLocalhost() {
  if (Platform.OS !== 'web') {
    return true;
  }
  const location = globalThis.location;
  return location.hostname === 'localhost' || location.hostname === '127.0.0.1';
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
  errorText: {
    marginTop: 10,
    color: colors.danger,
    fontSize: 13,
    fontWeight: '800',
    lineHeight: 19,
  },
  candidateList: {
    marginTop: 12,
    gap: 4,
  },
  meta: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 19,
  },
  cameraFrame: {
    width: '100%',
    aspectRatio: 4 / 3,
    overflow: 'hidden',
    borderRadius: 8,
    backgroundColor: '#000000',
  },
});
