import { StyleSheet, Text, TextInput, View } from 'react-native';

import { AppButton } from '../AppButton';
import { colors } from '../../constants/theme';
import type { BoardCalibrationEditorApi } from '../../features/camera/calibration/ui/useBoardCalibrationEditor';
import { calibrationRingKeys } from '../../features/camera/calibration/domain/profile';
import type { CalibrationRingKey } from '../../features/camera/calibration/domain/types';

const ringLabels: Record<CalibrationRingKey, string> = {
  outer: 'ボード外周',
  double_outer: 'Double外側',
  double_inner: 'Double内側',
  triple_outer: 'Triple外側',
  triple_inner: 'Triple内側',
  outer_bull: 'Outer Bull外側',
  inner_bull: 'Inner Bull外側',
};

type CalibrationControlPanelProps = {
  editor: BoardCalibrationEditorApi;
};

export function CalibrationControlPanel({ editor }: CalibrationControlPanelProps) {
  const profile = editor.profile;

  return (
    <View testID="calibration-control-panel">
      <InfoRow label="状態" value={formatStatus(editor.status, editor.dirty)} />
      <InfoRow label="Profile ID" value={profile.profileId} />
      <InfoRow label="左右反転" value={profile.previewMirrored ? 'ON' : 'OFF'} />
      <View style={styles.actionGrid}>
        <AppButton
          label={`映像を左右反転 ${profile.previewMirrored ? 'ON' : 'OFF'}`}
          onPress={() => editor.setPreviewMirrored(!profile.previewMirrored)}
          variant="secondary"
        />
        <AppButton label="保存" onPress={() => void editor.save()} />
        <AppButton label="調整前へ戻す" onPress={editor.undoChange} variant="secondary" />
        <AppButton label="前回保存値へ戻す" onPress={editor.revertToSaved} variant="secondary" />
        <AppButton label="初期値へリセット" onPress={editor.resetToDefault} variant="secondary" />
      </View>

      <Text style={styles.sectionLabel}>中心</Text>
      <View style={styles.inputRow}>
        <NumberInput label="center X" value={profile.centerX} onChange={editor.setCenterX} />
        <NumberInput label="center Y" value={profile.centerY} onChange={editor.setCenterY} />
      </View>
      <View style={styles.buttonRow}>
        <AppButton label="←" onPress={() => editor.moveCenter(-0.0025, 0)} variant="secondary" />
        <AppButton label="→" onPress={() => editor.moveCenter(0.0025, 0)} variant="secondary" />
        <AppButton label="↑" onPress={() => editor.moveCenter(0, -0.0025)} variant="secondary" />
        <AppButton label="↓" onPress={() => editor.moveCenter(0, 0.0025)} variant="secondary" />
      </View>

      <Text style={styles.sectionLabel}>大きさ / 回転</Text>
      <View style={styles.inputRow}>
        <NumberInput
          label="outerRadius"
          value={profile.outerRadius}
          onChange={editor.setOuterRadius}
        />
        <NumberInput
          label="rotation"
          value={profile.rotationDeg}
          onChange={editor.setRotationDeg}
        />
      </View>
      <View style={styles.buttonRow}>
        <AppButton label="Scale -" onPress={() => editor.scaleOuter(-0.01)} variant="secondary" />
        <AppButton label="Scale +" onPress={() => editor.scaleOuter(0.01)} variant="secondary" />
        <AppButton label="Rotate -" onPress={() => editor.rotate(-1)} variant="secondary" />
        <AppButton label="Rotate +" onPress={() => editor.rotate(1)} variant="secondary" />
      </View>

      <Text style={styles.sectionLabel}>リング個別調整</Text>
      <View style={styles.ringGrid}>
        {calibrationRingKeys.map((ring) => (
          <AppButton
            key={ring}
            label={ringLabels[ring]}
            onPress={() => editor.setSelectedRing(ring)}
            variant={editor.selectedRing === ring ? 'primary' : 'secondary'}
          />
        ))}
      </View>
      <View style={styles.buttonRow}>
        <AppButton
          label="-1px相当"
          onPress={() => editor.adjustSelectedRing(-0.002)}
          variant="secondary"
        />
        <AppButton
          label="+1px相当"
          onPress={() => editor.adjustSelectedRing(0.002)}
          variant="secondary"
        />
      </View>
      <RingValueRow label="Double外側" value={profile.doubleOuterRatio} />
      <RingValueRow label="Double内側" value={profile.doubleInnerRatio} />
      <RingValueRow label="Triple外側" value={profile.tripleOuterRatio} />
      <RingValueRow label="Triple内側" value={profile.tripleInnerRatio} />
      <RingValueRow label="Outer Bull" value={profile.outerBullRatio} />
      <RingValueRow label="Inner Bull" value={profile.innerBullRatio} />

      {editor.invalidReasons.length > 0 ? (
        <Text style={styles.error}>Calibration無効: {editor.invalidReasons.join(', ')}</Text>
      ) : (
        <Text style={styles.valid}>Calibration有効 / 保存すると自動判定へ利用できます。</Text>
      )}
    </View>
  );
}

function NumberInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <View style={styles.numberInputWrap}>
      <Text style={styles.inputLabel}>{label}</Text>
      <TextInput
        value={Number.isInteger(value) ? String(value) : value.toFixed(3)}
        onChangeText={(text) => {
          const next = Number(text);
          if (Number.isFinite(next)) {
            onChange(next);
          }
        }}
        keyboardType="decimal-pad"
        style={styles.numberInput}
      />
    </View>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

function RingValueRow({ label, value }: { label: string; value: number }) {
  return <InfoRow label={label} value={value.toFixed(3)} />;
}

function formatStatus(status: string, dirty: boolean) {
  if (status === 'saved') {
    return '保存済み';
  }
  if (status === 'editing') {
    return dirty ? '調整中 / 未保存' : '調整中';
  }
  if (status === 'unset') {
    return '未設定';
  }
  return 'Calibration無効';
}

const styles = StyleSheet.create({
  actionGrid: {
    gap: 10,
    marginTop: 12,
  },
  inputRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 8,
  },
  buttonRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 10,
  },
  ringGrid: {
    gap: 8,
    marginTop: 10,
  },
  sectionLabel: {
    marginTop: 16,
    color: colors.text,
    fontSize: 14,
    fontWeight: '900',
  },
  numberInputWrap: {
    flex: 1,
  },
  inputLabel: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '800',
  },
  numberInput: {
    minHeight: 42,
    marginTop: 4,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 10,
    color: colors.text,
    backgroundColor: colors.surfaceMuted,
    fontSize: 13,
    fontWeight: '800',
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
    marginTop: 8,
  },
  infoLabel: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '800',
  },
  infoValue: {
    flex: 1,
    color: colors.text,
    fontSize: 13,
    fontWeight: '900',
    textAlign: 'right',
  },
  valid: {
    marginTop: 12,
    color: colors.primaryDark,
    fontSize: 13,
    fontWeight: '900',
  },
  error: {
    marginTop: 12,
    color: colors.danger,
    fontSize: 13,
    fontWeight: '900',
  },
});
