import { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { colors } from '../../constants/theme';
import { AppButton } from '../AppButton';

export type GameLeaveDialogStep = 'leave' | 'abort';

type GameLeaveDialogProps = {
  visible: boolean;
  gameLabel: string;
  canPause: boolean;
  isProcessing: boolean;
  errorMessage?: string | null;
  initialStep?: GameLeaveDialogStep;
  onPauseAndLeave: () => void;
  onContinue: () => void;
  onRequestAbort: () => void;
};

export function GameLeaveDialog({
  visible,
  gameLabel,
  canPause,
  isProcessing,
  errorMessage = null,
  initialStep = 'leave',
  onPauseAndLeave,
  onContinue,
  onRequestAbort,
}: GameLeaveDialogProps) {
  const [step, setStep] = useState<GameLeaveDialogStep>(initialStep);

  useEffect(() => {
    if (visible) {
      setStep(initialStep);
      return;
    }

    setStep('leave');
  }, [initialStep, visible]);

  const isAbortStep = step === 'abort';

  return (
    <Modal
      transparent
      visible={visible}
      animationType="fade"
      onRequestClose={onContinue}
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
          <Text style={styles.kicker}>{gameLabel}</Text>
          <Text style={styles.title}>
            {isAbortStep ? 'ゲームを途中終了しますか？' : 'ゲームを離れますか？'}
          </Text>
          <Text style={styles.message}>
            {isAbortStep
              ? '途中終了したゲームは結果として保存されません。'
              : '進行中のゲームを一時停止して戻るか、\n途中終了として保存できます。'}
          </Text>
          {errorMessage ? <Text style={styles.error}>{errorMessage}</Text> : null}

          <View style={styles.actions}>
            {isAbortStep ? (
              <>
                <AppButton
                  label={isProcessing ? '処理中...' : '途中終了を確定'}
                  onPress={onRequestAbort}
                  disabled={isProcessing}
                  variant="danger"
                />
                <AppButton
                  label="戻る"
                  onPress={() => setStep('leave')}
                  disabled={isProcessing}
                  variant="secondary"
                />
              </>
            ) : (
              <>
                <AppButton
                  label={isProcessing ? '処理中...' : '一時停止してゲームハブへ戻る'}
                  onPress={onPauseAndLeave}
                  disabled={!canPause || isProcessing}
                />
                <AppButton
                  label="ゲームを続ける"
                  onPress={onContinue}
                  disabled={isProcessing}
                  variant="secondary"
                />
                <AppButton
                  label="途中終了する"
                  onPress={() => setStep('abort')}
                  disabled={isProcessing}
                  variant="danger"
                />
              </>
            )}
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
    maxWidth: 480,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 18,
    backgroundColor: colors.surface,
  },
  kicker: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '900',
  },
  title: {
    marginTop: 4,
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
  error: {
    marginTop: 12,
    borderRadius: 8,
    padding: 10,
    color: colors.danger,
    fontSize: 14,
    fontWeight: '800',
    backgroundColor: 'rgba(185, 28, 28, 0.08)',
  },
  actions: {
    gap: 10,
    marginTop: 18,
  },
});
