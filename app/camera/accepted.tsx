import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { View } from 'react-native';

import { AppButton } from '../../components/AppButton';
import { CapturedImageReview } from '../../components/camera/CapturedImageReview';
import { Card } from '../../components/Card';
import { ScreenShell } from '../../components/ScreenShell';
import { SectionTitle } from '../../components/SectionTitle';
import {
  clearAcceptedCapturedImage,
  getAcceptedCapturedImage,
} from '../../features/camera/application/cameraSession';
import type { CapturedBoardImage } from '../../features/camera/domain/types';

export default function CameraAcceptedScreen() {
  const router = useRouter();
  const [image, setImage] = useState<CapturedBoardImage | null>(null);

  useFocusEffect(
    useCallback(() => {
      setImage(getAcceptedCapturedImage());
    }, []),
  );

  const handleDone = () => {
    clearAcceptedCapturedImage();
    router.replace('/camera');
  };

  return (
    <ScreenShell>
      <SectionTitle title="撮影完了" subtitle="Phase 10Aではここまでを撮影基盤として確認します。" />
      {image ? (
        <CapturedImageReview image={image} />
      ) : (
        <Card muted>
          <SectionTitle
            title="利用中の撮影画像はありません"
            subtitle="新しく撮影してください。"
            tone="card"
          />
        </Card>
      )}
      <View style={{ marginTop: 14 }}>
        <AppButton label="カメラ撮影テストへ戻る" onPress={handleDone} />
      </View>
    </ScreenShell>
  );
}
