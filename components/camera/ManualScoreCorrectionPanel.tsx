import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AppButton } from '../AppButton';
import { colors } from '../../constants/theme';
import type { DartArea } from '../../features/game/domain/types';
export { calculateManualCorrectionScore } from '../../features/camera/detection/application/manualScoreCorrection';

type ManualScoreCorrectionPanelProps = {
  selectedSegment: number;
  selectedMultiplier: 1 | 2 | 3;
  disabled?: boolean;
  onSelectSegment: (segment: number) => void;
  onSelectMultiplier: (multiplier: 1 | 2 | 3) => void;
  onRecord: (area: DartArea, segmentNumber: number | null) => void;
};

const segments = Array.from({ length: 20 }, (_, index) => index + 1);

export function ManualScoreCorrectionPanel({
  selectedSegment,
  selectedMultiplier,
  disabled = false,
  onSelectSegment,
  onSelectMultiplier,
  onRecord,
}: ManualScoreCorrectionPanelProps) {
  const selectedArea = multiplierToArea(selectedMultiplier);

  return (
    <View testID="manual-score-correction-panel">
      <View style={styles.segmentGrid}>
        {segments.map((segment) => (
          <Pressable
            key={segment}
            accessibilityRole="button"
            accessibilityLabel={`segment-${segment}`}
            accessibilityState={{ selected: selectedSegment === segment }}
            disabled={disabled}
            onPress={() => onSelectSegment(segment)}
            style={({ pressed }) => [
              styles.segmentButton,
              selectedSegment === segment && styles.segmentButtonSelected,
              pressed && styles.pressed,
            ]}
          >
            <Text
              style={[
                styles.segmentText,
                selectedSegment === segment && styles.segmentTextSelected,
              ]}
            >
              {segment}
            </Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.multiplierRow}>
        <AppButton
          label="Single"
          onPress={() => {
            onSelectMultiplier(1);
            onRecord('single', selectedSegment);
          }}
          disabled={disabled}
          variant={selectedMultiplier === 1 ? 'primary' : 'secondary'}
        />
        <AppButton
          label="Double"
          onPress={() => {
            onSelectMultiplier(2);
            onRecord('double', selectedSegment);
          }}
          disabled={disabled}
          variant={selectedMultiplier === 2 ? 'primary' : 'secondary'}
        />
        <AppButton
          label="Triple"
          onPress={() => {
            onSelectMultiplier(3);
            onRecord('triple', selectedSegment);
          }}
          disabled={disabled}
          variant={selectedMultiplier === 3 ? 'primary' : 'secondary'}
        />
      </View>

      <View style={styles.bullRow}>
        <AppButton
          label="Outer Bull"
          onPress={() => onRecord('outer_bull', null)}
          disabled={disabled}
          variant="secondary"
        />
        <AppButton
          label="Inner Bull"
          onPress={() => onRecord('inner_bull', null)}
          disabled={disabled}
        />
        <AppButton
          label="MISS"
          onPress={() => onRecord('miss', null)}
          disabled={disabled}
          variant="secondary"
        />
      </View>

      <Text style={styles.selectedText}>
        選択中: {formatSelection(selectedArea, selectedSegment)}
      </Text>
    </View>
  );
}

function multiplierToArea(
  multiplier: 1 | 2 | 3,
): Extract<DartArea, 'single' | 'double' | 'triple'> {
  if (multiplier === 3) {
    return 'triple';
  }
  if (multiplier === 2) {
    return 'double';
  }
  return 'single';
}

function formatSelection(area: DartArea, segmentNumber: number | null) {
  if (area === 'miss') {
    return 'MISS';
  }
  if (area === 'inner_bull') {
    return 'Inner Bull';
  }
  if (area === 'outer_bull') {
    return 'Outer Bull';
  }
  const prefix = area === 'triple' ? 'T' : area === 'double' ? 'D' : 'S';
  return `${prefix}${segmentNumber}`;
}

const styles = StyleSheet.create({
  segmentGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 7,
    marginTop: 12,
  },
  segmentButton: {
    width: 48,
    minHeight: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceMuted,
  },
  segmentButtonSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
  },
  segmentText: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '900',
  },
  segmentTextSelected: {
    color: colors.primaryDark,
  },
  multiplierRow: {
    gap: 10,
    marginTop: 12,
  },
  bullRow: {
    gap: 10,
    marginTop: 10,
  },
  selectedText: {
    marginTop: 10,
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '800',
  },
  pressed: {
    opacity: 0.72,
  },
});
