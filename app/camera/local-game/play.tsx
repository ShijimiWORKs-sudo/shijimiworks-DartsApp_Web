import { useRouter } from 'expo-router';
import { Text } from 'react-native';

import { AppButton } from '../../../components/AppButton';
import { Card } from '../../../components/Card';
import { ScreenShell } from '../../../components/ScreenShell';
import { SectionTitle } from '../../../components/SectionTitle';

export default function CameraLocalGamePlayScreen() {
  const router = useRouter();

  return (
    <ScreenShell>
      <SectionTitle
        title="Camera Local Game"
        subtitle="候補確定はCameraLocalGameAdapter経由で既存ゲーム画面へ接続します。"
      />
      <Card>
        <SectionTitle title="進行中ゲーム" subtitle="既存ゲーム画面で操作します。" tone="card" />
        <Text>COUNT-UP / 01 / CRICKET / MATCHの各プレイ画面を再利用します。</Text>
        <AppButton label="ゲーム選択へ戻る" onPress={() => router.replace('/camera/local-game')} />
      </Card>
    </ScreenShell>
  );
}
