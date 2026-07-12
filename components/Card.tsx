import type { PropsWithChildren } from 'react';
import { StyleSheet, View } from 'react-native';

import { useAppState } from '../contexts/AppStateContext';

type CardProps = PropsWithChildren<{
  muted?: boolean;
}>;

export function Card({ children, muted = false }: CardProps) {
  const { theme } = useAppState();

  return (
    <View
      style={[
        styles.card,
        {
          borderColor: theme.border,
          backgroundColor: muted ? theme.mutedCard : theme.surface,
        },
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
    shadowColor: '#000000',
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
});
