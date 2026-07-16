import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors } from '../../constants/theme';
import type {
  BoardCalibrationProfile,
  CalibrationRingKey,
} from '../../features/camera/calibration/domain/types';
import { applyPreviewMirror } from '../../features/camera/calibration/domain/coordinateTransform';

type BoardCalibrationOverlayProps = {
  profile: BoardCalibrationProfile;
  selectedRing?: CalibrationRingKey;
  editable?: boolean;
  onSelectRing?: (ring: CalibrationRingKey) => void;
  onMoveCenter?: (deltaX: number, deltaY: number) => void;
  onScaleOuter?: (delta: number) => void;
  onRotate?: (deltaDeg: number) => void;
  onAdjustRing?: (ring: CalibrationRingKey, delta: number) => void;
};

const ringStyles: {
  key: CalibrationRingKey;
  label: string;
  ratio: keyof BoardCalibrationProfile | 'outerRadius';
}[] = [
  { key: 'outer', label: '外周', ratio: 'outerRadius' },
  { key: 'double_outer', label: 'Double外側', ratio: 'doubleOuterRatio' },
  { key: 'double_inner', label: 'Double内側', ratio: 'doubleInnerRatio' },
  { key: 'triple_outer', label: 'Triple外側', ratio: 'tripleOuterRatio' },
  { key: 'triple_inner', label: 'Triple内側', ratio: 'tripleInnerRatio' },
  { key: 'outer_bull', label: 'Outer Bull', ratio: 'outerBullRatio' },
  { key: 'inner_bull', label: 'Inner Bull', ratio: 'innerBullRatio' },
];

export function BoardCalibrationOverlay({
  profile,
  selectedRing = 'outer',
  editable = false,
  onSelectRing,
  onMoveCenter,
  onScaleOuter,
  onRotate,
  onAdjustRing,
}: BoardCalibrationOverlayProps) {
  const displayCenter = applyPreviewMirror(
    { x: profile.centerX, y: profile.centerY },
    profile.previewMirrored,
  );

  return (
    <View
      pointerEvents={editable ? 'auto' : 'none'}
      style={styles.overlay}
      testID="board-calibration-overlay"
    >
      {ringStyles.map((ring) => {
        const radius =
          ring.key === 'outer'
            ? profile.outerRadius
            : profile.outerRadius * Number(profile[ring.ratio]);
        const selected = selectedRing === ring.key;
        return (
          <Pressable
            key={ring.key}
            accessibilityRole="button"
            accessibilityLabel={ring.label}
            disabled={!editable}
            onPress={() => onSelectRing?.(ring.key)}
            onLongPress={() => onAdjustRing?.(ring.key, 0.002)}
            style={[
              styles.ring,
              {
                left: `${(displayCenter.x - radius) * 100}%`,
                top: `${(displayCenter.y - radius) * 100}%`,
                width: `${radius * 200}%`,
                height: `${radius * 200}%`,
              },
              selected && styles.selectedRing,
            ]}
          />
        );
      })}

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Bull中心"
        disabled={!editable}
        onPress={() => onMoveCenter?.(0.002, 0)}
        style={[
          styles.centerHandle,
          {
            left: `${displayCenter.x * 100}%`,
            top: `${displayCenter.y * 100}%`,
          },
        ]}
      >
        <Text style={styles.centerText}>+</Text>
      </Pressable>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="20方向回転"
        disabled={!editable}
        onPress={() => onRotate?.(1)}
        style={[
          styles.rotationHandle,
          {
            left: `${displayCenter.x * 100}%`,
            top: `${(displayCenter.y - profile.outerRadius) * 100}%`,
            transform: [{ rotate: `${profile.rotationDeg}deg` }],
          },
        ]}
      >
        <Text style={styles.rotationText}>20</Text>
      </Pressable>

      <Text style={styles.orientationText}>ABC 正位置確認</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
  },
  ring: {
    position: 'absolute',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.72)',
    backgroundColor: 'rgba(255,255,255,0.02)',
  },
  selectedRing: {
    borderWidth: 3,
    borderColor: colors.warning,
  },
  centerHandle: {
    position: 'absolute',
    width: 34,
    height: 34,
    marginLeft: -17,
    marginTop: -17,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 999,
    backgroundColor: 'rgba(21,128,61,0.88)',
  },
  centerText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '900',
  },
  rotationHandle: {
    position: 'absolute',
    minWidth: 44,
    minHeight: 26,
    marginLeft: -22,
    marginTop: -13,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    backgroundColor: 'rgba(185,28,28,0.9)',
  },
  rotationText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '900',
  },
  orientationText: {
    position: 'absolute',
    left: 12,
    top: 12,
    borderRadius: 8,
    overflow: 'hidden',
    paddingHorizontal: 10,
    paddingVertical: 6,
    color: '#ffffff',
    backgroundColor: 'rgba(0,0,0,0.55)',
    fontSize: 13,
    fontWeight: '900',
  },
});
