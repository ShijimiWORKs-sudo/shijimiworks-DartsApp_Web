import { useRouter } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { AppButton } from '../../components/AppButton';
import { Card } from '../../components/Card';
import { ScreenShell } from '../../components/ScreenShell';
import { SectionTitle } from '../../components/SectionTitle';
import { colors } from '../../constants/theme';

export default function CameraHomeScreen() {
  const router = useRouter();

  return (
    <ScreenShell>
      <SectionTitle title="カメラPC単体モード" subtitle="LAN未接続でCOUNT-UPを遊べます。" />

      <Card>
        <SectionTitle
          title="COUNT-UP MVP"
          subtitle="候補表示、確定、補正、手動入力、結果保存までこのPCだけで動作します。"
          tone="card"
        />
        <View style={styles.actionGrid}>
          <AppButton
            label="COUNT-UPを始める"
            onPress={() => router.push('/camera/local-count-up/settings')}
          />
          <AppButton
            label="キャリブレーション"
            onPress={() => router.push('/camera/calibration')}
            variant="secondary"
          />
          <AppButton
            label="判定テスト"
            onPress={() => router.push('/camera/node')}
            variant="secondary"
          />
          <AppButton
            label="アワードテスト"
            onPress={() => router.push('/camera/awards/test')}
            variant="secondary"
          />
          <AppButton
            label="ゲームPCと接続"
            onPress={() => router.push('/camera/lan')}
            variant="secondary"
          />
        </View>
        <Text style={styles.note}>
          local_count_upではWebSocket、pairingCode、LAN peer状態を使用しません。
        </Text>
      </Card>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  actionGrid: {
    gap: 10,
    marginTop: 12,
  },
  note: {
    marginTop: 12,
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 19,
  },
});
