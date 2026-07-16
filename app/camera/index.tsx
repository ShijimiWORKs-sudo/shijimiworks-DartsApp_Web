import { useRouter } from 'expo-router';
import { View } from 'react-native';

import { AppButton } from '../../components/AppButton';
import { Card } from '../../components/Card';
import { ScreenShell } from '../../components/ScreenShell';
import { SectionTitle } from '../../components/SectionTitle';

export default function CameraIntroScreen() {
  const router = useRouter();

  return (
    <ScreenShell>
      <SectionTitle
        title="カメラ撮影テスト"
        subtitle="ダーツボードの静止画を撮影し、プレビュー確認まで行います。スコア判定は行いません。"
      />
      <Card>
        <SectionTitle
          title="Phase 10B LAN Camera Node"
          subtitle="ゲームPCでRelayを待ち受け、同じWi-Fi上のCamera Nodeからテスト判定候補だけを受信します。映像はLAN送信しません。"
          tone="card"
        />
        <View style={{ marginTop: 14 }}>
          <AppButton label="ゲームPC LAN接続画面へ" onPress={() => router.push('/camera/lan')} />
        </View>
        <View style={{ marginTop: 10 }}>
          <AppButton
            label="Camera Node画面へ"
            onPress={() => router.push('/camera/node')}
            variant="secondary"
          />
        </View>
      </Card>
      <Card>
        <SectionTitle
          title="Phase 10A Camera Foundation"
          subtitle="単体撮影テストです。画像はDBへ保存せず、クラウド送信もしません。"
          tone="card"
        />
        <View style={{ marginTop: 14 }}>
          <AppButton
            label="単体カメラ撮影テストへ"
            onPress={() => router.push('/camera/capture')}
            variant="secondary"
          />
        </View>
        <View style={{ marginTop: 10 }}>
          <AppButton
            label="ゲーム一覧へ戻る"
            onPress={() => router.replace('/game')}
            variant="secondary"
          />
        </View>
      </Card>
    </ScreenShell>
  );
}
