import { StyleSheet, Text, View } from 'react-native';

import { useAppState } from '../contexts/AppStateContext';

type StatCardProps = {
  label: string;
  value: string;
  helper?: string;
};

export function StatCard({ label, value, helper }: StatCardProps) {
  const { theme } = useAppState();

  return (
    <View style={[styles.card, { borderColor: theme.border, backgroundColor: theme.surface }]}>
      <Text style={[styles.label, { color: theme.textMuted }]}>{label}</Text>
      <Text style={[styles.value, { color: theme.text }]}>{value}</Text>
      {helper ? <Text style={[styles.helper, { color: theme.primaryDark }]}>{helper}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    minHeight: 98,
    justifyContent: 'space-between',
    padding: 14,
    borderRadius: 8,
    borderWidth: 1,
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
  },
  value: {
    fontSize: 26,
    fontWeight: '900',
  },
  helper: {
    fontSize: 12,
    fontWeight: '700',
  },
});
