import { Pressable, StyleSheet, Text } from 'react-native';

import { useAppState } from '../contexts/AppStateContext';

type RoundIconButtonProps = {
  onPress: () => void;
  accessibilityLabel: string;
  symbol?: string;
};

export function RoundIconButton({
  onPress,
  accessibilityLabel,
  symbol = '▶',
}: RoundIconButtonProps) {
  const { theme } = useAppState();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: theme.primarySoft, borderColor: theme.border },
        pressed && styles.pressed,
      ]}
    >
      <Text style={[styles.symbol, { color: theme.primaryDark }]}>{symbol}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.75,
  },
  symbol: {
    fontSize: 16,
    fontWeight: '900',
    lineHeight: 18,
  },
});
