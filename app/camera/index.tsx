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
          title="Phase 10A Camera Foundation"
          subtitle="画像はDBへ保存せず、クラウド送信もしません。Webではbase64、Nativeではcache URIを画面セッション内で扱います。"
          tone="card"
        />
        <View style={{ marginTop: 14 }}>
          <AppButton label="カメラを開く" onPress={() => router.push('/camera/capture')} />
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
