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
  onSetCenter?: (point: { x: number; y: number }) => void;
  onScaleOuter?: (delta: number) => void;
  onSetOuterRadius?: (outerRadius: number) => void;
  onRotate?: (deltaDeg: number) => void;
  onSetRotationDeg?: (rotationDeg: number) => void;
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
  onSetCenter,
  onScaleOuter,
  onSetOuterRadius,
  onRotate,
  onSetRotationDeg,
  onAdjustRing,
}: CameraPreviewSurfaceProps) {
  const hasCameraPermission = cameraSession.permissionState === 'granted';

  return (
    <View style={styles.previewWrap}>
      <View style={styles.cameraFrame} testID="camera-preview-surface">
        <View style={[StyleSheet.absoluteFill, profile.previewMirrored && styles.mirroredPreview]}>
          {hasCameraPermission && cameraSession.shouldMountCamera ? (
            <CameraView
              ref={cameraRef}
              style={StyleSheet.absoluteFill}
              facing={cameraSession.facing}
              onCameraReady={cameraSession.markCameraReady}
              onMountError={cameraSession.handleMountError}
            />
          ) : (
            <View style={styles.fixtureBoard}>
              <View style={styles.fixtureOuter} />
              <View style={styles.fixtureTriple} />
              <View style={styles.fixtureDouble} />
              <View style={styles.fixtureBull} />
              <Text style={styles.fixtureText}>Fixture 16:9 / circle overlay</Text>
            </View>
          )}
        </View>
        <BoardCalibrationOverlay
          profile={profile}
          editable={editable}
          selectedRing={selectedRing}
          onSelectRing={onSelectRing}
          onMoveCenter={onMoveCenter}
          onSetCenter={onSetCenter}
          onScaleOuter={onScaleOuter}
          onSetOuterRadius={onSetOuterRadius}
          onRotate={onRotate}
          onSetRotationDeg={onSetRotationDeg}
          onAdjustRing={onAdjustRing}
        />
        {hasCameraPermission && !cameraSession.isReady ? (
          <View style={styles.readyBanner}>
            <Text style={styles.readyText}>カメラを準備しています</Text>
          </View>
        ) : null}
        {children}
      </View>
      {!hasCameraPermission ? (
        <CameraPermissionCard
          permissionState={cameraSession.permissionState}
          onRequestPermission={cameraSession.requestCameraAccess}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  previewWrap: {
    gap: 10,
  },
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
  fixtureBoard: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#111827',
  },
  fixtureOuter: {
    position: 'absolute',
    width: '62%',
    aspectRatio: 1,
    borderRadius: 999,
    borderWidth: 4,
    borderColor: '#f97316',
  },
  fixtureDouble: {
    position: 'absolute',
    width: '56%',
    aspectRatio: 1,
    borderRadius: 999,
    borderWidth: 2,
    borderColor: '#fef3c7',
  },
  fixtureTriple: {
    position: 'absolute',
    width: '36%',
    aspectRatio: 1,
    borderRadius: 999,
    borderWidth: 2,
    borderColor: '#22c55e',
  },
  fixtureBull: {
    position: 'absolute',
    width: '7%',
    aspectRatio: 1,
    borderRadius: 999,
    backgroundColor: '#ef4444',
  },
  fixtureText: {
    position: 'absolute',
    left: 12,
    bottom: 12,
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '900',
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
