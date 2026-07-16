import { CameraView } from 'expo-camera';
import type { RefObject, ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { CameraPermissionCard } from './CameraPermissionCard';
import { BoardCalibrationOverlay } from './BoardCalibrationOverlay';
import type {
  BoardCalibrationProfile,
  CalibrationRingKey,
} from '../../features/camera/calibration/domain/types';
import type { useCameraSession } from '../../features/camera/ui/useCameraSession';

type CameraPreviewSurfaceProps = {
  cameraRef: RefObject<CameraView | null>;
  cameraSession: ReturnType<typeof useCameraSession>;
  profile: BoardCalibrationProfile;
  editable?: boolean;
  selectedRing?: CalibrationRingKey;
  children?: ReactNode;
  onSelectRing?: (ring: CalibrationRingKey) => void;
  onMoveCenter?: (deltaX: number, deltaY: number) => void;
  onScaleOuter?: (delta: number) => void;
  onRotate?: (deltaDeg: number) => void;
  onAdjustRing?: (ring: CalibrationRingKey, delta: number) => void;
};

export function CameraPreviewSurface({
  cameraRef,
  cameraSession,
  profile,
  editable = false,
  selectedRing,
  children,
  onSelectRing,
  onMoveCenter,
  onScaleOuter,
  onRotate,
  onAdjustRing,
}: CameraPreviewSurfaceProps) {
  if (cameraSession.permissionState !== 'granted') {
    return (
      <CameraPermissionCard
        permissionState={cameraSession.permissionState}
        onRequestPermission={cameraSession.requestCameraAccess}
      />
    );
  }

  return (
    <View style={styles.cameraFrame} testID="camera-preview-surface">
      <View style={[StyleSheet.absoluteFill, profile.previewMirrored && styles.mirroredPreview]}>
        {cameraSession.shouldMountCamera ? (
          <CameraView
            ref={cameraRef}
            style={StyleSheet.absoluteFill}
            facing={cameraSession.facing}
            onCameraReady={cameraSession.markCameraReady}
            onMountError={cameraSession.handleMountError}
          />
        ) : null}
      </View>
      <BoardCalibrationOverlay
        profile={profile}
        editable={editable}
        selectedRing={selectedRing}
        onSelectRing={onSelectRing}
        onMoveCenter={onMoveCenter}
        onScaleOuter={onScaleOuter}
        onRotate={onRotate}
        onAdjustRing={onAdjustRing}
      />
      {!cameraSession.isReady ? (
        <View style={styles.readyBanner}>
          <Text style={styles.readyText}>カメラを準備しています</Text>
        </View>
      ) : null}
      {children}
    </View>
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
  mirroredPreview: {
    transform: [{ scaleX: -1 }],
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
});
