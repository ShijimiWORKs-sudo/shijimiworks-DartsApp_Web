import { StyleSheet, Text, View } from 'react-native';

import { AppButton } from '../AppButton';
import { colors } from '../../constants/theme';
import type { CameraDetectionCandidate } from '../../features/camera/detection/domain/types';

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
  onMiss,
  onCaptureBaseline,
  onAnalyzeCurrentFrame,
}: CandidateConfirmationPanelProps) {
  const selected = candidates[selectedIndex] ?? null;

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
  actionGrid: {
    gap: 10,
    marginTop: 12,
  },
});
