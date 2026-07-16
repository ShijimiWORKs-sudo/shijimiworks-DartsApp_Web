import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { AppButton } from '../../components/AppButton';
import { Card } from '../../components/Card';
import { ScreenShell } from '../../components/ScreenShell';
import { SectionTitle } from '../../components/SectionTitle';

export default function CameraHomeScreen() {
  const router = useRouter();

  return (
    <ScreenShell>
      <SectionTitle
        title="Camera Home"
        subtitle="判定、ローカルゲーム、LAN接続、キャリブレーション、アワード確認を選択します。"
      />

      <Card>
        <SectionTitle
          title="操作モード"
          subtitle="LAN接続なしでも判定を使用できます。"
          tone="card"
        />
        <View style={styles.actionGrid}>
          <AppButton label="判定だけ使用" onPress={() => router.push('/camera/node')} />
          <AppButton label="このPCでゲーム" onPress={() => router.push('/camera/local-game')} />
          <AppButton
            label="ゲームPCと接続"
            onPress={() => router.push('/camera/lan')}
            variant="secondary"
          />
          <AppButton
            label="キャリブレーション"
            onPress={() => router.push('/camera/capture')}
            variant="secondary"
          />
          <AppButton
            label="カメラ設定"
            onPress={() => router.push('/camera/index')}
            variant="secondary"
          />
          <AppButton
            label="アワード確認"
            onPress={() => router.push('/camera/awards')}
            variant="secondary"
          />
        </View>
      </Card>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  actionGrid: {
    gap: 10,
    marginTop: 12,
  },
});
