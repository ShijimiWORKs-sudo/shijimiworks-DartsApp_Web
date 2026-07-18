import { useMemo, useState } from 'react';
import type { LayoutChangeEvent } from 'react-native';
import { StyleSheet, Text, View } from 'react-native';

import type { BoardCalibrationProfile } from '../../features/camera/calibration/domain/types';
import { getCalibrationViewportTransform } from '../../features/camera/calibration/domain/coordinateTransform';
import type { CameraDetectionCandidate } from '../../features/camera/detection/domain/types';
import type { DetectionCandidate } from '../../features/camera/lan/domain/protocol';

type CandidateMarkerOverlayProps = {
  profile: BoardCalibrationProfile;
  candidates: CameraDetectionCandidate[];
};

const markerColors = ['#ef4444', '#facc15', '#3b82f6'];

export function CandidateMarkerOverlay({ profile, candidates }: CandidateMarkerOverlayProps) {
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

  return (
    <View
      pointerEvents="none"
      onLayout={handleLayout}
      style={styles.overlay}
      testID="candidate-marker-overlay"
    >
      {collectRejectedShadowComponents(candidates).map((shadow, index) => {
        const box = toScreenBox(shadow.boundingBox, transform);
        return (
          <View
            key={`shadow-${index}-${shadow.boundingBox.x}-${shadow.boundingBox.y}`}
            style={[
              styles.shadowBox,
              {
                left: box.left,
                top: box.top,
                width: box.width,
                height: box.height,
              },
            ]}
          />
        );
      })}
      {candidates.slice(0, 3).map((candidate, index) => {
        const diagnosticCandidate = candidate as Partial<DetectionCandidate>;
        const color = markerColors[index] ?? '#ffffff';
        const point = transform.canonicalToScreen({
          x: candidate.normalizedX,
          y: candidate.normalizedY,
        });
        const box = diagnosticCandidate.componentBoundingBox
          ? toScreenBox(diagnosticCandidate.componentBoundingBox, transform)
          : null;
        const axis = diagnosticCandidate.fittedAxis
          ? {
              start: transform.canonicalToScreen(diagnosticCandidate.fittedAxis.start),
              end: transform.canonicalToScreen(diagnosticCandidate.fittedAxis.end),
            }
          : null;
        const coreBox = diagnosticCandidate.narrowCoreBoundingBox
          ? toScreenBox(diagnosticCandidate.narrowCoreBoundingBox, transform)
          : null;
        return (
          <View key={candidate.candidateId}>
            {box ? (
              <View
                style={[
                  styles.boundingBox,
                  {
                    borderColor: color,
                    left: box.left,
                    top: box.top,
                    width: box.width,
                    height: box.height,
                  },
                ]}
              />
            ) : null}
            {coreBox ? (
              <View
                style={[
                  styles.coreBox,
                  {
                    borderColor: color,
                    left: coreBox.left,
                    top: coreBox.top,
                    width: coreBox.width,
                    height: coreBox.height,
                  },
                ]}
              />
            ) : null}
            {axis ? (
              <View
                style={[
                  styles.axis,
                  {
                    left: axis.start.x,
                    top: axis.start.y,
                    width: Math.max(1, distance(axis.start, axis.end)),
                    backgroundColor: color,
                    transform: [{ rotate: `${angle(axis.start, axis.end)}deg` }],
                  },
                ]}
              />
            ) : null}
            {diagnosticCandidate.tipCandidates?.map((tip, tipIndex) => {
              const tipPoint = transform.canonicalToScreen(tip);
              return (
                <View
                  key={`${candidate.candidateId}-tip-${tipIndex}`}
                  style={[
                    styles.tipDot,
                    {
                      left: tipPoint.x,
                      top: tipPoint.y,
                      borderColor: color,
                    },
                  ]}
                />
              );
            })}
            <View
              style={[
                styles.crossHorizontal,
                { left: point.x, top: point.y, backgroundColor: color },
              ]}
            />
            <View
              style={[
                styles.crossVertical,
                { left: point.x, top: point.y, backgroundColor: color },
              ]}
            />
            <Text style={[styles.label, { left: point.x, top: point.y, color }]}>
              {formatCandidate(candidate)}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

function collectRejectedShadowComponents(candidates: CameraDetectionCandidate[]) {
  const seen = new Set<string>();
  const shadows: NonNullable<DetectionCandidate['rejectedShadowComponents']> = [];
  for (const candidate of candidates) {
    const diagnosticCandidate = candidate as Partial<DetectionCandidate>;
    for (const shadow of diagnosticCandidate.rejectedShadowComponents ?? []) {
      const key = `${shadow.boundingBox.x.toFixed(3)}-${shadow.boundingBox.y.toFixed(3)}-${shadow.boundingBox.width.toFixed(3)}-${shadow.boundingBox.height.toFixed(3)}`;
      if (!seen.has(key)) {
        seen.add(key);
        shadows.push(shadow);
      }
    }
  }
  return shadows;
}

function toScreenBox(
  box: { x: number; y: number; width: number; height: number },
  transform: ReturnType<typeof getCalibrationViewportTransform>,
) {
  const topLeft = transform.canonicalToScreen({ x: box.x, y: box.y });
  const bottomRight = transform.canonicalToScreen({
    x: box.x + box.width,
    y: box.y + box.height,
  });
  return {
    left: Math.min(topLeft.x, bottomRight.x),
    top: Math.min(topLeft.y, bottomRight.y),
    width: Math.abs(bottomRight.x - topLeft.x),
    height: Math.abs(bottomRight.y - topLeft.y),
  };
}

function formatCandidate(candidate: CameraDetectionCandidate) {
  if (candidate.multiplier === 0) {
    return 'MISS';
  }
  if (candidate.segment === 25) {
    return candidate.multiplier === 2 ? 'IB' : 'OB';
  }
  return `${candidate.multiplier === 3 ? 'T' : candidate.multiplier === 2 ? 'D' : 'S'}${
    candidate.segment
  }`;
}

function distance(first: { x: number; y: number }, second: { x: number; y: number }) {
  return Math.sqrt((first.x - second.x) ** 2 + (first.y - second.y) ** 2);
}

function angle(first: { x: number; y: number }, second: { x: number; y: number }) {
  return (Math.atan2(second.y - first.y, second.x - first.x) * 180) / Math.PI;
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
  },
  boundingBox: {
    position: 'absolute',
    borderWidth: 2,
    backgroundColor: 'rgba(0,0,0,0.02)',
  },
  shadowBox: {
    position: 'absolute',
    borderWidth: 2,
    borderColor: 'rgba(148,163,184,0.85)',
    backgroundColor: 'rgba(148,163,184,0.18)',
  },
  coreBox: {
    position: 'absolute',
    borderWidth: 2,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  axis: {
    position: 'absolute',
    height: 2,
    transformOrigin: 'left center',
  },
  tipDot: {
    position: 'absolute',
    width: 10,
    height: 10,
    marginLeft: -5,
    marginTop: -5,
    borderWidth: 2,
    borderRadius: 999,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  crossHorizontal: {
    position: 'absolute',
    width: 24,
    height: 3,
    marginLeft: -12,
    marginTop: -1.5,
  },
  crossVertical: {
    position: 'absolute',
    width: 3,
    height: 24,
    marginLeft: -1.5,
    marginTop: -12,
  },
  label: {
    position: 'absolute',
    marginLeft: 10,
    marginTop: -24,
    fontSize: 12,
    fontWeight: '900',
    textShadowColor: 'rgba(0,0,0,0.9)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
});
