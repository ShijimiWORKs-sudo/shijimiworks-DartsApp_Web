import { useMemo, useState } from 'react';
import type { GestureResponderEvent, LayoutChangeEvent, ViewProps } from 'react-native';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { colors } from '../../constants/theme';
import type {
  BoardCalibrationProfile,
  CalibrationRingKey,
} from '../../features/camera/calibration/domain/types';
import { getCalibrationViewportTransform } from '../../features/camera/calibration/domain/coordinateTransform';

type BoardCalibrationOverlayProps = {
  profile: BoardCalibrationProfile;
  selectedRing?: CalibrationRingKey;
  editable?: boolean;
  onSelectRing?: (ring: CalibrationRingKey) => void;
  onMoveCenter?: (deltaX: number, deltaY: number) => void;
  onSetCenter?: (point: { x: number; y: number }) => void;
  onScaleOuter?: (delta: number) => void;
  onSetOuterRadius?: (outerRadius: number) => void;
  onRotate?: (deltaDeg: number) => void;
  onSetRotationDeg?: (rotationDeg: number) => void;
  onAdjustRing?: (ring: CalibrationRingKey, delta: number) => void;
};

type DragMode = 'center' | 'outer' | 'rotation';

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
  onSetCenter,
  onScaleOuter,
  onSetOuterRadius,
  onRotate,
  onSetRotationDeg,
  onAdjustRing,
}: BoardCalibrationOverlayProps) {
  const [layout, setLayout] = useState({ width: 1, height: 1 });
  const transform = useMemo(
    () =>
      getCalibrationViewportTransform({
        containerWidth: layout.width,
        containerHeight: layout.height,
        profile,
      }),
    [layout.height, layout.width, profile],
  );

  const handleLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    if (width > 0 && height > 0) {
      setLayout({ width, height });
    }
  };

  const updateFromPointer = (mode: DragMode, event: GestureResponderEvent) => {
    const point = {
      x: event.nativeEvent.locationX,
      y: event.nativeEvent.locationY,
    };
    if (mode === 'center') {
      onSetCenter?.(transform.screenToCanonical(point));
      return;
    }

    const canonical = transform.screenToCanonical(point);
    const canonicalXPx = canonical.x * transform.containerWidth;
    const canonicalYPx = canonical.y * transform.containerHeight;
    const dx = canonicalXPx - transform.canonicalCenterXPx;
    const dy = canonicalYPx - transform.canonicalCenterYPx;
    if (mode === 'outer') {
      onSetOuterRadius?.(Math.sqrt(dx * dx + dy * dy) / Math.max(1, transform.baseSize));
      return;
    }
    onSetRotationDeg?.((Math.atan2(dx, -dy) * 180) / Math.PI);
  };

  const beginDrag = (mode: DragMode) => (event: GestureResponderEvent) => {
    updateFromPointer(mode, event);
  };

  const webInteractionProps =
    Platform.OS === 'web'
      ? ({
          tabIndex: 0,
          onWheel: (event: { preventDefault?: () => void; deltaY?: number }) => {
            if (!editable) {
              return;
            }
            event.preventDefault?.();
            onScaleOuter?.(-(event.deltaY ?? 0) * 0.0005);
          },
          onKeyDown: (event: { key?: string; shiftKey?: boolean; preventDefault?: () => void }) => {
            if (!editable || !event.key?.startsWith('Arrow')) {
              return;
            }
            event.preventDefault?.();
            const pixels = event.shiftKey ? 10 : 1;
            const deltaX =
              event.key === 'ArrowLeft' ? -pixels : event.key === 'ArrowRight' ? pixels : 0;
            const deltaY =
              event.key === 'ArrowUp' ? -pixels : event.key === 'ArrowDown' ? pixels : 0;
            onMoveCenter?.(deltaX / transform.containerWidth, deltaY / transform.containerHeight);
          },
        } as unknown as ViewProps)
      : {};

  return (
    <View
      {...webInteractionProps}
      onLayout={handleLayout}
      pointerEvents={editable ? 'auto' : 'none'}
      style={styles.overlay}
      testID="board-calibration-overlay"
    >
      {ringStyles.map((ring) => {
        const normalizedRadius =
          ring.key === 'outer'
            ? profile.outerRadius
            : profile.outerRadius * Number(profile[ring.ratio]);
        const radiusPx = normalizedRadius * transform.baseSize;
        const selected = selectedRing === ring.key;
        return (
          <Pressable
            key={ring.key}
            accessibilityRole="button"
            accessibilityLabel={ring.label}
            disabled={!editable}
            onPress={() => onSelectRing?.(ring.key)}
            onLongPress={() => onAdjustRing?.(ring.key, 0.002)}
            onStartShouldSetResponder={() => editable}
            style={[
              styles.ring,
              {
                left: transform.centerXPx - radiusPx,
                top: transform.centerYPx - radiusPx,
                width: radiusPx * 2,
                height: radiusPx * 2,
                borderRadius: radiusPx,
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
        onStartShouldSetResponder={() => editable}
        onResponderGrant={beginDrag('center')}
        onResponderMove={(event) => updateFromPointer('center', event)}
        style={[
          styles.centerHandle,
          {
            left: transform.centerXPx,
            top: transform.centerYPx,
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
        onStartShouldSetResponder={() => editable}
        onResponderGrant={beginDrag('rotation')}
        onResponderMove={(event) => updateFromPointer('rotation', event)}
        style={[
          styles.rotationHandle,
          {
            left: transform.boardToScreen({ x: 0, y: -1, radius: 1, angleDeg: 0 }).x,
            top: transform.boardToScreen({ x: 0, y: -1, radius: 1, angleDeg: 0 }).y,
            transform: [{ rotate: `${profile.rotationDeg}deg` }],
          },
        ]}
      >
        <Text style={styles.rotationText}>20</Text>
      </Pressable>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="外周scale"
        disabled={!editable}
        onPress={() => onScaleOuter?.(0.01)}
        onStartShouldSetResponder={() => editable}
        onResponderGrant={beginDrag('outer')}
        onResponderMove={(event) => updateFromPointer('outer', event)}
        style={[
          styles.outerHandle,
          {
            left: transform.centerXPx + transform.outerRadiusPx,
            top: transform.centerYPx,
          },
        ]}
      >
        <Text style={styles.outerText}>↔</Text>
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
  outerHandle: {
    position: 'absolute',
    width: 34,
    height: 34,
    marginLeft: -17,
    marginTop: -17,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 999,
    backgroundColor: 'rgba(245,158,11,0.92)',
  },
  outerText: {
    color: '#ffffff',
    fontSize: 13,
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
