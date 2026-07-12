import { Pressable, StyleSheet, Text } from 'react-native';

import { useAppState } from '../contexts/AppStateContext';

type AppButtonProps = {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'danger';
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

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        {
          backgroundColor: variant === 'danger' ? theme.danger : theme.primary,
        },
        variant === 'secondary' && {
          borderColor: theme.border,
          backgroundColor: theme.surface,
        },
        disabled && styles.disabled,
        pressed && styles.pressed,
      ]}
    >
      <Text style={[styles.label, variant === 'secondary' && { color: theme.primaryDark }]}>
        {label}
      </Text>
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
