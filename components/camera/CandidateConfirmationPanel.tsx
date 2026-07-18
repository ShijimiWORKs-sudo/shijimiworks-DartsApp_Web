import { StyleSheet, Text, View } from 'react-native';

import { AppButton } from '../AppButton';
import { colors } from '../../constants/theme';
import type { CameraDetectionCandidate } from '../../features/camera/detection/domain/types';
import type { DetectionCandidate } from '../../features/camera/lan/domain/protocol';

export type CandidatePanelOption = {
  label: string;
  reason: string;
  candidate: CameraDetectionCandidate;
};

type CandidateConfirmationPanelProps = {
  message: string;
  candidates: CandidatePanelOption[];
  selectedIndex: number;
  disabled?: boolean;
  onSelect: (index: number) => void;
  onConfirm: (index: number) => void;
  onCorrect: () => void;
  onReject: () => void;
  onMiss: () => void;
  onCaptureBaseline: () => void;
  onAnalyzeCurrentFrame: () => void;
};

export function CandidateConfirmationPanel({
  message,
  candidates,
  selectedIndex,
  disabled = false,
  onSelect,
  onConfirm,
  onCorrect,
  onReject,
  onMiss,
  onCaptureBaseline,
  onAnalyzeCurrentFrame,
}: CandidateConfirmationPanelProps) {
  const selected = candidates[selectedIndex] ?? null;
  const selectedDiagnostics = selected?.candidate as Partial<DetectionCandidate> | undefined;

  return (
    <View testID="candidate-confirmation-panel">
      <Text style={styles.message}>{message}</Text>
      {selected ? (
        <View style={styles.candidateBox}>
          <Text style={styles.candidateLabel}>{selected.label}</Text>
          <Text style={styles.candidateScore}>{formatCandidate(selected.candidate)}</Text>
          <Text style={styles.meta}>
            Confidence {(selected.candidate.confidence * 100).toFixed(0)}% / 処理時間{' '}
            {selected.candidate.processingMs}ms
          </Text>
          <Text style={styles.meta}>
            座標 {selected.candidate.normalizedX.toFixed(3)},{' '}
            {selected.candidate.normalizedY.toFixed(3)}
          </Text>
          <Text style={styles.meta}>理由: {selected.reason}</Text>
          {selectedDiagnostics?.scoreDiagnostics ? (
            <View style={styles.diagnosticsGrid}>
              <Text style={styles.meta}>
                board radius {selectedDiagnostics.scoreDiagnostics.boardRadius.toFixed(3)} / angle{' '}
                {selectedDiagnostics.scoreDiagnostics.boardAngleDeg.toFixed(1)}°
              </Text>
              <Text style={styles.meta}>
                segment index{' '}
                {selectedDiagnostics.scoreDiagnostics.segmentIndex == null
                  ? '-'
                  : selectedDiagnostics.scoreDiagnostics.segmentIndex}{' '}
                / number {selectedDiagnostics.scoreDiagnostics.segmentNumber ?? '-'}
              </Text>
              <Text style={styles.meta}>
                area {selectedDiagnostics.scoreDiagnostics.area} / multiplier{' '}
                {selectedDiagnostics.scoreDiagnostics.multiplier} / score{' '}
                {selectedDiagnostics.scoreDiagnostics.score}
              </Text>
              <Text style={styles.meta}>
                Double外周内 {selectedDiagnostics.scoreDiagnostics.withinDoubleOuter ? 'yes' : 'no'}{' '}
                / boundary{' '}
                {selectedDiagnostics.scoreDiagnostics.distanceToSegmentBoundaryDeg == null
                  ? '-'
                  : `${selectedDiagnostics.scoreDiagnostics.distanceToSegmentBoundaryDeg.toFixed(
                      1,
                    )}°`}
              </Text>
              <Text style={styles.meta}>
                profile {selectedDiagnostics.scoreDiagnostics.calibrationProfileId ?? '-'} /
                rotation{' '}
                {selectedDiagnostics.scoreDiagnostics.rotationDeg == null
                  ? '-'
                  : `${selectedDiagnostics.scoreDiagnostics.rotationDeg.toFixed(1)}°`}
              </Text>
            </View>
          ) : null}
          {selectedDiagnostics?.componentDiagnostics ? (
            <View style={styles.diagnosticsGrid}>
              <Text style={styles.meta}>
                component box {formatBox(selectedDiagnostics.componentBoundingBox)} / elongation{' '}
                {selectedDiagnostics.componentDiagnostics.elongation.toFixed(2)}
              </Text>
              <Text style={styles.meta}>
                area {selectedDiagnostics.componentDiagnostics.area} / axis{' '}
                {selectedDiagnostics.componentDiagnostics.majorAxisLength.toFixed(1)}×
                {selectedDiagnostics.componentDiagnostics.minorAxisLength.toFixed(1)}
              </Text>
              <Text style={styles.meta}>
                delta avg {selectedDiagnostics.componentDiagnostics.averageDelta.toFixed(1)} / max{' '}
                {selectedDiagnostics.componentDiagnostics.maxDelta}
              </Text>
              <Text style={styles.meta}>
                overlap{' '}
                {(selectedDiagnostics.componentDiagnostics.boardOverlapRatio * 100).toFixed(0)}% /
                tip {selectedDiagnostics.componentDiagnostics.tipSelectionReason}
              </Text>
              <Text style={styles.meta}>
                dart likelihood{' '}
                {(selectedDiagnostics.componentDiagnostics.dartLikelihood * 100).toFixed(0)}% /
                shadow likelihood{' '}
                {(selectedDiagnostics.componentDiagnostics.shadowLikelihood * 100).toFixed(0)}%
              </Text>
              <Text style={styles.meta}>
                edge sharpness {selectedDiagnostics.componentDiagnostics.edgeSharpness.toFixed(1)} /
                width {selectedDiagnostics.componentDiagnostics.averageWidth.toFixed(1)} / skeleton{' '}
                {selectedDiagnostics.componentDiagnostics.skeletonLength.toFixed(1)}
              </Text>
              <Text style={styles.meta}>
                core box {formatBox(selectedDiagnostics.narrowCoreBoundingBox)} / rejection{' '}
                {selectedDiagnostics.componentDiagnostics.rejectionReason ?? '-'}
              </Text>
            </View>
          ) : null}
        </View>
      ) : (
        <Text style={styles.meta}>候補はありません。手動補正またはMISSで続行できます。</Text>
      )}

      <View style={styles.actionGrid}>
        <AppButton
          label="基準画像を再取得"
          onPress={onCaptureBaseline}
          disabled={disabled}
          variant="secondary"
        />
        <AppButton label="現在画像を解析" onPress={onAnalyzeCurrentFrame} disabled={disabled} />
        <AppButton
          label="第一候補を確定"
          onPress={() => onConfirm(0)}
          disabled={disabled || candidates.length < 1}
        />
        <AppButton
          label="第二候補を確定"
          onPress={() => onConfirm(1)}
          disabled={disabled || candidates.length < 2}
          variant="secondary"
        />
        <AppButton
          label="第三候補を確定"
          onPress={() => onConfirm(2)}
          disabled={disabled || candidates.length < 3}
          variant="secondary"
        />
        <AppButton
          label="位置を修正"
          onPress={onCorrect}
          disabled={disabled || !selected}
          variant="secondary"
        />
        <AppButton
          label="拒否"
          onPress={onReject}
          disabled={disabled || !selected}
          variant="secondary"
        />
        <AppButton
          label="数字から手動補正"
          onPress={() => onSelect(selectedIndex)}
          disabled={disabled}
          variant="secondary"
        />
        <AppButton label="MISS" onPress={onMiss} disabled={disabled} variant="secondary" />
      </View>
    </View>
  );
}

