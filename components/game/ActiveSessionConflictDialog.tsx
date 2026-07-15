import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { colors } from '../../constants/theme';
import type { ActiveSessionMode } from '../../features/game/application/services';
import { AppButton } from '../AppButton';

type ActiveSessionConflictDialogProps = {
  visible: boolean;
  activeMode: ActiveSessionMode;
  activeLabel: string;
  activeStatus?: 'in_progress' | 'paused';
  onResume: () => void;
  onAbortAndStart: () => void;
  onCancel: () => void;
  isProcessing?: boolean;
};

export function ActiveSessionConflictDialog({
  visible,
  activeMode,
  activeLabel,
  activeStatus = 'paused',
  onResume,
  onAbortAndStart,
  onCancel,
  isProcessing = false,
}: ActiveSessionConflictDialogProps) {
  const statusLabel =
    activeStatus === 'paused'
      ? '一時停止中です。'
      : activeMode === 'match'
        ? '進行中です。'
        : '進行中です。';

  return (
    <Modal
      transparent
      visible={visible}
      animationType="fade"
      onRequestClose={onCancel}
      statusBarTranslucent
    >
      <View style={styles.backdrop}>
        <Pressable
          accessibilityRole="none"
          aria-hidden
          focusable={false}
          style={StyleSheet.absoluteFill}
        />
        <View accessibilityRole="alert" style={styles.dialog}>
          <Text style={styles.title}>進行中のゲームがあります</Text>
          <Text style={styles.message}>
            {activeLabel}が{statusLabel}
            {'\n'}
            再開するか、途中終了して新しいゲームを開始してください。
          </Text>
          <View style={styles.actions}>
            <AppButton label="再開する" onPress={onResume} disabled={isProcessing} />
            <AppButton
              label={isProcessing ? '処理中...' : '途中終了して新しいゲームを開始'}
              onPress={onAbortAndStart}
              disabled={isProcessing}
              variant="danger"
            />
            <AppButton
              label="キャンセル"
              onPress={onCancel}
              disabled={isProcessing}
              variant="secondary"
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 18,
    backgroundColor: 'rgba(17, 24, 39, 0.58)',
  },
  dialog: {
    width: '100%',
    maxWidth: 460,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 18,
    backgroundColor: colors.surface,
  },
  title: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '900',
  },
  message: {
    marginTop: 10,
    color: colors.textMuted,
    fontSize: 15,
    fontWeight: '700',
    lineHeight: 22,
  },
  actions: {
    gap: 10,
    marginTop: 18,
  },
});
