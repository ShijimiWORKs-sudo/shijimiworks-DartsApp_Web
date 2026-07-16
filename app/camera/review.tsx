import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { View } from 'react-native';

import { AppButton } from '../../components/AppButton';
import { CapturedImageReview } from '../../components/camera/CapturedImageReview';
import { Card } from '../../components/Card';
import { ScreenShell } from '../../components/ScreenShell';
import { SectionTitle } from '../../components/SectionTitle';
import {
  acceptPendingCapturedImage,
  clearPendingCapturedImage,
  getPendingCapturedImage,
} from '../../features/camera/application/cameraSession';
import type { CapturedBoardImage } from '../../features/camera/domain/types';

export default function CameraReviewScreen() {
  const router = useRouter();
  const [image, setImage] = useState<CapturedBoardImage | null>(null);

  useFocusEffect(
    useCallback(() => {
      const pending = getPendingCapturedImage();
      setImage(pending);
      if (!pending) {
        router.replace('/camera');
      }
    }, [router]),
  );

  const handleRetake = () => {
    clearPendingCapturedImage();
    router.replace('/camera/capture');
  };

  const handleAccept = () => {
    acceptPendingCapturedImage();
    router.replace('/camera/accepted');
  };

  if (!image) {
    return (
      <ScreenShell>
        <Card muted>
          <SectionTitle
            title="撮影画像を確認中"
            subtitle="撮影画像を読み込んでいます。"
            tone="card"
          />
        </Card>
      </ScreenShell>
    );
  }

  return (
    <ScreenShell>
      <SectionTitle title="撮影結果" subtitle="この画像を利用するか、もう一度撮り直せます。" />
      <CapturedImageReview image={image} />
      <View style={{ marginTop: 14 }}>
        <AppButton label="この画像を使う" onPress={handleAccept} />
      </View>
      <View style={{ marginTop: 10 }}>
        <AppButton label="撮り直す" onPress={handleRetake} variant="secondary" />
      </View>
    </ScreenShell>
  );
}