function formatBox(box: Partial<DetectionCandidate>['componentBoundingBox']) {
  if (!box) {
    return '-';
  }
  return `${box.x.toFixed(3)},${box.y.toFixed(3)} ${box.width.toFixed(3)}×${box.height.toFixed(3)}`;
}

function formatCandidate(candidate: CameraDetectionCandidate) {
  if (candidate.multiplier === 0) {
    return 'MISS';
  }
  if (candidate.segment === 25) {
    return candidate.multiplier === 2 ? 'Inner Bull' : 'Outer Bull';
  }
  const prefix = candidate.multiplier === 3 ? 'T' : candidate.multiplier === 2 ? 'D' : 'S';
  return `${prefix}${candidate.segment}`;
}

const styles = StyleSheet.create({
  message: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '800',
    lineHeight: 19,
  },
  candidateBox: {
    marginTop: 12,
    borderRadius: 8,
    padding: 12,
    backgroundColor: colors.primarySoft,
  },
  candidateLabel: {
    color: colors.primaryDark,
    fontSize: 13,
    fontWeight: '900',
  },
  candidateScore: {
    color: colors.primaryDark,
    fontSize: 30,
    fontWeight: '900',
  },
  meta: {
    marginTop: 4,
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '800',
    lineHeight: 18,
  },
  diagnosticsGrid: {
    marginTop: 8,
    gap: 2,
  },
  actionGrid: {
    gap: 10,
    marginTop: 12,
  },
});
