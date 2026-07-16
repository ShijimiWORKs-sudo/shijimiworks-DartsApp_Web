import { useRouter } from 'expo-router';
import { CameraView } from 'expo-camera';
import { useRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { AppButton } from '../../components/AppButton';
import { CameraPermissionCard } from '../../components/camera/CameraPermissionCard';
import { DartboardCaptureGuide } from '../../components/camera/DartboardCaptureGuide';
import { ScreenShell } from '../../components/ScreenShell';
import { SectionTitle } from '../../components/SectionTitle';
import { colors } from '../../constants/theme';
import { setPendingCapturedImage } from '../../features/camera/application/cameraSession';
import { useCameraSession } from '../../features/camera/ui/useCameraSession';

export default function CameraCaptureScreen() {
  const router = useRouter();
  const cameraRef = useRef<CameraView>(null);
  const session = useCameraSession();

  const handleCapture = async () => {
    const image = await session.capturePicture(cameraRef.current);
    if (!image) {
      return;
    }

    setPendingCapturedImage(image);
    router.push('/camera/review');
  };

  return (
    <ScreenShell>
      <SectionTitle
        title="ボードを撮影"
        subtitle="ガイドは画面表示のみです。撮影画像には焼き込みません。"
      />

      {session.permissionState === 'granted' ? (
        <View style={styles.cameraFrame}>
          {session.shouldMountCamera ? (
            <CameraView
              ref={cameraRef}
              style={StyleSheet.absoluteFill}
              facing={session.facing}
              onCameraReady={session.markCameraReady}
              onMountError={session.handleMountError}
            />
          ) : null}
          <DartboardCaptureGuide />
          {!session.isReady ? (
            <View style={styles.readyBanner}>
              <Text style={styles.readyText}>カメラを準備しています</Text>
            </View>
          ) : null}
        </View>
      ) : (
        <CameraPermissionCard
          permissionState={session.permissionState}
          onRequestPermission={session.requestCameraAccess}
        />
      )}

      {session.errorMessage ? <Text style={styles.errorText}>{session.errorMessage}</Text> : null}

      <View style={styles.actionRow}>
        <AppButton
          label={session.facing === 'back' ? '前面カメラへ' : '背面カメラへ'}
          onPress={session.switchFacing}
          disabled={session.isCapturing || session.permissionState !== 'granted'}
          variant="secondary"
        />
        <AppButton
          label={session.isCapturing ? '撮影中…' : '撮影する'}
          onPress={handleCapture}
          disabled={!session.canTakePicture}
        />
      </View>
      <View style={styles.backAction}>
        <AppButton label="戻る" onPress={() => router.back()} variant="secondary" />
      </View>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  cameraFrame: {
    width: '100%',
    aspectRatio: 4 / 3,
    overflow: 'hidden',
    borderRadius: 8,
    backgroundColor: '#000000',
  },
  readyBanner: {
    position: 'absolute',
    left: 12,
    right: 12,
    bottom: 12,
    alignItems: 'center',
    borderRadius: 8,
    paddingVertical: 8,
    backgroundColor: 'rgba(0,0,0,0.62)',
  },
  readyText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '900',
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
    gap: 10,
    marginTop: 14,
  },
  backAction: {
    marginTop: 10,
  },
});
