import { Pressable, StyleSheet, Text } from 'react-native';

import { useAppState } from '../contexts/AppStateContext';
import type { AppButtonVariant } from './appButtonVariants';
import { resolveAppButtonVariantColors } from './appButtonVariants';

type AppButtonProps = {
  label: string;
  onPress: () => void;
  variant?: AppButtonVariant;
  accessibilityLabel?: string;
  disabled?: boolean;
};

export function AppButton({
  label,
  onPress,
  variant = 'primary',
  accessibilityLabel,
  disabled = false,
}: AppButtonProps) {
  const { theme } = useAppState();
  const variantColors = resolveAppButtonVariantColors(variant, theme);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        {
          backgroundColor: variantColors.backgroundColor,
        },
        variant === 'secondary' && {
          borderColor: variantColors.borderColor,
        },
        disabled && styles.disabled,
        pressed && styles.pressed,
      ]}
    >
      <Text style={[styles.label, { color: variantColors.labelColor }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: 50,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
  },
  secondary: {
    borderWidth: 1,
    backgroundColor: '#ffffff',
  },
  pressed: {
    opacity: 0.78,
  },
  disabled: {
    opacity: 0.46,
  },
  label: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '800',
  },
});
